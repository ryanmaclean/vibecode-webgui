import { test, expect } from '@playwright/test';

/**
 * Simple Test to verify Playwright is working
 */
test.describe('Simple Tests', () => {
  test('should access the health endpoint', async ({ request }) => {
    // Test the simple health endpoint directly (no external dependencies)
    const response = await request.get('/api/health/simple');
    
    expect(response.ok()).toBeTruthy();
    
    const healthData = await response.json();
    console.log('Health data:', healthData);
    
    // Basic validation
    expect(healthData).toHaveProperty('status');
    expect(healthData).toHaveProperty('timestamp');
    expect(healthData.status).toBe('ok');
  });

  test('should access the database test endpoint', async ({ request }) => {
    // Test the database endpoint (E2E mode)
    const response = await request.get('/api/test-db');
    
    expect(response.ok()).toBeTruthy();
    
    const dbData = await response.json();
    console.log('Database test data:', dbData);
    
    // Basic validation for E2E test mode
    expect(dbData).toHaveProperty('status');
    expect(dbData.status).toBe('success');
    expect(dbData).toHaveProperty('testMode');
    expect(dbData.testMode).toBe(true);
  });

  test('should handle 404 for invalid endpoints', async ({ request }) => {
    // Test error handling
    const response = await request.get('/api/non-existent');
    
    expect(response.status()).toBe(404);
  });
});


