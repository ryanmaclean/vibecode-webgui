/**
 * @jest-environment node
 */

/**
 * Tests for /api/health/database route
 */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/health/database/route'
import { checkDatabaseHealth, quickDatabaseHealthCheck } from '@/lib/db/health-check'

// Mock dependencies
jest.mock('@/lib/db/health-check', () => ({
  checkDatabaseHealth: jest.fn(),
  quickDatabaseHealthCheck: jest.fn()
}))

describe('/api/health/database', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(checkDatabaseHealth as jest.Mock).mockResolvedValue({
      status: 'healthy',
      timestamp: new Date().toISOString()
    })
    ;(quickDatabaseHealthCheck as jest.Mock).mockResolvedValue({
      status: 'healthy',
      responseTime: '5ms'
    })
  })

  describe('GET', () => {
    it('should return basic health check by default', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/database')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.status).toBe('healthy')
      expect(checkDatabaseHealth).toHaveBeenCalledWith({
        detailed: undefined,
        checkPgVector: true,
        checkIndices: undefined,
        timeout: undefined,
        debug: false
      })
    })

    it('should perform quick health check when quick=true', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/database?quick=true')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.status).toBe('healthy')
      expect(data.responseTime).toBe('5ms')
      expect(quickDatabaseHealthCheck).toHaveBeenCalledWith(undefined)
      expect(checkDatabaseHealth).not.toHaveBeenCalled()
    })

    it('should perform detailed health check when detailed=true', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/database?detailed=true')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(checkDatabaseHealth).toHaveBeenCalledWith({
        detailed: true,
        checkPgVector: true,
        checkIndices: true,
        timeout: undefined,
        debug: false
      })
    })

    it('should use custom timeout when provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/database?timeout=5000')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(checkDatabaseHealth).toHaveBeenCalledWith({
        detailed: undefined,
        checkPgVector: true,
        checkIndices: undefined,
        timeout: 5000,
        debug: false
      })
    })

    it('should pass timeout to quick check', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/database?quick=true&timeout=3000')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(quickDatabaseHealthCheck).toHaveBeenCalledWith(3000)
    })

    it('should return 400 for invalid timeout (too low)', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/database?timeout=500')
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()

      expect(data.status).toBe('error')
      expect(data.message).toBe('Invalid query parameters')
      expect(data.details).toBeDefined()
    })

    it('should return 400 for invalid timeout (too high)', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/database?timeout=50000')
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()

      expect(data.status).toBe('error')
      expect(data.message).toBe('Invalid query parameters')
    })

    it('should return 400 for invalid detailed parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/database?detailed=invalid')
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()

      expect(data.status).toBe('error')
      expect(data.message).toBe('Invalid query parameters')
    })

    it('should return 400 for invalid quick parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/database?quick=maybe')
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()

      expect(data.status).toBe('error')
    })

    it('should return 400 for unknown query parameters (strict validation)', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/database?unknown=param')
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()

      expect(data.status).toBe('error')
      expect(data.message).toBe('Invalid query parameters')
    })

    it('should handle database health check errors', async () => {
      ;(checkDatabaseHealth as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      )

      const request = new NextRequest('http://localhost:3000/api/health/database')
      const response = await GET(request)

      expect(response.status).toBe(500)
      const data = await response.json()

      expect(data.status).toBe('error')
      expect(data.message).toContain('Database health check failed')
      expect(data.message).toContain('Database connection failed')
      expect(data.timestamp).toBeDefined()
    })

    it('should handle quick check errors', async () => {
      ;(quickDatabaseHealthCheck as jest.Mock).mockRejectedValue(
        new Error('Quick check timeout')
      )

      const request = new NextRequest('http://localhost:3000/api/health/database?quick=true')
      const response = await GET(request)

      expect(response.status).toBe(500)
      const data = await response.json()

      expect(data.status).toBe('error')
      expect(data.message).toContain('Quick check timeout')
    })

    it('should support combining detailed and timeout parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/database?detailed=true&timeout=10000')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(checkDatabaseHealth).toHaveBeenCalledWith({
        detailed: true,
        checkPgVector: true,
        checkIndices: true,
        timeout: 10000,
        debug: false
      })
    })

    it('should check pgVector extension by default', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/database')
      await GET(request)

      expect(checkDatabaseHealth).toHaveBeenCalledWith(
        expect.objectContaining({
          checkPgVector: true
        })
      )
    })

    it('should check indices when detailed is true', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/database?detailed=true')
      await GET(request)

      expect(checkDatabaseHealth).toHaveBeenCalledWith(
        expect.objectContaining({
          checkIndices: true
        })
      )
    })

    it('should not check indices when detailed is false', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/database?detailed=false')
      await GET(request)

      expect(checkDatabaseHealth).toHaveBeenCalledWith(
        expect.objectContaining({
          checkIndices: false
        })
      )
    })

    it('should never enable debug mode', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/database?detailed=true')
      await GET(request)

      expect(checkDatabaseHealth).toHaveBeenCalledWith(
        expect.objectContaining({
          debug: false
        })
      )
    })
  })
})
