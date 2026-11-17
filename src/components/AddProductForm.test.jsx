import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_URL } from '../api'
import { server } from '../test/server'
import AddProductForm from './AddProductForm'

afterEach(cleanup)

describe('AddProductForm', () => {
  it('shows a negative price error on a normal submit without creating a product', async () => {
    const user = userEvent.setup()
    let requests = 0
    server.use(http.post(`${API_URL}/products`, () => {
      requests += 1
      return HttpResponse.json({ id: 1 })
    }))
    render(<AddProductForm onAdded={vi.fn()} onAuthError={vi.fn()} />)
    await user.type(screen.getByLabelText('Название'), 'Товар')
    await user.type(screen.getByLabelText('Цена, тг'), '-500')
    await user.click(screen.getByRole('button', { name: 'Добавить товар' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Цена должна быть больше 0')
    expect(requests).toBe(0)
  })

  it('posts valid product details, refreshes the catalog, and shows success', async () => {
    const user = userEvent.setup()
    const onAdded = vi.fn().mockResolvedValue(undefined)
    const onAuthError = vi.fn()
    let receivedBody
    let releaseRequest
    const pendingRequest = new Promise((resolve) => { releaseRequest = resolve })
    server.use(http.post(`${API_URL}/products`, async ({ request }) => {
      receivedBody = await request.json()
      await pendingRequest
      return HttpResponse.json({ id: 21, name: 'Garden tomatoes' }, { status: 201 })
    }))
    render(<AddProductForm onAdded={onAdded} onAuthError={onAuthError} />)

    await user.type(screen.getByLabelText('\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435'), 'Garden tomatoes')
    await user.type(screen.getByLabelText('\u0426\u0435\u043d\u0430, \u0442\u0433'), '780')
    await user.type(screen.getByLabelText('\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f'), 'Vegetables')
    await user.clear(screen.getByLabelText('\u0415\u0434\u0438\u043d\u0438\u0446\u0430 \u0438\u0437\u043c\u0435\u0440\u0435\u043d\u0438\u044f'))
    await user.type(screen.getByLabelText('\u0415\u0434\u0438\u043d\u0438\u0446\u0430 \u0438\u0437\u043c\u0435\u0440\u0435\u043d\u0438\u044f'), 'kg')
    await user.type(screen.getByLabelText(/URL/), 'https://example.invalid/tomatoes.jpg')
    await user.click(screen.getByRole('button', { name: /\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0442\u043e\u0432\u0430\u0440/ }))

    await waitFor(() => expect(receivedBody).toBeDefined())
    expect(screen.getByRole('button')).toBeDisabled()
    releaseRequest()

    expect(await screen.findByRole('status')).toHaveTextContent('Garden tomatoes')
    expect(receivedBody).toEqual({
      name: 'Garden tomatoes',
      price: 780,
      category: 'Vegetables',
      unit: 'kg',
      image: 'https://example.invalid/tomatoes.jpg',
    })
    expect(onAdded).toHaveBeenCalledOnce()
    expect(onAuthError).not.toHaveBeenCalled()
  })

  it('leaves native required fields empty without sending a request', async () => {
    const user = userEvent.setup()
    let requestCount = 0
    server.use(http.post(`${API_URL}/products`, () => {
      requestCount += 1
      return HttpResponse.json({ id: 1 })
    }))
    render(<AddProductForm onAdded={vi.fn()} onAuthError={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0442\u043e\u0432\u0430\u0440/ }))

    expect(screen.getByLabelText('\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435')).toBeInvalid()
    expect(requestCount).toBe(0)
  })

  it('shows a rejected API response and forwards the authorization error', async () => {
    const user = userEvent.setup()
    const onAuthError = vi.fn()
    server.use(http.post(`${API_URL}/products`, () =>
      HttpResponse.json({ error: 'Admin access required' }, { status: 403 })))
    render(<AddProductForm onAdded={vi.fn()} onAuthError={onAuthError} />)

    await user.type(screen.getByLabelText('\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435'), 'Garden tomatoes')
    await user.type(screen.getByLabelText('\u0426\u0435\u043d\u0430, \u0442\u0433'), '780')
    await user.click(screen.getByRole('button', { name: /\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0442\u043e\u0432\u0430\u0440/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Admin access required')
    expect(onAuthError).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }))
  })
})
