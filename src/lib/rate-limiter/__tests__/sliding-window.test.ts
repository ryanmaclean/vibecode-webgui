/**
 * Tests for Sliding Window Rate Limiter
 */

import { NextRequest } from 'next/server'
import {
  SlidingWindowRateLimiter,
  createRateLimiter,
  checkRateLimit,
  RateLimitPresets,
  InMemoryStorage,
  getClientIP,
} from '../sliding-window'

// Mock the api-response module
jest.mock('@/lib/utils/api-response', () => ({
  createProblemResponse: jest.fn((options) => {
    const response = new Response(JSON.stringify({
      type: options.type,
      title: options.title,
      status: options.status,
      detail: options.detail,
      code: options.code,
    }), {
      status: options.status,
      headers: {
        'Content-Type': 'application/problem+json',
        ...options.headers,
      },
    })
    return response
  }),
}))

function createMockRequest(ip: string = '127.0.0.1', url: string = 'http://localhost/api/test'): NextRequest {
  const req = new NextRequest(url, {
    headers: {
      'x-forwarded-for': ip,
    },
  })
  return req
}

describe('SlidingWindowRateLimiter', () => {
  describe('getClientIP', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const req = createMockRequest('192.168.1.1')
      expect(getClientIP(req)).toBe('192.168.1.1')
    })

    it('should handle multiple IPs in x-forwarded-for', () => {
      const req = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '10.0.0.1, 192.168.1.1, 172.16.0.1',
        },
      })
      expect(getClientIP(req)).toBe('10.0.0.1')
    })

    it('should fall back to x-real-ip', () => {
      const req = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-real-ip': '10.0.0.2',
        },
      })
      expect(getClientIP(req)).toBe('10.0.0.2')
    })

    it('should fall back to cf-connecting-ip', () => {
      const req = new NextRequest('http://localhost/api/test', {
        headers: {
          'cf-connecting-ip': '10.0.0.3',
        },
      })
      expect(getClientIP(req)).toBe('10.0.0.3')
    })

    it('should return unknown when no IP headers present', () => {
      const req = new NextRequest('http://localhost/api/test')
      expect(getClientIP(req)).toBe('unknown')
    })
  })

  describe('Rate Limiting', () => {
    it('should allow requests under the limit', async () => {
      const limiter = createRateLimiter({
        maxRequests: 5,
        windowSeconds: 60,
      }, 'test-under-limit')

      const req = createMockRequest('1.1.1.1')

      for (let i = 0; i < 5; i++) {
        const result = await limiter.check(req)
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(4 - i)
      }
    })

    it('should block requests over the limit', async () => {
      const limiter = createRateLimiter({
        maxRequests: 3,
        windowSeconds: 60,
      }, 'test-over-limit')

      const req = createMockRequest('2.2.2.2')

      // Use up all requests
      for (let i = 0; i < 3; i++) {
        const result = await limiter.check(req)
        expect(result.allowed).toBe(true)
      }

      // Next request should be blocked
      const result = await limiter.check(req)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfter).toBeGreaterThan(0)
    })

    it('should track different clients separately', async () => {
      const limiter = createRateLimiter({
        maxRequests: 2,
        windowSeconds: 60,
      }, 'test-multi-client')

      const client1 = createMockRequest('3.3.3.1')
      const client2 = createMockRequest('3.3.3.2')

      // Client 1 uses up requests
      await limiter.check(client1)
      await limiter.check(client1)
      const result1 = await limiter.check(client1)
      expect(result1.allowed).toBe(false)

      // Client 2 should still have quota
      const result2 = await limiter.check(client2)
      expect(result2.allowed).toBe(true)
    })

    it('should support custom key generator', async () => {
      const limiter = createRateLimiter({
        maxRequests: 2,
        windowSeconds: 60,
        keyGenerator: () => 'shared-key', // All requests share same key
      }, 'test-custom-key')

      const client1 = createMockRequest('4.4.4.1')
      const client2 = createMockRequest('4.4.4.2')

      await limiter.check(client1)
      await limiter.check(client2)

      // Both clients share quota, so third request is blocked
      const result = await limiter.check(client1)
      expect(result.allowed).toBe(false)
    })

    it('should skip rate limiting when skip function returns true', async () => {
      const limiter = createRateLimiter({
        maxRequests: 1,
        windowSeconds: 60,
        skip: () => true,
      }, 'test-skip')

      const req = createMockRequest('5.5.5.5')

      // Should allow unlimited requests when skip returns true
      for (let i = 0; i < 10; i++) {
        const result = await limiter.check(req)
        expect(result.allowed).toBe(true)
      }
    })
  })

  describe('Rate Limit Headers', () => {
    it('should create correct rate limit headers', async () => {
      const limiter = createRateLimiter({
        maxRequests: 10,
        windowSeconds: 60,
      }, 'test-headers')

      const req = createMockRequest('6.6.6.6')
      const result = await limiter.check(req)

      const headers = limiter.createHeaders(result)

      expect(headers['X-RateLimit-Limit']).toBe('10')
      expect(headers['X-RateLimit-Remaining']).toBe('9')
      expect(headers['X-RateLimit-Reset']).toBeDefined()
    })

    it('should include Retry-After header when rate limited', async () => {
      const limiter = createRateLimiter({
        maxRequests: 1,
        windowSeconds: 60,
      }, 'test-retry-after')

      const req = createMockRequest('7.7.7.7')

      await limiter.check(req) // Use up quota
      const result = await limiter.check(req) // Blocked

      const headers = limiter.createHeaders(result)

      expect(headers['Retry-After']).toBeDefined()
      expect(parseInt(headers['Retry-After'])).toBeGreaterThan(0)
    })
  })

  describe('Rate Limit Response', () => {
    it('should create proper 429 response', async () => {
      const limiter = createRateLimiter({
        maxRequests: 1,
        windowSeconds: 60,
        message: 'Custom rate limit message',
      }, 'test-429')

      const req = createMockRequest('8.8.8.8')

      await limiter.check(req) // Use up quota
      const result = await limiter.check(req) // Blocked

      const response = limiter.createRateLimitResponse(result)

      expect(response.status).toBe(429)
    })
  })

  describe('RateLimitPresets', () => {
    it('should have correct AUTH_STRICT configuration', () => {
      expect(RateLimitPresets.AUTH_STRICT.maxRequests).toBe(5)
      expect(RateLimitPresets.AUTH_STRICT.windowSeconds).toBe(60)
    })

    it('should have correct MFA_VERIFY configuration', () => {
      expect(RateLimitPresets.MFA_VERIFY.maxRequests).toBe(5)
      expect(RateLimitPresets.MFA_VERIFY.windowSeconds).toBe(300)
    })

    it('should have correct UPLOAD configuration', () => {
      expect(RateLimitPresets.UPLOAD.maxRequests).toBe(10)
      expect(RateLimitPresets.UPLOAD.windowSeconds).toBe(300)
    })

    it('should have correct VECTOR_SEARCH configuration', () => {
      expect(RateLimitPresets.VECTOR_SEARCH.maxRequests).toBe(50)
      expect(RateLimitPresets.VECTOR_SEARCH.windowSeconds).toBe(60)
    })
  })

  describe('checkRateLimit helper', () => {
    it('should work as middleware-style rate limiting', async () => {
      const req = createMockRequest('9.9.9.9')

      const result = await checkRateLimit(req, {
        maxRequests: 5,
        windowSeconds: 60,
      }, 'test-middleware')

      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(5)
      expect(result.remaining).toBe(4)
    })
  })
})

describe('InMemoryStorage', () => {
  it('should store and retrieve values', async () => {
    const storage = new InMemoryStorage()

    await storage.set('test-key', { count: 5, timestamp: Date.now() }, 60)
    const result = await storage.get('test-key')

    expect(result).toBeDefined()
    expect(result?.count).toBe(5)

    storage.destroy()
  })

  it('should return null for expired keys', async () => {
    const storage = new InMemoryStorage()

    // Set with very short TTL
    await storage.set('expired-key', { count: 1, timestamp: Date.now() }, 0)

    // Wait a bit for expiration
    await new Promise(resolve => setTimeout(resolve, 10))

    const result = await storage.get('expired-key')
    expect(result).toBeNull()

    storage.destroy()
  })

  it('should increment values atomically', async () => {
    const storage = new InMemoryStorage()

    const count1 = await storage.increment('counter', 60)
    const count2 = await storage.increment('counter', 60)
    const count3 = await storage.increment('counter', 60)

    expect(count1).toBe(1)
    expect(count2).toBe(2)
    expect(count3).toBe(3)

    storage.destroy()
  })
})
