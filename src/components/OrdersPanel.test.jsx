import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_URL } from '../api'
import { server } from '../test/server'
import OrdersPanel from './OrdersPanel'

afterEach(cleanup)

const order = {
  id: 73,
  name: 'Test buyer',
  email: 'buyer@example.invalid',
  product_name: 'Apples',
  quantity: 30,
  status: 'new',
}

describe('OrdersPanel', () => {
  it('loads an order and updates its status through the API', async () => {
    const user = userEvent.setup()
    let patchBody
    server.use(
      http.get(`${API_URL}/orders`, () => HttpResponse.json([order])),
      http.patch(`${API_URL}/orders/73`, async ({ request }) => {
        patchBody = await request.json()
        return HttpResponse.json({ ...order, status: patchBody.status })
      }),
    )
    render(<OrdersPanel refreshKey={0} onAuthError={vi.fn()} />)

    const row = await screen.findByText(/buyer@example\.invalid/)
    const orderArticle = row.closest('article')
    const statusSelect = within(orderArticle).getByRole('combobox')
    await user.selectOptions(statusSelect, 'processing')

    expect(await screen.findByRole('status')).toHaveTextContent('73')
    expect(patchBody).toEqual({ status: 'processing' })
    expect(statusSelect).toHaveValue('processing')
  })

  it('shows the empty state when there are no orders', async () => {
    server.use(http.get(`${API_URL}/orders`, () => HttpResponse.json([])))
    render(<OrdersPanel refreshKey={0} onAuthError={vi.fn()} />)

    expect(await screen.findByText(/\u0417\u0430\u044f\u0432\u043e\u043a \u043f\u043e\u043a\u0430 \u043d\u0435\u0442/)).toBeInTheDocument()
  })

  it('reports an authorization error while loading orders', async () => {
    const onAuthError = vi.fn()
    server.use(http.get(`${API_URL}/orders`, () =>
      HttpResponse.json({ error: 'Admin access required' }, { status: 403 })))
    render(<OrdersPanel refreshKey={0} onAuthError={onAuthError} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Admin access required')
    await waitFor(() => expect(onAuthError).toHaveBeenCalledWith(expect.objectContaining({ status: 403 })))
  })
})
