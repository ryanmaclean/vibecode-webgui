/**
 * Experiments API endpoint
 * Provides feature flag evaluation and experiment tracking
 * Inspired by Datadog's Eppo acquisition capabilities
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { featureFlagEngine, type ExperimentContext } from '@/lib/feature-flags'
import { appLogger } from '@/lib/server-monitoring'
import { z } from '@/lib/zod-compat'

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'

// Zod validation schemas
const experimentContextSchema = z.object({
  workspaceId: z.string().optional(),
  customAttributes: z.record(z.any()).optional()
})

const evaluateSchema = z.object({
  action: z.literal('evaluate'),
  flagKey: z.string().min(1).max(100),
  context: experimentContextSchema.optional(),
  defaultValue: z.boolean().optional()
})

const trackSchema = z.object({
  action: z.literal('track'),
  flagKey: z.string().min(1).max(100),
  metricName: z.string().min(1).max(100),
  value: z.number(),
  context: experimentContextSchema.optional()
})

const evaluateMultipleSchema = z.object({
  action: z.literal('evaluate_multiple'),
  flags: z.array(z.object({
    key: z.string().min(1).max(100),
    defaultValue: z.boolean().optional()
  })).min(1).max(20),
  context: experimentContextSchema.optional()
})

const experimentRequestSchema = z.discriminatedUnion('action', [
  evaluateSchema,
  trackSchema,
  evaluateMultipleSchema
])

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = experimentRequestSchema.parse(body)

    // Build experiment context
    const experimentContext: ExperimentContext = {
      userId: session.user.id,
      workspaceId: validatedData.context?.workspaceId,
      userAgent: request.headers.get('user-agent') || undefined,
      ipAddress: request.headers.get('x-forwarded-for') ||
                 request.headers.get('x-real-ip') ||
                 'unknown',
      customAttributes: validatedData.context?.customAttributes
    }

    switch (validatedData.action) {
      case 'evaluate':
        const result = await featureFlagEngine.evaluateFlag(
          validatedData.flagKey,
          experimentContext,
          validatedData.defaultValue
        )

        appLogger?.logBusiness?.('flag_evaluated_api', {
          userId: session.user.id,
          feature: 'experimentation',
          metadata: {
            flagKey: validatedData.flagKey,
            variant: result.variant,
            isExperiment: result.isExperiment
          }
        })

        return NextResponse.json({
          success: true,
          result
        })

      case 'track':
        await featureFlagEngine.trackMetric(
          validatedData.flagKey,
          validatedData.metricName,
          validatedData.value,
          experimentContext
        )

        appLogger?.logBusiness?.('metric_tracked_api', {
          userId: session.user.id,
          feature: 'experimentation',
          value: validatedData.value,
          metadata: {
            flagKey: validatedData.flagKey,
            metricName: validatedData.metricName
          }
        })

        return NextResponse.json({
          success: true,
          message: 'Metric tracked successfully'
        })

      case 'evaluate_multiple':
        const results = await Promise.all(
          validatedData.flags.map(async (flag) => {
            const result = await featureFlagEngine.evaluateFlag(
              flag.key,
              experimentContext,
              flag.defaultValue
            )
            return result
          })
        )

        appLogger?.logBusiness?.('multiple_flags_evaluated_api', {
          userId: session.user.id,
          feature: 'experimentation',
          metadata: {
            flagCount: validatedData.flags.length,
            flags: validatedData.flags.map(f => f.key)
          }
        })

        return NextResponse.json({
          success: true,
          results
        })
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request parameters',
        details: error.errors
      }, { status: 400 })
    }

    appLogger?.logSecurity?.('experiment_api_error', {
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

    const { searchParams } = new URL(request.url)
    const flagKey = searchParams.get('flagKey')
    const action = searchParams.get('action') || 'results'

    switch (action) {
      case 'results':
        if (!flagKey) {
          return NextResponse.json({ error: 'flagKey parameter is required' }, { status: 400 })
        }

        const experimentResults = await featureFlagEngine.getExperimentResults(flagKey)

        appLogger?.logBusiness?.('experiment_results_viewed', {
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
    appLogger?.logSecurity?.('experiment_api_error', {
      severity: 'medium',
      details: { error: (error as Error).message }
    })

    return NextResponse.json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, { status: 500 })
  }
}
