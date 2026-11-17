import { describe, expect, it, vi } from 'vitest';

vi.mock('@playwright/test', () => ({
  test: { extend: () => ({ afterEach() {} }) },
  expect: vi.fn(),
}));

import { createHttpRouteLifecycle, shutdownHttpRoutes } from '../../e2e/fixtures.js';

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function route(url = 'http://localhost:3000/api/products') {
  return {
    request: () => ({ url: () => url, method: () => 'GET', resourceType: () => 'fetch' }),
    abort: vi.fn().mockResolvedValue(undefined),
    fetch: vi.fn().mockResolvedValue({ status: () => 200, headers: () => ({}) }),
    fulfill: vi.fn().mockResolvedValue(undefined),
  };
}

const allowed = (url) => url === 'http://localhost:3000/api/products';

function context(page = { unrouteAll: vi.fn().mockResolvedValue(undefined) }) {
  return {
    setOffline: vi.fn().mockResolvedValue(undefined),
    pages: () => [page],
    unrouteAll: vi.fn().mockResolvedValue(undefined),
  };
}

describe('HTTP route handler lifecycle', () => {
  it('keeps routes installed until offline is confirmed, then stops callbacks before draining', async () => {
    const offline = deferred();
    const abort = deferred();
    const page = { unrouteAll: vi.fn().mockResolvedValue(undefined) };
    const browserContext = context(page);
    browserContext.setOffline.mockReturnValue(offline.promise);
    const lifecycle = createHttpRouteLifecycle(allowed, []);
    const late = route();
    late.abort.mockReturnValue(abort.promise);
    let lateHandler;
    browserContext.unrouteAll.mockImplementation(async () => {
      // Callback admitted immediately before Playwright removes its route list.
      lateHandler = lifecycle.handle(late);
    });
    const finished = vi.fn();
    const shutdown = shutdownHttpRoutes(browserContext, lifecycle).then(finished);
    expect(browserContext.setOffline).toHaveBeenCalledWith(true);
    expect(page.unrouteAll).not.toHaveBeenCalled();
    expect(browserContext.unrouteAll).not.toHaveBeenCalled();
    offline.resolve();
    await vi.waitFor(() => expect(late.abort).toHaveBeenCalledWith('aborted'));
    expect(page.unrouteAll).toHaveBeenCalledWith({ behavior: 'wait' });
    expect(browserContext.unrouteAll).toHaveBeenCalledWith({ behavior: 'wait' });
    expect(late.fetch).not.toHaveBeenCalled();
    expect(finished).not.toHaveBeenCalled();
    abort.resolve();
    await lateHandler;
    await shutdown;
    expect(finished).toHaveBeenCalledOnce();
  });

  it('does not remove protection if the offline barrier fails', async () => {
    const browserContext = context();
    const error = new Error('Synthetic offline failure');
    browserContext.setOffline.mockRejectedValue(error);
    const lifecycle = createHttpRouteLifecycle(allowed, []);
    await expect(shutdownHttpRoutes(browserContext, lifecycle)).rejects.toMatchObject({ errors: [error] });
    expect(browserContext.unrouteAll).not.toHaveBeenCalled();
    const late = route();
    await lifecycle.handle(late);
    expect(late.abort).toHaveBeenCalledWith('aborted');
    expect(late.fetch).not.toHaveBeenCalled();
  });

  it('reports a late abort error after route admission is stopped', async () => {
    const browserContext = context();
    const error = new Error('Synthetic late abort failure');
    const lifecycle = createHttpRouteLifecycle(allowed, []);
    const late = route();
    late.abort.mockRejectedValue(error);
    browserContext.unrouteAll.mockImplementation(async () => {
      await expect(lifecycle.handle(late)).rejects.toBe(error);
    });
    await expect(shutdownHttpRoutes(browserContext, lifecycle)).rejects.toMatchObject({
      errors: [expect.objectContaining({ errors: [error] })],
    });
    expect(late.fetch).not.toHaveBeenCalled();
  });

  it('waits for fetch and fulfill before completing teardown', async () => {
    const fetchGate = deferred();
    const fulfillGate = deferred();
    const item = route();
    const response = { status: () => 200, headers: () => ({}) };
    item.fetch.mockReturnValue(fetchGate.promise);
    item.fulfill.mockReturnValue(fulfillGate.promise);
    const lifecycle = createHttpRouteLifecycle(allowed, []);
    const handler = lifecycle.handle(item);
    const drained = vi.fn();
    const teardown = lifecycle.teardown().then(drained);
    await vi.waitFor(() => expect(item.fetch).toHaveBeenCalledWith({ maxRedirects: 0 }));
    expect(drained).not.toHaveBeenCalled();
    fetchGate.resolve(response);
    await vi.waitFor(() => expect(item.fulfill).toHaveBeenCalledWith({ response }));
    expect(drained).not.toHaveBeenCalled();
    fulfillGate.resolve();
    await handler;
    await teardown;
    expect(drained).toHaveBeenCalledOnce();
  });

  it('aborts new requests during and after teardown while retaining policy violations', async () => {
    const gate = deferred();
    const blocked = [];
    const lifecycle = createHttpRouteLifecycle(allowed, blocked);
    const active = route();
    active.fulfill.mockReturnValue(gate.promise);
    const handler = lifecycle.handle(active);
    await vi.waitFor(() => expect(active.fulfill).toHaveBeenCalledOnce());
    const teardown = lifecycle.teardown();
    const late = route();
    const external = route('https://example.invalid/api/products');
    await Promise.all([lifecycle.handle(late), lifecycle.handle(external)]);
    expect(late.abort).toHaveBeenCalledWith('aborted');
    expect(external.abort).toHaveBeenCalledWith('blockedbyclient');
    expect(late.fetch).not.toHaveBeenCalled();
    expect(external.fetch).not.toHaveBeenCalled();
    expect(late.fulfill).not.toHaveBeenCalled();
    expect(external.fulfill).not.toHaveBeenCalled();
    expect(blocked).toEqual(['A request was blocked by the E2E environment policy.']);
    gate.resolve();
    await handler;
    await teardown;
    const after = route();
    await lifecycle.handle(after);
    expect(after.abort).toHaveBeenCalledWith('aborted');
    expect(after.fetch).not.toHaveBeenCalled();
  });

  it('retains a completed handler error and waits for the other handlers', async () => {
    const gate = deferred();
    const error = new Error('Synthetic fetch failure');
    const failed = route();
    failed.fetch.mockRejectedValue(error);
    const slow = route();
    slow.fulfill.mockReturnValue(gate.promise);
    const lifecycle = createHttpRouteLifecycle(allowed, []);
    await expect(lifecycle.handle(failed)).rejects.toBe(error);
    const slowHandler = lifecycle.handle(slow);
    const finished = vi.fn();
    const teardown = lifecycle.teardown().catch((failure) => { finished(); return failure; });
    await vi.waitFor(() => expect(slow.fulfill).toHaveBeenCalledOnce());
    expect(finished).not.toHaveBeenCalled();
    gate.resolve();
    await slowHandler;
    const failure = await teardown;
    expect(failure).toBeInstanceOf(AggregateError);
    expect(failure.errors).toEqual([error]);
  });

  it('tracks synchronous errors before removing an active handler', async () => {
    const error = new Error('Synthetic request failure');
    const item = route();
    item.request = () => { throw error; };
    const lifecycle = createHttpRouteLifecycle(allowed, []);
    const rejection = expect(lifecycle.handle(item)).rejects.toBe(error);
    await expect(lifecycle.teardown()).rejects.toMatchObject({ errors: [error] });
    await rejection;
  });

  it('reports fulfill failures instead of hiding them during teardown', async () => {
    const error = new Error('Synthetic fulfill failure');
    const item = route();
    item.fulfill.mockRejectedValue(error);
    const lifecycle = createHttpRouteLifecycle(allowed, []);
    await expect(lifecycle.handle(item)).rejects.toBe(error);
    await expect(lifecycle.teardown()).rejects.toMatchObject({ errors: [error] });
  });

  it('blocks forbidden redirects without following them', async () => {
    const blocked = [];
    const item = route();
    item.fetch.mockResolvedValue({ status: () => 307, headers: () => ({ location: 'https://example.invalid/api/products' }) });
    const lifecycle = createHttpRouteLifecycle(allowed, blocked);
    await lifecycle.handle(item);
    await lifecycle.teardown();
    expect(item.fetch).toHaveBeenCalledWith({ maxRedirects: 0 });
    expect(item.abort).toHaveBeenCalledWith('blockedbyclient');
    expect(item.fulfill).not.toHaveBeenCalled();
    expect(blocked).toEqual(['A redirect was blocked by the E2E environment policy.']);
  });
});
