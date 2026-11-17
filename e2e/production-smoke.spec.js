import { test, expect } from './fixtures.js';

test('production home shows the real catalog', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/');
  await expect(page).toHaveTitle(/АгроМаркет/);
  await expect(page.locator('#catalog').getByRole('heading', { name: 'Каталог', exact: true })).toBeVisible();
  await expect(page.locator('#catalog article').first()).toBeVisible({ timeout: 70000 });
});

test('production product link opens its name on the product page', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/');
  const link = page.locator('#catalog article h3 a').first();
  await expect(link).toBeVisible({ timeout: 70000 });
  const name = await link.innerText();
  await link.click();
  await expect(page).toHaveURL(/\/products\/\d+\/?$/);
  await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
});
