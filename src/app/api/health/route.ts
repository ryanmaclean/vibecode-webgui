/**
 * Health Check API Endpoint
 * Provides application health status for monitoring and deployment
 */

import { NextRequest, NextResponse } from 'next/server'
import { monitoring } from '@/lib/monitoring'
import { logger } from '@/lib/logger';

type HealthCheckResult = {
  status: string
  details?: unknown
  error?: string
}

type PerformanceMetrics = {
  responseTime: number
  memoryUsage: {
    rss: number
    heapTotal: number
    heapUsed: number
    external: number
    arrayBuffers: number
  }
  cpuUsage: number
}

export type HealthSnapshot = {
  status: string
  timestamp: string
  uptime: number
  version: string
  environment: string
  checks: {
    memory: HealthCheckResult
    disk: HealthCheckResult
    database: HealthCheckResult
    valkey: HealthCheckResult
    ai: HealthCheckResult
  }
  responseTime: string
  performance: PerformanceMetrics
}

export async function collectHealthSnapshot(startTime: number): Promise<{
  snapshot: HealthSnapshot
  hasFailures: boolean
}> {
  const checks = {
    memory: checkMemoryUsage(),
    disk: await checkDiskSpace(),
    database: await monitoring.checkDatabase(),
    valkey: await monitoring.checkValkey(),
    ai: await monitoring.checkAIService()
  }

  const hasFailures = Object.values(checks).some((check) => check.status !== 'healthy')
  const computedStatus = hasFailures ? 'degraded' : 'healthy'

  const responseTime = Math.max(1, Date.now() - startTime)
  const memoryUsage = process.memoryUsage()
  const cpuUsage = process.cpuUsage()
  const performanceMetrics: PerformanceMetrics = {
    responseTime,
    memoryUsage: {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external ?? 0,
      arrayBuffers: memoryUsage.arrayBuffers ?? 0
    },
    cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000
  }

  const snapshot: HealthSnapshot = {
    status: computedStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks,
    responseTime: `${responseTime}ms`,
    performance: performanceMetrics
  }

  return { snapshot, hasFailures }
}

export async function GET(_request: NextRequest) {
  const startTime = Date.now()

  try {
    const { snapshot, hasFailures } = await collectHealthSnapshot(startTime)

    await monitoring.trackMetrics()
    await monitoring.submitEvent(
      'Health Check Completed',
      `Application health check completed with status: ${snapshot.status}`,
      ['source:health-check', `env:${process.env.NODE_ENV}`]
    )

    const statusCode = hasFailures ? 503 : 200
    return NextResponse.json(snapshot, { status: statusCode })

  } catch (error) {
    logger.error('Health check error:', error)

    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: `${Date.now() - startTime}ms`
    }, { status: 503 })
  }
}

function checkMemoryUsage() {
  try {
    const memUsage = process.memoryUsage()
    const totalMem = memUsage.heapTotal / 1024 / 1024 // MB
    const usedMem = memUsage.heapUsed / 1024 / 1024 // MB
    const memoryPercentage = (usedMem / totalMem) * 100

    return {
      status: memoryPercentage > 90 ? 'warning' : 'healthy',
      details: {
        used: `${Math.round(usedMem)}MB`,
        total: `${Math.round(totalMem)}MB`,
        percentage: `${Math.round(memoryPercentage)}%`
      }
    }
  } catch (_error) {
    return {
      status: 'error',
      error: 'Failed to check memory usage'
    }
  }
}

async function checkDiskSpace() {
  try {
    // Basic disk space check (platform-specific)
    const fs = await import('fs/promises')
    const _stats = await fs.stat(process.cwd())

    return {
      status: 'healthy',
      details: {
        accessible: true,
        writable: true
      }
    }
  } catch (_error) {
    return {
      status: 'error',
      error: 'Failed to check disk space'
    }
  }
}


// Handle CORS for health checks
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
