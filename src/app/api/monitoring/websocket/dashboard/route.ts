/**
 * WebSocket Monitoring Dashboard API
 * Provides real-time WebSocket metrics, alerts, and capacity planning
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkMonitoringAuth, getUnauthorizedResponse } from '../../../../../lib/monitoring/auth'
import { webSocketMonitor } from '../../../../../lib/monitoring/websocket-monitor'
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
    const poolName = searchParams.get('pool')
    const includeHistory = searchParams.get('history') === 'true'
    const historyLimit = parseInt(searchParams.get('limit') || '100')

    // Return specific pool data
    if (poolName) {
      const poolMetrics = webSocketMonitor.getPoolMetrics(poolName)
      if (!poolMetrics) {
        return NextResponse.json(
          { error: `Pool '${poolName}' not found` },
          { status: 404 }
        )
      }

      const response: any = {
        pool: poolMetrics,
        timestamp: new Date().toISOString()
      }

      if (includeHistory) {
        response.history = webSocketMonitor.getPoolHistory(poolName, historyLimit)
      }

      return NextResponse.json(response)
    }

    // Return dashboard overview
    const systemOverview = webSocketMonitor.getSystemOverview()
    const allPools = webSocketMonitor.getAllPoolMetrics()
    const activeAlerts = webSocketMonitor.getActiveAlerts()
    const capacityReports = webSocketMonitor.generateCapacityReport()

    const dashboardData = {
      overview: systemOverview,
      pools: allPools.map(pool => ({
        ...pool,
        alerts: activeAlerts.filter(alert => alert.pool_name === pool.pool_name)
      })),
      alerts: {
        active: activeAlerts,
        critical: activeAlerts.filter(a => a.severity === 'critical'),
        warning: activeAlerts.filter(a => a.severity === 'warning')
      },
      capacity_planning: capacityReports,
      recommendations: generateRecommendations(allPools, activeAlerts, capacityReports),
      timestamp: new Date().toISOString()
    }

    // Include history for critical pools if requested
    if (includeHistory) {
      const criticalPools = allPools.filter(p => p.health_status === 'critical')
      dashboardData.pools = dashboardData.pools.map(pool => {
        if (criticalPools.some(cp => cp.pool_name === pool.pool_name)) {
          return {
            ...pool,
            history: webSocketMonitor.getPoolHistory(pool.pool_name, historyLimit)
          }
        }
        return pool
      })
    }

    return NextResponse.json(dashboardData)

  } catch (error) {
    console.error('WebSocket dashboard error:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch WebSocket data',
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
function generateRecommendations(pools: any[], _alerts: any[], capacityReports: any[]) {
  const recommendations: Array<{
    type: 'scaling' | 'configuration' | 'alert' | 'performance'
    priority: 'high' | 'medium' | 'low'
    pool_name?: string
    message: string
    action: string
  }> = []

  // Check for pools with high utilization
  pools.forEach(pool => {
    if (pool.utilization_percent >= 80) {
      recommendations.push({
        type: 'scaling',
        priority: 'high',
        pool_name: pool.pool_name,
        message: `WebSocket pool '${pool.pool_name}' is ${pool.utilization_percent}% utilized`,
        action: `Consider increasing max_connections from ${pool.max_connections} to ${Math.ceil(pool.max_connections * 1.5)}`
      })
    }
  })

  // Check capacity reports for growth trends
  capacityReports.forEach(report => {
    if (report.growth_trend === 'increasing' && report.capacity_headroom < 30) {
      recommendations.push({
        type: 'scaling',
        priority: 'medium',
        pool_name: report.pool_name,
        message: `WebSocket pool '${report.pool_name}' shows increasing utilization trend with only ${report.capacity_headroom}% headroom`,
        action: `Recommended max connections: ${report.recommended_max_connections} (current: ${pools.find(p => p.pool_name === report.pool_name)?.max_connections})`
      })
    }

    if (report.projected_exhaustion_time && report.projected_exhaustion_time !== 'Insufficient data' && report.projected_exhaustion_time !== 'Not trending toward exhaustion') {
      recommendations.push({
        type: 'alert',
        priority: 'high',
        pool_name: report.pool_name,
        message: `WebSocket pool '${report.pool_name}' projected to exhaust in ${report.projected_exhaustion_time}`,
        action: 'Take immediate action to increase capacity or reduce load'
      })
    }
  })

  // Check for pools with high latency
  pools.forEach(pool => {
    if (pool.average_latency_ms > 1000) {
      recommendations.push({
        type: 'performance',
        priority: pool.average_latency_ms > 2000 ? 'high' : 'medium',
        pool_name: pool.pool_name,
        message: `WebSocket pool '${pool.pool_name}' has high average latency: ${pool.average_latency_ms}ms`,
        action: 'Check for network issues or consider optimizing message handling'
      })
    }
  })

  // Check for pools with high pending requests
  pools.forEach(pool => {
    if (pool.pending_requests > 10) {
      recommendations.push({
        type: 'performance',
        priority: pool.pending_requests > 25 ? 'high' : 'medium',
        pool_name: pool.pool_name,
        message: `WebSocket pool '${pool.pool_name}' has ${pool.pending_requests} pending requests`,
        action: 'Consider increasing pool capacity or investigating connection bottlenecks'
      })
    }
  })

  // Check for high failure rates
  pools.forEach(pool => {
    const failureRate = pool.total_connections > 0
      ? Math.round((pool.failed_connections / pool.total_connections) * 100)
      : 0

    if (failureRate > 5) {
      recommendations.push({
        type: 'alert',
        priority: failureRate > 10 ? 'high' : 'medium',
        pool_name: pool.pool_name,
        message: `WebSocket pool '${pool.pool_name}' has ${failureRate}% failure rate`,
        action: 'Investigate connection failures and check network stability'
      })
    }
  })

  return recommendations
}
