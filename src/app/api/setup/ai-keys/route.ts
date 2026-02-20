/**
 * AI API Keys Validation API Endpoint
 * Checks if AI API keys are properly configured
 *
 * SECURITY: Setup endpoint for first-run onboarding
 */

import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { checkAIKeys } from '@/lib/setup/checks'
import { createServiceLogger } from '@/lib/logging'

export const dynamic = 'force-dynamic'

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'setup-ai-keys-check'
})

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
  const startTime = Date.now()
  const requestId = randomUUID()
  const clientIp = request.headers.get('x-forwarded-for') ||
                   request.headers.get('x-real-ip') ||
                   'unknown'

  const logContext = {
    service: 'vibecode-webgui',
    component: 'setup-ai-keys-check',
    requestId,
    clientIp
  }

  console.log('AI API keys check requested', logContext)

  try {
    // Check AI API keys configuration
    const result = await checkAIKeysConfiguration()
    const responseTime = Date.now() - startTime

    const response = {
      ...result,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      requestId
    }

    // Log the result
    if (!result.configured) {
      console.warn('AI API keys not fully configured', {
        ...logContext,
        configured: false,
        validKeys: result.validKeys.length,
        missingKeys: result.missingKeys.length
      })
    } else {
      console.log('AI API keys check completed', {
        ...logContext,
        configured: true,
        validKeys: result.validKeys.length,
        responseTime
      })
    }

    // Return 200 status regardless of configuration state
    // The response body indicates the actual state
    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('AI API keys check failed with error:', error)

    const responseTime = Date.now() - startTime

    return NextResponse.json({
      configured: false,
      status: 'error',
      message: 'AI keys check failed',
      validKeys: [],
      missingKeys: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      requestId
    }, { status: 200 })
  }
}
