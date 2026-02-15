/**
 * OpenTelemetry Configuration API Endpoint
 * Provides configuration information and health status for OpenTelemetry integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAPIRateLimit } from '@/lib/rate-limiting'
import { checkOpenTelemetryHealth } from '@/lib/monitoring/opentelemetry-config'

const apiRateLimit = createAPIRateLimit(60) // 60 requests per minute - config endpoint

// Check if we're in a Docker build environment
const isDockerBuild = (
  process.env.DOCKER_BUILD === 'true' ||
  process.env.SKIP_MONITORING === 'true' ||
  process.env.CI === 'true' ||
  process.env.GITHUB_ACTIONS === 'true' ||
  process.env.OTEL_ENABLED === 'false' ||
  process.env.DD_ENABLED === 'false'
);

// Conditional imports to prevent build-time errors in Docker
let getOpenTelemetryConfig: any = null;
let otelSDK: any = null;

if (!isDockerBuild) {
  try {
    // Dynamic imports to prevent static analysis issues
    const opentelemetryModule = require('../../../../lib/monitoring/opentelemetry');
    getOpenTelemetryConfig = opentelemetryModule.getOpenTelemetryConfig;
    otelSDK = opentelemetryModule.otelSDK;
  } catch {
    // Debug log removed
  }
}

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'

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

  // If in Docker build, return a simple response
  if (isDockerBuild) {
    return NextResponse.json({
      status: 'disabled',
      message: 'OpenTelemetry monitoring disabled during Docker build',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'config'

    // Check if OpenTelemetry modules are available
    if (!getOpenTelemetryConfig || !otelSDK) {
      return NextResponse.json({
        status: 'unavailable',
        message: 'OpenTelemetry modules not available',
        timestamp: new Date().toISOString()
      });
    }

    switch (action) {
      case 'config':
        const config = getOpenTelemetryConfig()
        
        return NextResponse.json({
          ...config,
          status: 'active',
          timestamp: new Date().toISOString()
        })

      case 'health':
        const healthCheckResult = checkOpenTelemetryHealth()

        const healthStatus = {
          opentelemetry: {
            initialized: !!otelSDK,
            status: otelSDK ? 'running' : 'not_initialized'
          },
          ...healthCheckResult.details
        }

        const overallHealthy = healthCheckResult.status === 'healthy'

        return NextResponse.json({
          healthy: overallHealthy,
          status: healthCheckResult.status,
          details: healthStatus,
          timestamp: new Date().toISOString()
        })

      case 'metrics':
        // Return available OpenTelemetry metrics information
        return NextResponse.json({
          available_metrics: [
            'http.server.duration',
            'http.client.duration', 
            'db.client.operation.duration',
            'process.runtime.nodejs.memory.heap.used',
            'process.runtime.nodejs.event_loop.lag',
            'vibecode.client.span.duration',
            'vibecode.client.user_interactions.count'
          ],
          prometheus_endpoint: `http://localhost:${process.env.OTEL_PROMETHEUS_PORT || '9090'}/metrics`,
          otlp_endpoint: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
          timestamp: new Date().toISOString()
        })

      case 'status':
        // Detailed status including instrumentation
        return NextResponse.json({
          sdk_status: otelSDK ? 'initialized' : 'not_initialized',
          instrumentations: {
            http: 'enabled',
            express: 'enabled',
            fs: process.env.NODE_ENV === 'production' ? 'enabled' : 'disabled',
            dns: process.env.NODE_ENV === 'production' ? 'enabled' : 'disabled',
            net: process.env.NODE_ENV === 'production' ? 'enabled' : 'disabled'
          },
          resource_attributes: {
            service_name: 'vibecode-webgui',
            service_version: process.env.npm_package_version || '0.1.0',
            service_namespace: 'vibecode',
            deployment_environment: process.env.NODE_ENV || 'development'
          },
          environment_variables: {
            OTEL_ENABLED: process.env.OTEL_ENABLED || 'false',
            OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'not_set',
            OTEL_PROMETHEUS_PORT: process.env.OTEL_PROMETHEUS_PORT || '9090',
            DD_API_KEY: process.env.DD_API_KEY ? 'configured' : 'not_set'
          }
        })

      default:
        return NextResponse.json({
          error: 'Invalid action',
          available_actions: ['config', 'health', 'metrics', 'status']
        }, { status: 400 })
    }

  } catch (error) {
    // Server error logged
    
    return NextResponse.json({
      error: 'Failed to retrieve OpenTelemetry configuration',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

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
    const { action } = body

    switch (action) {
      case 'reload_config':
        // Note: In a production environment, you might want to restrict this
        // or implement proper authentication/authorization
        
        return NextResponse.json({
          success: false,
          message: 'Configuration reload requires application restart',
          recommendation: 'Restart the application with updated environment variables',
          timestamp: new Date().toISOString()
        })

      case 'test_connection':
        // Test connection to OTLP endpoint
        const endpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
        
        if (!endpoint) {
          return NextResponse.json({
            success: false,
            message: 'OTLP endpoint not configured',
            timestamp: new Date().toISOString()
          })
        }

        try {
          // Simple connectivity test (in production, you might want a more sophisticated test)
          const testResponse = await fetch(endpoint, {
            method: 'HEAD',
            signal: AbortSignal.timeout(5000)
          })

          return NextResponse.json({
            success: true,
            endpoint,
            status: testResponse.status,
            message: 'OTLP endpoint is reachable',
            timestamp: new Date().toISOString()
          })

        } catch (fetchError) {
          return NextResponse.json({
            success: false,
            endpoint,
            error: fetchError instanceof Error ? fetchError.message : 'Connection failed',
            timestamp: new Date().toISOString()
          })
        }

      default:
        return NextResponse.json({
          error: 'Invalid action',
          available_actions: ['reload_config', 'test_connection']
        }, { status: 400 })
    }

  } catch (error) {
    // Server error logged
    
    return NextResponse.json({
      error: 'Failed to process OpenTelemetry configuration request',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}