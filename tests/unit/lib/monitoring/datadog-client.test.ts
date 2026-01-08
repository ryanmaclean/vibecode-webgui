/**
 * Unit Tests for Datadog Client
 * Tests the MonitoringService class and its methods
 */

import { jest } from '@jest/globals'

// Mock the datadog-env module
const mockGetDatadogApiKey = jest.fn()
const mockGetDatadogSite = jest.fn()

jest.mock('@/lib/monitoring/datadog-env', () => ({
  getDatadogApiKey: mockGetDatadogApiKey,
  getDatadogSite: mockGetDatadogSite
}))

const loadClient = () => require('@/lib/monitoring/datadog-client')

describe('MonitoringService', () => {
  let mockFetch: jest.MockedFunction<typeof fetch>
  let warnSpy: any
  let errorSpy: any

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()

    // Set default mock implementations
    mockGetDatadogApiKey.mockReturnValue('test-api-key')
    mockGetDatadogSite.mockReturnValue('datadoghq.com')

    // Mock fetch globally with a real WHATWG Response (polyfilled in test env)
    mockFetch = (jest.fn() as unknown as jest.MockedFunction<typeof fetch>)
    mockFetch.mockResolvedValue(new Response('{}', { status: 200, statusText: 'OK' }) as Response)
    global.fetch = mockFetch as unknown as typeof fetch

    // Mock process.memoryUsage globally
    jest.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 100 * 1024 * 1024,
      heapTotal: 50 * 1024 * 1024,
      heapUsed: 30 * 1024 * 1024,
      external: 10 * 1024 * 1024,
      arrayBuffers: 5 * 1024 * 1024
    })

    // Ensure server-side behavior
    delete (global as any).window
    ;(global as any).window = undefined

    // Mock process.uptime
    jest.spyOn(process, 'uptime').mockReturnValue(3600)

    // Spy on console methods
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    // Default: provide a valid API key via environment (bypasses mock inconsistencies)
    process.env = { ...process.env, DD_API_KEY: 'test-api-key' } as any
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Constructor', () => {
    it('should initialize with server-side configuration', () => {
      // Import the singleton instance
      const { monitoring } = loadClient()
      
      expect(monitoring).toBeDefined()
      expect(monitoring.isConfigured()).toBe(true)
    })

    it('should have proper configuration methods', () => {
      const { monitoring } = loadClient()
      
      expect(typeof monitoring.submitMetric).toBe('function')
      expect(typeof monitoring.submitEvent).toBe('function')
      expect(typeof monitoring.checkDatabase).toBe('function')
      expect(typeof monitoring.checkValkey).toBe('function')
      expect(typeof monitoring.checkAIService).toBe('function')
      expect(typeof monitoring.trackMetrics).toBe('function')
      expect(typeof monitoring.isConfigured).toBe('function')
    })
  })

  describe('submitMetric', () => {
    it('should submit metric successfully', async () => {
      const { monitoring } = loadClient()
      
      const testMetric = {
        metric: 'test.metric',
        value: 42,
        tags: ['tag1', 'tag2'],
        timestamp: 1234567890
      }

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
      
      const { monitoring } = loadClient()
      
      const result = await monitoring.submitMetric({
        metric: 'test.metric',
        value: 42
      })
      
      expect(result).toBe(false)
      expect(warnSpy).toHaveBeenCalledWith('Datadog API key not configured - metric submission skipped')
    })

    it('should skip submission when API key is placeholder', async () => {
      mockGetDatadogApiKey.mockReturnValue('placeholder-set-real-key')
      
      const { monitoring } = loadClient()
      
      const result = await monitoring.submitMetric({
        metric: 'test.metric',
        value: 42
      })
      
      expect(result).toBe(false)
      expect(warnSpy).toHaveBeenCalledWith('Datadog API key not configured - metric submission skipped')
    })

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      } as Response)

      const { monitoring } = loadClient()

      const result = await monitoring.submitMetric({
        metric: 'test.metric',
        value: 42
      })
      
      expect(result).toBe(false)
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to submit metric to Datadog:',
        expect.any(Error)
      )
    })

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { monitoring } = loadClient()

      const result = await monitoring.submitMetric({
        metric: 'test.metric',
        value: 42
      })
      
      expect(result).toBe(false)
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to submit metric to Datadog:',
        expect.any(Error)
      )
    })

    it('should use default timestamp when not provided', async () => {
      const { monitoring } = loadClient()
      
      const testMetric = {
        metric: 'test.metric',
        value: 42
      }

      await monitoring.submitMetric(testMetric)
      
      const fetchCall = mockFetch.mock.calls[0]
      const body = JSON.parse(fetchCall[1]?.body as string)
      
      expect(body.series[0].points[0][0]).toBeGreaterThan(0) // Should be current timestamp
    })
  })

  describe('submitEvent', () => {
    it('should submit event successfully', async () => {
      const { monitoring } = loadClient()
      
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
      
      const { monitoring } = loadClient()
      
      const result = await monitoring.submitEvent('Test Event', 'Test description')
      
      expect(result).toBe(false)
      expect(warnSpy).toHaveBeenCalledWith('Datadog API key not configured - event submission skipped')
    })

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      } as Response)

      const { monitoring } = loadClient()

      const result = await monitoring.submitEvent('Test Event', 'Test description')
      
      expect(result).toBe(false)
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to submit event to Datadog:',
        expect.any(Error)
      )
    })
  })

  describe('checkDatabase', () => {
    it('should return healthy when DATABASE_URL is not configured', async () => {
      delete process.env.DATABASE_URL
      
      const { monitoring } = loadClient()
      
      const result = await monitoring.checkDatabase()
      
      expect(result).toEqual({
        status: 'healthy',
        details: 'Database not configured (using file storage)'
      })
    })

    it('should handle non-PostgreSQL URLs', async () => {
      process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/testdb'
      
      const { monitoring } = loadClient()
      
      const result = await monitoring.checkDatabase()
      
      expect(result.status).toBe('healthy')
      expect(result.details).toMatchObject({
        host: 'localhost',
        database: 'testdb'
      })
    })

    it('should handle invalid DATABASE_URL', async () => {
      process.env.DATABASE_URL = 'invalid-url'
      
      const { monitoring } = loadClient()
      
      const result = await monitoring.checkDatabase()
      
      expect(result.status).toBe('error')
      expect(result.error).toBeDefined()
    })
  })

  describe('checkValkey', () => {
    it('should return healthy when REDIS_URL is not configured', async () => {
      delete process.env.REDIS_URL
      
      const { monitoring } = loadClient()
      
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
      
      const { monitoring } = loadClient()
      
      const result = await monitoring.checkAIService()
      
      expect(result.status).toBe('warning')
      expect(result.details).toBe('OpenRouter API key not configured')
    })

    it('should return warning when OpenRouter API key is placeholder', async () => {
      process.env.OPENROUTER_API_KEY = 'test-key-placeholder'
      
      const { monitoring } = loadClient()
      
      const result = await monitoring.checkAIService()
      
      expect(result.status).toBe('warning')
      expect(result.details).toBe('OpenRouter API key not configured')
    })

    it('should check AI service successfully', async () => {
      process.env.OPENROUTER_API_KEY = 'valid-key'
      
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: ['model1', 'model2'] })
      } as any)

      const { monitoring } = loadClient()

      const result = await monitoring.checkAIService()
      
      expect(result.status).toBe('healthy')
      expect(result.details).toMatchObject({
        connection: 'active',
        models_available: 2,
        api_version: 'v1'
      })
    })

    it('should handle AI service API errors', async () => {
      process.env.OPENROUTER_API_KEY = 'valid-key'
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      } as Response)

      const { monitoring } = loadClient()

      const result = await monitoring.checkAIService()
      
      expect(result.status).toBe('error')
      expect(result.error).toContain('OpenRouter API error')
    })

    it('should handle AI service network errors', async () => {
      process.env.OPENROUTER_API_KEY = 'valid-key'
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { monitoring } = loadClient()

      const result = await monitoring.checkAIService()
      
      expect(result.status).toBe('error')
      expect(result.error).toBe('Network error')
    })
  })

  describe('trackMetrics', () => {
    it('should submit memory and uptime metrics', async () => {
      const { monitoring } = loadClient()
      
      await monitoring.trackMetrics()
      
      expect(mockFetch).toHaveBeenCalledTimes(3) // heap_used, heap_total, uptime
      
      // Check that memory metrics were submitted
      const calls = mockFetch.mock.calls
      const heapUsedCall = calls.find(call => 
        JSON.parse(call[1]?.body as string).series[0].metric === 'vibecode.memory.heap_used'
      )
      expect(heapUsedCall).toBeDefined()
      
      const heapTotalCall = calls.find(call => 
        JSON.parse(call[1]?.body as string).series[0].metric === 'vibecode.memory.heap_total'
      )
      expect(heapTotalCall).toBeDefined()
      
      const uptimeCall = calls.find(call => 
        JSON.parse(call[1]?.body as string).series[0].metric === 'vibecode.uptime'
      )
      expect(uptimeCall).toBeDefined()
    })

    it('should include environment tags in metrics', async () => {
      const currentEnv = process.env.NODE_ENV || 'development'
      
      const { monitoring } = loadClient()
      
      await monitoring.trackMetrics()
      
      const calls = mockFetch.mock.calls
      const body = JSON.parse(calls[0][1]?.body as string)
      
      expect(body.series[0].tags).toContain('service:vibecode-webgui')
      expect(body.series[0].tags).toContain(`env:${currentEnv}`)
    })
  })

  describe('isConfigured', () => {
    it('should return true when API key is configured', () => {
      const { monitoring } = loadClient()
      
      expect(monitoring.isConfigured()).toBe(true)
    })

    it('should return false when API key is not configured', () => {
      mockGetDatadogApiKey.mockReturnValue(undefined)
      
      const { monitoring } = loadClient()
      
      expect(monitoring.isConfigured()).toBe(false)
    })

    it('should return false when API key is placeholder', () => {
      mockGetDatadogApiKey.mockReturnValue('placeholder-set-real-key')
      
      const { monitoring } = loadClient()
      
      expect(monitoring.isConfigured()).toBe(false)
    })
  })
})
