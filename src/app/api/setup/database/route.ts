/**
 * Database Initialization Check API Endpoint
 * Checks if database is properly configured and accessible
 *
 * SECURITY: Setup endpoint for first-run onboarding
 */

import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { monitoring } from '@/lib/monitoring'
import { createServiceLogger } from '@/lib/logging'
import { createAPIRateLimit } from '@/lib/rate-limiting'

export const dynamic = 'force-dynamic'

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'setup-database-check'
})
const apiRateLimit = createAPIRateLimit(60)

/**
 * Check database initialization status
 * Exported for testing purposes
 */
export async function checkDatabaseInitialization() {
  const databaseUrl = process.env.DATABASE_URL

  // Check if database URL is configured
  if (!databaseUrl) {
    return {
      initialized: false,
      configured: false,
      message: 'Database URL not configured',
      details: {
        note: 'DATABASE_URL environment variable is not set'
      }
    }
  }

  // Perform health check using monitoring service
  const healthCheck = await monitoring.checkDatabase()

  if (healthCheck.status === 'error') {
    return {
      initialized: false,
      configured: true,
      message: 'Database connection failed',
      details: {
        error: healthCheck.error,
        note: 'Database is configured but connection failed'
      }
    }
  }

  if (healthCheck.status === 'warning') {
    return {
      initialized: true,
      configured: true,
      message: 'Database connection warning',
      details: healthCheck.details,
      warning: 'Database may have connectivity or performance issues'
    }
  }

  // Database is healthy and initialized
  return {
    initialized: true,
    configured: true,
    message: 'Database is initialized and ready',
    details: healthCheck.details
  }
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

  const startTime = Date.now()
  const requestId = randomUUID()

  const logContext = {
    service: 'vibecode-webgui',
    component: 'setup-database-check',
    requestId,
  }

  log.info('Database initialization check requested', logContext)

  try {
    // Check database initialization
    const result = await checkDatabaseInitialization()
    const responseTime = Date.now() - startTime

    const status =
      result.initialized
        ? result.warning ? 'warning' : 'completed'
        : 'error'

    const response = {
      success: true,
      data: {
        ...result,
        status,
      },
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      requestId
    }

    // Log the result
    if (!result.initialized) {
      log.warn('Database not initialized', {
        ...logContext,
        initialized: false,
        configured: result.configured
      })
    } else {
      log.info('Database initialization check completed', {
        ...logContext,
        initialized: true,
        responseTime
      })
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    log.error('Database initialization check failed', {
      ...logContext,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    const responseTime = Date.now() - startTime

    return NextResponse.json({
      success: false,
      data: {
        initialized: false,
        configured: false,
        status: 'error',
        message: 'Database check failed',
        migrationsComplete: false,
      },
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      requestId
    }, { status: 200 })
  }
}
