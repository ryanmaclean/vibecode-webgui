/**
 * Server-side monitoring and logging for VibeCode WebGUI
 * Integrates Datadog APM tracing, Winston logging, and custom metrics
 */

import { createLogger, format, transports } from 'winston';
import tracer from '@/instrument';

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
    // In production, you would add transports for services like Datadog, Logstash, etc.
    // new transports.Http({ host: 'datadog-agent', port: 80, path: '/v1/input' })
  ]
})

logger.info('Winston logger initialized')

/**
 * Custom metrics collector (compatible with Datadog)
 */
class MetricsCollector {
  private metrics: Record<string, any> = {}

  increment(name: string, tags: Record<string, string | number> = {}): void {
    console.log(`📊 Metric increment: ${name}`, tags)
    // In a real scenario, this would send to Datadog agent
    // Example: client.increment(name, tags)
    this.metrics[name] = (this.metrics[name] || 0) + 1
  }

  gauge(name: string, value: number, tags: Record<string, string | number> = {}): void {
    console.log(`📊 Metric gauge: ${name} = ${value}`, tags)
    // Example: client.gauge(name, value, tags)
    this.metrics[name] = value
  }

  histogram(name: string, value: number, tags: Record<string, string | number> = {}): void {
    console.log(`📊 Metric histogram: ${name} = ${value}`, tags)
    // Example: client.histogram(name, value, tags)
    if (!this.metrics[name]) {
      this.metrics[name] = []
    }
    this.metrics[name].push(value)
  }

  getMetrics(): Record<string, any> {
    return this.metrics
  }
}

const metrics = new MetricsCollector()

/**
 * Centralized application logger
 */
class ApplicationLogger {
  /**
   * Log performance metrics
   */
  logPerformance(context: {
    endpoint: string
    method: string
    statusCode: number
    responseTime: number
    memoryUsage: number
  }): void {
    logger.info(`Performance: ${context.method} ${context.endpoint}`, {
      category: 'performance',
      ...context
    })

    metrics.histogram('http.request.duration', context.responseTime, {
      endpoint: context.endpoint,
      method: context.method,
      status_code: context.statusCode
    })

    metrics.gauge('memory.heap.used', context.memoryUsage, {
      endpoint: context.endpoint
    })
  }

  /**
   * Log security-related events
   */
  logSecurity(event: string, context: {
    userId?: string
    ip?: string
    severity: 'info' | 'warn' | 'error' | 'critical'
    blocked?: boolean
    metadata?: Record<string, any>
  }): void {
    logger.warn(`Security: ${event}`, {
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
