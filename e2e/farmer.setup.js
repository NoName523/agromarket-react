import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test, expect } from './fixtures.js';
import { loadLocalEnvironment } from './environment.js';

test('prepare farmer session @sensitive', async ({ page, context }) => {
  const { api, env } = loadLocalEnvironment();
  if (!env.E2E_FARMER_EMAIL || !env.E2E_FARMER_PASSWORD) throw new Error('Test farmer credentials are required.');
  await page.goto('/');
  const auth = page.locator('#auth');
  await auth.getByLabel('Email', { exact: true }).fill(env.E2E_FARMER_EMAIL);
  await auth.getByLabel('Пароль', { exact: true }).fill(env.E2E_FARMER_PASSWORD);
  const login = page.waitForResponse((response) =>
    response.url() === `${api.origin}/api/auth/login` && response.request().method() === 'POST');
  await auth.getByRole('button', { name: 'Войти', exact: true }).click();
  const response = await login;
  expect(response.status()).toBe(200);
  expect((await response.json()).user.role).toBe('farmer');
  await expect(page.getByRole('heading', { name: 'Добавить товар', exact: true })).toBeVisible();
  const state = await context.storageState();
  await writeFile(resolve('.playwright-auth', process.env.E2E_RUN_ID, 'farmer.json'),
    JSON.stringify(state), { mode: 0o600, flag: 'wx' });
});
