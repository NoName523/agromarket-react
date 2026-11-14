import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from './api'
import App from './App'

vi.mock('./api', () => ({
  TOKEN_KEY: 'agromarket_jwt',
  apiFetch: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.mocked(apiFetch).mockReset()
  localStorage.clear()
})

const loadingMessage = '\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 \u0442\u043e\u0432\u0430\u0440\u043e\u0432...'
const emptyMessage = '\u0422\u043e\u0432\u0430\u0440\u044b \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u044b'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('App catalog loading', () => {
  it('shows a loading message while products are being fetched', () => {
    vi.mocked(apiFetch).mockReturnValue(new Promise(() => {}))

    render(<App />)

    expect(screen.getAllByText(loadingMessage).length).toBeGreaterThan(0)
  })

  it('renders products after a successful catalog response', async () => {
    vi.mocked(apiFetch).mockResolvedValue([
      { id: 15, name: 'Local potatoes', price: 800, image: '/potatoes.jpg' },
    ])

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Local potatoes' })).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith('/products')
  })

  it('requests products from /products', async () => {
    vi.mocked(apiFetch).mockResolvedValue([])

    render(<App />)

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2))
    expect(apiFetch).toHaveBeenCalledWith('/products')
    expect(apiFetch).toHaveBeenCalledWith('/categories')
  })

  it('shows an error when the catalog API rejects', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('Catalog unavailable'))

    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Catalog unavailable')
  })

  it('shows the empty catalog message for an empty product list', async () => {
    vi.mocked(apiFetch).mockResolvedValue([])

    render(<App />)

    expect(await screen.findByText(emptyMessage)).toBeInTheDocument()
  })

  it('shows the network error when the catalog fetch is rejected', async () => {
    const request = deferred()
    vi.mocked(apiFetch).mockReturnValue(request.promise)

    render(<App />)
    request.reject(new Error('Network disconnected'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Network disconnected')
  })
})
