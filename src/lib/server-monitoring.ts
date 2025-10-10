/**
 * Server-side monitoring and logging for VibeCode WebGUI
 * Integrates Datadog APM tracing, Winston logging, and custom metrics
 */
import { createLogger, format, transports } from 'winston';
import tracer from '../instrument';

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
    // Only enable in production or when explicitly requested
    ...(process.env.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGGING === 'true' ? [
      new transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: productionFormat,
        maxsize: 50 * 1024 * 1024, // 50MB
        maxFiles: 5,
        tailable: true,
        handleExceptions: false,
        handleRejections: false
      }),

      new transports.File({
        filename: 'logs/combined.log',
        format: productionFormat,
        maxsize: 100 * 1024 * 1024, // 100MB
        maxFiles: 10,
        tailable: true,
        handleExceptions: false,
        handleRejections: false
      })
    ] : [])
  ],
  exitOnError: false
})

// Custom metrics tracking
class MetricsCollector {
  private metrics: Map<string, { count: number; lastValue?: number; sum?: number }> = new Map()

  /**
   * Increment a counter metric
   */
  increment(metricName: string, tags?: Record<string, string>): void {
    const key = this.getMetricKey(metricName, tags)
    const current = this.metrics.get(key) || { count: 0 }
    current.count += 1
    this.metrics.set(key, current)

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
    const current = this.metrics.get(key) || { count: 0 }
    current.lastValue = value
    this.metrics.set(key, current)

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
    const current = this.metrics.get(key) || { count: 0, sum: 0 }
    current.count += 1
    current.sum = (current.sum || 0) + value
    current.lastValue = value
    this.metrics.set(key, current)

    logger.info('Histogram metric recorded', {
      metric: metricName,
      value,
      average: current.sum / current.count,
      count: current.count,
      tags
    })
  }

  /**
   * Get all current metrics
   */
  getMetrics(): Record<string, any> {
    const result: Record<string, any> = {}
    this.metrics.forEach((value, key) => {
      result[key] = value
    })
    
    // Add endpoint-specific metrics
    result.responseTimes = this.responseTimes
    result.errors = this.errors
    result.requestCounts = this.requestCounts
    
    return result
  }

  /**
   * Record response time for API endpoints
   */
  recordResponseTime(endpoint: string, responseTime: number): void {
    this.histogram(`api.response_time.${endpoint}`, responseTime)
    
    // Store response times for endpoint-specific analysis
    if (!this.responseTimes) this.responseTimes = {}
    if (!this.responseTimes[endpoint]) this.responseTimes[endpoint] = []
    
    this.responseTimes[endpoint].push(responseTime)
    
    // Limit stored response times to prevent memory leaks
    if (this.responseTimes[endpoint].length > 1000) {
      this.responseTimes[endpoint] = this.responseTimes[endpoint].slice(-1000)
    }
  }

  /**
   * Record error for API endpoints
   */
  recordError(endpoint: string, errorType: string): void {
    this.increment(`api.errors.${endpoint}`, { errorType })
    
    // Store error types for endpoint-specific analysis
    if (!this.errors) this.errors = {}
    if (!this.errors[endpoint]) this.errors[endpoint] = []
    
    this.errors[endpoint].push(errorType)
    
    // Limit stored errors to prevent memory leaks
    if (this.errors[endpoint].length > 1000) {
      this.errors[endpoint] = this.errors[endpoint].slice(-1000)
    }
  }

  /**
   * Increment request count for API endpoints
   */
  incrementRequestCount(endpoint: string): void {
    this.increment(`api.requests.${endpoint}`)
    
    // Store request counts for endpoint-specific analysis
    if (!this.requestCounts) this.requestCounts = {}
    this.requestCounts[endpoint] = (this.requestCounts[endpoint] || 0) + 1
  }

  /**
   * Record custom metric
   */
  recordCustomMetric(metricName: string, value: number): void {
    this.gauge(metricName, value)
  }

  // Properties for storing endpoint-specific metrics
  responseTimes: Record<string, number[]> = {}
  errors: Record<string, string[]> = {}
  requestCounts: Record<string, number> = {}

  /**
   * Get average response time for an endpoint
   */
  getAverageResponseTime(endpoint: string): number {
    if (!this.responseTimes[endpoint] || this.responseTimes[endpoint].length === 0) {
      return 0
    }
    const sum = this.responseTimes[endpoint].reduce((acc, time) => acc + time, 0)
    return sum / this.responseTimes[endpoint].length
  }

  /**
   * Get error rate for an endpoint
   */
  getErrorRate(endpoint: string): number {
    if (!this.requestCounts[endpoint] || this.requestCounts[endpoint] === 0) {
      return 0
    }
    const errorCount = this.errors[endpoint]?.length || 0
    return (errorCount / this.requestCounts[endpoint]) * 100
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.responseTimes = {}
    this.errors = {}
    this.requestCounts = {}
    this.metrics.clear()
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

// Application-specific logging helpers
class ApplicationLogger {
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
    if (level === 'warn') {
      logger.warn(`Authentication: ${event}`, {
        category: 'auth',
        ...context
      })
    } else {
      logger.info(`Authentication: ${event}`, {
        category: 'auth',
        ...context
      })
    }

    if (context.success === false) {
      metrics.increment('auth.failure', { event, provider: context.provider || 'unknown' })
    } else {
      metrics.increment('auth.success', { event, provider: context.provider || 'unknown' })
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
    if (level === 'error') {
      logger.error(`Workspace: ${event}`, {
        category: 'workspace',
        ...context
      })
    } else {
      logger.info(`Workspace: ${event}`, {
        category: 'workspace',
        ...context
      })
    }

    if (context.duration) {
      metrics.histogram('workspace.operation.duration', context.duration, {
        event,
        action: context.action || 'unknown'
      })
    }

    metrics.increment('workspace.events', { event, action: context.action || 'unknown' })
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
    if (level === 'error') {
      logger.error(`AI: ${event}`, {
        category: 'ai',
        ...context
      })
    } else {
      logger.info(`AI: ${event}`, {
        category: 'ai',
        ...context
      })
    }

    if (context.responseTime) {
      metrics.histogram('ai.response_time', context.responseTime, {
        model: context.model || 'unknown'
      })
    }

    if (context.tokensUsed) {
      metrics.histogram('ai.tokens_used', context.tokensUsed, {
        model: context.model || 'unknown'
      })
    }

    metrics.increment('ai.interactions', {
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
      metrics.histogram('http.response_time', context.responseTime, {
        endpoint: context.endpoint || 'unknown',
        method: context.method || 'unknown',
        status: context.statusCode?.toString() || 'unknown'
      })
    }

    if (context.memoryUsage) {
      metrics.gauge('system.memory_usage', context.memoryUsage)
    }

    if (context.cpuUsage) {
      metrics.gauge('system.cpu_usage', context.cpuUsage)
    }

    if (context.activeConnections) {
      metrics.gauge('system.active_connections', context.activeConnections)
    }
  }

  /**
   * Log security events
   */
  logSecurity(event: string, context: {
    userId?: string
    ip?: string
    userAgent?: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    details?: Record<string, any>
    blocked?: boolean
  }): void {
    const level = context.severity === 'critical' ? 'error' :
                  context.severity === 'high' ? 'warn' : 'info'

    if (level === 'error') {
      logger.error(`Security: ${event}`, {
        category: 'security',
        ...context
      })
    } else if (level === 'warn') {
      logger.warn(`Security: ${event}`, {
        category: 'security',
        ...context
      })
    } else {
      logger.info(`Security: ${event}`, {
        category: 'security',
        ...context
      })
    }

    metrics.increment('security.events', {
      event,
      severity: context.severity,
      blocked: context.blocked ? 'true' : 'false'
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

    metrics.increment('business.events', {
      event,
      feature: context.feature || 'unknown'
    })

    if (context.value) {
      metrics.histogram('business.value', context.value, {
        event,
        feature: context.feature || 'unknown'
      })
    }
  }

  /**
   * Log vector database operations
   */
  logVectorDB(event: string, context: {
    provider?: string
    operation?: string
    duration?: number
    results?: number
    embedding?: boolean
    cacheHit?: boolean
    pooled?: boolean
    error?: string
    details?: Record<string, any>
  }): void {
    const level = context.error ? 'error' : 'info';
    
    if (level === 'error') {
      logger.error(`VectorDB: ${event}`, {
        category: 'vectordb',
        ...context
      });
    } else {
      logger.info(`VectorDB: ${event}`, {
        category: 'vectordb',
        ...context
      });
    }
    
    // Track operation durations
    if (context.duration) {
      metrics.histogram('vectordb.operation.duration', context.duration, {
        provider: context.provider || 'unknown',
        operation: context.operation || 'unknown',
        cache: context.cacheHit ? 'hit' : 'miss',
        pooled: context.pooled ? 'true' : 'false'
      });
    }
    
    // Track result counts
    if (context.results !== undefined) {
      metrics.histogram('vectordb.results.count', context.results, {
        provider: context.provider || 'unknown',
        operation: context.operation || 'unknown'
      });
    }
    
    // Track operations by type
    metrics.increment('vectordb.operations', {
      event,
      provider: context.provider || 'unknown',
      operation: context.operation || 'unknown',
      cache: context.cacheHit ? 'hit' : 'miss',
      embedding: context.embedding ? 'true' : 'false',
      pooled: context.pooled ? 'true' : 'false'
    });
    
    // Track errors if any
    if (context.error) {
      metrics.increment('vectordb.errors', {
        provider: context.provider || 'unknown',
        operation: context.operation || 'unknown'
      });
    }
  }

  /**
   * Log API requests
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

    metrics.recordResponseTime(endpoint, responseTime)
    metrics.incrementRequestCount(endpoint)
    
    if (statusCode >= 400) {
      metrics.recordError(endpoint, `HTTP_${statusCode}`)
    }
  }

  /**
   * Log errors
   */
  logError(message: string, error: Error, context?: Record<string, any>): void {
    logger.error(message, {
      category: 'error',
      error: error.message,
      stack: error.stack,
      ...context
    })

    if (context?.component) {
      metrics.increment('errors.by_component', { component: context.component })
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
function getHealthCheck(): {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  uptime: number
  memory: {
    used: number
    total: number
    percentage: number
    arrayBuffers: number
    external: number
    heapTotal: number
    heapUsed: number
    rss: number
  }
  cpu?: {
    usage: number
    cores: number
  }
  metrics: Record<string, any>
} {
  const memUsage = process.memoryUsage()
  const totalMemory = memUsage.heapTotal + memUsage.external
  const usedMemory = memUsage.heapUsed + memUsage.arrayBuffers
  const memoryPercentage = totalMemory > 0 ? (usedMemory / totalMemory) * 100 : 0

  // Enhanced memory information
  const enhancedMemory = {
    used: Math.round(usedMemory / 1024 / 1024), // MB
    total: Math.round(totalMemory / 1024 / 1024), // MB
    percentage: Math.round(memoryPercentage * 100) / 100, // Rounded to 2 decimal places
    arrayBuffers: memUsage.arrayBuffers,
    external: memUsage.external,
    heapTotal: memUsage.heapTotal,
    heapUsed: memUsage.heapUsed,
    rss: memUsage.rss
  }

  // CPU information (simplified for now)
  const cpuInfo = {
    usage: Math.random() * 100, // Placeholder - in production this would use os.cpus()
    cores: require('os').cpus().length
  }

  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: enhancedMemory,
    cpu: cpuInfo,
    metrics: metrics.getMetrics()
  }
}

export {
  logger,
  tracer,
  metrics,
  appLogger,
  performanceMiddleware,
  getHealthCheck,
  MetricsCollector,
  ApplicationLogger
}
