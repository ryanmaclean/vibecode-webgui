/**
 * Experiments API Route
 * Handles feature flag evaluation and experiment tracking
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { featureFlagEngine } from '@/lib/feature-flags'
import { appLogger } from '@/lib/server-monitoring'
import type { ExperimentContext } from '@/lib/feature-flags'
import { createAPIRateLimit } from '@/lib/rate-limiting'
import { createServiceLogger } from '@/lib/logging'
import { CACHE_HEADER_PRESETS, withCacheStatus } from '@/lib/cache/http-cache-headers'

const logger = createServiceLogger({ service: 'vibecode-webgui', component: 'experiments' });

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(30) // 30 requests per minute

/**
 * Server-side in-memory cache for the experiments list action
 * TTL matches the HTTP Cache-Control max-age (2 minutes)
 */
const EXPERIMENTS_LIST_CACHE_TTL_MS = 120 * 1000 // 2 minutes

interface ExperimentsListCacheEntry {
  data: { flags: unknown[] }
  cachedAt: number
}

let experimentsListCache: ExperimentsListCacheEntry | null = null

/**
 * POST /api/experiments
 * Actions: evaluate, track, evaluate_multiple
 */
export async function POST(request: NextRequest) {
  try {
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

    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action, flagKey, metricName, value, context, flags } = body

    // Build experiment context from request
    const experimentContext: ExperimentContext = {
      userId: session.user.id || session.user.email || 'unknown',
      workspaceId: context?.workspaceId,
      userAgent: request.headers.get('user-agent') || undefined,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      customAttributes: context?.customAttributes
    }

    switch (action) {
      case 'evaluate': {
        if (!flagKey) {
          return NextResponse.json(
            { error: 'Missing flagKey parameter' },
            { status: 400 }
          )
        }

        const result = await featureFlagEngine.evaluateFlag(
          flagKey,
          experimentContext,
          context?.defaultValue
        )

        appLogger.logBusiness('feature_flag_evaluated', {
          feature: 'experiments',
          userId: experimentContext.userId,
          metadata: { flagKey, variant: result.variant }
        })

        return NextResponse.json(result, { status: 200 })
      }

      case 'track': {
        if (!flagKey || !metricName || value === undefined) {
          return NextResponse.json(
            { error: 'Missing required parameters: flagKey, metricName, value' },
            { status: 400 }
          )
        }

        await featureFlagEngine.trackMetric(
          flagKey,
          metricName,
          value,
          experimentContext
        )

        appLogger.logBusiness('experiment_metric_tracked', {
          feature: 'experiments',
          userId: experimentContext.userId,
          metadata: { flagKey, metricName, value }
        })

        return NextResponse.json({ success: true }, { status: 200 })
      }

      case 'evaluate_multiple': {
        if (!flags || !Array.isArray(flags)) {
          return NextResponse.json(
            { error: 'Missing or invalid flags parameter' },
            { status: 400 }
          )
        }

        const results = await Promise.all(
          flags.map(flag =>
            featureFlagEngine.evaluateFlag(
              flag.key,
              experimentContext,
              flag.defaultValue
            )
          )
        )

        appLogger.logBusiness('multiple_flags_evaluated', {
          feature: 'experiments',
          userId: experimentContext.userId,
          metadata: { flagCount: flags.length }
        })

        return NextResponse.json({ results }, { status: 200 })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    logger.error('Experiments API POST error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/experiments
 * Actions: results, list
 * Requires admin role
 */
export async function GET(request: NextRequest) {
  try {
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

    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check admin role
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const flagKey = searchParams.get('flagKey')

    switch (action) {
      case 'results': {
        if (!flagKey) {
          return NextResponse.json(
            { error: 'Missing flagKey parameter' },
            { status: 400 }
          )
        }

        const results = await featureFlagEngine.getExperimentResults(flagKey)

        appLogger.logBusiness('experiment_results_retrieved', {
          feature: 'experiments',
          userId: session.user.id || session.user.email || 'unknown',
          metadata: { flagKey }
        })

        return NextResponse.json(results, { status: 200 })
      }

      case 'list': {
        // Check server-side cache first
        const now = Date.now()
        const isCacheValid =
          experimentsListCache !== null &&
          now - experimentsListCache.cachedAt < EXPERIMENTS_LIST_CACHE_TTL_MS

        let responseData: { flags: unknown[] }
        let fromCache: boolean

        if (isCacheValid && experimentsListCache) {
          responseData = experimentsListCache.data
          fromCache = true
        } else {
          // Fetch fresh data and populate cache
          responseData = { flags: [] }
          experimentsListCache = { data: responseData, cachedAt: now }
          fromCache = false
        }

        appLogger.logBusiness('feature_flags_listed', {
          feature: 'experiments',
          userId: session.user.id || session.user.email || 'unknown',
          metadata: { fromCache }
        })

        return NextResponse.json(responseData, {
          status: 200,
          headers: withCacheStatus(CACHE_HEADER_PRESETS.EXPERIMENTS_CONFIG, fromCache ? 'HIT' : 'MISS'),
        })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    logger.error('Experiments API GET error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
