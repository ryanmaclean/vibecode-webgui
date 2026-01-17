/**
 * @jest-environment node
 */

/**
 * Unit tests for Readyz API Route (Kubernetes Readiness Probe)
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/readyz/route';

// Mock the API utilities
jest.mock('@/lib/api-utils', () => ({
  createHealthResponse: jest.fn((status: string) => {
    return new Response(JSON.stringify({ status, ready: true, timestamp: new Date().toISOString() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }),
  createErrorResponseFromError: jest.fn((error: Error, status: number, message: string) => {
    return new Response(JSON.stringify({ error: message, status: 'error' }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  })
}));

// Mock validation middleware
jest.mock('@/lib/api/validation/middleware', () => ({
  validateQueryParams: jest.fn((request: NextRequest, schema: any) => ({
    success: true,
    data: {}
  }))
}));

// Helper function to create a mock NextRequest
function createMockRequest(url: string = 'http://localhost:3000/api/readyz'): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
    headers: {
      'x-forwarded-for': '127.0.0.1',
    },
  });
}

describe('/api/readyz', () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    mockRequest = createMockRequest();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/readyz', () => {
    it('should return ready status for readiness probe', async () => {
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ready');
      expect(data.ready).toBe(true);
    });

    it('should validate query parameters', async () => {
      const { validateQueryParams } = require('@/lib/api/validation/middleware');

      await GET(mockRequest);

      expect(validateQueryParams).toHaveBeenCalledWith(
        mockRequest,
        expect.anything()
      );
    });

    it('should handle validation errors', async () => {
      const { validateQueryParams } = require('@/lib/api/validation/middleware');
      const mockError = new Response(JSON.stringify({ error: 'Invalid parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });

      validateQueryParams.mockReturnValueOnce({
        success: false,
        error: mockError
      });

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid parameters');
    });

    it('should handle unexpected errors gracefully', async () => {
      const { validateQueryParams } = require('@/lib/api/validation/middleware');

      validateQueryParams.mockImplementationOnce(() => {
        throw new Error('Unexpected error');
      });

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('Readiness check failed');
    });

    it('should include timestamp in response', async () => {
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(data.timestamp).toBeDefined();
      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should respond quickly for k8s probes', async () => {
      const startTime = Date.now();
      await GET(mockRequest);
      const duration = Date.now() - startTime;

      // Readiness probe should respond very quickly
      expect(duration).toBeLessThan(100);
    });

    it('should handle requests with query parameters', async () => {
      const requestWithParams = createMockRequest('http://localhost:3000/api/readyz?verbose=true');

      const response = await GET(requestWithParams);

      expect(response.status).toBe(200);
    });

    it('should return JSON content type', async () => {
      const response = await GET(mockRequest);

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });
});
