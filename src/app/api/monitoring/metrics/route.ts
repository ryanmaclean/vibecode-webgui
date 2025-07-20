export const dynamic = 'force-dynamic'

/**
 * Monitoring metrics API endpoint
 * Provides real-time system metrics from Datadog for the monitoring dashboard
 * Updated for 2025 with modern Datadog API integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
// import { getHealthCheck } from '@/lib/server-monitoring' // Not used in this file
import { client, v1 } from '@datadog/datadog-api-client'
import os from 'os'

interface SystemMetrics {
  cpu: number
  memory: number
  diskUsage: number
  networkIO: { in: number; out: number }
  activeUsers: number
  activeWorkspaces: number
  totalSessions: number
  avgResponseTime: number
  errorRate: number
  uptime: number
}

// Datadog API client configuration
const createDatadogConfig = () => {
  const configuration = client.createConfiguration()
  configuration.setServerVariables({
    site: process.env.DATADOG_SITE || 'datadoghq.com',
  })
  return configuration
}

// Initialize Datadog metrics API client
const getMetricsApi = () => {
  if (!process.env.DATADOG_API_KEY) {
    return null
  }
  return new v1.MetricsApi(createDatadogConfig())
}

// Helper function to get current timestamp in seconds
const getCurrentTimestamp = () => Math.floor(Date.now() / 1000)

// Helper function to get time range for queries
const getTimeRange = (minutes: number = 5) => {
  const now = getCurrentTimestamp()
  return {
    from: now - (minutes * 60),
    to: now,
  }
}

export async function GET(_request: NextRequest) {
  try {
    // Verify admin access
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use Datadog if configured, otherwise use local metrics
    if (process.env.DATADOG_API_KEY) {
      const metrics = await getDatadogMetrics()
      return NextResponse.json(metrics)
    } else {
      console.warn('Datadog API key not configured, using local metrics')
      const metrics = await getLocalMetrics()
      return NextResponse.json(metrics)
    }
  } catch (error) {
    console.error('Metrics API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}

// Fetch metrics from Datadog
async function getDatadogMetrics(): Promise<SystemMetrics> {
  const timeRange = getTimeRange()

  const queries = {
    cpu: queryDatadogMetric('system.cpu.user', timeRange),
    memory: queryDatadogMetric('system.mem.used', timeRange),
    diskUsage: queryDatadogMetric('system.disk.in_use', timeRange),
    networkIn: queryDatadogMetric('system.net.bytes_rcvd', timeRange),
    networkOut: queryDatadogMetric('system.net.bytes_sent', timeRange),
    avgResponseTime: queryDatadogMetric('nginx.ingress.controller.request.duration.seconds.avg', timeRange),
    errorRate: queryDatadogMetric('nginx.ingress.controller.requests.errors.rate', timeRange),
  }

  const results = await Promise.allSettled(Object.values(queries))

  const [cpu, memory, disk, netIn, netOut, avgResponse, errRate] = results.map(extractMetricValue)

  return {
    cpu: cpu || 0,
    memory: memory || 0,
    diskUsage: disk || 0,
    networkIO: { in: netIn || 0, out: netOut || 0 },
    activeUsers: 0, // Placeholder
    activeWorkspaces: 0, // Placeholder
    totalSessions: 0, // Placeholder
    avgResponseTime: avgResponse || 0,
    errorRate: errRate || 0,
    uptime: process.uptime(),
  }
}

// Local metric helpers (fallback)

async function getCPUUsage(): Promise<number> {
  // Simplified CPU usage calculation
  return os.loadavg()[0]
}

function getMemoryUsage(): number {
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  return ((totalMem - freeMem) / totalMem) * 100
}

function getDiskUsage(): number {
  // Placeholder for disk usage
  return 0
}

// Helper functions for Datadog integration

async function queryDatadogMetric(metric: string, timeRange: { from: number; to: number }) {
  try {
    const metricsApi = getMetricsApi()
    if (!metricsApi) {
      return null
    }

    const response = await metricsApi.queryMetrics({
      from: timeRange.from,
      to: timeRange.to,
      query: `avg:${metric}{service:vibecode-webgui}`,
    })
    return response
  } catch (error) {
    console.error(`Failed to query metric ${metric}:`, error)
    return null
  }
}

function extractMetricValue(queryResult: unknown): number | null {
  const typedResult = queryResult as { status?: string; value?: unknown }
  if (!typedResult || typedResult.status !== 'fulfilled') {
    return null
  }

  const result = typedResult.value as { series?: Array<{ pointlist?: Array<[number, number]> }> }
  if (!result?.series || result.series.length === 0) {
    return null
  }

  const series = result.series[0]
  if (!series.pointlist || series.pointlist.length === 0) {
    return null
  }

  // Get the most recent value
  const lastPoint = series.pointlist[series.pointlist.length - 1]
  return lastPoint[1] // [timestamp, value]
}

async function getLocalMetrics(): Promise<SystemMetrics> {
  // Fallback to local metrics when Datadog is not available
  const cpuUsage = await getCPUUsage()
  const memoryUsage = getMemoryUsage()
  const diskUsage = getDiskUsage()
  const uptime = process.uptime()

  return {
    cpu: cpuUsage,
    memory: memoryUsage,
    diskUsage: diskUsage,
    networkIO: { in: 0, out: 0 },
    activeUsers: 0,
    activeWorkspaces: 0,
    totalSessions: 0,
    avgResponseTime: 0,
    errorRate: 0,
    uptime: Math.round(uptime),
  }
}
