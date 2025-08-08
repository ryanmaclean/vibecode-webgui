/**
 * API endpoint for submitting custom metrics
 * Allows frontend and other services to submit metrics to Datadog
 */

import { NextRequest, NextResponse } from 'next/server'
import { monitoring } from '../../../../lib/monitoring'
import { datadogMonitoring } from '../../../../lib/monitoring/enhanced-datadog-integration'

interface MetricSubmission {
  type: 'counter' | 'gauge' | 'histogram' | 'event'
  name: string
  value?: number
  tags?: string[]
  metadata?: Record<string, any>
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as MetricSubmission | MetricSubmission[]
    const metrics = Array.isArray(body) ? body : [body]

    const results = []

    for (const metric of metrics) {
      const result = await processMetric(metric, request)
      results.push(result)
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results: results
    })

  } catch (error) {
    console.error('Metrics API error:', error)
    
    return NextResponse.json({
      error: 'Failed to process metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function processMetric(metric: MetricSubmission, request: NextRequest): Promise<{ success: boolean; metric: string; error?: string }> {
  try {
    // Add common tags
    const commonTags = [
      `service:${process.env.DATADOG_SERVICE || 'vibecode-webgui'}`,
      `env:${process.env.NODE_ENV || 'development'}`,
      ...(metric.tags || [])
    ]

    switch (metric.type) {
      case 'counter':
      case 'gauge':
        if (typeof metric.value !== 'number') {
          throw new Error('Counter and gauge metrics require a numeric value')
        }
        
        await monitoring.submitMetric({
          metric: `vibecode.${metric.name}`,
          value: metric.value,
          tags: commonTags
        })
        break

      case 'event':
        await monitoring.submitEvent(
          metric.name,
          JSON.stringify(metric.metadata || {}),
          commonTags
        )
        break

      case 'histogram':
        // For histograms, we'll treat them as gauges for now
        // In a full implementation, you'd use the Datadog histogram API
        if (typeof metric.value !== 'number') {
          throw new Error('Histogram metrics require a numeric value')
        }
        
        await monitoring.submitMetric({
          metric: `vibecode.${metric.name}`,
          value: metric.value,
          tags: [...commonTags, 'metric_type:histogram']
        })
        break

      default:
        throw new Error(`Unknown metric type: ${metric.type}`)
    }

    return { success: true, metric: metric.name }

  } catch (error) {
    return { 
      success: false, 
      metric: metric.name, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

// GET endpoint to retrieve current metric status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeConfig = searchParams.get('config') === 'true'

    const response: any = {
      monitoring: {
        status: monitoring.isConfigured() ? 'active' : 'configured_but_inactive',
        datadog_configured: monitoring.isConfigured(),
        timestamp: new Date().toISOString()
      },
      supported_metrics: {
        types: ['counter', 'gauge', 'histogram', 'event'],
        examples: {
          counter: {
            type: 'counter',
            name: 'user.login',
            value: 1,
            tags: ['method:oauth', 'provider:github']
          },
          gauge: {
            type: 'gauge', 
            name: 'terminal.sessions.active',
            value: 5,
            tags: ['workspace:default']
          },
          histogram: {
            type: 'histogram',
            name: 'ai.response_time',
            value: 1500,
            tags: ['provider:openrouter', 'model:claude-3']
          },
          event: {
            type: 'event',
            name: 'Deployment Completed',
            metadata: { version: '1.2.3', environment: 'production' },
            tags: ['deployment', 'success']
          }
        }
      }
    }

    if (includeConfig) {
      response.configuration = {
        datadog_site: process.env.DATADOG_SITE || 'datadoghq.com',
        service: process.env.DATADOG_SERVICE || 'vibecode-webgui',
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0'
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Metrics config API error:', error)
    
    return NextResponse.json({
      error: 'Failed to retrieve metrics configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}