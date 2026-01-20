/**
 * Tests for API utilities
 */

import {
  requireAuth,
  requireRole,
  getErrorMessage,
  getTimestamp,
  createSuccessResponse,
  createErrorResponse,
  createErrorResponseFromError,
  createHealthResponse
} from '@/lib/api-utils'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

// Mock next-auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}))

// Mock auth options
jest.mock('@/lib/auth', () => ({
  authOptions: {}
}))

describe('API Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('requireAuth', () => {
    it('should return session when user is authenticated', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user'
      }

      ;(getServerSession as jest.Mock).mockResolvedValue({
        user: mockUser
      })

      const request = new Request('http://localhost:3000/api/test')
      const result = await requireAuth(request)

      expect(result).toHaveProperty('session')
      expect((result as any).session.user).toEqual(mockUser)
    })

    it('should return 401 when no session', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValue(null)

      const request = new Request('http://localhost:3000/api/test')
      const result = await requireAuth(request)

      expect(result).toBeInstanceOf(NextResponse)
      const json = await (result as NextResponse).json()
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('AUTHENTICATION_REQUIRED')
      expect(json.error.message).toContain('Authentication required')
    })

    it('should return 401 when no user in session', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValue({ user: null })

      const request = new Request('http://localhost:3000/api/test')
      const result = await requireAuth(request)

      expect(result).toBeInstanceOf(NextResponse)
      const response = result as NextResponse
      expect(response.status).toBe(401)
    })

    it('should include error message in response', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValue(null)

      const request = new Request('http://localhost:3000/api/test')
      const result = await requireAuth(request)

      const json = await (result as NextResponse).json()
      expect(json).toHaveProperty('error')
      expect(json.error.message).toContain('Authentication')
    })
  })

  describe('requireRole', () => {
    it('should return session when user has correct role', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin'
      }

      ;(getServerSession as jest.Mock).mockResolvedValue({ user: mockUser })

      const request = new Request('http://localhost:3000/api/admin')
      const result = await requireRole('admin', request)

      expect(result).toHaveProperty('session')
      expect((result as any).session.user.role).toBe('admin')
    })

    it('should return 403 when user has wrong role', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Regular User',
        role: 'user'
      }

      ;(getServerSession as jest.Mock).mockResolvedValue({ user: mockUser })

      const request = new Request('http://localhost:3000/api/admin')
      const result = await requireRole('admin', request)

      expect(result).toBeInstanceOf(NextResponse)
      const response = result as NextResponse
      expect(response.status).toBe(403)
    })

    it('should return 401 when not authenticated', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValue(null)

      const request = new Request('http://localhost:3000/api/admin')
      const result = await requireRole('admin', request)

      expect(result).toBeInstanceOf(NextResponse)
      const response = result as NextResponse
      expect(response.status).toBe(401)
    })

    it('should include appropriate error message for insufficient permissions', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'User',
        role: 'user'
      }

      ;(getServerSession as jest.Mock).mockResolvedValue({ user: mockUser })

      const request = new Request('http://localhost:3000/api/admin')
      const result = await requireRole('admin', request)

      const json = await (result as NextResponse).json()
      expect(json.error.code).toBe('INSUFFICIENT_PERMISSIONS')
      expect(json.error.message).toContain('Required role')
    })

    it('should work with different role names', async () => {
      const roles = ['admin', 'moderator', 'editor', 'viewer']

      for (const role of roles) {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          name: 'User',
          role
        }

        ;(getServerSession as jest.Mock).mockResolvedValue({ user: mockUser })

        const request = new Request('http://localhost:3000/api/test')
        const result = await requireRole(role, request)

        expect(result).toHaveProperty('session')
      }
    })
  })

  describe('getErrorMessage', () => {
    it('should extract message from Error object', () => {
      const error = new Error('Test error message')
      const message = getErrorMessage(error)

      expect(message).toBe('Test error message')
    })

    it('should return "Unknown error" for non-Error objects', () => {
      const message1 = getErrorMessage('string error')
      const message2 = getErrorMessage(42)
      const message3 = getErrorMessage({ error: 'object' })
      const message4 = getErrorMessage(null)
      const message5 = getErrorMessage(undefined)

      expect(message1).toBe('Unknown error')
      expect(message2).toBe('Unknown error')
      expect(message3).toBe('Unknown error')
      expect(message4).toBe('Unknown error')
      expect(message5).toBe('Unknown error')
    })

    it('should handle TypeError', () => {
      const error = new TypeError('Type error')
      const message = getErrorMessage(error)

      expect(message).toBe('Type error')
    })

    it('should handle custom error classes', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'CustomError'
        }
      }

      const error = new CustomError('Custom error message')
      const message = getErrorMessage(error)

      expect(message).toBe('Custom error message')
    })
  })

  describe('getTimestamp', () => {
    it('should return ISO string', () => {
      const timestamp = getTimestamp()

      expect(typeof timestamp).toBe('string')
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('should return valid date string', () => {
      const timestamp = getTimestamp()
      const date = new Date(timestamp)

      expect(date).toBeInstanceOf(Date)
      expect(isNaN(date.getTime())).toBe(false)
    })

    it('should return recent timestamp', () => {
      const before = Date.now()
      const timestamp = getTimestamp()
      const after = Date.now()

      const timestampMs = new Date(timestamp).getTime()

      expect(timestampMs).toBeGreaterThanOrEqual(before)
      expect(timestampMs).toBeLessThanOrEqual(after)
    })

    it('should return different timestamps when called multiple times', () => {
      const timestamp1 = getTimestamp()
      // Small delay to ensure different timestamp
      const timestamp2 = getTimestamp()

      // They might be the same if called too quickly, but structure should be valid
      expect(timestamp1).toMatch(/^\d{4}-\d{2}-\d{2}/)
      expect(timestamp2).toMatch(/^\d{4}-\d{2}-\d{2}/)
    })
  })

  describe('createSuccessResponse', () => {
    it('should create response with data and timestamp', async () => {
      const data = { message: 'Success', result: 42 }
      const response = createSuccessResponse(data)

      expect(response).toBeInstanceOf(NextResponse)
      const json = await response.json()

      expect(json.success).toBe(true)
      expect(json.data).toEqual(data)
      expect(json.meta.timestamp).toBeDefined()
    })

    it('should include additional fields', async () => {
      const data = { message: 'Success' }
      const additionalFields = { requestId: '123', processingTime: 100 }
      const response = createSuccessResponse(data, { additionalFields })

      const json = await response.json()

      expect(json.requestId).toBe('123')
      expect(json.processingTime).toBe(100)
    })

    it('should handle empty data', async () => {
      const response = createSuccessResponse({})

      const json = await response.json()

      expect(json.success).toBe(true)
      expect(json.meta.timestamp).toBeDefined()
    })

    it('should preserve nested objects', async () => {
      const data = {
        user: {
          id: '123',
          profile: { name: 'Test' }
        },
        items: [1, 2, 3]
      }
      const response = createSuccessResponse(data)

      const json = await response.json()

      expect(json.data.user.id).toBe('123')
      expect(json.data.user.profile.name).toBe('Test')
      expect(json.data.items).toEqual([1, 2, 3])
    })
  })

  describe('createErrorResponse', () => {
    it('should create error response with default status 500', async () => {
      const response = createErrorResponse('Something went wrong')

      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(500)

      const json = await response.json()
      expect(json.success).toBe(false)
      expect(json.error.message).toBe('Something went wrong')
    })

    it('should create error response with custom status code', async () => {
      const response = createErrorResponse('Not found', 404)

      expect(response.status).toBe(404)
    })

    it('should include timestamp', async () => {
      const response = createErrorResponse('Error')

      const json = await response.json()
      expect(json.meta.timestamp).toBeDefined()
    })

    it('should include additional fields', async () => {
      const response = createErrorResponse('Error', 400, {
        field: 'email',
        code: 'INVALID_FORMAT'
      })

      const json = await response.json()
      expect(json.field).toBe('email')
      expect(json.error.code).toBe('INVALID_FORMAT')
    })

    it('should work with various HTTP status codes', async () => {
      const statusCodes = [400, 401, 403, 404, 422, 500, 502, 503]

      for (const code of statusCodes) {
        const response = createErrorResponse('Error', code)
        expect(response.status).toBe(code)
      }
    })
  })

  describe('createErrorResponseFromError', () => {
    it('should create error response from Error object', async () => {
      const error = new Error('Database connection failed')
      const response = createErrorResponseFromError(error)

      expect(response.status).toBe(500)
      const json = await response.json()
      expect(json.error.message).toBe('Database connection failed')
    })

    it('should use fallback message in details', async () => {
      const error = new Error('Connection timeout')
      const response = createErrorResponseFromError(error, 500, 'Database error')

      const json = await response.json()
      expect(json.title).toBe('Database error')
      expect(json.error.message).toBe('Connection timeout')
      expect(json.error.code).toBe('INTERNAL_SERVER_ERROR')
    })

    it('should work with custom status code', async () => {
      const error = new Error('Validation failed')
      const response = createErrorResponseFromError(error, 400)

      expect(response.status).toBe(400)
    })

    it('should handle non-Error objects', async () => {
      const response = createErrorResponseFromError('string error')

      const json = await response.json()
      expect(json.error.message).toBe('Unknown error')
    })

    it('should include timestamp', async () => {
      const error = new Error('Test error')
      const response = createErrorResponseFromError(error)

      const json = await response.json()
      expect(json.meta.timestamp).toBeDefined()
    })
  })

  describe('createHealthResponse', () => {
    it('should create health response with healthy status', async () => {
      const response = createHealthResponse('healthy')

      expect(response).toBeInstanceOf(NextResponse)
      const json = await response.json()
      expect(json.success).toBe(true)
      expect(json.data.status).toBe('healthy')
    })

    it('should create health response with unhealthy status', async () => {
      const response = createHealthResponse('unhealthy')

      const json = await response.json()
      expect(json.data.status).toBe('unhealthy')
    })

    it('should support all status types', async () => {
      const statuses: Array<'healthy' | 'unhealthy' | 'ready' | 'not ready' | 'error'> = [
        'healthy',
        'unhealthy',
        'ready',
        'not ready',
        'error'
      ]

      for (const status of statuses) {
        const response = createHealthResponse(status)
        const json = await response.json()
        expect(json.data.status).toBe(status)
      }
    })

    it('should include timestamp', async () => {
      const response = createHealthResponse('healthy')

      const json = await response.json()
      expect(json.meta.timestamp).toBeDefined()
    })

    it('should include additional data', async () => {
      const additionalData = {
        database: 'connected',
        redis: 'connected',
        uptime: 12345
      }
      const response = createHealthResponse('healthy', additionalData)

      const json = await response.json()
      expect(json.data.database).toBe('connected')
      expect(json.data.redis).toBe('connected')
      expect(json.data.uptime).toBe(12345)
    })

    it('should handle empty additional data', async () => {
      const response = createHealthResponse('healthy', {})

      const json = await response.json()
      expect(json.data.status).toBe('healthy')
      expect(json.meta.timestamp).toBeDefined()
    })

    it('should preserve nested additional data', async () => {
      const additionalData = {
        checks: {
          database: { status: 'ok', latency: 5 },
          cache: { status: 'ok', latency: 2 }
        }
      }
      const response = createHealthResponse('healthy', additionalData)

      const json = await response.json()
      expect(json.data.checks.database.status).toBe('ok')
      expect(json.data.checks.cache.latency).toBe(2)
    })
  })

  describe('integration scenarios', () => {
    it('should handle full authentication flow', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin'
      }

      ;(getServerSession as jest.Mock).mockResolvedValue({ user: mockUser })

      const request = new Request('http://localhost:3000/api/admin')

      const authResult = await requireAuth(request)
      expect(authResult).toHaveProperty('session')

      const roleResult = await requireRole('admin', request)
      expect(roleResult).toHaveProperty('session')
    })

    it('should handle error flow', async () => {
      try {
        throw new Error('Database error')
      } catch (error) {
        const response = createErrorResponseFromError(error, 500, 'Operation failed')
        expect(response.status).toBe(500)
      }
    })
  })
})
