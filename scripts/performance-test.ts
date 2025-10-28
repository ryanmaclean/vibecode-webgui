/**
 * Performance Testing Script for Experimentation Platform
 *
 * Measures:
 * - Assignment logging throughput
 * - Metrics aggregation latency
 * - Dashboard load time
 * - Statistical calculation performance
 * - Database query performance
 *
 * Usage:
 *   npm run perf-test
 *   npm run perf-test -- --test=assignment
 *   npm run perf-test -- --users=10000
 */

import { PrismaClient } from '@prisma/client'
import { performance } from 'perf_hooks'

const prisma = new PrismaClient()

// Configuration
const config = {
  experimentKey: 'perf_test_experiment',
  numUsers: parseInt(process.env.PERF_TEST_USERS || '10000'),
  batchSize: 100,
  verbose: process.env.VERBOSE === 'true'
}

// Test results storage
interface TestResult {
  name: string
  duration: number
  throughput?: number
  p50?: number
  p95?: number
  p99?: number
  samples?: number[]
}

const results: TestResult[] = []

// Utility functions
function log(message: string) {
  if (config.verbose) {
    console.log(`[${new Date().toISOString()}] ${message}`)
  }
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const index = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[index]
}

async function measureLatency<T>(
  name: string,
  fn: () => Promise<T>,
  iterations: number = 100
): Promise<TestResult> {
  log(`Running ${name}...`)
  const samples: number[] = []

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await fn()
    const duration = performance.now() - start
    samples.push(duration)

    if (i % 10 === 0) {
      log(`  ${name}: ${i}/${iterations} iterations`)
    }
  }

  const totalDuration = samples.reduce((a, b) => a + b, 0)

  return {
    name,
    duration: totalDuration,
    throughput: (iterations / totalDuration) * 1000, // ops/sec
    p50: percentile(samples, 50),
    p95: percentile(samples, 95),
    p99: percentile(samples, 99),
    samples
  }
}

async function measureThroughput(
  name: string,
  fn: (i: number) => Promise<void>,
  count: number
): Promise<TestResult> {
  log(`Running ${name}...`)
  const start = performance.now()

  // Execute in batches to avoid overwhelming the system
  const batchSize = config.batchSize
  for (let i = 0; i < count; i += batchSize) {
    const batch = Math.min(batchSize, count - i)
    const promises = Array.from({ length: batch }, (_, j) => fn(i + j))
    await Promise.all(promises)

    if (i % 1000 === 0) {
      log(`  ${name}: ${i}/${count} operations`)
    }
  }

  const duration = performance.now() - start
  const throughput = (count / duration) * 1000 // ops/sec

  return {
    name,
    duration,
    throughput,
    samples: []
  }
}

// Test functions
async function setupTestExperiment() {
  log('Setting up test experiment...')

  // Clean up existing test data
  await prisma.experimentMetric.deleteMany({
    where: { experiment: { key: config.experimentKey } }
  })
  await prisma.experimentAssignment.deleteMany({
    where: { experiment: { key: config.experimentKey } }
  })
  await prisma.experiment.deleteMany({
    where: { key: config.experimentKey }
  })

  // Create test experiment
  await prisma.experiment.create({
    data: {
      key: config.experimentKey,
      name: 'Performance Test Experiment',
      hypothesis: 'Performance testing',
      status: 'running',
      config: {
        variants: [
          { key: 'control', weight: 0.5 },
          { key: 'treatment', weight: 0.5 }
        ],
        metrics: [
          { name: 'test_metric', type: 'continuous' }
        ]
      }
    }
  })

  log('Test experiment created')
}

async function testAssignmentLogging() {
  log('Testing assignment logging throughput...')

  const result = await measureThroughput(
    'Assignment Logging',
    async (i) => {
      await prisma.experimentAssignment.create({
        data: {
          experiment: { connect: { key: config.experimentKey } },
          user_id: `perf_user_${i}`,
          variant_key: i % 2 === 0 ? 'control' : 'treatment',
          timestamp: new Date()
        }
      })
    },
    config.numUsers
  )

  results.push(result)
  return result
}

async function testMetricLogging() {
  log('Testing metric logging throughput...')

  const result = await measureThroughput(
    'Metric Logging',
    async (i) => {
      await prisma.experimentMetric.create({
        data: {
          experiment: { connect: { key: config.experimentKey } },
          user_id: `perf_user_${i}`,
          variant_key: i % 2 === 0 ? 'control' : 'treatment',
          metric_name: 'test_metric',
          value: Math.random() * 100,
          timestamp: new Date()
        }
      })
    },
    config.numUsers
  )

  results.push(result)
  return result
}

async function testBatchAssignmentLogging() {
  log('Testing batch assignment logging...')

  const start = performance.now()
  const batchSize = 1000

  for (let i = 0; i < config.numUsers; i += batchSize) {
    const batch = Math.min(batchSize, config.numUsers - i)
    await prisma.experimentAssignment.createMany({
      data: Array.from({ length: batch }, (_, j) => ({
        experiment_id: config.experimentKey,
        user_id: `batch_user_${i + j}`,
        variant_key: (i + j) % 2 === 0 ? 'control' : 'treatment',
        timestamp: new Date()
      })),
      skipDuplicates: true
    })

    if (i % 5000 === 0) {
      log(`  Batch Assignment: ${i}/${config.numUsers} users`)
    }
  }

  const duration = performance.now() - start
  const throughput = (config.numUsers / duration) * 1000

  const result: TestResult = {
    name: 'Batch Assignment Logging',
    duration,
    throughput
  }

  results.push(result)
  return result
}

async function testMetricsAggregation() {
  log('Testing metrics aggregation performance...')

  const result = await measureLatency(
    'Metrics Aggregation',
    async () => {
      await prisma.$queryRaw`
        SELECT
          variant_key,
          metric_name,
          COUNT(*) as count,
          AVG(value) as mean,
          STDDEV(value) as std_dev,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY value) as median,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value) as p95,
          PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY value) as p99
        FROM "ExperimentMetric"
        WHERE experiment_id = ${config.experimentKey}
        GROUP BY variant_key, metric_name
      `
    },
    50
  )

  results.push(result)
  return result
}

async function testVariantDistribution() {
  log('Testing variant distribution query...')

  const result = await measureLatency(
    'Variant Distribution',
    async () => {
      await prisma.$queryRaw`
        SELECT
          variant_key,
          COUNT(*) as count,
          COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() as percentage
        FROM "ExperimentAssignment"
        WHERE experiment_id = ${config.experimentKey}
        GROUP BY variant_key
      `
    },
    100
  )

  results.push(result)
  return result
}

async function testTimeSeriesQuery() {
  log('Testing time series query...')

  const result = await measureLatency(
    'Time Series Query',
    async () => {
      await prisma.$queryRaw`
        SELECT
          DATE_TRUNC('hour', timestamp) as date,
          variant_key,
          metric_name,
          COUNT(*) as count,
          AVG(value) as mean,
          STDDEV(value) as std_dev
        FROM "ExperimentMetric"
        WHERE
          experiment_id = ${config.experimentKey}
          AND timestamp >= NOW() - INTERVAL '7 days'
        GROUP BY date, variant_key, metric_name
        ORDER BY date ASC
      `
    },
    50
  )

  results.push(result)
  return result
}

async function testStatisticalCalculations() {
  log('Testing statistical calculations...')

  // Fetch data once
  const metrics = await prisma.experimentMetric.findMany({
    where: {
      experiment_id: config.experimentKey,
      metric_name: 'test_metric'
    },
    select: {
      variant_key: true,
      value: true
    }
  })

  const controlValues = metrics
    .filter(m => m.variant_key === 'control')
    .map(m => m.value)

  const treatmentValues = metrics
    .filter(m => m.variant_key === 'treatment')
    .map(m => m.value)

  // Test t-test calculation
  const tTestResult = await measureLatency(
    'T-Test Calculation',
    async () => {
      // Simplified t-test calculation
      const n1 = controlValues.length
      const n2 = treatmentValues.length

      const mean1 = controlValues.reduce((a, b) => a + b, 0) / n1
      const mean2 = treatmentValues.reduce((a, b) => a + b, 0) / n2

      const variance1 = controlValues.reduce((acc, val) =>
        acc + Math.pow(val - mean1, 2), 0) / (n1 - 1)
      const variance2 = treatmentValues.reduce((acc, val) =>
        acc + Math.pow(val - mean2, 2), 0) / (n2 - 1)

      const standardError = Math.sqrt(variance1 / n1 + variance2 / n2)
      const tStatistic = (mean2 - mean1) / standardError

      return tStatistic
    },
    1000
  )

  results.push(tTestResult)

  // Test bootstrap confidence intervals
  const bootstrapResult = await measureLatency(
    'Bootstrap CI (100 iterations)',
    async () => {
      const bootstrapMeans: number[] = []
      const iterations = 100

      for (let i = 0; i < iterations; i++) {
        const sample = []
        for (let j = 0; j < controlValues.length; j++) {
          const randomIndex = Math.floor(Math.random() * controlValues.length)
          sample.push(controlValues[randomIndex])
        }
        const mean = sample.reduce((a, b) => a + b, 0) / sample.length
        bootstrapMeans.push(mean)
      }

      bootstrapMeans.sort((a, b) => a - b)
      const lowerIndex = Math.floor(0.025 * iterations)
      const upperIndex = Math.floor(0.975 * iterations)

      return [bootstrapMeans[lowerIndex], bootstrapMeans[upperIndex]]
    },
    100
  )

  results.push(bootstrapResult)

  return { tTestResult, bootstrapResult }
}

async function testDatabaseIndexPerformance() {
  log('Testing database index performance...')

  // Test 1: Query with index (experiment_id)
  const withIndexResult = await measureLatency(
    'Query WITH Index (experiment_id)',
    async () => {
      await prisma.experimentAssignment.findMany({
        where: { experiment_id: config.experimentKey }
      })
    },
    100
  )

  results.push(withIndexResult)

  // Test 2: Complex query with multiple indexes
  const complexQueryResult = await measureLatency(
    'Complex Query (experiment_id + variant_key + metric_name)',
    async () => {
      await prisma.experimentMetric.findMany({
        where: {
          experiment_id: config.experimentKey,
          variant_key: 'control',
          metric_name: 'test_metric'
        }
      })
    },
    100
  )

  results.push(complexQueryResult)

  return { withIndexResult, complexQueryResult }
}

async function cleanupTestData() {
  log('Cleaning up test data...')

  await prisma.experimentMetric.deleteMany({
    where: { experiment: { key: config.experimentKey } }
  })
  await prisma.experimentAssignment.deleteMany({
    where: { experiment: { key: config.experimentKey } }
  })
  await prisma.experiment.deleteMany({
    where: { key: config.experimentKey }
  })

  log('Cleanup complete')
}

// Report generation
function generateReport() {
  console.log('\n' + '='.repeat(80))
  console.log('PERFORMANCE TEST RESULTS')
  console.log('='.repeat(80))
  console.log(`\nConfiguration:`)
  console.log(`  Users: ${config.numUsers.toLocaleString()}`)
  console.log(`  Batch Size: ${config.batchSize}`)
  console.log(`  Experiment: ${config.experimentKey}\n`)

  console.log('Throughput Tests:')
  console.log('-'.repeat(80))

  results
    .filter(r => r.throughput)
    .forEach(result => {
      console.log(`\n${result.name}:`)
      console.log(`  Duration: ${(result.duration / 1000).toFixed(2)}s`)
      console.log(`  Throughput: ${result.throughput!.toFixed(0)} ops/sec`)
    })

  console.log('\n\nLatency Tests:')
  console.log('-'.repeat(80))

  results
    .filter(r => r.p50)
    .forEach(result => {
      console.log(`\n${result.name}:`)
      console.log(`  p50: ${result.p50!.toFixed(2)}ms`)
      console.log(`  p95: ${result.p95!.toFixed(2)}ms`)
      console.log(`  p99: ${result.p99!.toFixed(2)}ms`)
    })

  console.log('\n' + '='.repeat(80))
  console.log('SUMMARY')
  console.log('='.repeat(80))

  const assignmentThroughput = results.find(r => r.name === 'Batch Assignment Logging')
  const metricAggregation = results.find(r => r.name === 'Metrics Aggregation')

  if (assignmentThroughput) {
    console.log(`\nAssignment Logging: ${assignmentThroughput.throughput!.toFixed(0)} ops/sec`)
  }

  if (metricAggregation) {
    console.log(`Metrics Aggregation: p95 = ${metricAggregation.p95!.toFixed(2)}ms`)
  }

  console.log('\n' + '='.repeat(80) + '\n')
}

// Main execution
async function main() {
  console.log('Starting performance tests...\n')

  const overallStart = performance.now()

  try {
    // Setup
    await setupTestExperiment()

    // Run tests
    await testBatchAssignmentLogging()
    await testMetricLogging()
    await testMetricsAggregation()
    await testVariantDistribution()
    await testTimeSeriesQuery()
    await testStatisticalCalculations()
    await testDatabaseIndexPerformance()

    // Generate report
    generateReport()

    // Cleanup
    await cleanupTestData()

    const overallDuration = performance.now() - overallStart
    console.log(`Total test duration: ${(overallDuration / 1000).toFixed(2)}s\n`)

  } catch (error) {
    console.error('Performance test failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run tests
if (require.main === module) {
  main()
    .then(() => {
      console.log('Performance tests completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Performance tests failed:', error)
      process.exit(1)
    })
}

export { main as runPerformanceTests }
