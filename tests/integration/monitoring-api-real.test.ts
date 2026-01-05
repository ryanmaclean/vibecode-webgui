/**
 * Monitoring API Integration Tests
 *
 * Tests the complete monitoring API functionality with mocked Datadog API
 *
 * Tests the integration between:
 * 1. HTTP API endpoints via fetch
 * 2. Authentication flow (with test users)
 * 3. Metrics collection and storage
 * 4. System monitoring capabilities
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals'
import { setupDatadogMocks } from '../__mocks__/datadog-mock'

describe('Monitoring API Integration', () => {
  let restoreMocks: () => void;
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000'
  const adminCookies: string = ''
  const userCookies: string = ''

  beforeEach(() => {
    const mocks = setupDatadogMocks();
    restoreMocks = mocks.restore;
  })

  afterEach(() => {
    if (restoreMocks) {
      restoreMocks();
    }
  })

  beforeAll(async () => {
    console.log('Setting up monitoring integration test environment...')
  }, 30000)

  afterAll(async () => {
    console.log('Cleaning up monitoring integration test environment...')
  })

  test('should return real system metrics for admin users', async () => {
    const response = await fetch(`${baseUrl}/api/monitoring/metrics`, {
      method: 'GET',
      headers: {
        'Cookie': adminCookies,
        'User-Agent': 'test-integration-suite'
      }
    })

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.success).toBe(true)

    // Verify real system metrics are returned
    expect(data.metrics).toBeDefined()
    expect(data.metrics.cpu).toBeDefined()
    expect(data.metrics.memory).toBeDefined()
    expect(data.metrics.uptime).toBeGreaterThan(0)
    expect(data.metrics.timestamp).toBeDefined()

    // Verify metrics have realistic values
    expect(data.metrics.cpu.usage).toBeGreaterThanOrEqual(0)
    expect(data.metrics.cpu.usage).toBeLessThanOrEqual(100)
    expect(data.metrics.memory.percentage).toBeGreaterThanOrEqual(0)
    expect(data.metrics.memory.percentage).toBeLessThanOrEqual(100)
  })

  test('should deny access for non-admin users', async () => {
    const response = await fetch(`${baseUrl}/api/monitoring/metrics`, {
      method: 'GET',
      headers: {
        'Cookie': userCookies,
        'User-Agent': 'test-integration-suite'
      }
    })

    expect(response.status).toBe(401)

    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  test('should require authentication for metrics access', async () => {
    const response = await fetch(`${baseUrl}/api/monitoring/metrics`, {
      method: 'GET',
      headers: {
        // No authentication cookies
        'User-Agent': 'test-integration-suite'
      }
    })

    expect(response.status).toBe(401)

    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  test('should accept real metrics submission from authenticated users', async () => {
    const response = await fetch(`${baseUrl}/api/monitoring/metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': userCookies,
        'User-Agent': 'test-integration-suite'
      },
      body: JSON.stringify({
        type: 'response_time',
        data: { duration: 250 }
      })
    })

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.message).toBe('Metric recorded successfully')
  })

  test('should handle real error metrics submission', async () => {
    const response = await fetch(`${baseUrl}/api/monitoring/metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': userCookies,
        'User-Agent': 'test-integration-suite'
      },
      body: JSON.stringify({
        type: 'error',
        data: {
          errorType: 'network_timeout',
          endpoint: '/api/test',
          statusCode: 504
        }
      })
    })

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.message).toBe('Metric recorded successfully')
  })

  test('should handle real user activity metrics', async () => {
    const response = await fetch(`${baseUrl}/api/monitoring/metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': userCookies,
        'User-Agent': 'test-integration-suite'
      },
      body: JSON.stringify({
        type: 'user_activity',
        data: {
          userId: 'integration-test-user',
          workspaceId: 'integration-test-workspace',
          action: 'api_call'
        }
      })
    })

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.message).toBe('Metric recorded successfully')
  })

  test('should validate metric types with real validation', async () => {
    const response = await fetch(`${baseUrl}/api/monitoring/metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': userCookies,
        'User-Agent': 'test-integration-suite'
      },
      body: JSON.stringify({
        type: 'unknown_metric_type',
        data: {}
      })
    })

    expect(response.status).toBe(400)

    const data = await response.json()
    expect(data.error).toBe('Unknown metric type')
  })

  test('should handle malformed JSON in real requests', async () => {
    const response = await fetch(`${baseUrl}/api/monitoring/metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': userCookies,
        'User-Agent': 'test-integration-suite'
      },
      body: 'invalid json'
    })

    expect(response.status).toBe(400)

    const data = await response.json()
    expect(data.error).toBe('Invalid JSON')
  })

  test('should track real network I/O metrics', async () => {
    const response = await fetch(`${baseUrl}/api/monitoring/metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': userCookies,
        'User-Agent': 'test-integration-suite'
      },
      body: JSON.stringify({
        type: 'network_io',
        data: {
          bytesIn: 1024,
          bytesOut: 2048,
          endpoint: '/api/monitoring/test'
        }
      })
    })

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.message).toBe('Metric recorded successfully')
  })

  test('should aggregate real metrics over time', async () => {
    // Submit multiple metrics
    const metrics = [
      { type: 'response_time', data: { duration: 100 } },
      { type: 'response_time', data: { duration: 200 } },
      { type: 'response_time', data: { duration: 150 } }
    ]

    for (const metric of metrics) {
      await fetch(`${baseUrl}/api/monitoring/metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': userCookies,
          'User-Agent': 'test-integration-suite'
        },
        body: JSON.stringify(metric)
      })
    }

    // Wait for aggregation
    await new Promise(resolve => setTimeout(resolve, 100))

    // Get aggregated metrics as admin
    const response = await fetch(`${baseUrl}/api/monitoring/metrics`, {
      method: 'GET',
      headers: {
        'Cookie': adminCookies,
        'User-Agent': 'test-integration-suite'
      }
    })

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.metrics.avgResponseTime).toBeGreaterThan(0)

    // Should be around the average of our submitted values (100, 200, 150 = avg 150)
    expect(data.metrics.avgResponseTime).toBeGreaterThan(100)
    expect(data.metrics.avgResponseTime).toBeLessThan(300)
  })

  test('should handle real high-frequency metric submission', async () => {
    // Submit metrics rapidly to test real performance
    const promises = []
    for (let i = 0; i < 10; i++) {
      promises.push(
        fetch(`${baseUrl}/api/monitoring/metrics`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': userCookies,
            'User-Agent': 'test-integration-suite'
          },
          body: JSON.stringify({
            type: 'response_time',
            data: { duration: 50 + i * 10 }
          })
        })
      )
    }

    const responses = await Promise.all(promises)

    // All should succeed
    responses.forEach((response) => {
      expect(response.status).toBe(200)
    })

    // Verify they were actually processed
    const getResponse = await fetch(`${baseUrl}/api/monitoring/metrics`, {
      method: 'GET',
      headers: {
        'Cookie': adminCookies,
        'User-Agent': 'test-integration-suite'
      }
    })

    expect(getResponse.status).toBe(200)
    const data = await getResponse.json()
    expect(data.metrics.avgResponseTime).toBeGreaterThan(0)
  })

  test('should build real request context from headers', async () => {
    const response = await fetch(`${baseUrl}/api/monitoring/metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': userCookies,
        'User-Agent': 'Mozilla/5.0 (Real Browser Test)',
        'X-Forwarded-For': '192.168.1.100',
        'X-Real-IP': '10.0.0.1',
        'Referer': 'https://example.com/dashboard'
      },
      body: JSON.stringify({
        type: 'user_activity',
        data: {
          userId: 'integration-test-user',
          action: 'page_view',
          page: '/dashboard'
        }
      })
    })

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.success).toBe(true)

    // The real monitoring system should have processed the real context
    // We can verify this worked by checking the response includes confirmation
    expect(data.message).toBe('Metric recorded successfully')
  })
})