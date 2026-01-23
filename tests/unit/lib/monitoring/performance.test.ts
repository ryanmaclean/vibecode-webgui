/**
 * Unit Tests for Performance Monitoring Utilities
 * Tests request timing, memory tracking, CPU tracking, database query timing,
 * and external API call timing utilities.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NextRequest } from 'next/server'

// Define mock at module scope
const mockSubmitMetricFn = jest.fn()

// Mock the logger module
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  },
  createLogger: jest.fn(() => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  })),
  logPerformance: jest.fn()
}))

// Mock the performance-logger module
jest.mock('@/lib/logging/performance-logger', () => ({
  createPerformanceTimer: jest.fn(() => ({
    stop: jest.fn(() => 100),
    elapsed: jest.fn(() => 50),
    checkpoint: jest.fn(() => 25)
  })),
  withTiming: jest.fn(async (_name: string, fn: () => Promise<unknown>) => {
    const result = await fn()
    return { result, duration: 100, formattedDuration: '100ms' }
  })
}))

// Mock the format module
jest.mock('@/lib/logging/format', () => ({
  sanitizeLogData: jest.fn((data: Record<string, unknown>) => data),
  formatDuration: jest.fn((ms: number) => `${ms}ms`),
  formatBytes: jest.fn((bytes: number) => `${Math.round(bytes / 1024 / 1024)}MB`)
}))

// Mock the datadog-client module using factory function
jest.mock('@/lib/monitoring/datadog-client', () => ({
  monitoring: {
    submitMetric: jest.fn().mockResolvedValue(true)
  }
}))

// Import after mocking
import {
  configureThresholds,
  getThresholds,
  requestTimingMiddleware,
  createRequestTimer,
  getMemorySnapshot,
  trackMemoryUsage,
  withMemoryTracking,
  getCpuSnapshot,
  trackCpuUsage,
  withCpuTracking,
  trackDatabaseQuery,
  createDatabaseTimer,
  trackExternalApiCall,
  createTimedFetch,
  createExternalApiTimer,
  PerformanceTracker
} from '@/lib/monitoring/performance'
import { monitoring } from '@/lib/monitoring/datadog-client'

// Get reference to the mocked submitMetric
const mockSubmitMetric = monitoring.submitMetric as jest.MockedFunction<typeof monitoring.submitMetric>

describe('Performance Monitoring Utilities', () => {
  let originalMemoryUsage: typeof process.memoryUsage
  let originalCpuUsage: typeof process.cpuUsage

  beforeEach(() => {
    jest.clearAllMocks()
    mockSubmitMetric.mockResolvedValue(true)

    // Store original methods
    originalMemoryUsage = process.memoryUsage
    originalCpuUsage = process.cpuUsage

    // Mock process.memoryUsage
    jest.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 100 * 1024 * 1024,
      heapTotal: 50 * 1024 * 1024,
      heapUsed: 30 * 1024 * 1024,
      external: 10 * 1024 * 1024,
      arrayBuffers: 5 * 1024 * 1024
    })

    // Mock process.cpuUsage
    jest.spyOn(process, 'cpuUsage').mockReturnValue({
      user: 100000,
      system: 50000
    })

    // Mock performance.now
    let performanceTime = 0
    jest.spyOn(performance, 'now').mockImplementation(() => {
      performanceTime += 100
      return performanceTime
    })

    // Reset thresholds to defaults
    configureThresholds({
      slowRequestMs: 1000,
      verySlowRequestMs: 5000,
      slowQueryMs: 500,
      slowApiCallMs: 2000,
      memoryWarningPercent: 80,
      cpuWarningPercent: 80
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    process.memoryUsage = originalMemoryUsage
    process.cpuUsage = originalCpuUsage
  })

  describe('Threshold Configuration', () => {
    it('should return default thresholds', () => {
      const thresholds = getThresholds()

      expect(thresholds.slowRequestMs).toBe(1000)
      expect(thresholds.verySlowRequestMs).toBe(5000)
      expect(thresholds.slowQueryMs).toBe(500)
      expect(thresholds.slowApiCallMs).toBe(2000)
      expect(thresholds.memoryWarningPercent).toBe(80)
      expect(thresholds.cpuWarningPercent).toBe(80)
    })

    it('should allow configuring thresholds', () => {
      configureThresholds({ slowRequestMs: 2000, slowQueryMs: 1000 })
      const thresholds = getThresholds()

      expect(thresholds.slowRequestMs).toBe(2000)
      expect(thresholds.slowQueryMs).toBe(1000)
      // Other defaults should remain
      expect(thresholds.verySlowRequestMs).toBe(5000)
    })

    it('should merge partial threshold updates', () => {
      configureThresholds({ memoryWarningPercent: 90 })
      const thresholds = getThresholds()

      expect(thresholds.memoryWarningPercent).toBe(90)
      expect(thresholds.slowRequestMs).toBeDefined()
    })
  })

  describe('Request Timing Middleware', () => {
    const createMockRequest = (method: string, url: string): NextRequest => {
      return {
        method,
        url,
        headers: new Headers({
          'x-trace-id': 'test-trace-id',
          'x-span-id': 'test-span-id'
        })
      } as unknown as NextRequest
    }

    it('should wrap handler and track timing', async () => {
      const handler = jest.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      )

      const wrappedHandler = requestTimingMiddleware(handler as any)
      const request = createMockRequest('GET', 'http://localhost/api/test')

      const response = await wrappedHandler(request)

      expect(handler).toHaveBeenCalledWith(request, undefined)
      expect(response.status).toBe(200)
    })

    it('should handle errors in handler', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('Test error'))

      const wrappedHandler = requestTimingMiddleware(handler as any)
      const request = createMockRequest('POST', 'http://localhost/api/test')

      const response = await wrappedHandler(request)

      expect(response.status).toBe(500)
    })

    it('should submit metrics when enabled', async () => {
      const handler = jest.fn().mockResolvedValue(
        new Response('OK', { status: 200 })
      )

      const wrappedHandler = requestTimingMiddleware(handler as any, {
        submitMetrics: true
      })
      const request = createMockRequest('GET', 'http://localhost/api/test')

      await wrappedHandler(request)

      expect(mockSubmitMetric).toHaveBeenCalled()
    })

    it('should skip metrics when disabled', async () => {
      const handler = jest.fn().mockResolvedValue(
        new Response('OK', { status: 200 })
      )

      const wrappedHandler = requestTimingMiddleware(handler as any, {
        submitMetrics: false
      })
      const request = createMockRequest('GET', 'http://localhost/api/test')

      await wrappedHandler(request)

      expect(mockSubmitMetric).not.toHaveBeenCalled()
    })

    it('should use custom endpoint name when provided', async () => {
      const handler = jest.fn().mockResolvedValue(
        new Response('OK', { status: 200 })
      )

      const wrappedHandler = requestTimingMiddleware(handler as any, {
        endpointName: 'custom-endpoint',
        submitMetrics: true
      })
      const request = createMockRequest('GET', 'http://localhost/api/test')

      await wrappedHandler(request)

      expect(mockSubmitMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: expect.arrayContaining(['endpoint:custom-endpoint'])
        })
      )
    })

    it('should pass context to handler', async () => {
      const handler = jest.fn().mockResolvedValue(
        new Response('OK', { status: 200 })
      )
      const context = { params: { id: '123' } }

      const wrappedHandler = requestTimingMiddleware(handler as any)
      const request = createMockRequest('GET', 'http://localhost/api/test/123')

      await wrappedHandler(request, context)

      expect(handler).toHaveBeenCalledWith(request, context)
    })
  })

  describe('createRequestTimer', () => {
    it('should create a timer with request metadata', () => {
      const { createPerformanceTimer } = require('@/lib/logging/performance-logger')
      const request = {
        method: 'POST',
        url: 'http://localhost/api/users'
      } as unknown as NextRequest

      createRequestTimer(request, { userId: '123' })

      expect(createPerformanceTimer).toHaveBeenCalledWith(
        'request:POST:/api/users',
        expect.objectContaining({
          method: 'POST',
          path: '/api/users',
          userId: '123'
        })
      )
    })
  })

  describe('Memory Tracking', () => {
    describe('getMemorySnapshot', () => {
      it('should return memory usage snapshot', () => {
        const snapshot = getMemorySnapshot()

        expect(snapshot.heapUsed).toBe(30 * 1024 * 1024)
        expect(snapshot.heapTotal).toBe(50 * 1024 * 1024)
        expect(snapshot.rss).toBe(100 * 1024 * 1024)
        expect(snapshot.heapUsedMB).toBeCloseTo(30, 0)
        expect(snapshot.heapTotalMB).toBeCloseTo(50, 0)
        expect(snapshot.rssMB).toBeCloseTo(100, 0)
        expect(snapshot.heapUsagePercent).toBeCloseTo(60, 0)
        expect(snapshot.timestamp).toBeDefined()
      })
    })

    describe('trackMemoryUsage', () => {
      it('should track and return memory snapshot', () => {
        const snapshot = trackMemoryUsage('test-label')

        expect(snapshot).toBeDefined()
        expect(snapshot.heapUsedMB).toBeCloseTo(30, 0)
      })

      it('should submit metrics when enabled', () => {
        trackMemoryUsage('test-label', true)

        expect(mockSubmitMetric).toHaveBeenCalledTimes(4) // heap_used, heap_total, rss, usage_percent
      })

      it('should skip metrics when disabled', () => {
        trackMemoryUsage('test-label', false)

        expect(mockSubmitMetric).not.toHaveBeenCalled()
      })
    })

    describe('withMemoryTracking', () => {
      it('should track memory delta around operation', async () => {
        let callCount = 0
        jest.spyOn(process, 'memoryUsage').mockImplementation(() => {
          callCount++
          return {
            rss: 100 * 1024 * 1024,
            heapTotal: 50 * 1024 * 1024,
            heapUsed: callCount === 1 ? 30 * 1024 * 1024 : 35 * 1024 * 1024,
            external: 10 * 1024 * 1024,
            arrayBuffers: 5 * 1024 * 1024
          }
        })

        const { result, memoryDeltaMB } = await withMemoryTracking(
          'test-operation',
          async () => 'test-result'
        )

        expect(result).toBe('test-result')
        expect(memoryDeltaMB).toBeCloseTo(5, 0)
      })

      it('should propagate errors and still track memory', async () => {
        await expect(
          withMemoryTracking('failing-operation', async () => {
            throw new Error('Test error')
          })
        ).rejects.toThrow('Test error')
      })
    })
  })

  describe('CPU Tracking', () => {
    describe('getCpuSnapshot', () => {
      it('should return CPU usage snapshot', () => {
        const snapshot = getCpuSnapshot()

        expect(snapshot.user).toBeDefined()
        expect(snapshot.system).toBeDefined()
        expect(snapshot.total).toBeDefined()
        expect(snapshot.usagePercent).toBeDefined()
        expect(snapshot.timestamp).toBeDefined()
      })
    })

    describe('trackCpuUsage', () => {
      it('should track and return CPU snapshot', () => {
        const snapshot = trackCpuUsage('test-label')

        expect(snapshot).toBeDefined()
        expect(snapshot.user).toBeDefined()
      })

      it('should submit metrics when enabled', () => {
        trackCpuUsage('test-label', true)

        expect(mockSubmitMetric).toHaveBeenCalledTimes(3) // usage_percent, user, system
      })

      it('should skip metrics when disabled', () => {
        trackCpuUsage('test-label', false)

        expect(mockSubmitMetric).not.toHaveBeenCalled()
      })
    })

    describe('withCpuTracking', () => {
      it('should track CPU usage around operation', async () => {
        const { result, cpuUsage } = await withCpuTracking(
          'test-operation',
          async () => 'test-result'
        )

        expect(result).toBe('test-result')
        expect(cpuUsage.user).toBeDefined()
        expect(cpuUsage.system).toBeDefined()
      })

      it('should propagate errors and still track CPU', async () => {
        await expect(
          withCpuTracking('failing-operation', async () => {
            throw new Error('Test error')
          })
        ).rejects.toThrow('Test error')
      })
    })
  })

  describe('Database Query Timing', () => {
    describe('trackDatabaseQuery', () => {
      it('should track query timing and return result', async () => {
        const mockResult = [{ id: 1, name: 'Test' }]

        const { result, queryName, durationMs } = await trackDatabaseQuery(
          'users.findMany',
          async () => mockResult
        )

        expect(result).toEqual(mockResult)
        expect(queryName).toBe('users.findMany')
        expect(durationMs).toBeDefined()
      })

      it('should detect row count from array results', async () => {
        const mockResult = [{ id: 1 }, { id: 2 }, { id: 3 }]

        const { rowCount } = await trackDatabaseQuery(
          'users.findMany',
          async () => mockResult
        )

        expect(rowCount).toBe(3)
      })

      it('should submit metrics when enabled', async () => {
        await trackDatabaseQuery(
          'users.findById',
          async () => ({ id: 1 }),
          { submitMetrics: true, table: 'users', operation: 'findUnique' }
        )

        expect(mockSubmitMetric).toHaveBeenCalled()
      })

      it('should skip metrics when disabled', async () => {
        await trackDatabaseQuery(
          'users.findById',
          async () => ({ id: 1 }),
          { submitMetrics: false }
        )

        expect(mockSubmitMetric).not.toHaveBeenCalled()
      })

      it('should handle query errors', async () => {
        await expect(
          trackDatabaseQuery('failing.query', async () => {
            throw new Error('Database error')
          })
        ).rejects.toThrow('Database error')

        expect(mockSubmitMetric).toHaveBeenCalledWith(
          expect.objectContaining({
            metric: 'vibecode.database.query_errors'
          })
        )
      })
    })

    describe('createDatabaseTimer', () => {
      it('should create a timer with database metadata', () => {
        const { createPerformanceTimer } = require('@/lib/logging/performance-logger')

        createDatabaseTimer('users.findMany', { table: 'users' })

        expect(createPerformanceTimer).toHaveBeenCalledWith(
          'db:users.findMany',
          expect.objectContaining({
            component: 'database',
            table: 'users'
          })
        )
      })
    })
  })

  describe('External API Call Timing', () => {
    describe('trackExternalApiCall', () => {
      it('should track API call timing and return result', async () => {
        const mockResult = { data: 'test' }

        const { result, serviceName, endpoint, durationMs } = await trackExternalApiCall(
          'openai',
          '/v1/chat/completions',
          async () => mockResult
        )

        expect(result).toEqual(mockResult)
        expect(serviceName).toBe('openai')
        expect(endpoint).toBe('/v1/chat/completions')
        expect(durationMs).toBeDefined()
      })

      it('should extract status code from Response objects', async () => {
        const mockResponse = new Response('OK', { status: 201 })

        const { statusCode } = await trackExternalApiCall(
          'test-api',
          '/endpoint',
          async () => mockResponse
        )

        expect(statusCode).toBe(201)
      })

      it('should submit metrics when enabled', async () => {
        await trackExternalApiCall(
          'test-api',
          '/endpoint',
          async () => ({ data: 'test' }),
          { submitMetrics: true, method: 'POST' }
        )

        expect(mockSubmitMetric).toHaveBeenCalledWith(
          expect.objectContaining({
            metric: 'vibecode.external_api.duration',
            tags: expect.arrayContaining([
              'service:test-api',
              'endpoint:/endpoint',
              'method:POST'
            ])
          })
        )
      })

      it('should handle API call errors', async () => {
        await expect(
          trackExternalApiCall('failing-api', '/endpoint', async () => {
            throw new Error('API error')
          })
        ).rejects.toThrow('API error')

        expect(mockSubmitMetric).toHaveBeenCalledWith(
          expect.objectContaining({
            metric: 'vibecode.external_api.errors'
          })
        )
      })
    })

    describe('createTimedFetch', () => {
      it('should create a fetch wrapper with timing', async () => {
        // Mock global fetch
        const mockFetch = jest.fn().mockResolvedValue(
          new Response('OK', { status: 200 })
        )
        global.fetch = mockFetch as unknown as typeof fetch

        const timedFetch = createTimedFetch('test-service', 'https://api.example.com')
        const { result, durationMs } = await timedFetch('/endpoint')

        expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/endpoint', undefined)
        expect(result.status).toBe(200)
        expect(durationMs).toBeDefined()
      })

      it('should pass request init options', async () => {
        const mockFetch = jest.fn().mockResolvedValue(
          new Response('OK', { status: 201 })
        )
        global.fetch = mockFetch as unknown as typeof fetch

        const timedFetch = createTimedFetch('test-service', 'https://api.example.com')
        await timedFetch('/endpoint', {
          method: 'POST',
          body: JSON.stringify({ data: 'test' })
        })

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.example.com/endpoint',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ data: 'test' })
          })
        )
      })
    })

    describe('createExternalApiTimer', () => {
      it('should create a timer with API metadata', () => {
        const { createPerformanceTimer } = require('@/lib/logging/performance-logger')

        createExternalApiTimer('openai', '/v1/models', { userId: '123' })

        expect(createPerformanceTimer).toHaveBeenCalledWith(
          'api:openai:/v1/models',
          expect.objectContaining({
            component: 'external-api',
            serviceName: 'openai',
            endpoint: '/v1/models',
            userId: '123'
          })
        )
      })
    })
  })

  describe('PerformanceTracker', () => {
    it('should track operation with checkpoints', () => {
      const tracker = new PerformanceTracker('complex-operation')

      tracker.checkpoint('step1')
      tracker.checkpoint('step2')

      const report = tracker.finish(false)

      expect(report.name).toBe('complex-operation')
      expect(report.totalDurationMs).toBeDefined()
      expect(report.memoryDeltaMB).toBeDefined()
      expect(report.cpuUsage).toBeDefined()
      expect(report.checkpoints).toHaveLength(2)
      expect(report.checkpoints[0].name).toBe('step1')
      expect(report.checkpoints[1].name).toBe('step2')
    })

    it('should calculate delta times between checkpoints', () => {
      const tracker = new PerformanceTracker('operation')

      tracker.checkpoint('first')
      tracker.checkpoint('second')

      const report = tracker.finish(false)

      expect(report.checkpoints[0].deltaMs).toBeDefined()
      expect(report.checkpoints[1].deltaMs).toBeDefined()
    })

    it('should submit metrics when enabled', () => {
      const tracker = new PerformanceTracker('tracked-operation')
      tracker.finish(true)

      expect(mockSubmitMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          metric: 'vibecode.operation.duration',
          tags: expect.arrayContaining(['operation:tracked-operation'])
        })
      )
    })

    it('should not submit metrics when disabled', () => {
      const tracker = new PerformanceTracker('untracked-operation')
      tracker.finish(false)

      expect(mockSubmitMetric).not.toHaveBeenCalled()
    })

    it('should provide formatted duration', () => {
      const tracker = new PerformanceTracker('operation')
      const report = tracker.finish(false)

      expect(report.formattedDuration).toBeDefined()
    })
  })
})
