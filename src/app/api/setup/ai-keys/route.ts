/**
 * AI API Keys Validation API Endpoint
 * Checks if AI API keys are properly configured
 *
 * SECURITY: Setup endpoint for first-run onboarding
 */

import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkAIKeys } from '@/lib/setup/checks'
import { createServiceLogger } from '@/lib/logging'
import { createAPIRateLimit } from '@/lib/rate-limiting'

export const dynamic = 'force-dynamic'

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'setup-ai-keys-check'
})
const apiRateLimit = createAPIRateLimit(60)

/**
 * Check AI API keys configuration
 * Exported for testing purposes
 */
export async function checkAIKeysConfiguration() {
  const result = await checkAIKeys()

  const validKeys = result.validKeys ?? []
  const missingKeys = result.missingKeys ?? []

  return {
    configured: result.status === 'completed',
    status: result.status,
    message: result.message,
    validKeys,
    missingKeys,
    details: {
      totalConfigured: validKeys.length,
      totalMissing: missingKeys.length
    }
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
    component: 'setup-ai-keys-check',
    requestId,
  }

  log.info('AI API keys check requested', logContext)

  try {
    // Check AI API keys configuration
    const result = await checkAIKeysConfiguration()
    const responseTime = Date.now() - startTime

    const status =
      result.status === 'warning'
        ? 'warning'
        : result.status === 'completed'
          ? 'completed'
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
    if (!result.configured) {
      log.warn('AI API keys not fully configured', {
        ...logContext,
        configured: false,
        validKeys: result.validKeys.length,
        missingKeys: result.missingKeys.length
      })
    } else {
      log.info('AI API keys check completed', {
        ...logContext,
        configured: true,
        validKeys: result.validKeys.length,
        responseTime
      })
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    log.error('AI API keys check failed', {
      ...logContext,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    const responseTime = Date.now() - startTime

    return NextResponse.json({
      success: false,
      data: {
        configured: false,
        status: 'error',
        message: 'AI keys check failed',
        validKeys: [],
        missingKeys: [],
      },
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      requestId
    }, { status: 200 })
  }
}
