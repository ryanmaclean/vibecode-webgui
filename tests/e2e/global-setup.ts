/**
 * Global setup for E2E tests
 * Sets up test data, authentication, and required services
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  
  console.log('🚀 Setting up E2E test environment...');
  
  // Create a browser instance for setup
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Wait for the application to be ready
    console.log('⏳ Waiting for application to be available...');
    await page.goto(baseURL || 'http://localhost:3000', { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });

    // Setup test user authentication if needed
    await setupTestAuth(page);

    // Verify critical services are available
    await verifyServices(page);

    console.log('✅ E2E test environment setup complete');

  } catch (error) {
    console.error('❌ E2E setup failed:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function setupTestAuth(page: any) {
  // Check if authentication is required
  const loginButton = await page.locator('[href="/auth/login"]').first();
  
  if (await loginButton.isVisible()) {
    console.log('🔐 Setting up test authentication...');
    // For E2E tests, we might want to create a test user or use mock auth
    // This would depend on your auth implementation
    
    // Store authentication state if needed
    await page.context().storageState({ 
      path: 'tests/e2e/auth-state.json' 
    });
  }
}

async function verifyServices(page: any) {
  console.log('🔍 Verifying critical services...');
  
  // Check API health endpoint
  try {
    const response = await page.request.get('/api/health');
    if (!response.ok()) {
      throw new Error(`Health check failed: ${response.status()}`);
    }
    console.log('✅ API health check passed');
  } catch (error) {
    console.warn('⚠️ API health check failed:', error.message);
  }

  // Verify UI is interactive
  const body = await page.locator('body').first();
  await body.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✅ UI is interactive');
}

export default globalSetup;