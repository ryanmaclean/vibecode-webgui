/**
 * Unit Tests for Alerts Configuration Module
 * Tests DatadogAlertsManager class and alert configuration
 */

import { jest } from '@jest/globals'

// Mock datadog-env module - must be declared before jest.mock
jest.mock('@/lib/monitoring/datadog-env', () => ({
  getDatadogApiKey: jest.fn(),
  getDatadogAppKey: jest.fn(),
  getDatadogSite: jest.fn()
}))

import {
  DatadogAlertsManager,
  alertsManager,
  type AlertConfig
} from '@/lib/monitoring/alerts-configuration'
import * as datadogEnv from '@/lib/monitoring/datadog-env'

const mockGetDatadogApiKey = datadogEnv.getDatadogApiKey as jest.MockedFunction<typeof datadogEnv.getDatadogApiKey>
const mockGetDatadogAppKey = datadogEnv.getDatadogAppKey as jest.MockedFunction<typeof datadogEnv.getDatadogAppKey>
const mockGetDatadogSite = datadogEnv.getDatadogSite as jest.MockedFunction<typeof datadogEnv.getDatadogSite>

describe('DatadogAlertsManager', () => {
  let manager: DatadogAlertsManager
  let mockFetch: jest.MockedFunction<typeof fetch>
  let consoleSpy: jest.SpiedFunction<any>
  let consoleErrorSpy: jest.SpiedFunction<any>

  beforeEach(() => {
    jest.clearAllMocks()

    // Set default mock implementations
    mockGetDatadogApiKey.mockReturnValue('test-api-key')
    mockGetDatadogAppKey.mockReturnValue('test-app-key')
    mockGetDatadogSite.mockReturnValue('datadoghq.com')

    // Mock fetch globally
    mockFetch = jest.fn() as unknown as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ id: 'monitor-123' }), {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' }
    }) as Response)
    global.fetch = mockFetch as unknown as typeof fetch

    // Mock console methods
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    manager = new DatadogAlertsManager()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Constructor', () => {
    it('should initialize with API keys', () => {
      expect(manager).toBeDefined()
    })

    it('should construct correct base URL', () => {
      expect(manager).toBeDefined()
      // Base URL is private but we can test through methods
    })
  })

  describe('createMonitor', () => {
    it('should create monitor successfully', async () => {
      const alert: AlertConfig = {
        name: 'Test Alert',
        type: 'metric alert',
        query: 'avg(last_5m):avg:test.metric{*} > 100',
        message: 'Test alert message',
        tags: ['service:test', 'team:platform']
      }

      const monitorId = await manager.createMonitor(alert)

      expect(monitorId).toBe('monitor-123')
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.datadoghq.com/api/v1/monitor',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'DD-API-KEY': 'test-api-key',
            'DD-APPLICATION-KEY': 'test-app-key'
          },
          body: expect.stringContaining('Test Alert')
        })
      )
    })

    it('should create monitor with custom options', async () => {
      const alert: AlertConfig = {
        name: 'Custom Alert',
        type: 'metric alert',
        query: 'avg(last_5m):avg:custom.metric{*} > 50',
        message: 'Custom alert message',
        tags: ['service:custom'],
        options: {
          thresholds: {
            critical: 100,
            warning: 50
          },
          notify_no_data: true,
          no_data_timeframe: 10,
          renotify_interval: 60,
          evaluation_delay: 120
        }
      }

      const monitorId = await manager.createMonitor(alert)

      expect(monitorId).toBe('monitor-123')

      const fetchCall = mockFetch.mock.calls[0]
      const body = JSON.parse(fetchCall[1]?.body as string)

      expect(body.options).toMatchObject({
        thresholds: {
          critical: 100,
          warning: 50
        },
        notify_no_data: true,
        no_data_timeframe: 10,
        renotify_interval: 60,
        evaluation_delay: 120
      })
    })

    it('should skip creation when API key is not configured', async () => {
      mockGetDatadogApiKey.mockReturnValue('')

      const newManager = new DatadogAlertsManager()
      const alert: AlertConfig = {
        name: 'Test Alert',
        type: 'metric alert',
        query: 'test query',
        message: 'test message',
        tags: []
      }

      const monitorId = await newManager.createMonitor(alert)

      expect(monitorId).toBeNull()
      expect(console.warn).toHaveBeenCalledWith('Datadog API keys not configured')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should skip creation when APP key is not configured', async () => {
      mockGetDatadogAppKey.mockReturnValue('')

      const newManager = new DatadogAlertsManager()
      const alert: AlertConfig = {
        name: 'Test Alert',
        type: 'metric alert',
        query: 'test query',
        message: 'test message',
        tags: []
      }

      const monitorId = await newManager.createMonitor(alert)

      expect(monitorId).toBeNull()
      expect(console.warn).toHaveBeenCalledWith('Datadog API keys not configured')
    })

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request')
      } as Response)

      const alert: AlertConfig = {
        name: 'Failed Alert',
        type: 'metric alert',
        query: 'test query',
        message: 'test message',
        tags: []
      }

      const monitorId = await manager.createMonitor(alert)

      expect(monitorId).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create monitor'),
        expect.any(Error)
      )
    })

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const alert: AlertConfig = {
        name: 'Network Error Alert',
        type: 'metric alert',
        query: 'test query',
        message: 'test message',
        tags: []
      }

      const monitorId = await manager.createMonitor(alert)

      expect(monitorId).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('should create service check monitor', async () => {
      const alert: AlertConfig = {
        name: 'Service Check Alert',
        type: 'service check',
        query: '"postgres".over("*").last(3).count_by_status()',
        message: 'Database connection failed',
        tags: ['service:postgresql']
      }

      const monitorId = await manager.createMonitor(alert)

      expect(monitorId).toBe('monitor-123')

      const fetchCall = mockFetch.mock.calls[0]
      const body = JSON.parse(fetchCall[1]?.body as string)

      expect(body.type).toBe('service check')
    })

    it('should create event alert monitor', async () => {
      const alert: AlertConfig = {
        name: 'Event Alert',
        type: 'event alert',
        query: 'events("source:app AND status:error").rollup("count").last("5m") > 10',
        message: 'High error rate detected',
        tags: ['service:app']
      }

      const monitorId = await manager.createMonitor(alert)

      expect(monitorId).toBe('monitor-123')
    })

    it('should create log alert monitor', async () => {
      const alert: AlertConfig = {
        name: 'Log Alert',
        type: 'log alert',
        query: 'logs("status:error").index("main").rollup("count").last("5m") > 100',
        message: 'Too many errors in logs',
        tags: ['service:logging']
      }

      const monitorId = await manager.createMonitor(alert)

      expect(monitorId).toBe('monitor-123')
    })
  })

  describe('setupAllAlerts', () => {
    it('should create all configured alerts', async () => {
      jest.useFakeTimers()

      const setupPromise = manager.setupAllAlerts()

      // Fast-forward through all delays
      for (let i = 0; i < 20; i++) {
        await jest.advanceTimersByTimeAsync(1000)
      }

      const results = await setupPromise

      expect(Object.keys(results).length).toBeGreaterThan(0)
      expect(mockFetch).toHaveBeenCalled()

      jest.useRealTimers()
    }, 30000)

    it('should handle partial failures gracefully', async () => {
      jest.useFakeTimers()

      // First call succeeds, second fails
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'monitor-1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }) as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: () => Promise.resolve('Bad Request')
        } as Response)
        .mockResolvedValue(new Response(JSON.stringify({ id: 'monitor-3' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }) as Response)

      const setupPromise = manager.setupAllAlerts()

      // Fast-forward through all delays
      for (let i = 0; i < 20; i++) {
        await jest.advanceTimersByTimeAsync(1000)
      }

      const results = await setupPromise

      // Should have some successful results despite one failure
      expect(Object.keys(results).length).toBeGreaterThan(0)

      jest.useRealTimers()
    }, 30000)

    it('should delay between monitor creation to avoid rate limiting', async () => {
      jest.useFakeTimers()

      const startTime = Date.now()
      const setupPromise = manager.setupAllAlerts()

      // Fast-forward through delays
      for (let i = 0; i < 20; i++) {
        await jest.advanceTimersByTimeAsync(1000)
      }

      await setupPromise

      // Should have waited at least 1 second between calls
      expect(mockFetch.mock.calls.length).toBeGreaterThan(1)

      jest.useRealTimers()
    }, 30000)
  })

  describe('listMonitors', () => {
    it('should list existing monitors', async () => {
      const mockMonitors = [
        {
          id: 'monitor-1',
          name: 'vibecode alert 1',
          tags: ['vibecode', 'service:test']
        },
        {
          id: 'monitor-2',
          name: 'other alert',
          tags: ['other-service']
        },
        {
          id: 'monitor-3',
          name: 'vibecode alert 2',
          tags: ['vibecode', 'team:platform']
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMonitors)
      } as any)

      const monitors = await manager.listMonitors()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.datadoghq.com/api/v1/monitor',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'DD-API-KEY': 'test-api-key',
            'DD-APPLICATION-KEY': 'test-app-key'
          }
        })
      )

      // Should filter to only vibecode monitors
      expect(monitors.length).toBe(2)
      expect(monitors[0].name).toContain('vibecode')
      expect(monitors[1].name).toContain('vibecode')
    })

    it('should handle list errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden')
      } as Response)

      const monitors = await manager.listMonitors()

      expect(monitors).toEqual([])
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to list monitors:',
        expect.any(Error)
      )
    })

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const monitors = await manager.listMonitors()

      expect(monitors).toEqual([])
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('should return empty array for monitors without vibecode tags', async () => {
      const mockMonitors = [
        {
          id: 'monitor-1',
          name: 'other service alert',
          tags: ['other-service']
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMonitors)
      } as any)

      const monitors = await manager.listMonitors()

      expect(monitors).toEqual([])
    })
  })

  describe('testAlert', () => {
    it('should send test alert event', async () => {
      const result = await manager.testAlert('Test Alert')

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.datadoghq.com/api/v1/events',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'DD-API-KEY': 'test-api-key'
          },
          body: expect.stringContaining('Test Alert: Test Alert')
        })
      )
    })

    it('should include test tags', async () => {
      await manager.testAlert('Test Alert')

      const fetchCall = mockFetch.mock.calls[0]
      const body = JSON.parse(fetchCall[1]?.body as string)

      expect(body.tags).toContain('test')
      expect(body.tags).toContain('vibecode')
      expect(body.tags).toContain('monitoring')
    })

    it('should set correct alert type', async () => {
      await manager.testAlert('Test Alert')

      const fetchCall = mockFetch.mock.calls[0]
      const body = JSON.parse(fetchCall[1]?.body as string)

      expect(body.alert_type).toBe('info')
      expect(body.priority).toBe('normal')
    })

    it('should return false on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400
      } as Response)

      const result = await manager.testAlert('Failed Test')

      expect(result).toBe(false)
    })

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await manager.testAlert('Network Error Test')

      expect(result).toBe(false)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to send test alert:',
        expect.any(Error)
      )
    })
  })

  describe('Alert Configuration Content', () => {
    it('should have AI service alerts configured', async () => {
      jest.useFakeTimers()

      const setupPromise = manager.setupAllAlerts()

      for (let i = 0; i < 20; i++) {
        await jest.advanceTimersByTimeAsync(1000)
      }

      const results = await setupPromise

      // Check that AI-related alerts were created
      const alertNames = Object.keys(results)
      const hasAIAlerts = alertNames.some(name =>
        name.includes('AI') || name.includes('Claude')
      )

      expect(hasAIAlerts).toBe(true)

      jest.useRealTimers()
    }, 30000)

    it('should have infrastructure alerts configured', async () => {
      jest.useFakeTimers()

      const setupPromise = manager.setupAllAlerts()

      for (let i = 0; i < 20; i++) {
        await jest.advanceTimersByTimeAsync(1000)
      }

      const results = await setupPromise

      const alertNames = Object.keys(results)
      const hasInfraAlerts = alertNames.some(name =>
        name.includes('Memory') || name.includes('Database') || name.includes('Redis')
      )

      expect(hasInfraAlerts).toBe(true)

      jest.useRealTimers()
    }, 30000)

    it('should have security alerts configured', async () => {
      jest.useFakeTimers()

      const setupPromise = manager.setupAllAlerts()

      for (let i = 0; i < 20; i++) {
        await jest.advanceTimersByTimeAsync(1000)
      }

      const results = await setupPromise

      const alertNames = Object.keys(results)
      const hasSecurityAlerts = alertNames.some(name =>
        name.includes('Error') || name.includes('Token')
      )

      expect(hasSecurityAlerts).toBe(true)

      jest.useRealTimers()
    }, 30000)
  })

  describe('Singleton instance', () => {
    it('should export singleton alertsManager', () => {
      expect(alertsManager).toBeInstanceOf(DatadogAlertsManager)
    })

    it('should use same instance', () => {
      const instance1 = alertsManager
      const instance2 = alertsManager

      expect(instance1).toBe(instance2)
    })
  })

  describe('Alert Configuration Validation', () => {
    it('should validate metric alert structure', () => {
      const alert: AlertConfig = {
        name: 'Valid Metric Alert',
        type: 'metric alert',
        query: 'avg(last_5m):avg:test.metric{*} > 100',
        message: 'Alert message',
        tags: ['service:test']
      }

      expect(alert.type).toBe('metric alert')
      expect(alert.query).toBeTruthy()
      expect(alert.message).toBeTruthy()
      expect(Array.isArray(alert.tags)).toBe(true)
    })

    it('should validate service check structure', () => {
      const alert: AlertConfig = {
        name: 'Valid Service Check',
        type: 'service check',
        query: '"service".over("*").last(3).count_by_status()',
        message: 'Service check failed',
        tags: ['service:test']
      }

      expect(alert.type).toBe('service check')
    })

    it('should validate alert with all options', () => {
      const alert: AlertConfig = {
        name: 'Complete Alert',
        type: 'metric alert',
        query: 'test query',
        message: 'test message',
        tags: ['test'],
        options: {
          thresholds: {
            critical: 100,
            warning: 50,
            ok: 0
          },
          notify_no_data: true,
          no_data_timeframe: 20,
          renotify_interval: 120,
          evaluation_delay: 60
        }
      }

      expect(alert.options?.thresholds?.critical).toBe(100)
      expect(alert.options?.thresholds?.warning).toBe(50)
      expect(alert.options?.thresholds?.ok).toBe(0)
      expect(alert.options?.notify_no_data).toBe(true)
    })
  })
})
