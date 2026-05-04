/**
 * LLM Latency API Endpoint
 * Provides latency and performance metrics for LLM operations
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
    const timeframe = searchParams.get('range') || searchParams.get('timeframe') || '1h'
    const model = searchParams.get('modelId') || searchParams.get('model') // optional filter
    const skipCache = searchParams.get('skip_cache') === 'true'

    const cacheKey = `monitoring:llm-latency:${timeframe}:${model || 'all'}`

    // Try cache first
    if (!skipCache) {
      const cached = await cache.get(cacheKey)
      if (cached) {
        return NextResponse.json({ ...cached, from_cache: true })
      }
    }

    // Fetch latency data
    const latencyData = await getLLMLatencyData(timeframe, model)

    // Cache the response
    if (!skipCache) {
      await cache.set(cacheKey, latencyData, CacheTTL.SHORT)
    }

    return NextResponse.json(latencyData)

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch LLM latency data',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

async function getLLMLatencyData(timeframe: string, model?: string | null) {
  return {
    timestamp: new Date().toISOString(),
    timeRange: timeframe,
    model: model || undefined,
    data_available: false,
    message: 'Metrics collection requires a connected Datadog or metrics backend',
    metrics: {
      avgLatency: 0,
      p50Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      minLatency: 0,
      maxLatency: 0,
    },
    dataPoints: []
  }
}
