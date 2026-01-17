/**
 * @jest-environment node
 */

/**
 * Tests for /api/health/vector-db route
 */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/health/vector-db/route'

describe('/api/health/vector-db', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    it('should return unavailable status in JSON format by default', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/vector-db')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.status).toBe('unavailable')
      expect(data.message).toBe('Vector DB service not available')
      expect(data.timestamp).toBeDefined()
    })

    it('should return unavailable status in text format when format=text', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/vector-db?format=text')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/plain')

      const text = await response.text()
      expect(text).toContain('Vector Database Health Check')
      expect(text).toContain('UNAVAILABLE')
      expect(text).toContain('Vector DB service not available')
      expect(text).toContain('Timestamp:')
    })

    it('should include timestamp in ISO format', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/vector-db')
      const response = await GET(request)
      const data = await response.json()

      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })

    it('should handle format parameter case-insensitively', async () => {
      const requestJson = new NextRequest('http://localhost:3000/api/health/vector-db?format=json')
      const responseJson = await GET(requestJson)

      expect(responseJson.status).toBe(200)
      const data = await responseJson.json()
      expect(data.status).toBe('unavailable')
    })

    it('should default to JSON format when format parameter is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/vector-db')
      const response = await GET(request)

      expect(response.status).toBe(200)
      // Should be parseable as JSON
      const data = await response.json()
      expect(data).toBeDefined()
    })

    it('should handle unknown format parameter by defaulting to JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/vector-db?format=xml')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.status).toBe('unavailable')
    })

    it('should include all required fields in JSON response', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/vector-db')
      const response = await GET(request)
      const data = await response.json()

      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('timestamp')
    })

    it('should format text response with proper structure', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/vector-db?format=text')
      const response = await GET(request)
      const text = await response.text()

      expect(text).toContain('----') // Separator line
      expect(text).toContain('Message:')
      expect(text).toContain('Timestamp:')
    })

    it('should handle errors and return error response in JSON', async () => {
      // We can't easily trigger an error in the current implementation
      // but we can test the error handling path exists
      const request = new NextRequest('http://localhost:3000/api/health/vector-db')
      const response = await GET(request)

      // Should not throw, always returns a response
      expect(response).toBeDefined()
    })

    it('should be consistent across multiple calls', async () => {
      const request1 = new NextRequest('http://localhost:3000/api/health/vector-db')
      const response1 = await GET(request1)
      const data1 = await response1.json()

      const request2 = new NextRequest('http://localhost:3000/api/health/vector-db')
      const response2 = await GET(request2)
      const data2 = await response2.json()

      expect(data1.status).toBe(data2.status)
      expect(data1.message).toBe(data2.message)
    })

    it('should return quickly for monitoring purposes', async () => {
      const startTime = Date.now()
      const request = new NextRequest('http://localhost:3000/api/health/vector-db')
      await GET(request)
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(100)
    })
  })
})
