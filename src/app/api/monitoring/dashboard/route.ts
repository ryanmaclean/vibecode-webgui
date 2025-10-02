/**
 * @description Monitoring Dashboard API - Provides comprehensive system monitoring dashboard with health checks, system metrics, terminal sessions, and configuration status. Central endpoint for operations monitoring.
 * @route GET /api/monitoring/dashboard
 * @access Private (requires monitoring authentication)
 *
 * @param {NextRequest} request - Next.js request with query parameters:
 *   - timeframe: '15m' | '1h' | '24h' - Time range for metrics (default: '1h')
 *   - logs: 'true' | 'false' - Include recent activity logs (default: false, dev only)
 *
 * @returns {Response} Returns comprehensive dashboard data:
 *   - timestamp: string - Current timestamp
 *   - timeframe: string - Selected timeframe
 *   - health: { database, redis, aiService, overall } - Health check results
 *   - system: { memory, uptime, node_version, platform } - System metrics
 *   - sessions: { active, details } - Terminal session information
 *   - monitoring: { datadog_configured, service, env, version } - Monitoring configuration
 *   - activity: { recent_commands, recent_ai_requests, alerts_triggered } - Recent activity
 *
 * @example
 * // GET Request - Dashboard overview
 * GET /api/monitoring/dashboard?timeframe=1h
 * Headers: { Authorization: "Bearer <token>" }
 *
 * // Response
 * {
 *   "timestamp": "2025-10-01T00:00:00.000Z",
 *   "timeframe": "1h",
 *   "health": {
 *     "database": { "status": "healthy", "responseTime": 45 },
 *     "redis": { "status": "healthy", "connected": true },
 *     "aiService": { "status": "healthy", "latency": 250 },
 *     "overall": "healthy"
 *   },
 *   "system": {
 *     "memory": { "used": 512, "total": 2048, "usage_percent": 25 },
 *     "uptime": { "seconds": 86400, "human": "1d 0h 0m" },
 *     "node_version": "v20.9.0",
 *     "platform": "linux"
 *   },
 *   "sessions": {
 *     "active": 3,
 *     "details": [...]
 *   },
 *   "monitoring": {
 *     "datadog_configured": true,
 *     "service": "vibecode-webgui",
 *     "env": "production"
 *   }
 * }
 *
 * @throws {401} Unauthorized - Missing or invalid monitoring authentication
 * @throws {500} Internal server error - Failed to fetch monitoring data
 */

import { NextRequest, NextResponse } from 'next/server'
import { monitoring } from '../../../../lib/monitoring'
import { datadogMonitoring } from '../../../../lib/monitoring/enhanced-datadog-integration'
import { getServiceEnvVersion } from '../../../../lib/monitoring/datadog-env'
import { checkMonitoringAuth, getUnauthorizedResponse } from '../../../../lib/monitoring/auth'

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Check authentication first
  const authResult = await checkMonitoringAuth(request)
  if (!authResult.isAuthorized) {
    return getUnauthorizedResponse(authResult.error)
  }
  try {
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || '1h'
    const includeLogs = searchParams.get('logs') === 'true'

    // Get real-time system health
    const [dbHealth, redisHealth, aiHealth] = await Promise.allSettled([
      monitoring.checkDatabase(),
      monitoring.checkValkey(), 
      monitoring.checkAIService()
    ])

    // Get enhanced monitoring data
    const dashboardData = datadogMonitoring.getDashboardData()

    // Build response with comprehensive monitoring data
    const response = {
      timestamp: new Date().toISOString(),
      timeframe,
      
      // System Health
      health: {
        database: dbHealth.status === 'fulfilled' ? dbHealth.value : { status: 'error', error: 'Health check failed' },
        redis: redisHealth.status === 'fulfilled' ? redisHealth.value : { status: 'error', error: 'Health check failed' },
        aiService: aiHealth.status === 'fulfilled' ? aiHealth.value : { status: 'error', error: 'Health check failed' },
        overall: calculateOverallHealth([
          dbHealth.status === 'fulfilled' ? dbHealth.value.status : 'error',
          redisHealth.status === 'fulfilled' ? redisHealth.value.status : 'error',
          aiHealth.status === 'fulfilled' ? aiHealth.value.status : 'error'
        ])
      },

      // System Metrics
      system: {
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024), // MB
          external: Math.round(process.memoryUsage().external / 1024 / 1024), // MB
          usage_percent: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)
        },
        uptime: {
          seconds: Math.floor(process.uptime()),
          human: formatUptime(process.uptime())
        },
        node_version: process.version,
        platform: process.platform
      },

      // Terminal Sessions
      sessions: {
        active: dashboardData.totalActiveSessions,
        details: dashboardData.activeSessions.map(session => ({
          sessionId: session.sessionId.substring(0, 8) + '...', // Truncate for privacy
          duration_minutes: Math.round(session.duration / 60000),
          commands: session.commandCount,
          ai_usage: session.aiUsageCount,
          last_activity_seconds: Math.round(session.lastActivity / 1000)
        }))
      },

      // Configuration Status
      monitoring: {
        datadog_configured: monitoring.isConfigured(),
        ...getServiceEnvVersion(),
      },

      // Recent Activity (placeholder for future implementation)
      activity: {
        recent_commands: [] as Array<{ timestamp: string; command: string; session: string }>,
        recent_ai_requests: [] as Array<Record<string, unknown>>,
        alerts_triggered: [] as Array<Record<string, unknown>>,
      }
    }

    // Include logs if requested (be careful with sensitive data)
    if (includeLogs && process.env.NODE_ENV === 'development') {
      response.activity.recent_commands = [
        { timestamp: new Date().toISOString(), command: 'ls -la', session: 'demo-session' },
        { timestamp: new Date().toISOString(), command: 'git status', session: 'demo-session' }
      ]
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Dashboard API error:', error)
    
    return NextResponse.json({
      error: 'Failed to fetch monitoring data',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Helper function to calculate overall health
function calculateOverallHealth(statuses: string[]): 'healthy' | 'warning' | 'error' {
  if (statuses.some(status => status === 'error')) return 'error'
  if (statuses.some(status => status === 'warning')) return 'warning'
  return 'healthy'
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