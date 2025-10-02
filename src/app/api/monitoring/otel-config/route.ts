/**
 * @description OpenTelemetry Configuration API - Provides configuration information, health status, and connection testing for OpenTelemetry integration with OTLP exporters and Prometheus metrics.
 * @route GET /api/monitoring/otel-config
 * @route POST /api/monitoring/otel-config
 * @access Public
 *
 * @param {NextRequest} request - Next.js request with query parameters:
 *   - action: 'config' | 'health' | 'metrics' | 'status' - Action to perform (GET only)
 *
 * @returns {Response} GET with action=config returns OpenTelemetry configuration:
 *   - serviceName: string - Service name for traces
 *   - exporters: { otlp, prometheus } - Exporter configuration
 *   - instrumentations: string[] - Enabled instrumentations
 *   - status: 'active' | 'disabled' | 'unavailable' - SDK status
 *
 * @returns {Response} GET with action=health returns health status:
 *   - healthy: boolean - Overall health status
 *   - status: 'healthy' | 'unhealthy' - Health state
 *   - details: { opentelemetry, exporters, datadog_integration } - Component health
 *
 * @returns {Response} GET with action=metrics returns available metrics list:
 *   - available_metrics: string[] - List of tracked metrics
 *   - prometheus_endpoint: string - Prometheus scrape endpoint
 *   - otlp_endpoint: string - OTLP trace endpoint
 *
 * @returns {Response} POST with action=reload_config attempts configuration reload (requires restart)
 * @returns {Response} POST with action=test_connection tests OTLP endpoint connectivity
 *
 * @example
 * // GET Request - Configuration
 * GET /api/monitoring/otel-config?action=config
 *
 * // Response
 * {
 *   "serviceName": "vibecode-webgui",
 *   "exporters": {
 *     "otlp": { "endpoint": "http://localhost:4318/v1/traces", "status": "configured" },
 *     "prometheus": { "port": "9090", "status": "configured" }
 *   },
 *   "status": "active"
 * }
 *
 * // GET Request - Health check
 * GET /api/monitoring/otel-config?action=health
 *
 * // Response
 * {
 *   "healthy": true,
 *   "status": "healthy",
 *   "details": {
 *     "opentelemetry": { "initialized": true, "status": "running" },
 *     "datadog_integration": { "enabled": true, "status": "enabled" }
 *   }
 * }
 *
 * // POST Request - Test connection
 * POST /api/monitoring/otel-config
 * { "action": "test_connection" }
 *
 * // Response
 * {
 *   "success": true,
 *   "endpoint": "http://localhost:4318/v1/traces",
 *   "status": 200,
 *   "message": "OTLP endpoint is reachable"
 * }
 *
 * @throws {400} Invalid action - Unknown action type
 * @throws {500} Internal server error - Failed to retrieve OpenTelemetry configuration
 */

import { NextRequest, NextResponse } from 'next/server'

// Check if we're in a Docker build environment
const isDockerBuild = (
  process.env.DOCKER_BUILD === 'true' ||
  process.env.SKIP_MONITORING === 'true' ||
  process.env.CI === 'true' ||
  process.env.GITHUB_ACTIONS === 'true' ||
  process.env.OTEL_ENABLED === 'false' ||
  process.env.DD_ENABLED === 'false'
);

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'

async function loadOpenTelemetryModule() {
  try {
    const opentelemetryModule = await import('../../../../lib/monitoring/opentelemetry');
    return {
      getOpenTelemetryConfig: opentelemetryModule.getOpenTelemetryConfig,
      otelSDK: opentelemetryModule.otelSDK
    };
  } catch {
    console.log('⚠️ OpenTelemetry module not available, monitoring disabled');
    return { getOpenTelemetryConfig: null, otelSDK: null };
  }
}

export async function GET(request: NextRequest) {
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

    // Load OpenTelemetry modules dynamically
    const { getOpenTelemetryConfig, otelSDK } = await loadOpenTelemetryModule();

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
        const healthStatus = {
          opentelemetry: {
            initialized: !!otelSDK,
            status: otelSDK ? 'running' : 'not_initialized'
          },
          exporters: {
            otlp: {
              endpoint: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
              status: 'configured'
            },
            prometheus: {
              port: process.env.OTEL_PROMETHEUS_PORT || '9090',
              endpoint: process.env.OTEL_PROMETHEUS_ENDPOINT || '/metrics',
              status: 'configured'
            }
          },
          datadog_integration: {
            enabled: !!process.env.DD_API_KEY,
            otlp_compatible: true,
            status: process.env.DD_API_KEY ? 'enabled' : 'disabled'
          }
        }

        const overallHealthy = healthStatus.opentelemetry.initialized

        return NextResponse.json({
          healthy: overallHealthy,
          status: overallHealthy ? 'healthy' : 'unhealthy',
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
    console.error('OpenTelemetry config API error:', error)
    
    return NextResponse.json({
      error: 'Failed to retrieve OpenTelemetry configuration',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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
    console.error('OpenTelemetry config POST error:', error)
    
    return NextResponse.json({
      error: 'Failed to process OpenTelemetry configuration request',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}