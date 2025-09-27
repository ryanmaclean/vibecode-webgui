import { test, expect } from '@playwright/test';

/**
 * Simple Test to verify Playwright is working
 */
test.describe('Simple Tests', () => {
  test('should access the health endpoint', async ({ request }) => {
    // Test the health endpoint directly
    const response = await request.get('/api/health');
    
    expect(response.ok()).toBeTruthy();
    
    const healthData = await response.json();
    console.log('Health data:', healthData);
    
    // Basic validation
    expect(healthData).toHaveProperty('status');
    expect(healthData).toHaveProperty('timestamp');
  });

  test('should access the database test endpoint', async ({ request }) => {
    // Test the database endpoint
    const response = await request.get('/api/test-db');
    
    expect(response.ok()).toBeTruthy();
    
    const dbData = await response.json();
    console.log('Database test data:', dbData);
    
    // Basic validation
    expect(dbData).toHaveProperty('status');
    expect(dbData.status).toBe('success');
  });

  test('should handle 404 for invalid endpoints', async ({ request }) => {
    // Test error handling
    const response = await request.get('/api/non-existent');
    
    expect(response.status()).toBe(404);
  });
});


