/**
 * API Performance Monitoring Route
 * Provides endpoint latency, throughput, and error tracking data.
 *
 * Currently returns empty arrays — will be wired to a real metrics
 * source (e.g. Prometheus, OpenTelemetry, or database) in the future.
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkMonitoringAuth, getUnauthorizedResponse } from '@/lib/monitoring/auth'
import { createAPIRateLimit } from '@/lib/rate-limiting'

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(120) // 120 requests per minute

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

/** Endpoint performance row — keep in sync with the page's EndpointRow type. */
export interface EndpointRowResponse {
  endpoint: string
  method: HttpMethod
  avgLatency: number
  p50: number
  p95: number
  p99: number
  reqPerMin: number
  errorRate: number
}

/** Error endpoint entry — keep in sync with the page's ErrorEndpoint type. */
export interface ErrorEndpointResponse {
  endpoint: string
  method: HttpMethod
  count: number
  lastSeen: string
}

export interface APIPerformanceResponse {
  endpoints: EndpointRowResponse[]
  errors4xx: ErrorEndpointResponse[]
  errors5xx: ErrorEndpointResponse[]
}

/**
 * GET /api/monitoring/api-performance
 *
 * Query params (all optional, for future use):
 *   range — time range filter (1h, 6h, 24h, 7d)
 */
export async function GET(request: NextRequest) {
  const authResult = await checkMonitoringAuth(request)
  if (!authResult.isAuthorized) {
    return getUnauthorizedResponse(authResult.error)
  }

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
    // TODO: Wire to a real metrics source (Prometheus, OpenTelemetry, database).
    // For now return empty arrays — no mock data.
    const endpoints: EndpointRowResponse[] = []
    const errors4xx: ErrorEndpointResponse[] = []
    const errors5xx: ErrorEndpointResponse[] = []

    return NextResponse.json(
      { endpoints, errors4xx, errors5xx } satisfies APIPerformanceResponse,
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message, endpoints: [], errors4xx: [], errors5xx: [] },
      { status: 500 }
    )
  }
}
