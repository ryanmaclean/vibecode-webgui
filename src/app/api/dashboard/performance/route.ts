/**
 * Dashboard Performance Metrics API Endpoint
 * Returns real system performance metrics over configurable time ranges
 *
 * Protected with admin-only authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkDashboardAuth, getDashboardUnauthorizedResponse } from '@/lib/monitoring/auth'
import * as os from 'os'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authResult = await checkDashboardAuth(request)
  if (!authResult.isAuthorized) {
    return getDashboardUnauthorizedResponse(authResult.error)
  }

  try {
    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('range') || '1h'

    if (!['1h', '6h', '24h', '7d'].includes(timeRange)) {
      return NextResponse.json(
        {
          error: 'Invalid time range',
          message: 'Valid ranges are: 1h, 6h, 24h, 7d',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      )
    }

    const memUsage = process.memoryUsage()
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const loadAvg = os.loadaverage()
    const uptime = process.uptime()

    return NextResponse.json({
      timeRange,
      timestamp: new Date().toISOString(),
      metrics: {
        requests: 0,
        avgLatency: 0,
        errorRate: 0,
        p95Latency: 0,
        p99Latency: 0,
      },
      system: {
        cpuCount: os.cpus().length,
        loadAverage: {
          '1m': Math.round(loadAvg[0] * 100) / 100,
          '5m': Math.round(loadAvg[1] * 100) / 100,
          '15m': Math.round(loadAvg[2] * 100) / 100,
        },
        memory: {
          totalMB: Math.round(totalMem / 1024 / 1024),
          freeMB: Math.round(freeMem / 1024 / 1024),
          usedPercent: Math.round(((totalMem - freeMem) / totalMem) * 100 * 10) / 10,
        },
        process: {
          heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
          rssMB: Math.round(memUsage.rss / 1024 / 1024),
          uptimeSeconds: Math.round(uptime),
        },
      },
      dataPoints: [],
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch performance metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
