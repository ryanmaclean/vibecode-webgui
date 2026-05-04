/**
 * Monitoring Stack Health Check API Endpoint
 *
 * Returns monitoring infrastructure health status including:
 * - Datadog agent status
 * - OpenTelemetry collector status
 * - Metrics, traces, and logs pipeline health
 *
 * Features:
 * - Rate limiting to prevent excessive checks
 * - Datadog tracing integration
 * - Detailed per-service monitoring status
 * - Request ID tracking
 *
 * GET /api/health/monitoring - Returns aggregated monitoring stack health
 * GET /api/health/monitoring?service=datadog - Returns Datadog health only
 * GET /api/health/monitoring?service=opentelemetry - Returns OpenTelemetry health only
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServiceLogger } from '@/lib/logging';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import type {
  DatadogHealthResult,
  OpenTelemetryHealthResult,
  MonitoringServiceName,
} from '@/types/unified-status';
import type { ServiceHealthStatus, AggregatedHealthStatus } from '@/types/health';

export const dynamic = 'force-dynamic';

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'health-monitoring-api',
});

const execAsync = promisify(exec);
const CHECK_TIMEOUT_MS = 5000;
const apiRateLimit = createAPIRateLimit(60); // 60 requests per minute

/**
 * Get Datadog agent health status
 */
async function getDatadogHealth(): Promise<DatadogHealthResult> {
  const startTime = Date.now();
  let agentRunning = false;
  let agentVersion: string | undefined;
  let apiConnected = false;
  let metricsActive = false;
  let tracesActive = false;
  let logsActive = false;
  let error: string | undefined;

  try {
    // Check if Datadog agent is running (via datadog-agent status)
    try {
      const statusResult = await execAsync('datadog-agent status 2>/dev/null || dd-agent status 2>/dev/null', {
        timeout: CHECK_TIMEOUT_MS,
      });
      agentRunning = true;

      // Try to extract version from status output
      const versionMatch = statusResult.stdout.match(/Agent \(v([\d.]+)\)/);
      if (versionMatch) {
        agentVersion = versionMatch[1];
      }

      // Check for API connectivity
      apiConnected = statusResult.stdout.includes('API Keys status') && !statusResult.stdout.includes('API key ending with');

      // Check for active metrics
      metricsActive = statusResult.stdout.includes('Metrics') || statusResult.stdout.includes('Running Checks');

      // Check for active traces
      tracesActive = statusResult.stdout.includes('APM Agent') || statusResult.stdout.includes('Trace Agent');

      // Check for active logs
      logsActive = statusResult.stdout.includes('Logs Agent');
    } catch (agentError) {
      // Agent might not be installed or not running
      // Check if DD_AGENT_HOST is configured (containerized setup)
      const ddAgentHost = process.env.DD_AGENT_HOST;
      const ddAgentPort = process.env.DD_TRACE_AGENT_PORT || '8126';

      if (ddAgentHost) {
        // Try to check agent health via HTTP
        try {
          const agentInfoUrl = `http://${ddAgentHost}:${ddAgentPort}/info`;
          const agentResponse = await fetch(agentInfoUrl, {
            signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
          });
          const statusCode = agentResponse.status.toString();

          if (statusCode === '200') {
            agentRunning = true;
            apiConnected = true;
            // Assume all features are active if agent responds
            metricsActive = true;
            tracesActive = true;
            logsActive = true;
          }
        } catch {
          // HTTP check failed
          error = 'Datadog agent not reachable';
        }
      } else {
        // Check if DD_API_KEY is configured (indicates Datadog is intended to be used)
        const ddApiKey = process.env.DD_API_KEY;
        if (ddApiKey) {
          error = 'Datadog API key configured but agent is not running';
        } else {
          error = 'Datadog is not configured (DD_API_KEY or DD_AGENT_HOST not set)';
        }
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error checking Datadog';
  }

  const latencyMs = Date.now() - startTime;
  const lastChecked = new Date().toISOString();

  // Determine status
  let status: AggregatedHealthStatus = 'unhealthy';
  if (agentRunning && apiConnected && metricsActive) {
    status = 'healthy';
  } else if (agentRunning) {
    status = 'degraded';
  } else {
    status = 'unhealthy';
  }

  return {
    name: 'datadog',
    status,
    agentRunning,
    agentVersion,
    apiConnected,
    metricsActive,
    tracesActive,
    logsActive,
    latencyMs,
    lastChecked,
    error,
  };
}

/**
 * Get OpenTelemetry collector health status
 */
async function getOpenTelemetryHealth(): Promise<OpenTelemetryHealthResult> {
  const startTime = Date.now();
  let collectorRunning = false;
  let collectorVersion: string | undefined;
  let otlpEndpointReachable = false;
  let receiversActive = false;
  let exportersActive = false;
  let error: string | undefined;

  try {
    // Check if OTEL collector is configured
    const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.OTEL_COLLECTOR_ENDPOINT;
    const otelServiceName = process.env.OTEL_SERVICE_NAME;

    if (!otelEndpoint) {
      error = 'OpenTelemetry is not configured (OTEL_EXPORTER_OTLP_ENDPOINT not set)';
    } else {
      // Try to check OTLP health endpoint
      try {
        // Parse endpoint URL
        const endpointUrl = new URL(otelEndpoint);
        const healthUrl = `${endpointUrl.protocol}//${endpointUrl.host}/health`;

        let otelHealthResponse: Response;
        try {
          otelHealthResponse = await fetch(healthUrl, {
            signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
          });
        } catch {
          throw new Error('OpenTelemetry collector endpoint not reachable');
        }

        if (otelHealthResponse.status === 200) {
          collectorRunning = true;
          otlpEndpointReachable = true;
          receiversActive = true;
          exportersActive = true;
        } else {
          // Try alternate endpoint
          const metricsUrl = `${endpointUrl.protocol}//${endpointUrl.host}/metrics`;
          let otelMetricsResponse: Response;
          try {
            otelMetricsResponse = await fetch(metricsUrl, {
              signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
            });
          } catch {
            throw new Error('OpenTelemetry collector metrics endpoint not reachable');
          }

          if (otelMetricsResponse.status === 200) {
            collectorRunning = true;
            otlpEndpointReachable = true;
            receiversActive = true;
            exportersActive = true;
          }
        }
      } catch (checkError) {
        error = 'OpenTelemetry collector endpoint not reachable';
      }

      // If still not running, check if it's a local process
      if (!collectorRunning) {
        try {
          const psResult = await execAsync('ps aux | grep otelcol', { timeout: CHECK_TIMEOUT_MS });
          if (psResult.stdout.includes('otelcol') && !psResult.stdout.includes('grep')) {
            collectorRunning = true;
            // Can't verify endpoint without HTTP check
            otlpEndpointReachable = false;
            receiversActive = true;
            exportersActive = true;
            error = 'OpenTelemetry collector running but health endpoint not reachable';
          }
        } catch {
          // Process check failed
        }
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error checking OpenTelemetry';
  }

  const latencyMs = Date.now() - startTime;
  const lastChecked = new Date().toISOString();

  // Determine status
  let status: AggregatedHealthStatus = 'unhealthy';
  if (collectorRunning && otlpEndpointReachable && receiversActive && exportersActive) {
    status = 'healthy';
  } else if (collectorRunning) {
    status = 'degraded';
  } else {
    status = 'unhealthy';
  }

  return {
    name: 'opentelemetry',
    status,
    collectorRunning,
    collectorVersion,
    otlpEndpointReachable,
    receiversActive,
    exportersActive,
    latencyMs,
    lastChecked,
    error,
  };
}

/**
 * Aggregate monitoring health results
 */
interface AggregatedMonitoringHealth {
  status: AggregatedHealthStatus;
  timestamp: string;
  totalCheckTimeMs: number;
  services: {
    datadog: DatadogHealthResult;
    opentelemetry: OpenTelemetryHealthResult;
  };
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

async function getAggregatedMonitoringHealth(): Promise<AggregatedMonitoringHealth> {
  const startTime = Date.now();

  // Run both checks in parallel
  const [datadog, opentelemetry] = await Promise.all([
    getDatadogHealth(),
    getOpenTelemetryHealth(),
  ]);

  // Calculate summary
  const services = [datadog, opentelemetry];
  const healthy = services.filter((s) => s.status === 'healthy').length;
  const degraded = services.filter((s) => s.status === 'degraded').length;
  const unhealthy = services.filter((s) => s.status === 'unhealthy').length;

  // Determine overall status
  let overallStatus: AggregatedHealthStatus = 'healthy';
  if (unhealthy === services.length) {
    overallStatus = 'unhealthy';
  } else if (unhealthy > 0 || degraded > 0) {
    overallStatus = 'degraded';
  }

  const totalCheckTimeMs = Date.now() - startTime;
  const timestamp = new Date().toISOString();

  return {
    status: overallStatus,
    timestamp,
    totalCheckTimeMs,
    services: {
      datadog,
      opentelemetry,
    },
    summary: {
      total: services.length,
      healthy,
      degraded,
      unhealthy,
    },
  };
}

/**
 * GET handler for monitoring health endpoint
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const requestId = randomUUID();
  const clientIp =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown';

  const logContext = {
    requestId,
    clientIp,
    path: '/api/health/monitoring',
  };

  // Rate limiting
  const rateLimitResult = await apiRateLimit(request);
  if (!rateLimitResult.success) {
    log.warn('Rate limit exceeded for monitoring health check', logContext);

    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
          'X-Request-Id': requestId,
        },
      }
    );
  }

  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const serviceParam = searchParams.get('service');

    // If requesting a specific monitoring service
    if (serviceParam) {
      const serviceName = serviceParam.toLowerCase() as MonitoringServiceName;

      // Validate service name
      if (serviceName !== 'datadog' && serviceName !== 'opentelemetry') {
        log.warn('Invalid monitoring service name requested', {
          ...logContext,
          requestedService: serviceParam,
        });

        return NextResponse.json(
          {
            error: 'Invalid service name',
            message: 'Valid services are: datadog, opentelemetry',
            requestId,
          },
          { status: 400 }
        );
      }

      log.info('Single monitoring service health check requested', {
        ...logContext,
        service: serviceName,
      });

      // Get single service health
      const serviceResult = serviceName === 'datadog'
        ? await getDatadogHealth()
        : await getOpenTelemetryHealth();

      const responseTime = Date.now() - startTime;

      return NextResponse.json(
        {
          ...serviceResult,
          requestId,
          responseTimeMs: responseTime,
        },
        {
          status: serviceResult.status === 'healthy' ? 200 : 503,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
            'X-Request-Id': requestId,
            'X-Response-Time': `${responseTime}ms`,
          },
        }
      );
    }

    // Get aggregated monitoring health
    log.info('Monitoring stack health check requested', logContext);

    const healthResult = await getAggregatedMonitoringHealth();
    const responseTime = Date.now() - startTime;

    log.info('Monitoring stack health check completed', {
      ...logContext,
      status: healthResult.status,
      totalCheckTimeMs: healthResult.totalCheckTimeMs,
      summary: healthResult.summary,
    });

    // Determine HTTP status based on overall health
    let httpStatus = 200;
    if (healthResult.status === 'unhealthy') {
      httpStatus = 503;
    } else if (healthResult.status === 'degraded') {
      httpStatus = 207; // Multi-Status - some services are unhealthy
    }

    return NextResponse.json(
      {
        ...healthResult,
        requestId,
        responseTimeMs: responseTime,
      },
      {
        status: httpStatus,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Request-Id': requestId,
          'X-Response-Time': `${responseTime}ms`,
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const responseTime = Date.now() - startTime;

    log.error('Monitoring stack health check failed', {
      ...logContext,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        status: 'unhealthy',
        error: 'Health check failed',
        message: process.env.NODE_ENV === 'development' ? errorMessage : 'Internal error',
        timestamp: new Date().toISOString(),
        requestId,
        responseTimeMs: responseTime,
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Request-Id': requestId,
          'X-Response-Time': `${responseTime}ms`,
        },
      }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  const requestOrigin = request.headers.get('origin');

  // Get allowed origins from environment or use defaults
  const allowedOrigins = (
    process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001'
  ).split(',');

  // Check if origin is allowed
  const isAllowedOrigin = requestOrigin && allowedOrigins.includes(requestOrigin);

  return NextResponse.json(
    {},
    {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': isAllowedOrigin ? requestOrigin : allowedOrigins[0],
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    }
  );
}
