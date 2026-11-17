import { test as base, expect } from '@playwright/test';
import { loadLocalEnvironment, requestAllowed } from './environment.js';
import { sanitizeSensitiveErrors, safeError } from './sensitive-reporter.js';

export function isExpectedViteWebSocket(address, mode, frontend) {
  if (mode !== 'local' || !frontend) return false;
  try {
    const target = new URL(address);
    // Installed Vite uses a 9-byte base64url token for its root HMR endpoint.
    return frontend.protocol === 'http:' && frontend.port === '5173' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(frontend.hostname) &&
      target.protocol === 'ws:' && target.hostname === frontend.hostname &&
      target.port === '5173' && target.pathname === '/' &&
      !target.username && !target.password && !target.hash &&
      [...target.searchParams.keys()].length === 1 &&
      /^[A-Za-z0-9_-]{12}$/.test(target.searchParams.get('token') || '');
  } catch {
    return false;
  }
}

export function createHttpRouteLifecycle(isAllowed, blocked) {
  const active = new Set();
  const errors = [];
  let closing = false;
  let teardownPromise;
  return {
    beginTeardown() { closing = true; },
    handle(route) {
      const duringTeardown = closing;
      // Register before invoking the handler, including synchronous failures.
      const pending = Promise.resolve().then(async () => {
        const request = route.request();
        if (!isAllowed(request.url(), request.method())) {
          if (!['image', 'font', 'media'].includes(request.resourceType())) blocked.push('A request was blocked by the E2E environment policy.');
          await route.abort('blockedbyclient');
        } else if (duringTeardown) {
          await route.abort('aborted');
        } else {
          // Do not let an allowed local endpoint redirect a write to a remote API.
          const response = await route.fetch({ maxRedirects: 0 });
          const location = response.headers().location;
          if (response.status() >= 300 && response.status() < 400 && location &&
              !isAllowed(new URL(location, request.url()).href, request.method())) {
            blocked.push('A redirect was blocked by the E2E environment policy.');
            await route.abort('blockedbyclient');
          } else {
            await route.fulfill({ response });
          }
        }
      });
      active.add(pending);
      pending.then(
        () => { active.delete(pending); },
        (error) => { active.delete(pending); errors.push(error); },
      );
      return pending;
    },
    teardown() {
      closing = true;
      teardownPromise ??= (async () => {
        while (active.size) await Promise.allSettled([...active]);
        if (errors.length) throw new AggregateError(errors, 'HTTP route handlers failed');
      })();
      return teardownPromise;
    },
  };
}

export async function shutdownHttpRoutes(context, http) {
  http.beginTeardown();
  const failures = [];
  try {
    // Keep routing installed until the independent browser network barrier is active.
    // Offline remains enabled until the base fixture closes the context.
    await context.setOffline(true);
    for (const page of context.pages()) {
      await page.unrouteAll({ behavior: 'wait' });
    }
    // Stop admission before the final drain. An empty Set alone is not a barrier.
    await context.unrouteAll({ behavior: 'wait' });
  } catch (error) {
    failures.push(error);
  }
  try { await http.teardown(); } catch (error) { failures.push(error); }
  if (failures.length) throw new AggregateError(failures, 'HTTP route shutdown failed');
}

export const test = base.extend({
  context: async ({ context }, runWithContext, testInfo) => {
    const mode = testInfo.project.name === 'production-smoke' ? 'smoke' : 'local';
    const sensitive = testInfo.project.metadata.sensitive === true;
    const environment = mode === 'local' ? loadLocalEnvironment() : {};
    const blocked = [];
    const http = createHttpRouteLifecycle(
      (url, method) => requestAllowed(url, method, { mode, sensitive, ...environment }), blocked,
    );
    await context.route('**/*', http.handle);
    await context.routeWebSocket('**/*', (socket) => {
      if (!isExpectedViteWebSocket(socket.url(), mode, environment.frontend)) {
        blocked.push('WebSocket blocked by the E2E environment policy.');
      }
      socket.close();
    });
    const failures = [];
    try { await runWithContext(context); } catch (error) { failures.push(error); }
    try { await shutdownHttpRoutes(context, http); } catch (error) { failures.push(error); }
    try {
      expect(blocked, 'No requests may escape the selected E2E environment').toEqual([]);
    } catch (error) { failures.push(error); }
    if (sensitive) sanitizeSensitiveErrors(testInfo);
    if (failures.length) {
      if (sensitive) throw new Error(safeError().message);
      if (failures.length === 1) throw failures[0];
      throw new AggregateError(failures, 'Test, HTTP teardown or network isolation failed');
    }
  },
});
test.afterEach(async ({ context }, testInfo) => {
  if (context && testInfo.project.metadata.sensitive === true) sanitizeSensitiveErrors(testInfo);
});
export { expect };
