/**
 * Setup Status API Endpoint
 * Provides overall setup completion status for first-run onboarding
 *
 * SECURITY: Setup endpoint for first-run onboarding flow
 */

import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { checkAllSystems } from '@/lib/setup/checks'
import { createServiceLogger } from '@/lib/logging'

export const dynamic = 'force-dynamic'

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'setup-status-check'
})

/**
 * Get overall setup status
 * Exported for testing purposes
 */
export async function getSetupStatus() {
  const result = await checkAllSystems()

  // Calculate completion percentage
  const totalSteps = 4 // docker, kubernetes, database, ai-keys
  const completedCount = result.completedSteps.length
  const completionPercentage = Math.round((completedCount / totalSteps) * 100)

  return {
    overallStatus: result.overallStatus,
    completionPercentage,
    completedSteps: result.completedSteps,
    totalSteps,
    checks: {
      docker: {
        status: result.docker.status,
        message: result.docker.message,
        running: result.docker.running,
        version: result.docker.version
      },
      kubernetes: {
        status: result.kubernetes.status,
        message: result.kubernetes.message,
        connected: result.kubernetes.connected,
        clusterName: result.kubernetes.clusterName,
        version: result.kubernetes.version
      },
      database: {
        status: result.database.status,
        message: result.database.message,
        initialized: result.database.initialized,
        migrationsComplete: result.database.migrationsComplete
      },
      aiKeys: {
        status: result.aiKeys.status,
        message: result.aiKeys.message,
        validKeys: result.aiKeys.validKeys,
        missingKeys: result.aiKeys.missingKeys
      }
    }
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
    component: 'setup-status-check',
    requestId,
    clientIp
  }

  console.log('Setup status check requested', logContext)

  try {
    // Get overall setup status
    const result = await getSetupStatus()
    const responseTime = Date.now() - startTime

    const response = {
      ...result,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      requestId
    }

    // Log the result
    console.log('Setup status check completed', {
      ...logContext,
      overallStatus: result.overallStatus,
      completionPercentage: result.completionPercentage,
      completedSteps: result.completedSteps,
      responseTime
    })

    // Return 200 status regardless of setup state
    // The response body indicates the actual state
    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('Setup status check failed with error:', error)

    const responseTime = Date.now() - startTime

    return NextResponse.json({
      overallStatus: 'error',
      completionPercentage: 0,
      completedSteps: [],
      totalSteps: 4,
      message: 'Setup status check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      requestId
    }, { status: 200 })
  }
}
