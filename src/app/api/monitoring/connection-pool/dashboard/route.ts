/**
 * Connection Pool Monitoring Dashboard API
 * Provides real-time connection pool metrics, alerts, and capacity planning
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkMonitoringAuth, getUnauthorizedResponse } from '../../../../../lib/monitoring/auth'
import { connectionPoolMonitor } from '../../../../../lib/monitoring/connection-pool-monitor'
// import { logger } from '@/lib/logger';
// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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
      const poolMetrics = connectionPoolMonitor.getPoolMetrics(poolName)
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
        response.history = connectionPoolMonitor.getPoolHistory(poolName, historyLimit)
      }

      return NextResponse.json(response)
    }

    // Return dashboard overview
    const systemOverview = connectionPoolMonitor.getSystemOverview()
    const allPools = connectionPoolMonitor.getAllPoolMetrics()
    const activeAlerts = connectionPoolMonitor.getActiveAlerts()
    const capacityReports = connectionPoolMonitor.generateCapacityReport()

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
            history: connectionPoolMonitor.getPoolHistory(pool.pool_name, historyLimit)
          }
        }
        return pool
      })
    }

    return NextResponse.json(dashboardData)

  } catch (error) {
    console.error('Connection pool dashboard error:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to fetch connection pool data',
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
        message: `Pool '${pool.pool_name}' is ${pool.utilization_percent}% utilized`,
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
        message: `Pool '${report.pool_name}' shows increasing utilization trend with only ${report.capacity_headroom}% headroom`,
        action: `Recommended max connections: ${report.recommended_max_connections} (current: ${pools.find(p => p.pool_name === report.pool_name)?.max_connections})`
      })
    }

    if (report.projected_exhaustion_time && report.projected_exhaustion_time !== 'Insufficient data') {
      recommendations.push({
        type: 'alert',
        priority: 'high',
        pool_name: report.pool_name,
        message: `Pool '${report.pool_name}' projected to exhaust in ${report.projected_exhaustion_time}`,
        action: 'Take immediate action to increase capacity or reduce load'
      })
    }
  })

  // Check for pools with high wait times
  pools.forEach(pool => {
    if (pool.average_wait_time_ms > 1000) {
      recommendations.push({
        type: 'performance',
        priority: pool.average_wait_time_ms > 5000 ? 'high' : 'medium',
        pool_name: pool.pool_name,
        message: `Pool '${pool.pool_name}' has high average wait time: ${pool.average_wait_time_ms}ms`,
        action: 'Check for connection leaks or consider increasing pool size'
      })
    }
  })

  // Check for configuration issues
  pools.forEach(pool => {
    if (pool.min_connections === 0) {
      recommendations.push({
        type: 'configuration',
        priority: 'low',
        pool_name: pool.pool_name,
        message: `Pool '${pool.pool_name}' has min_connections set to 0`,
        action: 'Consider setting min_connections to 1-2 to avoid cold start delays'
      })
    }

    if (pool.max_connections - pool.min_connections < 2) {
      recommendations.push({
        type: 'configuration',
        priority: 'low',
        pool_name: pool.pool_name,
        message: `Pool '${pool.pool_name}' has very small scaling range`,
        action: 'Consider increasing the difference between min and max connections'
      })
    }
  })

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return recommendations.slice(0, 10) // Return top 10 recommendations
}

/**
 * POST - Update pool metrics (for external pool integrations)
 */
export async function POST(request: NextRequest) {
  const authResult = await checkMonitoringAuth(request)
  if (!authResult.isAuthorized) {
    return getUnauthorizedResponse(authResult.error)
  }

  try {
    const body = await request.json()
    const { pool_name, metrics } = body

    if (!pool_name || !metrics) {
      return NextResponse.json(
        { error: 'Missing required fields: pool_name and metrics' },
        { status: 400 }
      )
    }

    // Register pool if it doesn't exist
    if (!connectionPoolMonitor.getPoolMetrics(pool_name)) {
      connectionPoolMonitor.registerPool(pool_name, metrics)
    } else {
      connectionPoolMonitor.updatePoolMetrics(pool_name, metrics)
    }

    return NextResponse.json({
      success: true,
      message: `Pool '${pool_name}' metrics updated`,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Failed to update pool metrics:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to update pool metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}