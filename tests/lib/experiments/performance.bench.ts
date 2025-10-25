/**
 * Performance Benchmarks for Experiment Warehouse
 *
 * Tests assignment logging throughput, batch processing efficiency,
 * and query performance under load.
 *
 * Run with: npm run test:performance -- performance.bench.ts
 */

import { ExperimentWarehouse } from '@/lib/experiments/warehouse'
import { ExperimentQueries } from '@/lib/experiments/queries'

// Performance tracking
interface BenchmarkResult {
  name: string
  operations: number
  duration: number
  opsPerSecond: number
  avgLatency: number
}

class PerformanceBenchmark {
  private results: BenchmarkResult[] = []

  /**
   * Run a benchmark test
   */
  async measure(
    name: string,
    operations: number,
    fn: () => Promise<void>
  ): Promise<BenchmarkResult> {
    const startTime = Date.now()

    await fn()

    const duration = Date.now() - startTime
    const opsPerSecond = (operations / duration) * 1000
    const avgLatency = duration / operations

    const result: BenchmarkResult = {
      name,
      operations,
      duration,
      opsPerSecond,
      avgLatency
    }

    this.results.push(result)
    return result
  }

  /**
   * Print benchmark results
   */
  printResults(): void {
    console.log('\n========================================')
    console.log('EXPERIMENT WAREHOUSE PERFORMANCE BENCHMARKS')
    console.log('========================================\n')

    for (const result of this.results) {
      console.log(`${result.name}:`)
      console.log(`  Operations: ${result.operations.toLocaleString()}`)
      console.log(`  Duration: ${result.duration.toLocaleString()}ms`)
      console.log(`  Throughput: ${Math.round(result.opsPerSecond).toLocaleString()} ops/sec`)
      console.log(`  Avg Latency: ${result.avgLatency.toFixed(3)}ms`)
      console.log()
    }
  }

  /**
   * Check if benchmark meets performance criteria
   */
  checkCriteria(name: string, minOpsPerSec: number): boolean {
    const result = this.results.find(r => r.name === name)
    if (!result) return false

    const passed = result.opsPerSecond >= minOpsPerSec
    console.log(
      `${name}: ${passed ? 'PASS' : 'FAIL'} ` +
      `(${Math.round(result.opsPerSecond)} ops/sec, ` +
      `required: ${minOpsPerSec} ops/sec)`
    )

    return passed
  }
}

/**
 * Mock Prisma for benchmarking
 */
const createMockPrisma = () => ({
  experiment: {
    findUnique: jest.fn().mockResolvedValue({
      id: 'exp1',
      key: 'test_experiment',
      name: 'Test',
      assignments: [],
      metrics: []
    }),
    upsert: jest.fn().mockResolvedValue({ id: 'exp1' })
  },
  experimentAssignment: {
    upsert: jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([])
  },
  experimentMetric: {
    createMany: jest.fn().mockResolvedValue({ count: 100 }),
    findMany: jest.fn().mockResolvedValue([])
  }
})

describe('Experiment Warehouse Performance Benchmarks', () => {
  let warehouse: ExperimentWarehouse
  let benchmark: PerformanceBenchmark

  beforeAll(() => {
    // Mock Prisma
    jest.mock('@prisma/client', () => ({
      PrismaClient: jest.fn(() => createMockPrisma())
    }))

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
  })

  beforeEach(() => {
    warehouse = new ExperimentWarehouse()
    benchmark = new PerformanceBenchmark()
  })

  afterEach(async () => {
    await warehouse.stop()
  })

  afterAll(() => {
    benchmark.printResults()
  })

  describe('Assignment Logging Throughput', () => {
    it('should log 1000 assignments in < 100ms (buffered)', async () => {
      const result = await benchmark.measure(
        'Assignment Logging (1000 ops)',
        1000,
        async () => {
          const promises = []
          for (let i = 0; i < 1000; i++) {
            promises.push(
              warehouse.logAssignment('test_experiment', `user${i}`, 'control')
            )
          }
          await Promise.all(promises)
        }
      )

      // Should handle 1000+ ops/sec (buffered, not written to DB)
      expect(result.opsPerSecond).toBeGreaterThan(1000)
      expect(result.duration).toBeLessThan(100)
    })

    it('should log 10000 assignments efficiently', async () => {
      const result = await benchmark.measure(
        'Assignment Logging (10000 ops)',
        10000,
        async () => {
          const promises = []
          for (let i = 0; i < 10000; i++) {
            promises.push(
              warehouse.logAssignment('test_experiment', `user${i}`, 'control')
            )
          }
          await Promise.all(promises)
        }
      )

      // Should maintain high throughput
      expect(result.opsPerSecond).toBeGreaterThan(5000)
    })
  })

  describe('Metric Logging Throughput', () => {
    it('should log 1000 metrics in < 100ms (buffered)', async () => {
      const result = await benchmark.measure(
        'Metric Logging (1000 ops)',
        1000,
        async () => {
          const promises = []
          for (let i = 0; i < 1000; i++) {
            promises.push(
              warehouse.logMetric('test_experiment', `user${i}`, 'conversion', 1.0)
            )
          }
          await Promise.all(promises)
        }
      )

      expect(result.opsPerSecond).toBeGreaterThan(1000)
      expect(result.duration).toBeLessThan(100)
    })

    it('should handle mixed metric types efficiently', async () => {
      const metricTypes = ['conversion', 'revenue', 'engagement', 'retention']

      const result = await benchmark.measure(
        'Mixed Metrics (5000 ops)',
        5000,
        async () => {
          const promises = []
          for (let i = 0; i < 5000; i++) {
            const metricName = metricTypes[i % metricTypes.length]
            promises.push(
              warehouse.logMetric('test_experiment', `user${i}`, metricName, Math.random() * 100)
            )
          }
          await Promise.all(promises)
        }
      )

      expect(result.opsPerSecond).toBeGreaterThan(3000)
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent assignments and metrics', async () => {
      const result = await benchmark.measure(
        'Concurrent Ops (2000 total)',
        2000,
        async () => {
          const promises = []
          for (let i = 0; i < 1000; i++) {
            promises.push(
              warehouse.logAssignment('test_experiment', `user${i}`, 'control')
            )
            promises.push(
              warehouse.logMetric('test_experiment', `user${i}`, 'conversion', 1.0)
            )
          }
          await Promise.all(promises)
        }
      )

      expect(result.opsPerSecond).toBeGreaterThan(1000)
    })

    it('should maintain performance under high concurrency', async () => {
      const result = await benchmark.measure(
        'High Concurrency (20000 ops)',
        20000,
        async () => {
          const promises = []
          for (let i = 0; i < 10000; i++) {
            promises.push(
              warehouse.logAssignment('test_experiment', `user${i}`, 'control')
            )
            promises.push(
              warehouse.logMetric('test_experiment', `user${i}`, 'conversion', 1.0)
            )
          }
          await Promise.all(promises)
        }
      )

      // Should still maintain reasonable throughput
      expect(result.opsPerSecond).toBeGreaterThan(3000)
    })
  })

  describe('Batch Processing Efficiency', () => {
    it('should batch process efficiently', async () => {
      // Fill buffer to trigger batch flush
      const promises = []
      for (let i = 0; i < 150; i++) {
        promises.push(
          warehouse.logAssignment('test_experiment', `user${i}`, 'control')
        )
      }
      await Promise.all(promises)

      const result = await benchmark.measure(
        'Batch Flush',
        1,
        async () => {
          await warehouse.flush()
        }
      )

      // Flush should be fast
      expect(result.duration).toBeLessThan(1000)
    })
  })

  describe('Query Performance', () => {
    it('should retrieve assignments quickly', async () => {
      const result = await benchmark.measure(
        'Get Assignments',
        1,
        async () => {
          await warehouse.getAssignments('test_experiment')
        }
      )

      // Query should complete in < 100ms
      expect(result.duration).toBeLessThan(100)
    })

    it('should retrieve metrics quickly', async () => {
      const result = await benchmark.measure(
        'Get Metrics',
        1,
        async () => {
          await warehouse.getMetrics('test_experiment', 'conversion')
        }
      )

      expect(result.duration).toBeLessThan(100)
    })

    it('should aggregate results efficiently', async () => {
      const result = await benchmark.measure(
        'Get Experiment Results',
        1,
        async () => {
          await warehouse.getExperimentResults('test_experiment')
        }
      )

      // Aggregation should complete in reasonable time
      expect(result.duration).toBeLessThan(200)
    })
  })

  describe('Memory Efficiency', () => {
    it('should handle large batches without memory issues', async () => {
      const initialMemory = process.memoryUsage().heapUsed

      // Log many events
      for (let i = 0; i < 10000; i++) {
        await warehouse.logAssignment('test_experiment', `user${i}`, 'control')
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024 // MB

      // Memory increase should be reasonable (< 50MB for 10k events)
      expect(memoryIncrease).toBeLessThan(50)
    })
  })

  describe('Performance Criteria Validation', () => {
    it('should meet all performance criteria', async () => {
      // Run all benchmarks
      await benchmark.measure(
        'Assignment Logging',
        1000,
        async () => {
          const promises = []
          for (let i = 0; i < 1000; i++) {
            promises.push(
              warehouse.logAssignment('test_experiment', `user${i}`, 'control')
            )
          }
          await Promise.all(promises)
        }
      )

      // Validate criteria
      console.log('\n=== Performance Criteria Validation ===')

      const criteria = [
        { name: 'Assignment Logging', minOpsPerSec: 1000 }
      ]

      let allPassed = true
      for (const criterion of criteria) {
        const passed = benchmark.checkCriteria(criterion.name, criterion.minOpsPerSec)
        allPassed = allPassed && passed
      }

      expect(allPassed).toBe(true)
    })
  })
})

/**
 * Manual benchmark runner (for local testing)
 */
if (require.main === module) {
  console.log('Running performance benchmarks...\n')

  const benchmark = new PerformanceBenchmark()
  const warehouse = new ExperimentWarehouse()

  ;(async () => {
    try {
      // Assignment logging benchmark
      await benchmark.measure(
        'Assignment Logging (1000 ops)',
        1000,
        async () => {
          const promises = []
          for (let i = 0; i < 1000; i++) {
            promises.push(
              warehouse.logAssignment('test_experiment', `user${i}`, 'control')
            )
          }
          await Promise.all(promises)
        }
      )

      // Metric logging benchmark
      await benchmark.measure(
        'Metric Logging (1000 ops)',
        1000,
        async () => {
          const promises = []
          for (let i = 0; i < 1000; i++) {
            promises.push(
              warehouse.logMetric('test_experiment', `user${i}`, 'conversion', 1.0)
            )
          }
          await Promise.all(promises)
        }
      )

      benchmark.printResults()

      // Validate criteria
      console.log('\n=== Performance Criteria ===')
      benchmark.checkCriteria('Assignment Logging (1000 ops)', 1000)
      benchmark.checkCriteria('Metric Logging (1000 ops)', 1000)

    } finally {
      await warehouse.stop()
    }
  })()
}
