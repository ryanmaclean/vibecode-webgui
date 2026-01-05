/**
 * Comprehensive Datadog API Mock for Testing
 *
 * Mocks all Datadog API endpoints to allow testing without real API keys:
 * - Metrics API (gauge, counter, histogram)
 * - Events API
 * - Service Checks API
 * - Logs API
 * - APM/Tracing
 * - RUM (Real User Monitoring)
 *
 * Usage:
 *   import { mockDatadogAPI, mockDatadogRUM, mockDatadogLogs } from '../__mocks__/datadog-mock'
 */

// ================================
// DATADOG METRICS API MOCK
// ================================

export interface DatadogMetricPoint {
  metric: string;
  points: [number, number][];
  type?: 'gauge' | 'count' | 'histogram' | 'rate';
  host?: string;
  tags?: string[];
}

export interface DatadogEvent {
  title: string;
  text: string;
  date_happened?: number;
  priority?: 'normal' | 'low';
  tags?: string[];
  alert_type?: 'error' | 'warning' | 'info' | 'success';
}

export interface DatadogServiceCheck {
  check: string;
  host_name: string;
  status: 0 | 1 | 2 | 3; // OK, WARNING, CRITICAL, UNKNOWN
  timestamp?: number;
  message?: string;
  tags?: string[];
}

// Track submitted metrics for assertions
export const submittedMetrics: DatadogMetricPoint[] = [];
export const submittedEvents: DatadogEvent[] = [];
export const submittedServiceChecks: DatadogServiceCheck[] = [];
export const submittedLogs: any[] = [];

/**
 * Mock Datadog Metrics API
 */
export const mockDatadogAPI = {
  /**
   * Mock /api/v1/validate endpoint
   */
  validate: jest.fn().mockImplementation(async (apiKey: string) => {
    if (!apiKey || apiKey.includes('invalid')) {
      return {
        ok: false,
        status: 403,
        json: async () => ({ valid: false, errors: ['Invalid API key'] })
      };
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({ valid: true })
    };
  }),

  /**
   * Mock /api/v1/series endpoint (metrics submission)
   */
  submitMetrics: jest.fn().mockImplementation(async (metrics: { series: DatadogMetricPoint[] }) => {
    submittedMetrics.push(...metrics.series);

    return {
      ok: true,
      status: 202,
      json: async () => ({ status: 'ok' })
    };
  }),

  /**
   * Mock /api/v1/events endpoint
   */
  submitEvent: jest.fn().mockImplementation(async (event: DatadogEvent) => {
    submittedEvents.push(event);

    return {
      ok: true,
      status: 202,
      json: async () => ({
        status: 'ok',
        event: {
          ...event,
          id: Math.random().toString(36).substr(2, 9)
        }
      })
    };
  }),

  /**
   * Mock /api/v1/check_run endpoint (service checks)
   */
  submitServiceCheck: jest.fn().mockImplementation(async (check: DatadogServiceCheck) => {
    submittedServiceChecks.push(check);

    return {
      ok: true,
      status: 202,
      json: async () => ({ status: 'ok' })
    };
  }),

  /**
   * Reset all tracked submissions
   */
  reset: () => {
    submittedMetrics.length = 0;
    submittedEvents.length = 0;
    submittedServiceChecks.length = 0;
    submittedLogs.length = 0;

    jest.clearAllMocks();
  }
};

// ================================
// DATADOG RUM (Real User Monitoring) MOCK
// ================================

export const mockDatadogRUM = {
  init: jest.fn(),
  startSessionReplayRecording: jest.fn(),
  stopSessionReplayRecording: jest.fn(),
  addAction: jest.fn(),
  addError: jest.fn(),
  addTiming: jest.fn(),
  setUser: jest.fn(),
  removeUser: jest.fn(),
  setUserProperty: jest.fn(),
  startView: jest.fn(),
  setGlobalContext: jest.fn(),
  setGlobalContextProperty: jest.fn(),
  getInternalContext: jest.fn().mockReturnValue({}),

  // Track RUM actions for testing
  actions: [] as any[],
  errors: [] as any[],
  timings: [] as any[],

  reset: () => {
    mockDatadogRUM.actions.length = 0;
    mockDatadogRUM.errors.length = 0;
    mockDatadogRUM.timings.length = 0;
    jest.clearAllMocks();
  }
};

// Override addAction to track
mockDatadogRUM.addAction.mockImplementation((name: string, context?: any) => {
  mockDatadogRUM.actions.push({ name, context, timestamp: Date.now() });
});

mockDatadogRUM.addError.mockImplementation((error: Error, context?: any) => {
  mockDatadogRUM.errors.push({ error, context, timestamp: Date.now() });
});

mockDatadogRUM.addTiming.mockImplementation((name: string, time?: number) => {
  mockDatadogRUM.timings.push({ name, time: time || Date.now(), timestamp: Date.now() });
});

// ================================
// DATADOG LOGS MOCK
// ================================

export const mockDatadogLogs = {
  logger: {
    log: jest.fn().mockImplementation((message: string, context?: any, level = 'info') => {
      submittedLogs.push({ message, context, level, timestamp: Date.now() });
    }),
    debug: jest.fn().mockImplementation((message: string, context?: any) => {
      submittedLogs.push({ message, context, level: 'debug', timestamp: Date.now() });
    }),
    info: jest.fn().mockImplementation((message: string, context?: any) => {
      submittedLogs.push({ message, context, level: 'info', timestamp: Date.now() });
    }),
    warn: jest.fn().mockImplementation((message: string, context?: any) => {
      submittedLogs.push({ message, context, level: 'warn', timestamp: Date.now() });
    }),
    error: jest.fn().mockImplementation((message: string, context?: any) => {
      submittedLogs.push({ message, context, level: 'error', timestamp: Date.now() });
    }),
    setContext: jest.fn(),
    setLevel: jest.fn(),
    setHandler: jest.fn(),
  },

  reset: () => {
    submittedLogs.length = 0;
    jest.clearAllMocks();
  }
};

// ================================
// DATADOG APM/TRACING MOCK
// ================================

export const mockDatadogTracing = {
  tracer: {
    startSpan: jest.fn().mockReturnValue({
      finish: jest.fn(),
      setTag: jest.fn(),
      context: jest.fn().mockReturnValue({}),
    }),
    scope: jest.fn().mockReturnValue({
      active: jest.fn().mockReturnValue(null),
    }),
    trace: jest.fn().mockImplementation(async (name: string, fn: () => any) => {
      return await fn();
    }),
  },

  reset: () => {
    jest.clearAllMocks();
  }
};

// ================================
// GLOBAL FETCH MOCK FOR DATADOG API
// ================================

/**
 * Mock global fetch to intercept Datadog API calls
 */
export const mockDatadogFetch = () => {
  const originalFetch = global.fetch;

  global.fetch = jest.fn().mockImplementation(async (url: string, options?: any) => {
    const urlStr = typeof url === 'string' ? url : url.toString();

    // Mock Datadog API validation endpoint
    if (urlStr.includes('/api/v1/validate')) {
      const apiKey = options?.headers?.['DD-API-KEY'];
      return mockDatadogAPI.validate(apiKey);
    }

    // Mock Datadog metrics endpoint
    if (urlStr.includes('/api/v1/series')) {
      const body = JSON.parse(options?.body || '{}');
      return mockDatadogAPI.submitMetrics(body);
    }

    // Mock Datadog events endpoint
    if (urlStr.includes('/api/v1/events')) {
      const body = JSON.parse(options?.body || '{}');
      return mockDatadogAPI.submitEvent(body);
    }

    // Mock Datadog service checks endpoint
    if (urlStr.includes('/api/v1/check_run')) {
      const body = JSON.parse(options?.body || '{}');
      return mockDatadogAPI.submitServiceCheck(body);
    }

    // Fallback to original fetch for non-Datadog URLs
    return originalFetch(url, options);
  }) as any;

  return () => {
    global.fetch = originalFetch;
  };
};

// ================================
// COMPLETE DATADOG MOCK SETUP
// ================================

/**
 * Complete Datadog mock setup for tests
 * Call this in beforeEach() to set up all Datadog mocks
 */
export const setupDatadogMocks = () => {
  const restoreFetch = mockDatadogFetch();

  // Mock environment variable if not set
  if (!process.env.DD_API_KEY) {
    process.env.DD_API_KEY = 'mock-datadog-api-key-32-characters';
  }

  return {
    restore: () => {
      restoreFetch();
      mockDatadogAPI.reset();
      mockDatadogRUM.reset();
      mockDatadogLogs.reset();
      mockDatadogTracing.reset();
    }
  };
};

/**
 * Helper to get submitted metrics for assertions
 */
export const getSubmittedMetrics = (metricName?: string) => {
  if (metricName) {
    return submittedMetrics.filter(m => m.metric === metricName);
  }
  return submittedMetrics;
};

/**
 * Helper to get submitted events for assertions
 */
export const getSubmittedEvents = (eventTitle?: string) => {
  if (eventTitle) {
    return submittedEvents.filter(e => e.title === eventTitle);
  }
  return submittedEvents;
};

/**
 * Helper to get submitted logs for assertions
 */
export const getSubmittedLogs = (level?: string) => {
  if (level) {
    return submittedLogs.filter(l => l.level === level);
  }
  return submittedLogs;
};

// Export all mocks
export default {
  mockDatadogAPI,
  mockDatadogRUM,
  mockDatadogLogs,
  mockDatadogTracing,
  setupDatadogMocks,
  getSubmittedMetrics,
  getSubmittedEvents,
  getSubmittedLogs,
};
