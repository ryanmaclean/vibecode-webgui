/**
 * Tests for /api/health/connection-pool route
 */

import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/health/connection-pool/route'

describe('/api/health/connection-pool', () => {
  describe('GET', () => {
    it('should return unavailable status', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/connection-pool')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.status).toBe('unavailable')
      expect(data.message).toContain('not available')
    })

    it('should indicate connection pool optimizer not available', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/connection-pool')
      const response = await GET(request)
      const data = await response.json()

      expect(data.message).toContain('Connection pool optimizer')
    })

    it('should return JSON response', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/connection-pool')
      const response = await GET(request)

      expect(response.headers.get('content-type')).toContain('application/json')
    })
  })

  describe('POST', () => {
    it('should return 503 service unavailable', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/connection-pool', {
        method: 'POST'
      })
      const response = await POST(request)

      expect(response.status).toBe(503)
    })

    it('should return unavailable status', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/connection-pool', {
        method: 'POST'
      })
      const response = await POST(request)
      const data = await response.json()

      expect(data.status).toBe('unavailable')
    })

    it('should indicate optimizer not available', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/connection-pool', {
        method: 'POST'
      })
      const response = await POST(request)
      const data = await response.json()

      expect(data.error).toContain('not available')
    })

    it('should return JSON response', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/connection-pool', {
        method: 'POST'
      })
      const response = await POST(request)

      expect(response.headers.get('content-type')).toContain('application/json')
    })

    it('should mention environment in error message', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/connection-pool', {
        method: 'POST'
      })
      const response = await POST(request)
      const data = await response.json()

      expect(data.error).toContain('environment')
    })
  })
})
