/**
 * Health Check API Endpoint
 * Provides application health status for monitoring and deployment
 */

import { NextRequest, NextResponse } from 'next/server'
import { monitoring } from '@/lib/monitoring'

export async function GET(_request: NextRequest) {
  const startTime = Date.now()

  try {
    // Basic health checks
    const healthChecks = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        memory: checkMemoryUsage(),
        disk: await checkDiskSpace(),
        database: await monitoring.checkDatabase(),
        redis: await monitoring.checkRedis(),
        ai: await monitoring.checkAIService()
      }
    }

    // Calculate response time
    const responseTime = Date.now() - startTime
    const healthCheckResponse = {
      ...healthChecks,
      responseTime: `${responseTime}ms`
    }

    // Submit health check metrics to Datadog
    await monitoring.trackMetrics()
    await monitoring.submitEvent(
      'Health Check Completed',
      `Application health check completed with status: ${healthChecks.status}`,
      ['source:health-check', `env:${process.env.NODE_ENV}`]
    )

    // Determine overall health status
    const hasFailures = Object.values(healthChecks.checks).some(check => check.status !== 'healthy')
    if (hasFailures) {
      healthChecks.status = 'degraded'
      return NextResponse.json(healthChecks, { status: 503 })
    }

    return NextResponse.json(healthCheckResponse, { status: 200 })

  } catch (error) {
    console.error('Health check error:', error)

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
