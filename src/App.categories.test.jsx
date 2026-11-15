import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { API_URL } from './api'
import { server } from './test/server'
import App from './App'

const products = [
  { id: 1, name: '\u0426\u0432\u0435\u0442\u043e\u0447\u043d\u044b\u0439 \u043c\u0451\u0434', price: 1000, category: '\u041c\u0451\u0434' },
  { id: 2, name: '\u041f\u0448\u0435\u043d\u0438\u0446\u0430', price: 500, category: '\u0417\u0435\u0440\u043d\u043e' },
  { id: 3, name: '\u041a\u0430\u0440\u0442\u043e\u0444\u0435\u043b\u044c', price: 200, category: null },
]

const categories = [
  { name: '\u041c\u0451\u0434', count: 1 },
  { name: '\u0417\u0435\u0440\u043d\u043e', count: 1 },
  { name: null, count: 1 },
]

beforeEach(() => {
  server.use(
    http.get(`${API_URL}/categories`, () => HttpResponse.json(categories)),
    http.get(`${API_URL}/products`, () => HttpResponse.json(products)),
  )
})

afterEach(cleanup)

describe('catalog categories', () => {
  it('filters by category and search, includes uncategorized items, and resets filters', async () => {
    render(<App />)
    const honey = await screen.findByRole('button', { name: '\u041c\u0451\u0434 (1)' })
    fireEvent.click(honey)
    expect(honey).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: products[0].name })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: products[1].name })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '\u043f\u0448\u0435\u043d\u0438\u0446\u0430' } })
    expect(screen.queryByRole('heading', { name: products[0].name })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '\u0412\u0441\u0435 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438' }))
    expect(screen.getByRole('heading', { name: products[1].name })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: '\u0411\u0435\u0437 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438 (1)' }))
    expect(screen.getByRole('heading', { name: products[2].name })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: products[1].name })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '\u0412\u0441\u0435 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438' }))
    expect(screen.getByRole('heading', { name: products[1].name })).toBeInTheDocument()
  })

  it('keeps the catalog usable when the categories endpoint fails', async () => {
    server.use(http.get(`${API_URL}/categories`, () =>
      HttpResponse.json({ error: 'Categories unavailable' }, { status: 503 })))

    render(<App />)

    expect(await screen.findByRole('heading', { name: products[1].name })).toBeInTheDocument()
    expect(screen.getByText(/\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b/)).toBeInTheDocument()
  })

  it('loads later product pages so category filters include the full catalog', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => ({
      id: index + 10, name: `\u0417\u0435\u0440\u043d\u043e ${index}`, price: 500, category: '\u0417\u0435\u0440\u043d\u043e',
    }))
    server.use(
      http.get(`${API_URL}/categories`, () => HttpResponse.json([
        { name: '\u041c\u0451\u0434', count: 1 }, { name: '\u0417\u0435\u0440\u043d\u043e', count: 20 },
      ])),
      http.get(`${API_URL}/products`, ({ request }) => {
        const url = new URL(request.url)
        return HttpResponse.json(url.searchParams.get('offset') === '20' ? [products[0]] : firstPage)
      }),
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '\u041c\u0451\u0434 (1)' }))

    expect(screen.getByRole('heading', { name: products[0].name })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '\u0417\u0435\u0440\u043d\u043e 0' })).not.toBeInTheDocument()
  })
})
