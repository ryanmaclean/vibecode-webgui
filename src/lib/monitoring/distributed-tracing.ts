/**
 * Distributed Tracing Middleware for VibeCode WebGUI
 * Provides comprehensive tracing and monitoring for API endpoints
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export interface TracingOptions {
  operation?: string
  service?: string
  tags?: Record<string, string>
  logLevel?: 'debug' | 'info' | 'warn' | 'error'
  skipMetrics?: boolean
}

export interface TraceContext {
  traceId: string
  spanId: string
  operation: string
  startTime: number
  service: string
  tags: Record<string, string>
}

/**
 * Creates a trace context for an incoming request
 */
export function createTraceContext(
  request: NextRequest, 
  options: TracingOptions = {}
): TraceContext {
  const traceId = request.headers.get('x-trace-id') || 
    request.headers.get('x-datadog-trace-id') || 
    request.headers.get('x-request-id') ||
    crypto.randomUUID()
    
  const spanId = request.headers.get('x-span-id') || 
    request.headers.get('x-datadog-span-id') || 
    crypto.randomUUID()

  const operation = options.operation || 
    `${request.method} ${new URL(request.url).pathname}`

  return {
    traceId,
    spanId,
    operation,
    startTime: Date.now(),
    service: options.service || 'vibecode-webgui',
    tags: {
      'http.method': request.method,
      'http.url': request.url,
      'http.user_agent': request.headers.get('user-agent') || 'unknown',
      'http.remote_addr': request.headers.get('x-forwarded-for') || 
        request.headers.get('x-real-ip') || 
        'unknown',
      ...options.tags
    }
  }
}

/**
 * Middleware wrapper for API routes with comprehensive tracing
 */
export function withTracing<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
  options: TracingOptions = {}
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const traceContext = createTraceContext(request, options)
    
    // Add trace headers to response
    const responseHeaders = new Headers()
    responseHeaders.set('x-trace-id', traceContext.traceId)
    responseHeaders.set('x-span-id', traceContext.spanId)

    try {
      // Start the trace
      const result = await logger.trace(
        traceContext.operation,
        async () => {
          return await handler(request, ...args)
        },
        {
          traceId: traceContext.traceId,
          spanId: traceContext.spanId,
          service: traceContext.service,
          operation: traceContext.operation,
          ...traceContext.tags
        }
      )

      const duration = Date.now() - traceContext.startTime
      
      // Log successful completion
      logger.http(
        request.method,
        request.url,
        result.status,
        duration,
        {
          traceId: traceContext.traceId,
          spanId: traceContext.spanId,
          service: traceContext.service,
          operation: traceContext.operation,
          success: true
        }
      )

      // Add trace headers to the response
      const newHeaders = new Headers(result.headers)
      newHeaders.set('x-trace-id', traceContext.traceId)
      newHeaders.set('x-span-id', traceContext.spanId)
      
      return new NextResponse(result.body, {
        status: result.status,
        statusText: result.statusText,
        headers: newHeaders
      })

    } catch (error) {
      const duration = Date.now() - traceContext.startTime
      
      // Log error
      console.error(`Request failed: ${traceContext.operation}`, {
        traceId: traceContext.traceId,
        spanId: traceContext.spanId,
        service: traceContext.service,
        operation: traceContext.operation,
        duration,
        error: {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        },
        ...traceContext.tags
      })

      // Record error metrics
      logger.counter('vibecode.errors.total', 1, {
        operation: traceContext.operation,
        service: traceContext.service,
        error_type: error instanceof Error ? error.name : 'Unknown'
      })

      // Return error response with trace headers
      responseHeaders.set('x-trace-id', traceContext.traceId)
      responseHeaders.set('x-span-id', traceContext.spanId)
      
      const errorResponse = NextResponse.json(
        {
          error: 'Internal Server Error',
          traceId: traceContext.traceId,
          timestamp: new Date().toISOString()
        },
        {
          status: 500,
          headers: responseHeaders
        }
      )

      return errorResponse
    }
  }
}

/**
 * Performance monitoring decorator for functions
 */
export function withPerformanceMonitoring<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  operation: string,
  options: {
    tags?: Record<string, string>
    thresholds?: {
      warn?: number
      error?: number
    }
  } = {}
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now()
    
    try {
      const result = await fn(...args)
      const duration = Date.now() - startTime
      
      // Log performance metric
      logger.performance(operation, duration, {
        operation,
        success: true,
        ...options.tags
      })
      
      // Check thresholds
      if (options.thresholds?.error && duration > options.thresholds.error) {
        console.error(`Performance threshold exceeded: ${operation}`, {
          operation,
          duration,
          threshold: options.thresholds.error,
          severity: 'error'
        })
      } else if (options.thresholds?.warn && duration > options.thresholds.warn) {
        console.warn(`Performance threshold warning: ${operation}`, {
          operation,
          duration,
          threshold: options.thresholds.warn,
          severity: 'warning'
        })
      }
      
      // Submit performance metrics
      logger.gauge(`vibecode.performance.${operation}`, duration, {
        operation,
        success: 'true',
        ...options.tags
      })
      
      return result
      
    } catch (error) {
      const duration = Date.now() - startTime
      
      console.error(`Operation failed: ${operation}`, {
        operation,
        duration,
        success: false,
        error: {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error)
        },
        ...options.tags
      })
      
      // Submit error metrics
      logger.gauge(`vibecode.performance.${operation}`, duration, {
        operation,
        success: 'false',
        error_type: error instanceof Error ? error.name : 'Unknown',
        ...options.tags
      })
      
      throw error
    }
  }
}

/**
 * Database operation tracing
 */
export function withDatabaseTracing<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  operation: string,
  options: {
    table?: string
    query?: string
    tags?: Record<string, string>
  } = {}
): (...args: T) => Promise<R> {
  return withPerformanceMonitoring(
    fn,
    `db.${operation}`,
    {
      tags: {
        operation_type: 'database',
        db_operation: operation,
        table: options.table || 'unknown',
        ...options.tags
      },
      thresholds: {
        warn: 1000, // 1 second
        error: 5000 // 5 seconds
      }
    }
  )
}

/**
 * AI operation tracing
 */
export function withAITracing<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  operation: string,
  options: {
    model?: string
    provider?: string
    tags?: Record<string, string>
  } = {}
): (...args: T) => Promise<R> {
  return withPerformanceMonitoring(
    fn,
    `ai.${operation}`,
    {
      tags: {
        operation_type: 'ai',
        ai_operation: operation,
        model: options.model || 'unknown',
        provider: options.provider || 'unknown',
        ...options.tags
      },
      thresholds: {
        warn: 10000, // 10 seconds
        error: 30000 // 30 seconds
      }
    }
  )
}

/**
 * Cache operation tracing
 */
export function withCacheTracing<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  operation: string,
  options: {
    cache_type?: string
    key?: string
    tags?: Record<string, string>
  } = {}
): (...args: T) => Promise<R> {
  return withPerformanceMonitoring(
    fn,
    `cache.${operation}`,
    {
      tags: {
        operation_type: 'cache',
        cache_operation: operation,
        cache_type: options.cache_type || 'unknown',
        cache_key: options.key ? 'redacted' : 'unknown', // Don't log actual keys
        ...options.tags
      },
      thresholds: {
        warn: 500, // 500ms
        error: 2000 // 2 seconds
      }
    }
  )
}

/**
 * Business logic operation tracing
 */
export function withBusinessLogicTracing<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  operation: string,
  options: {
    feature?: string
    userId?: string
    workspaceId?: string
    tags?: Record<string, string>
  } = {}
): (...args: T) => Promise<R> {
  return withPerformanceMonitoring(
    fn,
    `business.${operation}`,
    {
      tags: {
        operation_type: 'business',
        business_operation: operation,
        feature: options.feature || 'unknown',
        user_id: options.userId ? 'redacted' : 'unknown', // Don't log actual IDs
        workspace_id: options.workspaceId ? 'redacted' : 'unknown',
        ...options.tags
      },
      thresholds: {
        warn: 3000, // 3 seconds
        error: 10000 // 10 seconds
      }
    }
  )
}

/**
 * Extract trace context from headers for service-to-service calls
 */
export function extractTraceContext(headers: Headers): Partial<TraceContext> {
  return {
    traceId: headers.get('x-trace-id') || 
      headers.get('x-datadog-trace-id') || 
      headers.get('x-request-id') || 
      undefined,
    spanId: headers.get('x-span-id') || 
      headers.get('x-datadog-span-id') || 
      undefined
  }
}

/**
 * Inject trace context into outbound request headers
 */
export function injectTraceContext(
  headers: Headers, 
  traceContext: Partial<TraceContext>
): Headers {
  const newHeaders = new Headers(headers)
  
  if (traceContext.traceId) {
    newHeaders.set('x-trace-id', traceContext.traceId)
    newHeaders.set('x-datadog-trace-id', traceContext.traceId)
  }
  
  if (traceContext.spanId) {
    newHeaders.set('x-span-id', traceContext.spanId)
    newHeaders.set('x-datadog-span-id', traceContext.spanId)
  }
  
  return newHeaders
}

/**
 * Create a child span from an existing trace context
 */
export function createChildSpan(
  parentContext: TraceContext,
  operation: string,
  tags: Record<string, string> = {}
): TraceContext {
  return {
    ...parentContext,
    spanId: crypto.randomUUID(),
    operation,
    startTime: Date.now(),
    tags: {
      ...parentContext.tags,
      ...tags,
      'span.kind': 'internal',
      'parent.span_id': parentContext.spanId
    }
  }
}