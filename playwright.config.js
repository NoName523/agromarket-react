import { defineConfig, devices } from '@playwright/test'
import { loadLocalEnvironment, productionURL } from './e2e/environment.js'
import { validateRunSettings } from './e2e/runner-policy.js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateSensitivePlaywrightVersion } from './e2e/sensitive-reporter.js'

const { smoke, sensitive } = validateRunSettings(process.env)
if (sensitive) {
  const playwright = JSON.parse(readFileSync(new URL('./node_modules/playwright/package.json', import.meta.url), 'utf8'))
  validateSensitivePlaywrightVersion(playwright.version)
  process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1'
}
const runFolder = `${process.env.E2E_RUN_ID}/${process.env.E2E_PHASE}`
const farmerState = resolve('.playwright-auth', process.env.E2E_RUN_ID, 'farmer.json')
const local = smoke ? null : loadLocalEnvironment()
let baseURL = local?.frontend.href
if (smoke) {
  baseURL = productionURL(process.env.PRODUCTION_URL).href
}

export default defineConfig({
  testDir: './e2e',
  timeout: 90000,
  expect: {
    timeout: 15000,
  },
  retries: 1,
  workers: 1,
  captureGitInfo: { commit: false, diff: false },
  outputDir: `test-results/lab12/${runFolder}`,
  reporter: sensitive ? [['./e2e/sensitive-reporter.js']] : [
    ['list'],
    ['html', { open: 'never', noSnippets: true, noCopyPrompt: true, outputFolder: `playwright-report/lab12/${runFolder}` }],
  ],
  use: {
    baseURL,
    serviceWorkers: 'block',
    trace: sensitive ? 'off' : 'on-first-retry',
    screenshot: sensitive ? 'off' : 'only-on-failure',
    video: 'off',
  },
  projects: smoke ? [{
    name: 'production-smoke',
    testMatch: 'production-smoke.spec.js',
    use: { ...devices['Desktop Chrome'] },
  }] : sensitive ? [{
    name: 'local-sensitive',
    testMatch: ['buyer.spec.js', 'auth.spec.js'],
    grep: /@sensitive/,
    metadata: { sensitive: true },
    use: { ...devices['Desktop Chrome'] },
  }, {
    name: 'farmer-setup',
    testMatch: 'farmer.setup.js',
    grep: /@sensitive/,
    retries: 0,
    metadata: { sensitive: true },
    use: { ...devices['Desktop Chrome'] },
  }, {
    name: 'local-farmer',
    testMatch: 'farmer.spec.js',
    grep: /@sensitive/,
    dependencies: ['farmer-setup'],
    metadata: { sensitive: true },
    use: { ...devices['Desktop Chrome'], storageState: farmerState },
  }] : [
    {
      name: 'chromium',
      testMatch: ['buyer.spec.js', 'accessibility.spec.js'],
      grepInvert: /@sensitive/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Pixel 7',
      testMatch: ['buyer.spec.js', 'accessibility.spec.js'],
      grepInvert: /@sensitive/,
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'visual-chromium',
      testMatch: 'product-card.visual.spec.js',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, reducedMotion: 'reduce' },
    },
  ],
  webServer: smoke ? undefined : {
    command: 'node e2e/start-vite.js',
    url: baseURL,
    reuseExistingServer: false,
  },
})
