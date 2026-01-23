/**
 * Health Check Integration Tests
 * Verifies the health of critical application dependencies.
 */

// Import jest globals
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock next-auth before importing anything that uses it
jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({
    user: { id: 'test-user', email: 'test@example.com' }
  })
}));

// Mock monitoring module
jest.mock('@/lib/monitoring', () => ({
  monitoring: {
    checkDatabase: jest.fn().mockResolvedValue({
      status: 'healthy',
      responseTime: 5,
      details: {
        connected: true,
        poolSize: 10,
        activeConnections: 2
      }
    }),
    checkValkey: jest.fn().mockResolvedValue({
      status: 'healthy',
      responseTime: 3,
      details: {
        connected: true,
        memoryUsage: '1.2MB'
      }
    }),
    checkAIService: jest.fn().mockResolvedValue({
      status: 'healthy',
      responseTime: 10,
      details: {
        provider: 'openrouter',
        available: true
      }
    }),
    trackMetrics: jest.fn().mockResolvedValue(undefined),
    submitEvent: jest.fn().mockResolvedValue(undefined)
  }
}));

// Import the route handler after mocks are set up
import { GET } from '@/app/api/health/route';
import { NextRequest } from 'next/server';

describe('API Health Check', () => {
  // Set a longer timeout for these tests since they involve network requests
  jest.setTimeout(30000);

  it('should return a healthy status for all critical services', async () => {
    // Create a mock request
    const request = new NextRequest('http://localhost:3000/api/health');

    // Call the API route handler directly
    const response = await GET(request);

    // The handler should return a valid response
    expect(response.status).toBe(200);

    const data = await response.json();

    // Check the overall status
    expect(data.status).toBe('healthy');

    // Verify each critical dependency
    expect(data.checks).toBeDefined();
    expect(data.checks.database).toBeDefined();
    expect(data.checks.database.status).toBe('healthy');
    expect(data.checks.valkey).toBeDefined();
    expect(data.checks.valkey.status).toBe('healthy');
    expect(data.checks.ai).toBeDefined();
    expect(data.checks.ai.status).toBe('healthy');
  });
});
