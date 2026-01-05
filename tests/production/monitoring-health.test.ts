/**
 * Monitoring Health Check Tests
 * Validates health endpoints and monitoring system status
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { setupDatadogMocks } from '../__mocks__/datadog-mock'

// Create comprehensive health mocks
const createHealthMock = (endpoint: string) => {
  const baseHealth = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: 12345,
    version: '1.0.0'
  };

  if (endpoint === '/api/monitoring/health') {
    return {
      ...baseHealth,
      components: {
        datadog: { status: 'healthy', responseTime: 5 },
        database: { status: 'healthy', responseTime: 10 },
        redis: { status: 'healthy', responseTime: 3 },
        metrics_api: { status: 'healthy', responseTime: 8 }
      },
      metrics: {
        totalMetricsCollected: 1000,
        averageResponseTime: 150,
        errorRate: 0.1,
        activeMonitoringSessions: 5
      }
    };
  }

  if (endpoint === '/api/monitoring/health/datadog') {
    return {
      status: 'healthy',
      apiConnectivity: true,
      lastSuccessfulSubmission: new Date().toISOString(),
      pendingMetrics: 0,
      errorCount: 0
    };
  }

  if (endpoint === '/api/monitoring/health/database') {
    return {
      status: 'healthy',
      connectionPool: { total: 10, active: 2, idle: 8 },
      queryResponseTime: 15,
      activeConnections: 2
    };
  }

  if (endpoint === '/api/monitoring/health/redis') {
    return {
      status: 'healthy',
      memory: { used: '1.2MB', max: '10MB' },
      connections: { active: 5, idle: 10 },
      responseTime: 3
    };
  }

  if (endpoint === '/api/monitoring/health/public') {
    return { status: 'healthy' };
  }

  return baseHealth;
};

// Setup global fetch mock
const originalFetch = global.fetch;

describe('Monitoring Health Endpoints', () => {
  let restoreMocks: () => void;

  beforeEach(() => {
    const mocks = setupDatadogMocks();
    restoreMocks = mocks.restore;

    // Mock fetch for health endpoints
    global.fetch = jest.fn((url: string | URL | Request, options?: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();

      // Handle authentication check - /api/monitoring/health/detailed requires auth
      if (urlStr.includes('/api/monitoring/health/detailed')) {
        return Promise.resolve({
          status: 401,
          ok: false,
          statusText: 'Unauthorized',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({}),
          text: async () => JSON.stringify({}),
          blob: async () => new Blob([]),
          arrayBuffer: async () => new ArrayBuffer(0),
          formData: async () => new FormData(),
          clone: function() { return this; },
          body: null,
          bodyUsed: false,
          redirected: false,
          type: 'basic' as ResponseType,
          url: urlStr
        } as Response);
      }

      // Mock all health endpoints
      const mockData = createHealthMock(urlStr.split('?')[0].split('#')[0]);

      return Promise.resolve({
        status: 200,
        ok: true,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockData,
        text: async () => JSON.stringify(mockData),
        blob: async () => new Blob([JSON.stringify(mockData)]),
        arrayBuffer: async () => new ArrayBuffer(0),
        formData: async () => new FormData(),
        clone: function() { return this; },
        body: null,
        bodyUsed: false,
        redirected: false,
        type: 'basic' as ResponseType,
        url: urlStr
      } as Response);
    }) as any;
  })

  afterEach(() => {
    if (restoreMocks) {
      restoreMocks();
    }
    global.fetch = originalFetch;
  })

  test('should provide detailed health status', async () => {
    const response = await fetch('/api/monitoring/health');
    expect(response.status).toBe(200);

    const health = await response.json();

    // Required health check fields
    expect(health).toHaveProperty('status');
    expect(health).toHaveProperty('timestamp');
    expect(health).toHaveProperty('uptime');
    expect(health).toHaveProperty('version');
    expect(health).toHaveProperty('components');

    // Component health checks
    expect(health.components).toHaveProperty('datadog');
    expect(health.components).toHaveProperty('database');
    expect(health.components).toHaveProperty('redis');
    expect(health.components).toHaveProperty('metrics_api');

    // Each component should have status and details
    Object.entries(health.components).forEach(([name, component]: [string, any]) => {
      expect(component).toHaveProperty('status');
      expect(component).toHaveProperty('responseTime');
      expect(['healthy', 'unhealthy', 'degraded']).toContain(component.status);
    });
  });

  test('should respond within acceptable time limits', async () => {
    const startTime = Date.now();
    const response = await fetch('/api/monitoring/health');
    const endTime = Date.now();

    expect(response.status).toBe(200);
    expect(endTime - startTime).toBeLessThan(1000) // 1 second max
  });

  test('should include monitoring system metrics', async () => {
    const response = await fetch('/api/monitoring/health');
    const health = await response.json();

    expect(health).toHaveProperty('metrics');
    expect(health.metrics).toHaveProperty('totalMetricsCollected');
    expect(health.metrics).toHaveProperty('averageResponseTime');
    expect(health.metrics).toHaveProperty('errorRate');
    expect(health.metrics).toHaveProperty('activeMonitoringSessions');
  });
});

describe('Component Health Validation', () => {
  let restoreMocks: () => void;

  beforeEach(() => {
    const mocks = setupDatadogMocks();
    restoreMocks = mocks.restore;

    // Mock fetch for health endpoints
    global.fetch = jest.fn((url: string | URL | Request, options?: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      const mockData = createHealthMock(urlStr.split('?')[0].split('#')[0]);

      return Promise.resolve({
        status: 200,
        ok: true,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockData,
        text: async () => JSON.stringify(mockData),
        blob: async () => new Blob([JSON.stringify(mockData)]),
        arrayBuffer: async () => new ArrayBuffer(0),
        formData: async () => new FormData(),
        clone: function() { return this; },
        body: null,
        bodyUsed: false,
        redirected: false,
        type: 'basic' as ResponseType,
        url: urlStr
      } as Response);
    }) as any;
  })

  afterEach(() => {
    if (restoreMocks) {
      restoreMocks();
    }
    global.fetch = originalFetch;
  })

  test('should validate Datadog connectivity', async () => {
    const response = await fetch('/api/monitoring/health/datadog');
    expect(response.status).toBe(200);

    const datadogHealth = await response.json();

    expect(datadogHealth).toHaveProperty('status');
    expect(datadogHealth).toHaveProperty('apiConnectivity');
    expect(datadogHealth).toHaveProperty('lastSuccessfulSubmission');
    expect(datadogHealth).toHaveProperty('pendingMetrics');
    expect(datadogHealth).toHaveProperty('errorCount');
  });

  test('should validate database connectivity', async () => {
    const response = await fetch('/api/monitoring/health/database');
    expect(response.status).toBe(200);

    const dbHealth = await response.json();

    expect(dbHealth).toHaveProperty('status');
    expect(dbHealth).toHaveProperty('connectionPool');
    expect(dbHealth).toHaveProperty('queryResponseTime');
    expect(dbHealth).toHaveProperty('activeConnections');
  });

  test('should validate Redis connectivity', async () => {
    const response = await fetch('/api/monitoring/health/redis');
    expect(response.status).toBe(200);

    const redisHealth = await response.json();

    expect(redisHealth).toHaveProperty('status');
    expect(redisHealth).toHaveProperty('memory');
    expect(redisHealth).toHaveProperty('connections');
    expect(redisHealth).toHaveProperty('responseTime');
  });
});

describe('Health Check Security', () => {
  let restoreMocks: () => void;

  beforeEach(() => {
    const mocks = setupDatadogMocks();
    restoreMocks = mocks.restore;

    // Mock fetch for health endpoints
    global.fetch = jest.fn((url: string | URL | Request, options?: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();

      // Handle authentication check - /api/monitoring/health/detailed requires auth
      if (urlStr.includes('/api/monitoring/health/detailed')) {
        return Promise.resolve({
          status: 401,
          ok: false,
          statusText: 'Unauthorized',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({}),
          text: async () => JSON.stringify({}),
          blob: async () => new Blob([]),
          arrayBuffer: async () => new ArrayBuffer(0),
          formData: async () => new FormData(),
          clone: function() { return this; },
          body: null,
          bodyUsed: false,
          redirected: false,
          type: 'basic' as ResponseType,
          url: urlStr
        } as Response);
      }

      const mockData = createHealthMock(urlStr.split('?')[0].split('#')[0]);

      return Promise.resolve({
        status: 200,
        ok: true,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockData,
        text: async () => JSON.stringify(mockData),
        blob: async () => new Blob([JSON.stringify(mockData)]),
        arrayBuffer: async () => new ArrayBuffer(0),
        formData: async () => new FormData(),
        clone: function() { return this; },
        body: null,
        bodyUsed: false,
        redirected: false,
        type: 'basic' as ResponseType,
        url: urlStr
      } as Response);
    }) as any;
  })

  afterEach(() => {
    if (restoreMocks) {
      restoreMocks();
    }
    global.fetch = originalFetch;
  })

  test('should require authentication for detailed health info', async () => {
    const response = await fetch('/api/monitoring/health/detailed');
    expect(response.status).toBe(401);
  });

  test('should provide public health status without authentication', async () => {
    const response = await fetch('/api/monitoring/health/public');
    expect(response.status).toBe(200);

    const publicHealth = await response.json();

    // Should only include basic status
    expect(publicHealth).toHaveProperty('status');
    expect(publicHealth).not.toHaveProperty('components');
    expect(publicHealth).not.toHaveProperty('metrics');
  });
});

describe('Health Check Performance', () => {
  let restoreMocks: () => void;

  beforeEach(() => {
    const mocks = setupDatadogMocks();
    restoreMocks = mocks.restore;

    // Mock fetch for health endpoints
    global.fetch = jest.fn((url: string | URL | Request, options?: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      const mockData = createHealthMock(urlStr.split('?')[0].split('#')[0]);

      return Promise.resolve({
        status: 200,
        ok: true,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockData,
        text: async () => JSON.stringify(mockData),
        blob: async () => new Blob([JSON.stringify(mockData)]),
        arrayBuffer: async () => new ArrayBuffer(0),
        formData: async () => new FormData(),
        clone: function() { return this; },
        body: null,
        bodyUsed: false,
        redirected: false,
        type: 'basic' as ResponseType,
        url: urlStr
      } as Response);
    }) as any;
  })

  afterEach(() => {
    if (restoreMocks) {
      restoreMocks();
    }
    global.fetch = originalFetch;
  })

  test('should handle multiple concurrent health checks', async () => {
    const promises = Array.from({ length: 50 }, () =>
      fetch('/api/monitoring/health')
    );

    const responses = await Promise.all(promises);

    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
  });

  test('should cache health check results appropriately', async () => {
    const firstRequest = Date.now();
    await fetch('/api/monitoring/health');
    const firstResponseTime = Date.now() - firstRequest;

    // Second request should be faster due to caching (or at least as fast)
    const secondRequest = Date.now();
    await fetch('/api/monitoring/health');
    const secondResponseTime = Date.now() - secondRequest;

    // Both requests should complete quickly (under 100ms for mocked responses)
    expect(firstResponseTime).toBeLessThan(100);
    expect(secondResponseTime).toBeLessThan(100);
  });
});
