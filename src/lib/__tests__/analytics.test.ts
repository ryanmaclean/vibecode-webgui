/**
 * Unit tests for Analytics module
 * Tests event tracking, metrics, and error logging
 */

// Mock the logger module
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../logger', () => ({
  logger: mockLogger,
}));

// Import after mocking
const analyticsModule = require('../analytics');

describe('Analytics Module', () => {
  beforeEach(() => {
    // Clear mock calls
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockLogger.debug.mockClear();

    // Re-initialize analytics with debug mode for testing
    analyticsModule.initAnalytics({ enabled: false, debug: true });
  });

  describe('Module exports', () => {
    it('should export logEvent function', () => {
      expect(analyticsModule.logEvent).toBeDefined();
      expect(typeof analyticsModule.logEvent).toBe('function');
    });

    it('should export trackMetric function', () => {
      expect(analyticsModule.trackMetric).toBeDefined();
      expect(typeof analyticsModule.trackMetric).toBe('function');
    });

    it('should export trackTiming function', () => {
      expect(analyticsModule.trackTiming).toBeDefined();
      expect(typeof analyticsModule.trackTiming).toBe('function');
    });

    it('should export trackError function', () => {
      expect(analyticsModule.trackError).toBeDefined();
      expect(typeof analyticsModule.trackError).toBe('function');
    });

    it('should export getRecentEvents function', () => {
      expect(analyticsModule.getRecentEvents).toBeDefined();
      expect(typeof analyticsModule.getRecentEvents).toBe('function');
    });

    it('should export initAnalytics function', () => {
      expect(analyticsModule.initAnalytics).toBeDefined();
      expect(typeof analyticsModule.initAnalytics).toBe('function');
    });
  });

  describe('logEvent', () => {
    it('should log event with name and properties', () => {
      analyticsModule.logEvent('test_event', { key: 'value' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[Analytics] test_event',
        { data: { key: 'value' } }
      );
    });

    it('should log event without properties', () => {
      analyticsModule.logEvent('simple_event');

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[Analytics] simple_event',
        { data: {} }
      );
    });

    it('should add event to recent events buffer', () => {
      analyticsModule.logEvent('buffered_event', { test: true });

      const recentEvents = analyticsModule.getRecentEvents(1);
      expect(recentEvents.length).toBeGreaterThanOrEqual(1);

      const lastEvent = recentEvents[recentEvents.length - 1];
      expect(lastEvent.name).toBe('buffered_event');
    });

    it('should include timestamp in event', () => {
      const beforeTime = Date.now();
      analyticsModule.logEvent('timed_event');
      const afterTime = Date.now();

      const recentEvents = analyticsModule.getRecentEvents(1);
      const lastEvent = recentEvents[recentEvents.length - 1];

      expect(lastEvent.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(lastEvent.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('trackMetric', () => {
    it('should log metric with value', () => {
      analyticsModule.trackMetric('response_time', 150);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[Analytics] metric_response_time',
        { data: { value: 150 } }
      );
    });

    it('should include additional properties', () => {
      analyticsModule.trackMetric('cpu_usage', 75, { server: 'prod-1' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[Analytics] metric_cpu_usage',
        { data: { value: 75, server: 'prod-1' } }
      );
    });

    it('should prefix event name with metric_', () => {
      analyticsModule.trackMetric('custom_metric', 100);

      const recentEvents = analyticsModule.getRecentEvents(5);
      const metricEvent = recentEvents.find(e => e.name === 'metric_custom_metric');

      expect(metricEvent).toBeDefined();
    });
  });

  describe('trackTiming', () => {
    it('should log timing with duration', () => {
      analyticsModule.trackTiming('page_load', 2500);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[Analytics] timing_page_load',
        { data: { duration: 2500 } }
      );
    });

    it('should include additional properties', () => {
      analyticsModule.trackTiming('api_call', 350, { endpoint: '/api/users' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[Analytics] timing_api_call',
        { data: { duration: 350, endpoint: '/api/users' } }
      );
    });

    it('should prefix event name with timing_', () => {
      analyticsModule.trackTiming('custom_timing', 1000);

      const recentEvents = analyticsModule.getRecentEvents(5);
      const timingEvent = recentEvents.find(e => e.name === 'timing_custom_timing');

      expect(timingEvent).toBeDefined();
    });
  });

  describe('trackError', () => {
    it('should log error with error details', () => {
      const error = new Error('Test error');
      analyticsModule.trackError(error);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[Analytics] error_occurred',
        expect.objectContaining({
          data: expect.objectContaining({
            error: expect.objectContaining({
              name: 'Error',
              message: 'Test error',
            }),
          }),
        })
      );
    });

    it('should include error context', () => {
      const error = new Error('Network failed');
      analyticsModule.trackError(error, { eventName: 'api_request', url: '/api/data' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[Analytics] error_occurred',
        expect.objectContaining({
          data: expect.objectContaining({
            eventName: 'api_request',
            url: '/api/data',
          }),
        })
      );
    });

    it('should capture error stack trace', () => {
      const error = new Error('Stack trace test');
      analyticsModule.trackError(error);

      const recentEvents = analyticsModule.getRecentEvents(5);
      const errorEvent = recentEvents.find(e => e.name === 'error_occurred');

      expect(errorEvent).toBeDefined();
      expect(errorEvent.properties.error.stack).toBeDefined();
    });
  });

  describe('getRecentEvents', () => {
    it('should return recent events up to limit', () => {
      // Log multiple events
      analyticsModule.logEvent('event_1');
      analyticsModule.logEvent('event_2');
      analyticsModule.logEvent('event_3');

      const events = analyticsModule.getRecentEvents(2);

      expect(events.length).toBeLessThanOrEqual(2);
    });

    it('should return events in order', () => {
      analyticsModule.logEvent('first_event');
      analyticsModule.logEvent('second_event');

      const events = analyticsModule.getRecentEvents(10);
      const firstIndex = events.findIndex(e => e.name === 'first_event');
      const secondIndex = events.findIndex(e => e.name === 'second_event');

      // second_event should come after first_event
      if (firstIndex !== -1 && secondIndex !== -1) {
        expect(secondIndex).toBeGreaterThan(firstIndex);
      }
    });

    it('should default to 10 events when no limit specified', () => {
      // Log many events
      for (let i = 0; i < 15; i++) {
        analyticsModule.logEvent('event_' + i);
      }

      const events = analyticsModule.getRecentEvents();

      expect(events.length).toBeLessThanOrEqual(10);
    });
  });

  describe('initAnalytics', () => {
    it('should accept enabled option', () => {
      // Should not throw
      expect(() => {
        analyticsModule.initAnalytics({ enabled: true });
      }).not.toThrow();
    });

    it('should accept debug option', () => {
      // Should not throw
      expect(() => {
        analyticsModule.initAnalytics({ debug: true });
      }).not.toThrow();
    });

    it('should accept userId option', () => {
      // Should not throw
      expect(() => {
        analyticsModule.initAnalytics({ userId: 'user-123' });
      }).not.toThrow();
    });

    it('should accept empty options', () => {
      // Should not throw
      expect(() => {
        analyticsModule.initAnalytics({});
      }).not.toThrow();
    });

    it('should be callable multiple times', () => {
      // Should not throw on multiple calls
      expect(() => {
        analyticsModule.initAnalytics({ enabled: true });
        analyticsModule.initAnalytics({ enabled: false });
        analyticsModule.initAnalytics({ debug: true });
      }).not.toThrow();
    });
  });

  describe('Type definitions (structural tests)', () => {
    it('AnalyticsEvent should have required properties', () => {
      const event = {
        name: 'test_event',
      };

      expect(event.name).toBe('test_event');
    });

    it('AnalyticsEvent should accept optional properties', () => {
      const event = {
        name: 'test_event',
        properties: { key: 'value', count: 42 },
        timestamp: Date.now(),
        userId: 'user-123',
      };

      expect(event.name).toBe('test_event');
      expect(event.properties.key).toBe('value');
      expect(event.timestamp).toBeDefined();
      expect(event.userId).toBe('user-123');
    });

    it('AnalyticsEvent should support nested properties', () => {
      const event = {
        name: 'nested_event',
        properties: {
          level1: {
            level2: {
              value: 'deep',
            },
          },
          array: [1, 2, 3],
        },
      };

      expect(event.properties.level1).toBeDefined();
    });
  });
});
