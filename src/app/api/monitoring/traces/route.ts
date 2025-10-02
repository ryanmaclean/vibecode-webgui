/**
 * @description OpenTelemetry Traces API Endpoint - Receives OTLP trace data from client-side instrumentation and processes spans for forwarding to Datadog monitoring. Supports distributed tracing and user interaction tracking.
 * @route POST /api/monitoring/traces
 * @route GET /api/monitoring/traces
 * @access Public (client-side telemetry collection)
 *
 * @param {NextRequest} request - Next.js request containing OTLP trace payload
 *
 * @returns {Response} POST processes trace spans and returns:
 *   - success: boolean - Processing status
 *   - processed_spans: number - Count of successfully processed spans
 *   - errors: number - Count of spans that failed processing
 *   - message: string - Processing summary
 *   - timestamp: string - ISO timestamp
 *
 * @returns {Response} GET returns endpoint information:
 *   - endpoint: string - Endpoint name
 *   - description: string - Endpoint purpose
 *   - supported_methods: string[] - Supported HTTP methods
 *   - format: string - Expected data format
 *   - status: string - Endpoint status
 *
 * @example
 * // POST Request - Submit OTLP traces
 * POST /api/monitoring/traces
 * {
 *   "resourceSpans": [
 *     {
 *       "resource": { "attributes": [...] },
 *       "instrumentationLibrarySpans": [
 *         {
 *           "spans": [
 *             {
 *               "name": "user_click",
 *               "startTimeUnixNano": "1234567890000000",
 *               "endTimeUnixNano": "1234567890500000",
 *               "attributes": [{ "key": "user.interaction", "value": { "stringValue": "button_click" }}]
 *             }
 *           ]
 *         }
 *       ]
 *     }
 *   ]
 * }
 *
 * // Response
 * {
 *   "success": true,
 *   "processed_spans": 15,
 *   "errors": 0,
 *   "message": "Successfully processed 15 spans"
 * }
 *
 * // GET Request - Endpoint info
 * GET /api/monitoring/traces
 *
 * // Response
 * {
 *   "endpoint": "OpenTelemetry Traces Collection",
 *   "status": "active",
 *   "format": "OTLP JSON"
 * }
 *
 * @throws {400} Invalid trace data format - resourceSpans array missing or malformed
 * @throws {500} Internal server error - Failed to process traces
 */

import { NextRequest, NextResponse } from 'next/server'
import { monitoring } from '../../../../lib/monitoring'

export async function POST(request: NextRequest) {
  try {
    const traces = await request.json()
    
    // Validate trace data structure
    if (!traces.resourceSpans || !Array.isArray(traces.resourceSpans)) {
      return NextResponse.json({
        error: 'Invalid trace data format',
        expected: 'OTLP trace format with resourceSpans array'
      }, { status: 400 })
    }

    console.log(`📡 Received ${traces.resourceSpans.length} trace spans from client`)

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
        console.error('Error processing span:', spanError)
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
    console.error('Traces API error:', error)
    
    return NextResponse.json({
      error: 'Failed to process traces',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    endpoint: 'OpenTelemetry Traces Collection',
    description: 'Receives OTLP trace data from client-side instrumentation',
    supported_methods: ['POST'],
    format: 'OTLP JSON',
    status: 'active'
  })
}