/**
 * Dashboard Overview API Route Tests
 * Tests the /api/dashboard/overview endpoint
 *
 * AGENT 92: Enhanced Monitoring Dashboards Foundation
 */

import { NextRequest } from 'next/server'

describe('GET /api/dashboard/overview', () => {
  let GET: () => Promise<Response>

  beforeEach(async () => {
    // Mock monitoring module
    jest.mock('@/lib/monitoring', () => ({
      monitoring: {
        checkDatabase: jest.fn().mockResolvedValue({ status: 'healthy' }),
        checkValkey: jest.fn().mockResolvedValue({ status: 'healthy' }),
        checkAIService: jest.fn().mockResolvedValue({ status: 'healthy' })
      }
    }))

    // Import the route module after mocking
    const routeModule = await import('@/app/api/dashboard/overview/route')
    GET = routeModule.GET
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should return dashboard overview with all health checks', async () => {
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('health')
    expect(data).toHaveProperty('performance')
    expect(data).toHaveProperty('system')
  })

  it('should include health status for all services', async () => {
    const response = await GET()
    const data = await response.json()

    expect(data.health).toHaveProperty('database')
    expect(data.health).toHaveProperty('cache')
    expect(data.health).toHaveProperty('ai')
    expect(data.health).toHaveProperty('overall')

    expect(['healthy', 'warning', 'error']).toContain(data.health.database)
    expect(['healthy', 'warning', 'error']).toContain(data.health.cache)
    expect(['healthy', 'warning', 'error']).toContain(data.health.ai)
    expect(['healthy', 'warning', 'error']).toContain(data.health.overall)
  })

  it('should include performance metrics', async () => {
    const response = await GET()
    const data = await response.json()

    expect(data.performance).toHaveProperty('avgResponseTime')
    expect(data.performance).toHaveProperty('requestsPerMinute')
    expect(typeof data.performance.avgResponseTime).toBe('number')
    expect(typeof data.performance.requestsPerMinute).toBe('number')
  })

  it('should include system resource information', async () => {
    const response = await GET()
    const data = await response.json()

    expect(data.system).toHaveProperty('uptime')
    expect(data.system).toHaveProperty('uptimeFormatted')
    expect(data.system).toHaveProperty('memory')
    expect(data.system.memory).toHaveProperty('used')
    expect(data.system.memory).toHaveProperty('total')
    expect(data.system.memory).toHaveProperty('percentage')
  })

  it('should calculate overall status as healthy when all services are healthy', async () => {
    const response = await GET()
    const data = await response.json()

    // With mocked healthy services
    expect(data.health.overall).toBe('healthy')
  })

  it('should format uptime in human-readable format', async () => {
    const response = await GET()
    const data = await response.json()

    expect(data.system.uptimeFormatted).toMatch(/^\d+(d|h|m)/)
  })

  it('should return valid ISO timestamp', async () => {
    const response = await GET()
    const data = await response.json()

    const timestamp = new Date(data.timestamp)
    expect(timestamp.getTime()).toBeGreaterThan(0)
    expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('should handle errors gracefully', async () => {
    // Re-import with failing mock
    jest.resetModules()
    jest.mock('@/lib/monitoring', () => ({
      monitoring: {
        checkDatabase: jest.fn().mockRejectedValue(new Error('DB connection failed')),
        checkValkey: jest.fn().mockRejectedValue(new Error('Cache unavailable')),
        checkAIService: jest.fn().mockRejectedValue(new Error('AI service down'))
      }
    }))

    const routeModule = await import('@/app/api/dashboard/overview/route')
    const GET = routeModule.GET

    const response = await GET()
    const data = await response.json()

    // Should still return data, but with error statuses
    expect(response.status).toBe(200)
    expect(data.health.overall).toBe('error')
  })

  it('should set memory percentage correctly', async () => {
    const response = await GET()
    const data = await response.json()

    expect(data.system.memory.percentage).toBeGreaterThanOrEqual(0)
    expect(data.system.memory.percentage).toBeLessThanOrEqual(100)
  })
})
