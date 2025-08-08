/**
 * API endpoint for monitoring dashboard data
 * Provides real-time metrics and health information
 */

import { NextRequest, NextResponse } from 'next/server'
import { monitoring } from '../../../../lib/monitoring'
import { datadogMonitoring } from '../../../../lib/monitoring/enhanced-datadog-integration'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || '1h'
    const includeLogs = searchParams.get('logs') === 'true'

    // Get real-time system health
    const [dbHealth, redisHealth, aiHealth] = await Promise.allSettled([
      monitoring.checkDatabase(),
      monitoring.checkRedis(), 
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
        environment: process.env.NODE_ENV || 'development',
        service: process.env.DATADOG_SERVICE || 'vibecode-webgui',
        version: process.env.npm_package_version || '1.0.0'
      },

      // Recent Activity (placeholder for future implementation)
      activity: {
        recent_commands: [], // Will be populated from monitoring data
        recent_ai_requests: [], // Will be populated from monitoring data
        alerts_triggered: [] // Will be populated from Datadog API
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