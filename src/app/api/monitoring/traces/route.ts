/**
 * OpenTelemetry Traces API Endpoint
 * Receives traces from client-side and forwards to monitoring systems
 */

import { NextRequest, NextResponse } from 'next/server'
import { monitoring } from '../../../../lib/monitoring'
import { createAPIRateLimit } from '@/lib/rate-limiting'

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(120) // 120 requests per minute - monitoring data

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
    const traces = await request.json()
    
    // Validate trace data structure
    if (!traces.resourceSpans || !Array.isArray(traces.resourceSpans)) {
      return NextResponse.json({
        error: 'Invalid trace data format',
        expected: 'OTLP trace format with resourceSpans array'
      }, { status: 400 })
    }

    // Debug log removed

    // Process each resource span
    let processedSpans = 0
    let errors = 0

    for (const resourceSpan of traces.resourceSpans) {
      try {
        const resource = resourceSpan.resource || {}
        const instrumentationLibrarySpans = resourceSpan.instrumentationLibrarySpans || []

        for (const libSpan of instrumentationLibrarySpans) {
          const spans = libSpan.spans || []
          
          for (const span of spans) {
            // Extract span information
            const spanName = span.name || 'unknown_span'
            const startTime = span.startTimeUnixNano ? 
              Math.floor(parseInt(span.startTimeUnixNano) / 1000000) : Date.now()
            const endTime = span.endTimeUnixNano ? 
              Math.floor(parseInt(span.endTimeUnixNano) / 1000000) : Date.now()
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
              tags: [...tags, `span_name:${spanName}`]
            })

            // For user interactions, submit additional metrics
            if (attributes.some((a: any) => a.key === 'user.interaction')) {
              await monitoring.submitMetric({
                metric: 'vibecode.client.user_interactions.count',
                value: 1,
                tags
              })
            }

            processedSpans++
          }
        }

        // Submit trace event to Datadog
        const serviceName = resource.attributes?.find((a: any) => 
          a.key === 'service.name')?.value?.stringValue || 'vibecode-webgui-client'
        
        await monitoring.submitEvent(
          `Client Traces Received`,
          `Processed ${processedSpans} spans from ${serviceName}`,
          ['source:client_otel', 'event:traces_received', `service:${serviceName}`]
        )

      } catch (spanError) {
        // Server error logged
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      processed_spans: processedSpans,
      errors,
      message: `Successfully processed ${processedSpans} spans${errors > 0 ? ` with ${errors} errors` : ''}`,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    // Server error logged
    
    return NextResponse.json({
      error: 'Failed to process traces',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
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

  return NextResponse.json({
    endpoint: 'OpenTelemetry Traces Collection',
    description: 'Receives OTLP trace data from client-side instrumentation',
    supported_methods: ['POST'],
    format: 'OTLP JSON',
    status: 'active'
  })
}