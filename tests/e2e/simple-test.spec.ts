import { test, expect } from '@playwright/test';

/**
 * Simple Test to verify Playwright is working
 */
test.describe('Simple Tests', () => {
  test('should access the health endpoint', async ({ request }) => {
<<<<<<< Updated upstream
    // Test the health endpoint directly
    const response = await request.get('/api/health');
    
=======
    // Test the simple health endpoint directly (no external dependencies)
    const response = await request.get('/api/health/simple');

>>>>>>> Stashed changes
    expect(response.ok()).toBeTruthy();

    const healthData = await response.json();
    console.log('Health data:', healthData);

    // Basic validation
    expect(healthData).toHaveProperty('status');
    expect(healthData).toHaveProperty('timestamp');
  });

<<<<<<< Updated upstream
  test('should access the database test endpoint', async ({ request }) => {
    // Test the database endpoint
    const response = await request.get('/api/test-db');
    
=======
  test('should access the database health endpoint', async ({ request }) => {
    // Test the database health endpoint (production-safe)
    const response = await request.get('/api/health/database');

>>>>>>> Stashed changes
    expect(response.ok()).toBeTruthy();

    const dbData = await response.json();
<<<<<<< Updated upstream
    console.log('Database test data:', dbData);
    
    // Basic validation
    expect(dbData).toHaveProperty('status');
    expect(dbData.status).toBe('success');
=======
    console.log('Database health data:', dbData);

    // Basic validation for database health check
    expect(dbData).toHaveProperty('status');
    expect(dbData.status).toBe('healthy');
    expect(dbData).toHaveProperty('timestamp');
>>>>>>> Stashed changes
  });

  test('should handle 404 for invalid endpoints', async ({ request }) => {
    // Test error handling
    const response = await request.get('/api/non-existent');

    expect(response.status()).toBe(404);
  });
});
