import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.js';
import { loadLocalEnvironment } from './environment.js';

for (const [name, path] of [['home', '/'], ['login', '/login']]) {
  test(`${name} page meets automated WCAG 2.1 AA checks`, async ({ page }) => {
    const { api } = loadLocalEnvironment();
    await page.route((url) => url.origin === api.origin &&
      ['/api/products', '/api/categories'].includes(url.pathname), async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      return route.fulfill({ json: route.request().url().endsWith('/products')
        ? [{ id: 1, name: 'Тестовый товар', price: 500, image: '/favicon.svg' }] : [] });
    });
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Каталог', exact: true })).toBeVisible();
    await expect(page.locator('#auth').getByRole('heading', { name: 'Вход', exact: true })).toBeVisible();
    await expect(page.locator('#catalog .status-message').filter({ hasText: 'Загрузка товаров' })).toHaveCount(0);
    await expect(page.locator('#catalog').getByRole('heading', { name: 'Тестовый товар' })).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(result.violations).toEqual([]);
  });
}
