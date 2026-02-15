/**
 * OpenTelemetry Traces API Endpoint
 * Provides trace export and visualization data, receives traces from client-side
 */

import { NextRequest, NextResponse } from 'next/server'
import { monitoring } from '../../../../lib/monitoring'
import { createAPIRateLimit } from '@/lib/rate-limiting'
import { checkMonitoringAuth, getUnauthorizedResponse } from '../../../../lib/monitoring/auth'
import { cache, CacheTTL } from '../../../../lib/cache/unified-cache-client'
import { getCurrentTraceContext, extractTraceContext } from '../../../../lib/monitoring/trace-context'
import { getOpenTelemetryConfig } from '../../../../lib/monitoring/opentelemetry'

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(120) // 120 requests per minute - monitoring data

/**
 * GET endpoint for trace export and visualization
 * Returns trace data and configuration for monitoring dashboards
 */
export async function GET(request: NextRequest) {
  // Check authentication first
  const authResult = await checkMonitoringAuth(request)
  if (!authResult.isAuthorized) {
    return getUnauthorizedResponse(authResult.error)
  }

  // Rate limiting
  const rateLimitResult = await apiRateLimit(request)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
        },
      }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || '1h'
    const service = searchParams.get('service') || 'all'
    const traceId = searchParams.get('trace_id')
    const skipCache = searchParams.get('skip_cache') === 'true'

    // Cache key for trace data
    const cacheKey = `monitoring:traces:${timeframe}:${service}:${traceId || 'all'}`

    // Try cache first
    if (!skipCache) {
      const cached = await cache.get(cacheKey)
      if (cached) {
        return NextResponse.json({
          ...cached,
          from_cache: true,
          cache_hit: true,
          timestamp: new Date().toISOString(),
        })
      }
    }

    const startTime = Date.now()

    // Get OpenTelemetry configuration
    const otelConfig = getOpenTelemetryConfig()

    // Get current trace context if available
    const currentTraceContext = getCurrentTraceContext()

    // Extract trace context from request headers
    const incomingTraceContext = extractTraceContext(request.headers)

    // Build trace export response
    const response = {
      timestamp: new Date().toISOString(),
      timeframe,
      service_filter: service,
      trace_id_filter: traceId || null,
      processing_time_ms: Date.now() - startTime,
      from_cache: false,
      cache_hit: false,

      // OpenTelemetry Configuration
      configuration: {
        enabled: otelConfig.initialized,
        service_name: otelConfig.service_name,
        service_version: otelConfig.service_version,
        environment: otelConfig.environment,
        otlp_endpoint: otelConfig.otlp_endpoint,
        prometheus_port: otelConfig.prometheus_port,
        datadog_integration: otelConfig.datadog_integration,
      },

      // Current Trace Context
      current_trace: {
        trace_id: currentTraceContext.traceId,
        span_id: currentTraceContext.spanId,
        trace_flags: currentTraceContext.traceFlags,
        has_active_span: !!(currentTraceContext.traceId && currentTraceContext.spanId),
      },

      // Incoming Trace Context (from request headers)
      incoming_trace: incomingTraceContext
        ? {
            version: incomingTraceContext.version,
            trace_id: incomingTraceContext.traceId,
            parent_span_id: incomingTraceContext.spanId,
            trace_flags: incomingTraceContext.traceFlags,
          }
        : null,

      // Trace Export Information
      export: {
        format: 'OTLP',
        protocol: 'http/json',
        endpoint: otelConfig.otlp_endpoint,
        status: otelConfig.initialized ? 'active' : 'disabled',
        exporters: [
          {
            type: 'otlp',
            endpoint: otelConfig.otlp_endpoint,
            protocol: 'http',
            enabled: otelConfig.initialized,
          },
          {
            type: 'prometheus',
            endpoint: `http://localhost:${otelConfig.prometheus_port}/metrics`,
            enabled: otelConfig.initialized,
          },
        ],
      },

      // Service Information
      services: [
        {
          name: 'vibecode-webgui',
          type: 'nextjs',
          instrumentation: ['http', 'express', 'fetch'],
          status: otelConfig.initialized ? 'instrumented' : 'not_instrumented',
        },
        {
          name: 'vibecode-webgui-client',
          type: 'browser',
          instrumentation: ['user-interaction', 'document-load', 'fetch'],
          status: 'configured',
        },
        {
          name: 'vibecode-agentapi',
          type: 'python',
          instrumentation: ['flask', 'requests', 'ai'],
          status: 'configured',
        },
      ],

      // Trace Statistics (placeholder for future implementation with trace storage)
      statistics: {
        total_traces: 0,
        total_spans: 0,
        services_traced: 0,
        avg_trace_duration_ms: 0,
        error_rate: 0,
        note: 'Statistics will be populated when trace storage backend is implemented',
      },

      // Recent Traces (placeholder - will be populated from OTLP collector or storage backend)
      traces: [],

      // Instrumentation Status
      instrumentation: {
        backend_instrumented: otelConfig.initialized,
        frontend_instrumented: false, // Will be set by browser telemetry
        database_instrumented: false, // Will be set by database instrumentation
        ai_instrumented: false, // Will be set by AI request instrumentation
        containers_instrumented: false, // Will be set by container instrumentation
      },

      // Visualization Helpers
      visualization: {
        service_map: {
          nodes: [
            { id: 'webgui', name: 'Web UI', type: 'frontend' },
            { id: 'api', name: 'Next.js API', type: 'backend' },
            { id: 'agentapi', name: 'Agent API', type: 'service' },
            { id: 'database', name: 'PostgreSQL', type: 'database' },
            { id: 'cache', name: 'Valkey', type: 'cache' },
            { id: 'ai', name: 'AI Service', type: 'external' },
          ],
          edges: [
            { from: 'webgui', to: 'api', type: 'http' },
            { from: 'api', to: 'database', type: 'sql' },
            { from: 'api', to: 'cache', type: 'redis' },
            { from: 'api', to: 'agentapi', type: 'http' },
            { from: 'agentapi', to: 'ai', type: 'http' },
          ],
        },
        trace_timeline_available: false,
        flamegraph_available: false,
      },

      // Query Parameters for Advanced Filtering
      available_filters: {
        timeframe: ['15m', '1h', '6h', '24h', '7d', '30d'],
        service: ['all', 'vibecode-webgui', 'vibecode-agentapi', 'vibecode-database'],
        status: ['all', 'ok', 'error'],
        min_duration_ms: 'number',
        max_duration_ms: 'number',
      },

      // Export Formats
      export_formats: {
        json: '/api/monitoring/traces?format=json',
        otlp: '/api/monitoring/traces?format=otlp',
        jaeger: '/api/monitoring/traces?format=jaeger',
        zipkin: '/api/monitoring/traces?format=zipkin',
      },

      // Links to Related Endpoints
      related_endpoints: {
        dashboard: '/api/monitoring/dashboard',
        metrics: '/api/monitoring/metrics',
        health: '/api/health',
        otel_config: '/api/monitoring/otel-config',
      },
    }

    // Cache the response for 30 seconds
    if (!skipCache) {
      await cache.set(cacheKey, response, CacheTTL.SHORT / 2) // 30 seconds
    }

    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch trace data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

/**
 * POST endpoint for receiving trace data from client-side instrumentation
 */
export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await apiRateLimit(request)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
        },
      }
    )
  }

  try {
    const body = await request.json()

    let processedSpans = 0
    let errors = 0

    // Support both simple format and OTLP format
    if (body.spans && Array.isArray(body.spans)) {
      // Simple format: { spans: [...] }
      for (const span of body.spans) {
        try {
          const spanName = span.name || 'unknown_span'
          const traceId = span.traceId || 'unknown_trace'
          const duration = span.duration || 0
          const tags = ['source:client_simple', 'service:vibecode-webgui-client']

          // Add trace ID as tag
          tags.push(`trace_id:${traceId}`)

          // Submit as performance metric to Datadog
          await monitoring.submitMetric({
            metric: 'vibecode.client.span.duration',
            value: duration,
            tags: [...tags, `span_name:${spanName}`],
          })

          processedSpans++
        } catch (spanError) {
          errors++
        }
      }

      return NextResponse.json({
        success: true,
        processed_spans: processedSpans,
        errors,
        message: `Successfully processed ${processedSpans} spans${errors > 0 ? ` with ${errors} errors` : ''}`,
        timestamp: new Date().toISOString(),
      })
    } else if (body.resourceSpans && Array.isArray(body.resourceSpans)) {
      // OTLP format: { resourceSpans: [...] }
      for (const resourceSpan of body.resourceSpans) {
        try {
          const resource = resourceSpan.resource || {}
          const instrumentationLibrarySpans = resourceSpan.instrumentationLibrarySpans || []

          for (const libSpan of instrumentationLibrarySpans) {
            const spans = libSpan.spans || []

            for (const span of spans) {
              // Extract span information
              const spanName = span.name || 'unknown_span'
              const startTime = span.startTimeUnixNano
                ? Math.floor(parseInt(span.startTimeUnixNano) / 1000000)
                : Date.now()
              const endTime = span.endTimeUnixNano
                ? Math.floor(parseInt(span.endTimeUnixNano) / 1000000)
                : Date.now()
              const duration = endTime - startTime

              // Extract attributes
              const attributes = span.attributes || []
              const tags = ['source:client_otel', 'service:vibecode-webgui-client']

              attributes.forEach((attr: any) => {
                if (attr.key && attr.value) {
                  const value = attr.value.stringValue || attr.value.intValue || attr.value.boolValue
                  if (value !== undefined) {
                    tags.push(`${attr.key}:${value}`)
                  }
                }
              })

              // Submit as performance metric to Datadog
              await monitoring.submitMetric({
                metric: 'vibecode.client.span.duration',
                value: duration,
                tags: [...tags, `span_name:${spanName}`],
              })

              // For user interactions, submit additional metrics
              if (attributes.some((a: any) => a.key === 'user.interaction')) {
                await monitoring.submitMetric({
                  metric: 'vibecode.client.user_interactions.count',
                  value: 1,
                  tags,
                })
              }

              processedSpans++
            }
          }

          // Submit trace event to Datadog
          const serviceName =
            resource.attributes?.find((a: any) => a.key === 'service.name')?.value?.stringValue ||
            'vibecode-webgui-client'

          await monitoring.submitEvent(
            `Client Traces Received`,
            `Processed ${processedSpans} spans from ${serviceName}`,
            ['source:client_otel', 'event:traces_received', `service:${serviceName}`]
          )
        } catch (spanError) {
          errors++
        }
      }

      return NextResponse.json({
        success: true,
        processed_spans: processedSpans,
        errors,
        message: `Successfully processed ${processedSpans} spans${errors > 0 ? ` with ${errors} errors` : ''}`,
        timestamp: new Date().toISOString(),
      })
    } else {
      // Invalid format
      return NextResponse.json(
        {
          error: 'Invalid trace data format',
          expected: 'Either simple format { spans: [...] } or OTLP format { resourceSpans: [...] }',
        },
        { status: 400 }
      )
    }

  } catch (error) {
    // Server error logged

    return NextResponse.json(
      {
        error: 'Failed to process traces',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
