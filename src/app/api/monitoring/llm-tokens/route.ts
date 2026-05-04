/**
 * LLM Token Usage API Endpoint
 * Provides token consumption analytics for LLM operations
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkMonitoringAuth, getUnauthorizedResponse } from '@/lib/monitoring/auth'
import { cache, CacheTTL } from '@/lib/cache/unified-cache-client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Check authentication
  const authResult = await checkMonitoringAuth(request)
  if (!authResult.isAuthorized) {
    return getUnauthorizedResponse(authResult.error)
  }

  try {
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('range') || searchParams.get('timeframe') || '30d'
    const skipCache = searchParams.get('skip_cache') === 'true'

    const cacheKey = `monitoring:llm-tokens:${timeframe}`

    // Try cache first
    if (!skipCache) {
      const cached = await cache.get(cacheKey)
      if (cached) {
        return NextResponse.json({ ...cached, from_cache: true })
      }
    }

    // Fetch token data
    const tokenData = await getLLMTokenData(timeframe)

    // Cache the response
    if (!skipCache) {
      await cache.set(cacheKey, tokenData, CacheTTL.SHORT)
    }

    return NextResponse.json(tokenData)

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch LLM token data',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

async function getLLMTokenData(timeframe: string) {
  return {
    timestamp: new Date().toISOString(),
    timeRange: timeframe,
    data_available: false,
    message: 'Metrics collection requires a connected Datadog or metrics backend',
    totalTokens: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalRequests: 0,
    avgTokensPerRequest: 0,
    promptToCompletionRatio: 0,
    models: [],
    timeSeries: []
  }
}
