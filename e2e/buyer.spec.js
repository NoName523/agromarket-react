import { randomUUID } from 'node:crypto'
import { expect, test } from './fixtures.js'

const products = [
  {
    id: 101,
    name: 'Playwright sample product',
    price: 1200,
    image: '/images/sample-product.jpg',
  },
]

test.describe('isolated buyer page checks', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/products', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(products),
      })
    })
  })

  test('opens the home page and shows the AgroMarket brand', async ({ page }) => {
    await page.goto('/')

    const brand = page.getByRole('banner').getByRole('link', {
      name: new RegExp('\\u0410\\u0433\\u0440\\u043e\\u041c\\u0430\\u0440\\u043a\\u0435\\u0442'),
    })
    await expect(brand).toBeVisible()
  })

  test('shows a product card in the catalog', async ({ page }) => {
    await page.goto('/')

    const productHeading = page.getByRole('heading', { name: products[0].name })
    await expect(productHeading).toBeVisible()
    await expect(page.getByRole('article').filter({ has: productHeading })).toBeVisible()
  })

  test('direct navigation to /login serves the app shell (there is no dedicated login route)', async ({ page }) => {
    await page.goto('/login')

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('banner').getByRole('link', {
      name: new RegExp('\\u0410\\u0433\\u0440\\u043e\\u041c\\u0430\\u0440\\u043a\\u0435\u0442'),
    })).toBeVisible()
    await expect(page.getByRole('heading', { name: products[0].name })).toBeVisible()
  })

  test('shows navigation and catalog on Pixel 7', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Pixel 7', 'This check targets the Pixel 7 project')

    await page.goto('/')

    await expect(page.getByRole('navigation')).toBeVisible()
    await expect(page.locator('#catalog')).toBeVisible()
    await expect(page.getByRole('heading', { name: products[0].name })).toBeVisible()
  })
})

test('opens a product from the real local catalog', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/АгроМаркет/)
  await expect(page.getByRole('heading', { name: 'Каталог', exact: true })).toBeVisible()
  const link = page.locator('#catalog article h3 a').first()
  await expect(link).toBeVisible()
  const name = await link.innerText()
  await link.click()
  await expect(page).toHaveURL(/\/products\/\d+\/?$/)
  await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible()
})

test('registers a buyer and places an order for an existing product @creates-order @sensitive', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'Pixel 7', 'Run the data-creating flow only once in the desktop project')

  const timestamp = Date.now()
  const buyerName = 'E2E Test Buyer'
  const email = `e2e.buyer.${timestamp}@example.com`
  const password = randomUUID()

  await page.goto('/')

  const productCard = page.getByRole('article').first()
  await expect(productCard).toBeVisible()
  const productName = await productCard.getByRole('heading').innerText()

  const authSection = page.locator('#auth')
  await authSection.getByRole('button', {
    name: new RegExp('\\u0420\\u0435\\u0433\\u0438\\u0441\\u0442\\u0440\\u0430\\u0446\\u0438\\u044f'),
  }).click()
  await authSection.getByLabel(new RegExp('\\u0418\\u043c\\u044f')).fill(buyerName)
  await authSection.getByLabel('Email').fill(email)
  await authSection.getByLabel(new RegExp('\\u041f\\u0430\\u0440\\u043e\\u043b\\u044c')).fill(password)
  await authSection.getByRole('button', {
    name: new RegExp('\\u0421\\u043e\\u0437\\u0434\\u0430\\u0442\\u044c \\u0430\\u043a\\u043a\\u0430\\u0443\\u043d\\u0442'),
  }).click()

  await expect(page.getByText(new RegExp('\\u0417\\u0434\\u0440\\u0430\\u0432\\u0441\\u0442\\u0432\\u0443\\u0439\\u0442\\u0435,\\s*' + buyerName))).toBeVisible()

  await productCard.getByRole('button', {
    name: new RegExp('\\u0412 \\u043a\\u043e\\u0440\\u0437\\u0438\\u043d\\u0443'),
  }).click()
  await expect(page.getByText(new RegExp('\\u041a\\u043e\\u0440\\u0437\\u0438\\u043d\\u0430:\\s*1'))).toBeVisible()

  const orderForm = page.locator('section#contact')
  await orderForm.getByLabel(new RegExp('\\u0412\\u044b\\u0431\\u0435\\u0440\\u0438\\u0442\\u0435 \\u0442\\u043e\\u0432\\u0430\\u0440')).selectOption({ label: productName })
  await orderForm.getByLabel(new RegExp('\\u0418\\u043c\\u044f / \\u043e\\u0440\\u0433\\u0430\\u043d\\u0438\\u0437\\u0430\\u0446\\u0438\\u044f')).fill(buyerName)
  await orderForm.getByLabel('Email').fill(email)
  await orderForm.getByLabel(new RegExp('\\u041e\\u0431\\u044a\\u0451\\u043c \\u0437\\u0430\\u043a\\u0430\\u0437\\u0430, \\u043a\\u0433')).fill('25')

  const successDialog = page.waitForEvent('dialog')
  await orderForm.getByRole('button', {
    name: new RegExp('\\u041e\\u0442\\u043f\\u0440\\u0430\\u0432\\u0438\\u0442\\u044c \\u0437\\u0430\\u044f\\u0432\\u043a\\u0443'),
  }).click()
  const dialog = await successDialog
  expect(dialog.message()).toMatch(/^Заявка №\d+ принята!$/)
  await dialog.accept()
})
