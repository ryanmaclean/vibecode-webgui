/**
 * Unified Health Services API Endpoint
 *
 * Returns aggregated health status for all 5 services in the stack:
 * - SSH (Dropbear)
 * - PostgreSQL
 * - Valkey/Redis
 * - OpenVSCode
 * - Docker
 *
 * Features:
 * - 5-second caching to prevent rapid polling
 * - Parallel health check execution
 * - Datadog tracing integration
 * - Detailed per-service status with latency
 *
 * GET /api/health/services - Returns aggregated health status
 * GET /api/health/services?service=postgresql - Returns single service health
 * GET /api/health/services?fresh=true - Force fresh check (bypass cache)
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import {
  getCachedHealthChecks,
  invalidateHealthCache,
  getServiceHealth,
} from '@/lib/health/unified-health-service';
import type { ServiceName, ServiceHealthResult } from '@/types/health';
import { createServiceLogger } from '@/lib/logging';

export const dynamic = 'force-dynamic'

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'health-services-api',
});

// Valid service names for query parameter validation
const VALID_SERVICES: ServiceName[] = ['ssh', 'postgresql', 'valkey', 'openvscode', 'docker'];

/**
 * GET handler for health services endpoint
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = randomUUID();
  const clientIp =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown';

  const logContext = {
    requestId,
    clientIp,
    path: '/api/health/services',
  };

  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const serviceParam = searchParams.get('service');
    const freshParam = searchParams.get('fresh');
    const forceFresh = freshParam === 'true' || freshParam === '1';

    // If requesting a specific service
    if (serviceParam) {
      const serviceName = serviceParam.toLowerCase() as ServiceName;

      // Validate service name
      if (!VALID_SERVICES.includes(serviceName)) {
        log.warn('Invalid service name requested', {
          ...logContext,
          requestedService: serviceParam,
        });

        return NextResponse.json(
          {
            error: 'Invalid service name',
            message: `Valid services are: ${VALID_SERVICES.join(', ')}`,
            requestId,
          },
          { status: 400 }
        );
      }

      // Get single service health
      log.info('Single service health check requested', {
        ...logContext,
        service: serviceName,
      });

      const serviceResult: ServiceHealthResult = await getServiceHealth(serviceName);
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

    // Force fresh check if requested
    if (forceFresh) {
      log.info('Forcing fresh health check (cache invalidated)', logContext);
      invalidateHealthCache();
    }

    // Get cached or fresh aggregated health checks
    const cachedResponse = await getCachedHealthChecks();
    const responseTime = Date.now() - startTime;

    log.info('Health services check completed', {
      ...logContext,
      status: cachedResponse.response.status,
      fromCache: cachedResponse.fromCache,
      totalCheckTimeMs: cachedResponse.response.totalCheckTimeMs,
      healthySummary: cachedResponse.response.summary,
    });

    // Determine HTTP status based on overall health
    let httpStatus = 200;
    if (cachedResponse.response.status === 'unhealthy') {
      httpStatus = 503;
    } else if (cachedResponse.response.status === 'degraded') {
      httpStatus = 207; // Multi-Status - some services are unhealthy
    }

    return NextResponse.json(
      {
        ...cachedResponse.response,
        cache: {
          fromCache: cachedResponse.fromCache,
          cachedAt: cachedResponse.cachedAt,
          ttlMs: cachedResponse.ttlMs,
        },
        requestId,
        responseTimeMs: responseTime,
      },
      {
        status: httpStatus,
        headers: {
          'Cache-Control': cachedResponse.fromCache
            ? `public, max-age=${Math.floor(cachedResponse.ttlMs / 1000)}`
            : 'no-store, max-age=0',
          'X-Request-Id': requestId,
          'X-Response-Time': `${responseTime}ms`,
          'X-Cache-Status': cachedResponse.fromCache ? 'HIT' : 'MISS',
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const responseTime = Date.now() - startTime;

    log.error('Health services check failed', {
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
    process.env.ALLOWED_ORIGINS ||
    'https://vibecode.dev,http://localhost:3000,http://localhost:8080'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Validate origin
  const validatedOrigin =
    requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : null;

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '3600',
  };

  if (validatedOrigin) {
    headers['Access-Control-Allow-Origin'] = validatedOrigin;
    headers['Vary'] = 'Origin';
  }

  return new NextResponse(null, {
    status: 200,
    headers,
  });
}

/**
 * HEAD handler for simple health probes
 */
export async function HEAD() {
  try {
    const cachedResponse = await getCachedHealthChecks();

    // Return appropriate status without body
    let httpStatus = 200;
    if (cachedResponse.response.status === 'unhealthy') {
      httpStatus = 503;
    } else if (cachedResponse.response.status === 'degraded') {
      httpStatus = 207;
    }

    return new NextResponse(null, {
      status: httpStatus,
      headers: {
        'X-Health-Status': cachedResponse.response.status,
        'X-Cache-Status': cachedResponse.fromCache ? 'HIT' : 'MISS',
      },
    });
  } catch {
    return new NextResponse(null, {
      status: 503,
      headers: {
        'X-Health-Status': 'unhealthy',
      },
    });
  }
}
