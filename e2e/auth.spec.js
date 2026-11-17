import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures.js';

test('registration with a unique email displays the user name @sensitive', async ({ page }) => {
  const name = `E2E Buyer ${Date.now()}`;
  await page.goto('/');
  const auth = page.locator('#auth');
  await auth.getByRole('button', { name: 'Регистрация', exact: true }).click();
  await auth.getByLabel('Имя', { exact: true }).fill(name);
  await auth.getByLabel('Email', { exact: true }).fill(`e2e.${Date.now()}.${randomUUID()}@example.com`);
  await auth.getByLabel('Пароль', { exact: true }).fill(randomUUID());
  await auth.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await expect(page.getByText(`Здравствуйте, ${name}`, { exact: true })).toBeVisible();
});

test('an incorrect password displays the login error @sensitive', async ({ page }) => {
  // Create this test's own user; do not rely on test order or seed credentials.
  const email = `e2e.${Date.now()}.${randomUUID()}@example.com`;
  await page.goto('/');
  const auth = page.locator('#auth');
  await auth.getByRole('button', { name: 'Регистрация', exact: true }).click();
  await auth.getByLabel('Имя', { exact: true }).fill('E2E Password Check');
  await auth.getByLabel('Email', { exact: true }).fill(email);
  await auth.getByLabel('Пароль', { exact: true }).fill(randomUUID());
  await auth.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await auth.getByLabel('Email', { exact: true }).fill(email);
  await auth.getByLabel('Пароль', { exact: true }).fill(randomUUID());
  const response = page.waitForResponse((result) => new URL(result.url()).pathname === '/api/auth/login' && result.request().method() === 'POST');
  await auth.getByRole('button', { name: 'Войти', exact: true }).click();
  expect((await response).status()).toBe(401);
  await expect(auth.getByRole('alert')).toBeVisible();
  await expect(auth.getByRole('alert')).not.toBeEmpty();
  await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toHaveCount(0);
});
