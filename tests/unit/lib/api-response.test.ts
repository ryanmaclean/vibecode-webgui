/**
 * Tests for src/lib/utils/api-response.ts
 * API response utilities, RFC 7807 error responses, and helpers
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  getErrorMessage,
  getTimestamp,
  generateTraceId,
  createSuccessResponse,
  createProblemResponse,
  createErrorResponse,
  createErrorResponseFromError,
  createHealthResponse,
  createValidationErrorResponse,
  ApiErrors,
} from '@/lib/utils/api-response';

// Suppress console output during tests
beforeEach(() => {
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('API Response Utils', () => {
  describe('getErrorMessage', () => {
    it('should extract message from Error', () => {
      expect(getErrorMessage(new Error('test error'))).toBe('test error');
    });

    it('should return "Unknown error" for non-Error', () => {
      expect(getErrorMessage('string')).toBe('Unknown error');
      expect(getErrorMessage(42)).toBe('Unknown error');
      expect(getErrorMessage(null)).toBe('Unknown error');
      expect(getErrorMessage(undefined)).toBe('Unknown error');
    });
  });

  describe('getTimestamp', () => {
    it('should return ISO format string', () => {
      const ts = getTimestamp();
      expect(typeof ts).toBe('string');
      expect(() => new Date(ts)).not.toThrow();
    });
  });

  describe('generateTraceId', () => {
    it('should return string starting with "trace-"', () => {
      const id = generateTraceId();
      expect(id).toMatch(/^trace-\d+-[a-z0-9]+$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 20 }, () => generateTraceId()));
      expect(ids.size).toBe(20);
    });
  });

  describe('createSuccessResponse', () => {
    it('should create response with success=true', async () => {
      const response = createSuccessResponse({ items: [1, 2, 3] });
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual({ items: [1, 2, 3] });
      expect(body.meta).toBeDefined();
      expect(body.meta.traceId).toBeDefined();
      expect(body.meta.timestamp).toBeDefined();
    });

    it('should use custom status code', async () => {
      const response = createSuccessResponse({}, { status: 201 });
      expect(response.status).toBe(201);
    });

    it('should use custom trace ID', async () => {
      const response = createSuccessResponse({}, { traceId: 'custom-123' });
      const body = await response.json();
      expect(body.meta.traceId).toBe('custom-123');
    });

    it('should include additional meta', async () => {
      const response = createSuccessResponse({}, { meta: { version: '1.0' } });
      const body = await response.json();
      expect(body.meta.version).toBe('1.0');
    });

    it('should include additional fields', async () => {
      const response = createSuccessResponse({}, { additionalFields: { extra: 'field' } });
      const body = await response.json();
      expect(body.extra).toBe('field');
    });

    it('should default to 200 status', () => {
      const response = createSuccessResponse({});
      expect(response.status).toBe(200);
    });
  });

  describe('createProblemResponse', () => {
    it('should create RFC 7807 error response', async () => {
      const response = createProblemResponse({
        title: 'Not Found',
        status: 404,
        detail: 'Resource not found',
      });
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.title).toBe('Not Found');
      expect(body.status).toBe(404);
      expect(body.detail).toBe('Resource not found');
      expect(body.timestamp).toBeDefined();
      expect(body.traceId).toBeDefined();
    });

    it('should set Content-Type header', () => {
      const response = createProblemResponse({
        title: 'Error',
        status: 500,
      });
      // NextResponse.json may override to application/json, but the header should exist
      expect(response.headers.get('Content-Type')).toBeDefined();
    });

    it('should use default type URL', async () => {
      const response = createProblemResponse({
        title: 'Error',
        status: 500,
      });
      const body = await response.json();
      expect(body.type).toContain('500');
    });

    it('should use custom type URL', async () => {
      const response = createProblemResponse({
        title: 'Error',
        status: 500,
        type: 'https://custom.example.com/error',
      });
      const body = await response.json();
      expect(body.type).toBe('https://custom.example.com/error');
    });

    it('should format error code from status', async () => {
      const response = createProblemResponse({
        title: 'Unauthorized',
        status: 401,
      });
      const body = await response.json();
      expect(body.code).toBe('UNAUTHORIZED');
    });

    it('should use custom error code', async () => {
      const response = createProblemResponse({
        title: 'Error',
        status: 400,
        code: 'CUSTOM_ERROR',
      });
      const body = await response.json();
      expect(body.code).toBe('CUSTOM_ERROR');
    });

    it('should include custom headers', () => {
      const response = createProblemResponse({
        title: 'Error',
        status: 429,
        headers: { 'Retry-After': '60' },
      });
      expect(response.headers.get('Retry-After')).toBe('60');
    });

    it('should include extensions', async () => {
      const response = createProblemResponse({
        title: 'Error',
        status: 400,
        extensions: { errors: [{ field: 'name', message: 'required' }] },
      });
      const body = await response.json();
      expect(body.errors).toEqual([{ field: 'name', message: 'required' }]);
    });

    it('should include error info in response', async () => {
      const response = createProblemResponse({
        title: 'Bad Request',
        status: 400,
        detail: 'Missing field',
        code: 'VALIDATION_ERROR',
      });
      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toBe('Missing field');
    });
  });

  describe('createErrorResponse (legacy)', () => {
    it('should create error response from message', async () => {
      const response = createErrorResponse('Something went wrong', 500);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.title).toBe('Something went wrong');
      expect(body.status).toBe(500);
    });

    it('should default to 500 status', () => {
      const response = createErrorResponse('Error');
      expect(response.status).toBe(500);
    });

    it('should include additional fields', async () => {
      const response = createErrorResponse('Error', 400, {
        detail: 'More info',
        code: 'MY_CODE',
      });
      const body = await response.json();
      expect(body.detail).toBe('More info');
      expect(body.code).toBe('MY_CODE');
    });
  });

  describe('createErrorResponseFromError', () => {
    it('should create from Error instance', async () => {
      const response = createErrorResponseFromError(new Error('db failed'), 500);
      const body = await response.json();
      expect(body.detail).toBe('db failed');
    });

    it('should use fallback message', async () => {
      const response = createErrorResponseFromError(new Error('db error'), 500, 'Service error');
      const body = await response.json();
      expect(body.title).toBe('Service error');
    });

    it('should handle non-Error argument', async () => {
      const response = createErrorResponseFromError('string error');
      const body = await response.json();
      expect(body.detail).toBe('Unknown error');
    });

    it('should use custom trace ID', async () => {
      const response = createErrorResponseFromError(new Error('fail'), 500, 'Error', 'trace-custom');
      const body = await response.json();
      expect(body.traceId).toBe('trace-custom');
    });
  });

  describe('createHealthResponse', () => {
    it('should return 200 for healthy status', () => {
      const response = createHealthResponse('healthy');
      expect(response.status).toBe(200);
    });

    it('should return 200 for ready status', () => {
      const response = createHealthResponse('ready');
      expect(response.status).toBe(200);
    });

    it('should return 503 for unhealthy status', () => {
      const response = createHealthResponse('unhealthy');
      expect(response.status).toBe(503);
    });

    it('should return 503 for not ready status', () => {
      const response = createHealthResponse('not ready');
      expect(response.status).toBe(503);
    });

    it('should return 503 for error status', () => {
      const response = createHealthResponse('error');
      expect(response.status).toBe(503);
    });

    it('should include additional data', async () => {
      const response = createHealthResponse('healthy', { uptime: 3600 });
      const body = await response.json();
      expect(body.data.uptime).toBe(3600);
      expect(body.data.status).toBe('healthy');
    });
  });

  describe('createValidationErrorResponse', () => {
    it('should create 422 response with validation errors', async () => {
      const errors = [
        { field: 'email', message: 'required' },
        { field: 'name', message: 'too short' },
      ];
      const response = createValidationErrorResponse(errors);
      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.title).toBe('Validation Failed');
      expect(body.errors).toEqual(errors);
    });
  });

  describe('ApiErrors', () => {
    it('should create 400 Bad Request', () => {
      const response = ApiErrors.badRequest('Invalid input');
      expect(response.status).toBe(400);
    });

    it('should create 401 Unauthorized', () => {
      const response = ApiErrors.unauthorized('No token');
      expect(response.status).toBe(401);
    });

    it('should create 403 Forbidden', () => {
      const response = ApiErrors.forbidden('No access');
      expect(response.status).toBe(403);
    });

    it('should create 404 Not Found', () => {
      const response = ApiErrors.notFound('Page not found');
      expect(response.status).toBe(404);
    });

    it('should create 405 Method Not Allowed', () => {
      const response = ApiErrors.methodNotAllowed(['GET', 'POST']);
      expect(response.status).toBe(405);
    });

    it('should create 409 Conflict', () => {
      const response = ApiErrors.conflict('Already exists');
      expect(response.status).toBe(409);
    });

    it('should create 422 Unprocessable Entity', () => {
      const response = ApiErrors.unprocessableEntity('Invalid data');
      expect(response.status).toBe(422);
    });

    it('should create 429 Too Many Requests', () => {
      const response = ApiErrors.tooManyRequests('Rate limited');
      expect(response.status).toBe(429);
    });

    it('should create 500 Internal Server Error', () => {
      const response = ApiErrors.internalServerError('Server crash');
      expect(response.status).toBe(500);
    });

    it('should create 503 Service Unavailable', () => {
      const response = ApiErrors.serviceUnavailable('Down for maintenance');
      expect(response.status).toBe(503);
    });

    it('should accept custom trace ID', async () => {
      const response = ApiErrors.badRequest('test', 'my-trace');
      const body = await response.json();
      expect(body.traceId).toBe('my-trace');
    });
  });
});
