/**
 * Server-side monitoring and logging for VibeCode WebGUI
 * Integrates Datadog APM tracing, Winston logging, and custom metrics
 *
 * This module now supports dependency injection for better testability:
 * - Use `setMetricsProvider()` to inject a custom metrics provider
 * - Use `createMockProvider()` from metrics-provider.ts for testing
 * - Default behavior remains unchanged for backward compatibility
 */

import { createLogger, format, transports } from 'winston';
import {
  IMetricsProvider,
  MetricTags,
  metricsRegistry,
  MockMetricsProvider,
  createMockProvider
} from './monitoring/metrics-provider';

// Safe import and initialization of dd-trace
let tracer: any = { init: () => {}, scope: () => ({ active: () => null }), use: () => {} };
const isTracingDisabled = process.env.DD_ENABLED === 'false' || process.env.SKIP_MONITORING === 'true';

// Skip tracer initialization completely if disabled
if (!isTracingDisabled) {
  try {
    if (process.env.DD_API_KEY && typeof window === 'undefined') {
      const ddTrace = require('dd-trace');
      ddTrace.init({
        service: 'vibecode-webgui',
        env: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || '1.0.0',
        logInjection: true,
        runtimeMetrics: true,
        profiling: false, // Disable profiling to reduce conflicts
        appsec: false, // Disable ASM to reduce conflicts
      });
      tracer = ddTrace;
      console.info('Datadog APM tracer initialized');
    } else if (!process.env.DD_API_KEY) {
      console.warn('Datadog APM not configured (DD_API_KEY missing)');
    }
  } catch (error) {
    console.warn('Failed to initialize Datadog tracer:', error instanceof Error ? error.message : String(error));
  }
} else {
  console.info('Datadog APM tracing disabled via DD_ENABLED=false');
}

// Custom Winston formatter for structured logging
// Define different formats for production and development
const developmentFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    const stackStr = stack ? `\n${stack}` : '';
    return `${timestamp} ${level}: ${message}${stackStr}${metaStr}`;
  })
);

const productionFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json()
);

// Create logger instance
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  // Use JSON format in production, and human-readable in development
  format: process.env.NODE_ENV === 'production' ? productionFormat : developmentFormat,
  defaultMeta: {
    service: 'vibecode-webgui',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0'
  },
  transports: [
    // Console transport is the primary target for containerized environments
    new transports.Console(),

    // File transports for persistent logging, always in JSON format
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: productionFormat,
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 5,
      tailable: true
    }),

    new transports.File({
      filename: 'logs/combined.log',
      maxsize: 100 * 1024 * 1024, // 100MB
      maxFiles: 10,
      tailable: true
    })
  ],
  exceptionHandlers: [
    new transports.File({ filename: 'logs/exceptions.log' })
  ],
  rejectionHandlers: [
    new transports.File({ filename: 'logs/rejections.log' })
  ],
  exitOnError: false
})

// =============================================================================
// MetricsCollector with Dependency Injection Support
// =============================================================================

/**
 * Custom metrics tracking with pluggable backend support
 *
 * This class maintains backward compatibility with the original API while
 * supporting dependency injection for different metrics providers.
 *
 * Usage:
 *   // Default usage (unchanged from before)
 *   metrics.increment('api.requests');
 *
 *   // For testing, inject a mock provider
 *   const mockProvider = createMockProvider();
 *   metrics.setProvider(mockProvider);
 *   // ... run tests ...
 *   mockProvider.getCalls(); // Inspect recorded metrics
 */
class MetricsCollector {
  private metricsData: Map<string, { count: number; lastValue?: number; sum?: number }> = new Map()
  private responseTimes: Record<string, number[]> = {}
  private errors: Record<string, string[]> = {}
  private requestCounts: Record<string, number> = {}

  // Injected metrics provider for external backends (DataDog, StatsD, etc.)
  private _provider: IMetricsProvider | null = null;

  /**
   * Set the metrics provider for external metric submission
   *
   * @param provider - The metrics provider to use (DataDog, StatsD, Mock, etc.)
   *
   * Example:
   *   // In production
   *   metrics.setProvider(createDataDogProvider({ apiKey: '...' }));
   *
   *   // In tests
   *   const mockProvider = createMockProvider();
   *   metrics.setProvider(mockProvider);
   */
  setProvider(provider: IMetricsProvider): void {
    this._provider = provider;
  }

  /**
   * Get the current metrics provider
   *
   * Returns the injected provider, or falls back to the global registry provider
   */
  getProvider(): IMetricsProvider {
    return this._provider || metricsRegistry.getProvider();
  }

  /**
   * Reset the provider to default (useful for test cleanup)
   */
  resetProvider(): void {
    this._provider = null;
  }

  /**
   * Create a mock provider and inject it (convenience method for testing)
   *
   * @returns The created mock provider for assertions
   */
  injectMockProvider(): MockMetricsProvider {
    const mockProvider = createMockProvider();
    this.setProvider(mockProvider);
    return mockProvider;
  }

  /**
   * Increment a counter metric
   */
  increment(metricName: string, tags?: Record<string, string>): void {
    const key = this.getMetricKey(metricName, tags)
    const current = this.metricsData.get(key) || { count: 0 }
    current.count += 1
    this.metricsData.set(key, current)

    // Send to external provider
    this.getProvider().increment(metricName, 1, { tags: tags as MetricTags });

    logger.info('Metric incremented', {
      metric: metricName,
      count: current.count,
      tags
    })
  }

  /**
   * Set a gauge metric value
   */
  gauge(metricName: string, value: number, tags?: Record<string, string>): void {
    const key = this.getMetricKey(metricName, tags)
    const current = this.metricsData.get(key) || { count: 0 }
    current.lastValue = value
    this.metricsData.set(key, current)

    // Send to external provider
    this.getProvider().gauge(metricName, value, { tags: tags as MetricTags });

    logger.info('Gauge metric set', {
      metric: metricName,
      value,
      tags
    })
  }

  /**
   * Record a histogram/timing metric
   */
  histogram(metricName: string, value: number, tags?: Record<string, string>): void {
    const key = this.getMetricKey(metricName, tags)
    const current = this.metricsData.get(key) || { count: 0, sum: 0 }
    current.count += 1
    current.sum = (current.sum || 0) + value
    current.lastValue = value
    this.metricsData.set(key, current)

    // Send to external provider
    this.getProvider().histogram(metricName, value, { tags: tags as MetricTags });

    logger.info('Histogram metric recorded', {
      metric: metricName,
      value,
      average: current.sum / current.count,
      count: current.count,
      tags
    })
  }

  /**
   * Record a timing metric (alias for histogram with timing semantics)
   */
  timing(metricName: string, duration: number, tags?: Record<string, string>): void {
    this.histogram(metricName, duration, tags);
    // Also send specifically as timing to provider
    this.getProvider().timing(metricName, duration, { tags: tags as MetricTags });
  }

  /**
   * Record response time for an endpoint
   */
  recordResponseTime(endpoint: string, responseTime: number): void {
    if (!this.responseTimes) {
      this.responseTimes = {}
    }
    if (!this.responseTimes[endpoint]) {
      this.responseTimes[endpoint] = []
    }
    this.responseTimes[endpoint].push(responseTime)

    // Limit to 1000 entries to prevent memory leaks
    if (this.responseTimes[endpoint].length > 1000) {
      this.responseTimes[endpoint] = this.responseTimes[endpoint].slice(-1000)
    }

    // Send to provider
    this.getProvider().timing('endpoint.response_time', responseTime, {
      tags: { endpoint }
    });
  }

  /**
   * Record error for an endpoint
   */
  recordError(endpoint: string, error: string): void {
    if (!this.errors[endpoint]) {
      this.errors[endpoint] = []
    }
    this.errors[endpoint].push(error)

    // Send to provider
    this.getProvider().increment('endpoint.errors', 1, {
      tags: { endpoint, error_type: error }
    });
  }

  /**
   * Increment request count for an endpoint
   */
  incrementRequestCount(endpoint: string): void {
    if (!this.requestCounts[endpoint]) {
      this.requestCounts[endpoint] = 0
    }
    this.requestCounts[endpoint]++

    // Send to provider
    this.getProvider().increment('endpoint.requests', 1, {
      tags: { endpoint }
    });
  }

  /**
   * Record custom metric (gauge-like behavior)
   */
  recordCustomMetric(metricName: string, value: number): void {
    const existing = this.metricsData.get(metricName) || { count: 0 }
    existing.lastValue = value
    existing.count++
    this.metricsData.set(metricName, existing)

    // Send to provider
    this.getProvider().gauge(metricName, value);
  }

  /**
   * Calculate average response time for an endpoint
   */
  getAverageResponseTime(endpoint: string): number {
    if (!this.responseTimes[endpoint] || this.responseTimes[endpoint].length === 0) {
      return 0
    }
    const sum = this.responseTimes[endpoint].reduce((a, b) => a + b, 0)
    return sum / this.responseTimes[endpoint].length
  }

  /**
   * Calculate error rate for an endpoint
   */
  getErrorRate(endpoint: string): number {
    const requestCount = this.requestCounts[endpoint] || 0
    const errorCount = (this.errors[endpoint] || []).length

    if (requestCount === 0) return 0
    return (errorCount / requestCount) * 100
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.responseTimes = {}
    this.errors = {}
    this.requestCounts = {}
  }

  /**
   * Get all current metrics
   */
  getMetrics(): Record<string, any> {
    const result: Record<string, any> = {
      responseTimes: this.responseTimes,
      errors: this.errors,
      requestCounts: this.requestCounts
    }
    this.metricsData.forEach((value, key) => {
      result[key] = value
    })
    return result
  }

  /**
   * Flush any buffered metrics to the provider
   */
  async flush(): Promise<void> {
    await this.getProvider().flush();
  }

  /**
   * Shutdown the metrics collector and provider
   */
  async shutdown(): Promise<void> {
    await this.getProvider().shutdown();
  }

  private getMetricKey(metricName: string, tags?: Record<string, string>): string {
    if (!tags) return metricName
    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',')
    return `${metricName}|${tagString}`
  }
}

const metrics = new MetricsCollector()

// =============================================================================
// ApplicationLogger with Dependency Injection Support
// =============================================================================

/**
 * Application-specific logging helpers with metrics integration
 *
 * This class supports dependency injection through the metrics collector,
 * allowing for full testability of logging operations.
 */
class ApplicationLogger {
  // Allow injection of custom metrics collector for testing
  private _metrics: MetricsCollector;

  constructor(metricsCollector?: MetricsCollector) {
    this._metrics = metricsCollector || metrics;
  }

  /**
   * Get the metrics collector used by this logger
   */
  getMetrics(): MetricsCollector {
    return this._metrics;
  }

  /**
   * Log authentication events
   */
  logAuth(event: string, context: {
    userId?: string
    email?: string
    provider?: string
    success?: boolean
    error?: string
    ip?: string
    userAgent?: string
  }): void {
    const level = context.success === false ? 'warn' : 'info'
    logger[level](`Authentication: ${event}`, {
      category: 'auth',
      ...context
    })

    if (context.success === false) {
      this._metrics.increment('auth.failure', { event, provider: context.provider || 'unknown' })
    } else {
      this._metrics.increment('auth.success', { event, provider: context.provider || 'unknown' })
    }
  }

  /**
   * Log workspace operations
   */
  logWorkspace(event: string, context: {
    workspaceId: string
    userId?: string
    action?: string
    duration?: number
    error?: string
    codeServerStatus?: string
    terminalSessions?: number
  }): void {
    const level = context.error ? 'error' : 'info'
    logger[level](`Workspace: ${event}`, {
      category: 'workspace',
      ...context
    })

    if (context.duration) {
      this._metrics.histogram('workspace.operation.duration', context.duration, {
        event,
        action: context.action || 'unknown'
      })
    }

    this._metrics.increment('workspace.events', { event, action: context.action || 'unknown' })
  }

  /**
   * Log AI interactions
   */
  logAI(event: string, context: {
    userId?: string
    workspaceId?: string
    model?: string
    tokensUsed?: number
    responseTime?: number
    error?: string
    codeContext?: boolean
  }): void {
    const level = context.error ? 'error' : 'info'
    logger[level](`AI: ${event}`, {
      category: 'ai',
      ...context
    })

    if (context.responseTime) {
      this._metrics.histogram('ai.response_time', context.responseTime, {
        model: context.model || 'unknown'
      })
    }

    if (context.tokensUsed) {
      this._metrics.histogram('ai.tokens_used', context.tokensUsed, {
        model: context.model || 'unknown'
      })
    }

    this._metrics.increment('ai.interactions', {
      event,
      model: context.model || 'unknown',
      hasContext: context.codeContext ? 'true' : 'false'
    })
  }

  /**
   * Log system performance metrics
   */
  logPerformance(context: {
    endpoint?: string
    method?: string
    statusCode?: number
    responseTime?: number
    memoryUsage?: number
    cpuUsage?: number
    activeConnections?: number
    error?: string
  }): void {
    logger.info('Performance metrics', {
      category: 'performance',
      ...context
    })

    if (context.responseTime) {
      this._metrics.histogram('http.response_time', context.responseTime, {
        endpoint: context.endpoint || 'unknown',
        method: context.method || 'unknown',
        status: context.statusCode?.toString() || 'unknown'
      })
    }

    if (context.memoryUsage) {
      this._metrics.gauge('system.memory_usage', context.memoryUsage)
    }

    if (context.cpuUsage) {
      this._metrics.gauge('system.cpu_usage', context.cpuUsage)
    }

    if (context.activeConnections) {
      this._metrics.gauge('system.active_connections', context.activeConnections)
    }
  }

  /**
   * Log security events
   */
  logSecurity(event: string, context: {
    userId?: string
    ip?: string
    userAgent?: string
    resource?: string
    action?: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    details?: Record<string, any>
    blocked?: boolean
  }): void {
    const level = context.severity === 'critical' ? 'error' :
                  context.severity === 'high' ? 'warn' : 'info'

    logger[level](`Security: ${event}`, {
      category: 'security',
      ...context
    })

    this._metrics.increment('security.events', {
      event,
      severity: context.severity,
      blocked: context.blocked ? 'true' : 'false'
    })
  }

  /**
   * Log API request
   */
  logAPIRequest(method: string, endpoint: string, statusCode: number, responseTime: number, userId?: string): void {
    logger.info('API Request', {
      category: 'api',
      method,
      endpoint,
      statusCode,
      responseTime,
      userId
    })

    this._metrics.histogram('api.response_time', responseTime, {
      method,
      endpoint,
      status: statusCode.toString()
    })
  }

  /**
   * Log error
   */
  logError(message: string, error: Error, context?: Record<string, any>): void {
    logger.error(message, {
      category: 'error',
      error: error.message,
      stack: error.stack,
      ...context
    })

    this._metrics.increment('errors', {
      message,
      ...(context || {})
    })
  }

  /**
   * Log business metrics
   */
  logBusiness(event: string, context: {
    userId?: string
    workspaceId?: string
    feature?: string
    value?: number
    metadata?: Record<string, any>
  }): void {
    logger.info(`Business: ${event}`, {
      category: 'business',
      ...context
    })

    this._metrics.increment('business.events', {
      event,
      feature: context.feature || 'unknown'
    })

    if (context.value) {
      this._metrics.histogram('business.value', context.value, {
        event,
        feature: context.feature || 'unknown'
      })
    }
  }
}

const appLogger = new ApplicationLogger()

// Performance monitoring middleware for Express
function performanceMiddleware() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now()

    res.on('finish', () => {
      const responseTime = Date.now() - startTime
      const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024 // MB

      appLogger.logPerformance({
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
        responseTime,
        memoryUsage
      })

      // Log slow requests
      if (responseTime > 1000) {
        logger.warn('Slow request detected', {
          endpoint: req.path,
          method: req.method,
          responseTime,
          query: req.query,
          params: req.params
        })
      }
    })

    next()
  }
}

// Health check endpoint data
async function getHealthCheck(): Promise<{
  status: 'healthy' | 'unhealthy'
  timestamp: string
  uptime: number
  memory: {
    used: number
    total: number
    percentage: number
  }
  cpu: {
    usage: number
  }
  metrics: Record<string, any>
}> {
  const memUsage = process.memoryUsage()
  const totalMem = memUsage.heapTotal
  const usedMem = memUsage.heapUsed

  // Get CPU usage (simple calculation based on process.cpuUsage())
  const cpuUsageData = process.cpuUsage()
  const cpuUsagePercent = ((cpuUsageData.user + cpuUsageData.system) / 1000000) / process.uptime() * 100

  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: usedMem,
      total: totalMem,
      percentage: (usedMem / totalMem) * 100
    },
    cpu: {
      usage: Math.min(100, cpuUsagePercent) // Cap at 100%
    },
    metrics: metrics.getMetrics()
  }
}

// =============================================================================
// Helper Functions for Dependency Injection
// =============================================================================

/**
 * Set the global metrics provider
 *
 * @param provider - The metrics provider to use globally
 */
function setMetricsProvider(provider: IMetricsProvider): void {
  metrics.setProvider(provider);
}

/**
 * Reset the global metrics provider to default
 */
function resetMetricsProvider(): void {
  metrics.resetProvider();
}

/**
 * Create a new metrics collector with optional custom provider
 *
 * @param provider - Optional custom metrics provider
 * @returns A new MetricsCollector instance
 */
function createMetricsCollector(provider?: IMetricsProvider): MetricsCollector {
  const collector = new MetricsCollector();
  if (provider) {
    collector.setProvider(provider);
  }
  return collector;
}

/**
 * Create a new ApplicationLogger with optional custom metrics
 *
 * @param metricsCollector - Optional custom metrics collector
 * @returns A new ApplicationLogger instance
 */
function createApplicationLogger(metricsCollector?: MetricsCollector): ApplicationLogger {
  return new ApplicationLogger(metricsCollector);
}

// =============================================================================
// Exports
// =============================================================================

export {
  // Core instances (backward compatible)
  logger,
  tracer,
  metrics,
  appLogger,
  performanceMiddleware,
  getHealthCheck,

  // Classes for custom instantiation
  MetricsCollector,
  ApplicationLogger,

  // Dependency injection helpers
  setMetricsProvider,
  resetMetricsProvider,
  createMetricsCollector,
  createApplicationLogger,
}

// Re-export types and utilities from metrics-provider for convenience
export type { IMetricsProvider, MetricTags, MetricOptions } from './monitoring/metrics-provider';
export {
  createMockProvider,
  createNoOpProvider,
  createConsoleProvider,
  createDataDogProvider,
  createStatsDProvider,
  createCompositeProvider,
  MockMetricsProvider,
  NoOpMetricsProvider,
  ConsoleMetricsProvider,
  DataDogMetricsProvider,
  StatsDMetricsProvider,
  CompositeMetricsProvider,
  metricsRegistry
} from './monitoring/metrics-provider';
