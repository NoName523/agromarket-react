import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures.js';
import { loadLocalEnvironment } from './environment.js';

async function loginFarmer(page, progress = false) {
  const step = (name, action) => progress ? test.step(name, action) : action();
  const { api } = loadLocalEnvironment();
  let loginRequests = 0;
  page.on('request', (request) => {
    if (request.url() === `${api.origin}/api/auth/login` && request.method() === 'POST') loginRequests += 1;
  });
  await step('farmer-login', async () => {
    const me = page.waitForResponse((response) =>
      response.url() === `${api.origin}/api/auth/me` && response.request().method() === 'GET');
    await page.goto('/');
    const response = await me;
    expect(response.status()).toBe(200);
    expect((await response.json()).role).toBe('farmer');
  });
  await step('farmer-form-visible', async () => {
    await expect(page.getByRole('heading', { name: 'Добавить товар', exact: true })).toBeVisible();
  });
  return { api, assertNoLogin: () => expect(loginRequests).toBe(0) };
}

test('farmer creates a product but has no administrative access @sensitive', async ({ page }) => {
  const { api, assertNoLogin } = await loginFarmer(page, true);
  const name = `E2E Farmer ${Date.now()} ${randomUUID()}`;
  const form = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Добавить товар', exact: true }) });
  await test.step('farmer-form-fill', async () => {
    await test.step('farmer-name-fill', async () => {
      await form.getByLabel('Название', { exact: true }).fill(name);
    });
    await test.step('farmer-price-fill', async () => {
      await form.getByLabel('Цена, тг', { exact: true }).fill('500');
    });
  });
  const created = page.waitForResponse((response) =>
    response.url() === `${api.origin}/api/products` && response.request().method() === 'POST');
  await test.step('farmer-submit', async () => {
    await form.getByRole('button', { name: 'Добавить товар', exact: true }).click();
  });
  await test.step('farmer-response', async () => {
    expect((await created).status()).toBe(201);
  });
  await test.step('farmer-catalog', async () => {
    await expect(page.locator('#catalog').getByRole('heading', { name, exact: true })).toBeVisible();
  });
  await expect(page.getByRole('button', { name: 'Удалить товар' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /редактировать/i })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Панель заявок' })).toHaveCount(0);

  // Verify a missing ID first so a permission regression cannot modify a real product.
  const missingId = 2147483647;
  const missing = await page.evaluate(async ({ origin, id }) =>
    (await fetch(`${origin}/api/products/${id}`)).status, { origin: api.origin, id: missingId });
  expect(missing).toBe(404);
  for (const method of ['PUT', 'PATCH', 'DELETE']) {
    const status = await page.evaluate(async ({ origin, id, requestMethod }) => {
      const token = localStorage.getItem('agromarket_jwt');
      if (!token) throw new Error('Farmer session missing.');
      const response = await fetch(`${origin}/api/products/${id}`, {
        method: requestMethod,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(requestMethod === 'DELETE' ? {} : { body: JSON.stringify({ name: 'E2E check', price: 500 }) }),
      });
      return response.status;
    }, { origin: api.origin, id: missingId, requestMethod: method });
    expect(status).toBe(403);
  }
  assertNoLogin();
});

test('farmer cannot submit a negative price @sensitive', async ({ page }) => {
  const { api, assertNoLogin } = await loginFarmer(page);
  const form = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Добавить товар', exact: true }) });
  let posts = 0;
  page.on('request', (request) => {
    if (request.url() === `${api.origin}/api/products` && request.method() === 'POST') posts += 1;
  });
  await form.getByLabel('Название', { exact: true }).fill(`Invalid ${randomUUID()}`);
  await form.getByLabel('Цена, тг', { exact: true }).fill('-500');
  await form.getByRole('button', { name: 'Добавить товар', exact: true }).click();
  await expect(form.getByRole('alert')).toHaveText('Цена должна быть больше 0');
  expect(posts).toBe(0);
  assertNoLogin();
});
