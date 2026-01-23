/**
 * Experiment Warehouse Unit Tests
 *
 * Tests for assignment logging, metric tracking, batch processing,
 * and concurrent operations.
 */

import { ExperimentWarehouse } from '@/lib/experiments/warehouse'
import { PrismaClient } from '@prisma/client'

// Mock Prisma - use the comprehensive mock
jest.mock('@prisma/client')

// Mock monitoring
jest.mock('@/lib/server-monitoring', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  },
  appLogger: {
    logBusiness: jest.fn(),
    logPerformance: jest.fn()
  }
}))

// Import the global mock instance
import { prismaMock } from '../../__mocks__/@prisma/client'

describe('ExperimentWarehouse', () => {
  let warehouse: ExperimentWarehouse
  let mockPrisma: typeof prismaMock

  beforeEach(() => {
    jest.clearAllMocks()
    warehouse = new ExperimentWarehouse()
    // Use the global mock instance that PrismaClient returns
    mockPrisma = prismaMock
  })

  afterEach(async () => {
    // Only call stop if it exists (warehouse may not have this method)
    if (warehouse && typeof warehouse.stop === 'function') {
      await warehouse.stop()
    }
  })

  describe('logAssignment', () => {
    it('should buffer assignment for batch processing', async () => {
      await warehouse.logAssignment('test_experiment', 'user123', 'control')

      // Assignment should be buffered, not immediately written
      expect(mockPrisma.experimentAssignment.upsert).not.toHaveBeenCalled()
    })

    it('should log assignment with metadata', async () => {
      const metadata = { browser: 'chrome', region: 'us-east' }

      await warehouse.logAssignment(
        'test_experiment',
        'user123',
        'treatment',
        metadata
      )

      // Should be in buffer
      expect(mockPrisma.experimentAssignment.upsert).not.toHaveBeenCalled()
    })

    it('should flush when batch size is reached', async () => {
      mockPrisma.experiment.findUnique.mockResolvedValue({
        id: 'exp1',
        key: 'test_experiment',
        name: 'Test'
      })

      mockPrisma.experimentAssignment.upsert.mockResolvedValue({})

      // Log 100 assignments to trigger flush
      const promises = []
      for (let i = 0; i < 100; i++) {
        promises.push(
          warehouse.logAssignment('test_experiment', `user${i}`, 'control')
        )
      }
      await Promise.all(promises)

      // Should have flushed
      expect(mockPrisma.experiment.findUnique).toHaveBeenCalled()
    })
  })

  describe('logMetric', () => {
    it('should buffer metric for batch processing', async () => {
      await warehouse.logMetric('test_experiment', 'user123', 'conversion', 1.0)

      // Metric should be buffered, not immediately written
      expect(mockPrisma.experimentMetric.createMany).not.toHaveBeenCalled()
    })

    it('should log metric with metadata', async () => {
      const metadata = { source: 'checkout', currency: 'USD' }

      await warehouse.logMetric(
        'test_experiment',
        'user123',
        'revenue',
        99.99,
        metadata
      )

      // Should be in buffer
      expect(mockPrisma.experimentMetric.createMany).not.toHaveBeenCalled()
    })

    it('should flush when batch size is reached', async () => {
      mockPrisma.experiment.findUnique.mockResolvedValue({
        id: 'exp1',
        key: 'test_experiment',
        assignments: []
      })

      mockPrisma.experimentMetric.createMany.mockResolvedValue({ count: 100 })

      // Log 100 metrics to trigger flush
      const promises = []
      for (let i = 0; i < 100; i++) {
        promises.push(
          warehouse.logMetric('test_experiment', `user${i}`, 'conversion', 1.0)
        )
      }
      await Promise.all(promises)

      // Should have flushed
      expect(mockPrisma.experiment.findUnique).toHaveBeenCalled()
    })
  })

  describe('getAssignments', () => {
    it('should retrieve assignments for an experiment', async () => {
      const timestamp = new Date()
      const mockAssignments = [
        {
          id: 'a1',
          experimentId: 'exp1',
          userId: 'user1',
          variantKey: 'control',
          assignedAt: timestamp,
          metadata: null
        },
        {
          id: 'a2',
          experimentId: 'exp1',
          userId: 'user2',
          variantKey: 'treatment',
          assignedAt: timestamp,
          metadata: null
        }
      ]

      mockPrisma.experiment.findUnique.mockResolvedValue({
        id: 'exp1',
        key: 'test_experiment',
        assignments: mockAssignments
      })

      const assignments = await warehouse.getAssignments('test_experiment')

      // The warehouse maps assignments to include both camelCase and snake_case
      expect(assignments).toHaveLength(2)
      expect(assignments[0].id).toBe('a1')
      expect(assignments[0].userId).toBe('user1')
      expect(assignments[0].variantKey).toBe('control')
      expect(mockPrisma.experiment.findUnique).toHaveBeenCalledWith({
        where: { key: 'test_experiment' },
        include: {
          assignments: {
            orderBy: { assignedAt: 'desc' }
          }
        }
      })
    })

    it('should return empty array for non-existent experiment', async () => {
      mockPrisma.experiment.findUnique.mockResolvedValue(null)

      const assignments = await warehouse.getAssignments('non_existent')

      expect(assignments).toEqual([])
    })
  })

  describe('getMetrics', () => {
    it('should retrieve all metrics for an experiment', async () => {
      const mockMetrics = [
        {
          id: 'm1',
          experiment_id: 'exp1',
          user_id: 'user1',
          metric_name: 'conversion',
          value: 1.0,
          timestamp: new Date()
        }
      ]

      mockPrisma.experiment.findUnique.mockResolvedValue({
        id: 'exp1',
        key: 'test_experiment',
        metrics: mockMetrics
      })

      const metrics = await warehouse.getMetrics('test_experiment')

      expect(metrics).toEqual(mockMetrics)
    })

    it('should filter metrics by name', async () => {
      const mockMetrics = [
        {
          id: 'm1',
          experiment_id: 'exp1',
          metric_name: 'conversion',
          value: 1.0
        }
      ]

      mockPrisma.experiment.findUnique.mockResolvedValue({
        id: 'exp1',
        key: 'test_experiment',
        metrics: mockMetrics
      })

      await warehouse.getMetrics('test_experiment', 'conversion')

      expect(mockPrisma.experiment.findUnique).toHaveBeenCalledWith({
        where: { key: 'test_experiment' },
        include: {
          metrics: {
            where: { metric_name: 'conversion' },
            include: {
              assignment: true
            },
            orderBy: { timestamp: 'desc' }
          }
        }
      })
    })
  })

  describe('getExperimentResults', () => {
    it('should return aggregated results', async () => {
      const mockExperiment = {
        id: 'exp1',
        key: 'test_experiment',
        name: 'Test Experiment',
        status: 'running',
        config: { variants: ['control', 'treatment'] },
        assignments: [
          { variant_key: 'control', user_id: 'user1' },
          { variant_key: 'control', user_id: 'user2' },
          { variant_key: 'treatment', user_id: 'user3' }
        ],
        metrics: [
          { variant_key: 'control', metric_name: 'conversion', value: 1.0 },
          { variant_key: 'control', metric_name: 'conversion', value: 0.0 },
          { variant_key: 'treatment', metric_name: 'conversion', value: 1.0 }
        ]
      }

      mockPrisma.experiment.findUnique.mockResolvedValue(mockExperiment)

      const results = await warehouse.getExperimentResults('test_experiment')

      expect(results.experiment).toBeTruthy()
      expect(results.experiment?.key).toBe('test_experiment')
      expect(results.variantDistribution).toHaveProperty('control', 2)
      expect(results.variantDistribution).toHaveProperty('treatment', 1)
      expect(results.totalAssignments).toBe(3)
      expect(results.totalMetricEvents).toBe(3)
    })

    it('should handle experiment not found', async () => {
      mockPrisma.experiment.findUnique.mockResolvedValue(null)

      const results = await warehouse.getExperimentResults('non_existent')

      expect(results.experiment).toBeNull()
      expect(results.totalAssignments).toBe(0)
      expect(results.totalMetricEvents).toBe(0)
    })

    it('should calculate statistics correctly', async () => {
      const mockExperiment = {
        id: 'exp1',
        key: 'test_experiment',
        name: 'Test Experiment',
        status: 'running',
        config: {},
        assignments: [
          { variant_key: 'control', user_id: 'user1' }
        ],
        metrics: [
          { variant_key: 'control', metric_name: 'revenue', value: 10.0 },
          { variant_key: 'control', metric_name: 'revenue', value: 20.0 },
          { variant_key: 'control', metric_name: 'revenue', value: 30.0 }
        ]
      }

      mockPrisma.experiment.findUnique.mockResolvedValue(mockExperiment)

      const results = await warehouse.getExperimentResults('test_experiment')

      const stats = results.metrics['control_revenue']
      expect(stats).toBeDefined()
      expect(stats.count).toBe(3)
      expect(stats.mean).toBe(20.0)
      expect(stats.min).toBe(10.0)
      expect(stats.max).toBe(30.0)
    })
  })

  describe('upsertExperiment', () => {
    it('should create new experiment', async () => {
      const config = {
        variants: [
          { key: 'control', weight: 0.5 },
          { key: 'treatment', weight: 0.5 }
        ]
      }

      mockPrisma.experiment.upsert.mockResolvedValue({
        id: 'exp1',
        key: 'new_experiment',
        name: 'New Experiment',
        config,
        status: 'draft'
      })

      const result = await warehouse.upsertExperiment(
        'new_experiment',
        'New Experiment',
        config,
        'Hypothesis: Treatment increases engagement',
        'draft'
      )

      expect(result).toBeDefined()
      expect(mockPrisma.experiment.upsert).toHaveBeenCalled()
    })

    it('should update existing experiment', async () => {
      const config = { variants: [] }

      mockPrisma.experiment.upsert.mockResolvedValue({
        id: 'exp1',
        key: 'existing_experiment',
        status: 'running'
      })

      await warehouse.upsertExperiment(
        'existing_experiment',
        'Updated Name',
        config,
        undefined,
        'running'
      )

      expect(mockPrisma.experiment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'existing_experiment' },
          update: expect.objectContaining({
            name: 'Updated Name',
            status: 'running'
          })
        })
      )
    })
  })

  describe('Batch Processing', () => {
    it('should handle concurrent writes safely', async () => {
      mockPrisma.experiment.findUnique.mockResolvedValue({
        id: 'exp1',
        key: 'test_experiment'
      })
      mockPrisma.experimentAssignment.upsert.mockResolvedValue({})

      // Concurrent assignment logging
      const promises = []
      for (let i = 0; i < 200; i++) {
        promises.push(
          warehouse.logAssignment('test_experiment', `user${i}`, 'control')
        )
      }

      await Promise.all(promises)
      await warehouse.flush()

      // Should have made database calls
      expect(mockPrisma.experiment.findUnique).toHaveBeenCalled()
    })

    it('should flush on stop', async () => {
      mockPrisma.experiment.findUnique.mockResolvedValue({
        id: 'exp1',
        key: 'test_experiment',
        assignments: []
      })
      mockPrisma.experimentAssignment.upsert.mockResolvedValue({})
      mockPrisma.experimentMetric.createMany.mockResolvedValue({ count: 1 })

      await warehouse.logAssignment('test_experiment', 'user1', 'control')
      await warehouse.logMetric('test_experiment', 'user1', 'conversion', 1.0)

      await warehouse.stop()

      // Should have flushed both buffers
      expect(mockPrisma.experiment.findUnique).toHaveBeenCalled()
    })
  })

  describe('Performance', () => {
    it('should handle high-volume logging', async () => {
      const startTime = Date.now()

      // Log 1000 events
      for (let i = 0; i < 1000; i++) {
        await warehouse.logAssignment('test_experiment', `user${i}`, 'control')
      }

      const duration = Date.now() - startTime

      // Should complete in reasonable time (< 100ms for buffering)
      expect(duration).toBeLessThan(100)
    })

    it('should batch assignments by experiment', async () => {
      mockPrisma.experiment.findUnique.mockResolvedValue({
        id: 'exp1',
        key: 'test_experiment'
      })
      mockPrisma.experimentAssignment.upsert.mockResolvedValue({})

      // Log assignments for different experiments
      for (let i = 0; i < 50; i++) {
        await warehouse.logAssignment('experiment_a', `user${i}`, 'control')
        await warehouse.logAssignment('experiment_b', `user${i}`, 'treatment')
      }

      await warehouse.flush()

      // Should have queried for both experiments
      expect(mockPrisma.experiment.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'experiment_a' }
        })
      )
      expect(mockPrisma.experiment.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'experiment_b' }
        })
      )
    })
  })
})
