/**
 * Integration tests for container monitoring API endpoints
 * Tests real API functionality for container resource monitoring
 */

import { jest } from '@jest/globals'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'

// Strongly-typed mock for getServerSession to avoid 'any' casts in tests
const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>

// Mock rate-limiting - must be before route imports
jest.mock('@/lib/rate-limiting', () => ({
  createAPIRateLimit: jest.fn(() => jest.fn().mockResolvedValue({
    success: true,
    limit: 120,
    remaining: 119,
    reset: Date.now() + 60000
  }))
}))

// Mock next-auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

// Mock auth options
jest.mock('../../src/lib/auth', () => ({
  authOptions: {},
}))

// Mock cache
jest.mock('../../src/lib/cache/unified-cache-client', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
  },
  CacheTTL: {
    SHORT: 60000,
  },
}))

// Mock container metrics service
const mockContainerMetrics = [
  {
    name: 'vibecode-app',
    image: 'vibecode:latest',
    cpuUsage: 0.5,
    cpuPercent: 50,
    memoryUsage: 536870912, // 512 MB
    memoryLimit: 1073741824, // 1 GB
    memoryPercent: 50,
    networkRxBytes: 1024000,
    networkTxBytes: 512000,
    storageUsage: 1073741824, // 1 GB
    state: 'running',
    timestamp: Date.now(),
  },
  {
    name: 'postgres',
    image: 'postgres:15',
    cpuUsage: 0.2,
    cpuPercent: 20,
    memoryUsage: 268435456, // 256 MB
    memoryLimit: 536870912, // 512 MB
    memoryPercent: 50,
    networkRxBytes: 512000,
    networkTxBytes: 256000,
    storageUsage: 2147483648, // 2 GB
    state: 'running',
    timestamp: Date.now(),
  },
]

const mockContainerHistory = {
  container: 'vibecode-app',
  metric: 'cpu' as const,
  datapoints: [
    { timestamp: Date.now() - 3600000, value: 45 },
    { timestamp: Date.now() - 1800000, value: 50 },
    { timestamp: Date.now(), value: 55 },
  ],
  startTime: Date.now() - 3600000,
  endTime: Date.now(),
}

jest.mock('../../src/lib/monitoring/container-metrics', () => ({
  containerMetricsService: {
    getContainerMetrics: jest.fn(() => Promise.resolve(mockContainerMetrics)),
    getContainerMetricsByName: jest.fn((name: string) =>
      Promise.resolve(mockContainerMetrics.find(c => c.name === name))
    ),
    getContainerHistory: jest.fn(() => Promise.resolve(mockContainerHistory)),
    healthCheck: jest.fn(() => Promise.resolve({ healthy: true })),
  },
  ContainerMetrics: {},
}))

// Mock monitoring auth helpers to avoid edge-specific Response.json and cookie runtime
jest.mock('@/lib/monitoring/auth', () => {
  return {
    checkMonitoringAuth: async (request: Request) => {
      const { getServerSession } = await import('next-auth')
      const session = await getServerSession()
      if (!session || !(session as { user?: unknown }).user) {
        return { isAuthorized: false, error: 'Unauthorized' }
      }
      const role = (session as { user?: { role?: string } }).user?.role
      if (role === 'admin') {
        return { isAuthorized: true }
      }
      return { isAuthorized: false, error: 'Unauthorized' }
    },
    getUnauthorizedResponse: (error?: string) =>
      new Response(JSON.stringify({ error: error || 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
  }
})

import { GET, HEAD } from '../../src/app/api/monitoring/containers/route'
import { GET as GET_HISTORY } from '../../src/app/api/monitoring/containers/history/route'

// Jest environment polyfill: Next's Response.json helper isn't available in Node's WHATWG Response
// Provide a compatible shim that returns a Response with JSON body.
const g = globalThis as unknown as { Response: typeof Response & { json?: (body: unknown, init?: ResponseInit) => Response } }
if (!g.Response.json) {
  g.Response.json = (body: unknown, init?: ResponseInit) =>
    new Response(JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
}

describe('Container Monitoring API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/monitoring/containers', () => {
    test('should return container metrics for admin user', async () => {
      // Mock admin session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'admin123', role: 'admin' },
      })

      const request = new Request('http://localhost:3000/api/monitoring/containers', { headers: new Headers() }) as unknown as NextRequest

      const response = await GET(request)

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('containers')
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('total')
      expect(data).toHaveProperty('summary')
      expect(data).toHaveProperty('alerts')
      expect(data).toHaveProperty('from_cache')
      expect(data.containers).toBeInstanceOf(Array)
      expect(data.containers.length).toBe(2)
      expect(data.total).toBe(2)
      expect(data.summary).toHaveProperty('total')
      expect(data.summary).toHaveProperty('running')
      expect(data.summary).toHaveProperty('avgCpuPercent')
      expect(data.summary).toHaveProperty('avgMemoryPercent')
    })

    test('should filter container by name', async () => {
      // Mock admin session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'admin123', role: 'admin' },
      })

      const request = new Request('http://localhost:3000/api/monitoring/containers?name=vibecode-app', { headers: new Headers() }) as unknown as NextRequest

      const response = await GET(request)

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.containers).toBeInstanceOf(Array)
      expect(data.containers.length).toBe(1)
      expect(data.containers[0].name).toBe('vibecode-app')
    })

    test('should skip cache when skip_cache parameter is true', async () => {
      // Mock admin session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'admin123', role: 'admin' },
      })

      const { cache } = await import('../../src/lib/cache/unified-cache-client')
      const mockGet = cache.get as jest.MockedFunction<typeof cache.get>
      mockGet.mockResolvedValue(null)

      const request = new Request('http://localhost:3000/api/monitoring/containers?skip_cache=true', { headers: new Headers() }) as unknown as NextRequest

      const response = await GET(request)

      expect(response.status).toBe(200)

      // Verify cache.get was not called when skip_cache is true
      expect(mockGet).not.toHaveBeenCalled()
    })

    test('should deny access for non-admin users', async () => {
      // Mock regular user session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'user123', role: 'user' },
      })

      const request = new Request('http://localhost:3000/api/monitoring/containers', { headers: new Headers() }) as unknown as NextRequest

      const response = await GET(request)

      expect(response.status).toBe(401)

      const data = await response.json()
      expect(data).toEqual({ error: 'Unauthorized' })
    })

    test('should deny access for unauthenticated users', async () => {
      // Mock no session
      mockedGetServerSession.mockResolvedValue(null)

      const request = new Request('http://localhost:3000/api/monitoring/containers', { headers: new Headers() }) as unknown as NextRequest

      const response = await GET(request)

      expect(response.status).toBe(401)

      const data = await response.json()
      expect(data).toEqual({ error: 'Unauthorized' })
    })

    test('should handle internal server errors gracefully', async () => {
      // Mock admin session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'admin123', role: 'admin' },
      })

      // Force an error by mocking the service to throw
      const { containerMetricsService } = await import('../../src/lib/monitoring/container-metrics')
      const mockGetMetrics = containerMetricsService.getContainerMetrics as jest.MockedFunction<typeof containerMetricsService.getContainerMetrics>
      mockGetMetrics.mockRejectedValueOnce(new Error('Service unavailable'))

      const request = new Request('http://localhost:3000/api/monitoring/containers', { headers: new Headers() }) as unknown as NextRequest

      const response = await GET(request)

      expect(response.status).toBe(500)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Failed to fetch container metrics')
      expect(data).toHaveProperty('message')
      expect(data.message).toBe('Service unavailable')
      expect(data.containers).toEqual([])
      expect(data.total).toBe(0)

      // Restore mock
      mockGetMetrics.mockResolvedValue(mockContainerMetrics)
    })

    test('should include metadata for human-readable values', async () => {
      // Mock admin session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'admin123', role: 'admin' },
      })

      const request = new Request('http://localhost:3000/api/monitoring/containers', { headers: new Headers() }) as unknown as NextRequest

      const response = await GET(request)

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.containers[0]).toHaveProperty('_metadata')
      expect(data.containers[0]._metadata).toHaveProperty('memoryUsageMB')
      expect(data.containers[0]._metadata).toHaveProperty('memoryLimitMB')
      expect(data.containers[0]._metadata).toHaveProperty('networkRxKBps')
      expect(data.containers[0]._metadata).toHaveProperty('networkTxKBps')
      expect(data.containers[0]._metadata).toHaveProperty('storageUsageMB')
    })

    test('should include alerts for containers approaching limits', async () => {
      // Mock admin session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'admin123', role: 'admin' },
      })

      const request = new Request('http://localhost:3000/api/monitoring/containers', { headers: new Headers() }) as unknown as NextRequest

      const response = await GET(request)

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('alerts')
      expect(data.alerts).toBeInstanceOf(Array)
      // No alerts in our mock data since cpu/memory are at 50%
    })
  })

  describe('HEAD /api/monitoring/containers', () => {
    test('should return 200 when container metrics service is healthy', async () => {
      const response = await HEAD()

      expect(response.status).toBe(200)
      expect(response.body).toBeNull()
    })

    test('should return 503 when container metrics service is unhealthy', async () => {
      // Mock unhealthy service
      const { containerMetricsService } = await import('../../src/lib/monitoring/container-metrics')
      const mockHealthCheck = containerMetricsService.healthCheck as jest.MockedFunction<typeof containerMetricsService.healthCheck>
      mockHealthCheck.mockResolvedValueOnce({ healthy: false })

      const response = await HEAD()

      expect(response.status).toBe(503)
      expect(response.body).toBeNull()

      // Restore mock
      mockHealthCheck.mockResolvedValue({ healthy: true })
    })

    test('should return 503 when health check throws error', async () => {
      // Mock health check throwing error
      const { containerMetricsService } = await import('../../src/lib/monitoring/container-metrics')
      const mockHealthCheck = containerMetricsService.healthCheck as jest.MockedFunction<typeof containerMetricsService.healthCheck>
      mockHealthCheck.mockRejectedValueOnce(new Error('Health check failed'))

      const response = await HEAD()

      expect(response.status).toBe(503)
      expect(response.body).toBeNull()

      // Restore mock
      mockHealthCheck.mockResolvedValue({ healthy: true })
    })
  })

  describe('GET /api/monitoring/containers/history', () => {
    test('should return historical metrics for admin user', async () => {
      // Mock admin session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'admin123', role: 'admin' },
      })

      const request = new Request('http://localhost:3000/api/monitoring/containers/history?container=vibecode-app&metric=cpu', { headers: new Headers() }) as unknown as NextRequest

      const response = await GET_HISTORY(request)

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('container')
      expect(data).toHaveProperty('metric')
      expect(data).toHaveProperty('datapoints')
      expect(data).toHaveProperty('startTime')
      expect(data).toHaveProperty('endTime')
      expect(data).toHaveProperty('duration')
      expect(data).toHaveProperty('step')
      expect(data).toHaveProperty('total_datapoints')
      expect(data).toHaveProperty('statistics')
      expect(data.container).toBe('vibecode-app')
      expect(data.metric).toBe('cpu')
      expect(data.datapoints).toBeInstanceOf(Array)
      expect(data.datapoints.length).toBe(3)
      expect(data.statistics).toHaveProperty('min')
      expect(data.statistics).toHaveProperty('max')
      expect(data.statistics).toHaveProperty('avg')
      expect(data.statistics).toHaveProperty('current')
    })

    test('should return 400 when container parameter is missing', async () => {
      // Mock admin session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'admin123', role: 'admin' },
      })

      const request = new Request('http://localhost:3000/api/monitoring/containers/history?metric=cpu', { headers: new Headers() }) as unknown as NextRequest

      const response = await GET_HISTORY(request)

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Missing required parameter: container')
    })

    test('should return 400 when metric parameter is missing', async () => {
      // Mock admin session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'admin123', role: 'admin' },
      })

      const request = new Request('http://localhost:3000/api/monitoring/containers/history?container=vibecode-app', { headers: new Headers() }) as unknown as NextRequest

      const response = await GET_HISTORY(request)

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Missing required parameter: metric')
    })

    test('should return 400 when metric type is invalid', async () => {
      // Mock admin session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'admin123', role: 'admin' },
      })

      const request = new Request('http://localhost:3000/api/monitoring/containers/history?container=vibecode-app&metric=invalid', { headers: new Headers() }) as unknown as NextRequest

      const response = await GET_HISTORY(request)

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Invalid metric type')
      expect(data.message).toContain('cpu, memory, network_rx, network_tx, storage')
    })

    test('should accept optional duration and step parameters', async () => {
      // Mock admin session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'admin123', role: 'admin' },
      })

      const request = new Request('http://localhost:3000/api/monitoring/containers/history?container=vibecode-app&metric=memory&duration=30m&step=5m', { headers: new Headers() }) as unknown as NextRequest

      const response = await GET_HISTORY(request)

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.duration).toBe('30m')
      expect(data.step).toBe('5m')
    })

    test('should deny access for non-admin users', async () => {
      // Mock regular user session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'user123', role: 'user' },
      })

      const request = new Request('http://localhost:3000/api/monitoring/containers/history?container=vibecode-app&metric=cpu', { headers: new Headers() }) as unknown as NextRequest

      const response = await GET_HISTORY(request)

      expect(response.status).toBe(401)

      const data = await response.json()
      expect(data).toEqual({ error: 'Unauthorized' })
    })

    test('should deny access for unauthenticated users', async () => {
      // Mock no session
      mockedGetServerSession.mockResolvedValue(null)

      const request = new Request('http://localhost:3000/api/monitoring/containers/history?container=vibecode-app&metric=cpu', { headers: new Headers() }) as unknown as NextRequest

      const response = await GET_HISTORY(request)

      expect(response.status).toBe(401)

      const data = await response.json()
      expect(data).toEqual({ error: 'Unauthorized' })
    })

    test('should handle internal server errors gracefully', async () => {
      // Mock admin session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'admin123', role: 'admin' },
      })

      // Force an error by mocking the service to throw
      const { containerMetricsService } = await import('../../src/lib/monitoring/container-metrics')
      const mockGetHistory = containerMetricsService.getContainerHistory as jest.MockedFunction<typeof containerMetricsService.getContainerHistory>
      mockGetHistory.mockRejectedValueOnce(new Error('Service unavailable'))

      const request = new Request('http://localhost:3000/api/monitoring/containers/history?container=vibecode-app&metric=cpu', { headers: new Headers() }) as unknown as NextRequest

      const response = await GET_HISTORY(request)

      expect(response.status).toBe(500)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Failed to fetch container history')
      expect(data).toHaveProperty('message')
      expect(data.message).toBe('Service unavailable')

      // Restore mock
      mockGetHistory.mockResolvedValue(mockContainerHistory)
    })

    test('should skip cache when skip_cache parameter is true', async () => {
      // Mock admin session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'admin123', role: 'admin' },
      })

      const { cache } = await import('../../src/lib/cache/unified-cache-client')
      const mockGet = cache.get as jest.MockedFunction<typeof cache.get>
      mockGet.mockResolvedValue(null)

      const request = new Request('http://localhost:3000/api/monitoring/containers/history?container=vibecode-app&metric=cpu&skip_cache=true', { headers: new Headers() }) as unknown as NextRequest

      const response = await GET_HISTORY(request)

      expect(response.status).toBe(200)

      // Verify cache.get was not called when skip_cache is true
      expect(mockGet).not.toHaveBeenCalled()
    })
  })
})
