import { test, expect } from './fixtures.js';
import { loadLocalEnvironment } from './environment.js';

test('ProductCard matches its visual baseline', async ({ page }) => {
  const { api } = loadLocalEnvironment();
  await page.route((url) => url.origin === api.origin &&
    ['/api/products', '/api/categories'].includes(url.pathname), async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/products')
      ? [{ id: 101, name: 'Тестовый товар', price: 500, image: '/favicon.svg' }] : [] });
  });
  await page.goto('/');
  const card = page.locator('#catalog article').filter({ has: page.getByRole('heading', { name: 'Тестовый товар', exact: true }) });
  await expect(card).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await card.locator('img').evaluate((image) => image.decode());
  await page.mouse.move(0, 0);
  await card.scrollIntoViewIfNeeded();
  const clip = await card.boundingBox();
  expect(clip).not.toBeNull();
  await expect(page).toHaveScreenshot('product-card.png', {
    clip, animations: 'disabled', caret: 'hide', scale: 'css',
  });
});
