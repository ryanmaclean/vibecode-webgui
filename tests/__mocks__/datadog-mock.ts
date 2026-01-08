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
  validate: async (apiKey: string) => {
    // In mock mode, accept any non-empty API key except explicitly invalid ones
    if (!apiKey) {
      return {
        ok: false,
        status: 401,
        json: async () => ({ valid: false, errors: ['Missing API key'] })
      };
    }

    if (apiKey.includes('invalid-key-12345')) {
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
  },

  /**
   * Mock /api/v1/series endpoint (metrics submission)
   */
  submitMetrics: async (metrics: { series: DatadogMetricPoint[] }) => {
    submittedMetrics.push(...metrics.series);

    return {
      ok: true,
      status: 202,
      json: async () => ({ status: 'ok' })
    };
  },

  /**
   * Mock /api/v1/query endpoint (metrics query)
   */
  queryMetrics: async (query: string, from: number, to: number) => {
    // Find matching metrics by name (extract metric name from query)
    const metricNameMatch = query.match(/^([^{]+)/);
    const metricName = metricNameMatch ? metricNameMatch[1].trim() : '';

    // Filter submitted metrics by name and time range
    const matchingMetrics = submittedMetrics.filter(m => {
      if (m.metric !== metricName) return false;

      // Check if any point falls within the time range
      return m.points.some(point => {
        const timestamp = point[0];
        return timestamp >= from && timestamp <= to;
      });
    });

    // If metrics found, return them in Datadog query response format
    if (matchingMetrics.length > 0) {
      const series = matchingMetrics.map(m => ({
        metric: m.metric,
        points: m.points,
        pointlist: m.points, // Datadog uses "pointlist" in query responses
        tags: m.tags || [],
        scope: m.tags ? m.tags.join(',') : '',
        expression: query
      }));

      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ok',
          series: series
        })
      };
    }

    // No metrics found - return empty result (not an error)
    return {
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ok',
        series: []
      })
    };
  },

  /**
   * Mock /api/v1/events endpoint
   */
  submitEvent: async (event: DatadogEvent) => {
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
  },

  /**
   * Mock /api/v1/check_run endpoint (service checks)
   */
  submitServiceCheck: async (check: DatadogServiceCheck) => {
    submittedServiceChecks.push(check);

    return {
      ok: true,
      status: 202,
      json: async () => ({ status: 'ok' })
    };
  },

  /**
   * Reset all tracked submissions
   */
  reset: () => {
    submittedMetrics.length = 0;
    submittedEvents.length = 0;
    submittedServiceChecks.length = 0;
    submittedLogs.length = 0;
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

  // Helper to extract headers from Headers object or plain object
  const getHeader = (headers: any, key: string): string | null => {
    if (!headers) return null;

    // If it's a Headers object (from fetch)
    if (headers instanceof Headers || (headers.get && typeof headers.get === 'function')) {
      return headers.get(key);
    }

    // If it's a plain object
    return headers[key] || headers[key.toLowerCase()] || null;
  };

  // Create a proper mock implementation (don't use jest.fn for better compatibility)
  const mockFetch = async (url: string | URL | Request, options?: RequestInit): Promise<Response> => {
    const urlStr = typeof url === 'string' ? url : url instanceof Request ? url.url : url.toString();
    const requestOptions = url instanceof Request ? { headers: url.headers, method: url.method, body: await url.text() } : options;

    // Debug logging
    console.log('[MOCK FETCH] URL:', urlStr);
    console.log('[MOCK FETCH] Matches validate:', urlStr.includes('/api/v1/validate'));

    // Mock Datadog API validation endpoint
    if (urlStr.includes('/api/v1/validate')) {
      const apiKey = getHeader(requestOptions?.headers, 'DD-API-KEY') || '';
      console.log('[MOCK FETCH] API Key:', apiKey?.substring(0, 10) + '...');
      const result = await mockDatadogAPI.validate(apiKey);
      console.log('[MOCK FETCH] Returning status:', result.status);
      return Promise.resolve(result as any);
    }

    // Mock Datadog metrics query endpoint
    if (urlStr.includes('/api/v1/query')) {
      const url = new URL(urlStr);
      const query = url.searchParams.get('query') || '';
      const from = parseInt(url.searchParams.get('from') || '0', 10);
      const to = parseInt(url.searchParams.get('to') || '0', 10);
      const result = await mockDatadogAPI.queryMetrics(query, from, to);
      return Promise.resolve(result as any);
    }

    // Mock Datadog metrics endpoint
    if (urlStr.includes('/api/v1/series')) {
      const body = JSON.parse((requestOptions?.body as string) || '{}');
      const result = await mockDatadogAPI.submitMetrics(body);
      return Promise.resolve(result as any);
    }

    // Mock Datadog events endpoint
    if (urlStr.includes('/api/v1/events')) {
      const body = JSON.parse((requestOptions?.body as string) || '{}');
      const result = await mockDatadogAPI.submitEvent(body);
      return Promise.resolve(result as any);
    }

    // Mock Datadog service checks endpoint
    if (urlStr.includes('/api/v1/check_run')) {
      const body = JSON.parse((requestOptions?.body as string) || '{}');
      const result = await mockDatadogAPI.submitServiceCheck(body);
      return Promise.resolve(result as any);
    }

    // Fallback to original fetch for non-Datadog URLs
    if (originalFetch) {
      return originalFetch(url as any, options as any);
    }

    // If no original fetch and no match, return a basic error response
    return Promise.resolve({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
      text: async () => 'Not found'
    } as any);
  };

  global.fetch = mockFetch as any;

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
