/**
 * Tests for API Validation Helpers
 */
import { NextRequest } from 'next/server';
import {
  checkRateLimit,
  createRateLimitResponse,
  createErrorResponse,
  createSuccessResponse,
  getUserId,
  getWorkspaceId,
  isAuthenticated,
  getClientIP,
  logAPIRequest,
} from '@/lib/api/validation/helpers';

// Mock console.log for logAPIRequest tests
const originalConsoleLog = console.log;
let consoleOutput: any[] = [];

beforeEach(() => {
  consoleOutput = [];
  console.log = (...args: any[]) => {
    consoleOutput.push(args);
  };
});

afterEach(() => {
  console.log = originalConsoleLog;
});

describe('api/validation/helpers', () => {
  describe('checkRateLimit', () => {
    it('should allow first request', () => {
      const result = checkRateLimit('test-key', 10, 60000);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should track multiple requests', () => {
      const key = 'test-multi';
      const result1 = checkRateLimit(key, 5, 60000);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(4);

      const result2 = checkRateLimit(key, 5, 60000);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(3);
    });

    it('should block when limit exceeded', () => {
      const key = 'test-block';
      for (let i = 0; i < 3; i++) {
        checkRateLimit(key, 3, 60000);
      }
      const result = checkRateLimit(key, 3, 60000);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should use default values', () => {
      const result = checkRateLimit('test-defaults');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
    });
  });

  describe('createRateLimitResponse', () => {
    it('should create 429 response', () => {
      const resetTime = Date.now() + 60000;
      const response = createRateLimitResponse(resetTime);
      expect(response.status).toBe(429);
    });

    it('should include retry headers', async () => {
      const resetTime = Date.now() + 60000;
      const response = createRateLimitResponse(resetTime);
      expect(response.headers.get('Retry-After')).toBeDefined();
    });

    it('should include rate limit headers', async () => {
      const resetTime = Date.now() + 30000;
      const response = createRateLimitResponse(resetTime);
      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    });

    it('should include error message in body', async () => {
      const resetTime = Date.now() + 60000;
      const response = createRateLimitResponse(resetTime);
      const body = await response.json();
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.error.message).toBe('Too many requests, please try again later');
      expect(body.retryAfter).toBeDefined();
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response with message', async () => {
      const response = createErrorResponse('Test error');
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error.message).toBe('Test error');
      expect(body.meta.timestamp).toBeDefined();
    });

    it('should accept custom status code', async () => {
      const response = createErrorResponse('Not found', 404);
      expect(response.status).toBe(404);
    });

    it('should include additional details', async () => {
      const response = createErrorResponse('Error', 400, { field: 'email', code: 'INVALID' });
      const body = await response.json();
      expect(body.field).toBe('email');
      expect(body.error.code).toBe('INVALID');
    });

    it('should include timestamp', async () => {
      const response = createErrorResponse('Test');
      const body = await response.json();
      expect(body.meta.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('createSuccessResponse', () => {
    it('should create success response', async () => {
      const data = { id: 1, name: 'Test' };
      const response = createSuccessResponse(data);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual(data);
      expect(body.meta.timestamp).toBeDefined();
    });

    it('should accept custom status code', async () => {
      const response = createSuccessResponse({ created: true }, { status: 201 });
      expect(response.status).toBe(201);
    });

    it('should include metadata', async () => {
      const response = createSuccessResponse(
        { result: 'ok' },
        {
          additionalFields: { page: 1, total: 10 },
        }
      );
      const body = await response.json();
      expect(body.page).toBe(1);
      expect(body.total).toBe(10);
    });

    it('should include timestamp', async () => {
      const response = createSuccessResponse({ test: true });
      const body = await response.json();
      expect(body.meta.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should handle null data', async () => {
      const response = createSuccessResponse(null);
      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.success).toBe(true);
    });
  });

  describe('getUserId', () => {
    it('should extract user ID from header', () => {
      const request = new NextRequest('http://localhost/test', {
        headers: { 'x-user-id': 'user123' },
      });
      expect(getUserId(request)).toBe('user123');
    });

    it('should return null when no user ID', () => {
      const request = new NextRequest('http://localhost/test');
      expect(getUserId(request)).toBeNull();
    });

    it('should handle empty header', () => {
      const request = new NextRequest('http://localhost/test', {
        headers: { 'x-user-id': '' },
      });
      // Empty string header returns null (falsy check in getUserId)
      expect(getUserId(request)).toBeFalsy();
    });
  });

  describe('getWorkspaceId', () => {
    it('should extract workspace ID from header', () => {
      const request = new NextRequest('http://localhost/test', {
        headers: { 'x-workspace-id': 'ws123' },
      });
      expect(getWorkspaceId(request)).toBe('ws123');
    });

    it('should extract workspace ID from query param', () => {
      const request = new NextRequest('http://localhost/test?workspaceId=ws456');
      expect(getWorkspaceId(request)).toBe('ws456');
    });

    it('should prefer header over query param', () => {
      const request = new NextRequest('http://localhost/test?workspaceId=ws-query', {
        headers: { 'x-workspace-id': 'ws-header' },
      });
      expect(getWorkspaceId(request)).toBe('ws-header');
    });

    it('should return null when not present', () => {
      const request = new NextRequest('http://localhost/test');
      expect(getWorkspaceId(request)).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when user ID present', () => {
      const request = new NextRequest('http://localhost/test', {
        headers: { 'x-user-id': 'user123' },
      });
      expect(isAuthenticated(request)).toBe(true);
    });

    it('should return false when no user ID', () => {
      const request = new NextRequest('http://localhost/test');
      expect(isAuthenticated(request)).toBe(false);
    });

    it('should return false for empty user ID', () => {
      const request = new NextRequest('http://localhost/test', {
        headers: { 'x-user-id': '' },
      });
      // Empty string is falsy, so not authenticated
      const result = isAuthenticated(request);
      expect(result).toBeFalsy();
    });
  });

  describe('getClientIP', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const request = new NextRequest('http://localhost/test', {
        headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
      });
      expect(getClientIP(request)).toBe('192.168.1.1');
    });

    it('should extract IP from x-real-ip header', () => {
      const request = new NextRequest('http://localhost/test', {
        headers: { 'x-real-ip': '192.168.1.2' },
      });
      expect(getClientIP(request)).toBe('192.168.1.2');
    });

    it('should return unknown when no IP headers', () => {
      const request = new NextRequest('http://localhost/test');
      expect(getClientIP(request)).toBe('unknown');
    });

    it('should prefer x-forwarded-for over x-real-ip', () => {
      const request = new NextRequest('http://localhost/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'x-real-ip': '192.168.1.2',
        },
      });
      expect(getClientIP(request)).toBe('192.168.1.1');
    });
  });

  describe('logAPIRequest', () => {
    it('should log request details', () => {
      const request = new NextRequest('http://localhost/api/test', {
        method: 'POST',
        headers: { 'user-agent': 'Test Browser' },
      });
      const response = createSuccessResponse({ ok: true });
      logAPIRequest(request, response, 150);

      expect(consoleOutput.length).toBeGreaterThan(0);
      expect(consoleOutput[0][0]).toBe('[API Request]');
      expect(consoleOutput[0][1].method).toBe('POST');
      expect(consoleOutput[0][1].duration).toBe(150);
    });

    it('should include metadata when provided', () => {
      const request = new NextRequest('http://localhost/test');
      const response = createSuccessResponse({});
      logAPIRequest(request, response, 100, { custom: 'data' });

      expect(consoleOutput[0][1].custom).toBe('data');
    });

    it('should log status code', () => {
      const request = new NextRequest('http://localhost/test');
      const response = createErrorResponse('Error', 500);
      logAPIRequest(request, response, 200);

      expect(consoleOutput[0][1].status).toBe(500);
    });

    it('should include client IP', () => {
      const request = new NextRequest('http://localhost/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });
      const response = createSuccessResponse({});
      logAPIRequest(request, response, 50);

      expect(consoleOutput[0][1].ip).toBe('192.168.1.1');
    });

    it('should include user and workspace IDs when available', () => {
      const request = new NextRequest('http://localhost/test', {
        headers: {
          'x-user-id': 'user123',
          'x-workspace-id': 'ws456',
        },
      });
      const response = createSuccessResponse({});
      logAPIRequest(request, response, 75);

      expect(consoleOutput[0][1].userId).toBe('user123');
      expect(consoleOutput[0][1].workspaceId).toBe('ws456');
    });
  });
});
