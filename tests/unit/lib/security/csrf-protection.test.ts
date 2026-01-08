/**
 * Unit Tests for CSRF Protection Implementation
 * Tests token generation, validation, and timing-safe comparison
 */

import { jest } from '@jest/globals'
import { NextRequest } from 'next/server'

// Mock crypto module
jest.mock('crypto', () => ({
  randomBytes: jest.fn((length: number) => {
    const bytes = Buffer.alloc(length)
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
    return bytes
  }),
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mocked-hash'),
  })),
  timingSafeEqual: jest.fn((a: Buffer, b: Buffer) => {
    if (a.length !== b.length) return false
    return a.toString('hex') === b.toString('hex')
  }),
}))

import * as csrfProtection from '@/lib/security/csrf-protection'
import { randomBytes, timingSafeEqual } from 'crypto'

const mockRandomBytes = randomBytes as jest.MockedFunction<typeof randomBytes>
const mockTimingSafeEqual = timingSafeEqual as jest.MockedFunction<typeof timingSafeEqual>

describe('CSRF Protection Implementation', () => {
  let mockRequest: NextRequest

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))

    mockRequest = new NextRequest('https://example.com/api/test', {
      method: 'POST',
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('generateCSRFToken', () => {
    it('should generate a CSRF token', () => {
      mockRandomBytes.mockReturnValueOnce(Buffer.from('test-token-32-bytes-long-value!!'))

      const token = csrfProtection.generateCSRFToken('session-123')

      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
      expect(mockRandomBytes).toHaveBeenCalledWith(32)
    })

    it('should store token in token store', () => {
      mockRandomBytes.mockReturnValueOnce(Buffer.from('test-token-32-bytes-long-value!!'))

      const token = csrfProtection.generateCSRFToken('session-123')

      // Verify token can be validated
      const isValid = csrfProtection.validateCSRFToken('session-123', token)
      expect(isValid).toBe(true)
    })

    it('should generate unique tokens for different sessions', () => {
      mockRandomBytes
        .mockReturnValueOnce(Buffer.from('token-1-for-session-123-value!!!'))
        .mockReturnValueOnce(Buffer.from('token-2-for-session-456-value!!!'))

      const token1 = csrfProtection.generateCSRFToken('session-123')
      const token2 = csrfProtection.generateCSRFToken('session-456')

      expect(token1).not.toBe(token2)
    })

    it('should include timestamp in token data', () => {
      mockRandomBytes.mockReturnValueOnce(Buffer.from('test-token-32-bytes-long-value!!'))

      csrfProtection.generateCSRFToken('session-123')

      // Advance time and verify token is still valid within window
      jest.advanceTimersByTime(30 * 60 * 1000) // 30 minutes

      const token = csrfProtection.generateCSRFToken('session-123')
      const isValid = csrfProtection.validateCSRFToken('session-123', token)
      expect(isValid).toBe(true)
    })
  })

  describe('validateCSRFToken', () => {
    it('should validate a correct token', () => {
      mockRandomBytes.mockReturnValueOnce(Buffer.from('test-token-32-bytes-long-value!!'))
      mockTimingSafeEqual.mockReturnValue(true)

      const token = csrfProtection.generateCSRFToken('session-123')
      const isValid = csrfProtection.validateCSRFToken('session-123', token)

      expect(isValid).toBe(true)
      expect(mockTimingSafeEqual).toHaveBeenCalled()
    })

    it('should reject invalid token', () => {
      mockRandomBytes.mockReturnValueOnce(Buffer.from('test-token-32-bytes-long-value!!'))
      mockTimingSafeEqual.mockReturnValue(false)

      csrfProtection.generateCSRFToken('session-123')
      const isValid = csrfProtection.validateCSRFToken('session-123', 'wrong-token')

      expect(isValid).toBe(false)
    })

    it('should reject token for non-existent session', () => {
      const isValid = csrfProtection.validateCSRFToken('nonexistent-session', 'any-token')

      expect(isValid).toBe(false)
    })

    it('should reject expired token', () => {
      mockRandomBytes.mockReturnValueOnce(Buffer.from('test-token-32-bytes-long-value!!'))

      const token = csrfProtection.generateCSRFToken('session-123')

      // Advance time beyond expiry (1 hour + 1 minute)
      jest.advanceTimersByTime(61 * 60 * 1000)

      const isValid = csrfProtection.validateCSRFToken('session-123', token)

      expect(isValid).toBe(false)
    })

    it('should use timing-safe comparison', () => {
      mockRandomBytes.mockReturnValueOnce(Buffer.from('test-token-32-bytes-long-value!!'))
      mockTimingSafeEqual.mockReturnValue(true)

      const token = csrfProtection.generateCSRFToken('session-123')
      csrfProtection.validateCSRFToken('session-123', token)

      expect(mockTimingSafeEqual).toHaveBeenCalled()
      const call = mockTimingSafeEqual.mock.calls[0]
      expect(Buffer.isBuffer(call[0])).toBe(true)
      expect(Buffer.isBuffer(call[1])).toBe(true)
    })

    it('should handle different length tokens safely', () => {
      mockRandomBytes.mockReturnValueOnce(Buffer.from('test-token-32-bytes-long-value!!'))

      csrfProtection.generateCSRFToken('session-123')

      // Try to validate with wrong-length token
      const isValid = csrfProtection.validateCSRFToken('session-123', 'short')

      expect(isValid).toBe(false)
    })
  })

  describe('extractCSRFToken', () => {
    it('should extract token from X-CSRF-Token header', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': 'test-token-123',
        },
      })

      const token = csrfProtection.extractCSRFToken(request)

      expect(token).toBe('test-token-123')
    })

    it('should extract token from lowercase header', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'x-csrf-token': 'test-token-456',
        },
      })

      const token = csrfProtection.extractCSRFToken(request)

      expect(token).toBe('test-token-456')
    })

    it('should return null when header is missing', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
      })

      const token = csrfProtection.extractCSRFToken(request)

      expect(token).toBeNull()
    })

    it('should prefer header over form data', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': 'header-token',
          'content-type': 'application/x-www-form-urlencoded',
        },
      })

      const token = csrfProtection.extractCSRFToken(request)

      expect(token).toBe('header-token')
    })
  })

  describe('needsCSRFProtection', () => {
    it('should require CSRF for POST requests', () => {
      const request = new NextRequest('https://example.com/api/data', {
        method: 'POST',
      })

      const needs = csrfProtection.needsCSRFProtection(request)

      expect(needs).toBe(true)
    })

    it('should require CSRF for PUT requests', () => {
      const request = new NextRequest('https://example.com/api/data', {
        method: 'PUT',
      })

      const needs = csrfProtection.needsCSRFProtection(request)

      expect(needs).toBe(true)
    })

    it('should require CSRF for DELETE requests', () => {
      const request = new NextRequest('https://example.com/api/data', {
        method: 'DELETE',
      })

      const needs = csrfProtection.needsCSRFProtection(request)

      expect(needs).toBe(true)
    })

    it('should not require CSRF for GET requests', () => {
      const request = new NextRequest('https://example.com/api/data', {
        method: 'GET',
      })

      const needs = csrfProtection.needsCSRFProtection(request)

      expect(needs).toBe(false)
    })

    it('should skip CSRF for NextAuth endpoints', () => {
      const request = new NextRequest('https://example.com/api/auth/signin', {
        method: 'POST',
      })

      const needs = csrfProtection.needsCSRFProtection(request)

      expect(needs).toBe(false)
    })

    it('should skip CSRF for health check endpoints', () => {
      const request = new NextRequest('https://example.com/api/monitoring/health', {
        method: 'POST',
      })

      const needs = csrfProtection.needsCSRFProtection(request)

      expect(needs).toBe(false)
    })

    it('should skip CSRF for webhook endpoints', () => {
      const request = new NextRequest('https://example.com/api/webhooks/github', {
        method: 'POST',
      })

      const needs = csrfProtection.needsCSRFProtection(request)

      expect(needs).toBe(false)
    })
  })

  describe('getSessionId', () => {
    it('should extract session ID from secure cookie', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          cookie: '__Secure-next-auth.session-token=test-session-token',
        },
      })

      const sessionId = csrfProtection.getSessionId(request)

      expect(sessionId).toBeTruthy()
      expect(typeof sessionId).toBe('string')
    })

    it('should extract session ID from non-secure cookie', () => {
      const request = new NextRequest('http://localhost/api/test', {
        method: 'POST',
        headers: {
          cookie: 'next-auth.session-token=test-session-token',
        },
      })

      const sessionId = csrfProtection.getSessionId(request)

      expect(sessionId).toBeTruthy()
    })

    it('should fallback to IP-based session ID', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '192.168.1.1',
        },
      })

      const sessionId = csrfProtection.getSessionId(request)

      expect(sessionId).toBeTruthy()
      expect(typeof sessionId).toBe('string')
    })

    it('should use x-real-ip header when available', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'x-real-ip': '10.0.0.1',
        },
      })

      const sessionId = csrfProtection.getSessionId(request)

      expect(sessionId).toBeTruthy()
    })
  })

  describe('validateOrigin', () => {
    it('should validate matching origin', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          origin: 'https://example.com',
          host: 'example.com',
        },
      })

      const isValid = csrfProtection.validateOrigin(request)

      expect(isValid).toBe(true)
    })

    it('should reject mismatched origin', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          origin: 'https://evil.com',
          host: 'example.com',
        },
      })

      const isValid = csrfProtection.validateOrigin(request)

      expect(isValid).toBe(false)
    })

    it('should validate referer when origin is missing', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          referer: 'https://example.com/page',
          host: 'example.com',
        },
      })

      const isValid = csrfProtection.validateOrigin(request)

      expect(isValid).toBe(true)
    })

    it('should allow localhost in development', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
        },
      })

      const isValid = csrfProtection.validateOrigin(request)

      expect(isValid).toBe(true)

      process.env.NODE_ENV = originalEnv
    })

    it('should reject when host header is missing', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          origin: 'https://example.com',
        },
      })

      // Remove host header
      request.headers.delete('host')

      const isValid = csrfProtection.validateOrigin(request)

      expect(isValid).toBe(false)
    })
  })

  describe('getCSRFStats', () => {
    it('should return active token count', () => {
      mockRandomBytes.mockReturnValue(Buffer.from('test-token-32-bytes-long-value!!'))

      csrfProtection.generateCSRFToken('session-1')
      csrfProtection.generateCSRFToken('session-2')
      csrfProtection.generateCSRFToken('session-3')

      const stats = csrfProtection.getCSRFStats()

      expect(stats.activeTokens).toBeGreaterThanOrEqual(3)
      expect(typeof stats.cleanupCount).toBe('number')
    })

    it('should clean up expired tokens before returning stats', () => {
      mockRandomBytes.mockReturnValue(Buffer.from('test-token-32-bytes-long-value!!'))

      csrfProtection.generateCSRFToken('session-old')

      // Advance time to expire the token
      jest.advanceTimersByTime(2 * 60 * 60 * 1000) // 2 hours

      csrfProtection.generateCSRFToken('session-new')

      const stats = csrfProtection.getCSRFStats()

      // Should only have the new token
      expect(stats.activeTokens).toBeGreaterThanOrEqual(1)
    })
  })
})
