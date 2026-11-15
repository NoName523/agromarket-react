import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_URL, apiFetch } from './api'
import { server } from './test/server'
import ServerWakeNotice from './components/ServerWakeNotice'

function deferred() {
  let resolve
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('slow API request notice', () => {
  it('does not show a notice for a fast API response', async () => {
    vi.useFakeTimers()
    server.use(http.get(`${API_URL}/health`, () => HttpResponse.json({ status: 'ok' })))
    render(<ServerWakeNotice />)

    await act(async () => { await apiFetch('/health', { token: null }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(3001) })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows one notice for parallel slow requests and clears it after success and network failure', async () => {
    const first = deferred()
    const second = deferred()
    let started = 0
    let bothStarted
    const startedPromise = new Promise((resolve) => { bothStarted = resolve })
    const waitForGate = (gate) => {
      started += 1
      if (started === 2) bothStarted()
      return gate.promise
    }
    server.use(
      http.get(`${API_URL}/products`, async () => {
        await waitForGate(first)
        return HttpResponse.json([])
      }),
      http.get(`${API_URL}/categories`, async () => {
        await waitForGate(second)
        return HttpResponse.error()
      }),
    )
    render(<ServerWakeNotice />)
    const firstRequest = apiFetch('/products', { token: null })
    const secondRequest = apiFetch('/categories', { token: null }).catch((error) => error)
    await startedPromise

    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 3100)) })
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('Сервер просыпается, это может занять до минуты')

    await act(async () => { first.resolve(); await firstRequest })
    expect(screen.getByRole('status')).toBeInTheDocument()
    await act(async () => { second.resolve(); await secondRequest })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  }, 10000)

  it.each([
    [400, 'Invalid request'],
    [200, 'invalid JSON'],
    [204, null],
  ])('clears the notice after response status %s and body parsing', async (status, body) => {
    vi.useFakeTimers()
    const responseGate = deferred()
    server.use(http.get(`${API_URL}/health`, async () => {
      const response = await responseGate.promise
      if (response.status === 204) return new HttpResponse(null, { status: response.status })
      if (response.status === 400) return HttpResponse.json({ error: body }, { status })
      return HttpResponse.text(body, { status })
    }))
    render(<ServerWakeNotice />)
    const request = apiFetch('/health', { token: null }).catch((error) => error)

    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(screen.getByRole('status')).toBeInTheDocument()
    await act(async () => { responseGate.resolve({ status, body }); await request })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
