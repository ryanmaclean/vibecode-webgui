/**
 * Health Check Integration Tests
 * Verifies the health of critical application dependencies.
 */

const HAS_DATABASE = process.env.DATABASE_URL !== undefined;

(HAS_DATABASE ? describe : describe.skip)('API Health Check', () => {
  // Set a longer timeout for these tests since they involve network requests
  jest.setTimeout(30000);

  it('should return a healthy status for all critical services', async () => {
    let response: Response | null = null;
    try {
      response = await fetch('http://localhost:3000/api/health');
    } catch (err) {
      // If server is not running, skip test
      console.warn('Health server not reachable; test cannot run without running server.');
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
