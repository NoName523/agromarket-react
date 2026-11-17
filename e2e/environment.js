import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

export function validateEnvironmentKeys(env) {
  const allowed = new Set(['E2E_BASE_URL', 'E2E_API_URL', 'E2E_TEST_DATABASE_NAME', 'E2E_TEST_DATABASE_CONFIRMED', 'E2E_FARMER_EMAIL', 'E2E_FARMER_PASSWORD']);
  if (Object.keys(env).some((key) => /^VITE_/i.test(key) || !allowed.has(key))) {
    throw new Error('.env.e2e contains a forbidden variable name. Values are not displayed.');
  }
}

export function productionURL(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error();
    return url;
  } catch {
    throw new Error('Production smoke requires a public HTTPS root URL without credentials, query or fragment.');
  }
}

export function localURL(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password) throw new Error();
    return url;
  } catch {
    throw new Error('Local E2E requires an HTTP loopback URL without credentials.');
  }
}

export function validateLocalEnvironment(env) {
  validateEnvironmentKeys(env);
  const frontend = localURL(env.E2E_BASE_URL);
  const api = localURL(env.E2E_API_URL);
  if (frontend.origin === api.origin || frontend.pathname !== '/' || frontend.search || frontend.hash || api.search || api.hash) throw new Error('Use separate local frontend/API origins and a root frontend URL.');
  if (api.pathname.replace(/\/$/, '') !== '/api') throw new Error('E2E_API_URL must end with /api.');
  if (env.E2E_TEST_DATABASE_CONFIRMED !== 'yes' || !/^agromarket_[a-z0-9_]*test[a-z0-9_]*$/i.test(env.E2E_TEST_DATABASE_NAME || '')) {
    throw new Error('Confirm a separately configured agromarket_*test* database before local E2E.');
  }
  return { frontend, api };
}

export function loadLocalEnvironment() {
  let env;
  try {
    env = parseEnv(readFileSync(new URL('../.env.e2e', import.meta.url), 'utf8'));
  } catch {
    throw new Error('Create the ignored .env.e2e for the isolated local test environment.');
  }
  return { ...validateLocalEnvironment(env), env };
}

export function requestAllowed(url, method, { mode, sensitive = true, frontend, api }) {
  const target = new URL(url);
  if (mode === 'smoke') return ['https:', 'http:'].includes(target.protocol) && ['GET', 'HEAD', 'OPTIONS'].includes(method);
  if (mode !== 'local') return false;
  if (target.origin === frontend.origin) return ['GET', 'HEAD', 'OPTIONS'].includes(method);
  if (!sensitive && (!['GET', 'HEAD', 'OPTIONS'].includes(method) || !/^\/api\/(?:categories|products(?:\/\d+)?)\/?$/.test(target.pathname))) return false;
  return target.origin === api.origin && (target.pathname === '/api' || target.pathname.startsWith('/api/'));
}

// Pass only OS settings needed by Node/browser processes, never arbitrary caller secrets.
export function safeProcessEnvironment(source) {
  const names = new Set(['path', 'systemroot', 'windir', 'comspec', 'pathext', 'temp', 'tmp', 'tmpdir', 'home', 'userprofile', 'localappdata', 'appdata', 'lang', 'lc_all', 'ci', 'number_of_processors', 'processor_architecture']);
  return Object.fromEntries(Object.entries(source).filter(([key, value]) => names.has(key.toLowerCase()) && typeof value === 'string'));
}
