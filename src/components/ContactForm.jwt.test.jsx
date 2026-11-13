import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TOKEN_KEY } from '../api'
import ContactForm from './ContactForm'

const fetchMock = vi.fn()

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

function jsonResponse(status, data) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(data),
  }
}

describe('ContactForm authenticated API requests', () => {
  it('sends the local JWT as a Bearer token when creating an order', async () => {
    const user = userEvent.setup()
    localStorage.setItem(TOKEN_KEY, 'test-token')
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 44 }))
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<ContactForm products={[]} productsLoading={false} onCreated={vi.fn()} onAuthError={vi.fn()} />)

    await user.type(screen.getByLabelText('\u0418\u043c\u044f / \u043e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u044f'), 'Test Farm')
    await user.type(screen.getByLabelText('Email'), 'test@example.invalid')
    await user.type(screen.getByLabelText('\u041e\u0431\u044a\u0451\u043c \u0437\u0430\u043a\u0430\u0437\u0430, \u043a\u0433'), '25')
    await user.click(screen.getByRole('button', { name: '\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443' }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/orders$/)
    expect(options.method).toBe('POST')
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer test-token')
    expect(JSON.parse(options.body)).toMatchObject({ name: 'Test Farm', email: 'test@example.invalid', quantity: '25' })
  })

  it('shows the 401 error and calls the authorization handler', async () => {
    const user = userEvent.setup()
    const onAuthError = vi.fn()
    localStorage.setItem(TOKEN_KEY, 'test-token')
    fetchMock.mockResolvedValue(jsonResponse(401, { error: 'Please sign in again' }))
    render(<ContactForm products={[]} productsLoading={false} onCreated={vi.fn()} onAuthError={onAuthError} />)

    await user.type(screen.getByLabelText('\u0418\u043c\u044f / \u043e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u044f'), 'Test Farm')
    await user.type(screen.getByLabelText('Email'), 'test@example.invalid')
    await user.type(screen.getByLabelText('\u041e\u0431\u044a\u0451\u043c \u0437\u0430\u043a\u0430\u0437\u0430, \u043a\u0433'), '25')
    await user.click(screen.getByRole('button', { name: '\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Please sign in again')
    expect(onAuthError).toHaveBeenCalledWith(expect.objectContaining({ status: 401, message: 'Please sign in again' }))
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer test-token')
  })
})
