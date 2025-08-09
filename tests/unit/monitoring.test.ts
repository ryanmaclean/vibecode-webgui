/**
 * Unit tests for monitoring functions
 * Tests Datadog integration and monitoring utilities
 */

import { jest } from '@jest/globals'

// Mock Datadog modules
jest.mock('@datadog/browser-rum', () => ({
  datadogRum: {
    init: jest.fn(),
    startSessionReplayRecording: jest.fn(),
    addAction: jest.fn(),
    addError: jest.fn(),
    addTiming: jest.fn(),
  },
}));

jest.mock('@datadog/browser-logs', () => ({
  datadogLogs: {
    init: jest.fn(),
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  },
}));

import { monitoring } from '../../src/lib/monitoring'
import { datadogRum } from '@datadog/browser-rum'
import { datadogLogs } from '@datadog/browser-logs'

describe('Monitoring Library', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment
    delete (global as any).window
  });

  afterEach(() => {
    jest.restoreAllMocks()})

  describe('Browser Environment', () => {
    beforeEach(() => {
      // Mock browser environment
      if (!(global as any).window) {
        Object.defineProperty(global, 'window', {
        value: {
          location: { href: 'http://localhost:3000' },
          navigator: { userAgent: 'test-agent' },
          performance: {
            getEntriesByType: jest.fn(() => []),
            mark: jest.fn(),
            measure: jest.fn(),
          },
        },
        writable: true,
      });
    });

    test('should initialize Datadog RUM and Logs', () => {
      monitoring.init();

      expect(datadogRum.init).toHaveBeenCalledWith({
        applicationId: process.env.NEXT_PUBLIC_DD_RUM_APPLICATION_ID || 'test-app-id',
        clientToken: process.env.NEXT_PUBLIC_DD_RUM_CLIENT_TOKEN || 'test-client-token',
        site: 'datadoghq.com',
        service: 'vibecode-webgui',
        env: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        sessionSampleRate: 100,
        sessionReplaySampleRate: 20,
        trackUserInteractions: true,
        trackResources: true,
        trackLongTasks: true,
        defaultPrivacyLevel: 'mask-user-input',
      });

      expect(datadogLogs.init).toHaveBeenCalledWith({
        clientToken: process.env.NEXT_PUBLIC_DD_RUM_CLIENT_TOKEN || 'test-client-token',
        site: 'datadoghq.com',
        service: 'vibecode-webgui',
        env: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        forwardErrorsToLogs: true,
        sessionSampleRate: 100,
      });
    })

    test('should track page view', () => {
      monitoring.trackPageView('/test-page', { userId: 'user123' });

      expect(datadogRum.addAction).toHaveBeenCalledWith('page_view', {
        page: '/test-page',
        userId: 'user123',
      });
    });

    test('should track custom event', () => {
      const eventData = { action: 'click', element: 'button' };
      monitoring.trackEvent('user_interaction', eventData);

      expect.*toHaveBeenCalledWith.*);;
    });

    test('should log info messages', () => {
      monitoring.logInfo('Test info message', { key: 'value' })

      expect.*toHaveBeenCalledWith.*);
    })

    test('should log warning messages', () => {
      monitoring.logWarning('Test warning', { level: 'warning' })

      expect.*toHaveBeenCalledWith.*);
    })

    test('should log error messages', () => {
      const error = new Error('Test error')
      monitoring.logError('Error occurred', { error })

      expect.*toHaveBeenCalledWith.*);
      expect.*toHaveBeenCalledWith.*);
    })

    test('should track performance metrics', () => {
      monitoring.trackPerformance('api_call', 150, { endpoint: '/api/test' })

      expect.*toHaveBeenCalledWith.*);
      expect(datadogRum.addAction).toHaveBeenCalledWith('performance_metric', {
        metric: 'api_call',
        duration: 150,
        endpoint: '/api/test',
      })
    })

    test('should track workspace events', () => {
      monitoring.trackWorkspaceEvent('file_opened', 'workspace123', { fileName: 'test.js' })

      expect(datadogRum.addAction).toHaveBeenCalledWith('workspace_event', {
        event: 'file_opened',
        workspaceId: 'workspace123',
        fileName: 'test.js',
      })
    })

    test('should track Core Web Vitals', () => {
      const mockObserver = {
        observe: jest.fn(),
        disconnect: jest.fn(),
      }

      // Mock PerformanceObserver
      global.PerformanceObserver = jest.fn().mockImplementation((callback) => {
        // Simulate CLS measurement
        setTimeout(() => {
          callback({
            getEntries: () => [
              {
                name: 'layout-shift',
                value: 0.05,
                hadRecentInput: false,
              },
            ],
          })}, 0);
        return mockObserver
      });

      monitoring.trackCoreWebVitals();

      expect.*toHaveBeenCalled();})})

  describe('Server Environment', () => {
    test('should handle server environment gracefully', () => {
      // No window object in server environment
      expect(() => monitoring.init()).not.toThrow()
      expect(() => monitoring.trackPageView('/test')).not.toThrow()
      expect(() => monitoring.trackEvent('test', {})).not.toThrow()})})

  describe('Error Handling', () => {
    beforeEach(() => {
      Object.defineProperty(global, 'window', {
        value: {
          location: { href: 'http://localhost:3000' },
          navigator: { userAgent: 'test-agent' },
        },
        writable: true,
      })})

    test('should handle Datadog initialization errors', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Mock Datadog init to throw
      (datadogRum.init as jest.Mock).mockImplementation(() => {
        throw new Error('Init failed')});

      expect(() => monitoring.init()).not.toThrow()
      expect.*toHaveBeenCalledWith.*);;

      consoleSpy.mockRestore()})

    test('should handle tracking errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Mock addAction to throw
      (datadogRum.addAction as jest.Mock).mockImplementation(() => {
        throw new Error('Tracking failed')})

      expect(() => monitoring.trackEvent('test', {})).not.toThrow();
      expect.*toHaveBeenCalled();;

      consoleSpy.mockRestore()})})

  describe('Data Sanitization', () => {
    beforeEach(() => {
      Object.defineProperty(global, 'window', {
        value: {
          location: { href: 'http://localhost:3000' },
          navigator: { userAgent: 'test-agent' },
        },
        writable: true,
      })})

    test('should sanitize sensitive data', () => {
      const sensitiveData = {
        password: 'secret123',
        token: 'bearer-token',
        apiKey: 'api-key-value',
        normalField: 'safe-value',
      }
      monitoring.trackEvent('login_attempt', sensitiveData)

      expect(datadogRum.addAction).toHaveBeenCalledWith('login_attempt', {
        password: '[REDACTED]',
        token: '[REDACTED]',
        apiKey: '[REDACTED]',
        normalField: 'safe-value',
      })})})});
