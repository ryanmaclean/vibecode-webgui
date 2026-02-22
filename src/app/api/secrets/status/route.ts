/**
 * Secrets Status API Endpoint
 * Provides secret health monitoring and expiration status
 *
 * Returns information about:
 * - Total secrets tracked
 * - Secrets expiring soon
 * - Expired secrets
 * - Policy compliance status
 * - Last rotation timestamps
 */

import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ExpirationChecker } from '@/lib/security/expiration-checker'
import { createServiceLogger } from '@/lib/logging'

export const dynamic = 'force-dynamic'

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'secrets-status'
})

/**
 * Collects secret health status with expiration monitoring
 * Exported for testing purposes
 */
export async function collectSecretsStatus(startTime: number) {
  const checker = new ExpirationChecker(prisma)

  // Get comprehensive expiration summary
  const summary = await checker.getSummary({
    includeNoExpiration: true
  })

  // Get policy compliance information
  const policyCompliance = await checkPolicyCompliance()

  // Get last rotation information
  const lastRotations = await getRecentRotations(5)

  // Calculate response time
  const responseTime = Date.now() - startTime

  const status = {
    status: summary.expired > 0 ? 'degraded' : 'healthy',
    timestamp: new Date().toISOString(),
    secrets: {
      total: summary.total,
      active: summary.active,
      expiringSoon: summary.expiringSoon,
      expired: summary.expired,
      noExpiration: summary.noExpiration
    },
    alerts: summary.alerts.map(alert => ({
      keyName: alert.keyName,
      severity: alert.severity,
      expiresAt: alert.expiresAt,
      daysUntilExpiration: alert.daysUntilExpiration,
      rotationPolicy: alert.rotationPolicy,
      message: alert.message
    })),
    policyCompliance,
    lastRotations,
    responseTime: `${responseTime}ms`
  }

  return { status, summary }
}

/**
 * Check policy compliance across all secrets
 */
async function checkPolicyCompliance() {
  try {
    const secrets = await prisma.secretMetadata.findMany({
      where: {
        status: {
          not: 'revoked'
        }
      },
      select: {
        rotation_policy: true,
        status: true
      }
    })

    const withPolicy = secrets.filter(s => s.rotation_policy !== null).length
    const withoutPolicy = secrets.filter(s => s.rotation_policy === null).length
    const compliant = secrets.filter(s =>
      s.rotation_policy !== null && s.status === 'active'
    ).length

    return {
      total: secrets.length,
      withPolicy,
      withoutPolicy,
      compliant,
      complianceRate: secrets.length > 0
        ? `${Math.round((compliant / secrets.length) * 100)}%`
        : '0%'
    }
  } catch (error) {
    log.error('Failed to check policy compliance', { error })
    return {
      total: 0,
      withPolicy: 0,
      withoutPolicy: 0,
      compliant: 0,
      complianceRate: '0%'
    }
  }
}

/**
 * Get recent rotation history
 */
async function getRecentRotations(limit: number = 5) {
  try {
    const rotations = await prisma.secretRotationHistory.findMany({
      take: limit,
      orderBy: {
        rotated_at: 'desc'
      },
      select: {
        secret_id: true,
        rotated_at: true,
        rotated_by: true,
        reason: true
      }
    })

    return rotations.map(rotation => ({
      secretId: rotation.secret_id,
      rotatedAt: rotation.rotated_at.toISOString(),
      rotatedBy: rotation.rotated_by || 'system',
      reason: rotation.reason || 'routine rotation'
    }))
  } catch (error) {
    log.error('Failed to get recent rotations', { error })
    return []
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
    component: 'secrets-status',
    requestId,
    clientIp
  }

  log.info('Secrets status check requested', logContext)

  try {
    // Check authentication for detailed status info
    const session = await getServerSession(authOptions)
    const isAuthenticated = !!session?.user

    // Collect secrets status
    const { status, summary } = await collectSecretsStatus(startTime)

    // Determine overall health status
    const hasExpired = summary.expired > 0
    const hasCriticalAlerts = summary.alerts.some(alert => alert.severity === 'critical')

    if (hasExpired || hasCriticalAlerts) {
      status.status = 'degraded'
      log.warn('Secrets status shows degraded state', {
        ...logContext,
        expired: summary.expired,
        criticalAlerts: summary.alerts.filter(a => a.severity === 'critical').length
      })
    }

    // Return limited info for unauthenticated requests (public health check)
    if (!isAuthenticated) {
      const publicStatus = hasExpired || hasCriticalAlerts ? 'degraded' : 'healthy'
      return NextResponse.json({
        status: publicStatus === 'healthy' ? 'ok' : publicStatus,
        timestamp: new Date().toISOString()
      }, { status: (hasExpired || hasCriticalAlerts) ? 503 : 200 })
    }

    // Return full details for authenticated requests
    const httpStatus = (hasExpired || hasCriticalAlerts) ? 503 : 200

    return NextResponse.json({
      ...status,
      requestId
    }, { status: httpStatus })

  } catch (error) {
    log.error('Secrets status check failed with error', {
      ...logContext,
      error: error instanceof Error ? error.message : String(error),
    })

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
