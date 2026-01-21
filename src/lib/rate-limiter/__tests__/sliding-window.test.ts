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
  createRobustKeyGenerator,
  RateLimiterConfigError,
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
  describe('Configuration Validation', () => {
    it('should throw RateLimiterConfigError when maxRequests is zero', () => {
      expect(() => {
        createRateLimiter({
          maxRequests: 0,
          windowSeconds: 60,
        })
      }).toThrow(RateLimiterConfigError)
      expect(() => {
        createRateLimiter({
          maxRequests: 0,
          windowSeconds: 60,
        })
      }).toThrow('maxRequests must be a positive number')
    })

    it('should throw RateLimiterConfigError when maxRequests is negative', () => {
      expect(() => {
        createRateLimiter({
          maxRequests: -5,
          windowSeconds: 60,
        })
      }).toThrow(RateLimiterConfigError)
      expect(() => {
        createRateLimiter({
          maxRequests: -5,
          windowSeconds: 60,
        })
      }).toThrow('maxRequests must be a positive number')
    })

    it('should throw RateLimiterConfigError when maxRequests is not an integer', () => {
      expect(() => {
        createRateLimiter({
          maxRequests: 5.5,
          windowSeconds: 60,
        })
      }).toThrow(RateLimiterConfigError)
      expect(() => {
        createRateLimiter({
          maxRequests: 5.5,
          windowSeconds: 60,
        })
      }).toThrow('maxRequests must be an integer')
    })

    it('should throw RateLimiterConfigError when windowSeconds is zero', () => {
      expect(() => {
        createRateLimiter({
          maxRequests: 5,
          windowSeconds: 0,
        })
      }).toThrow(RateLimiterConfigError)
      expect(() => {
        createRateLimiter({
          maxRequests: 5,
          windowSeconds: 0,
        })
      }).toThrow('windowSeconds must be a positive number')
    })

    it('should throw RateLimiterConfigError when windowSeconds is negative', () => {
      expect(() => {
        createRateLimiter({
          maxRequests: 5,
          windowSeconds: -30,
        })
      }).toThrow(RateLimiterConfigError)
      expect(() => {
        createRateLimiter({
          maxRequests: 5,
          windowSeconds: -30,
        })
      }).toThrow('windowSeconds must be a positive number')
    })

    it('should throw RateLimiterConfigError when windowSeconds is Infinity', () => {
      expect(() => {
        createRateLimiter({
          maxRequests: 5,
          windowSeconds: Infinity,
        })
      }).toThrow(RateLimiterConfigError)
      expect(() => {
        createRateLimiter({
          maxRequests: 5,
          windowSeconds: Infinity,
        })
      }).toThrow('windowSeconds must be a finite number')
    })

    it('should accept valid configuration', () => {
      expect(() => {
        createRateLimiter({
          maxRequests: 100,
          windowSeconds: 60,
        })
      }).not.toThrow()
    })

    it('should accept fractional windowSeconds', () => {
      expect(() => {
        createRateLimiter({
          maxRequests: 10,
          windowSeconds: 0.5,
        })
      }).not.toThrow()
    })
  })

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

    it('should prioritize cf-connecting-ip over other headers', () => {
      const req = new NextRequest('http://localhost/api/test', {
        headers: {
          'cf-connecting-ip': '10.0.0.3',
          'x-forwarded-for': '192.168.1.1',
          'x-real-ip': '172.16.0.1',
        },
      })
      expect(getClientIP(req)).toBe('10.0.0.3')
    })

    it('should handle true-client-ip header', () => {
      const req = new NextRequest('http://localhost/api/test', {
        headers: {
          'true-client-ip': '10.0.0.4',
        },
      })
      expect(getClientIP(req)).toBe('10.0.0.4')
    })

    it('should handle RFC 7239 Forwarded header', () => {
      const req = new NextRequest('http://localhost/api/test', {
        headers: {
          forwarded: 'for=192.0.2.60;proto=http;by=203.0.113.43',
        },
      })
      expect(getClientIP(req)).toBe('192.0.2.60')
    })

    it('should handle Forwarded header with IPv6', () => {
      const req = new NextRequest('http://localhost/api/test', {
        headers: {
          forwarded: 'for="[2001:db8:cafe::17]";proto=https',
        },
      })
      expect(getClientIP(req)).toBe('2001:db8:cafe::17')
    })

    it('should return unknown when no IP headers present', () => {
      const req = new NextRequest('http://localhost/api/test')
      expect(getClientIP(req)).toBe('unknown')
    })
  })

  describe('createRobustKeyGenerator', () => {
    it('should generate key with IP only by default', () => {
      const keyGen = createRobustKeyGenerator()
      const req = createMockRequest('192.168.1.1')
      expect(keyGen(req)).toBe('192.168.1.1')
    })

    it('should include user agent when configured', () => {
      const keyGen = createRobustKeyGenerator({ includeUserAgent: true })
      const req = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      })
      const key = keyGen(req)
      expect(key).toContain('192.168.1.1')
      expect(key).toContain('ua:')
    })

    it('should include session ID when configured', () => {
      const keyGen = createRobustKeyGenerator({ sessionIdHeader: 'x-session-id' })
      const req = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'x-session-id': 'abc123',
        },
      })
      const key = keyGen(req)
      expect(key).toBe('192.168.1.1:sid:abc123')
    })

    it('should include custom identifier when configured', () => {
      const keyGen = createRobustKeyGenerator({
        customIdentifier: (req) => req.headers.get('x-api-key'),
      })
      const req = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'x-api-key': 'key456',
        },
      })
      const key = keyGen(req)
      expect(key).toBe('192.168.1.1:cid:key456')
    })

    it('should combine multiple identifiers', () => {
      const keyGen = createRobustKeyGenerator({
        includeUserAgent: true,
        sessionIdHeader: 'x-session-id',
      })
      const req = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'user-agent': 'TestBrowser/1.0',
          'x-session-id': 'session789',
        },
      })
      const key = keyGen(req)
      expect(key).toContain('192.168.1.1')
      expect(key).toContain('ua:TestBrowser10')
      expect(key).toContain('sid:session789')
    })

    it('should skip missing optional identifiers', () => {
      const keyGen = createRobustKeyGenerator({
        includeUserAgent: true,
        sessionIdHeader: 'x-session-id',
      })
      const req = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
        },
      })
      const key = keyGen(req)
      expect(key).toBe('192.168.1.1')
    })
  })

  describe('keyUniqueness configuration', () => {
    it('should use keyUniqueness options when no custom keyGenerator provided', async () => {
      const limiter = createRateLimiter({
        maxRequests: 2,
        windowSeconds: 60,
        keyUniqueness: {
          sessionIdHeader: 'x-session-id',
        },
      }, 'test-key-uniqueness')

      // Same IP, different sessions should be tracked separately
      const req1 = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '10.10.10.1',
          'x-session-id': 'session-a',
        },
      })
      const req2 = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '10.10.10.1',
          'x-session-id': 'session-b',
        },
      })

      // Use up quota for session-a
      await limiter.check(req1)
      await limiter.check(req1)
      const result1 = await limiter.check(req1)
      expect(result1.allowed).toBe(false)

      // Session-b should still have quota
      const result2 = await limiter.check(req2)
      expect(result2.allowed).toBe(true)
    })

    it('should prefer custom keyGenerator over keyUniqueness', async () => {
      const limiter = createRateLimiter({
        maxRequests: 2,
        windowSeconds: 60,
        keyGenerator: () => 'custom-key',
        keyUniqueness: {
          sessionIdHeader: 'x-session-id',
        },
      }, 'test-custom-over-uniqueness')

      const req1 = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '10.10.10.1',
          'x-session-id': 'session-a',
        },
      })
      const req2 = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '10.10.10.2',
          'x-session-id': 'session-b',
        },
      })

      // Both should share the same quota because custom keyGenerator returns same key
      await limiter.check(req1)
      await limiter.check(req2)
      const result = await limiter.check(req1)
      expect(result.allowed).toBe(false)
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

  describe('TTL Validation', () => {
    it('should skip storage when TTL is zero in set()', async () => {
      const storage = new InMemoryStorage()

      await storage.set('zero-ttl-key', { count: 1, timestamp: Date.now() }, 0)
      const result = await storage.get('zero-ttl-key')

      expect(result).toBeNull()

      storage.destroy()
    })

    it('should skip storage when TTL is negative in set()', async () => {
      const storage = new InMemoryStorage()

      await storage.set('negative-ttl-key', { count: 1, timestamp: Date.now() }, -10)
      const result = await storage.get('negative-ttl-key')

      expect(result).toBeNull()

      storage.destroy()
    })

    it('should throw error when TTL is zero in increment()', async () => {
      const storage = new InMemoryStorage()

      await expect(storage.increment('zero-ttl-counter', 0)).rejects.toThrow(
        'TTL must be positive for increment operation'
      )

      storage.destroy()
    })

    it('should throw error when TTL is negative in increment()', async () => {
      const storage = new InMemoryStorage()

      await expect(storage.increment('negative-ttl-counter', -5)).rejects.toThrow(
        'TTL must be positive for increment operation'
      )

      storage.destroy()
    })
  })
})

describe('Additional Skip Function Tests', () => {
  it('should support async skip function returning true', async () => {
    const limiter = createRateLimiter({
      maxRequests: 1,
      windowSeconds: 60,
      skip: async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return true
      },
    }, 'test-skip-async-true')

    const req = createMockRequest('20.20.20.1')

    // Should allow unlimited due to async skip returning true
    for (let i = 0; i < 5; i++) {
      const result = await limiter.check(req)
      expect(result.allowed).toBe(true)
      expect(result.current).toBe(0)
    }
  })

  it('should support async skip function returning false', async () => {
    const limiter = createRateLimiter({
      maxRequests: 2,
      windowSeconds: 60,
      skip: async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return false
      },
    }, 'test-skip-async-false')

    const req = createMockRequest('20.20.20.2')

    await limiter.check(req)
    await limiter.check(req)

    const result = await limiter.check(req)
    expect(result.allowed).toBe(false)
  })

  it('should skip based on request headers', async () => {
    const limiter = createRateLimiter({
      maxRequests: 1,
      windowSeconds: 60,
      skip: (req) => req.headers.get('x-internal-request') === 'true',
    }, 'test-skip-header-based')

    const internalReq = new NextRequest('http://localhost/api/test', {
      headers: {
        'x-forwarded-for': '20.20.20.3',
        'x-internal-request': 'true',
      },
    })

    const externalReq = new NextRequest('http://localhost/api/test', {
      headers: {
        'x-forwarded-for': '20.20.20.4',
      },
    })

    // Internal requests bypass rate limiting
    for (let i = 0; i < 5; i++) {
      const result = await limiter.check(internalReq)
      expect(result.allowed).toBe(true)
    }

    // External requests are rate limited
    const result1 = await limiter.check(externalReq)
    expect(result1.allowed).toBe(true)
    const result2 = await limiter.check(externalReq)
    expect(result2.allowed).toBe(false)
  })

  it('should skip based on URL path', async () => {
    const limiter = createRateLimiter({
      maxRequests: 1,
      windowSeconds: 60,
      skip: (req) => {
        const url = new URL(req.url)
        return url.pathname.startsWith('/api/health')
      },
    }, 'test-skip-url-path')

    const healthReq = new NextRequest('http://localhost/api/health/check', {
      headers: { 'x-forwarded-for': '20.20.20.5' },
    })

    const apiReq = new NextRequest('http://localhost/api/data', {
      headers: { 'x-forwarded-for': '20.20.20.6' },
    })

    // Health endpoints bypass rate limiting
    for (let i = 0; i < 3; i++) {
      const result = await limiter.check(healthReq)
      expect(result.allowed).toBe(true)
    }

    // Regular API endpoints are rate limited
    const result1 = await limiter.check(apiReq)
    expect(result1.allowed).toBe(true)
    const result2 = await limiter.check(apiReq)
    expect(result2.allowed).toBe(false)
  })
})

describe('Additional Header Tests', () => {
  it('should correctly calculate Retry-After within window bounds', async () => {
    const limiter = createRateLimiter({
      maxRequests: 1,
      windowSeconds: 120,
    }, 'test-retry-after-bounds')

    const req = createMockRequest('21.21.21.1')

    await limiter.check(req)
    const result = await limiter.check(req)

    expect(result.retryAfter).toBeDefined()
    expect(result.retryAfter).toBeGreaterThan(0)
    expect(result.retryAfter).toBeLessThanOrEqual(120)
  })

  it('should not include Retry-After when request is allowed', async () => {
    const limiter = createRateLimiter({
      maxRequests: 10,
      windowSeconds: 60,
    }, 'test-no-retry-after')

    const req = createMockRequest('21.21.21.2')
    const result = await limiter.check(req)

    expect(result.retryAfter).toBeUndefined()

    const headers = limiter.createHeaders(result)
    expect(headers['Retry-After']).toBeUndefined()
  })

  it('should track current request count correctly', async () => {
    const limiter = createRateLimiter({
      maxRequests: 5,
      windowSeconds: 60,
    }, 'test-current-count')

    const req = createMockRequest('21.21.21.3')

    for (let i = 1; i <= 5; i++) {
      const result = await limiter.check(req)
      expect(result.current).toBe(i)
    }

    // After rate limit exceeded
    const result = await limiter.check(req)
    expect(result.current).toBeGreaterThanOrEqual(5)
  })

  it('should apply headers correctly to existing response', async () => {
    const limiter = createRateLimiter({
      maxRequests: 100,
      windowSeconds: 60,
    }, 'test-apply-headers')

    const req = createMockRequest('21.21.21.4')
    const result = await limiter.check(req)

    const response = new (await import('next/server')).NextResponse(
      JSON.stringify({ data: 'test' }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'custom-value',
        },
      }
    )

    const modifiedResponse = limiter.applyHeaders(response, result)

    // Check rate limit headers are added
    expect(modifiedResponse.headers.get('X-RateLimit-Limit')).toBe('100')
    expect(modifiedResponse.headers.get('X-RateLimit-Remaining')).toBe('99')
    expect(modifiedResponse.headers.get('X-RateLimit-Reset')).toBeDefined()

    // Check original headers are preserved
    expect(modifiedResponse.headers.get('Content-Type')).toBe('application/json')
    expect(modifiedResponse.headers.get('X-Custom-Header')).toBe('custom-value')
  })

  it('should generate reset timestamp in the future', async () => {
    const limiter = createRateLimiter({
      maxRequests: 5,
      windowSeconds: 60,
    }, 'test-reset-timestamp')

    const req = createMockRequest('21.21.21.5')
    const result = await limiter.check(req)

    const now = Math.floor(Date.now() / 1000)

    expect(result.reset).toBeGreaterThan(now)
    expect(result.reset).toBeLessThanOrEqual(now + 60)
  })
})

describe('Custom Key Generator Edge Cases', () => {
  it('should handle key generator returning empty string', async () => {
    const limiter = createRateLimiter({
      maxRequests: 2,
      windowSeconds: 60,
      keyGenerator: () => '',
    }, 'test-empty-key')

    const req1 = createMockRequest('22.22.22.1')
    const req2 = createMockRequest('22.22.22.2')

    // Both requests share the same empty key
    await limiter.check(req1)
    await limiter.check(req2)

    const result = await limiter.check(req1)
    expect(result.allowed).toBe(false)
  })

  it('should handle key generator extracting from query params', async () => {
    const limiter = createRateLimiter({
      maxRequests: 2,
      windowSeconds: 60,
      keyGenerator: (req) => {
        const url = new URL(req.url)
        return url.searchParams.get('api_key') ?? 'anonymous'
      },
    }, 'test-key-from-query')

    const req1 = new NextRequest('http://localhost/api/test?api_key=key-abc', {
      headers: { 'x-forwarded-for': '22.22.22.3' },
    })

    const req2 = new NextRequest('http://localhost/api/test?api_key=key-xyz', {
      headers: { 'x-forwarded-for': '22.22.22.3' },
    })

    // Different API keys should have separate quotas
    await limiter.check(req1)
    await limiter.check(req1)
    const result1 = await limiter.check(req1)
    expect(result1.allowed).toBe(false)

    const result2 = await limiter.check(req2)
    expect(result2.allowed).toBe(true)
  })

  it('should handle key generator returning special characters', async () => {
    const limiter = createRateLimiter({
      maxRequests: 2,
      windowSeconds: 60,
      keyGenerator: () => 'key:with:colons:and/slashes',
    }, 'test-special-chars-key')

    const req = createMockRequest('22.22.22.4')

    const result1 = await limiter.check(req)
    expect(result1.allowed).toBe(true)

    await limiter.check(req)
    const result2 = await limiter.check(req)
    expect(result2.allowed).toBe(false)
  })
})

describe('Concurrent Request Handling', () => {
  it('should handle many sequential requests correctly', async () => {
    const limiter = createRateLimiter({
      maxRequests: 10,
      windowSeconds: 60,
    }, 'test-many-sequential')

    const req = createMockRequest('23.23.23.1')

    // Fire 10 sequential requests (avoiding race conditions in test)
    for (let i = 0; i < 10; i++) {
      const result = await limiter.check(req)
      expect(result.allowed).toBe(true)
    }

    // 11th request should be blocked
    const nextResult = await limiter.check(req)
    expect(nextResult.allowed).toBe(false)
    expect(nextResult.remaining).toBe(0)
  })

  it('should handle concurrent requests from different clients', async () => {
    const limiter = createRateLimiter({
      maxRequests: 2,
      windowSeconds: 60,
    }, 'test-concurrent-clients')

    const clients = ['23.23.23.2', '23.23.23.3', '23.23.23.4', '23.23.23.5']

    // Each client fires 2 concurrent requests
    const allResults = await Promise.all(
      clients.flatMap(ip => [
        limiter.check(createMockRequest(ip)),
        limiter.check(createMockRequest(ip)),
      ])
    )

    // All 8 requests (2 per client x 4 clients) should be allowed
    const allowedCount = allResults.filter(r => r.allowed).length
    expect(allowedCount).toBe(8)
  })
})
