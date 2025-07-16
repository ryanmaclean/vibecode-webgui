/**
 * Server-side monitoring and logging for VibeCode WebGUI
 * Integrates Datadog APM tracing, Winston logging, and custom metrics
 */

import tracer from 'dd-trace'
import winston from 'winston'
import { createLogger, format, transports } from 'winston'

// Initialize Datadog tracer (should be done before importing other modules)
if (process.env.DD_API_KEY) {
  tracer.init({
    service: 'vibecode-webgui',
    env: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0',
    logInjection: true,
    runtimeMetrics: true,
    profiling: true,
    appsec: true, // Application Security Management
  })
  console.log('🔍 Datadog APM tracer initialized')
} else {
  console.warn('⚠️ Datadog APM not configured (DD_API_KEY missing)')
}

// Custom Winston formatter for structured logging
const structuredFormat = format.combine(
  format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  format.errors({ stack: true }),
  format.json(),
  format.printf(({ timestamp, level, message, service, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      service: service || 'vibecode-webgui',
      ...meta
    })
  })
)

// Create logger instance
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: structuredFormat,
  defaultMeta: {
    service: 'vibecode-webgui',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0'
  },
  transports: [
    // Console transport for development
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
          return `${timestamp} [${level}]: ${message} ${metaStr}`
        })
      )
    }),
    
    // File transport for persistent logging
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
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
    return result
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
    logger.log(level, `Authentication: ${event}`, {
      category: 'auth',
      ...context
    })
    
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
    logger.log(level, `Workspace: ${event}`, {
      category: 'workspace',
      ...context
    })
    
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
    logger.log(level, `AI: ${event}`, {
      category: 'ai',
      ...context
    })
    
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
    
    logger.log(level, `Security: ${event}`, {
      category: 'security',
      ...context
    })
    
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
  memory: NodeJS.MemoryUsage
  metrics: Record<string, any>
} {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
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