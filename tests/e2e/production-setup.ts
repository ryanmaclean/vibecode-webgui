/**
 * Global setup for production E2E tests
 * Validates that the live deployment is ready for testing
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const baseURL = process.env.BASE_URL || 'http://20.36.249.127';

  console.log(`🚀 Setting up E2E tests for production deployment: ${baseURL}`);

  // Launch browser to verify site accessibility
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('⏳ Verifying live site accessibility...');

    // Test basic connectivity with timeout
    const response = await page.goto(baseURL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    if (!response || !response.ok()) {
      throw new Error(`Live site not accessible: ${response?.status()} ${response?.statusText()}`);
    }

    console.log('✅ Live site is accessible');

    // Verify health endpoint
    console.log('⏳ Checking health endpoint...');
    const healthResponse = await page.request.get(`${baseURL}/api/health/simple`, {
      timeout: 15000
    });

    if (healthResponse.ok()) {
      const health = await healthResponse.json();
      console.log('✅ Health check passed:', health);
    } else {
      console.warn('⚠️  Health endpoint not available, but continuing tests');
    }

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    console.log('✅ Production site is ready for E2E testing');

  } catch (error) {
    console.error('❌ Production setup failed:', error);
    throw error;
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
}

export default globalSetup;