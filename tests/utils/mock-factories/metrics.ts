/**
 * Mock Metrics Factory
 *
 * Creates realistic mock metrics and monitoring data for testing observability features,
 * Datadog integration, and performance monitoring.
 *
 * @example
 * ```typescript
 * const metrics = createMockMetrics();
 * const healthCheck = createMockHealthCheck({ status: 'healthy' });
 * const datadogMetrics = createMockDatadogMetrics({ value: 42 });
 * ```
 */

export interface MockMetrics {
  timestamp: Date;
  metric: string;
  value: number;
  tags?: Record<string, string>;
  unit?: string;
}

export interface MockHealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  checks: Record<string, MockHealthCheckDetail>;
  uptime: number;
  version?: string;
}

export interface MockHealthCheckDetail {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  lastCheck?: Date;
  responseTime?: number;
}

export interface MockDatadogMetrics {
  metric: string;
  type: 'count' | 'gauge' | 'histogram' | 'rate';
  points: Array<[number, number]>;
  tags?: string[];
  host?: string;
  interval?: number;
}

/**
 * Creates a mock metrics object with sensible defaults
 *
 * @param overrides - Partial metrics object to override defaults
 * @returns Complete mock metrics object
 */
export const createMockMetrics = (overrides: Partial<MockMetrics> = {}): MockMetrics => {
  return {
    timestamp: new Date(),
    metric: 'test.metric',
    value: 100,
    tags: {
      env: 'test',
      service: 'vibecode',
    },
    unit: 'count',
    ...overrides,
  };
};

/**
 * Creates a mock health check response
 *
 * @param overrides - Partial health check object to override defaults
 * @returns Complete mock health check object
 */
export const createMockHealthCheck = (
  overrides: Partial<MockHealthCheck> = {}
): MockHealthCheck => {
  const timestamp = new Date();

  return {
    status: 'healthy',
    timestamp,
    uptime: 3600, // 1 hour
    version: '1.0.0',
    checks: {
      database: {
        status: 'healthy',
        message: 'Connected',
        lastCheck: timestamp,
        responseTime: 10,
      },
      redis: {
        status: 'healthy',
        message: 'Connected',
        lastCheck: timestamp,
        responseTime: 5,
      },
      vectorDb: {
        status: 'healthy',
        message: 'Connected',
        lastCheck: timestamp,
        responseTime: 15,
      },
    },
    ...overrides,
  };
};

/**
 * Creates a mock unhealthy health check response
 *
 * @param failedService - Service that failed the health check
 * @param overrides - Additional overrides
 * @returns Unhealthy mock health check
 */
export const createMockUnhealthyHealthCheck = (
  failedService: string = 'database',
  overrides: Partial<MockHealthCheck> = {}
): MockHealthCheck => {
  const healthCheck = createMockHealthCheck();

  return {
    ...healthCheck,
    status: 'unhealthy',
    checks: {
      ...healthCheck.checks,
      [failedService]: {
        status: 'unhealthy',
        message: 'Connection failed',
        lastCheck: new Date(),
        responseTime: 0,
      },
    },
    ...overrides,
  };
};

/**
 * Creates a mock Datadog metrics object
 *
 * @param overrides - Partial Datadog metrics object to override defaults
 * @returns Complete mock Datadog metrics object
 */
export const createMockDatadogMetrics = (
  overrides: Partial<MockDatadogMetrics> = {}
): MockDatadogMetrics => {
  const now = Math.floor(Date.now() / 1000);

  return {
    metric: 'vibecode.test.metric',
    type: 'gauge',
    points: [[now, 100]],
    tags: ['env:test', 'service:vibecode'],
    host: 'test-host',
    interval: 60,
    ...overrides,
  };
};

/**
 * Creates multiple mock metrics at once
 *
 * @param count - Number of metrics to create
 * @param baseOverrides - Base overrides to apply to all metrics
 * @returns Array of mock metrics
 */
export const createMockMetricsArray = (
  count: number,
  baseOverrides: Partial<MockMetrics> = {}
): MockMetrics[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockMetrics({
      metric: `test.metric.${index}`,
      value: Math.random() * 1000,
      timestamp: new Date(Date.now() - index * 60000), // 1 minute intervals
      ...baseOverrides,
    })
  );
};

/**
 * Creates a mock performance metrics object
 *
 * @param overrides - Performance metrics overrides
 * @returns Mock performance metrics
 */
export const createMockPerformanceMetrics = (
  overrides: Record<string, number> = {}
): Record<string, number> => {
  return {
    responseTime: 150,
    throughput: 1000,
    errorRate: 0.01,
    cpuUsage: 45.5,
    memoryUsage: 512,
    activeConnections: 25,
    ...overrides,
  };
};
