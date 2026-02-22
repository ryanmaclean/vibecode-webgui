/**
 * Unit Tests for Container Metrics Service
 * Tests the ContainerMetricsService class and its methods for querying container metrics from Prometheus
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals'

// Mock fetchWithRetry
const mockFetchWithRetry = jest.fn()
const mockFetchError = class FetchError extends Error {
  constructor(message: string, public status: number, public url: string) {
    super(message)
    this.name = 'FetchError'
  }
}

jest.mock('@/lib/utils/fetch', () => ({
  fetchWithRetry: mockFetchWithRetry,
  FetchError: mockFetchError
}))

import { ContainerMetricsService } from '@/lib/monitoring/container-metrics'
import type { ContainerMetrics, ContainerHistory } from '@/lib/monitoring/container-metrics'

describe('ContainerMetricsService', () => {
  let service: ContainerMetricsService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new ContainerMetricsService({
      prometheusUrl: 'http://test-prometheus:9090',
      timeout: 5000,
      cacheTTL: 10000,
      enableCache: true
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Constructor', () => {
    test('should initialize with custom configuration', () => {
      const customService = new ContainerMetricsService({
        prometheusUrl: 'http://custom:9090',
        timeout: 15000,
        cacheTTL: 60000,
        enableCache: false
      })

      expect(customService).toBeDefined()
    })

    test('should initialize with default configuration', () => {
      const defaultService = new ContainerMetricsService()
      expect(defaultService).toBeDefined()
    })

    test('should use environment variable for Prometheus URL', () => {
      const originalEnv = process.env.PROMETHEUS_URL
      process.env.PROMETHEUS_URL = 'http://env-prometheus:9090'

      const envService = new ContainerMetricsService()
      expect(envService).toBeDefined()

      if (originalEnv) {
        process.env.PROMETHEUS_URL = originalEnv
      } else {
        delete process.env.PROMETHEUS_URL
      }
    })
  })

  describe('getContainerMetrics', () => {
    test('should return container metrics for all containers', async () => {
      // Mock container names query
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            resultType: 'vector',
            result: [
              { metric: { name: 'container1' } },
              { metric: { name: 'container2' } }
            ]
          }
        })
      })

      // Mock metrics queries for container1 (6 queries per container)
      const mockMetricResponse = (value: number) => ({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            resultType: 'vector',
            result: [{ metric: { image: 'test-image:latest' }, value: [Date.now() / 1000, value.toString()] }]
          }
        })
      })

      // Container 1 queries: CPU, memory, memoryLimit, networkRx, networkTx, storage
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(0.5))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(1073741824))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(2147483648))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(1000000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(500000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(536870912))

      // Container 2 queries
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(0.3))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(536870912))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(1073741824))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(800000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(600000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(268435456))

      const metrics = await service.getContainerMetrics()

      expect(metrics).toHaveLength(2)
      expect(metrics[0].name).toBe('container1')
      expect(metrics[0].cpuUsage).toBe(0.5)
      expect(metrics[0].cpuPercent).toBe(50)
      expect(metrics[0].memoryUsage).toBe(1073741824)
      expect(metrics[0].memoryPercent).toBe(50)
      expect(metrics[1].name).toBe('container2')
    })

    test('should filter out POD containers', async () => {
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            resultType: 'vector',
            result: [
              { metric: { name: 'container1' } },
              { metric: { name: 'POD' } },
              { metric: { name: '' } }
            ]
          }
        })
      })

      // Mock metrics for container1
      const mockMetricResponse = (value: number) => ({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            resultType: 'vector',
            result: [{ metric: { image: 'test-image:latest' }, value: [Date.now() / 1000, value.toString()] }]
          }
        })
      })

      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(0.5))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(1073741824))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(2147483648))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(1000000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(500000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(536870912))

      const metrics = await service.getContainerMetrics()

      expect(metrics).toHaveLength(1)
      expect(metrics[0].name).toBe('container1')
    })

    test('should use cached results when available', async () => {
      // First call - populate cache
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            resultType: 'vector',
            result: [{ metric: { name: 'container1' } }]
          }
        })
      })

      const mockMetricResponse = (value: number) => ({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            resultType: 'vector',
            result: [{ metric: { image: 'test-image:latest' }, value: [Date.now() / 1000, value.toString()] }]
          }
        })
      })

      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(0.5))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(1073741824))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(2147483648))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(1000000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(500000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(536870912))

      await service.getContainerMetrics()
      const firstCallCount = mockFetchWithRetry.mock.calls.length

      // Second call - should use cache
      const metrics = await service.getContainerMetrics()

      expect(mockFetchWithRetry).toHaveBeenCalledTimes(firstCallCount)
      expect(metrics).toHaveLength(1)
    })

    test('should throw error when Prometheus query fails', async () => {
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'error',
          error: 'Query timeout',
          errorType: 'timeout'
        })
      })

      await expect(service.getContainerMetrics()).rejects.toThrow('Failed to fetch container metrics')
    })
  })

  describe('getContainerMetricsByName', () => {
    test('should return metrics for a specific container', async () => {
      const mockMetricResponse = (value: number, image = 'test-image:latest') => ({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            resultType: 'vector',
            result: [{ metric: { image }, value: [Date.now() / 1000, value.toString()] }]
          }
        })
      })

      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(0.75))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(1610612736))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(2147483648))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(2000000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(1500000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(805306368))

      const metrics = await service.getContainerMetricsByName('test-container')

      expect(metrics).not.toBeNull()
      expect(metrics?.name).toBe('test-container')
      expect(metrics?.image).toBe('test-image:latest')
      expect(metrics?.cpuUsage).toBe(0.75)
      expect(metrics?.cpuPercent).toBe(75)
      expect(metrics?.memoryUsage).toBe(1610612736)
      expect(metrics?.memoryLimit).toBe(2147483648)
      expect(metrics?.memoryPercent).toBe(75)
      expect(metrics?.networkRxBytes).toBe(2000000)
      expect(metrics?.networkTxBytes).toBe(1500000)
      expect(metrics?.storageUsage).toBe(805306368)
      expect(metrics?.state).toBe('running')
      expect(metrics?.timestamp).toBeDefined()
    })

    test('should return null when container metrics are unavailable', async () => {
      mockFetchWithRetry.mockRejectedValue(new Error('Container not found'))

      const metrics = await service.getContainerMetricsByName('nonexistent-container')

      expect(metrics).toBeNull()
    })

    test('should handle zero memory limit', async () => {
      const mockMetricResponse = (value: number) => ({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            resultType: 'vector',
            result: [{ metric: { image: 'test-image:latest' }, value: [Date.now() / 1000, value.toString()] }]
          }
        })
      })

      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(0.5))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(1073741824))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(0)) // Zero memory limit
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(1000000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(500000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(536870912))

      const metrics = await service.getContainerMetricsByName('test-container')

      expect(metrics?.memoryPercent).toBe(0)
    })

    test('should use unknown image when not available', async () => {
      const mockMetricResponse = (value: number) => ({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            resultType: 'vector',
            result: [{ metric: {}, value: [Date.now() / 1000, value.toString()] }]
          }
        })
      })

      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(0.5))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(1073741824))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(2147483648))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(1000000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(500000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(536870912))

      const metrics = await service.getContainerMetricsByName('test-container')

      expect(metrics?.image).toBe('unknown')
    })
  })

  describe('getContainerHistory', () => {
    test('should return historical CPU metrics', async () => {
      const now = Math.floor(Date.now() / 1000)
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            resultType: 'matrix',
            result: [{
              metric: { name: 'test-container' },
              values: [
                [now - 120, '0.5'],
                [now - 60, '0.6'],
                [now, '0.7']
              ]
            }]
          }
        })
      })

      const history = await service.getContainerHistory('test-container', 'cpu', '1h', '1m')

      expect(history.container).toBe('test-container')
      expect(history.metric).toBe('cpu')
      expect(history.datapoints).toHaveLength(3)
      expect(history.datapoints[0].value).toBe(0.5)
      expect(history.datapoints[1].value).toBe(0.6)
      expect(history.datapoints[2].value).toBe(0.7)
      expect(history.startTime).toBeDefined()
      expect(history.endTime).toBeDefined()
    })

    test('should return historical memory metrics', async () => {
      const now = Math.floor(Date.now() / 1000)
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            resultType: 'matrix',
            result: [{
              metric: { name: 'test-container' },
              values: [
                [now - 60, '1073741824'],
                [now, '1610612736']
              ]
            }]
          }
        })
      })

      const history = await service.getContainerHistory('test-container', 'memory', '1h')

      expect(history.metric).toBe('memory')
      expect(history.datapoints).toHaveLength(2)
      expect(history.datapoints[0].value).toBe(1073741824)
    })

    test('should return historical network receive metrics', async () => {
      const now = Math.floor(Date.now() / 1000)
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            resultType: 'matrix',
            result: [{
              metric: { name: 'test-container' },
              values: [[now, '1000000']]
            }]
          }
        })
      })

      const history = await service.getContainerHistory('test-container', 'network_rx', '30m')

      expect(history.metric).toBe('network_rx')
      expect(history.datapoints[0].value).toBe(1000000)
    })

    test('should return historical network transmit metrics', async () => {
      const now = Math.floor(Date.now() / 1000)
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            resultType: 'matrix',
            result: [{
              metric: { name: 'test-container' },
              values: [[now, '500000']]
            }]
          }
        })
      })

      const history = await service.getContainerHistory('test-container', 'network_tx', '15m')

      expect(history.metric).toBe('network_tx')
      expect(history.datapoints[0].value).toBe(500000)
    })

    test('should return historical storage metrics', async () => {
      const now = Math.floor(Date.now() / 1000)
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            resultType: 'matrix',
            result: [{
              metric: { name: 'test-container' },
              values: [[now, '536870912']]
            }]
          }
        })
      })

      const history = await service.getContainerHistory('test-container', 'storage', '2h')

      expect(history.metric).toBe('storage')
      expect(history.datapoints[0].value).toBe(536870912)
    })

    test('should throw error for unknown metric type', async () => {
      await expect(
        service.getContainerHistory('test-container', 'invalid' as any)
      ).rejects.toThrow('Unknown metric type: invalid')
    })

    test('should handle empty results', async () => {
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            resultType: 'matrix',
            result: []
          }
        })
      })

      const history = await service.getContainerHistory('test-container', 'cpu', '1h')

      expect(history.datapoints).toHaveLength(0)
    })

    test('should parse different duration formats', async () => {
      const now = Math.floor(Date.now() / 1000)
      const mockResponse = {
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            resultType: 'matrix',
            result: [{
              metric: { name: 'test-container' },
              values: [[now, '0.5']]
            }]
          }
        })
      }

      // Test seconds
      mockFetchWithRetry.mockResolvedValueOnce(mockResponse)
      await service.getContainerHistory('test-container', 'cpu', '30s')

      // Test minutes
      mockFetchWithRetry.mockResolvedValueOnce(mockResponse)
      await service.getContainerHistory('test-container', 'cpu', '15m')

      // Test hours
      mockFetchWithRetry.mockResolvedValueOnce(mockResponse)
      await service.getContainerHistory('test-container', 'cpu', '2h')

      // Test days
      mockFetchWithRetry.mockResolvedValueOnce(mockResponse)
      await service.getContainerHistory('test-container', 'cpu', '1d')

      expect(mockFetchWithRetry).toHaveBeenCalledTimes(4)
    })

    test('should throw error for invalid duration format', async () => {
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          data: { resultType: 'matrix', result: [] }
        })
      })

      await expect(
        service.getContainerHistory('test-container', 'cpu', 'invalid')
      ).rejects.toThrow('Invalid duration format: invalid')
    })
  })

  describe('healthCheck', () => {
    test('should return healthy when Prometheus is accessible', async () => {
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK'
      })

      const health = await service.healthCheck()

      expect(health.healthy).toBe(true)
      expect(health.message).toBe('Prometheus is healthy')
      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        'http://test-prometheus:9090/-/healthy',
        expect.objectContaining({
          method: 'GET',
          timeout: 5000,
          retries: 1
        })
      )
    })

    test('should return unhealthy when Prometheus returns error status', async () => {
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable'
      })

      const health = await service.healthCheck()

      expect(health.healthy).toBe(false)
      expect(health.message).toBe('Prometheus returned status 503')
    })

    test('should return unhealthy when connection fails', async () => {
      mockFetchWithRetry.mockRejectedValueOnce(new Error('Connection refused'))

      const health = await service.healthCheck()

      expect(health.healthy).toBe(false)
      expect(health.message).toBe('Connection refused')
    })
  })

  describe('clearCache', () => {
    test('should clear cached metrics', async () => {
      // Populate cache
      mockFetchWithRetry.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            resultType: 'vector',
            result: [{ metric: { name: 'container1' } }]
          }
        })
      })

      const mockMetricResponse = (value: number) => ({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            resultType: 'vector',
            result: [{ metric: { image: 'test-image:latest' }, value: [Date.now() / 1000, value.toString()] }]
          }
        })
      })

      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            resultType: 'vector',
            result: [{ metric: { name: 'container1' } }]
          }
        })
      })
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(0.5))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(1073741824))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(2147483648))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(1000000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(500000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(536870912))

      await service.getContainerMetrics()
      const callsBeforeClear = mockFetchWithRetry.mock.calls.length

      // Clear cache
      service.clearCache()

      // Should make new requests after cache clear
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            resultType: 'vector',
            result: [{ metric: { name: 'container1' } }]
          }
        })
      })
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(0.5))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(1073741824))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(2147483648))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(1000000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(500000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(536870912))

      await service.getContainerMetrics()

      expect(mockFetchWithRetry.mock.calls.length).toBeGreaterThan(callsBeforeClear)
    })
  })

  describe('Cache behavior', () => {
    test('should not cache when caching is disabled', async () => {
      const noCacheService = new ContainerMetricsService({
        prometheusUrl: 'http://test-prometheus:9090',
        enableCache: false
      })

      const mockResponse = {
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            resultType: 'vector',
            result: [{ metric: { name: 'container1' } }]
          }
        })
      }

      const mockMetricResponse = (value: number) => ({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            resultType: 'vector',
            result: [{ metric: { image: 'test-image:latest' }, value: [Date.now() / 1000, value.toString()] }]
          }
        })
      })

      // First call
      mockFetchWithRetry.mockResolvedValueOnce(mockResponse)
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(0.5))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(1073741824))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(2147483648))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(1000000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(500000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(536870912))

      await noCacheService.getContainerMetrics()
      const firstCallCount = mockFetchWithRetry.mock.calls.length

      // Second call should make new requests
      mockFetchWithRetry.mockResolvedValueOnce(mockResponse)
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(0.5))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(1073741824))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(2147483648))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(1000000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(500000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(536870912))

      await noCacheService.getContainerMetrics()

      expect(mockFetchWithRetry.mock.calls.length).toBe(firstCallCount * 2)
    })

    test('should expire cache after TTL', async () => {
      const shortCacheService = new ContainerMetricsService({
        prometheusUrl: 'http://test-prometheus:9090',
        cacheTTL: 100 // 100ms
      })

      const mockResponse = {
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            resultType: 'vector',
            result: [{ metric: { name: 'container1' } }]
          }
        })
      }

      const mockMetricResponse = (value: number) => ({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            resultType: 'vector',
            result: [{ metric: { image: 'test-image:latest' }, value: [Date.now() / 1000, value.toString()] }]
          }
        })
      })

      // First call
      mockFetchWithRetry.mockResolvedValueOnce(mockResponse)
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(0.5))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(1073741824))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(2147483648))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(1000000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(500000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(536870912))

      await shortCacheService.getContainerMetrics()
      const firstCallCount = mockFetchWithRetry.mock.calls.length

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150))

      // Second call should make new requests after cache expiration
      mockFetchWithRetry.mockResolvedValueOnce(mockResponse)
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(0.5))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(1073741824))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(2147483648))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(1000000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(500000))
      mockFetchWithRetry.mockResolvedValueOnce(mockMetricResponse(536870912))

      await shortCacheService.getContainerMetrics()

      expect(mockFetchWithRetry.mock.calls.length).toBe(firstCallCount * 2)
    })
  })

  describe('Error handling', () => {
    test('should handle Prometheus error responses', async () => {
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'error',
          error: 'Invalid query syntax',
          errorType: 'bad_data'
        })
      })

      await expect(service.getContainerMetrics()).rejects.toThrow('Prometheus error')
    })

    test('should handle network errors', async () => {
      mockFetchWithRetry.mockRejectedValueOnce(new Error('Network error'))

      await expect(service.getContainerMetrics()).rejects.toThrow('Failed to fetch container metrics')
    })

    test('should handle non-200 HTTP responses', async () => {
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({})
      })

      await expect(service.getContainerMetrics()).rejects.toThrow()
    })
  })

  describe('Singleton export', () => {
    test('should export default containerMetricsService instance', async () => {
      const { containerMetricsService } = await import('@/lib/monitoring/container-metrics')
      expect(containerMetricsService).toBeDefined()
      expect(containerMetricsService).toBeInstanceOf(ContainerMetricsService)
    })
  })
})
