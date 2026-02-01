/**
 * Comprehensive tests for rate limiting utilities
 * Tests for distributed rate limiting with Redis/Valkey
 */

import {
  applyRateLimit,
  withRateLimit,
  clearRateLimit,
  getRateLimitStatus,
  RATE_LIMITS,
} from '@/lib/security/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

// Mock dependencies
jest.mock('next-auth');
jest.mock('@/lib/cache/valkey-client', () => ({
  cache: {
    incr: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  },
  CacheTTL: {},
}));

import { cache } from '@/lib/cache/valkey-client';

describe('Rate Limiting', () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {
      url: 'http://localhost:3000/api/test',
      method: 'GET',
      headers: new Map([
        ['x-forwarded-for', '192.168.1.1'],
        ['user-agent', 'Test Agent'],
      ]),
    } as any;

    (getServerSession as jest.Mock).mockResolvedValue(null);
  });

  describe('RATE_LIMITS constants', () => {
    it('should define STRICT rate limit', () => {
      expect(RATE_LIMITS.STRICT).toEqual({
        maxRequests: 5,
        windowSeconds: 60,
        skipAuthenticated: false,
        message: 'Too many requests to this sensitive endpoint',
      });
    });

    it('should define AUTH rate limit', () => {
      expect(RATE_LIMITS.AUTH).toEqual({
        maxRequests: 10,
        windowSeconds: 300,
        skipAuthenticated: false,
        message: 'Too many authentication attempts',
      });
    });

    it('should define API rate limit', () => {
      expect(RATE_LIMITS.API).toEqual({
        maxRequests: 100,
        windowSeconds: 60,
        skipAuthenticated: true,
        message: 'API rate limit exceeded',
      });
    });

    it('should define UPLOAD rate limit', () => {
      expect(RATE_LIMITS.UPLOAD).toEqual({
        maxRequests: 5,
        windowSeconds: 300,
        skipAuthenticated: false,
        message: 'Too many upload attempts',
      });
    });
  });

  describe('applyRateLimit', () => {
    it('should allow requests within rate limit', async () => {
      (cache.incr as jest.Mock).mockResolvedValue(1);

      const result = await applyRateLimit(mockRequest, RATE_LIMITS.API, 'test-endpoint');

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(99);
      expect(result.current).toBe(1);
      expect(result.limit).toBe(100);
    });

    it('should block requests exceeding rate limit', async () => {
      (cache.incr as jest.Mock).mockResolvedValue(101);

      const result = await applyRateLimit(mockRequest, RATE_LIMITS.API, 'test-endpoint');

      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.current).toBe(101);
      expect(result.errorResponse).toBeDefined();
    });

    it('should return proper 429 response when rate limit exceeded', async () => {
      (cache.incr as jest.Mock).mockResolvedValue(6);

      const result = await applyRateLimit(mockRequest, RATE_LIMITS.STRICT, 'sensitive');

      expect(result.success).toBe(false);
      expect(result.errorResponse).toBeDefined();

      const response = result.errorResponse!;
      expect(response.status).toBe(429);

      const json = await response.json();
      expect(json.title).toBe('Rate limit exceeded');
      expect(json.retryAfter).toBe(60);
    });

    it('should include rate limit headers in error response', async () => {
      (cache.incr as jest.Mock).mockResolvedValue(11);

      const result = await applyRateLimit(mockRequest, RATE_LIMITS.AUTH, 'auth');

      const response = result.errorResponse!;
      expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(response.headers.get('Retry-After')).toBe('300');
    });

    it('should skip rate limiting for authenticated users when configured', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: '123' } });

      const result = await applyRateLimit(mockRequest, RATE_LIMITS.API, 'test');

      expect(result.success).toBe(true);
      expect(cache.incr).not.toHaveBeenCalled();
    });

    it('should apply rate limiting for authenticated users when skipAuthenticated is false', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: '123' } });
      (cache.incr as jest.Mock).mockResolvedValue(1);

      const result = await applyRateLimit(mockRequest, RATE_LIMITS.STRICT, 'strict');

      expect(result.success).toBe(true);
      expect(cache.incr).toHaveBeenCalled();
    });

    it('should extract IP from x-forwarded-for header', async () => {
      (cache.incr as jest.Mock).mockResolvedValue(1);

      await applyRateLimit(mockRequest, RATE_LIMITS.API, 'test');

      expect(cache.incr).toHaveBeenCalledWith(
        expect.stringContaining('192.168.1.1'),
        60
      );
    });

    it('should handle multiple IPs in x-forwarded-for', async () => {
      mockRequest.headers = new Map([
        ['x-forwarded-for', '203.0.113.1, 198.51.100.1, 192.168.1.1'],
      ]) as any;
      (cache.incr as jest.Mock).mockResolvedValue(1);

      await applyRateLimit(mockRequest, RATE_LIMITS.API, 'test');

      expect(cache.incr).toHaveBeenCalledWith(
        expect.stringContaining('203.0.113.1'),
        60
      );
    });

    it('should fall back to x-real-ip header', async () => {
      mockRequest.headers = new Map([['x-real-ip', '198.51.100.1']]) as any;
      (cache.incr as jest.Mock).mockResolvedValue(1);

      await applyRateLimit(mockRequest, RATE_LIMITS.API, 'test');

      expect(cache.incr).toHaveBeenCalledWith(
        expect.stringContaining('198.51.100.1'),
        60
      );
    });

    it('should fall back to cf-connecting-ip header', async () => {
      mockRequest.headers = new Map([['cf-connecting-ip', '203.0.113.5']]) as any;
      (cache.incr as jest.Mock).mockResolvedValue(1);

      await applyRateLimit(mockRequest, RATE_LIMITS.API, 'test');

      expect(cache.incr).toHaveBeenCalledWith(
        expect.stringContaining('203.0.113.5'),
        60
      );
    });

    it('should handle cache errors gracefully', async () => {
      (cache.incr as jest.Mock).mockRejectedValue(new Error('Redis connection failed'));

      const result = await applyRateLimit(mockRequest, RATE_LIMITS.API, 'test');

      expect(result.success).toBe(true); // Fail open
      expect(result.remaining).toBe(100);
    });

    it('should handle session check errors gracefully', async () => {
      (getServerSession as jest.Mock).mockRejectedValue(new Error('Session error'));
      (cache.incr as jest.Mock).mockResolvedValue(1);

      const result = await applyRateLimit(mockRequest, RATE_LIMITS.API, 'test');

      expect(result.success).toBe(true);
      expect(cache.incr).toHaveBeenCalled();
    });

    it('should use custom error message when provided', async () => {
      (cache.incr as jest.Mock).mockResolvedValue(6);

      const customConfig = {
        maxRequests: 5,
        windowSeconds: 60,
        message: 'Custom error message',
      };

      const result = await applyRateLimit(mockRequest, customConfig, 'custom');

      const json = await result.errorResponse!.json();
      expect(json.detail).toBe('Custom error message');
    });
  });

  describe('withRateLimit', () => {
    it('should wrap handler with rate limiting', async () => {
      (cache.incr as jest.Mock).mockResolvedValue(1);

      const handler = jest.fn().mockResolvedValue(NextResponse.json({ success: true }));
      const wrappedHandler = withRateLimit(RATE_LIMITS.API, 'test')(handler);

      const response = await wrappedHandler(mockRequest);

      expect(handler).toHaveBeenCalledWith(mockRequest);
      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('99');
    });

    it('should return error response when rate limit exceeded', async () => {
      (cache.incr as jest.Mock).mockResolvedValue(101);

      const handler = jest.fn().mockResolvedValue(NextResponse.json({ success: true }));
      const wrappedHandler = withRateLimit(RATE_LIMITS.API, 'test')(handler);

      const response = await wrappedHandler(mockRequest);

      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(429);
    });

    it('should inject rate limit headers into successful responses', async () => {
      (cache.incr as jest.Mock).mockResolvedValue(5);

      const handler = jest.fn().mockResolvedValue(NextResponse.json({ data: 'test' }));
      const wrappedHandler = withRateLimit(RATE_LIMITS.API, 'endpoint')(handler);

      const response = await wrappedHandler(mockRequest);

      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('95');
      expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
    });
  });

  describe('clearRateLimit', () => {
    it('should clear rate limit for identifier', async () => {
      (cache.del as jest.Mock).mockResolvedValue(undefined);

      await clearRateLimit('test-endpoint', '192.168.1.1', 60);

      expect(cache.del).toHaveBeenCalledWith(expect.stringContaining('192.168.1.1'));
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return current rate limit status', async () => {
      (cache.get as jest.Mock).mockResolvedValue(5);

      const status = await getRateLimitStatus('test', '192.168.1.1', 60, 10);

      expect(status.current).toBe(5);
      expect(status.remaining).toBe(5);
      expect(status.limit).toBe(10);
      expect(status.resetTime).toBeGreaterThan(Date.now());
    });

    it('should handle zero current count', async () => {
      (cache.get as jest.Mock).mockResolvedValue(0);

      const status = await getRateLimitStatus('test', '192.168.1.1', 60, 10);

      expect(status.current).toBe(0);
      expect(status.remaining).toBe(10);
    });

    it('should handle null cache values', async () => {
      (cache.get as jest.Mock).mockResolvedValue(null);

      const status = await getRateLimitStatus('test', '192.168.1.1', 60, 10);

      expect(status.current).toBe(0);
      expect(status.remaining).toBe(10);
    });

    it('should handle cache errors', async () => {
      (cache.get as jest.Mock).mockRejectedValue(new Error('Cache error'));

      const status = await getRateLimitStatus('test', '192.168.1.1', 60, 10);

      expect(status.current).toBe(0);
      expect(status.remaining).toBe(10);
    });

    it('should not return negative remaining count', async () => {
      (cache.get as jest.Mock).mockResolvedValue(15);

      const status = await getRateLimitStatus('test', '192.168.1.1', 60, 10);

      expect(status.remaining).toBe(0);
    });
  });
});
