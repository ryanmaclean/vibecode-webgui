import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for testing against live production deployment
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 1,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : 2,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'playwright-report/production' }],
    ['json', { outputFile: 'playwright-output/production/results.json' }],
    ['junit', { outputFile: 'playwright-output/production/results.xml' }]
  ],
  outputDir: 'playwright-output/production/artifacts',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL:
      process.env.BASE_URL ||
      process.env.PRODUCTION_BASE_URL ||
      'https://vibecode.eastus2.cloudapp.azure.com',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'retain-on-failure',

    /* Navigation timeout */
    navigationTimeout: 30 * 1000,

    /* Action timeout */
    actionTimeout: 10 * 1000,

    /* Custom user agent for production testing */
    userAgent: 'VibeCode-E2E-Tests/1.0 (Production Testing)',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium-production',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
    },

    {
      name: 'firefox-production',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit-production',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    {
      name: 'mobile-chrome-production',
      use: {
        ...devices['Pixel 5'],
        userAgent: 'VibeCode-E2E-Tests/1.0 (Production Testing - Mobile)',
      },
    },
  ],

  /*
   * No webServer configuration - we're testing against live deployment
   * Expect DNS `vibecode.eastus2.cloudapp.azure.com` (or override via BASE_URL/PRODUCTION_BASE_URL)
   */

  /* Global setup and teardown */
  globalSetup: require.resolve('./tests/e2e/production-setup.ts'),
  globalTeardown: require.resolve('./tests/e2e/production-teardown.ts'),

  /* Test timeout for production environment */
  timeout: 60 * 1000,

  /* Expect timeout for production environment */
  expect: {
    timeout: 10 * 1000,
  },
});
