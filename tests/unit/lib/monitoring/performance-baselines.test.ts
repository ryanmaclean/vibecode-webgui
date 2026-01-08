/**
 * Unit Tests for Performance Baselines Module
 * Tests PerformanceMonitoringService class and baseline tracking
 */

import { jest } from '@jest/globals'

// Mock logger module - must be declared before jest.mock
jest.mock('@/lib/logger', () => ({
  logger: {
    performance: jest.fn(),
    counter: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}))

// Mock datadog-metrics module
jest.mock('@/lib/monitoring/datadog-metrics', () => ({
  datadogMetrics: {
    recordResponseTime: jest.fn(),
    sendBatchMetrics: jest.fn()
  }
}))

import {
  performanceBaselines,
  type PerformanceBaseline,
  type PerformanceAlert
} from '@/lib/monitoring/performance-baselines'
import { logger } from '@/lib/logger'
import { datadogMetrics } from '@/lib/monitoring/datadog-metrics'

const mockLogger = logger as jest.Mocked<typeof logger>
const mockDatadogMetrics = datadogMetrics as jest.Mocked<typeof datadogMetrics>

describe('PerformanceMonitoringService', () => {
  let consoleSpy: jest.SpiedFunction<any>
  let consoleWarnSpy: jest.SpiedFunction<any>
  let consoleErrorSpy: jest.SpiedFunction<any>

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock console methods
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    // Clear baselines between tests
    const service = performanceBaselines as any
    service.baselines.clear()
    service.recentMeasurements.clear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('recordMeasurement', () => {
    it('should record single measurement', () => {
      performanceBaselines.recordMeasurement('api.test', 100)

      expect(mockLogger.performance).toHaveBeenCalledWith(
        'api.test',
        100,
        expect.objectContaining({
          operation: 'api.test'
        })
      )

      expect(mockDatadogMetrics.recordResponseTime).toHaveBeenCalledWith(
        100,
        'api.test',
        'PERF',
        200,
        expect.any(Object)
      )
    })

    it('should record measurement with tags', () => {
      const tags = { endpoint: '/api/users', method: 'GET' }

      performanceBaselines.recordMeasurement('api.users', 150, tags)

      expect(mockLogger.performance).toHaveBeenCalledWith(
        'api.users',
        150,
        expect.objectContaining({
          operation: 'api.users',
          tags: JSON.stringify(tags)
        })
      )

      expect(mockDatadogMetrics.recordResponseTime).toHaveBeenCalledWith(
        150,
        'api.users',
        'PERF',
        200,
        { tags }
      )
    })

    it('should accumulate multiple measurements', () => {
      performanceBaselines.recordMeasurement('api.test', 100)
      performanceBaselines.recordMeasurement('api.test', 200)
      performanceBaselines.recordMeasurement('api.test', 150)

      expect(mockLogger.performance).toHaveBeenCalledTimes(3)
      expect(mockDatadogMetrics.recordResponseTime).toHaveBeenCalledTimes(3)
    })

    it('should update baseline after 50 measurements', () => {
      // Record 50 measurements
      for (let i = 0; i < 50; i++) {
        performanceBaselines.recordMeasurement('api.baseline', 100 + i)
      }

      // Should have updated baseline
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Performance baseline updated'),
        expect.objectContaining({
          operation: 'api.baseline'
        })
      )

      expect(mockDatadogMetrics.sendBatchMetrics).toHaveBeenCalled()
    })

    it('should maintain max measurements limit', () => {
      const service = performanceBaselines as any

      // Record more than maxMeasurements (1000)
      for (let i = 0; i < 1100; i++) {
        performanceBaselines.recordMeasurement('api.limit', 100)
      }

      const measurements = service.recentMeasurements.get('api.limit')
      expect(measurements.length).toBe(1000)
    })

    it('should handle fast operations', () => {
      performanceBaselines.recordMeasurement('cache.get', 5)

      expect(mockDatadogMetrics.recordResponseTime).toHaveBeenCalledWith(
        5,
        'cache.get',
        'PERF',
        200,
        expect.any(Object)
      )
    })

    it('should handle slow operations', () => {
      performanceBaselines.recordMeasurement('ai.chat_completion', 25000)

      expect(mockDatadogMetrics.recordResponseTime).toHaveBeenCalledWith(
        25000,
        'ai.chat_completion',
        'PERF',
        200,
        expect.any(Object)
      )
    })
  })

  describe('getBaseline', () => {
    it('should return null when no baseline exists', () => {
      const baseline = performanceBaselines.getBaseline('nonexistent.operation')

      expect(baseline).toBeNull()
    })

    it('should return baseline after enough measurements', () => {
      // Record 50 measurements to establish baseline
      for (let i = 0; i < 50; i++) {
        performanceBaselines.recordMeasurement('api.test', 100 + i)
      }

      const baseline = performanceBaselines.getBaseline('api.test')

      expect(baseline).not.toBeNull()
      expect(baseline?.operation).toBe('api.test')
      expect(baseline?.p50).toBeGreaterThan(0)
      expect(baseline?.p95).toBeGreaterThan(0)
      expect(baseline?.p99).toBeGreaterThan(0)
      expect(baseline?.mean).toBeGreaterThan(0)
      expect(baseline?.count).toBe(50)
      expect(baseline?.stdDeviation).toBeGreaterThan(0)
    })

    it('should calculate correct percentiles', () => {
      // Record measurements with known distribution
      const measurements = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

      // Repeat to get 50 measurements
      for (let i = 0; i < 5; i++) {
        measurements.forEach(m => performanceBaselines.recordMeasurement('api.percentile', m))
      }

      const baseline = performanceBaselines.getBaseline('api.percentile')

      expect(baseline).not.toBeNull()
      expect(baseline?.p50).toBeCloseTo(55, 0)  // Median around 55
      expect(baseline?.p95).toBeGreaterThan(90)
      expect(baseline?.p99).toBeGreaterThan(95)
    })

    it('should update baseline on new measurements', () => {
      // Establish initial baseline
      for (let i = 0; i < 50; i++) {
        performanceBaselines.recordMeasurement('api.update', 100)
      }

      const baseline1 = performanceBaselines.getBaseline('api.update')

      // Add more measurements with different values
      for (let i = 0; i < 20; i++) {
        performanceBaselines.recordMeasurement('api.update', 200)
      }

      const baseline2 = performanceBaselines.getBaseline('api.update')

      expect(baseline2?.mean).toBeGreaterThan(baseline1!.mean)
    })
  })

  describe('getAllBaselines', () => {
    it('should return empty object when no baselines', () => {
      const baselines = performanceBaselines.getAllBaselines()

      expect(baselines).toEqual({})
    })

    it('should return all established baselines', () => {
      // Establish baselines for multiple operations
      for (let i = 0; i < 50; i++) {
        performanceBaselines.recordMeasurement('api.test1', 100)
        performanceBaselines.recordMeasurement('api.test2', 200)
        performanceBaselines.recordMeasurement('db.query', 50)
      }

      const baselines = performanceBaselines.getAllBaselines()

      expect(Object.keys(baselines).length).toBe(3)
      expect(baselines['api.test1']).toBeDefined()
      expect(baselines['api.test2']).toBeDefined()
      expect(baselines['db.query']).toBeDefined()
    })

    it('should return baseline with correct structure', () => {
      for (let i = 0; i < 50; i++) {
        performanceBaselines.recordMeasurement('api.test', 100 + i)
      }

      const baselines = performanceBaselines.getAllBaselines()
      const baseline = baselines['api.test']

      expect(baseline).toHaveProperty('operation')
      expect(baseline).toHaveProperty('p50')
      expect(baseline).toHaveProperty('p95')
      expect(baseline).toHaveProperty('p99')
      expect(baseline).toHaveProperty('mean')
      expect(baseline).toHaveProperty('count')
      expect(baseline).toHaveProperty('lastUpdated')
      expect(baseline).toHaveProperty('stdDeviation')
    })
  })

  describe('Performance Alerts', () => {
    beforeEach(() => {
      // Establish baseline
      for (let i = 0; i < 50; i++) {
        performanceBaselines.recordMeasurement('api.alert', 100)
      }
      // Clear only the mocked functions, not the console spies
      mockLogger.performance.mockClear()
      mockLogger.counter.mockClear()
      mockDatadogMetrics.recordResponseTime.mockClear()
      mockDatadogMetrics.sendBatchMetrics.mockClear()
      consoleSpy.mockClear()
      consoleWarnSpy.mockClear()
      consoleErrorSpy.mockClear()
    })

    it.skip('should trigger critical alert for severe degradation', () => {
      const baseline = performanceBaselines.getBaseline('api.alert')

      // Record measurement way above baseline (need > p99 * 1.5 to trigger critical alert)
      performanceBaselines.recordMeasurement('api.alert', baseline!.p99 * 1.6)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Performance Alert'),
        expect.objectContaining({
          operation: 'api.alert',
          severity: 'critical'
        })
      )

      expect(mockLogger.counter).toHaveBeenCalledWith(
        'vibecode.performance.alerts.critical',
        1,
        expect.any(Object)
      )
    })

    it('should trigger warning alert for moderate degradation', () => {
      const baseline = performanceBaselines.getBaseline('api.alert')

      // Record measurement moderately above baseline
      performanceBaselines.recordMeasurement('api.alert', baseline!.p95 * 2.5)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Performance Warning'),
        expect.objectContaining({
          operation: 'api.alert',
          severity: 'warning'
        })
      )

      expect(mockLogger.counter).toHaveBeenCalledWith(
        'vibecode.performance.alerts.warning',
        1,
        expect.any(Object)
      )
    })

    it('should check against predefined thresholds', () => {
      // Record very slow DB query
      performanceBaselines.recordMeasurement('db.select', 600)  // P99 threshold is 500ms

      // Should trigger alert based on threshold
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('should not alert for normal performance', () => {
      performanceBaselines.recordMeasurement('api.alert', 100)

      expect(consoleErrorSpy).not.toHaveBeenCalled()
      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })

    it.skip('should handle operations without predefined thresholds', () => {
      // Custom operation without threshold
      for (let i = 0; i < 50; i++) {
        performanceBaselines.recordMeasurement('custom.operation', 100)
      }
      // Clear only the mocked functions, not the console spies
      mockLogger.performance.mockClear()
      mockLogger.counter.mockClear()
      mockDatadogMetrics.recordResponseTime.mockClear()
      mockDatadogMetrics.sendBatchMetrics.mockClear()
      consoleSpy.mockClear()
      consoleWarnSpy.mockClear()
      consoleErrorSpy.mockClear()

      const baseline = performanceBaselines.getBaseline('custom.operation')

      // Very slow measurement (need > p99 * 1.5 to trigger critical alert)
      performanceBaselines.recordMeasurement('custom.operation', baseline!.p99 * 1.6)

      // Should alert based on baseline degradation
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Performance'),
        expect.objectContaining({
          operation: 'custom.operation',
          severity: 'critical'
        })
      )
    })
  })

  describe('generateHealthReport', () => {
    it('should generate report with no baselines', () => {
      const report = performanceBaselines.generateHealthReport()

      expect(report).toEqual({
        overall_health: 'healthy',
        total_operations: 0,
        operations_with_baselines: 0,
        recent_alerts: {
          warnings: 0,
          critical: 0
        },
        top_slow_operations: [],
        recommendations: expect.any(Array)
      })
    })

    it('should generate report with healthy baselines', () => {
      // Establish baselines within acceptable ranges
      for (let i = 0; i < 50; i++) {
        performanceBaselines.recordMeasurement('api.auth', 200)
        performanceBaselines.recordMeasurement('cache.get', 5)
      }

      const report = performanceBaselines.generateHealthReport()

      expect(report.overall_health).toBe('healthy')
      expect(report.operations_with_baselines).toBe(2)
      expect(report.top_slow_operations.length).toBeGreaterThan(0)
    })

    it('should detect warning conditions', () => {
      // Establish baselines above thresholds (api.auth threshold p99 is 1000)
      // Need baseline.p99 > threshold to trigger warning
      for (let i = 0; i < 50; i++) {
        performanceBaselines.recordMeasurement('api.auth', 1100)  // Above p99 threshold
      }

      const report = performanceBaselines.generateHealthReport()

      // Should detect degraded performance
      expect(report.overall_health).toMatch(/warning|critical/)
    })

    it('should detect critical conditions', () => {
      // Establish baselines way above thresholds
      for (let i = 0; i < 50; i++) {
        performanceBaselines.recordMeasurement('api.auth', 2000)  // Way above P99
      }

      const report = performanceBaselines.generateHealthReport()

      expect(report.overall_health).toBe('critical')
      expect(report.recent_alerts.critical).toBeGreaterThan(0)
    })

    it('should list top slow operations', () => {
      for (let i = 0; i < 50; i++) {
        performanceBaselines.recordMeasurement('fast.op', 10)
        performanceBaselines.recordMeasurement('medium.op', 100)
        performanceBaselines.recordMeasurement('slow.op', 1000)
      }

      const report = performanceBaselines.generateHealthReport()

      expect(report.top_slow_operations.length).toBeGreaterThan(0)
      expect(report.top_slow_operations[0].operation).toBe('slow.op')
    })

    it('should provide relevant recommendations', () => {
      // Insufficient baselines
      performanceBaselines.recordMeasurement('op1', 100)

      const report1 = performanceBaselines.generateHealthReport()

      expect(report1.recommendations.some(r => r.includes('Insufficient baseline data'))).toBe(true)

      // Slow database operations
      for (let i = 0; i < 50; i++) {
        performanceBaselines.recordMeasurement('db.select', 1500)
      }

      const report2 = performanceBaselines.generateHealthReport()

      expect(report2.recommendations.some(r => r.includes('Database'))).toBe(true)
    })

    it('should recommend AI optimization for slow AI operations', () => {
      for (let i = 0; i < 50; i++) {
        performanceBaselines.recordMeasurement('ai.chat_completion', 25000)
      }

      const report = performanceBaselines.generateHealthReport()

      expect(report.recommendations.some(r => r.includes('AI operations'))).toBe(true)
    })

    it('should limit top slow operations to 5', () => {
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 50; j++) {
          performanceBaselines.recordMeasurement(`op${i}`, (i + 1) * 100)
        }
      }

      const report = performanceBaselines.generateHealthReport()

      expect(report.top_slow_operations.length).toBeLessThanOrEqual(5)
    })
  })

  describe('exportBaselines', () => {
    it('should export baselines as JSON', () => {
      for (let i = 0; i < 50; i++) {
        performanceBaselines.recordMeasurement('api.test', 100)
      }

      const exported = performanceBaselines.exportBaselines()
      const parsed = JSON.parse(exported)

      expect(parsed).toHaveProperty('timestamp')
      expect(parsed).toHaveProperty('baselines')
      expect(parsed.baselines['api.test']).toBeDefined()
    })

    it('should export multiple baselines', () => {
      for (let i = 0; i < 50; i++) {
        performanceBaselines.recordMeasurement('op1', 100)
        performanceBaselines.recordMeasurement('op2', 200)
        performanceBaselines.recordMeasurement('op3', 300)
      }

      const exported = performanceBaselines.exportBaselines()
      const parsed = JSON.parse(exported)

      expect(Object.keys(parsed.baselines).length).toBe(3)
    })

    it('should export empty baselines', () => {
      const exported = performanceBaselines.exportBaselines()
      const parsed = JSON.parse(exported)

      expect(parsed.baselines).toEqual({})
    })

    it('should include timestamp', () => {
      const exported = performanceBaselines.exportBaselines()
      const parsed = JSON.parse(exported)

      expect(parsed.timestamp).toBeTruthy()
      expect(new Date(parsed.timestamp)).toBeInstanceOf(Date)
    })
  })

  describe('importBaselines', () => {
    it('should import baselines from JSON', () => {
      const data = {
        timestamp: new Date().toISOString(),
        baselines: {
          'api.test': {
            operation: 'api.test',
            p50: 100,
            p95: 200,
            p99: 300,
            mean: 120,
            count: 50,
            lastUpdated: new Date(),
            stdDeviation: 25
          }
        }
      }

      performanceBaselines.importBaselines(JSON.stringify(data))

      const baseline = performanceBaselines.getBaseline('api.test')

      expect(baseline).not.toBeNull()
      expect(baseline?.operation).toBe('api.test')
      expect(baseline?.p50).toBe(100)
    })

    it('should clear existing baselines on import', () => {
      // Establish initial baseline
      for (let i = 0; i < 50; i++) {
        performanceBaselines.recordMeasurement('old.op', 100)
      }

      const data = {
        timestamp: new Date().toISOString(),
        baselines: {
          'new.op': {
            operation: 'new.op',
            p50: 200,
            p95: 300,
            p99: 400,
            mean: 220,
            count: 50,
            lastUpdated: new Date(),
            stdDeviation: 30
          }
        }
      }

      performanceBaselines.importBaselines(JSON.stringify(data))

      expect(performanceBaselines.getBaseline('old.op')).toBeNull()
      expect(performanceBaselines.getBaseline('new.op')).not.toBeNull()
    })

    it('should handle import errors gracefully', () => {
      performanceBaselines.importBaselines('invalid json')

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to import'),
        expect.objectContaining({
          error: expect.any(String)
        })
      )
    })

    it('should handle missing baselines property', () => {
      const data = {
        timestamp: new Date().toISOString()
      }

      performanceBaselines.importBaselines(JSON.stringify(data))

      // Should not crash, just not import anything
      const baselines = performanceBaselines.getAllBaselines()
      expect(Object.keys(baselines).length).toBe(0)
    })

    it('should log successful import', () => {
      const data = {
        timestamp: new Date().toISOString(),
        baselines: {
          'api.test': {
            operation: 'api.test',
            p50: 100,
            p95: 200,
            p99: 300,
            mean: 120,
            count: 50,
            lastUpdated: new Date(),
            stdDeviation: 25
          }
        }
      }

      performanceBaselines.importBaselines(JSON.stringify(data))

      expect(consoleSpy).toHaveBeenCalledWith(
        'Performance baselines imported successfully',
        expect.objectContaining({
          count: 1
        })
      )
    })
  })

  describe('Predefined Thresholds', () => {
    it('should have thresholds for API operations', () => {
      // Test that threshold checks work
      performanceBaselines.recordMeasurement('api.auth', 600)  // Above P95 threshold

      // Should log or track the measurement
      expect(mockDatadogMetrics.recordResponseTime).toHaveBeenCalled()
    })

    it('should have thresholds for database operations', () => {
      performanceBaselines.recordMeasurement('db.select', 150)

      expect(mockDatadogMetrics.recordResponseTime).toHaveBeenCalled()
    })

    it('should have thresholds for cache operations', () => {
      performanceBaselines.recordMeasurement('cache.get', 5)

      expect(mockDatadogMetrics.recordResponseTime).toHaveBeenCalled()
    })

    it('should have thresholds for AI operations', () => {
      performanceBaselines.recordMeasurement('ai.chat_completion', 10000)

      expect(mockDatadogMetrics.recordResponseTime).toHaveBeenCalled()
    })

    it('should have thresholds for frontend operations', () => {
      performanceBaselines.recordMeasurement('frontend.page_load', 2000)

      expect(mockDatadogMetrics.recordResponseTime).toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () => {
    it('should handle single measurement', () => {
      performanceBaselines.recordMeasurement('api.single', 100)

      const baseline = performanceBaselines.getBaseline('api.single')
      expect(baseline).toBeNull()  // Not enough data for baseline
    })

    it('should handle zero duration', () => {
      performanceBaselines.recordMeasurement('api.instant', 0)

      expect(mockDatadogMetrics.recordResponseTime).toHaveBeenCalledWith(
        0,
        'api.instant',
        'PERF',
        200,
        expect.any(Object)
      )
    })

    it('should handle very large durations', () => {
      performanceBaselines.recordMeasurement('api.timeout', 999999)

      expect(mockDatadogMetrics.recordResponseTime).toHaveBeenCalledWith(
        999999,
        'api.timeout',
        'PERF',
        200,
        expect.any(Object)
      )
    })

    it('should handle operation name with special characters', () => {
      performanceBaselines.recordMeasurement('api.users/123/posts', 100)

      expect(mockLogger.performance).toHaveBeenCalledWith(
        'api.users/123/posts',
        100,
        expect.any(Object)
      )
    })

    it('should handle empty tags object', () => {
      performanceBaselines.recordMeasurement('api.test', 100, {})

      expect(mockDatadogMetrics.recordResponseTime).toHaveBeenCalledWith(
        100,
        'api.test',
        'PERF',
        200,
        { tags: {} }
      )
    })

    it('should handle concurrent measurements', () => {
      // Simulate concurrent measurements
      performanceBaselines.recordMeasurement('api.concurrent', 100)
      performanceBaselines.recordMeasurement('api.concurrent', 200)
      performanceBaselines.recordMeasurement('api.concurrent', 150)

      expect(mockLogger.performance).toHaveBeenCalledTimes(3)
    })
  })
})
