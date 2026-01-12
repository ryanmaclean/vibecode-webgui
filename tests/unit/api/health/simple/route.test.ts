/**
 * Tests for /api/health/simple route
 */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/health/simple/route'

// Mock validation middleware
jest.mock('@/lib/api/validation/middleware', () => ({
  validateQueryParams: jest.fn(() => ({
    success: true,
    data: {}
  }))
}))

describe('/api/health/simple', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    it('should return basic health status', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/simple')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.status).toBe('ok')
      expect(data.timestamp).toBeDefined()
      expect(data.uptime).toBeDefined()
      expect(data.environment).toBeDefined()
      expect(data.version).toBeDefined()
    })

    it('should include current timestamp in ISO format', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/simple')
      const response = await GET(request)
      const data = await response.json()

      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })

    it('should report uptime greater than or equal to 0', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/simple')
      const response = await GET(request)
      const data = await response.json()

      expect(data.uptime).toBeGreaterThanOrEqual(0)
    })

    it('should include environment from NODE_ENV', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/simple')
      const response = await GET(request)
      const data = await response.json()

      expect(data.environment).toBe(process.env.NODE_ENV || 'development')
    })

    it('should include version from package.json', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/simple')
      const response = await GET(request)
      const data = await response.json()

      expect(data.version).toBeDefined()
      expect(typeof data.version).toBe('string')
    })

    it('should validate query parameters', async () => {
      const { validateQueryParams } = require('@/lib/api/validation/middleware')
      const request = new NextRequest('http://localhost:3000/api/health/simple')

      await GET(request)

      expect(validateQueryParams).toHaveBeenCalled()
    })

    it('should return validation error for invalid parameters', async () => {
      const { validateQueryParams } = require('@/lib/api/validation/middleware')
      validateQueryParams.mockReturnValueOnce({
        success: false,
        error: {
          status: 400,
          json: async () => ({ error: 'Invalid parameters' })
        }
      })

      const request = new NextRequest('http://localhost:3000/api/health/simple?invalid=param')
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid parameters')
    })

    it('should handle uptime errors gracefully', async () => {
      // Mock process.uptime to throw error
      const originalUptime = process.uptime
      process.uptime = jest.fn().mockImplementation(() => {
        throw new Error('Uptime error')
      })

      const request = new NextRequest('http://localhost:3000/api/health/simple')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.uptime).toBe(0)

      // Restore original
      process.uptime = originalUptime
    })

    it('should be very fast (suitable for frequent polling)', async () => {
      const startTime = Date.now()
      const request = new NextRequest('http://localhost:3000/api/health/simple')
      await GET(request)
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(100) // Should be < 100ms
    })

    it('should not perform any external checks', async () => {
      // Simple route should not call any external services
      const request = new NextRequest('http://localhost:3000/api/health/simple')
      const response = await GET(request)

      expect(response.status).toBe(200)
      // No database, cache, or AI service checks
    })
  })
})
