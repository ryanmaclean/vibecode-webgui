/**
 * Unified Health API Endpoint
 *
 * Aggregates health status from all services:
 * - Base services (SSH, PostgreSQL, Valkey, OpenVSCode, Docker)
 * - AI Providers (OpenAI, Anthropic, Azure OpenAI)
 * - Docker daemon and containers
 * - Kubernetes cluster (when available)
 * - Monitoring stack (Datadog, OpenTelemetry)
 *
 * GET /api/health/unified - Returns unified health status
 * GET /api/health/unified?fresh=true - Force fresh check (bypass cache)
 *
 * This endpoint does not require authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getUnifiedHealth } from '@/lib/health/multi-service-health';
import { createServiceLogger } from '@/lib/logging';

export const dynamic = 'force-dynamic';

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'health-unified-api',
});

/**
 * GET handler for unified health endpoint
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
    path: '/api/health/unified',
  };

  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const freshParam = searchParams.get('fresh');
    const useCache = freshParam !== 'true' && freshParam !== '1';

    log.info('Unified health check requested', {
      ...logContext,
      useCache,
    });

    // Call getUnifiedHealth with cache preference
    const healthData = await getUnifiedHealth({ useCache });
    const responseTime = Date.now() - startTime;

    log.info('Unified health check completed', {
      ...logContext,
      status: healthData.status,
      fromCache: healthData.fromCache,
      totalCheckTimeMs: healthData.totalCheckTimeMs,
      summary: healthData.summary,
    });

    // Determine HTTP status based on overall health
    let httpStatus = 200;
    if (healthData.status === 'unhealthy') {
      httpStatus = 503;
    } else if (healthData.status === 'degraded') {
      httpStatus = 207; // Multi-Status - some services are unhealthy
    }

    return NextResponse.json(
      {
        ...healthData,
        requestId,
        responseTimeMs: responseTime,
      },
      {
        status: httpStatus,
        headers: {
          'Cache-Control': healthData.fromCache
            ? `public, max-age=${Math.floor((healthData.cacheTtlMs ?? 0) / 1000)}`
            : 'no-store, max-age=0',
          'X-Request-Id': requestId,
          'X-Response-Time': `${responseTime}ms`,
          'X-Cache-Status': healthData.fromCache ? 'HIT' : 'MISS',
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const responseTime = Date.now() - startTime;

    log.error('Unified health check failed', {
      ...logContext,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        status: 'unhealthy',
        error: 'Unified health check failed',
        message:
          process.env.NODE_ENV === 'development' ? errorMessage : 'Internal error',
        timestamp: new Date().toISOString(),
        requestId,
        responseTimeMs: responseTime,
      },
      {
        status: 500,
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
    'Access-Control-Allow-Headers': 'Content-Type',
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
    const healthData = await getUnifiedHealth({ useCache: true });

    let httpStatus = 200;
    if (healthData.status === 'unhealthy') {
      httpStatus = 503;
    } else if (healthData.status === 'degraded') {
      httpStatus = 207;
    }

    return new NextResponse(null, {
      status: httpStatus,
      headers: {
        'X-Health-Status': healthData.status,
        'X-Cache-Status': healthData.fromCache ? 'HIT' : 'MISS',
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
