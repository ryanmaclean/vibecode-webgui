/**
 * Monitoring Alerts API Route
 * Provides alert entries and alert rules for the monitoring alerts page.
 *
 * Currently returns empty arrays — will be wired to a real alert source
 * (e.g. database, external alerting service) in the future.
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkMonitoringAuth, getUnauthorizedResponse } from '@/lib/monitoring/auth'
import { createAPIRateLimit } from '@/lib/rate-limiting'

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(120) // 120 requests per minute

// ── Types ─────────────────────────────────────────────────────────────────

type Severity = 'critical' | 'warning' | 'info'
type AlertStatus = 'active' | 'acknowledged' | 'resolved'

/** Shape returned to the client — keep in sync with the page's Alert type. */
export interface AlertResponse {
  id: string
  title: string
  message: string
  severity: Severity
  status: AlertStatus
  source: string
  triggeredAt: string
  acknowledgedAt?: string
  resolvedAt?: string
  rule: string
}

/** Shape returned to the client — keep in sync with the page's AlertRule type. */
export interface AlertRuleResponse {
  id: string
  name: string
  description: string
  severity: Severity
  enabled: boolean
  condition: string
  category: 'service' | 'budget' | 'performance' | 'resource'
}

/**
 * GET /api/monitoring/alerts
 *
 * Returns { alerts: AlertResponse[], rules: AlertRuleResponse[] }
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
    // TODO: Wire to a real alert source (database, external service).
    // For now return empty arrays — no mock data.
    const alerts: AlertResponse[] = []
    const rules: AlertRuleResponse[] = []

    return NextResponse.json({ alerts, rules }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message, alerts: [], rules: [] }, { status: 500 })
  }
}
