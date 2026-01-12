/**
 * Tests for JWT utilities
 */

import {
  verifyJwtToken,
  extractToken,
  authenticateRequest,
  AuthenticationError,
  UserContext
} from '@/lib/auth/jwt-utils'
import * as jwt from 'jsonwebtoken'

// Mock jsonwebtoken
jest.mock('jsonwebtoken')

describe('JWT Utilities', () => {
  const mockSecret = 'test-secret-key'
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
    process.env.NEXTAUTH_SECRET = mockSecret
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('AuthenticationError', () => {
    it('should create error with message and code', () => {
      const error = new AuthenticationError('Test error', 'TEST_CODE')

      expect(error.message).toBe('Test error')
      expect(error.code).toBe('TEST_CODE')
      expect(error.name).toBe('AuthenticationError')
    })

    it('should create error with details', () => {
      const details = { field: 'email', reason: 'invalid format' }
      const error = new AuthenticationError('Test error', 'TEST_CODE', details)

      expect(error.details).toEqual(details)
    })

    it('should be instanceof Error', () => {
      const error = new AuthenticationError('Test', 'CODE')

      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(AuthenticationError)
    })

    it('should support various detail types', () => {
      const details = [
        { key: 'value' },
        'string detail',
        42,
        null,
        undefined,
        ['array', 'details']
      ]

      details.forEach(detail => {
        const error = new AuthenticationError('Test', 'CODE', detail)
        expect(error.details).toBe(detail)
      })
    })
  })

  describe('verifyJwtToken', () => {
    const mockUserPayload = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user'
    }

    it('should verify valid token and return user context', async () => {
      (jwt.verify as jest.Mock).mockReturnValue(mockUserPayload)

      const result = await verifyJwtToken('valid-token')

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        githubId: undefined,
        googleId: undefined
      })
    })

    it('should use provided secret', async () => {
      (jwt.verify as jest.Mock).mockReturnValue(mockUserPayload)

      const customSecret = 'custom-secret'
      await verifyJwtToken('token', customSecret)

      expect(jwt.verify).toHaveBeenCalledWith('token', customSecret)
    })

    it('should use NEXTAUTH_SECRET by default', async () => {
      (jwt.verify as jest.Mock).mockReturnValue(mockUserPayload)

      await verifyJwtToken('token')

      expect(jwt.verify).toHaveBeenCalledWith('token', mockSecret)
    })

    it('should throw error if secret not configured', async () => {
      delete process.env.NEXTAUTH_SECRET

      await expect(verifyJwtToken('token')).rejects.toThrow(AuthenticationError)
      await expect(verifyJwtToken('token')).rejects.toMatchObject({
        code: 'JWT_SECRET_MISSING',
        message: expect.stringContaining('JWT secret')
      })
    })

    it('should throw error if token is empty', async () => {
      await expect(verifyJwtToken('')).rejects.toThrow(AuthenticationError)
      await expect(verifyJwtToken('')).rejects.toMatchObject({
        code: 'TOKEN_MISSING'
      })
    })

    it('should throw error if token is not a string', async () => {
      await expect(verifyJwtToken(null as any)).rejects.toThrow(AuthenticationError)
      await expect(verifyJwtToken(undefined as any)).rejects.toThrow(AuthenticationError)
    })

    it('should extract optional fields', async () => {
      const payloadWithOptionals = Object.assign({}, mockUserPayload, {
        githubId: 'github-123',
        googleId: 'google-456'
      })
      ;(jwt.verify as jest.Mock).mockReturnValue(payloadWithOptionals)

      const result = await verifyJwtToken('token')

      expect(result.githubId).toBe('github-123')
      expect(result.googleId).toBe('google-456')
    })

    it('should throw error if id is missing', async () => {
      const invalidPayload = Object.assign({}, mockUserPayload, { id: undefined })
      ;(jwt.verify as jest.Mock).mockReturnValue(invalidPayload)

      await expect(verifyJwtToken('token')).rejects.toThrow(AuthenticationError)
      await expect(verifyJwtToken('token')).rejects.toMatchObject({
        code: 'TOKEN_INVALID_PAYLOAD'
      })
    })

    it('should throw error if email is missing', async () => {
      const invalidPayload = Object.assign({}, mockUserPayload, { email: undefined })
      ;(jwt.verify as jest.Mock).mockReturnValue(invalidPayload)

      await expect(verifyJwtToken('token')).rejects.toThrow(AuthenticationError)
      await expect(verifyJwtToken('token')).rejects.toMatchObject({
        code: 'TOKEN_INVALID_PAYLOAD'
      })
    })

    it('should handle expired token', async () => {
      const expiredError = new jwt.TokenExpiredError('Token expired', new Date())
      ;(jwt.verify as jest.Mock).mockImplementation(() => {
        throw expiredError
      })

      await expect(verifyJwtToken('token')).rejects.toThrow(AuthenticationError)
      await expect(verifyJwtToken('token')).rejects.toMatchObject({
        code: 'TOKEN_EXPIRED',
        message: expect.stringContaining('expired')
      })
    })

    it('should handle invalid token format', async () => {
      const invalidError = new jwt.JsonWebTokenError('Invalid token')
      ;(jwt.verify as jest.Mock).mockImplementation(() => {
        throw invalidError
      })

      await expect(verifyJwtToken('token')).rejects.toThrow(AuthenticationError)
      await expect(verifyJwtToken('token')).rejects.toMatchObject({
        code: 'TOKEN_INVALID'
      })
    })

    it('should handle generic verification errors', async () => {
      ;(jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Verification failed')
      })

      await expect(verifyJwtToken('token')).rejects.toThrow(AuthenticationError)
      await expect(verifyJwtToken('token')).rejects.toMatchObject({
        code: 'TOKEN_VERIFICATION_FAILED'
      })
    })

    it('should re-throw AuthenticationError', async () => {
      const authError = new AuthenticationError('Custom error', 'CUSTOM_CODE')
      ;(jwt.verify as jest.Mock).mockImplementation(() => {
        throw authError
      })

      await expect(verifyJwtToken('token')).rejects.toThrow(authError)
    })
  })

  describe('extractToken', () => {
    it('should extract token from VIBECODE_TOKEN env var', () => {
      process.env.VIBECODE_TOKEN = 'env-token'

      const token = extractToken()

      expect(token).toBe('env-token')
    })

    it('should prioritize env var over params', () => {
      process.env.VIBECODE_TOKEN = 'env-token'

      const token = extractToken({ token: 'param-token' })

      expect(token).toBe('env-token')
    })

    it('should extract token from params.token', () => {
      delete process.env.VIBECODE_TOKEN

      const token = extractToken({ token: 'param-token' })

      expect(token).toBe('param-token')
    })

    it('should extract token from params.authToken', () => {
      delete process.env.VIBECODE_TOKEN

      const token = extractToken({ authToken: 'auth-token' })

      expect(token).toBe('auth-token')
    })

    it('should prioritize token over authToken in params', () => {
      delete process.env.VIBECODE_TOKEN

      const token = extractToken({
        token: 'token-param',
        authToken: 'auth-token-param'
      })

      expect(token).toBe('token-param')
    })

    it('should trim whitespace from token', () => {
      process.env.VIBECODE_TOKEN = '  token-with-spaces  '

      const token = extractToken()

      expect(token).toBe('token-with-spaces')
    })

    it('should return null if no token found', () => {
      delete process.env.VIBECODE_TOKEN

      const token = extractToken()

      expect(token).toBeNull()
    })

    it('should return null for empty string token', () => {
      process.env.VIBECODE_TOKEN = ''

      const token = extractToken()

      expect(token).toBeNull()
    })

    it('should return null for whitespace-only token', () => {
      process.env.VIBECODE_TOKEN = '   '

      const token = extractToken()

      expect(token).toBeNull()
    })

    it('should handle null params', () => {
      delete process.env.VIBECODE_TOKEN

      const token = extractToken(null as any)

      expect(token).toBeNull()
    })

    it('should handle undefined params', () => {
      delete process.env.VIBECODE_TOKEN

      const token = extractToken(undefined)

      expect(token).toBeNull()
    })

    it('should ignore non-string tokens in params', () => {
      delete process.env.VIBECODE_TOKEN

      const token = extractToken({ token: 123 })

      expect(token).toBeNull()
    })

    it('should handle empty params object', () => {
      delete process.env.VIBECODE_TOKEN

      const token = extractToken({})

      expect(token).toBeNull()
    })
  })

  describe('authenticateRequest', () => {
    const mockUserPayload = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user'
    }

    it('should authenticate with env token', async () => {
      process.env.VIBECODE_TOKEN = 'valid-token'
      ;(jwt.verify as jest.Mock).mockReturnValue(mockUserPayload)

      const result = await authenticateRequest()

      expect(result).toEqual(expect.objectContaining({
        id: 'user-123',
        email: 'test@example.com'
      }))
    })

    it('should authenticate with token in params', async () => {
      delete process.env.VIBECODE_TOKEN
      ;(jwt.verify as jest.Mock).mockReturnValue(mockUserPayload)

      const result = await authenticateRequest({ token: 'param-token' })

      expect(result).toEqual(expect.objectContaining({
        id: 'user-123',
        email: 'test@example.com'
      }))
    })

    it('should throw error if no token provided', async () => {
      delete process.env.VIBECODE_TOKEN

      await expect(authenticateRequest()).rejects.toThrow(AuthenticationError)
      await expect(authenticateRequest()).rejects.toMatchObject({
        code: 'AUTH_REQUIRED'
      })
    })

    it('should include helpful hint in error', async () => {
      delete process.env.VIBECODE_TOKEN

      await expect(authenticateRequest()).rejects.toMatchObject({
        message: expect.stringContaining('VIBECODE_TOKEN'),
        details: expect.objectContaining({
          hint: expect.any(String)
        })
      })
    })

    it('should propagate verification errors', async () => {
      process.env.VIBECODE_TOKEN = 'invalid-token'
      const error = new jwt.JsonWebTokenError('Invalid')
      ;(jwt.verify as jest.Mock).mockImplementation(() => {
        throw error
      })

      await expect(authenticateRequest()).rejects.toThrow(AuthenticationError)
    })

    it('should work with authToken param', async () => {
      delete process.env.VIBECODE_TOKEN
      ;(jwt.verify as jest.Mock).mockReturnValue(mockUserPayload)

      const result = await authenticateRequest({ authToken: 'auth-token' })

      expect(result).toBeDefined()
      expect(result.id).toBe('user-123')
    })

    it('should handle empty params', async () => {
      delete process.env.VIBECODE_TOKEN

      await expect(authenticateRequest({})).rejects.toThrow(AuthenticationError)
      await expect(authenticateRequest({})).rejects.toMatchObject({
        code: 'AUTH_REQUIRED'
      })
    })
  })

  describe('integration scenarios', () => {
    const mockUserPayload = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin',
      githubId: 'github-123'
    }

    it('should complete full authentication flow', async () => {
      process.env.VIBECODE_TOKEN = 'valid-token'
      ;(jwt.verify as jest.Mock).mockReturnValue(mockUserPayload)

      const context = await authenticateRequest()

      expect(context.id).toBe('user-123')
      expect(context.email).toBe('test@example.com')
      expect(context.role).toBe('admin')
      expect(context.githubId).toBe('github-123')
    })

    it('should handle missing required fields gracefully', async () => {
      process.env.VIBECODE_TOKEN = 'invalid-token'
      ;(jwt.verify as jest.Mock).mockReturnValue({ name: 'Test' })

      await expect(authenticateRequest()).rejects.toMatchObject({
        code: 'TOKEN_INVALID_PAYLOAD'
      })
    })

    it('should handle expired tokens', async () => {
      process.env.VIBECODE_TOKEN = 'expired-token'
      ;(jwt.verify as jest.Mock).mockImplementation(() => {
        throw new jwt.TokenExpiredError('Expired', new Date())
      })

      await expect(authenticateRequest()).rejects.toMatchObject({
        code: 'TOKEN_EXPIRED'
      })
    })
  })

  describe('edge cases', () => {
    it('should handle very long tokens', async () => {
      const longToken = 'a'.repeat(10000)
      process.env.VIBECODE_TOKEN = longToken

      const token = extractToken()

      expect(token).toBe(longToken)
    })

    it('should handle special characters in token', async () => {
      const specialToken = 'token.with.dots-and_underscores'
      process.env.VIBECODE_TOKEN = specialToken

      const token = extractToken()

      expect(token).toBe(specialToken)
    })

    it('should handle multiple params', async () => {
      delete process.env.VIBECODE_TOKEN

      const token = extractToken({
        token: 'main-token',
        authToken: 'alt-token',
        other: 'value',
        more: 'data'
      })

      expect(token).toBe('main-token')
    })
  })
})
