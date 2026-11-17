import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { API_URL, TOKEN_KEY } from './api'
import { server } from './test/server'
import App from './App'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

beforeEach(() => {
  server.use(http.get(`${API_URL}/categories`, () => HttpResponse.json([])))
})

const loadingMessage = '\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 \u0442\u043e\u0432\u0430\u0440\u043e\u0432...'
const emptyMessage = '\u0422\u043e\u0432\u0430\u0440\u044b \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u044b'

function deferred() {
  let resolve
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

describe('App catalog loading', () => {
  it('shows loading while waiting for the products response', async () => {
    const response = deferred()
    server.use(http.get(`${API_URL}/products`, async () => {
      const products = await response.promise
      return HttpResponse.json(products)
    }))

    render(<App />)

    expect(screen.getAllByText(loadingMessage).length).toBeGreaterThan(0)
    response.resolve([{ id: 15, name: 'Local potatoes', price: 800, image: '/potatoes.jpg' }])
    expect(await screen.findByRole('heading', { name: 'Local potatoes' })).toBeInTheDocument()
  })

  it('renders catalog products from the products endpoint', async () => {
    let requestedUrl
    server.use(http.get(`${API_URL}/products`, ({ request }) => {
      requestedUrl = new URL(request.url).pathname
      return HttpResponse.json([{ id: 15, name: 'Local potatoes', price: 800, image: '/potatoes.jpg' }])
    }))

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Local potatoes' })).toBeInTheDocument()
    expect(requestedUrl).toBe('/api/products')
  })

  it('shows an API error when the catalog endpoint rejects the request', async () => {
    server.use(http.get(`${API_URL}/products`, () =>
      HttpResponse.json({ error: 'Catalog unavailable' }, { status: 503 })))

    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Catalog unavailable')
  })

  it('shows the catalog error for HTTP 500', async () => {
    server.use(http.get(`${API_URL}/products`, () =>
      HttpResponse.json({ error: 'Catalog server error' }, { status: 500 })))
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Catalog server error')
  })

  it('shows an error when the server returns a malformed catalog', async () => {
    server.use(http.get(`${API_URL}/products`, () => HttpResponse.json({ products: [] })))

    render(<App />)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('shows the empty catalog message for an empty product list', async () => {
    server.use(http.get(`${API_URL}/products`, () => HttpResponse.json([])))

    render(<App />)

    expect(await screen.findByText(emptyMessage)).toBeInTheDocument()
  })

  it('shows an error when the catalog connection fails', async () => {
    server.use(http.get(`${API_URL}/products`, () => HttpResponse.error()))

    render(<App />)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})

describe('App authenticated layout', () => {
  it('stores the login session, loads account panels, and logs out', async () => {
    const user = userEvent.setup()
    let loginBody
    server.use(
      http.get(`${API_URL}/products`, () => HttpResponse.json([])),
      http.post(`${API_URL}/auth/login`, async ({ request }) => {
        loginBody = await request.json()
        return HttpResponse.json({ token: 'test-admin-token', user: { id: 4, name: 'Test Admin', role: 'admin' } })
      }),
      http.get(`${API_URL}/orders/my`, () => HttpResponse.json([])),
      http.get(`${API_URL}/orders`, () => HttpResponse.json([])),
    )
    render(<App />)

    await user.type(screen.getByLabelText('Email', { selector: '#auth-email' }), 'admin@example.invalid')
    await user.type(screen.getByLabelText('\u041f\u0430\u0440\u043e\u043b\u044c'), 'test-password')
    await user.click(screen.getByRole('button', { name: '\u0412\u043e\u0439\u0442\u0438' }))

    expect((await screen.findAllByText(/Test Admin/)).length).toBeGreaterThan(0)
    expect(await screen.findByRole('heading', { name: /\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0442\u043e\u0432\u0430\u0440/ })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /\u041f\u0430\u043d\u0435\u043b\u044c \u0437\u0430\u044f\u0432\u043e\u043a/ })).toBeInTheDocument()
    expect(loginBody).toEqual({ email: 'admin@example.invalid', password: 'test-password' })
    expect(localStorage.getItem(TOKEN_KEY)).toBe('test-admin-token')

    await user.click(screen.getByRole('button', { name: '\u0412\u044b\u0439\u0442\u0438' }))
    expect(screen.getByRole('heading', { name: '\u0412\u0445\u043e\u0434' })).toBeInTheDocument()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})
