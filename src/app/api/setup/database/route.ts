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

export const dynamic = 'force-dynamic'

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'setup-database-check'
})

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
  const startTime = Date.now()
  const requestId = randomUUID()
  const clientIp = request.headers.get('x-forwarded-for') ||
                   request.headers.get('x-real-ip') ||
                   'unknown'

  const logContext = {
    service: 'vibecode-webgui',
    component: 'setup-database-check',
    requestId,
    clientIp
  }

  console.log('Database initialization check requested', logContext)

  try {
    // Check database initialization
    const result = await checkDatabaseInitialization()
    const responseTime = Date.now() - startTime

    const response = {
      ...result,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      requestId
    }

    // Log the result
    if (!result.initialized) {
      console.warn('Database not initialized', {
        ...logContext,
        initialized: false,
        configured: result.configured
      })
    } else {
      console.log('Database initialization check completed', {
        ...logContext,
        initialized: true,
        responseTime
      })
    }

    // Return 200 status regardless of initialization state
    // The response body indicates the actual state
    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('Database initialization check failed with error:', error)

    const responseTime = Date.now() - startTime

    return NextResponse.json({
      initialized: false,
      configured: false,
      message: 'Database check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      requestId
    }, { status: 200 })
  }
}
