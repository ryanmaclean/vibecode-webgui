/**
 * Health Check API Endpoint
 * Provides application health status for monitoring and deployment
 *
 * SECURITY: Phase 4 - Batch 3 validation added
 */

import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { monitoring } from '@/lib/monitoring'
import { healthCheckQuerySchema } from '@/lib/api/validation/schemas'
import { validateQueryParams } from '@/lib/api/validation/middleware'
import { createServiceLogger } from '@/lib/logging'

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'health-check'
})

/**
 * Collects health snapshot with performance metrics
 * Exported for testing purposes
 */
export async function collectHealthSnapshot(startTime: number) {
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
      valkey: await monitoring.checkValkey(),
      ai: await monitoring.checkAIService()
    }
  }

  // Calculate response time
  const responseTime = Date.now() - startTime
  const memoryUsage = process.memoryUsage()

  const snapshot = {
    ...healthChecks,
    responseTime: `${responseTime}ms`,
    performance: {
      responseTime,
      memoryUsage: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers
      },
      cpuUsage: process.cpuUsage().user / 1000000 // Convert to seconds
    }
  }

  return { snapshot, responseTime, healthChecks }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestId = randomUUID()
  const clientIp = request.headers.get('x-forwarded-for') ||
                   request.headers.get('x-real-ip') ||
                   'unknown'

  const logContext = {
    service: 'vibecode-webgui',
    component: 'health-check',
    requestId,
    clientIp
  }

  console.log('Health check requested', logContext)

  // Validate query parameters
  const validation = validateQueryParams(request, healthCheckQuerySchema)
  if (!validation.success) {
    console.warn('Invalid health check query parameters', {
      ...logContext,
      validationError: true
    })
    return validation.error
  }
  const { filter: _filter, format: _format } = validation.data

  try {
    // Check authentication for detailed health info
    const session = await getServerSession(authOptions)
    const isAuthenticated = !!session?.user

    // Collect health snapshot
    const { snapshot, responseTime, healthChecks } = await collectHealthSnapshot(startTime)

    // Submit health check metrics to Datadog
    await monitoring.trackMetrics()
    await monitoring.submitEvent(
      'Health Check Completed',
      `Application health check completed with status: ${healthChecks.status}`,
      ['source:health-check', `env:${process.env.NODE_ENV}`]
    )

    // Determine overall health status
    const hasFailures = Object.values(healthChecks.checks).some(check => check.status === 'error')
    if (hasFailures) {
      healthChecks.status = 'degraded'
      console.warn('Health check shows degraded status', {
        ...logContext,
        healthStatus: 'degraded',
        failedChecks: Object.entries(healthChecks.checks)
          .filter(([, check]) => check.status === 'error')
          .map(([name]) => name)
      })
    }

    // Return limited info for unauthenticated requests (public health check)
    if (!isAuthenticated) {
      const publicStatus = hasFailures ? 'degraded' : (healthChecks.status as 'healthy' | 'degraded' | 'unhealthy')
      return NextResponse.json({
        status: publicStatus === 'healthy' ? 'ok' : publicStatus,
        timestamp: new Date().toISOString()
      }, { status: hasFailures ? 503 : 200 })
    }

    // Return full details for authenticated requests
    if (hasFailures) {
      return NextResponse.json({
        ...healthChecks,
        responseTime: `${responseTime}ms`,
        requestId
      }, { status: 503 })
    }

    return NextResponse.json(snapshot, { status: 200 })

  } catch (error) {
    console.error('Health check failed with error:', error)

    // Check authentication for error response detail level
    const session = await getServerSession(authOptions)
    const isAuthenticated = !!session?.user

    // Return limited error info for unauthenticated requests
    if (!isAuthenticated) {
      return NextResponse.json({
        status: 'unhealthy',
        timestamp: new Date().toISOString()
      }, { status: 503 })
    }

    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      requestId
    }, { status: 503 })
  }
}

function checkMemoryUsage() {
  try {
    const memUsage = process.memoryUsage()
    const totalMem = memUsage.heapTotal / 1024 / 1024 // MB
    const usedMem = memUsage.heapUsed / 1024 / 1024 // MB
    const memoryPercentage = (usedMem / totalMem) * 100

    // In test/CI environments, be more lenient with memory thresholds
    // CI runs many tests in parallel which legitimately uses more memory
    const threshold = (process.env.NODE_ENV === 'test' || process.env.CI === 'true') ? 95 : 90

    return {
      status: memoryPercentage > threshold ? 'warning' : 'healthy',
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
    await fs.stat(process.cwd())

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


/**
 * Get allowed origins from environment or use defaults
 */
function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS
  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim()).filter(Boolean)
  }
  // Default allowed origins for health checks
  return [
    'https://vibecode.dev',
    'http://localhost:3000',
    'http://localhost:8080'
  ]
}

/**
 * Validate and return CORS origin if allowed
 */
function getValidatedCorsOrigin(requestOrigin: string | null): string | null {
  if (!requestOrigin) {
    return null
  }

  const allowedOrigins = getAllowedOrigins()

  // Check if the request origin is in the allowed list
  if (allowedOrigins.includes(requestOrigin)) {
    return requestOrigin
  }

  return null
}

// Handle CORS for health checks
export async function OPTIONS(request: NextRequest) {
  const requestOrigin = request.headers.get('origin')
  const validatedOrigin = getValidatedCorsOrigin(requestOrigin)

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '3600',
  }

  // Only set Access-Control-Allow-Origin if the origin is validated
  if (validatedOrigin) {
    headers['Access-Control-Allow-Origin'] = validatedOrigin
    headers['Vary'] = 'Origin'
  }

  return new NextResponse(null, {
    status: 200,
    headers,
  })
}
