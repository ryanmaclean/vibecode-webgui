/**
 * Comprehensive tests for error tracking middleware
 * Tests for automatic error tracking in Next.js API routes
 */

import {
  withErrorTracking,
  withJsonErrorTracking,
  withMethodErrorTracking,
  trackApiRouteError,
  trackValidationError,
  trackAuthError,
  trackAuthorizationError,
  trackRateLimitError,
} from '@/middleware/error-tracking-middleware';
import { NextRequest, NextResponse } from 'next/server';
import { trackApiError } from '@/lib/monitoring/error-tracking';

// Mock dependencies
jest.mock('@/lib/monitoring/error-tracking', () => ({
  trackApiError: jest.fn(),
  trackError: jest.fn(),
}));

describe('Error Tracking Middleware', () => {
  let mockRequest: NextRequest;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {
      url: 'http://localhost:3000/api/test',
      method: 'POST',
      headers: new Map([
        ['user-agent', 'Test Agent'],
        ['x-forwarded-for', '192.168.1.1'],
        ['referer', 'http://localhost:3000'],
        ['content-type', 'application/json'],
      ]),
      text: jest.fn().mockResolvedValue('{"data": "test"}'),
    } as any;

    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleInfoSpy.mockRestore();
  });

  describe('withErrorTracking', () => {
    it('should execute handler successfully without tracking', async () => {
      const handler = jest.fn().mockResolvedValue(NextResponse.json({ success: true }));
      const wrappedHandler = withErrorTracking(handler);

      const response = await wrappedHandler(mockRequest);

      expect(handler).toHaveBeenCalledWith(mockRequest, undefined);
      expect(response.status).toBe(200);
      expect(trackApiError).not.toHaveBeenCalled();
    });

    it('should track successful requests when trackSuccess is enabled', async () => {
      const handler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true }, { status: 200 })
      );
      const wrappedHandler = withErrorTracking(handler, { trackSuccess: true });

      await wrappedHandler(mockRequest);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('API Success')
      );
    });

    it('should track errors when handler throws', async () => {
      const error = new Error('Test error');
      const handler = jest.fn().mockRejectedValue(error);
      const wrappedHandler = withErrorTracking(handler);

      await expect(wrappedHandler(mockRequest)).rejects.toThrow('Test error');

      expect(trackApiError).toHaveBeenCalledWith(
        '/api/test',
        500,
        error,
        expect.objectContaining({
          method: 'POST',
          url: 'http://localhost:3000/api/test',
          pathname: '/api/test',
          userAgent: 'Test Agent',
          ip: '192.168.1.1',
        })
      );
    });

    it('should include request body when includeRequestBody is true', async () => {
      const error = new Error('Test error');
      const handler = jest.fn().mockRejectedValue(error);
      const wrappedHandler = withErrorTracking(handler, { includeRequestBody: true });

      await expect(wrappedHandler(mockRequest)).rejects.toThrow();

      expect(trackApiError).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.any(Error),
        expect.objectContaining({
          requestBody: '{"data": "test"}',
        })
      );
    });

    it('should not include request body for GET requests', async () => {
      mockRequest.method = 'GET';
      const error = new Error('Test error');
      const handler = jest.fn().mockRejectedValue(error);
      const wrappedHandler = withErrorTracking(handler, { includeRequestBody: true });

      await expect(wrappedHandler(mockRequest)).rejects.toThrow();

      expect(trackApiError).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.any(Error),
        expect.not.objectContaining({
          requestBody: expect.anything(),
        })
      );
    });

    it('should respect maxBodySize limit', async () => {
      mockRequest.text = jest.fn().mockResolvedValue('x'.repeat(20000));
      const error = new Error('Test error');
      const handler = jest.fn().mockRejectedValue(error);
      const wrappedHandler = withErrorTracking(handler, {
        includeRequestBody: true,
        maxBodySize: 1024,
      });

      await expect(wrappedHandler(mockRequest)).rejects.toThrow();

      expect(trackApiError).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.any(Error),
        expect.not.objectContaining({
          requestBody: expect.anything(),
        })
      );
    });

    it('should call custom error handler when provided', async () => {
      const error = new Error('Test error');
      const onError = jest.fn();
      const handler = jest.fn().mockRejectedValue(error);
      const wrappedHandler = withErrorTracking(handler, { onError });

      await expect(wrappedHandler(mockRequest)).rejects.toThrow();

      expect(onError).toHaveBeenCalledWith(error, mockRequest);
    });

    it('should handle custom error handler failures gracefully', async () => {
      const error = new Error('Test error');
      const onError = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      const handler = jest.fn().mockRejectedValue(error);
      const wrappedHandler = withErrorTracking(handler, { onError });

      await expect(wrappedHandler(mockRequest)).rejects.toThrow('Test error');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in custom error handler:',
        expect.any(Error)
      );
    });

    it('should extract pathname correctly from URL', async () => {
      const error = new Error('Test error');
      const handler = jest.fn().mockRejectedValue(error);
      const wrappedHandler = withErrorTracking(handler);

      await expect(wrappedHandler(mockRequest)).rejects.toThrow();

      expect(trackApiError).toHaveBeenCalledWith(
        '/api/test',
        expect.any(Number),
        expect.any(Error),
        expect.any(Object)
      );
    });

    it('should handle missing headers gracefully', async () => {
      mockRequest.headers = new Map() as any;
      const error = new Error('Test error');
      const handler = jest.fn().mockRejectedValue(error);
      const wrappedHandler = withErrorTracking(handler);

      await expect(wrappedHandler(mockRequest)).rejects.toThrow();

      expect(trackApiError).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.any(Error),
        expect.objectContaining({
          userAgent: undefined,
          ip: 'unknown',
          referer: undefined,
        })
      );
    });
  });

  describe('withJsonErrorTracking', () => {
    it('should wrap handler and return JSON response', async () => {
      const handler = jest.fn().mockResolvedValue({ data: 'test' });
      const wrappedHandler = withJsonErrorTracking(handler);

      const response = await wrappedHandler(mockRequest);
      const json = await response.json();

      expect(json).toEqual({ data: 'test' });
    });

    it('should return error response when handler throws', async () => {
      const error = new Error('Test error');
      const handler = jest.fn().mockRejectedValue(error);
      const wrappedHandler = withJsonErrorTracking(handler);

      const response = await wrappedHandler(mockRequest);

      expect(response.status).toBe(500);
      const json = await response.json();
      // RFC 7807 Problem Details format
      expect(json.code).toBe('INTERNAL_SERVER_ERROR');
      expect(json.title).toBe('Internal Server Error');
    });

    it('should show error message in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Detailed error');
      const handler = jest.fn().mockRejectedValue(error);
      const wrappedHandler = withJsonErrorTracking(handler);

      const response = await wrappedHandler(mockRequest);
      const json = await response.json();

      // RFC 7807 Problem Details format - detail contains the error message in dev mode
      expect(json.detail).toBe('Detailed error');

      process.env.NODE_ENV = originalEnv;
    });

    it('should hide error message in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Detailed error');
      const handler = jest.fn().mockRejectedValue(error);
      const wrappedHandler = withJsonErrorTracking(handler);

      const response = await wrappedHandler(mockRequest);
      const json = await response.json();

      // RFC 7807 Problem Details format - detail contains generic message in production
      expect(json.detail).toBe('Something went wrong');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('withMethodErrorTracking', () => {
    it('should allow requests with allowed methods', async () => {
      mockRequest.method = 'GET';
      const handler = jest.fn().mockResolvedValue(NextResponse.json({ success: true }));
      const wrappedHandler = withMethodErrorTracking(handler, ['GET', 'POST']);

      const response = await wrappedHandler(mockRequest);

      expect(handler).toHaveBeenCalledWith(mockRequest, undefined);
      expect(response.status).toBe(200);
    });

    it('should reject requests with disallowed methods', async () => {
      mockRequest.method = 'DELETE';
      const handler = jest.fn().mockResolvedValue(NextResponse.json({ success: true }));
      const wrappedHandler = withMethodErrorTracking(handler, ['GET', 'POST']);

      const response = await wrappedHandler(mockRequest);

      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(405);
      const json = await response.json();
      // RFC 7807 Problem Details format
      expect(json.code).toBe('METHOD_NOT_ALLOWED');
      expect(json.title).toBe('Method Not Allowed');
    });

    it('should track method not allowed errors', async () => {
      mockRequest.method = 'PUT';
      const handler = jest.fn();
      const wrappedHandler = withMethodErrorTracking(handler, ['GET']);

      await wrappedHandler(mockRequest);

      expect(trackApiError).toHaveBeenCalledWith(
        '/api/test',
        405,
        expect.any(Error),
        expect.objectContaining({
          method: 'PUT',
          allowedMethods: ['GET'],
        })
      );
    });
  });

  describe('utility tracking functions', () => {
    it('should track API route errors', () => {
      const error = new Error('Test error');
      trackApiRouteError(mockRequest, error, 500, { custom: 'data' });

      expect(trackApiError).toHaveBeenCalledWith(
        '/api/test',
        500,
        error,
        expect.objectContaining({
          method: 'POST',
          custom: 'data',
        })
      );
    });

    it('should track validation errors', () => {
      const error = new Error('Invalid field');
      trackValidationError(mockRequest, 'email', error, { value: 'invalid' });

      expect(trackApiError).toHaveBeenCalledWith(
        '/api/test',
        400,
        error,
        expect.objectContaining({
          validation_field: 'email',
          error_type: 'validation',
          value: 'invalid',
        })
      );
    });

    it('should track authentication errors', () => {
      const error = new Error('Unauthorized');
      trackAuthError(mockRequest, error, { reason: 'token_expired' });

      expect(trackApiError).toHaveBeenCalledWith(
        '/api/test',
        401,
        error,
        expect.objectContaining({
          error_type: 'authentication',
          reason: 'token_expired',
        })
      );
    });

    it('should track authorization errors', () => {
      const error = new Error('Forbidden');
      trackAuthorizationError(mockRequest, error, { resource: 'workspace' });

      expect(trackApiError).toHaveBeenCalledWith(
        '/api/test',
        403,
        error,
        expect.objectContaining({
          error_type: 'authorization',
          resource: 'workspace',
        })
      );
    });

    it('should track rate limit errors', () => {
      const error = new Error('Rate limit exceeded');
      trackRateLimitError(mockRequest, error, { limit: 100 });

      expect(trackApiError).toHaveBeenCalledWith(
        '/api/test',
        429,
        error,
        expect.objectContaining({
          error_type: 'rate_limit',
          limit: 100,
        })
      );
    });
  });
});
