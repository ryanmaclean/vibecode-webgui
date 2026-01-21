/**
 * Kubernetes Liveness Probe API Tests
 * Issue #953: Improve API route test coverage
 */

import { NextRequest } from 'next/server';

// Mock the validation middleware
jest.mock('@/lib/api/validation/middleware', () => ({
  validateQueryParams: jest.fn(() => ({ success: true, data: {} })),
}));

// Mock the schema
jest.mock('@/lib/api/validation/schemas', () => ({
  healthCheckQuerySchema: {},
}));

// Mock api-utils
jest.mock('@/lib/api-utils', () => ({
  createHealthResponse: jest.fn((status: string) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json({ status, timestamp: new Date().toISOString() });
  }),
  createErrorResponseFromError: jest.fn((error: unknown, statusCode: number, message: string) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json(
      { error: message, details: error instanceof Error ? error.message : 'Unknown error' },
      { status: statusCode }
    );
  }),
}));

describe('/api/healthz - Kubernetes Liveness Probe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/healthz', () => {
    it('should return healthy status with 200', async () => {
      const { GET } = await import('@/app/api/healthz/route');
      const request = new NextRequest('http://localhost:3000/api/healthz');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.timestamp).toBeDefined();
    });

    it('should include timestamp in ISO format', async () => {
      const { GET } = await import('@/app/api/healthz/route');
      const request = new NextRequest('http://localhost:3000/api/healthz');

      const response = await GET(request);
      const data = await response.json();

      const timestamp = new Date(data.timestamp);
      expect(timestamp.toISOString()).toBe(data.timestamp);
    });

    it('should handle validation failure gracefully', async () => {
      const { validateQueryParams } = await import('@/lib/api/validation/middleware');
      const { NextResponse } = await import('next/server');

      (validateQueryParams as jest.Mock).mockReturnValueOnce({
        success: false,
        error: NextResponse.json({ error: 'Invalid parameters' }, { status: 400 }),
      });

      const { GET } = await import('@/app/api/healthz/route');
      const request = new NextRequest('http://localhost:3000/api/healthz?invalid=param');

      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it('should be lightweight for k8s probing', async () => {
      const { GET } = await import('@/app/api/healthz/route');
      const request = new NextRequest('http://localhost:3000/api/healthz');

      const startTime = Date.now();
      const response = await GET(request);
      const endTime = Date.now();

      expect(response.status).toBe(200);
      // Liveness probe should respond quickly (under 100ms in test environment)
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Response Format', () => {
    it('should return JSON content type', async () => {
      const { GET } = await import('@/app/api/healthz/route');
      const request = new NextRequest('http://localhost:3000/api/healthz');

      const response = await GET(request);

      expect(response.headers.get('content-type')).toContain('application/json');
    });

    it('should have minimal response body for performance', async () => {
      const { GET } = await import('@/app/api/healthz/route');
      const request = new NextRequest('http://localhost:3000/api/healthz');

      const response = await GET(request);
      const text = await response.clone().text();

      // Response should be small for k8s probes (less than 500 bytes)
      expect(text.length).toBeLessThan(500);
    });
  });
});
