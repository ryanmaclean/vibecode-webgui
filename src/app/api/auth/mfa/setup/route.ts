/**
 * MFA Setup API
 * Handles multi-factor authentication device setup
 *
 * Rate Limited: 10 requests per minute (strict, security-sensitive)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { mfaProvider } from '@/lib/auth/mfa-provider'
import { z } from '@/lib/zod-compat'
import { createAPIRateLimit } from '@/lib/rate-limiting'

const apiRateLimit = createAPIRateLimit(10) // 10 requests per minute - strict for security

export const dynamic = 'force-dynamic'

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
  // Rate limiting
  const rateLimitResult = await apiRateLimit(req)
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

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
          return NextResponse.json({ error: 'Phone number required for SMS setup' }, { status: 400 })
        }
        result = await mfaProvider.setupSMS(session.user.id, phoneNumber, name)
        break
      case 'email':
        if (!email) {
          return NextResponse.json({ error: 'Email required for email setup' }, { status: 400 })
        }
        result = await mfaProvider.setupEmail(session.user.id, email, name)
        break
      default:
        return NextResponse.json({ error: 'Unsupported MFA type' }, { status: 400 })
    }

    return NextResponse.json({
      status: 'success',
      data: {
        deviceId: result.deviceId,
        qrCodeUrl: result.qrCodeUrl,
        backupCodes: result.backupCodes,
        setupToken: result.setupToken
      },
      message: `${type.toUpperCase()} MFA setup initiated`
    })
  } catch (error) {
    // Server error logged

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request parameters',
        details: error.issues
      }, { status: 400 })
    }

    return NextResponse.json({
      error: 'MFA setup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * PUT /api/auth/mfa/setup - Verify MFA device setup
 */
export async function PUT(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await apiRateLimit(req)
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

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { deviceId, token, setupToken } = verifySchema.parse(body)

    const verified = await mfaProvider.verifySetup(deviceId, token, setupToken)

    if (verified) {
      return NextResponse.json({
        status: 'success',
        message: 'MFA device verified and activated'
      })
    } else {
      return NextResponse.json({
        error: 'Invalid verification code'
      }, { status: 400 })
    }
  } catch (error) {
    // Server error logged

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request parameters',
        details: error.issues
      }, { status: 400 })
    }

    return NextResponse.json({
      error: 'MFA verification failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}