/**
 * MFA Setup API
 * Handles multi-factor authentication device setup
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

export const dynamic = 'force-dynamic'

const RATE_LIMIT_PREFIX = 'mfa-setup'

const setupSchema = z.object({
  type: z.enum(['totp', 'sms', 'email']),
  name: z.string().min(1).max(50),
  phoneNumber: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format (E.164 format required)')
    .optional(),
  email: z.string().email().optional()
})

const verifySchema = z.object({
  deviceId: z.string(),
  token: z.string()
    .min(6)
    .max(8)
    .regex(/^\d+$/, 'Token must contain only digits'),
  setupToken: z.string()
})

/**
 * POST /api/auth/mfa/setup - Setup new MFA device
 */
export async function POST(req: NextRequest) {
  // Apply rate limiting for MFA setup (security-sensitive)
  const rateLimitResult = await checkRateLimit(req, RateLimitPresets.MFA_VERIFY, RATE_LIMIT_PREFIX)
  if (!rateLimitResult.allowed) {
    return createRateLimitedResponse(rateLimitResult, RateLimitPresets.MFA_VERIFY)
  }

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return applyRateLimitHeaders(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        rateLimitResult
      )
    }

    const body = await req.json()
    const { type, name, phoneNumber, email } = setupSchema.parse(body)

    let result

    switch (type) {
      case 'totp':
        result = await mfaProvider.setupTOTP(session.user.id, name)
        break
      case 'sms':
        if (!phoneNumber) {
          return applyRateLimitHeaders(
            NextResponse.json({ error: 'Phone number required for SMS setup' }, { status: 400 }),
            rateLimitResult
          )
        }
        result = await mfaProvider.setupSMS(session.user.id, phoneNumber, name)
        break
      case 'email':
        if (!email) {
          return applyRateLimitHeaders(
            NextResponse.json({ error: 'Email required for email setup' }, { status: 400 }),
            rateLimitResult
          )
        }
        result = await mfaProvider.setupEmail(session.user.id, email, name)
        break
      default:
        return applyRateLimitHeaders(
          NextResponse.json({ error: 'Unsupported MFA type' }, { status: 400 }),
          rateLimitResult
        )
    }

    return applyRateLimitHeaders(
      NextResponse.json({
        status: 'success',
        data: {
          deviceId: result.deviceId,
          qrCodeUrl: result.qrCodeUrl,
          backupCodes: result.backupCodes,
          setupToken: result.setupToken
        },
        message: `${type.toUpperCase()} MFA setup initiated`
      }),
      rateLimitResult
    )
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
        error: 'MFA setup failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 }),
      rateLimitResult
    )
  }
}

/**
 * PUT /api/auth/mfa/setup - Verify MFA device setup
 */
export async function PUT(req: NextRequest) {
  // Apply rate limiting for MFA setup verification
  const rateLimitResult = await checkRateLimit(req, RateLimitPresets.MFA_VERIFY, RATE_LIMIT_PREFIX)
  if (!rateLimitResult.allowed) {
    return createRateLimitedResponse(rateLimitResult, RateLimitPresets.MFA_VERIFY)
  }

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return applyRateLimitHeaders(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        rateLimitResult
      )
    }

    const body = await req.json()
    const { deviceId, token, setupToken } = verifySchema.parse(body)

    const verified = await mfaProvider.verifySetup(deviceId, token, setupToken)

    if (verified) {
      return applyRateLimitHeaders(
        NextResponse.json({
          status: 'success',
          message: 'MFA device verified and activated'
        }),
        rateLimitResult
      )
    } else {
      return applyRateLimitHeaders(
        NextResponse.json({
          error: 'Invalid verification code'
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