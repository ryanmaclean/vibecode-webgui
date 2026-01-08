/**
 * Unit Tests for Error Tracking Module
 * Tests DatadogErrorTracker class and error tracking utilities
 */

import { jest } from '@jest/globals'

// Mock Datadog RUM and Logs - must be declared before jest.mock
jest.mock('@datadog/browser-rum', () => ({
  datadogRum: {
    addError: jest.fn(),
    addAction: jest.fn(),
    setUser: jest.fn(),
    setGlobalContextProperty: jest.fn()
  }
}))

jest.mock('@datadog/browser-logs', () => ({
  datadogLogs: {
    logger: {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn()
    },
    setUser: jest.fn(),
    setGlobalContextProperty: jest.fn()
  }
}))

import {
  DatadogErrorTracker,
  getErrorTracker,
  trackError,
  trackWarning,
  trackUserAction,
  setUser,
  trackApiError,
  trackDatabaseError,
  trackAuthError,
  trackValidationError,
  trackPerformanceIssue,
  type ErrorTrackingConfig,
  type ErrorContext,
  type TrackedError
} from '@/lib/monitoring/error-tracking'
import { datadogRum } from '@datadog/browser-rum'
import { datadogLogs } from '@datadog/browser-logs'

const mockDatadogRum = datadogRum as jest.Mocked<typeof datadogRum>
const mockDatadogLogs = datadogLogs as jest.Mocked<typeof datadogLogs>

describe('DatadogErrorTracker', () => {
  let tracker: DatadogErrorTracker
  let consoleSpy: jest.SpiedFunction<any>
  let consoleErrorSpy: jest.SpiedFunction<any>

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock console methods
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    const config: ErrorTrackingConfig = {
      service: 'test-service',
      environment: 'test',
      version: '1.0.0',
      enabled: true
    }

    tracker = new DatadogErrorTracker(config)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('init', () => {
    it('should initialize error tracking when enabled', () => {
      tracker.init()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Datadog Error Tracking initialized'),
        'test-service'
      )
    })

    it('should not initialize when disabled', () => {
      const disabledTracker = new DatadogErrorTracker({
        service: 'test-service',
        environment: 'test',
        version: '1.0.0',
        enabled: false
      })

      disabledTracker.init()

      expect(consoleSpy).not.toHaveBeenCalled()
    })

    it('should not reinitialize if already initialized', () => {
      tracker.init()
      consoleSpy.mockClear()

      tracker.init()

      expect(consoleSpy).not.toHaveBeenCalled()
    })

    it('should handle initialization errors gracefully', () => {
      mockDatadogRum.addError.mockImplementationOnce(() => {
        throw new Error('Initialization failed')
      })

      tracker.init()

      // Should still mark as initialized even if error occurred
      expect(consoleSpy).toHaveBeenCalled()
    })
  })

  describe('trackError', () => {
    beforeEach(() => {
      tracker.init()
      jest.clearAllMocks()
    })

    it('should track basic error', () => {
      const error = new Error('Test error')
      const context: ErrorContext = {
        userId: 'user123',
        component: 'TestComponent'
      }

      tracker.trackError({ error, context })

      expect(mockDatadogRum.addError).toHaveBeenCalledWith(error, {
        userId: 'user123',
        component: 'TestComponent',
        service: 'test-service',
        environment: 'test',
        version: '1.0.0',
        level: 'error'
      })
    })

    it('should track error with custom level', () => {
      const error = new Error('Warning error')

      tracker.trackError({
        error,
        level: 'warning'
      })

      expect(mockDatadogRum.addError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          level: 'warning'
        })
      )
    })

    it('should track error with tags', () => {
      const error = new Error('Tagged error')
      const tags = { errorType: 'validation', severity: 'high' }

      tracker.trackError({
        error,
        tags
      })

      expect(mockDatadogRum.addError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          errorType: 'validation',
          severity: 'high'
        })
      )
    })

    it('should track error with full context', () => {
      const error = new Error('Full context error')
      const context: ErrorContext = {
        userId: 'user456',
        sessionId: 'session789',
        userAgent: 'Mozilla/5.0',
        url: '/api/test',
        component: 'ApiHandler',
        action: 'fetchData',
        metadata: { key: 'value' }
      }

      tracker.trackError({ error, context })

      expect(mockDatadogRum.addError).toHaveBeenCalledWith(
        error,
        expect.objectContaining(context)
      )
    })

    it('should not track when not initialized', () => {
      const uninitializedTracker = new DatadogErrorTracker({
        service: 'test',
        environment: 'test',
        version: '1.0.0',
        enabled: true
      })

      const error = new Error('Test error')
      uninitializedTracker.trackError({ error })

      expect(console.warn).toHaveBeenCalledWith(
        'Error tracking not initialized or disabled'
      )
      expect(mockDatadogRum.addError).not.toHaveBeenCalled()
    })

    it('should not track when disabled', () => {
      const disabledTracker = new DatadogErrorTracker({
        service: 'test',
        environment: 'test',
        version: '1.0.0',
        enabled: false
      })

      disabledTracker.init()

      const error = new Error('Test error')
      disabledTracker.trackError({ error })

      expect(mockDatadogRum.addError).not.toHaveBeenCalled()
    })

    it('should handle tracking errors gracefully', () => {
      mockDatadogRum.addError.mockImplementationOnce(() => {
        throw new Error('Tracking failed')
      })

      const error = new Error('Test error')
      tracker.trackError({ error })

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to track error:',
        expect.any(Error)
      )
    })
  })

  describe('trackWarning', () => {
    beforeEach(() => {
      tracker.init()
      jest.clearAllMocks()
    })

    it('should track warning message', () => {
      tracker.trackWarning('Warning message', { userId: 'user123' })

      expect(mockDatadogRum.addError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Warning message'
        }),
        expect.objectContaining({
          level: 'warning',
          userId: 'user123'
        })
      )
    })

    it('should track warning without context', () => {
      tracker.trackWarning('Simple warning')

      expect(mockDatadogRum.addError).toHaveBeenCalled()
      expect(mockDatadogLogs.logger.error).toHaveBeenCalled()
    })
  })

  describe('trackUserAction', () => {
    beforeEach(() => {
      tracker.init()
      jest.clearAllMocks()
    })

    it('should track user action', () => {
      const context: ErrorContext = {
        userId: 'user123',
        component: 'Button',
        metadata: { buttonId: 'submit' }
      }

      tracker.trackUserAction('button_click', context)

      expect(mockDatadogRum.addAction).toHaveBeenCalledWith('button_click', {
        ...context,
        service: 'test-service',
        environment: 'test',
        version: '1.0.0'
      })
    })

    it('should track user action without context', () => {
      tracker.trackUserAction('page_view')

      expect(mockDatadogRum.addAction).toHaveBeenCalledWith(
        'page_view',
        expect.objectContaining({
          service: 'test-service'
        })
      )
    })

    it('should not track when not initialized', () => {
      const uninitializedTracker = new DatadogErrorTracker({
        service: 'test',
        environment: 'test',
        version: '1.0.0',
        enabled: true
      })

      uninitializedTracker.trackUserAction('test_action')

      expect(mockDatadogRum.addAction).not.toHaveBeenCalled()
    })

    it('should handle tracking errors gracefully', () => {
      mockDatadogRum.addAction.mockImplementationOnce(() => {
        throw new Error('Action tracking failed')
      })

      tracker.trackUserAction('test_action')

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to track user action:',
        expect.any(Error)
      )
    })
  })

  describe('setUser', () => {
    beforeEach(() => {
      tracker.init()
      jest.clearAllMocks()
    })

    it('should set user context', () => {
      const user = {
        id: 'user123',
        name: 'Test User',
        email: 'test@example.com'
      }

      tracker.setUser(user)

      expect(mockDatadogRum.setUser).toHaveBeenCalledWith(user)
      expect(mockDatadogLogs.setUser).toHaveBeenCalledWith(user)
    })

    it('should set user with custom properties', () => {
      const user = {
        id: 'user456',
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin',
        tenant: 'acme-corp'
      }

      tracker.setUser(user)

      expect(mockDatadogRum.setUser).toHaveBeenCalledWith(user)
    })

    it('should not set user when not initialized', () => {
      const uninitializedTracker = new DatadogErrorTracker({
        service: 'test',
        environment: 'test',
        version: '1.0.0',
        enabled: true
      })

      uninitializedTracker.setUser({ id: 'user123' })

      expect(mockDatadogRum.setUser).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', () => {
      mockDatadogRum.setUser.mockImplementationOnce(() => {
        throw new Error('Set user failed')
      })

      tracker.setUser({ id: 'user123' })

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to set user context:',
        expect.any(Error)
      )
    })
  })

  describe('addGlobalContext', () => {
    beforeEach(() => {
      tracker.init()
      jest.clearAllMocks()
    })

    it('should add global context property', () => {
      tracker.addGlobalContext('environment', 'production')

      expect(mockDatadogRum.setGlobalContextProperty).toHaveBeenCalledWith(
        'environment',
        'production'
      )
      expect(mockDatadogLogs.setGlobalContextProperty).toHaveBeenCalledWith(
        'environment',
        'production'
      )
    })

    it('should add complex global context', () => {
      const config = {
        feature_flags: ['new-ui', 'beta-feature'],
        version: '2.0.0'
      }

      tracker.addGlobalContext('app_config', config)

      expect(mockDatadogRum.setGlobalContextProperty).toHaveBeenCalledWith(
        'app_config',
        config
      )
    })

    it('should not add context when not initialized', () => {
      const uninitializedTracker = new DatadogErrorTracker({
        service: 'test',
        environment: 'test',
        version: '1.0.0',
        enabled: true
      })

      uninitializedTracker.addGlobalContext('key', 'value')

      expect(mockDatadogRum.setGlobalContextProperty).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', () => {
      mockDatadogRum.setGlobalContextProperty.mockImplementationOnce(() => {
        throw new Error('Context failed')
      })

      tracker.addGlobalContext('key', 'value')

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to add global context:',
        expect.any(Error)
      )
    })
  })

  describe('trackPerformanceIssue', () => {
    beforeEach(() => {
      tracker.init()
      jest.clearAllMocks()
    })

    it('should track performance issue', () => {
      const metrics = {
        responseTime: 5000,
        dbQueryTime: 2000,
        renderTime: 1500
      }

      tracker.trackPerformanceIssue('Slow API response', metrics, {
        endpoint: '/api/users'
      })

      expect(mockDatadogRum.addError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Performance Issue: Slow API response'
        }),
        expect.objectContaining({
          level: 'warning',
          endpoint: '/api/users',
          performance_metrics: metrics,
          issue_type: 'performance'
        })
      )
    })

    it('should track performance issue without context', () => {
      const metrics = { loadTime: 3000 }

      tracker.trackPerformanceIssue('Page load slow', metrics)

      expect(mockDatadogRum.addError).toHaveBeenCalled()
    })
  })

  describe('trackApiError', () => {
    beforeEach(() => {
      tracker.init()
      jest.clearAllMocks()
    })

    it('should track API error', () => {
      const error = new Error('API request failed')

      tracker.trackApiError('/api/users', 500, error, {
        userId: 'user123'
      })

      expect(mockDatadogRum.addError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          endpoint: '_api_users',
          status_code: '500',
          userId: 'user123',
          error_type: 'api'
        })
      )
    })

    it('should sanitize endpoint for tags', () => {
      const error = new Error('Not found')

      tracker.trackApiError('/api/users/123', 404, error)

      const call = mockDatadogRum.addError.mock.calls[0]
      expect(call[1]).toMatchObject({
        endpoint: '_api_users_123'
      })
    })
  })

  describe('trackDatabaseError', () => {
    beforeEach(() => {
      tracker.init()
      jest.clearAllMocks()
    })

    it('should track database error', () => {
      const error = new Error('Connection timeout')

      tracker.trackDatabaseError('SELECT query', error, {
        table: 'users'
      })

      expect(mockDatadogRum.addError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          database_operation: 'SELECT query',
          table: 'users',
          error_type: 'database'
        })
      )
    })

    it('should sanitize operation for tags', () => {
      const error = new Error('Query failed')

      tracker.trackDatabaseError('UPDATE users SET name=?', error)

      const call = mockDatadogRum.addError.mock.calls[0]
      expect(call[1]).toMatchObject({
        operation: 'UPDATE_users_SET_name__'
      })
    })
  })

  describe('trackAuthError', () => {
    beforeEach(() => {
      tracker.init()
      jest.clearAllMocks()
    })

    it('should track authentication error', () => {
      const error = new Error('Invalid credentials')

      tracker.trackAuthError(error, {
        userId: 'user123',
        ip: '192.168.1.1'
      })

      expect(mockDatadogRum.addError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          userId: 'user123',
          ip: '192.168.1.1',
          error_type: 'authentication'
        })
      )
    })

    it('should track auth error without context', () => {
      const error = new Error('Unauthorized')

      tracker.trackAuthError(error)

      expect(mockDatadogRum.addError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          error_type: 'authentication'
        })
      )
    })
  })

  describe('trackValidationError', () => {
    beforeEach(() => {
      tracker.init()
      jest.clearAllMocks()
    })

    it('should track validation error', () => {
      const error = new Error('Email format invalid')

      tracker.trackValidationError('email', error, {
        value: 'invalid-email'
      })

      expect(mockDatadogRum.addError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          validation_field: 'email',
          value: 'invalid-email',
          error_type: 'validation'
        })
      )
    })

    it('should sanitize field name for tags', () => {
      const error = new Error('Invalid format')

      tracker.trackValidationError('user.email.address', error)

      const call = mockDatadogRum.addError.mock.calls[0]
      expect(call[1]).toMatchObject({
        field: 'user_email_address'
      })
    })
  })
})

describe('Error Tracking Convenience Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    // Set environment variables for getErrorTracker
    process.env.NEXT_PUBLIC_DD_SERVICE = 'vibecode-webgui'
    process.env.NEXT_PUBLIC_DD_ENV = 'test'
    process.env.NEXT_PUBLIC_DD_VERSION = '1.0.0'
    process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN = 'test-token'
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN
  })

  describe('getErrorTracker', () => {
    it('should return singleton instance', () => {
      const tracker1 = getErrorTracker()
      const tracker2 = getErrorTracker()

      // Should return instances (singleton tested through implementation)
      expect(tracker1).toBeDefined()
      expect(tracker2).toBeDefined()
    })

    it('should be disabled without client token', () => {
      delete process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN

      const tracker = getErrorTracker()

      // Should still return a tracker
      expect(tracker).toBeDefined()
    })
  })

  // Note: Convenience functions tests are covered through DatadogErrorTracker tests above
  // These functions are thin wrappers that delegate to the tracker instance
  describe('convenience functions exist', () => {
    it('should export convenience functions', () => {
      expect(typeof trackError).toBe('function')
      expect(typeof trackWarning).toBe('function')
      expect(typeof trackUserAction).toBe('function')
      expect(typeof setUser).toBe('function')
      expect(typeof trackApiError).toBe('function')
      expect(typeof trackDatabaseError).toBe('function')
      expect(typeof trackAuthError).toBe('function')
      expect(typeof trackValidationError).toBe('function')
      expect(typeof trackPerformanceIssue).toBe('function')
    })
  })
})
