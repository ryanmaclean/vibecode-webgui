/**
 * Monitoring Datadog API Route
 * Provides service, monitor, and configuration data for the Datadog integration page.
 *
 * Currently returns empty arrays — will be wired to real Datadog APIs
 * (e.g. DD API for services/monitors, env vars from config) in the future.
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkMonitoringAuth, getUnauthorizedResponse } from '@/lib/monitoring/auth'
import { createAPIRateLimit } from '@/lib/rate-limiting'

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(120) // 120 requests per minute

/** Keep in sync with the page's ServiceRow type. */
export interface ServiceRowResponse {
  name: string
  environment: string
  tracesPerMin: number
  errorRate: number
  p95Latency: number
  status: 'healthy' | 'degraded' | 'down'
}

/** Keep in sync with the page's Monitor type. */
export interface MonitorResponse {
  id: string
  name: string
  type: 'metric' | 'service' | 'log'
  status: 'OK' | 'Alert' | 'Warn'
  lastTriggered: string
}

/** Keep in sync with the page's EnvVar type. */
export interface EnvVarResponse {
  key: string
  value: string
  description: string
}

type Section = 'services' | 'monitors' | 'config'

const VALID_SECTIONS: Section[] = ['services', 'monitors', 'config']

/**
 * GET /api/monitoring/datadog
 *
 * Query params:
 *   section — one of "services", "monitors", "config" (required)
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

  const { searchParams } = new URL(request.url)
  const section = searchParams.get('section') as Section | null

  if (!section || !VALID_SECTIONS.includes(section)) {
    return NextResponse.json(
      { error: `Invalid or missing "section" param. Must be one of: ${VALID_SECTIONS.join(', ')}` },
      { status: 400 }
    )
  }

  try {
    switch (section) {
      case 'services': {
        // TODO: Wire to real Datadog APM service catalog API.
        const services: ServiceRowResponse[] = []
        return NextResponse.json({ services }, { status: 200 })
      }
      case 'monitors': {
        // TODO: Wire to real Datadog Monitors API.
        const monitors: MonitorResponse[] = []
        return NextResponse.json({ monitors }, { status: 200 })
      }
      case 'config': {
        // TODO: Wire to real environment/config source.
        const config: EnvVarResponse[] = []
        return NextResponse.json({ config }, { status: 200 })
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
