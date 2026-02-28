/**
 * Rate Limit Monitoring Dashboard API
 * Provides real-time rate limit metrics, alerts, and capacity planning
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkMonitoringAuth, getUnauthorizedResponse } from '../../../../../lib/monitoring/auth'
import { rateLimitMonitor } from '../../../../../lib/monitoring/rate-limit-monitor'
import { createAPIRateLimit } from '@/lib/rate-limiting'

const apiRateLimit = createAPIRateLimit(120) // 120 requests per minute - monitoring data
// import { logger } from '@/lib/logger';
// Force dynamic rendering
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

  // Check authentication
  const authResult = await checkMonitoringAuth(request)
  if (!authResult.isAuthorized) {
    return getUnauthorizedResponse(authResult.error)
  }

  try {
    const { searchParams } = new URL(request.url)
    const limiterName = searchParams.get('limiter')
    const includeHistory = searchParams.get('history') === 'true'
    const historyLimit = parseInt(searchParams.get('limit') || '100')

    // Return specific limiter data
    if (limiterName) {
      const limiterMetrics = rateLimitMonitor.getLimiterMetrics(limiterName)
      if (!limiterMetrics) {
        return NextResponse.json(
          { error: `Limiter '${limiterName}' not found` },
          { status: 404 }
        )
      }

      const response: any = {
        limiter: limiterMetrics,
        timestamp: new Date().toISOString()
      }

      if (includeHistory) {
        response.history = rateLimitMonitor.getLimiterHistory(limiterName, historyLimit)
      }

      return NextResponse.json(response)
    }

    // Return dashboard overview
    const systemOverview = rateLimitMonitor.getSystemOverview()
    const allLimiters = rateLimitMonitor.getAllLimiterMetrics()
    const activeAlerts = rateLimitMonitor.getActiveAlerts()
    const capacityReports = rateLimitMonitor.generateCapacityReport()

    const dashboardData = {
      overview: systemOverview,
      limiters: allLimiters.map(limiter => ({
        ...limiter,
        alerts: activeAlerts.filter(alert => alert.limiter_name === limiter.limiter_name)
      })),
      alerts: {
        active: activeAlerts,
        critical: activeAlerts.filter(a => a.severity === 'critical'),
        warning: activeAlerts.filter(a => a.severity === 'warning')
      },
      capacity_planning: capacityReports,
      recommendations: generateRecommendations(allLimiters, activeAlerts, capacityReports),
      timestamp: new Date().toISOString()
    }

    // Include history for critical limiters if requested
    if (includeHistory) {
      const criticalLimiters = allLimiters.filter(l => l.health_status === 'critical')
      dashboardData.limiters = dashboardData.limiters.map(limiter => {
        if (criticalLimiters.some(cl => cl.limiter_name === limiter.limiter_name)) {
          return {
            ...limiter,
            history: rateLimitMonitor.getLimiterHistory(limiter.limiter_name, historyLimit)
          }
        }
        return limiter
      })
    }

    return NextResponse.json(dashboardData)

  } catch (error) {
    console.error('Rate limit dashboard error:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch rate limit data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

/**
 * Generate actionable recommendations based on current state
 */
function generateRecommendations(limiters: any[], _alerts: any[], capacityReports: any[]) {
  const recommendations: Array<{
    type: 'scaling' | 'configuration' | 'alert' | 'performance'
    priority: 'high' | 'medium' | 'low'
    limiter_name?: string
    message: string
    action: string
  }> = []

  // Check for limiters with high utilization
  limiters.forEach(limiter => {
    if (limiter.utilization_percent >= 80) {
      recommendations.push({
        type: 'scaling',
        priority: 'high',
        limiter_name: limiter.limiter_name,
        message: `Limiter '${limiter.limiter_name}' is ${limiter.utilization_percent}% utilized`,
        action: `Consider increasing max_requests from ${limiter.max_requests} to ${Math.ceil(limiter.max_requests * 1.5)}`
      })
    }
  })

  // Check capacity reports for growth trends
  capacityReports.forEach(report => {
    if (report.growth_trend === 'increasing' && report.capacity_headroom < 30) {
      recommendations.push({
        type: 'scaling',
        priority: 'medium',
        limiter_name: report.limiter_name,
        message: `Limiter '${report.limiter_name}' shows increasing utilization trend with only ${report.capacity_headroom}% headroom`,
        action: `Recommended max requests: ${report.recommended_max_requests} (current: ${limiters.find(l => l.limiter_name === report.limiter_name)?.max_requests})`
      })
    }

    if (report.projected_limit_time && report.projected_limit_time !== 'Insufficient data' && report.projected_limit_time !== 'Not trending toward limit') {
      recommendations.push({
        type: 'alert',
        priority: 'high',
        limiter_name: report.limiter_name,
        message: `Limiter '${report.limiter_name}' projected to hit limit in ${report.projected_limit_time}`,
        action: 'Take immediate action to increase capacity or reduce load'
      })
    }
  })

  // Check for limiters with high rejection rates
  limiters.forEach(limiter => {
    const totalRequests = limiter.accepted_requests + limiter.rejected_requests
    const rejectionRate = totalRequests > 0
      ? Math.round((limiter.rejected_requests / totalRequests) * 100)
      : 0

    if (rejectionRate > 15) {
      recommendations.push({
        type: 'performance',
        priority: rejectionRate > 30 ? 'high' : 'medium',
        limiter_name: limiter.limiter_name,
        message: `Limiter '${limiter.limiter_name}' has high rejection rate: ${rejectionRate}%`,
        action: 'Consider increasing rate limits or implementing request queuing'
      })
    }
  })

  // Check for configuration issues
  limiters.forEach(limiter => {
    if (limiter.max_requests < 10) {
      recommendations.push({
        type: 'configuration',
        priority: 'low',
        limiter_name: limiter.limiter_name,
        message: `Limiter '${limiter.limiter_name}' has very low max_requests: ${limiter.max_requests}`,
        action: 'Verify if this is intentional; consider increasing for better throughput'
      })
    }

    if (limiter.window_size_ms < 1000) {
      recommendations.push({
        type: 'configuration',
        priority: 'low',
        limiter_name: limiter.limiter_name,
        message: `Limiter '${limiter.limiter_name}' has very short window: ${limiter.window_size_ms}ms`,
        action: 'Short windows may cause excessive overhead; consider longer windows'
      })
    }
  })

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return recommendations
}
