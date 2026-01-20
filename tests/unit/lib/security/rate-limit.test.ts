/**
 * Unit Tests for Rate Limiting Implementation
 * Tests sliding window algorithm, distributed coordination, and header injection
 */

import { jest } from '@jest/globals'
import { NextRequest, NextResponse } from 'next/server'

// Mock dependencies
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/cache/valkey-client', () => ({
  cache: {
    incr: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  },
  CacheTTL: {},
}))

import * as rateLimit from '@/lib/security/rate-limit'
import { getServerSession } from 'next-auth'
import { cache } from '@/lib/cache/valkey-client'

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>
const mockCacheIncr = cache.incr as jest.MockedFunction<typeof cache.incr>
const mockCacheGet = cache.get as jest.MockedFunction<typeof cache.get>
const mockCacheDel = cache.del as jest.MockedFunction<typeof cache.del>

describe('Rate Limiting Implementation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('RATE_LIMITS Configuration', () => {
    it('should provide strict rate limit', () => {
      expect(rateLimit.RATE_LIMITS.STRICT).toEqual({
        maxRequests: 5,
        windowSeconds: 60,
        skipAuthenticated: false,
        message: expect.any(String),
      })
    })

    it('should provide auth rate limit', () => {
      expect(rateLimit.RATE_LIMITS.AUTH).toEqual({
        maxRequests: 10,
        windowSeconds: 300,
        skipAuthenticated: false,
        message: expect.any(String),
      })
    })

    it('should provide API rate limit', () => {
      expect(rateLimit.RATE_LIMITS.API).toEqual({
        maxRequests: 100,
        windowSeconds: 60,
        skipAuthenticated: true,
        message: expect.any(String),
      })
    })

    it('should provide upload rate limit', () => {
      expect(rateLimit.RATE_LIMITS.UPLOAD).toEqual({
        maxRequests: 5,
        windowSeconds: 300,
        skipAuthenticated: false,
        message: expect.any(String),
      })
    })
  })

  describe('applyRateLimit', () => {
    it('should allow requests within limit', async () => {
      mockCacheIncr.mockResolvedValue(1)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '192.168.1.1',
        },
      })

      const result = await rateLimit.applyRateLimit(
        request,
        { maxRequests: 10, windowSeconds: 60 },
        'test-endpoint'
      )

      expect(result.success).toBe(true)
      expect(result.remaining).toBe(9)
      expect(result.current).toBe(1)
      expect(result.limit).toBe(10)
    })

    it('should block requests exceeding limit', async () => {
      mockCacheIncr.mockResolvedValue(11)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '192.168.1.1',
        },
      })

      const result = await rateLimit.applyRateLimit(
        request,
        { maxRequests: 10, windowSeconds: 60 },
        'test-endpoint'
      )

      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.errorResponse).toBeDefined()
    })

    it('should skip rate limiting for authenticated users when configured', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', email: 'test@example.com' },
        expires: '2024-12-31',
      } as any)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
      })

      const result = await rateLimit.applyRateLimit(
        request,
        { maxRequests: 10, windowSeconds: 60, skipAuthenticated: true },
        'test-endpoint'
      )

      expect(result.success).toBe(true)
      expect(mockCacheIncr).not.toHaveBeenCalled()
    })

    it('should not skip rate limiting when skipAuthenticated is false', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123' },
        expires: '2024-12-31',
      } as any)
      mockCacheIncr.mockResolvedValue(1)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
      })

      const result = await rateLimit.applyRateLimit(
        request,
        { maxRequests: 10, windowSeconds: 60, skipAuthenticated: false },
        'test-endpoint'
      )

      expect(result.success).toBe(true)
      expect(mockCacheIncr).toHaveBeenCalled()
    })

    it('should extract IP from x-forwarded-for header', async () => {
      mockCacheIncr.mockResolvedValue(1)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.1, 198.51.100.1',
        },
      })

      await rateLimit.applyRateLimit(
        request,
        { maxRequests: 10, windowSeconds: 60 },
        'test'
      )

      expect(mockCacheIncr).toHaveBeenCalledWith(
        expect.stringContaining('203.0.113.1'),
        60
      )
    })

    it('should extract IP from x-real-ip header', async () => {
      mockCacheIncr.mockResolvedValue(1)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'x-real-ip': '198.51.100.50',
        },
      })

      await rateLimit.applyRateLimit(
        request,
        { maxRequests: 10, windowSeconds: 60 },
        'test'
      )

      expect(mockCacheIncr).toHaveBeenCalledWith(
        expect.stringContaining('198.51.100.50'),
        60
      )
    })

    it('should extract IP from cf-connecting-ip header', async () => {
      mockCacheIncr.mockResolvedValue(1)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'cf-connecting-ip': '203.0.113.100',
        },
      })

      await rateLimit.applyRateLimit(
        request,
        { maxRequests: 10, windowSeconds: 60 },
        'test'
      )

      expect(mockCacheIncr).toHaveBeenCalledWith(
        expect.stringContaining('203.0.113.100'),
        60
      )
    })

    it('should use "unknown" when no IP headers present', async () => {
      mockCacheIncr.mockResolvedValue(1)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
      })

      await rateLimit.applyRateLimit(
        request,
        { maxRequests: 10, windowSeconds: 60 },
        'test'
      )

      expect(mockCacheIncr).toHaveBeenCalledWith(
        expect.stringContaining('unknown'),
        60
      )
    })

    it('should use sliding window keys', async () => {
      mockCacheIncr.mockResolvedValue(1)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '192.168.1.1',
        },
      })

      await rateLimit.applyRateLimit(
        request,
        { maxRequests: 10, windowSeconds: 60 },
        'test-prefix'
      )

      expect(mockCacheIncr).toHaveBeenCalledWith(
        expect.stringMatching(/^ratelimit:test-prefix:192\.168\.1\.1:\d+$/),
        60
      )
    })

    it('should return 429 error response when rate limited', async () => {
      mockCacheIncr.mockResolvedValue(11)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
      })

      const result = await rateLimit.applyRateLimit(
        request,
        { maxRequests: 10, windowSeconds: 60, message: 'Custom error' },
        'test'
      )

      expect(result.success).toBe(false)
      expect(result.errorResponse).toBeDefined()

      if (result.errorResponse) {
        expect(result.errorResponse.status).toBe(429)
        const data = await result.errorResponse.json()
        expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED')
        expect(data.error.message).toBe('Custom error')
      }
    })

    it('should include rate limit headers in error response', async () => {
      mockCacheIncr.mockResolvedValue(11)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
      })

      const result = await rateLimit.applyRateLimit(
        request,
        { maxRequests: 10, windowSeconds: 60 },
        'test'
      )

      if (result.errorResponse) {
        expect(result.errorResponse.headers.get('X-RateLimit-Limit')).toBe('10')
        expect(result.errorResponse.headers.get('X-RateLimit-Remaining')).toBe('0')
        expect(result.errorResponse.headers.get('Retry-After')).toBe('60')
      }
    })

    it('should handle cache errors gracefully', async () => {
      mockCacheIncr.mockRejectedValue(new Error('Cache unavailable'))
      const errorSpy = jest.spyOn(console, 'error').mockImplementation()

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
      })

      const result = await rateLimit.applyRateLimit(
        request,
        { maxRequests: 10, windowSeconds: 60 },
        'test'
      )

      // Should allow request when cache fails
      expect(result.success).toBe(true)
      expect(errorSpy).toHaveBeenCalled()

      errorSpy.mockRestore()
    })
  })

  describe('withRateLimit', () => {
    it('should wrap handler with rate limiting', async () => {
      mockCacheIncr.mockResolvedValue(1)

      const handler = jest.fn(async () => NextResponse.json({ data: 'success' }))
      const wrappedHandler = rateLimit.withRateLimit(
        { maxRequests: 10, windowSeconds: 60 },
        'test'
      )(handler)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
      })

      await wrappedHandler(request)

      expect(handler).toHaveBeenCalled()
    })

    it('should inject rate limit headers into response', async () => {
      mockCacheIncr.mockResolvedValue(3)

      const handler = jest.fn(async () => NextResponse.json({ data: 'success' }))
      const wrappedHandler = rateLimit.withRateLimit(
        { maxRequests: 10, windowSeconds: 60 },
        'test'
      )(handler)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
      })

      const response = await wrappedHandler(request)

      expect(response.headers.get('X-RateLimit-Limit')).toBe('10')
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('7')
      expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy()
    })

    it('should return error response when rate limited', async () => {
      mockCacheIncr.mockResolvedValue(11)

      const handler = jest.fn(async () => NextResponse.json({ data: 'success' }))
      const wrappedHandler = rateLimit.withRateLimit(
        { maxRequests: 10, windowSeconds: 60 },
        'test'
      )(handler)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
      })

      const response = await wrappedHandler(request)

      expect(handler).not.toHaveBeenCalled()
      expect(response.status).toBe(429)
    })

    it('should pass additional arguments to handler', async () => {
      mockCacheIncr.mockResolvedValue(1)

      const handler = jest.fn(async (req, ...args) => NextResponse.json({ args }))
      const wrappedHandler = rateLimit.withRateLimit(
        { maxRequests: 10, windowSeconds: 60 },
        'test'
      )(handler)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
      })

      await wrappedHandler(request, 'arg1', 'arg2')

      expect(handler).toHaveBeenCalledWith(request, 'arg1', 'arg2')
    })
  })

  describe('clearRateLimit', () => {
    it('should clear rate limit for identifier', async () => {
      mockCacheDel.mockResolvedValue(1)

      await rateLimit.clearRateLimit('test-prefix', '192.168.1.1', 60)

      expect(mockCacheDel).toHaveBeenCalledWith(
        expect.stringMatching(/^ratelimit:test-prefix:192\.168\.1\.1:\d+$/)
      )
    })

    it('should handle cache errors during clear', async () => {
      mockCacheDel.mockRejectedValue(new Error('Cache error'))

      await expect(
        rateLimit.clearRateLimit('test', '192.168.1.1', 60)
      ).rejects.toThrow()
    })
  })

  describe('getRateLimitStatus', () => {
    it('should return current rate limit status', async () => {
      mockCacheGet.mockResolvedValue(5)

      const status = await rateLimit.getRateLimitStatus(
        'test-prefix',
        '192.168.1.1',
        60,
        10
      )

      expect(status).toEqual({
        current: 5,
        remaining: 5,
        limit: 10,
        resetTime: expect.any(Number),
      })
    })

    it('should handle non-existent rate limit', async () => {
      mockCacheGet.mockResolvedValue(null)

      const status = await rateLimit.getRateLimitStatus(
        'test-prefix',
        '192.168.1.1',
        60,
        10
      )

      expect(status).toEqual({
        current: 0,
        remaining: 10,
        limit: 10,
        resetTime: expect.any(Number),
      })
    })

    it('should handle cache errors gracefully', async () => {
      mockCacheGet.mockRejectedValue(new Error('Cache error'))
      const errorSpy = jest.spyOn(console, 'error').mockImplementation()

      const status = await rateLimit.getRateLimitStatus('test', '192.168.1.1', 60, 10)

      expect(status.current).toBe(0)
      expect(status.remaining).toBe(10)
      expect(errorSpy).toHaveBeenCalled()

      errorSpy.mockRestore()
    })

    it('should calculate remaining correctly', async () => {
      mockCacheGet.mockResolvedValue(8)

      const status = await rateLimit.getRateLimitStatus('test', '192.168.1.1', 60, 10)

      expect(status.remaining).toBe(2)
    })

    it('should not return negative remaining', async () => {
      mockCacheGet.mockResolvedValue(15)

      const status = await rateLimit.getRateLimitStatus('test', '192.168.1.1', 60, 10)

      expect(status.remaining).toBe(0)
    })
  })

  describe('Sliding Window Algorithm', () => {
    it('should use time-aligned window keys', async () => {
      mockCacheIncr.mockResolvedValue(1)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: { 'x-forwarded-for': '192.168.1.1' },
      })

      // First request at time 0
      await rateLimit.applyRateLimit(request, { maxRequests: 10, windowSeconds: 60 }, 'test')

      const firstKey = mockCacheIncr.mock.calls[0][0]

      // Advance time by 30 seconds (within same window)
      jest.advanceTimersByTime(30 * 1000)

      await rateLimit.applyRateLimit(request, { maxRequests: 10, windowSeconds: 60 }, 'test')

      const secondKey = mockCacheIncr.mock.calls[1][0]

      // Should use same key within window
      expect(firstKey).toBe(secondKey)
    })

    it('should use different keys across windows', async () => {
      mockCacheIncr.mockResolvedValue(1)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: { 'x-forwarded-for': '192.168.1.1' },
      })

      await rateLimit.applyRateLimit(request, { maxRequests: 10, windowSeconds: 60 }, 'test')

      const firstKey = mockCacheIncr.mock.calls[0][0]

      // Advance time by 61 seconds (new window)
      jest.advanceTimersByTime(61 * 1000)

      await rateLimit.applyRateLimit(request, { maxRequests: 10, windowSeconds: 60 }, 'test')

      const secondKey = mockCacheIncr.mock.calls[1][0]

      // Should use different key in new window
      expect(firstKey).not.toBe(secondKey)
    })
  })
})
