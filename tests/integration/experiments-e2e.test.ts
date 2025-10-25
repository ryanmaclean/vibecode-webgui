/**
 * End-to-End Integration Tests for Experimentation Platform
 *
 * Tests the complete experiment lifecycle from creation to analysis.
 * Validates all API endpoints, statistical calculations, and business logic.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

// Helper to make API requests
async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const data = await response.json()
  return { response, data }
}

// Test data setup
const testExperiment = {
  key: 'e2e_test_experiment',
  name: 'E2E Test Experiment',
  hypothesis: 'Test hypothesis',
  config: {
    variants: [
      { key: 'control', name: 'Control', weight: 0.5 },
      { key: 'treatment', name: 'Treatment', weight: 0.5 }
    ],
    metrics: [
      { name: 'conversion_rate', type: 'binary', target: 'maximize' },
      { name: 'latency_ms', type: 'continuous', target: 'minimize' }
    ],
    guardrails: [
      { metric: 'error_rate', operator: '<', threshold: 0.01, severity: 'critical' }
    ]
  }
}

describe('Experiments E2E Tests', () => {
  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.experimentMetric.deleteMany({
      where: { experiment: { key: { startsWith: 'e2e_test_' } } }
    })
    await prisma.experimentAssignment.deleteMany({
      where: { experiment: { key: { startsWith: 'e2e_test_' } } }
    })
    await prisma.experiment.deleteMany({
      where: { key: { startsWith: 'e2e_test_' } }
    })
  })

  afterAll(async () => {
    // Clean up test data
    await prisma.experimentMetric.deleteMany({
      where: { experiment: { key: { startsWith: 'e2e_test_' } } }
    })
    await prisma.experimentAssignment.deleteMany({
      where: { experiment: { key: { startsWith: 'e2e_test_' } } }
    })
    await prisma.experiment.deleteMany({
      where: { key: { startsWith: 'e2e_test_' } } }
    })
    await prisma.$disconnect()
  })

  describe('Full Experiment Lifecycle', () => {
    let experimentId: string

    test('1. Create experiment', async () => {
      const { response, data } = await apiRequest('/api/experiments', {
        method: 'POST',
        body: JSON.stringify(testExperiment)
      })

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.experiment).toMatchObject({
        key: testExperiment.key,
        name: testExperiment.name,
        status: 'draft'
      })

      experimentId = data.experiment.id
    })

    test('2. Get experiment details', async () => {
      const { response, data } = await apiRequest(`/api/experiments/${testExperiment.key}`)

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.experiment).toMatchObject({
        key: testExperiment.key,
        status: 'draft'
      })
    })

    test('3. Start experiment', async () => {
      const { response, data } = await apiRequest(
        `/api/experiments/${testExperiment.key}/start`,
        { method: 'POST' }
      )

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.experiment.status).toBe('running')
      expect(data.experiment.started_at).toBeDefined()
    })

    test('4. Assign users to variants', async () => {
      const userIds = Array.from({ length: 100 }, (_, i) => `user_${i}`)
      const assignments: Record<string, number> = { control: 0, treatment: 0 }

      for (const userId of userIds) {
        const { response, data } = await apiRequest('/api/experiments', {
          method: 'POST',
          body: JSON.stringify({
            action: 'evaluate',
            flagKey: testExperiment.key,
            context: { userId }
          })
        })

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(['control', 'treatment']).toContain(data.result.variant)

        assignments[data.result.variant]++
      }

      // Check traffic split is roughly 50/50 (allow 40-60 range for random variation)
      expect(assignments.control).toBeGreaterThanOrEqual(40)
      expect(assignments.control).toBeLessThanOrEqual(60)
      expect(assignments.treatment).toBeGreaterThanOrEqual(40)
      expect(assignments.treatment).toBeLessThanOrEqual(60)
    })

    test('5. Log metrics', async () => {
      // Log metrics for users
      const metricsData = [
        // Control group - 12% conversion, 2000ms avg latency
        ...Array.from({ length: 50 }, (_, i) => ({
          userId: `user_${i}`,
          variant: i % 2 === 0 ? 'control' : 'treatment',
          conversion: i < 6 || (i >= 50 && i < 58), // ~12% for control, ~16% for treatment
          latency: (i % 2 === 0 ? 2000 : 1800) + (Math.random() * 400 - 200)
        }))
      ]

      for (const metric of metricsData) {
        // Log conversion
        const conversionResponse = await apiRequest('/api/experiments', {
          method: 'POST',
          body: JSON.stringify({
            action: 'track',
            flagKey: testExperiment.key,
            metricName: 'conversion_rate',
            value: metric.conversion ? 1.0 : 0.0,
            context: { userId: metric.userId }
          })
        })

        expect(conversionResponse.response.status).toBe(200)

        // Log latency
        const latencyResponse = await apiRequest('/api/experiments', {
          method: 'POST',
          body: JSON.stringify({
            action: 'track',
            flagKey: testExperiment.key,
            metricName: 'latency_ms',
            value: metric.latency,
            context: { userId: metric.userId }
          })
        })

        expect(latencyResponse.response.status).toBe(200)
      }
    })

    test('6. Analyze results', async () => {
      // Wait a moment for data to be processed
      await new Promise(resolve => setTimeout(resolve, 1000))

      const { response, data } = await apiRequest(
        `/api/experiments?action=results&flagKey=${testExperiment.key}`
      )

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.variantDistribution).toBeDefined()
      expect(data.metrics).toBeDefined()

      // Verify metrics data structure
      expect(data.metrics.conversion_rate).toBeDefined()
      expect(data.metrics.conversion_rate.control).toMatchObject({
        count: expect.any(Number),
        mean: expect.any(Number),
        stdDev: expect.any(Number)
      })
      expect(data.metrics.conversion_rate.analysis).toMatchObject({
        lift: expect.any(Number),
        pValue: expect.any(Number),
        isSignificant: expect.any(Boolean)
      })
    })

    test('7. Check Sample Ratio Mismatch', async () => {
      const { data } = await apiRequest(
        `/api/experiments?action=results&flagKey=${testExperiment.key}`
      )

      expect(data.sampleRatioCheck).toBeDefined()
      expect(data.sampleRatioCheck).toMatchObject({
        isPassing: expect.any(Boolean),
        chiSquare: expect.any(Number),
        pValue: expect.any(Number),
        expected: expect.any(Object),
        observed: expect.any(Object)
      })

      // With 50/50 split, SRM should pass
      expect(data.sampleRatioCheck.isPassing).toBe(true)
    })

    test('8. Evaluate guardrails', async () => {
      const { response, data } = await apiRequest(
        `/api/experiments/${testExperiment.key}/guardrails`
      )

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.guardrails).toBeDefined()
      expect(Array.isArray(data.guardrails)).toBe(true)
      expect(data.hasViolations).toBe(false)
    })

    test('9. Stop experiment', async () => {
      const { response, data } = await apiRequest(
        `/api/experiments/${testExperiment.key}/stop`,
        {
          method: 'POST',
          body: JSON.stringify({
            reason: 'E2E test completed',
            winningVariant: 'treatment'
          })
        }
      )

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.experiment.status).toBe('completed')
      expect(data.experiment.stopped_at).toBeDefined()
    })

    test('10. Archive experiment', async () => {
      const { response, data } = await apiRequest(
        `/api/experiments/${testExperiment.key}`,
        {
          method: 'PUT',
          body: JSON.stringify({ status: 'archived' })
        }
      )

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('API Endpoints', () => {
    test('GET /api/experiments - List experiments', async () => {
      const { response, data } = await apiRequest('/api/experiments')

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(Array.isArray(data.experiments)).toBe(true)
      expect(data.pagination).toMatchObject({
        page: expect.any(Number),
        limit: expect.any(Number),
        total: expect.any(Number),
        totalPages: expect.any(Number)
      })
    })

    test('GET /api/experiments?status=running - Filter by status', async () => {
      const { response, data } = await apiRequest('/api/experiments?status=running')

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(Array.isArray(data.experiments)).toBe(true)

      // All returned experiments should have status=running
      data.experiments.forEach((exp: any) => {
        expect(exp.status).toBe('running')
      })
    })

    test('GET /api/experiments/[invalid] - Not found', async () => {
      const { response, data } = await apiRequest('/api/experiments/nonexistent_experiment')

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBeDefined()
    })

    test('POST /api/experiments - Validation errors', async () => {
      const { response, data } = await apiRequest('/api/experiments', {
        method: 'POST',
        body: JSON.stringify({
          key: 'invalid experiment key!', // Invalid characters
          name: '',  // Empty name
          config: {} // Missing required fields
        })
      })

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBeDefined()
    })

    test('POST /api/experiments/[key]/start - Cannot start non-draft', async () => {
      // Try to start an already-running or completed experiment
      const { response, data } = await apiRequest(
        `/api/experiments/${testExperiment.key}/start`,
        { method: 'POST' }
      )

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('draft')
    })
  })

  describe('Statistical Calculations', () => {
    test('T-test with known data', async () => {
      // Create experiment with known statistical properties
      const statTestExp = {
        key: 'e2e_test_stat_validation',
        name: 'Statistical Validation Test',
        config: {
          variants: [
            { key: 'control', weight: 0.5 },
            { key: 'treatment', weight: 0.5 }
          ],
          metrics: [{ name: 'test_metric', type: 'continuous' }]
        }
      }

      await apiRequest('/api/experiments', {
        method: 'POST',
        body: JSON.stringify(statTestExp)
      })

      await apiRequest(`/api/experiments/${statTestExp.key}/start`, {
        method: 'POST'
      })

      // Log metrics with known distributions
      // Control: mean=10, stddev=2 (normal)
      // Treatment: mean=12, stddev=2 (20% lift, should be significant)

      const controlValues = Array.from({ length: 100 }, () =>
        10 + (Math.random() * 2 - 1) * 2
      )
      const treatmentValues = Array.from({ length: 100 }, () =>
        12 + (Math.random() * 2 - 1) * 2
      )

      for (let i = 0; i < 100; i++) {
        await apiRequest('/api/experiments', {
          method: 'POST',
          body: JSON.stringify({
            action: 'track',
            flagKey: statTestExp.key,
            metricName: 'test_metric',
            value: controlValues[i],
            context: { userId: `stat_user_${i}_control` }
          })
        })

        await apiRequest('/api/experiments', {
          method: 'POST',
          body: JSON.stringify({
            action: 'track',
            flagKey: statTestExp.key,
            metricName: 'test_metric',
            value: treatmentValues[i],
            context: { userId: `stat_user_${i}_treatment` }
          })
        })
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Get results
      const { data } = await apiRequest(
        `/api/experiments?action=results&flagKey=${statTestExp.key}`
      )

      expect(data.metrics.test_metric.control.mean).toBeCloseTo(10, 0)
      expect(data.metrics.test_metric.treatment.mean).toBeCloseTo(12, 0)
      expect(data.metrics.test_metric.analysis.lift).toBeCloseTo(2, 0)
      expect(data.metrics.test_metric.analysis.pValue).toBeLessThan(0.05)
      expect(data.metrics.test_metric.analysis.isSignificant).toBe(true)
    })

    test('Confidence intervals are correctly calculated', async () => {
      const { data } = await apiRequest(
        `/api/experiments?action=results&flagKey=e2e_test_stat_validation`
      )

      const analysis = data.metrics.test_metric.analysis

      expect(analysis.confidenceInterval).toBeDefined()
      expect(analysis.confidenceInterval.length).toBe(2)

      const [lower, upper] = analysis.confidenceInterval

      // CI should contain the true lift (~2)
      expect(lower).toBeLessThan(2)
      expect(upper).toBeGreaterThan(2)

      // CI should be reasonably narrow
      expect(upper - lower).toBeLessThan(3)
    })
  })

  describe('Guardrail Triggering', () => {
    test('Guardrail violation pauses experiment', async () => {
      const guardExp = {
        key: 'e2e_test_guardrail_violation',
        name: 'Guardrail Violation Test',
        config: {
          variants: [
            { key: 'control', weight: 0.5 },
            { key: 'treatment', weight: 0.5 }
          ],
          metrics: [{ name: 'error_rate', type: 'binary' }],
          guardrails: [
            { metric: 'error_rate', operator: '<', threshold: 0.05, severity: 'critical' }
          ]
        }
      }

      await apiRequest('/api/experiments', {
        method: 'POST',
        body: JSON.stringify(guardExp)
      })

      await apiRequest(`/api/experiments/${guardExp.key}/start`, {
        method: 'POST'
      })

      // Log high error rates (>10%) for treatment
      for (let i = 0; i < 100; i++) {
        await apiRequest('/api/experiments', {
          method: 'POST',
          body: JSON.stringify({
            action: 'track',
            flagKey: guardExp.key,
            metricName: 'error_rate',
            value: i < 12 ? 1.0 : 0.0, // 12% error rate
            context: { userId: `guard_user_${i}` }
          })
        })
      }

      // Check guardrails
      const { data } = await apiRequest(`/api/experiments/${guardExp.key}/guardrails/check`, {
        method: 'POST'
      })

      expect(data.success).toBe(true)
      expect(data.evaluation.hasViolations).toBe(true)
      expect(data.evaluation.criticalViolations.length).toBeGreaterThan(0)

      // Verify experiment was paused
      const { data: expData } = await apiRequest(`/api/experiments/${guardExp.key}`)
      expect(expData.experiment.status).toBe('paused')
    })
  })

  describe('SRM Detection', () => {
    test('SRM detected with imbalanced assignments', async () => {
      const srmExp = {
        key: 'e2e_test_srm_detection',
        name: 'SRM Detection Test',
        config: {
          variants: [
            { key: 'control', weight: 0.5 },
            { key: 'treatment', weight: 0.5 }
          ],
          metrics: [{ name: 'test_metric', type: 'binary' }]
        }
      }

      await apiRequest('/api/experiments', {
        method: 'POST',
        body: JSON.stringify(srmExp)
      })

      await apiRequest(`/api/experiments/${srmExp.key}/start`, {
        method: 'POST'
      })

      // Manually create imbalanced assignments (70/30 instead of 50/50)
      await prisma.experimentAssignment.createMany({
        data: [
          ...Array.from({ length: 700 }, (_, i) => ({
            experiment_id: srmExp.key,
            user_id: `srm_user_${i}_control`,
            variant_key: 'control',
            timestamp: new Date()
          })),
          ...Array.from({ length: 300 }, (_, i) => ({
            experiment_id: srmExp.key,
            user_id: `srm_user_${i}_treatment`,
            variant_key: 'treatment',
            timestamp: new Date()
          }))
        ]
      })

      const { data } = await apiRequest(
        `/api/experiments?action=results&flagKey=${srmExp.key}`
      )

      expect(data.sampleRatioCheck.isPassing).toBe(false)
      expect(data.sampleRatioCheck.pValue).toBeLessThan(0.001)
      expect(data.sampleRatioCheck.severity).toBe('critical')
    })
  })

  describe('Performance', () => {
    test('Assignment logging handles high throughput', async () => {
      const perfExp = {
        key: 'e2e_test_performance',
        name: 'Performance Test',
        config: {
          variants: [
            { key: 'control', weight: 0.5 },
            { key: 'treatment', weight: 0.5 }
          ],
          metrics: [{ name: 'test_metric', type: 'binary' }]
        }
      }

      await apiRequest('/api/experiments', {
        method: 'POST',
        body: JSON.stringify(perfExp)
      })

      await apiRequest(`/api/experiments/${perfExp.key}/start`, {
        method: 'POST'
      })

      // Log 1000 assignments rapidly
      const startTime = Date.now()

      const promises = Array.from({ length: 1000 }, (_, i) =>
        apiRequest('/api/experiments', {
          method: 'POST',
          body: JSON.stringify({
            action: 'evaluate',
            flagKey: perfExp.key,
            context: { userId: `perf_user_${i}` }
          })
        })
      )

      await Promise.all(promises)

      const duration = Date.now() - startTime

      // Should complete 1000 assignments in under 10 seconds
      expect(duration).toBeLessThan(10000)

      // Average latency should be under 100ms per assignment
      const avgLatency = duration / 1000
      expect(avgLatency).toBeLessThan(100)
    })

    test('Metrics aggregation completes in reasonable time', async () => {
      const startTime = Date.now()

      const { data } = await apiRequest(
        `/api/experiments?action=results&flagKey=e2e_test_performance`
      )

      const duration = Date.now() - startTime

      expect(data.success).toBe(true)
      // Aggregation of 1000 metrics should complete in under 2 seconds
      expect(duration).toBeLessThan(2000)
    })
  })
})
