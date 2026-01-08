/**
 * Unit Tests for Health Monitoring Module
 * Tests the MetricsCollector, ApplicationLogger, performanceMiddleware, and getHealthCheck functions
 */

import { jest } from '@jest/globals'
import path from 'path'

// Define SpyInstance type directly since it's not properly exported
type SpyInstance = jest.SpiedFunction<any>

// Mock only essential logger methods to reduce test complexity
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}

jest.mock('winston', () => ({
  createLogger: jest.fn(() => mockLogger),
  format: {
    combine: jest.fn(() => ({})),
    timestamp: jest.fn(() => ({})),
    errors: jest.fn(() => ({})),
    json: jest.fn(() => ({})),
    printf: jest.fn(() => ({})),
    colorize: jest.fn(() => ({})),
    simple: jest.fn(() => ({}))
  },
  transports: {
    Console: jest.fn()
  }
}))

// Mock tracer - create a simple mock that doesn't require the actual module
const mockTracer = {
  init: jest.fn(),
  addTags: jest.fn()
}

const instrumentModulePath = path.join(process.cwd(), 'src/instrument')

const loadHealthMonitoring = () => {
  let module: any
  jest.isolateModules(() => {
    // Mock all possible import paths for the instrument module
    jest.doMock('../../instrument', () => ({
      __esModule: true,
      default: mockTracer
    }), { virtual: true })

    jest.doMock(instrumentModulePath, () => ({
      __esModule: true,
      default: mockTracer
    }), { virtual: true })

    jest.doMock('@/instrument', () => ({
      __esModule: true,
      default: mockTracer
    }), { virtual: true })

    module = require('@/lib/monitoring/health-monitoring')
  })
  return module
}

describe('Health Monitoring Module', () => {
  let consoleSpy: SpyInstance
  let processSpy: SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()

    // Reset tracer mock specifically
    mockTracer.init.mockClear()
    mockTracer.addTags.mockClear()

    // Mock console methods
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'info').mockImplementation(() => {})
    
    // Mock process methods
    processSpy = jest.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 100 * 1024 * 1024,
      heapTotal: 50 * 1024 * 1024,
      heapUsed: 30 * 1024 * 1024,
      external: 10 * 1024 * 1024,
      arrayBuffers: 5 * 1024 * 1024
    })
    jest.spyOn(process, 'uptime').mockReturnValue(3600)
    
    // Set up environment
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'test',
      configurable: true,
      writable: true
    })
    delete process.env.DD_API_KEY
  })

  afterEach(() => {
    jest.restoreAllMocks()
    mockTracer.init.mockClear()
    mockTracer.addTags.mockClear()
    delete (mockTracer as any).__healthMonitoringInitialized
  })

  describe('MetricsCollector', () => {
    let MetricsCollector: any
    let metrics: any

    beforeEach(() => {
      // Reset modules to get fresh instance
      const healthMonitoring = loadHealthMonitoring()
      MetricsCollector = healthMonitoring.MetricsCollector
      metrics = new MetricsCollector()
    })

    describe('increment', () => {
      it('should increment counter metrics', () => {
        metrics.increment('test.counter')
        
        expect(consoleSpy).toHaveBeenCalledWith(
          '📊 Metric increment: test.counter',
          {}
        )
        expect(metrics.getMetrics()['test.counter']).toBe(1)
      })

      it('should increment with tags', () => {
        metrics.increment('test.counter', { tag1: 'value1', tag2: 'value2' })
        
        expect(consoleSpy).toHaveBeenCalledWith(
          '📊 Metric increment: test.counter',
          { tag1: 'value1', tag2: 'value2' }
        )
        expect(metrics.getMetrics()['test.counter']).toBe(1)
      })

      it('should accumulate increments', () => {
        metrics.increment('test.counter')
        metrics.increment('test.counter')
        metrics.increment('test.counter')
        
        expect(metrics.getMetrics()['test.counter']).toBe(3)
      })
    })

    describe('gauge', () => {
      it('should set gauge metrics', () => {
        metrics.gauge('test.gauge', 42)
        
        expect(consoleSpy).toHaveBeenCalledWith(
          '📊 Metric gauge: test.gauge = 42',
          {}
        )
        expect(metrics.getMetrics()['test.gauge']).toBe(42)
      })

      it('should set gauge with tags', () => {
        metrics.gauge('test.gauge', 100, { environment: 'test' })
        
        expect(consoleSpy).toHaveBeenCalledWith(
          '📊 Metric gauge: test.gauge = 100',
          { environment: 'test' }
        )
        expect(metrics.getMetrics()['test.gauge']).toBe(100)
      })

      it('should overwrite previous gauge values', () => {
        metrics.gauge('test.gauge', 50)
        metrics.gauge('test.gauge', 75)
        
        expect(metrics.getMetrics()['test.gauge']).toBe(75)
      })
    })

    describe('histogram', () => {
      it('should add values to histogram', () => {
        metrics.histogram('test.histogram', 100)
        
        expect(consoleSpy).toHaveBeenCalledWith(
          '📊 Metric histogram: test.histogram = 100',
          {}
        )
        expect(metrics.getMetrics()['test.histogram']).toEqual([100])
      })

      it('should add multiple values to histogram', () => {
        metrics.histogram('test.histogram', 100)
        metrics.histogram('test.histogram', 200)
        metrics.histogram('test.histogram', 150)
        
        expect(metrics.getMetrics()['test.histogram']).toEqual([100, 200, 150])
      })

      it('should add histogram values with tags', () => {
        metrics.histogram('test.histogram', 300, { endpoint: '/api/test' })
        
        expect(consoleSpy).toHaveBeenCalledWith(
          '📊 Metric histogram: test.histogram = 300',
          { endpoint: '/api/test' }
        )
        expect(metrics.getMetrics()['test.histogram']).toEqual([300])
      })
    })

    describe('getMetrics', () => {
      it('should return all collected metrics', () => {
        metrics.increment('counter1')
        metrics.gauge('gauge1', 10)
        metrics.histogram('hist1', 5)
        
        const allMetrics = metrics.getMetrics()
        
        expect(allMetrics).toEqual({
          counter1: 1,
          gauge1: 10,
          hist1: [5]
        })
      })

      it('should return empty object when no metrics collected', () => {
        expect(metrics.getMetrics()).toEqual({})
      })
    })
  })

  describe('ApplicationLogger', () => {
    let ApplicationLogger: any
    let appLogger: any
    let metrics: any

    beforeEach(() => {
      const healthMonitoring = loadHealthMonitoring()
      ApplicationLogger = healthMonitoring.ApplicationLogger
      appLogger = new ApplicationLogger()
      metrics = healthMonitoring.metrics
    })

    describe('logPerformance', () => {
      it('should log performance metrics', () => {
        const context = {
          endpoint: '/api/users',
          method: 'GET',
          statusCode: 200,
          responseTime: 150,
          memoryUsage: 25.5
        }

        appLogger.logPerformance(context)

        expect(mockLogger.info).toHaveBeenCalledWith(
          'Performance: GET /api/users',
          {
            category: 'performance',
            ...context
          }
        )

        expect(consoleSpy).toHaveBeenCalledWith(
          '📊 Metric histogram: http.request.duration = 150',
          {
            endpoint: '/api/users',
            method: 'GET',
            status_code: 200
          }
        )

        expect(consoleSpy).toHaveBeenCalledWith(
          '📊 Metric gauge: memory.heap.used = 25.5',
          {
            endpoint: '/api/users'
          }
        )
      })

      it('should handle different HTTP methods and status codes', () => {
        const context = {
          endpoint: '/api/chat',
          method: 'POST',
          statusCode: 201,
          responseTime: 2500,
          memoryUsage: 45.2
        }

        appLogger.logPerformance(context)

        expect(mockLogger.info).toHaveBeenCalledWith(
          'Performance: POST /api/chat',
          expect.objectContaining({
            category: 'performance',
            method: 'POST',
            statusCode: 201
          })
        )
      })
    })

    describe('logSecurity', () => {
      it('should log security events', () => {
        const context = {
          userId: 'user123',
          ip: '192.168.1.1',
          severity: 'warn' as const,
          blocked: true,
          metadata: { reason: 'suspicious_activity' }
        }

        appLogger.logSecurity('login_attempt', context)

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Security: login_attempt',
          {
            category: 'security',
            ...context
          }
        )

        expect(consoleSpy).toHaveBeenCalledWith(
          '📊 Metric increment: security.events',
          {
            event: 'login_attempt',
            severity: 'warn',
            blocked: 'true'
          }
        )
      })

      it('should handle different severity levels', () => {
        const severities = ['info', 'warn', 'error', 'critical'] as const
        
        severities.forEach(severity => {
          appLogger.logSecurity('test_event', { severity })
          
          expect(consoleSpy).toHaveBeenCalledWith(
            '📊 Metric increment: security.events',
            expect.objectContaining({
              severity,
              blocked: 'false'
            })
          )
        })
      })

      it('should handle optional fields', () => {
        appLogger.logSecurity('minimal_event', { severity: 'info' })

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Security: minimal_event',
          {
            category: 'security',
            severity: 'info'
          }
        )
      })
    })

    describe('logBusiness', () => {
      it('should log business events', () => {
        const context = {
          userId: 'user456',
          workspaceId: 'workspace789',
          feature: 'ai_chat',
          value: 150,
          metadata: { model: 'gpt-4' }
        }

        appLogger.logBusiness('feature_usage', context)

        expect(mockLogger.info).toHaveBeenCalledWith(
          'Business: feature_usage',
          {
            category: 'business',
            ...context
          }
        )

        expect(consoleSpy).toHaveBeenCalledWith(
          '📊 Metric increment: business.events',
          {
            event: 'feature_usage',
            feature: 'ai_chat'
          }
        )

        expect(consoleSpy).toHaveBeenCalledWith(
          '📊 Metric histogram: business.value = 150',
          {
            event: 'feature_usage',
            feature: 'ai_chat'
          }
        )
      })

      it('should handle business events without value', () => {
        const context = {
          userId: 'user123',
          feature: 'workspace_creation'
        }

        appLogger.logBusiness('workspace_created', context)

        expect(consoleSpy).toHaveBeenCalledWith(
          '📊 Metric increment: business.events',
          {
            event: 'workspace_created',
            feature: 'workspace_creation'
          }
        )

        // Should not call histogram when no value provided
        expect(consoleSpy).not.toHaveBeenCalledWith(
          '📊 Metric histogram: business.value',
          expect.anything()
        )
      })

      it('should use unknown feature when not provided', () => {
        appLogger.logBusiness('unknown_event', { userId: 'user123' })

        expect(consoleSpy).toHaveBeenCalledWith(
          '📊 Metric increment: business.events',
          {
            event: 'unknown_event',
            feature: 'unknown'
          }
        )
      })
    })
  })

  describe('performanceMiddleware', () => {
    let performanceMiddleware: any
    let mockReq: any
    let mockRes: any
    let mockNext: any

    beforeEach(() => {
      const healthMonitoring = loadHealthMonitoring()
      performanceMiddleware = healthMonitoring.performanceMiddleware

      mockReq = {
        path: '/api/test',
        method: 'GET',
        query: { param: 'value' },
        params: { id: '123' }
      }

      mockRes = {
        statusCode: 200,
        on: jest.fn()
      }

      mockNext = jest.fn()
    })

    it('should create middleware function', () => {
      const middleware = performanceMiddleware()
      expect(typeof middleware).toBe('function')
    })

    it('should call next() immediately', () => {
      const middleware = performanceMiddleware()
      middleware(mockReq, mockRes, mockNext)
      
      expect(mockNext).toHaveBeenCalled()
    })

    it('should set up response finish listener', () => {
      const middleware = performanceMiddleware()
      middleware(mockReq, mockRes, mockNext)
      
      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function))
    })

    it('should log performance metrics on response finish', () => {
      const middleware = performanceMiddleware()
      middleware(mockReq, mockRes, mockNext)
      
      // Get the finish callback
      const finishCallback = mockRes.on.mock.calls[0][1]
      
      // Simulate response finish
      finishCallback()
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Performance: GET /api/test',
        expect.objectContaining({
          category: 'performance',
          endpoint: '/api/test',
          method: 'GET',
          statusCode: 200
        })
      )
    })

    it('should log slow requests', () => {
      // Mock Date.now to simulate slow request
      const originalNow = Date.now
      let callCount = 0
      Date.now = jest.fn(() => {
        callCount++
        return callCount === 1 ? 0 : 1500 // 1.5 second response time
      })

      const middleware = performanceMiddleware()
      middleware(mockReq, mockRes, mockNext)
      
      const finishCallback = mockRes.on.mock.calls[0][1]
      finishCallback()
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Slow request detected',
        {
          endpoint: '/api/test',
          method: 'GET',
          responseTime: 1500,
          query: { param: 'value' },
          params: { id: '123' }
        }
      )

      Date.now = originalNow
    })

    it('should not log slow requests for fast responses', () => {
      const originalNow = Date.now
      let callCount = 0
      Date.now = jest.fn(() => {
        callCount++
        return callCount === 1 ? 0 : 500 // 0.5 second response time
      })

      const middleware = performanceMiddleware()
      middleware(mockReq, mockRes, mockNext)
      
      const finishCallback = mockRes.on.mock.calls[0][1]
      finishCallback()
      
      expect(mockLogger.warn).not.toHaveBeenCalled()

      Date.now = originalNow
    })
  })

  describe('getHealthCheck', () => {
    let getHealthCheck: any
    let metrics: any

    beforeEach(() => {
      const healthMonitoring = loadHealthMonitoring()
      getHealthCheck = healthMonitoring.getHealthCheck
      metrics = healthMonitoring.metrics
    })

    it('should return health check data', () => {
      // Add some test metrics
      metrics.increment('test.counter')
      metrics.gauge('test.gauge', 42)

      const healthCheck = getHealthCheck()

      expect(healthCheck).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: 3600,
        memory: {
          rss: 100 * 1024 * 1024,
          heapTotal: 50 * 1024 * 1024,
          heapUsed: 30 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024
        },
        metrics: {
          'test.counter': 1,
          'test.gauge': 42
        }
      })
    })

    it('should return valid timestamp', () => {
      const healthCheck = getHealthCheck()
      const timestamp = new Date(healthCheck.timestamp)
      
      expect(timestamp).toBeInstanceOf(Date)
      expect(timestamp.getTime()).not.toBeNaN()
    })

    it('should return current uptime', () => {
      const healthCheck = getHealthCheck()
      expect(healthCheck.uptime).toBe(3600)
    })

    it('should return current memory usage', () => {
      const healthCheck = getHealthCheck()
      expect(healthCheck.memory).toEqual({
        rss: 100 * 1024 * 1024,
        heapTotal: 50 * 1024 * 1024,
        heapUsed: 30 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024
      })
    })

    it('should return current metrics', () => {
      metrics.histogram('test.histogram', 100)
      metrics.histogram('test.histogram', 200)

      const healthCheck = getHealthCheck()
      expect(healthCheck.metrics).toEqual({
        'test.histogram': [100, 200]
      })
    })
  })

  describe('Module initialization', () => {
    it('should initialize tracer when DD_API_KEY is present', () => {
      process.env.DD_API_KEY = 'test-key'

      // Reset mock call history
      mockTracer.init.mockClear()

      // CRITICAL: Reset modules first to clear any previous module cache
      // This ensures jest.isolateModules() works properly in full suite
      jest.resetModules()

      // Reset modules to trigger initialization
      loadHealthMonitoring()

      expect(mockTracer.init).toHaveBeenCalledWith({
        service: 'vibecode-webgui',
        env: 'test',
        version: '1.0.0',
        logInjection: true,
        runtimeMetrics: true,
        profiling: true,
        appsec: true
      })
      // Note: addTags removed as it's not a valid method on the tracer object
      // expect(mockTracer.addTags).toHaveBeenCalledWith({ 'service.component': 'health-monitoring' })
    })

    it('should warn when DD_API_KEY is missing', () => {
      delete process.env.DD_API_KEY
      
      // Reset modules to trigger initialization
      loadHealthMonitoring()
      
      expect(console.warn).toHaveBeenCalledWith(
        '⚠️ Datadog APM not configured (DD_API_KEY missing)'
      )
    })

    it('should initialize logger', () => {
      // Reset modules to trigger initialization
      loadHealthMonitoring()
      
      expect(mockLogger.info).toHaveBeenCalledWith('Winston logger initialized')
    })
  })
})
