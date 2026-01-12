/**
 * Tests for /api/healthz route (Kubernetes liveness probe)
 */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/healthz/route'

// Mock dependencies
jest.mock('@/lib/api-utils', () => ({
  createHealthResponse: jest.fn((status) => ({
    status: 200,
    json: async () => ({ status })
  })),
  createErrorResponseFromError: jest.fn((error, statusCode, message) => ({
    status: statusCode,
    json: async () => ({ error: message, details: error.message })
  }))
}))

jest.mock('@/lib/api/validation/middleware', () => ({
  validateQueryParams: jest.fn(() => ({
    success: true,
    data: {}
  }))
}))

describe('/api/healthz', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    it('should return healthy status for liveness probe', async () => {
      const request = new NextRequest('http://localhost:3000/api/healthz')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.status).toBe('healthy')
    })

    it('should validate query parameters', async () => {
      const { validateQueryParams } = require('@/lib/api/validation/middleware')
      const request = new NextRequest('http://localhost:3000/api/healthz')

      await GET(request)

      expect(validateQueryParams).toHaveBeenCalled()
    })

    it('should return validation error for invalid parameters', async () => {
      const { validateQueryParams } = require('@/lib/api/validation/middleware')
      validateQueryParams.mockReturnValueOnce({
        success: false,
        error: {
          status: 400,
          json: async () => ({ error: 'Invalid query parameters' })
        }
      })

      const request = new NextRequest('http://localhost:3000/api/healthz?invalid=param')
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid query parameters')
    })

    it('should handle unexpected errors', async () => {
      const { createHealthResponse } = require('@/lib/api-utils')
      createHealthResponse.mockImplementationOnce(() => {
        throw new Error('Unexpected error')
      })

      const request = new NextRequest('http://localhost:3000/api/healthz')
      const response = await GET(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe('Health check failed')
    })

    it('should work without any query parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/healthz')
      const response = await GET(request)

      expect(response.status).toBe(200)
    })

    it('should be fast enough for K8s liveness probe', async () => {
      const startTime = Date.now()
      const request = new NextRequest('http://localhost:3000/api/healthz')
      await GET(request)
      const duration = Date.now() - startTime

      // Kubernetes liveness probes typically timeout at 1s
      expect(duration).toBeLessThan(1000)
    })
  })
})
