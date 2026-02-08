/**
 * Performance Monitoring API Endpoint
 * Returns real system performance metrics from process and OS data
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAPIRateLimit } from '@/lib/rate-limiting'
import * as os from 'os'

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(120)

function getCpuUsagePercent(): number {
  const cpus = os.cpus()
  let totalIdle = 0
  let totalTick = 0
  for (const cpu of cpus) {
    totalIdle += cpu.times.idle
    totalTick += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq
  }
  return totalTick > 0 ? Math.round(((totalTick - totalIdle) / totalTick) * 100 * 10) / 10 : 0
}

export async function GET(request: NextRequest) {
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

  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'report'
    const timeframe = searchParams.get('timeframe') || '1h'

    const memUsage = process.memoryUsage()
    const cpuUsage = getCpuUsagePercent()
    const uptime = process.uptime()
    const loadAvg = os.loadaverage()
    const totalMem = os.totalmem()
    const freeMem = os.freemem()

    switch (action) {
      case 'report':
        return NextResponse.json({
          timeframe,
          timestamp: new Date().toISOString(),
          status: 'success',
          metrics: {
            cpuUsage,
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
              externalMB: Math.round(memUsage.external / 1024 / 1024),
              uptimeSeconds: Math.round(uptime),
            },
          },
          recommendations: [],
          critical_issues: [],
          summary: {
            avg_api_response_time: 0,
          },
        })

      case 'health': {
        const heapUsedPct = (memUsage.heapUsed / memUsage.heapTotal) * 100
        const sysMemUsedPct = ((totalMem - freeMem) / totalMem) * 100
        const issues: string[] = []

        if (heapUsedPct > 90) issues.push('Process heap usage above 90%')
        if (sysMemUsedPct > 95) issues.push('System memory usage above 95%')
        if (loadAvg[0] > os.cpus().length * 2) issues.push('Load average exceeds 2x CPU count')

        const isHealthy = issues.length === 0

        return NextResponse.json({
          healthy: isHealthy,
          status: isHealthy ? 'healthy' : 'degraded',
          issues,
          recommendations: issues.length > 0 ? ['Review resource usage and consider scaling'] : [],
          timestamp: new Date().toISOString(),
        })
      }

      default:
        return NextResponse.json(
          {
            error: 'Invalid action',
            available_actions: ['report', 'health'],
          },
          { status: 400 }
        )
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to retrieve performance data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

  try {
    const body = await request.json()
    const { type } = body

    const validTypes = [
      'load_test_results',
      'synthetic_test_results',
      'lighthouse_results',
      'web_vitals',
      'api_performance',
      'resource_performance',
    ]

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        {
          error: 'Invalid performance data type',
          available_types: validTypes,
        },
        { status: 400 }
      )
    }

    // Acknowledge receipt - in production, these would be stored in a metrics backend
    return NextResponse.json({
      success: true,
      message: `Performance data of type '${type}' received`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to process performance data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
