import { describe, expect, it, vi } from 'vitest';

// Import only the classifier; do not register or run Playwright fixtures.
vi.mock('@playwright/test', () => ({
  test: { extend: () => ({ afterEach() {} }) },
  expect: vi.fn(),
}));

import { isExpectedViteWebSocket } from '../../e2e/fixtures.js';

const frontend = new URL('http://localhost:5173');
const socket = 'ws://localhost:5173/?token=abcdefghijkl';

describe('expected local Vite WebSocket classification', () => {
  it.each(['localhost', '127.0.0.1', '[::1]'])('recognizes the exact configured loopback hostname %s', (hostname) => {
    expect(isExpectedViteWebSocket(
      `ws://${hostname}:5173/?token=abcdefghijkl`, 'local', new URL(`http://${hostname}:5173`),
    )).toBe(true);
  });

  it.each([
    'ws://example.invalid:5173/?token=abcdefghijkl',
    'ws://localhost.example.invalid:5173/?token=abcdefghijkl',
    'ws://127.0.0.1:5173/?token=abcdefghijkl',
    'ws://localhost:3000/?token=abcdefghijkl',
    'ws://localhost:5174/?token=abcdefghijkl',
    'ws://localhost/?token=abcdefghijkl',
    'ws://localhost:5173/@vite/client?token=abcdefghijkl',
    'ws://localhost:5173/products?token=abcdefghijkl',
    'ws://localhost:5173/',
    'ws://localhost:5173/?token=',
    'ws://localhost:5173/?other=abcdefghijkl',
    'ws://localhost:5173/?token=abcdefghijkl&other=1',
    'ws://localhost:5173/?token=abcdefghijkl&token=abcdefghijkl',
    'ws://localhost:5173/?token=invalid!',
    'wss://localhost:5173/?token=abcdefghijkl',
    'http://localhost:5173/?token=abcdefghijkl',
    'ws://user@localhost:5173/?token=abcdefghijkl',
    'ws://localhost:5173/?token=abcdefghijkl#fragment',
    'not a URL',
  ])('does not exempt an unexpected WebSocket: %s', (address) => {
    expect(isExpectedViteWebSocket(address, 'local', frontend)).toBe(false);
  });

  it.each(['smoke', 'production', undefined])('never exempts Vite outside local mode: %s', (mode) => {
    expect(isExpectedViteWebSocket(socket, mode, frontend)).toBe(false);
  });

  it.each([undefined, new URL('http://example.invalid:5173'), new URL('http://localhost:5174')])('requires the configured loopback frontend on port 5173', (configuredFrontend) => {
    expect(isExpectedViteWebSocket(socket, 'local', configuredFrontend)).toBe(false);
  });
});
