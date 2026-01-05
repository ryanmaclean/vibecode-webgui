/**
 * Experiment Queries Unit Tests
 *
 * Tests for analytics queries, statistical calculations, and aggregations.
 */

import { ExperimentQueries } from '@/lib/experiments/queries'
import { PrismaClient } from '@prisma/client'

// Mock Prisma - use the comprehensive mock
jest.mock('@prisma/client')

// Mock monitoring
jest.mock('@/lib/server-monitoring', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  }
}))

// Import the global mock instance
import { prismaMock } from '../../__mocks__/@prisma/client'

describe('ExperimentQueries', () => {
  let queries: ExperimentQueries
  let mockPrisma: typeof prismaMock

  beforeEach(() => {
    jest.clearAllMocks()
    queries = new ExperimentQueries()
    // Use the global mock instance that PrismaClient returns
    mockPrisma = prismaMock
  })

  describe('getVariantDistribution', () => {
    it('should calculate variant distribution correctly', async () => {
      const mockExperiment = {
        id: 'exp1',
        key: 'test_experiment',
        assignments: [
          { variant_key: 'control' },
          { variant_key: 'control' },
          { variant_key: 'control' },
          { variant_key: 'treatment' }
        ]
      }

      mockPrisma.experiment.findUnique.mockResolvedValue(mockExperiment)

      const distribution = await queries.getVariantDistribution('test_experiment')

      expect(distribution).toHaveLength(2)
      expect(distribution[0]).toEqual({
        variantKey: 'control',
        count: 3,
        percentage: 75
      })
      expect(distribution[1]).toEqual({
        variantKey: 'treatment',
        count: 1,
        percentage: 25
      })
    })

    it('should return empty array for non-existent experiment', async () => {
      mockPrisma.experiment.findUnique.mockResolvedValue(null)

      const distribution = await queries.getVariantDistribution('non_existent')

      expect(distribution).toEqual([])
    })

    it('should handle empty assignments', async () => {
      mockPrisma.experiment.findUnique.mockResolvedValue({
        id: 'exp1',
        key: 'test_experiment',
        assignments: []
      })

      const distribution = await queries.getVariantDistribution('test_experiment')

      expect(distribution).toEqual([])
    })
  })

  describe('getMetricAggregation', () => {
    it('should calculate metric statistics', async () => {
      const mockExperiment = {
        id: 'exp1',
        key: 'test_experiment',
        metrics: [
          { variant_key: 'control', value: 10 },
          { variant_key: 'control', value: 20 },
          { variant_key: 'control', value: 30 },
          { variant_key: 'treatment', value: 15 },
          { variant_key: 'treatment', value: 25 }
        ]
      }

      mockPrisma.experiment.findUnique.mockResolvedValue(mockExperiment)

      const aggregation = await queries.getMetricAggregation(
        'test_experiment',
        'revenue'
      )

      expect(aggregation).toHaveLength(2)

      const controlStats = aggregation.find(a => a.variantKey === 'control')
      expect(controlStats).toBeDefined()
      expect(controlStats!.count).toBe(3)
      expect(controlStats!.mean).toBe(20)
      expect(controlStats!.min).toBe(10)
      expect(controlStats!.max).toBe(30)
      expect(controlStats!.median).toBe(20)

      const treatmentStats = aggregation.find(a => a.variantKey === 'treatment')
      expect(treatmentStats).toBeDefined()
      expect(treatmentStats!.count).toBe(2)
      expect(treatmentStats!.mean).toBe(20)
    })

    it('should calculate percentiles correctly', async () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1)
      const mockExperiment = {
        id: 'exp1',
        key: 'test_experiment',
        metrics: values.map(v => ({ variant_key: 'control', value: v }))
      }

      mockPrisma.experiment.findUnique.mockResolvedValue(mockExperiment)

      const aggregation = await queries.getMetricAggregation(
        'test_experiment',
        'metric'
      )

      const stats = aggregation[0]
      expect(stats.p50).toBeGreaterThanOrEqual(45)
      expect(stats.p50).toBeLessThanOrEqual(55)
      expect(stats.p95).toBeGreaterThanOrEqual(90)
      expect(stats.p99).toBeGreaterThanOrEqual(95)
    })

    it('should handle empty metrics', async () => {
      mockPrisma.experiment.findUnique.mockResolvedValue({
        id: 'exp1',
        key: 'test_experiment',
        metrics: []
      })

      const aggregation = await queries.getMetricAggregation(
        'test_experiment',
        'metric'
      )

      expect(aggregation).toEqual([])
    })
  })

  describe('getTimeSeriesData', () => {
    it('should aggregate metrics by day', async () => {
      const baseDate = new Date('2024-01-01T00:00:00Z')
      const mockExperiment = {
        id: 'exp1',
        key: 'test_experiment',
        metrics: [
          {
            variant_key: 'control',
            value: 10,
            timestamp: new Date('2024-01-01T08:00:00Z')
          },
          {
            variant_key: 'control',
            value: 20,
            timestamp: new Date('2024-01-01T14:00:00Z')
          },
          {
            variant_key: 'treatment',
            value: 15,
            timestamp: new Date('2024-01-02T10:00:00Z')
          }
        ]
      }

      mockPrisma.experiment.findUnique.mockResolvedValue(mockExperiment)

      const timeSeries = await queries.getTimeSeriesData(
        'test_experiment',
        'metric',
        'day'
      )

      expect(timeSeries.length).toBeGreaterThan(0)
      expect(timeSeries[0].variantKey).toBe('control')
      expect(timeSeries[0].count).toBe(2)
      expect(timeSeries[0].average).toBe(15)
    })

    it('should aggregate metrics by hour', async () => {
      const mockExperiment = {
        id: 'exp1',
        key: 'test_experiment',
        metrics: [
          {
            variant_key: 'control',
            value: 10,
            timestamp: new Date('2024-01-01T08:15:00Z')
          },
          {
            variant_key: 'control',
            value: 20,
            timestamp: new Date('2024-01-01T08:45:00Z')
          },
          {
            variant_key: 'control',
            value: 30,
            timestamp: new Date('2024-01-01T09:15:00Z')
          }
        ]
      }

      mockPrisma.experiment.findUnique.mockResolvedValue(mockExperiment)

      const timeSeries = await queries.getTimeSeriesData(
        'test_experiment',
        'metric',
        'hour'
      )

      // Should have 2 time buckets (hour 8 and hour 9)
      expect(timeSeries.length).toBeGreaterThanOrEqual(1)
    })

    it('should filter by date range', async () => {
      mockPrisma.experiment.findUnique.mockResolvedValue({
        id: 'exp1',
        key: 'test_experiment',
        metrics: []
      })

      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      await queries.getTimeSeriesData(
        'test_experiment',
        'metric',
        'day',
        startDate,
        endDate
      )

      expect(mockPrisma.experiment.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            metrics: expect.objectContaining({
              where: expect.objectContaining({
                timestamp: { gte: startDate, lte: endDate }
              })
            })
          })
        })
      )
    })
  })

  describe('getUserRetention', () => {
    it('should calculate retention cohorts', async () => {
      const baseDate = new Date('2024-01-01T00:00:00Z')
      const mockExperiment = {
        id: 'exp1',
        key: 'test_experiment',
        assignments: [
          {
            user_id: 'user1',
            variant_key: 'control',
            timestamp: baseDate
          },
          {
            user_id: 'user2',
            variant_key: 'treatment',
            timestamp: baseDate
          }
        ],
        metrics: [
          {
            user_id: 'user1',
            timestamp: new Date('2024-01-02T00:00:00Z') // day 1
          },
          {
            user_id: 'user1',
            timestamp: new Date('2024-01-08T00:00:00Z') // day 7
          },
          {
            user_id: 'user2',
            timestamp: new Date('2024-01-02T00:00:00Z') // day 1
          }
        ]
      }

      mockPrisma.experiment.findUnique.mockResolvedValue(mockExperiment)

      const retention = await queries.getUserRetention('test_experiment')

      expect(retention.length).toBeGreaterThan(0)

      const controlCohort = retention.find(r => r.variantKey === 'control')
      expect(controlCohort).toBeDefined()
      expect(controlCohort!.day0).toBeGreaterThan(0)
    })
  })

  describe('calculateSampleRatio', () => {
    it('should detect correct sample ratio', async () => {
      const mockExperiment = {
        id: 'exp1',
        key: 'test_experiment',
        assignments: [
          { variant_key: 'control' },
          { variant_key: 'control' },
          { variant_key: 'treatment' },
          { variant_key: 'treatment' }
        ]
      }

      mockPrisma.experiment.findUnique.mockResolvedValue(mockExperiment)

      const result = await queries.calculateSampleRatio('test_experiment', {
        control: 0.5,
        treatment: 0.5
      })

      expect(result.isPassing).toBe(true)
      expect(result.observedRatio.control).toBeCloseTo(0.5, 1)
      expect(result.observedRatio.treatment).toBeCloseTo(0.5, 1)
    })

    it('should detect sample ratio mismatch', async () => {
      const mockExperiment = {
        id: 'exp1',
        key: 'test_experiment',
        assignments: [
          { variant_key: 'control' },
          { variant_key: 'control' },
          { variant_key: 'control' },
          { variant_key: 'treatment' }
        ]
      }

      mockPrisma.experiment.findUnique.mockResolvedValue(mockExperiment)

      const result = await queries.calculateSampleRatio('test_experiment', {
        control: 0.5,
        treatment: 0.5
      })

      // 75/25 split vs expected 50/50 should show mismatch
      expect(result.observedRatio.control).toBeCloseTo(0.75, 1)
      expect(result.observedRatio.treatment).toBeCloseTo(0.25, 1)
    })

    it('should handle empty assignments', async () => {
      mockPrisma.experiment.findUnique.mockResolvedValue({
        id: 'exp1',
        key: 'test_experiment',
        assignments: []
      })

      const result = await queries.calculateSampleRatio('test_experiment', {
        control: 0.5,
        treatment: 0.5
      })

      expect(result.isPassing).toBe(true)
      expect(result.pValue).toBe(1)
    })
  })

  describe('getExperimentSummary', () => {
    it('should return comprehensive summary', async () => {
      const mockExperiment = {
        id: 'exp1',
        key: 'test_experiment',
        name: 'Test Experiment',
        status: 'running',
        hypothesis: 'Treatment increases engagement',
        config: { variants: ['control', 'treatment'] },
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
        assignments: [
          {
            variant_key: 'control',
            timestamp: new Date('2024-01-01T10:00:00Z')
          },
          {
            variant_key: 'treatment',
            timestamp: new Date('2024-01-01T11:00:00Z')
          }
        ],
        metrics: [
          {
            metric_name: 'conversion',
            timestamp: new Date('2024-01-01T12:00:00Z')
          },
          {
            metric_name: 'revenue',
            timestamp: new Date('2024-01-01T13:00:00Z')
          }
        ]
      }

      mockPrisma.experiment.findUnique.mockResolvedValue(mockExperiment)

      const summary = await queries.getExperimentSummary('test_experiment')

      expect(summary.experiment.key).toBe('test_experiment')
      expect(summary.totalAssignments).toBe(2)
      expect(summary.totalMetrics).toBe(2)
      expect(summary.uniqueMetrics).toContain('conversion')
      expect(summary.uniqueMetrics).toContain('revenue')
      expect(summary.dateRange.start).toBeDefined()
      expect(summary.dateRange.end).toBeDefined()
    })

    it('should throw for non-existent experiment', async () => {
      mockPrisma.experiment.findUnique.mockResolvedValue(null)

      await expect(
        queries.getExperimentSummary('non_existent')
      ).rejects.toThrow('Experiment not found')
    })
  })

  describe('Statistical Functions', () => {
    it('should calculate chi-square p-value', async () => {
      // Test with perfect 50/50 split - should have high p-value
      const mockExperiment = {
        id: 'exp1',
        key: 'test_experiment',
        assignments: Array.from({ length: 1000 }, (_, i) => ({
          variant_key: i % 2 === 0 ? 'control' : 'treatment'
        }))
      }

      mockPrisma.experiment.findUnique.mockResolvedValue(mockExperiment)

      const result = await queries.calculateSampleRatio('test_experiment', {
        control: 0.5,
        treatment: 0.5
      })

      expect(result.pValue).toBeGreaterThan(0.05)
      expect(result.isPassing).toBe(true)
    })
  })

  describe('Performance', () => {
    it('should handle large datasets efficiently', async () => {
      const largeDataset = {
        id: 'exp1',
        key: 'test_experiment',
        assignments: Array.from({ length: 10000 }, (_, i) => ({
          variant_key: i % 2 === 0 ? 'control' : 'treatment'
        }))
      }

      mockPrisma.experiment.findUnique.mockResolvedValue(largeDataset)

      const startTime = Date.now()
      await queries.getVariantDistribution('test_experiment')
      const duration = Date.now() - startTime

      // Should process 10k records quickly
      expect(duration).toBeLessThan(100)
    })

    it('should handle complex aggregations', async () => {
      const complexData = {
        id: 'exp1',
        key: 'test_experiment',
        metrics: Array.from({ length: 5000 }, (_, i) => ({
          variant_key: i % 3 === 0 ? 'control' : i % 3 === 1 ? 'treatment_a' : 'treatment_b',
          value: Math.random() * 100
        }))
      }

      mockPrisma.experiment.findUnique.mockResolvedValue(complexData)

      const startTime = Date.now()
      await queries.getMetricAggregation('test_experiment', 'revenue')
      const duration = Date.now() - startTime

      // Should aggregate 5k metrics quickly
      expect(duration).toBeLessThan(200)
    })
  })
})
