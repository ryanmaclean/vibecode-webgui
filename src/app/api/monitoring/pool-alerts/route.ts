/**
 * Pool Alerts Monitoring API Endpoint
 * Returns real system health status for connection pool monitoring
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const memUsage = process.memoryUsage()
    const uptime = process.uptime()
    const heapUsedPct = (memUsage.heapUsed / memUsage.heapTotal) * 100

    // Determine health status based on real metrics
    const alerts: string[] = []
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'

    if (heapUsedPct > 90) {
      status = 'critical'
      alerts.push(`Heap usage critical: ${heapUsedPct.toFixed(1)}%`)
    } else if (heapUsedPct > 75) {
      status = 'warning'
      alerts.push(`Heap usage elevated: ${heapUsedPct.toFixed(1)}%`)
    }

    return NextResponse.json({
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.round(uptime),
      alerts,
      metrics: {
        heapUsedPercent: Math.round(heapUsedPct * 10) / 10,
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        rssMB: Math.round(memUsage.rss / 1024 / 1024),
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: 'Failed to collect pool alerts',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
