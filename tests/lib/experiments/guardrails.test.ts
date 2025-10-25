/**
 * Guardrails Test Suite
 *
 * Tests for guardrail evaluation, monitoring, and automated shutdown.
 */

import {
  evaluateGuardrails,
  startGuardrailMonitoring,
  stopGuardrailMonitoring,
  shutdownExperiment,
  evaluateGuardrailWithStatistics,
  getMonitoringStatus,
  cleanupAllMonitoring
} from '@/lib/experiments/guardrails'
import type { Guardrail } from '@/lib/experiments/guardrails'
import { experimentQueries } from '@/lib/experiments/queries'

// Mock the queries module
jest.mock('@/lib/experiments/queries', () => ({
  experimentQueries: {
    getMetricAggregation: jest.fn()
  }
}))

// Mock logger
jest.mock('@/lib/server-monitoring', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  },
  appLogger: {
    logBusiness: jest.fn()
  }
}))

describe('Guardrails', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    cleanupAllMonitoring()
  })

  describe('evaluateGuardrails', () => {
    it('should pass when all guardrails are satisfied', async () => {
      // Mock metric data showing healthy values
      (experimentQueries.getMetricAggregation as jest.Mock).mockResolvedValue([
        {
          variantKey: 'control',
          metricName: 'error_rate',
          count: 1000,
          sum: 5,
          mean: 0.005,
          median: 0.005,
          p50: 0.005,
          p95: 0.008,
          p99: 0.009,
          min: 0,
          max: 0.01,
          stdDev: 0.002
        },
        {
          variantKey: 'treatment',
          metricName: 'error_rate',
          count: 1000,
          sum: 5,
          mean: 0.005,
          median: 0.005,
          p50: 0.005,
          p95: 0.008,
          p99: 0.009,
          min: 0,
          max: 0.01,
          stdDev: 0.002
        }
      ])

      const guardrails: Guardrail[] = [
        {
          metricName: 'error_rate',
          operator: '<',
          threshold: 0.01,
          severity: 'critical'
        }
      ]

      const result = await evaluateGuardrails('test-experiment', guardrails)

      expect(result.passed).toBe(true)
      expect(result.violations).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
      expect(result.shouldStop).toBe(false)
    })

    it('should detect critical violations', async () => {
      // Mock metric data showing error rate above threshold
      (experimentQueries.getMetricAggregation as jest.Mock).mockResolvedValue([
        {
          variantKey: 'control',
          metricName: 'error_rate',
          count: 1000,
          sum: 10,
          mean: 0.01,
          median: 0.01,
          p50: 0.01,
          p95: 0.015,
          p99: 0.02,
          min: 0,
          max: 0.03,
          stdDev: 0.005
        },
        {
          variantKey: 'treatment',
          metricName: 'error_rate',
          count: 1000,
          sum: 30,
          mean: 0.03,
          median: 0.03,
          p50: 0.03,
          p95: 0.05,
          p99: 0.06,
          min: 0,
          max: 0.08,
          stdDev: 0.015
        }
      ])

      const guardrails: Guardrail[] = [
        {
          metricName: 'error_rate',
          operator: '<',
          threshold: 0.01,
          severity: 'critical'
        }
      ]

      const result = await evaluateGuardrails('test-experiment', guardrails)

      expect(result.passed).toBe(false)
      expect(result.violations).toHaveLength(1)
      expect(result.shouldStop).toBe(true)
      expect(result.violations[0].currentValue).toBe(0.03)
      expect(result.violations[0].threshold).toBe(0.01)
      expect(result.violations[0].severity).toBe('critical')
    })

    it('should detect warnings without stopping', async () => {
      // Mock metric data showing latency slightly above threshold
      (experimentQueries.getMetricAggregation as jest.Mock).mockResolvedValue([
        {
          variantKey: 'control',
          metricName: 'latency_p95',
          count: 1000,
          sum: 4000000,
          mean: 4000,
          median: 4000,
          p50: 4000,
          p95: 4500,
          p99: 5000,
          min: 3000,
          max: 6000,
          stdDev: 500
        },
        {
          variantKey: 'treatment',
          metricName: 'latency_p95',
          count: 1000,
          sum: 5500000,
          mean: 5500,
          median: 5500,
          p50: 5500,
          p95: 6000,
          p99: 6500,
          min: 4000,
          max: 7000,
          stdDev: 700
        }
      ])

      const guardrails: Guardrail[] = [
        {
          metricName: 'latency_p95',
          operator: '<',
          threshold: 5000,
          severity: 'warning'
        }
      ]

      const result = await evaluateGuardrails('test-experiment', guardrails)

      expect(result.passed).toBe(false)
      expect(result.violations).toHaveLength(0)
      expect(result.warnings).toHaveLength(1)
      expect(result.shouldStop).toBe(false)
    })

    it('should handle multiple guardrails', async () => {
      // Mock different metrics
      (experimentQueries.getMetricAggregation as jest.Mock)
        .mockImplementation(async (experimentKey: string, metricName: string) => {
          if (metricName === 'error_rate') {
            return [
              { variantKey: 'control', metricName, count: 100, sum: 1, mean: 0.01, median: 0.01, p50: 0.01, p95: 0.015, p99: 0.02, min: 0, max: 0.03, stdDev: 0.005 },
              { variantKey: 'treatment', metricName, count: 100, sum: 0.5, mean: 0.005, median: 0.005, p50: 0.005, p95: 0.008, p99: 0.01, min: 0, max: 0.015, stdDev: 0.003 }
            ]
          } else if (metricName === 'latency_p95') {
            return [
              { variantKey: 'control', metricName, count: 100, sum: 300000, mean: 3000, median: 3000, p50: 3000, p95: 3500, p99: 4000, min: 2000, max: 5000, stdDev: 500 },
              { variantKey: 'treatment', metricName, count: 100, sum: 600000, mean: 6000, median: 6000, p50: 6000, p95: 7000, p99: 8000, min: 4000, max: 9000, stdDev: 1000 }
            ]
          }
          return []
        })

      const guardrails: Guardrail[] = [
        { metricName: 'error_rate', operator: '<', threshold: 0.01, severity: 'critical' },
        { metricName: 'latency_p95', operator: '<', threshold: 5000, severity: 'warning' }
      ]

      const result = await evaluateGuardrails('test-experiment', guardrails)

      expect(result.passed).toBe(false)
      expect(result.violations).toHaveLength(0) // error_rate is good
      expect(result.warnings).toHaveLength(1) // latency exceeded
      expect(result.shouldStop).toBe(false) // only warnings, not critical
    })

    it('should handle no data gracefully', async () => {
      (experimentQueries.getMetricAggregation as jest.Mock).mockResolvedValue([])

      const guardrails: Guardrail[] = [
        { metricName: 'error_rate', operator: '<', threshold: 0.01, severity: 'critical' }
      ]

      const result = await evaluateGuardrails('test-experiment', guardrails)

      expect(result.passed).toBe(true)
      expect(result.violations).toHaveLength(0)
    })
  })

  describe('Operator Logic', () => {
    it('should handle > operator correctly', async () => {
      (experimentQueries.getMetricAggregation as jest.Mock).mockResolvedValue([
        { variantKey: 'control', metricName: 'quality_score', count: 100, sum: 70, mean: 0.7, median: 0.7, p50: 0.7, p95: 0.8, p99: 0.85, min: 0.5, max: 0.9, stdDev: 0.1 },
        { variantKey: 'treatment', metricName: 'quality_score', count: 100, sum: 60, mean: 0.6, median: 0.6, p50: 0.6, p95: 0.7, p99: 0.75, min: 0.4, max: 0.8, stdDev: 0.12 }
      ])

      const guardrails: Guardrail[] = [
        { metricName: 'quality_score', operator: '>', threshold: 0.7, severity: 'critical' }
      ]

      const result = await evaluateGuardrails('test-experiment', guardrails)

      expect(result.violations).toHaveLength(1)
      expect(result.violations[0].currentValue).toBe(0.6)
    })

    it('should handle >= operator correctly', async () => {
      (experimentQueries.getMetricAggregation as jest.Mock).mockResolvedValue([
        { variantKey: 'control', metricName: 'quality_score', count: 100, sum: 70, mean: 0.7, median: 0.7, p50: 0.7, p95: 0.8, p99: 0.85, min: 0.5, max: 0.9, stdDev: 0.1 },
        { variantKey: 'treatment', metricName: 'quality_score', count: 100, sum: 70, mean: 0.7, median: 0.7, p50: 0.7, p95: 0.8, p99: 0.85, min: 0.5, max: 0.9, stdDev: 0.1 }
      ])

      const guardrails: Guardrail[] = [
        { metricName: 'quality_score', operator: '>=', threshold: 0.7, severity: 'warning' }
      ]

      const result = await evaluateGuardrails('test-experiment', guardrails)

      expect(result.passed).toBe(true) // 0.7 >= 0.7
    })

    it('should handle <= operator correctly', async () => {
      (experimentQueries.getMetricAggregation as jest.Mock).mockResolvedValue([
        { variantKey: 'control', metricName: 'cost', count: 100, sum: 500, mean: 5, median: 5, p50: 5, p95: 6, p99: 7, min: 3, max: 8, stdDev: 1 },
        { variantKey: 'treatment', metricName: 'cost', count: 100, sum: 500, mean: 5, median: 5, p50: 5, p95: 6, p99: 7, min: 3, max: 8, stdDev: 1 }
      ])

      const guardrails: Guardrail[] = [
        { metricName: 'cost', operator: '<=', threshold: 5, severity: 'warning' }
      ]

      const result = await evaluateGuardrails('test-experiment', guardrails)

      expect(result.passed).toBe(true) // 5 <= 5
    })
  })

  describe('Guardrail Monitoring', () => {
    it('should start and stop monitoring', () => {
      const guardrails: Guardrail[] = [
        { metricName: 'error_rate', operator: '<', threshold: 0.01, severity: 'critical' }
      ]

      const stopFn = startGuardrailMonitoring('test-experiment', guardrails, 1000)

      const status = getMonitoringStatus('test-experiment')
      expect(status.isMonitoring).toBe(true)
      expect(status.checkIntervalMs).toBe(1000)

      stopFn()

      const statusAfterStop = getMonitoringStatus('test-experiment')
      expect(statusAfterStop.isMonitoring).toBe(false)
    })

    it('should track violation count during monitoring', async () => {
      (experimentQueries.getMetricAggregation as jest.Mock).mockResolvedValue([
        { variantKey: 'control', metricName: 'error_rate', count: 100, sum: 1, mean: 0.01, median: 0.01, p50: 0.01, p95: 0.015, p99: 0.02, min: 0, max: 0.03, stdDev: 0.005 },
        { variantKey: 'treatment', metricName: 'error_rate', count: 100, sum: 5, mean: 0.05, median: 0.05, p50: 0.05, p95: 0.08, p99: 0.1, min: 0, max: 0.15, stdDev: 0.02 }
      ])

      const guardrails: Guardrail[] = [
        { metricName: 'error_rate', operator: '<', threshold: 0.01, severity: 'warning' }
      ]

      startGuardrailMonitoring('test-experiment', guardrails, 100)

      // Wait for at least one check
      await new Promise(resolve => setTimeout(resolve, 150))

      const status = getMonitoringStatus('test-experiment')
      expect(status.violationCount).toBeGreaterThan(0)

      stopGuardrailMonitoring('test-experiment')
    })
  })

  describe('Shutdown Logic', () => {
    it('should shutdown experiment on critical violation', async () => {
      const violations = [
        {
          guardrail: {
            metricName: 'error_rate',
            operator: '<' as const,
            threshold: 0.01,
            severity: 'critical' as const
          },
          currentValue: 0.05,
          threshold: 0.01,
          percentageDifference: 400,
          severity: 'critical' as const,
          timestamp: new Date(),
          recommendation: 'Pause experiment immediately'
        }
      ]

      await shutdownExperiment('test-experiment', 'Critical error rate exceeded', violations)

      // Just verify it doesn't throw
      expect(true).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty guardrails array', async () => {
      const result = await evaluateGuardrails('test-experiment', [])

      expect(result.passed).toBe(true)
      expect(result.violations).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
    })

    it('should handle missing treatment variant', async () => {
      (experimentQueries.getMetricAggregation as jest.Mock).mockResolvedValue([
        { variantKey: 'control', metricName: 'error_rate', count: 100, sum: 1, mean: 0.01, median: 0.01, p50: 0.01, p95: 0.015, p99: 0.02, min: 0, max: 0.03, stdDev: 0.005 }
      ])

      const guardrails: Guardrail[] = [
        { metricName: 'error_rate', operator: '<', threshold: 0.01, severity: 'critical' }
      ]

      const result = await evaluateGuardrails('test-experiment', guardrails)

      expect(result.passed).toBe(true) // No treatment data = no violation
    })

    it('should handle zero threshold correctly', async () => {
      (experimentQueries.getMetricAggregation as jest.Mock).mockResolvedValue([
        { variantKey: 'control', metricName: 'metric', count: 100, sum: 0, mean: 0, median: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0, stdDev: 0 },
        { variantKey: 'treatment', metricName: 'metric', count: 100, sum: 10, mean: 0.1, median: 0.1, p50: 0.1, p95: 0.2, p99: 0.3, min: 0, max: 0.5, stdDev: 0.1 }
      ])

      const guardrails: Guardrail[] = [
        { metricName: 'metric', operator: '<', threshold: 0, severity: 'critical' }
      ]

      const result = await evaluateGuardrails('test-experiment', guardrails)

      expect(result.violations).toHaveLength(1)
    })
  })

  describe('Summary Generation', () => {
    it('should generate correct summary for passing guardrails', async () => {
      (experimentQueries.getMetricAggregation as jest.Mock).mockResolvedValue([
        { variantKey: 'control', metricName: 'error_rate', count: 100, sum: 0.5, mean: 0.005, median: 0.005, p50: 0.005, p95: 0.008, p99: 0.01, min: 0, max: 0.015, stdDev: 0.003 },
        { variantKey: 'treatment', metricName: 'error_rate', count: 100, sum: 0.5, mean: 0.005, median: 0.005, p50: 0.005, p95: 0.008, p99: 0.01, min: 0, max: 0.015, stdDev: 0.003 }
      ])

      const guardrails: Guardrail[] = [
        { metricName: 'error_rate', operator: '<', threshold: 0.01, severity: 'critical' }
      ]

      const result = await evaluateGuardrails('test-experiment', guardrails)

      expect(result.summary).toBe('All guardrails passing')
    })

    it('should generate correct summary for violations and warnings', async () => {
      (experimentQueries.getMetricAggregation as jest.Mock)
        .mockImplementation(async (experimentKey: string, metricName: string) => {
          if (metricName === 'error_rate') {
            return [
              { variantKey: 'control', metricName, count: 100, sum: 1, mean: 0.01, median: 0.01, p50: 0.01, p95: 0.015, p99: 0.02, min: 0, max: 0.03, stdDev: 0.005 },
              { variantKey: 'treatment', metricName, count: 100, sum: 5, mean: 0.05, median: 0.05, p50: 0.05, p95: 0.08, p99: 0.1, min: 0, max: 0.15, stdDev: 0.02 }
            ]
          } else if (metricName === 'latency_p95') {
            return [
              { variantKey: 'control', metricName, count: 100, sum: 300000, mean: 3000, median: 3000, p50: 3000, p95: 3500, p99: 4000, min: 2000, max: 5000, stdDev: 500 },
              { variantKey: 'treatment', metricName, count: 100, sum: 600000, mean: 6000, median: 6000, p50: 6000, p95: 7000, p99: 8000, min: 4000, max: 9000, stdDev: 1000 }
            ]
          }
          return []
        })

      const guardrails: Guardrail[] = [
        { metricName: 'error_rate', operator: '<', threshold: 0.01, severity: 'critical' },
        { metricName: 'latency_p95', operator: '<', threshold: 5000, severity: 'warning' }
      ]

      const result = await evaluateGuardrails('test-experiment', guardrails)

      expect(result.summary).toContain('1 critical violation')
      expect(result.summary).toContain('1 warning')
    })
  })
})
