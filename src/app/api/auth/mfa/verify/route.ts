/**
 * MFA Verification API
 * Handles multi-factor authentication challenges and verification
 *
 * Rate Limited: 5 requests per 5 minutes (strict, security-sensitive)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { mfaProvider } from '@/lib/auth/mfa-provider'
import { z } from '@/lib/zod-compat'
import {
  checkRateLimit,
  createRateLimitedResponse,
  applyRateLimitHeaders,
  RateLimitPresets,
} from '@/lib/rate-limiter'
import { createAPIRateLimit } from '@/lib/rate-limiting'

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(10) // 10 requests per minute - strict for security

const RATE_LIMIT_PREFIX = 'mfa-verify'

const challengeSchema = z.object({
  preferredDeviceId: z.string().optional()
})

const verifySchema = z.object({
  challengeId: z.string(),
  token: z.string().optional(),
  backupCode: z.string().optional()
}).refine(data => data.token || data.backupCode, {
  message: "Either token or backup code must be provided"
})

/**
 * POST /api/auth/mfa/verify - Create MFA challenge
 */
export async function POST(request: NextRequest) {
  // Rate limiting
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

  // Apply rate limiting for MFA verification (security-sensitive)
  const legacyRateLimitResult = await checkRateLimit(request, RateLimitPresets.MFA_VERIFY, RATE_LIMIT_PREFIX)
  if (!legacyRateLimitResult.allowed) {
    return createRateLimitedResponse(legacyRateLimitResult, RateLimitPresets.MFA_VERIFY)
  }

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return applyRateLimitHeaders(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        legacyRateLimitResult
      )
    }

    const body = await request.json()
    const { preferredDeviceId } = challengeSchema.parse(body)

    const challenge = await mfaProvider.createChallenge(session.user.id, preferredDeviceId)

    return applyRateLimitHeaders(
      NextResponse.json({
        status: 'success',
        data: {
          challengeId: challenge.challengeId,
          availableDevices: challenge.availableDevices
        },
        message: 'MFA challenge created'
      }),
      legacyRateLimitResult
    )
  } catch (error) {
    // Server error logged

    if (error instanceof z.ZodError) {
      return applyRateLimitHeaders(
        NextResponse.json({
          error: 'Invalid request parameters',
          details: error.issues
        }, { status: 400 }),
        legacyRateLimitResult
      )
    }

    return applyRateLimitHeaders(
      NextResponse.json({
        error: 'MFA challenge failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 }),
      legacyRateLimitResult
    )
  }
}

/**
 * PUT /api/auth/mfa/verify - Verify MFA challenge
 */
export async function PUT(req: NextRequest) {
  // Apply strict rate limiting for MFA verification attempts
  const rateLimitResult = await checkRateLimit(req, RateLimitPresets.MFA_VERIFY, RATE_LIMIT_PREFIX)
  if (!rateLimitResult.allowed) {
    return createRateLimitedResponse(rateLimitResult, RateLimitPresets.MFA_VERIFY)
  }

  try {
    const body = await req.json()
    const { challengeId, token, backupCode } = verifySchema.parse(body)

    const result = await mfaProvider.verifyChallenge(
      challengeId,
      token || '',
      backupCode
    )

    if (result.success) {
      return applyRateLimitHeaders(
        NextResponse.json({
          status: 'success',
          data: {
            deviceId: result.deviceId,
            deviceType: result.deviceType,
            remainingBackupCodes: result.remainingBackupCodes
          },
          message: 'MFA verification successful'
        }),
        rateLimitResult
      )
    } else {
      return applyRateLimitHeaders(
        NextResponse.json({
          error: result.error || 'MFA verification failed'
        }, { status: 400 }),
        rateLimitResult
      )
    }
  } catch (error) {
    // Server error logged

    if (error instanceof z.ZodError) {
      return applyRateLimitHeaders(
        NextResponse.json({
          error: 'Invalid request parameters',
          details: error.issues
        }, { status: 400 }),
        rateLimitResult
      )
    }

    return applyRateLimitHeaders(
      NextResponse.json({
        error: 'MFA verification failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 }),
      rateLimitResult
    )
  }
}

/**
 * GET /api/auth/mfa/verify - Get user's MFA devices
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const devices = mfaProvider.getUserDevices(session.user.id)

    return NextResponse.json({
      status: 'success',
      data: {
        devices: devices.map(device => ({
          id: device.id,
          name: device.name,
          type: device.type,
          isActive: device.isActive,
          lastUsed: device.lastUsed,
          createdAt: device.createdAt,
          // Mask sensitive data
          phoneNumber: device.phoneNumber ? 
            device.phoneNumber.replace(/(\d{3})\d{3}(\d{4})/, '$1***$2') : undefined,
          email: device.email ? 
            device.email.replace(/(.{2}).*@/, '$1***@') : undefined
        }))
      }
    })
  } catch (error) {
    // Server error logged
    
    return NextResponse.json({
      error: 'Failed to retrieve MFA devices',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/auth/mfa/verify - Remove MFA device
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const deviceId = searchParams.get('deviceId')
    
    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID required' }, { status: 400 })
    }

    const removed = await mfaProvider.removeDevice(deviceId, session.user.id)

    if (removed) {
      return NextResponse.json({
        status: 'success',
        message: 'MFA device removed'
      })
    } else {
      return NextResponse.json({
        error: 'Device not found or access denied'
      }, { status: 404 })
    }
  } catch (error) {
    // Server error logged
    
    return NextResponse.json({
      error: 'Failed to remove MFA device',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}