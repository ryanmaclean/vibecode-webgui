/**
 * Dashboard Overview API Endpoint
 * Provides a simplified, aggregated view of system health and performance
 *
 * Foundation for Enhanced Monitoring Dashboards feature (AGENT 92)
 * Protected with admin-only authentication (hq-018)
 */

import { NextRequest, NextResponse } from 'next/server'
import { monitoring } from '@/lib/monitoring'
import { checkDashboardAuth, getDashboardUnauthorizedResponse } from '@/lib/monitoring/auth'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface DashboardOverview {
  timestamp: string
  health: {
    database: 'healthy' | 'warning' | 'error'
    cache: 'healthy' | 'warning' | 'error'
    ai: 'healthy' | 'warning' | 'error'
    overall: 'healthy' | 'warning' | 'error'
  }
  performance: {
    avgResponseTime: number
    requestsPerMinute: number
  }
  system: {
    uptime: number
    uptimeFormatted: string
    memory: {
      used: number
      total: number
      percentage: number
    }
  }
}

export async function GET(request: NextRequest) {
  // Check admin authentication
  const authResult = await checkDashboardAuth(request)
  if (!authResult.isAuthorized) {
    return getDashboardUnauthorizedResponse(authResult.error)
  }

  const startTime = Date.now()

  try {
    // Parallel execution of health checks
    const [dbHealth, cacheHealth, aiHealth] = await Promise.allSettled([
      monitoring.checkDatabase(),
      monitoring.checkValkey(),
      monitoring.checkAIService()
    ])

    // Extract statuses with error handling
    const dbStatus = dbHealth.status === 'fulfilled' ? dbHealth.value?.status || 'error' : 'error'
    const cacheStatus = cacheHealth.status === 'fulfilled' ? cacheHealth.value?.status || 'error' : 'error'
    const aiStatus = aiHealth.status === 'fulfilled' ? aiHealth.value?.status || 'error' : 'error'

    // Calculate overall health
    const statuses = [dbStatus, cacheStatus, aiStatus]
    let overallStatus: 'healthy' | 'warning' | 'error' = 'healthy'
    if (statuses.some(s => s === 'error')) {
      overallStatus = 'error'
    } else if (statuses.some(s => s === 'warning')) {
      overallStatus = 'warning'
    }

    // Get memory usage
    const memUsage = process.memoryUsage()
    const memoryUsed = Math.round(memUsage.heapUsed / 1024 / 1024) // MB
    const memoryTotal = Math.round(memUsage.heapTotal / 1024 / 1024) // MB
    const memoryPercentage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)

    // Format uptime
    const uptimeSeconds = Math.floor(process.uptime())
    const uptimeFormatted = formatUptime(uptimeSeconds)

    // Mock performance metrics (in production, would come from metrics store)
    const responseTime = Date.now() - startTime
    const avgResponseTime = Math.round(responseTime * 1.5) // Approximate average
    const requestsPerMinute = 50 // Mock value

    const overview: DashboardOverview = {
      timestamp: new Date().toISOString(),
      health: {
        database: dbStatus as 'healthy' | 'warning' | 'error',
        cache: cacheStatus as 'healthy' | 'warning' | 'error',
        ai: aiStatus as 'healthy' | 'warning' | 'error',
        overall: overallStatus
      },
      performance: {
        avgResponseTime,
        requestsPerMinute
      },
      system: {
        uptime: uptimeSeconds,
        uptimeFormatted,
        memory: {
          used: memoryUsed,
          total: memoryTotal,
          percentage: memoryPercentage
        }
      }
    }

    return NextResponse.json(overview, { status: 200 })

  } catch (error) {
    console.error('Dashboard overview API error:', error)

    return NextResponse.json({
      error: 'Failed to fetch dashboard overview',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Helper function to format uptime
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else {
    return `${minutes}m`
  }
}
