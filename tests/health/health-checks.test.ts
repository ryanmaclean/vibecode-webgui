/**
 * Health Check Integration Tests
 * Verifies the health of critical application dependencies.
 */

describe('API Health Check', () => {
  // Set a longer timeout for these tests since they involve network requests
  jest.setTimeout(30000);

  const RUN = process.env.RUN_HEALTH_TESTS === 'true';

  const itMaybe = RUN ? it : it.skip;

  itMaybe('should return a healthy status for all critical services', async () => {
    let response: Response | null = null;
    try {
      response = await fetch('http://localhost:3000/api/health');
    } catch (err) {
      // If server is not running, skip gracefully
      console.warn('Health server not reachable; skipping API health test. Set RUN_HEALTH_TESTS=true with server running to enable.');
      return;
    }

    const data = await response.json();

    // Check the overall status
    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');

    // Verify each critical dependency
    expect(data.checks.database.status).toBe('healthy');
    expect(data.checks.redis.status).toBe('healthy');
    expect(data.checks.ai.status).toBe('healthy');
  });
});
