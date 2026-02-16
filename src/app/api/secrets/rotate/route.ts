/**
 * Secret Rotation API Endpoint
 * Provides manual secret rotation capabilities with policy enforcement
 *
 * Handles:
 * - Manual rotation requests with policy validation
 * - Rotation eligibility checks
 * - Metadata updates and history tracking
 * - New expiration calculation based on policy
 */

import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { SecretManager } from '@/lib/security/secret-manager'
import { executeRotation } from '@/lib/security/rotation-policies'
import { createServiceLogger } from '@/lib/logging'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'secrets-rotate'
})

const prisma = new PrismaClient()

/**
 * Validation schema for rotation request
 */
const rotateRequestSchema = z.object({
  secret_name: z.string().min(1).max(255),
  reason: z.string().max(500).optional(),
  new_secret_value: z.string().optional(),
  dry_run: z.boolean().optional()
})

/**
 * POST handler for manual secret rotation
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = randomUUID()
  const clientIp = request.headers.get('x-forwarded-for') ||
                   request.headers.get('x-real-ip') ||
                   'unknown'

  const logContext = {
    service: 'vibecode-webgui',
    component: 'secrets-rotate',
    requestId,
    clientIp
  }

  console.log('Secret rotation requested', logContext)

  try {
    // Authentication is required for rotation operations
    const session = await getServerSession(authOptions)
    const isAuthenticated = !!session?.user

    if (!isAuthenticated) {
      console.warn('Unauthorized rotation attempt', logContext)
      return NextResponse.json({
        error: 'Authentication required',
        message: 'Secret rotation requires authentication'
      }, { status: 401 })
    }

    const userId = session.user.email || 'unknown'

    // Parse and validate request body
    let requestBody: z.infer<typeof rotateRequestSchema>
    try {
      const body = await request.json()
      requestBody = rotateRequestSchema.parse(body)
    } catch (error) {
      console.warn('Invalid rotation request body', {
        ...logContext,
        error: error instanceof Error ? error.message : 'Invalid request'
      })
      return NextResponse.json({
        error: 'Invalid request',
        message: error instanceof z.ZodError
          ? error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
          : 'Request body validation failed'
      }, { status: 400 })
    }

    const { secret_name, reason, new_secret_value, dry_run } = requestBody

    // Fetch secret metadata
    const secretManager = new SecretManager(prisma)
    const secretWithMetadata = await secretManager.getSecretWithMetadata(secret_name)

    if (!secretWithMetadata) {
      console.warn('Secret not found for rotation', {
        ...logContext,
        secretName: secret_name
      })
      return NextResponse.json({
        error: 'Secret not found',
        message: `No secret found with name: ${secret_name}`
      }, { status: 404 })
    }

    const metadata = secretWithMetadata.metadata

    // Check if secret has a rotation policy
    if (!metadata.rotationPolicy) {
      console.warn('Secret has no rotation policy', {
        ...logContext,
        secretName: secret_name
      })
      return NextResponse.json({
        error: 'No rotation policy',
        message: `Secret ${secret_name} does not have a rotation policy configured`,
        suggestion: 'Configure a rotation policy before attempting rotation'
      }, { status: 400 })
    }

    // Execute rotation with policy enforcement
    const rotationResult = executeRotation(
      secret_name,
      metadata.rotationPolicy,
      metadata.expiresAt,
      metadata.status as 'active' | 'expired' | 'rotating' | 'revoked',
      metadata.lastRotatedAt,
      {
        reason: reason || 'manual rotation',
        initiatedBy: userId,
        newSecretValue: new_secret_value,
        dryRun: dry_run || false
      }
    )

    // If rotation was successful and not a dry run, record the rotation
    if (rotationResult.success && !dry_run) {
      await secretManager.recordRotation(
        secret_name,
        rotationResult.newExpiresAt,
        userId,
        reason
      )

      // If a new secret value was provided, update the keychain
      if (new_secret_value) {
        await secretManager.registerSecret(secret_name, new_secret_value, {
          expiresAt: rotationResult.newExpiresAt || undefined,
          rotationPolicy: metadata.rotationPolicy
        })
      }

      console.log('Secret rotation completed successfully', {
        ...logContext,
        secretName: secret_name,
        previousExpiresAt: rotationResult.previousExpiresAt?.toISOString(),
        newExpiresAt: rotationResult.newExpiresAt?.toISOString(),
        userId
      })
    }

    // Calculate response time
    const responseTime = Date.now() - startTime

    // Return rotation result
    return NextResponse.json({
      success: rotationResult.success,
      secretName: secret_name,
      rotatedAt: rotationResult.rotatedAt.toISOString(),
      previousExpiresAt: rotationResult.previousExpiresAt?.toISOString() || null,
      newExpiresAt: rotationResult.newExpiresAt?.toISOString() || null,
      messages: rotationResult.messages,
      errors: rotationResult.errors,
      nextSteps: rotationResult.nextSteps,
      dryRun: dry_run || false,
      responseTime: `${responseTime}ms`,
      requestId
    }, { status: rotationResult.success ? 200 : 400 })

  } catch (error) {
    console.error('Secret rotation failed with error:', error)

    // Check authentication for error response detail level
    const session = await getServerSession(authOptions)
    const isAuthenticated = !!session?.user

    // Return limited error info for unauthenticated requests
    if (!isAuthenticated) {
      return NextResponse.json({
        error: 'Rotation failed',
        message: 'An error occurred during rotation'
      }, { status: 500 })
    }

    return NextResponse.json({
      error: 'Rotation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      requestId
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
