/**
 * Datadog Mock for Production/Integration Tests
 * Provides fetch mocking for Datadog API endpoints
 * Used by tests to avoid actual Datadog API calls
 */

// Store submitted metrics for inspection in tests
let submittedMetrics: Array<{
  endpoint: string;
  data: unknown;
  timestamp: number;
}> = [];

// Store metrics by name for query responses
let metricsByName: Map<string, Array<{
  metric: string;
  points: Array<[number, number]>;
  tags: string[];
  type?: string;
}>> = new Map();

// Store original fetch
let originalFetch: typeof globalThis.fetch | null = null;

/**
 * Creates a mock Response object
 */
function createMockResponse(status: number, data: unknown, url: string): Response {
  const body = JSON.stringify(data);
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: status === 200 ? 'OK' : status === 202 ? 'Accepted' : 'Error',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => data,
    text: async () => body,
    blob: async () => new Blob([body]),
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
    formData: async () => new FormData(),
    clone: function() { return this; },
    body: null,
    bodyUsed: false,
    redirected: false,
    type: 'basic' as ResponseType,
    url
  } as Response;
}

/**
 * Mock fetch handler for Datadog API endpoints
 */
function mockFetch(url: string | URL | Request, options?: RequestInit): Promise<Response> {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;

  // Handle Datadog API endpoints
  if (urlStr.includes('datadoghq.com') || urlStr.includes('datadog')) {
    // Handle invalid API key
    const apiKey = options?.headers && typeof options.headers === 'object' && 'DD-API-KEY' in options.headers
      ? (options.headers as Record<string, string>)['DD-API-KEY']
      : undefined;

    // API key validation endpoint
    if (urlStr.includes('/api/v1/validate')) {
      if (apiKey === 'invalid-key-12345') {
        return Promise.resolve(createMockResponse(403, { errors: ['Forbidden'] }, urlStr));
      }
      return Promise.resolve(createMockResponse(200, { valid: true }, urlStr));
    }

    // Store the metric submission for inspection and query responses
    if (options?.body && urlStr.includes('/api/v1/series')) {
      try {
        const bodyData = typeof options.body === 'string'
          ? JSON.parse(options.body)
          : options.body;
        submittedMetrics.push({
          endpoint: urlStr,
          data: bodyData,
          timestamp: Date.now()
        });

        // Store metrics by name for query responses
        if (bodyData.series && Array.isArray(bodyData.series)) {
          for (const metric of bodyData.series) {
            const existing = metricsByName.get(metric.metric) || [];
            existing.push({
              metric: metric.metric,
              points: metric.points || [],
              tags: metric.tags || [],
              type: metric.type
            });
            metricsByName.set(metric.metric, existing);
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Metrics query endpoint
    if (urlStr.includes('/api/v1/query')) {
      const urlObj = new URL(urlStr);
      const query = urlObj.searchParams.get('query') || '';

      // Find matching metrics
      const matchingSeries: Array<{
        metric: string;
        points: Array<[number, number]>;
        tags: string[];
        scope: string;
        expression: string;
      }> = [];

      for (const [name, metrics] of metricsByName.entries()) {
        if (query.includes(name) || name.includes(query)) {
          for (const m of metrics) {
            matchingSeries.push({
              metric: m.metric,
              points: m.points,
              tags: m.tags,
              scope: m.tags.join(','),
              expression: query
            });
          }
        }
      }

      return Promise.resolve(createMockResponse(200, {
        status: 'ok',
        series: matchingSeries
      }, urlStr));
    }

    // Metrics submission endpoint
    if (urlStr.includes('/api/v1/series')) {
      return Promise.resolve(createMockResponse(202, { status: 'ok' }, urlStr));
    }

    // Events submission endpoint
    if (urlStr.includes('/api/v1/events')) {
      return Promise.resolve(createMockResponse(202, { status: 'ok' }, urlStr));
    }

    // Service check endpoint
    if (urlStr.includes('/api/v1/check_run')) {
      return Promise.resolve(createMockResponse(202, { status: 'ok' }, urlStr));
    }

    // Logs endpoint
    if (urlStr.includes('/api/v2/logs')) {
      return Promise.resolve(createMockResponse(202, { status: 'ok' }, urlStr));
    }

    // Default Datadog API response
    return Promise.resolve(createMockResponse(200, { status: 'ok' }, urlStr));
  }

  // For non-Datadog URLs, use original fetch if available, otherwise mock success
  if (originalFetch) {
    return originalFetch(url, options);
  }

  // Default mock response for non-Datadog endpoints
  return Promise.resolve(createMockResponse(200, {}, urlStr));
}

/**
 * Set up Datadog API mocks
 * Replaces global fetch with mocked version for Datadog endpoints
 */
export function setupDatadogMocks(): { restore: () => void } {
  // Clear previously submitted metrics
  submittedMetrics = [];

  // Store original fetch
  originalFetch = globalThis.fetch;

  // Replace global fetch with mock
  globalThis.fetch = mockFetch as typeof globalThis.fetch;

  // Set up mock API key if not set
  if (!process.env.DD_API_KEY) {
    process.env.DD_API_KEY = 'mock-datadog-api-key-32-characters';
  }

  return {
    restore: () => {
      if (originalFetch) {
        globalThis.fetch = originalFetch;
        originalFetch = null;
      }
    }
  };
}

/**
 * Get all metrics that have been submitted during the test
 */
export function getSubmittedMetrics(): Array<{
  endpoint: string;
  data: unknown;
  timestamp: number;
}> {
  return [...submittedMetrics];
}

/**
 * Clear submitted metrics
 */
export function clearSubmittedMetrics(): void {
  submittedMetrics = [];
  metricsByName.clear();
}

/**
 * Mock Datadog API object for test control
 */
export const mockDatadogAPI = {
  /**
   * Reset mock state
   */
  reset(): void {
    clearSubmittedMetrics();
  },

  /**
   * Get submitted metrics
   */
  getMetrics(): typeof submittedMetrics {
    return [...submittedMetrics];
  },

  /**
   * Get metrics by name
   */
  getMetricsByName(): Map<string, Array<{
    metric: string;
    points: Array<[number, number]>;
    tags: string[];
    type?: string;
  }>> {
    return new Map(metricsByName);
  }
};

// Default export for compatibility
export default {
  setupDatadogMocks,
  getSubmittedMetrics,
  clearSubmittedMetrics,
  mockDatadogAPI
};
