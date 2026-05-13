/**
 * Monitoring Logs API Route
 * Provides application log entries for the monitoring logs viewer.
 *
 * Currently returns an empty array — will be wired to a real log source
 * (e.g. file tail, database, or external logging service) in the future.
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkMonitoringAuth, getUnauthorizedResponse } from '@/lib/monitoring/auth'
import { createAPIRateLimit } from '@/lib/rate-limiting'

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(120) // 120 requests per minute

/** Shape returned to the client — keep in sync with the page's LogEntry type. */
export interface LogEntryResponse {
  id: string
  timestamp: string
  level: 'error' | 'warn' | 'info' | 'debug'
  source: 'API' | 'WebSocket' | 'Health' | 'AI' | 'VM' | 'Auth' | 'Scheduler'
  message: string
  details?: string
}

/**
 * GET /api/monitoring/logs
 *
 * Query params (all optional, for future use):
 *   level  — filter by log level
 *   source — filter by source
 *   q      — search string
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
    // TODO: Wire to a real log source (file, database, external service).
    // For now return an empty array — no mock data.
    const logs: LogEntryResponse[] = []

    return NextResponse.json({ logs }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message, logs: [] }, { status: 500 })
  }
}
