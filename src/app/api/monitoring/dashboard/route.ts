/**
 * Monitoring Dashboard API Endpoint
 * Provides dashboard data for the monitoring page
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAPIRateLimit } from '@/lib/rate-limiting'
import { checkMonitoringAuth, getUnauthorizedResponse } from '@/lib/monitoring/auth'

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(120) // 120 requests per minute

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
    return NextResponse.json({
      systemMetrics: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        activeUsers: 0,
        requestsPerMinute: 0,
        activeConnections: 0,
        errorRate: 0,
        avgResponseTime: 0,
      },
      alerts: [],
      logs: [],
      traces: [],
      webVitals: {
        LCP: { value: 0, status: 'good' },
        FID: { value: 0, status: 'good' },
        CLS: { value: 0, status: 'good' },
      },
    })
  } catch (error) {
    console.error('Failed to fetch monitoring dashboard data', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch monitoring data',
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
