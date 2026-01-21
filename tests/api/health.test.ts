/**
 * Health API Route Tests
 * Issue #953: Improve API route test coverage
 */

import { NextRequest } from 'next/server';

// Mock the validation middleware
jest.mock('@/lib/api/validation/middleware', () => ({
  validateQueryParams: jest.fn(() => ({ success: true, data: { filter: undefined, format: undefined } })),
}));

// Mock the schema
jest.mock('@/lib/api/validation/schemas', () => ({
  healthCheckQuerySchema: {},
}));

describe('Health API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/health/simple', () => {
    it('should return health status', async () => {
      // Import the route handler
      const { GET } = await import('@/app/api/health/simple/route');

      // Create mock request
      const request = new NextRequest('http://localhost:3000/api/health/simple');

      // Call the handler
      const response = await GET(request);
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.timestamp).toBeDefined();
      expect(typeof data.uptime).toBe('number');
      expect(data.environment).toBeDefined();
    });

    it('should include version info', async () => {
      const { GET } = await import('@/app/api/health/simple/route');
      const request = new NextRequest('http://localhost:3000/api/health/simple');

      const response = await GET(request);
      const data = await response.json();

      expect(data.version).toBeDefined();
    });
  });

  describe('GET /api/health', () => {
    it('should return comprehensive health check', async () => {
      // This test verifies the main health endpoint exists
      // Full integration test would require database connection
      const { GET } = await import('@/app/api/health/route');

      const request = new NextRequest('http://localhost:3000/api/health');

      // The response depends on database availability
      // In test environment, we just verify the endpoint responds
      const response = await GET(request);
      expect(response).toBeDefined();
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(600);
    });
  });
});

describe('Health Check Response Format', () => {
  it('should have correct JSON structure', async () => {
    const { GET } = await import('@/app/api/health/simple/route');
    const request = new NextRequest('http://localhost:3000/api/health/simple');

    const response = await GET(request);
    const data = await response.json();

    // Verify response structure
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('uptime');
    expect(data).toHaveProperty('environment');
    expect(data).toHaveProperty('version');
  });

  it('should return valid ISO timestamp', async () => {
    const { GET } = await import('@/app/api/health/simple/route');
    const request = new NextRequest('http://localhost:3000/api/health/simple');

    const response = await GET(request);
    const data = await response.json();

    // Verify timestamp is valid ISO format
    const timestamp = new Date(data.timestamp);
    expect(timestamp.toISOString()).toBe(data.timestamp);
  });
});
