import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_URL } from '../api'
import { server } from '../test/server'
import MyOrders from './MyOrders'

afterEach(cleanup)

describe('MyOrders', () => {
  it('shows the current user order details returned by the API', async () => {
    server.use(http.get(`${API_URL}/orders/my`, () => HttpResponse.json([
      { id: 8, product_name: 'Apples', quantity: 35, status: 'processing' },
    ])))

    render(<MyOrders refreshKey={0} onAuthError={vi.fn()} />)

    expect(await screen.findByText(/8/)).toBeInTheDocument()
    expect(screen.getByText('Apples')).toBeInTheDocument()
    expect(screen.getByText(/35/)).toBeInTheDocument()
    expect(screen.getByText(/processing/)).toBeInTheDocument()
  })

  it('explains when the account has no orders', async () => {
    server.use(http.get(`${API_URL}/orders/my`, () => HttpResponse.json([])))

    render(<MyOrders refreshKey={0} onAuthError={vi.fn()} />)

    expect(await screen.findByText(/\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0437\u0430\u044f\u0432\u043e\u043a/)).toBeInTheDocument()
  })

  it('shows a failed request and notifies the parent about authorization', async () => {
    const onAuthError = vi.fn()
    server.use(http.get(`${API_URL}/orders/my`, () =>
      HttpResponse.json({ error: 'Session expired' }, { status: 401 })))

    render(<MyOrders refreshKey={0} onAuthError={onAuthError} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Session expired')
    expect(onAuthError).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }))
  })
})
