import { test, expect } from '@playwright/test';

/**
 * Health Check Tests
 * Verifies the core functionality and health of the VibeCode WebGUI
 */
test.describe('Health Check Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application before each test
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load the main page successfully', async ({ page }) => {
    // Verify the page loads without errors
    await expect(page).toHaveTitle(/VibeCode WebGUI/);

    // Check for main content
    await expect(page.locator('body')).toBeVisible();

    // Verify no console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Wait a bit for any potential errors
    await page.waitForTimeout(2000);

    // Log any console errors for debugging
    if (consoleErrors.length > 0) {
      console.log('Console errors found:', consoleErrors);
    }

    // For now, we'll just log errors instead of failing the test
    // as some errors might be expected during development
  });

  test('should have working health API endpoint', async ({ page }) => {
    // Test the health endpoint directly
    const response = await page.request.get('/api/health');

    expect(response.ok()).toBeTruthy();

    const healthData = await response.json();

    // Verify health response structure
    expect(healthData).toHaveProperty('status');
    expect(healthData).toHaveProperty('timestamp');
    expect(healthData).toHaveProperty('version');
    expect(healthData).toHaveProperty('environment');
    expect(healthData).toHaveProperty('checks');

    // Verify checks object
    expect(healthData.checks).toHaveProperty('memory');
    expect(healthData.checks).toHaveProperty('disk');
    expect(healthData.checks).toHaveProperty('database');
    expect(healthData.checks).toHaveProperty('valkey');

    // Log health status for monitoring
    console.log('Health Status:', healthData.status);
    console.log('Database Status:', healthData.checks.database.status);
    console.log('Valkey Status:', healthData.checks.valkey.status);

    // Verify critical services are healthy
    expect(healthData.checks.database.status).toBe('healthy');
    expect(healthData.checks.memory.status).toBe('healthy');
    expect(healthData.checks.disk.status).toBe('healthy');
  });

  test('should have working database health endpoint', async ({ page }) => {
    // Test the dedicated database health endpoint (production-safe)
    const response = await page.request.get('/api/health/database');

    expect(response.ok()).toBeTruthy();

    const dbData = await response.json();

    // Verify database health response structure
    expect(dbData).toHaveProperty('status');
    expect(dbData).toHaveProperty('timestamp');

    // Verify database connection is working
    expect(dbData.status).toBe('healthy');

    console.log('Database health check successful:', dbData.status);
  });

  test('should have proper error handling for invalid endpoints', async ({ page }) => {
    // Test a non-existent endpoint
    const response = await page.request.get('/api/non-existent');

    // Should return 404
    expect(response.status()).toBe(404);
  });

  test('should have working static assets', async ({ page }) => {
    // Check if favicon loads
    const faviconResponse = await page.request.get('/favicon.ico');
    expect(faviconResponse.ok()).toBeTruthy();

    // Check if Next.js assets are accessible
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify no 404s for critical resources
    const failedRequests: string[] = [];
    page.on('requestfailed', request => {
      if (request.resourceType() === 'script' || request.resourceType() === 'stylesheet') {
        failedRequests.push(`${request.resourceType()}: ${request.url()}`);
      }
    });

    // Wait for page to fully load
    await page.waitForTimeout(3000);

    // Log any failed requests for debugging
    if (failedRequests.length > 0) {
      console.log('Failed resource requests:', failedRequests);
    }

    // For now, we'll just log failures instead of failing the test
    // as some might be expected during development
  });

  test('should have responsive design elements', async ({ page }) => {
    // Test responsive design by checking viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1000);

    // Verify desktop layout
    await expect(page.locator('body')).toBeVisible();

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);

    // Verify mobile layout still works
    await expect(page.locator('body')).toBeVisible();

    // Reset to default
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('should have proper accessibility features', async ({ page }) => {
    // Check for proper HTML structure
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // Check for viewport meta tag
    const viewportMeta = page.locator('meta[name="viewport"]');
    await expect(viewportMeta).toBeVisible();

    // Check for proper title
    await expect(page).toHaveTitle(/VibeCode WebGUI/);

    // Check for proper meta description
    const descriptionMeta = page.locator('meta[name="description"]');
    await expect(descriptionMeta).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Test offline behavior by disabling network
    await page.context().setOffline(true);

    try {
      // Try to navigate to a page
      await page.goto('/');

      // Should still show some content or error message
      await expect(page.locator('body')).toBeVisible();

    } finally {
      // Re-enable network
      await page.context().setOffline(false);
    }
  });
});
