import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { API_URL, TOKEN_KEY } from '../api'
import { server } from '../test/server'
import ContactForm from './ContactForm'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('ContactForm authenticated API requests', () => {
  it('sends the local JWT as a Bearer token when creating an order', async () => {
    const user = userEvent.setup()
    let receivedRequest
    localStorage.setItem(TOKEN_KEY, 'test-token')
    server.use(http.post(`${API_URL}/orders`, async ({ request }) => {
      receivedRequest = {
        authorization: request.headers.get('authorization'),
        body: await request.json(),
      }
      return HttpResponse.json({ id: 44 }, { status: 201 })
    }))
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<ContactForm products={[]} productsLoading={false} onCreated={vi.fn()} onAuthError={vi.fn()} />)

    await user.type(screen.getByLabelText('\u0418\u043c\u044f / \u043e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u044f'), 'Test Farm')
    await user.type(screen.getByLabelText('Email'), 'test@example.invalid')
    await user.type(screen.getByLabelText('\u041e\u0431\u044a\u0451\u043c \u0437\u0430\u043a\u0430\u0437\u0430, \u043a\u0433'), '25')
    await user.click(screen.getByRole('button', { name: '\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443' }))

    await waitFor(() => expect(receivedRequest).toBeDefined())
    expect(receivedRequest.authorization).toBe('Bearer test-token')
    expect(receivedRequest.body).toMatchObject({ name: 'Test Farm', email: 'test@example.invalid', quantity: '25' })
  })

  it('shows the 401 error and calls the authorization handler', async () => {
    const user = userEvent.setup()
    const onAuthError = vi.fn()
    localStorage.setItem(TOKEN_KEY, 'test-token')
    server.use(http.post(`${API_URL}/orders`, () =>
      HttpResponse.json({ error: 'Please sign in again' }, { status: 401 })))
    render(<ContactForm products={[]} productsLoading={false} onCreated={vi.fn()} onAuthError={onAuthError} />)

    await user.type(screen.getByLabelText('\u0418\u043c\u044f / \u043e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u044f'), 'Test Farm')
    await user.type(screen.getByLabelText('Email'), 'test@example.invalid')
    await user.type(screen.getByLabelText('\u041e\u0431\u044a\u0451\u043c \u0437\u0430\u043a\u0430\u0437\u0430, \u043a\u0433'), '25')
    await user.click(screen.getByRole('button', { name: '\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Please sign in again')
    expect(onAuthError).toHaveBeenCalledWith(expect.objectContaining({ status: 401, message: 'Please sign in again' }))
  })
})
