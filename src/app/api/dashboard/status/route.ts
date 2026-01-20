/**
 * Dashboard System Status API Endpoint
 * Provides system status, version, and deployment information
 *
 * Foundation for Enhanced Monitoring Dashboards feature (AGENT 92)
 * Protected with admin-only authentication (hq-018)
 */

import { NextRequest, NextResponse } from 'next/server'
import os from 'os'
import { checkDashboardAuth, getDashboardUnauthorizedResponse } from '@/lib/monitoring/auth'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface SystemStatus {
  timestamp: string
  version: {
    app: string
    node: string
    platform: string
  }
  environment: string
  deployment: {
    platform: string
    region: string
  }
  resources: {
    memory: {
      rss: number
      heapTotal: number
      heapUsed: number
      external: number
      arrayBuffers: number
    }
    cpu: {
      count: number
      loadAverage: number[]
      model: string
    }
    uptime: number
  }
}

export async function GET(request: NextRequest) {
  // Check admin authentication
  const authResult = await checkDashboardAuth(request)
  if (!authResult.isAuthorized) {
    return getDashboardUnauthorizedResponse(authResult.error)
  }

  try {
    const memUsage = process.memoryUsage()
    const cpus = os.cpus()
    const loadAvg = os.loadavg()

    const status: SystemStatus = {
      timestamp: new Date().toISOString(),
      version: {
        app: process.env.npm_package_version || process.env.APP_VERSION || '1.0.0',
        node: process.version,
        platform: process.platform
      },
      environment: process.env.NODE_ENV || 'development',
      deployment: {
        platform: process.env.VERCEL ? 'Vercel' :
                  process.env.AWS_REGION ? 'AWS' :
                  process.env.KUBERNETES_SERVICE_HOST ? 'Kubernetes' :
                  'Self-hosted',
        region: process.env.VERCEL_REGION ||
                process.env.AWS_REGION ||
                process.env.REGION ||
                'unknown'
      },
      resources: {
        memory: {
          rss: Math.round(memUsage.rss / 1024 / 1024), // MB
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
          external: Math.round(memUsage.external / 1024 / 1024), // MB
          arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024) // MB
        },
        cpu: {
          count: cpus.length,
          loadAverage: loadAvg.map(load => Math.round(load * 100) / 100),
          model: cpus[0]?.model || 'Unknown'
        },
        uptime: Math.floor(process.uptime())
      }
    }

    return NextResponse.json(status, { status: 200 })

  } catch (error) {
    console.error('Dashboard status API error:', error)

    return NextResponse.json({
      error: 'Failed to fetch system status',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
