/**
 * @description Connection Pool Monitoring Dashboard API - Provides comprehensive real-time metrics, alerts, capacity planning, and actionable recommendations for database connection pools. Supports per-pool detailed views and historical data.
 * @route GET /api/monitoring/connection-pool/dashboard
 * @route POST /api/monitoring/connection-pool/dashboard
 * @access Private (requires monitoring authentication)
 *
 * @param {NextRequest} request - Next.js request with query parameters:
 *   - pool: string - Specific pool name for detailed view (optional)
 *   - history: 'true' | 'false' - Include historical data (default: false)
 *   - limit: number - History data limit (default: 100)
 *
 * @returns {Response} GET returns dashboard overview or specific pool data:
 *   - overview: { total_pools, healthy_pools, warning_pools, critical_pools } - System overview
 *   - pools: Array<PoolMetrics> - All pool metrics with alerts
 *   - alerts: { active, critical, warning } - Alert summary
 *   - capacity_planning: Array<CapacityReport> - Growth trends and projections
 *   - recommendations: Array<{ type, priority, pool_name, message, action }> - Optimization recommendations
 *   - timestamp: string - Current timestamp
 *
 * @returns {Response} POST updates pool metrics with body:
 *   - pool_name: string - Pool identifier
 *   - metrics: PoolMetrics - Pool metrics to update
 *
 * @example
 * // GET Request - Dashboard overview
 * GET /api/monitoring/connection-pool/dashboard
 * Headers: { Authorization: "Bearer <token>" }
 *
 * // Response
 * {
 *   "overview": {
 *     "total_pools": 5,
 *     "healthy_pools": 3,
 *     "warning_pools": 2,
 *     "critical_pools": 0
 *   },
 *   "pools": [
 *     {
 *       "pool_name": "main-db",
 *       "active_connections": 15,
 *       "idle_connections": 5,
 *       "total_connections": 20,
 *       "max_connections": 50,
 *       "utilization_percent": 40,
 *       "health_status": "healthy",
 *       "alerts": []
 *     }
 *   ],
 *   "alerts": { "active": [...], "critical": [], "warning": [...] },
 *   "capacity_planning": [...],
 *   "recommendations": [
 *     {
 *       "type": "scaling",
 *       "priority": "medium",
 *       "pool_name": "cache-pool",
 *       "message": "Pool shows increasing utilization trend",
 *       "action": "Consider increasing max connections from 20 to 30"
 *     }
 *   ]
 * }
 *
 * // GET Request - Specific pool with history
 * GET /api/monitoring/connection-pool/dashboard?pool=main-db&history=true&limit=50
 *
 * // Response
 * {
 *   "pool": { "pool_name": "main-db", ... },
 *   "history": [...]
 * }
 *
 * // POST Request - Update pool metrics
 * POST /api/monitoring/connection-pool/dashboard
 * {
 *   "pool_name": "new-pool",
 *   "metrics": {
 *     "active_connections": 5,
 *     "max_connections": 20
 *   }
 * }
 *
 * // Response
 * {
 *   "success": true,
 *   "message": "Pool 'new-pool' metrics updated"
 * }
 *
 * @throws {401} Unauthorized - Missing or invalid monitoring authentication
 * @throws {400} Invalid request - Missing required fields (pool_name, metrics)
 * @throws {404} Pool not found - Requested pool does not exist
 * @throws {500} Internal server error - Failed to fetch or update connection pool data
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkMonitoringAuth, getUnauthorizedResponse } from '../../../../../lib/monitoring/auth'
import { connectionPoolMonitor } from '../../../../../lib/monitoring/connection-pool-monitor'

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