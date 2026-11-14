import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './api';
import ServerWakeNotice from './components/ServerWakeNotice';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('slow API request notice', () => {
  it('does not show a notice for a fast request', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
    render(<ServerWakeNotice />);
    await act(async () => { await apiFetch('/health', { token: null }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(3001); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows one notice for parallel slow requests and clears it after success or network error', async () => {
    vi.useFakeTimers();
    const first = deferred();
    const second = deferred();
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise));
    render(<ServerWakeNotice />);
    const a = apiFetch('/products', { token: null });
    const b = apiFetch('/categories', { token: null }).catch((error) => error);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Сервер просыпается, это может занять до минуты');
    await act(async () => { first.resolve(new Response('[]')); await a; });
    expect(screen.getByRole('status')).toBeInTheDocument();
    await act(async () => { second.reject(new Error('offline')); await b; });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it.each([
    [400, '{"error":"Invalid request"}'],
    [200, 'invalid JSON'],
    [204, null],
  ])('clears the notice after response status %s and body parsing', async (status, body) => {
    vi.useFakeTimers();
    const pending = deferred();
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending.promise));
    render(<ServerWakeNotice />);
    const result = apiFetch('/health', { token: null }).catch((error) => error);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(screen.getByRole('status')).toBeInTheDocument();
    await act(async () => { pending.resolve(new Response(body, { status })); await result; });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
