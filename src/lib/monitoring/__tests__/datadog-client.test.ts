/**
 * Unit Tests for Datadog Client
 * Tests the MonitoringService class and its methods
 */

import { jest } from '@jest/globals'

// Mock the datadog-env module
jest.mock('../datadog-env', () => ({
  getDatadogApiKey: jest.fn(),
  getDatadogSite: jest.fn()
}))

// Mock fetch globally
global.fetch = jest.fn()

// Mock process.memoryUsage
const mockMemoryUsage = {
  heapUsed: 50 * 1024 * 1024, // 50MB
  heapTotal: 100 * 1024 * 1024, // 100MB
  external: 10 * 1024 * 1024,
  rss: 80 * 1024 * 1024
}

jest.spyOn(process, 'memoryUsage').mockReturnValue(mockMemoryUsage)
jest.spyOn(process, 'uptime').mockReturnValue(3600) // 1 hour

describe('MonitoringService', () => {
  let mockGetDatadogApiKey: jest.MockedFunction<any>
  let mockGetDatadogSite: jest.MockedFunction<any>
  let mockFetch: jest.MockedFunction<typeof fetch>
  let monitoring: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Clear module cache to get fresh instance
    jest.resetModules()
    
    // Import mocked functions
    const datadogEnv = require('../datadog-env')
    mockGetDatadogApiKey = datadogEnv.getDatadogApiKey
    mockGetDatadogSite = datadogEnv.getDatadogSite
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

    // Default mock implementations
    mockGetDatadogApiKey.mockReturnValue('test-api-key')
    mockGetDatadogSite.mockReturnValue('datadoghq.com')
    
    // Mock successful fetch responses by default
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: jest.fn().mockResolvedValue({})
    } as any)

    // Import the module after mocking
    const datadogClient = require('../datadog-client')
    monitoring = datadogClient.monitoring
  })

  describe('Constructor', () => {
    it('should initialize with server-side configuration', () => {
      // The monitoring instance should be created successfully
      expect(monitoring).toBeDefined()
      expect(typeof monitoring.submitMetric).toBe('function')
      expect(typeof monitoring.submitEvent).toBe('function')
      expect(typeof monitoring.checkDatabase).toBe('function')
    })

    it('should have proper configuration methods', () => {
      expect(typeof monitoring.isConfigured).toBe('function')
      expect(typeof monitoring.trackMetrics).toBe('function')
    })
  })

  describe('submitMetric', () => {
    const testMetric = {
      metric: 'test.metric',
      value: 42,
      tags: ['tag1', 'tag2'],
      timestamp: 1234567890
    }

    it('should submit metric successfully', async () => {
      // The default mock already returns 'test-api-key'
      const result = await monitoring.submitMetric(testMetric)
      
      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.datadoghq.com/api/v1/series',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'DD-API-KEY': 'test-api-key'
          },
          body: expect.stringContaining('test.metric')
        })
      )
    })

    it('should skip submission when API key is not configured', async () => {
      mockGetDatadogApiKey.mockReturnValue(undefined)
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      const result = await monitoring.submitMetric(testMetric)
      
      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('Datadog API key not configured - metric submission skipped')
      expect(mockFetch).not.toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })

    it('should skip submission when API key is placeholder', async () => {
      mockGetDatadogApiKey.mockReturnValue('placeholder-set-real-key')
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      const result = await monitoring.submitMetric(testMetric)
      
      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('Datadog API key not configured - metric submission skipped')
      expect(mockFetch).not.toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })

    it('should handle API errors gracefully', async () => {
      mockGetDatadogApiKey.mockReturnValue('valid-api-key')
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      } as any)
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      const result = await monitoring.submitMetric(testMetric)
      
      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to submit metric to Datadog:',
        expect.any(Error)
      )
      
      consoleSpy.mockRestore()
    })

    it('should handle network errors gracefully', async () => {
      mockGetDatadogApiKey.mockReturnValue('valid-api-key')
      mockFetch.mockRejectedValue(new Error('Network error'))
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      const result = await monitoring.submitMetric(testMetric)
      
      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to submit metric to Datadog:',
        expect.any(Error)
      )
      
      consoleSpy.mockRestore()
    })

    it('should use default timestamp when not provided', async () => {
      mockGetDatadogApiKey.mockReturnValue('valid-api-key')
      
      const metricWithoutTimestamp: MetricData = {
        metric: 'test.metric',
        value: 42
      }
      
      await monitoring.submitMetric(metricWithoutTimestamp)
      
      const fetchCall = mockFetch.mock.calls[0]
      const body = JSON.parse(fetchCall[1]?.body as string)
      
      expect(body.series[0].points[0][0]).toBeGreaterThan(0) // Should be current timestamp
    })
  })

  describe('submitEvent', () => {
    it('should submit event successfully', async () => {
      const result = await monitoring.submitEvent('Test Event', 'Test description', ['tag1'])
      
      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.datadoghq.com/api/v1/events',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'DD-API-KEY': 'test-api-key'
          },
          body: expect.stringContaining('Test Event')
        })
      )
    })

    it('should skip submission when API key is not configured', async () => {
      mockGetDatadogApiKey.mockReturnValue(undefined)
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      const result = await monitoring.submitEvent('Test Event', 'Test description')
      
      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('Datadog API key not configured - event submission skipped')
      expect(mockFetch).not.toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })

    it('should handle API errors gracefully', async () => {
      mockGetDatadogApiKey.mockReturnValue('valid-api-key')
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as any)
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      const result = await monitoring.submitEvent('Test Event', 'Test description')
      
      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to submit event to Datadog:',
        expect.any(Error)
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('checkDatabase', () => {
    it('should return healthy when DATABASE_URL is not configured', async () => {
      delete process.env.DATABASE_URL
      
      const result = await monitoring.checkDatabase()
      
      expect(result).toEqual({
        status: 'healthy',
        details: 'Database not configured (using file storage)'
      })
    })

    it('should handle non-PostgreSQL URLs', async () => {
      process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/testdb'
      
      const result = await monitoring.checkDatabase()
      
      expect(result.status).toBe('healthy')
      expect(result.details).toMatchObject({
        host: 'localhost',
        database: 'testdb'
      })
    })

    it('should handle invalid DATABASE_URL', async () => {
      process.env.DATABASE_URL = 'invalid-url'
      
      const result = await monitoring.checkDatabase()
      
      expect(result.status).toBe('error')
      expect(result.error).toBeDefined()
    })
  })

  describe('checkValkey', () => {
    it('should return healthy when REDIS_URL is not configured', async () => {
      delete process.env.REDIS_URL
      
      const result = await monitoring.checkValkey()
      
      expect(result).toEqual({
        status: 'healthy',
        details: 'Redis not configured (using memory storage)'
      })
    })
  })

  describe('checkAIService', () => {
    it('should return warning when OpenRouter API key is not configured', async () => {
      delete process.env.OPENROUTER_API_KEY
      
      const result = await monitoring.checkAIService()
      
      expect(result).toEqual({
        status: 'warning',
        details: 'OpenRouter API key not configured'
      })
    })

    it('should return warning when OpenRouter API key is placeholder', async () => {
      process.env.OPENROUTER_API_KEY = 'test-key-placeholder'
      
      const result = await monitoring.checkAIService()
      
      expect(result).toEqual({
        status: 'warning',
        details: 'OpenRouter API key not configured'
      })
    })

    it('should check AI service successfully', async () => {
      process.env.OPENROUTER_API_KEY = 'valid-api-key'
      
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          data: [
            { id: 'model1' },
            { id: 'model2' }
          ]
        })
      } as any)
      
      const result = await monitoring.checkAIService()
      
      expect(result.status).toBe('healthy')
      expect(result.details).toMatchObject({
        connection: 'active',
        models_available: 2,
        api_version: 'v1'
      })
    })

    it('should handle AI service API errors', async () => {
      process.env.OPENROUTER_API_KEY = 'valid-api-key'
      
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      } as any)
      
      const result = await monitoring.checkAIService()
      
      expect(result.status).toBe('error')
      expect(result.error).toBe('OpenRouter API error: 401 Unauthorized')
    })

    it('should handle AI service network errors', async () => {
      process.env.OPENROUTER_API_KEY = 'valid-api-key'
      
      mockFetch.mockRejectedValue(new Error('Network error'))
      
      const result = await monitoring.checkAIService()
      
      expect(result.status).toBe('error')
      expect(result.error).toBe('Network error')
    })
  })

  describe('trackMetrics', () => {
    it('should submit memory and uptime metrics', async () => {
      mockGetDatadogApiKey.mockReturnValue('valid-api-key')
      
      await monitoring.trackMetrics()
      
      expect(mockFetch).toHaveBeenCalledTimes(3) // heap_used, heap_total, uptime
      
      // Check that memory metrics were submitted
      const calls = mockFetch.mock.calls
      const bodies = calls.map(call => JSON.parse(call[1]?.body as string))
      
      expect(bodies.some(body => body.series[0].metric === 'vibecode.memory.heap_used')).toBe(true)
      expect(bodies.some(body => body.series[0].metric === 'vibecode.memory.heap_total')).toBe(true)
      expect(bodies.some(body => body.series[0].metric === 'vibecode.uptime')).toBe(true)
    })

    it('should include environment tags in metrics', async () => {
      process.env.NODE_ENV = 'test'
      mockGetDatadogApiKey.mockReturnValue('valid-api-key')
      
      await monitoring.trackMetrics()
      
      const calls = mockFetch.mock.calls
      const bodies = calls.map(call => JSON.parse(call[1]?.body as string))
      
      bodies.forEach(body => {
        expect(body.series[0].tags).toContain('env:test')
        expect(body.series[0].tags).toContain('service:vibecode-webgui')
      })
    })
  })

  describe('isConfigured', () => {
    it('should return true when API key is configured', () => {
      // The default mock returns 'test-api-key' which is valid
      expect(monitoring.isConfigured()).toBe(true)
    })

    it('should return false when API key is not configured', () => {
      mockGetDatadogApiKey.mockReturnValue(undefined)
      
      // Create new instance to test isConfigured
      jest.resetModules()
      const datadogEnv = require('../datadog-env')
      datadogEnv.getDatadogApiKey.mockReturnValue(undefined)
      
      const { monitoring: newMonitoring } = require('../datadog-client')
      expect(newMonitoring.isConfigured()).toBe(false)
    })

    it('should return false when API key is placeholder', () => {
      mockGetDatadogApiKey.mockReturnValue('placeholder-set-real-key')
      
      // Create new instance to test isConfigured
      jest.resetModules()
      const datadogEnv = require('../datadog-env')
      datadogEnv.getDatadogApiKey.mockReturnValue('placeholder-set-real-key')
      
      const { monitoring: newMonitoring } = require('../datadog-client')
      expect(newMonitoring.isConfigured()).toBe(false)
    })
  })
})
