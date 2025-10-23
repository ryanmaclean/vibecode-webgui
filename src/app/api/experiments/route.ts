/**
 * Experiments API endpoint
 * Provides feature flag evaluation and experiment tracking
 * Inspired by Datadog's Eppo acquisition capabilities
 *
 * SECURITY: Phase 4 - Batch 3 validation added
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { featureFlagEngine, type ExperimentContext } from '@/lib/feature-flags'
// import { appLogger } from '@/lib/server-monitoring'
import { experimentsBodySchema } from '@/lib/api/validation/schemas'
import { validateBody, checkRateLimit } from '@/lib/api/validation/helpers'

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Rate limiting: 100 requests per minute per user
    const rateLimit = checkRateLimit(`experiments-post:${session.user.id}`, 100, 60000)
    if (!rateLimit.allowed) {
      return rateLimit.response
    }

    // Validate request body
    const validation = await validateBody(request, experimentsBodySchema)
    if (!validation.success) {
      return validation.response
    }
    const body = validation.data
    const action = body.action
    const flagKey = 'flagKey' in body ? body.flagKey : undefined
    const context = body.context
    const metricName = 'metricName' in body ? body.metricName : undefined
    const value = 'value' in body ? body.value : undefined

    // Build experiment context
    const experimentContext: ExperimentContext = {
      userId: session.user.id,
      workspaceId: context?.workspaceId,
      userAgent: request.headers.get('user-agent') || undefined,
      ipAddress: request.headers.get('x-forwarded-for') ||
                 request.headers.get('x-real-ip') ||
                 'unknown',
      customAttributes: context?.customAttributes
    }

    switch (action) {
      case 'evaluate':
        if (!flagKey) {
          return NextResponse.json({ error: 'flagKey is required for evaluation' }, { status: 400 })
        }

        const result = await featureFlagEngine.evaluateFlag(
          flagKey,
          experimentContext,
          context?.defaultValue
        )

        console.log('flag_evaluated_api', {
          userId: session.user.id,
          feature: 'experimentation',
          metadata: {
            flagKey,
            variant: result.variant,
            isExperiment: result.isExperiment
          }
        })

        return NextResponse.json({
          success: true,
          result
        })

      case 'track':
        if (!flagKey || !metricName || value === undefined) {
          return NextResponse.json({
            error: 'flagKey, metricName, and value are required for tracking'
          }, { status: 400 })
        }

        await featureFlagEngine.trackMetric(
          flagKey,
          metricName,
          value,
          experimentContext
        )

        console.log('metric_tracked_api', {
          userId: session.user.id,
          feature: 'experimentation',
          value,
          metadata: {
            flagKey,
            metricName
          }
        })

        return NextResponse.json({
          success: true,
          message: 'Metric tracked successfully'
        })

      case 'evaluate_multiple':
        if (!Array.isArray(body.flags)) {
          return NextResponse.json({ error: 'flags array is required' }, { status: 400 })
        }

        const results = await Promise.all(
          body.flags.map(async (flag: { key: string; defaultValue?: boolean }) => {
            const result = await featureFlagEngine.evaluateFlag(
              flag.key,
              experimentContext,
              flag.defaultValue
            )
            return result
          })
        )

        console.log('multiple_flags_evaluated_api', {
          userId: session.user.id,
          feature: 'experimentation',
          metadata: {
            flagCount: body.flags.length,
            flags: body.flags.map((f: { key: string; defaultValue?: boolean }) => f.key)
          }
        })

        return NextResponse.json({
          success: true,
          results
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('experiment_api_error', {
      severity: 'medium',
      details: { error: (error as Error).message }
    })

    return NextResponse.json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Rate limiting: 100 requests per minute per user
    const rateLimit = checkRateLimit(`experiments-get:${session.user.id}`, 100, 60000)
    if (!rateLimit.allowed) {
      return rateLimit.response
    }

    // Validate query parameters
    const { experimentsQuerySchema } = await import('@/lib/api/validation/schemas')
    const { validateQueryParams } = await import('@/lib/api/validation/helpers')
    const validation = validateQueryParams(request, experimentsQuerySchema)
    if (!validation.success) {
      return validation.response
    }
    const { flagKey, action } = validation.data

    switch (action) {
      case 'results':
        // flagKey validation already handled by schema
        const experimentResults = await featureFlagEngine.getExperimentResults(flagKey!)

        console.log('experiment_results_viewed', {
          userId: session.user.id,
          feature: 'experimentation',
          metadata: {
            flagKey,
            hasResults: !!experimentResults.flag
          }
        })

        return NextResponse.json({
          success: true,
          ...experimentResults
        })

      case 'list':
        // In a real implementation, this would fetch from a database
        const flags = [
          {
            key: 'ai_assistant_v2',
            name: 'AI Assistant V2',
            description: 'Enable enhanced AI assistant with advanced code analysis',
            enabled: true,
            status: 'active'
          },
          {
            key: 'editor_theme_dark_plus',
            name: 'Dark+ Editor Theme',
            description: 'Enable enhanced dark theme for code editor',
            enabled: true,
            status: 'active'
          }
        ]

        return NextResponse.json({
          success: true,
          flags
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('experiment_api_error', {
      severity: 'medium',
      details: { error: (error as Error).message }
    })

    return NextResponse.json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, { status: 500 })
  }
}
