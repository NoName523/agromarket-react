import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localURL, productionURL, requestAllowed, validateLocalEnvironment, validateEnvironmentKeys, safeProcessEnvironment } from './environment.js';
import { launchPlans, validateRunSettings } from './runner-policy.js';
import SensitiveReporter, { sanitizeSensitiveErrors, validateSensitivePlaywrightVersion } from './sensitive-reporter.js';

const env = {
  E2E_BASE_URL: 'http://127.0.0.1:5173',
  E2E_API_URL: 'http://127.0.0.1:3000/api',
  E2E_TEST_DATABASE_NAME: 'agromarket_e2e_test',
  E2E_TEST_DATABASE_CONFIRMED: 'yes',
};
test('local E2E rejects remote API URLs and missing database confirmation', () => {
  assert.throws(() => localURL('https://example.invalid/api'));
  assert.throws(() => localURL('http://localhost.example.invalid/api'));
  assert.throws(() => localURL('http://name:password@localhost/api'));
  assert.throws(() => validateLocalEnvironment({ ...env, E2E_TEST_DATABASE_CONFIRMED: '' }));
  assert.throws(() => validateLocalEnvironment({ ...env, E2E_TEST_DATABASE_NAME: 'agromarket' }));
  assert.throws(() => validateLocalEnvironment({ ...env, E2E_API_URL: 'https://example.invalid/api' }));
});
test('local requests permit writes only to the selected local API', () => {
  const policy = { mode: 'local', ...validateLocalEnvironment(env) };
  assert.equal(requestAllowed('http://127.0.0.1:3000/api/products', 'POST', policy), true);
  assert.equal(requestAllowed('http://127.0.0.1:3000/api/products/1', 'DELETE', policy), true);
  assert.equal(requestAllowed('https://example.invalid/api/products', 'POST', policy), false);
  assert.equal(requestAllowed('https://example.invalid/api/products', 'GET', policy), false);
  assert.equal(requestAllowed('http://127.0.0.1:5173/api/products', 'POST', policy), false);
  assert.equal(requestAllowed('http://127.0.0.1:3000/other', 'POST', policy), false);
});
test('production policy blocks every write method', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(requestAllowed('https://example.invalid/api/products', method, { mode: 'smoke' }), false);
  }
  assert.equal(requestAllowed('https://example.invalid/api/products', 'GET', { mode: 'smoke' }), true);
});

test('env names reject VITE_ and unknown variables without exposing values', () => {
  for (const key of ['VITE_API_URL', 'VITE_PASSWORD', 'vite_secret', 'NODE_OPTIONS', 'DATABASE_URL', 'UNKNOWN']) {
    assert.throws(() => validateEnvironmentKeys({ ...env, [key]: 'canary-private-value' }), (error) => !error.message.includes('canary-private-value'));
  }
  assert.doesNotThrow(() => validateEnvironmentKeys({ ...env, E2E_FARMER_EMAIL: '', E2E_FARMER_PASSWORD: '' }));
});

test('child environment strips secrets and Playwright/Vite/debug overrides', () => {
  const clean = safeProcessEnvironment({ PATH: 'safe-path', SystemRoot: 'safe-root', VITE_PASSWORD: 'canary', E2E_FARMER_PASSWORD: 'canary', NODE_OPTIONS: 'canary', DEBUG: 'canary', HTTPS_PROXY: 'canary', PLAYWRIGHT_HTML_OUTPUT_DIR: 'canary' });
  assert.deepEqual(clean, { PATH: 'safe-path', SystemRoot: 'safe-root' });
});

test('runner rejects all extra arguments and fixes the config path', () => {
  for (const args of [[], ['other'], ['local', '--config', 'other.js'], ['smoke', '--project', 'chromium'], ['local', '--grep', 'auth'], ['smoke', '--reporter', 'html'], ['local', '--list']]) {
    assert.throws(() => launchPlans(args, {}, 'unit-run'));
  }
  const plans = launchPlans(['local'], { NODE_OPTIONS: 'canary', VITE_PASSWORD: 'canary' }, 'unit-run');
  assert.deepEqual(plans.map((plan) => plan.phase), ['diagnostic', 'sensitive']);
  assert.equal(plans[0].args.at(-2), '--config');
  assert.match(plans[0].args.at(-1), /playwright\.config\.js$/);
  assert.equal(plans[1].env.PLAYWRIGHT_NO_COPY_PROMPT, '1');
  assert.equal(JSON.stringify(plans).includes('canary'), false);
  assert.throws(() => launchPlans(['local'], {}, '../escape'));
});

test('production launch has only smoke phase and no sensitive environment', () => {
  const plans = launchPlans(['smoke'], { PRODUCTION_URL: 'https://example.invalid', E2E_FARMER_PASSWORD: 'canary' }, 'unit-run');
  assert.equal(plans.length, 1);
  assert.equal(plans[0].phase, 'smoke');
  assert.equal(plans[0].env.PRODUCTION_URL, 'https://example.invalid');
  assert.equal(JSON.stringify(plans).includes('canary'), false);
  assert.throws(() => validateRunSettings({ E2E_MODE: 'smoke', E2E_PHASE: 'sensitive', E2E_RUN_ID: 'unit-run' }));
  assert.throws(() => validateRunSettings({ E2E_MODE: 'local' }));
});

test('diagnostic local policy cannot access authentication or write data', () => {
  const policy = { mode: 'local', sensitive: false, ...validateLocalEnvironment(env) };
  assert.equal(requestAllowed('http://127.0.0.1:3000/api/products/1', 'GET', policy), true);
  assert.equal(requestAllowed('http://127.0.0.1:3000/api/auth/me', 'GET', policy), false);
  assert.equal(requestAllowed('http://127.0.0.1:3000/api/auth/login', 'POST', policy), false);
  assert.equal(requestAllowed('http://127.0.0.1:3000/api/products', 'POST', policy), false);
});

test('sensitive error sanitizer removes stacks, values and attachments but retains failures', () => {
  const info = { errors: [{ message: 'canary-password', stack: 'canary-token', errorContext: 'canary-password' }], attachments: [{ body: 'canary-token' }] };
  sanitizeSensitiveErrors(info);
  assert.equal(info.errors.length, 1);
  assert.equal(info.attachments.length, 0);
  assert.equal(JSON.stringify(info).includes('canary'), false);
  const reporter = new SensitiveReporter();
  reporter.onTestEnd({ title: 'canary-password' }, { status: 'failed', errors: [{ message: 'canary-token' }] });
  reporter.onError({ message: 'canary-password' });
  reporter.onStdOut('canary-password');
  reporter.onStdErr('canary-token');
  assert.deepEqual(reporter.counts, { failed: 1 });
});

test('sensitive artifacts fail closed after an unreviewed Playwright upgrade', () => {
  assert.doesNotThrow(() => validateSensitivePlaywrightVersion('1.65.0'));
  assert.throws(() => validateSensitivePlaywrightVersion('1.65.1'));
  assert.throws(() => validateSensitivePlaywrightVersion(undefined));
});

test('production base URL cannot carry credentials or URL tokens into reports', () => {
  assert.equal(productionURL('https://example.invalid').href, 'https://example.invalid/');
  for (const value of ['https://name:canary@example.invalid', 'https://example.invalid/?token=canary', 'https://example.invalid/#canary', 'https://example.invalid/canary', 'http://example.invalid']) {
    assert.throws(() => productionURL(value), (error) => !error.message.includes('canary'));
  }
});
