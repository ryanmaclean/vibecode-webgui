/**
 * AI Metrics Aggregation API Endpoint
 * Provides comprehensive AI operations metrics including token usage,
 * latency histograms, error rates, and cost tracking by model and provider
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkMonitoringAuth, getUnauthorizedResponse } from '@/lib/monitoring/auth'
import { cache, CacheTTL } from '@/lib/cache/unified-cache-client'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Check authentication
  const authResult = await checkMonitoringAuth(request)
  if (!authResult.isAuthorized) {
    return getUnauthorizedResponse(authResult.error)
  }

  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '24h'
    const model = searchParams.get('model') // optional filter
    const provider = searchParams.get('provider') // optional filter
    const skipCache = searchParams.get('skip_cache') === 'true'

    const cacheKey = `monitoring:ai-metrics:${period}:${model || 'all'}:${provider || 'all'}`

    // Try cache first
    if (!skipCache) {
      const cached = await cache.get(cacheKey)
      if (cached) {
        return NextResponse.json({ ...cached, from_cache: true })
      }
    }

    // Fetch aggregated AI metrics
    const metricsData = await getAIMetrics(period, model, provider)

    // Cache the response
    if (!skipCache) {
      await cache.set(cacheKey, metricsData, CacheTTL.SHORT)
    }

    return NextResponse.json(metricsData)

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch AI metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * Parse period string to Date object
 * Supports: 1h, 6h, 12h, 24h, 7d, 30d, 90d
 */
function parsePeriodToDate(period: string): Date {
  const now = new Date()
  const match = period.match(/^(\d+)([hd])$/)

  if (!match) {
    // Default to 24 hours if invalid format
    return new Date(now.getTime() - 24 * 60 * 60 * 1000)
  }

  const value = parseInt(match[1])
  const unit = match[2]

  if (unit === 'h') {
    return new Date(now.getTime() - value * 60 * 60 * 1000)
  } else if (unit === 'd') {
    return new Date(now.getTime() - value * 24 * 60 * 60 * 1000)
  }

  return new Date(now.getTime() - 24 * 60 * 60 * 1000)
}

/**
 * Calculate percentile from sorted array
 */
function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1
  return sortedValues[Math.max(0, index)]
}

/**
 * Fetch and aggregate AI metrics from database
 */
async function getAIMetrics(
  period: string,
  modelFilter?: string | null,
  providerFilter?: string | null
) {
  const startDate = parsePeriodToDate(period)

  // Build filter conditions
  const whereClause: {
    created_at: { gte: Date }
    model?: string
    provider?: string
  } = {
    created_at: { gte: startDate }
  }

  if (modelFilter) {
    whereClause.model = modelFilter
  }

  if (providerFilter) {
    whereClause.provider = providerFilter
  }

  // Fetch all AI requests within the time period
  const requests = await prisma.aIRequest.findMany({
    where: whereClause,
    select: {
      id: true,
      model: true,
      provider: true,
      request_type: true,
      input_tokens: true,
      output_tokens: true,
      cost: true,
      duration_ms: true,
      status: true,
      error: true,
      created_at: true
    },
    orderBy: {
      created_at: 'desc'
    }
  })

  // Initialize aggregation structures
  const totalRequests = requests.length
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCost = 0
  let errorCount = 0
  const latencies: number[] = []

  // Model-level aggregations
  const modelStats = new Map<string, {
    requestCount: number
    inputTokens: number
    outputTokens: number
    cost: number
    errors: number
    latencies: number[]
  }>()

  // Provider-level aggregations
  const providerStats = new Map<string, {
    requestCount: number
    inputTokens: number
    outputTokens: number
    cost: number
    errors: number
  }>()

  // Request type aggregations
  const requestTypeStats = new Map<string, {
    count: number
    avgLatency: number
    latencies: number[]
  }>()

  // Process each request
  requests.forEach(req => {
    // Global aggregations
    totalInputTokens += req.input_tokens || 0
    totalOutputTokens += req.output_tokens || 0
    totalCost += req.cost || 0

    if (req.status !== 'completed') {
      errorCount++
    }

    if (req.duration_ms) {
      latencies.push(req.duration_ms)
    }

    // Model aggregations
    if (!modelStats.has(req.model)) {
      modelStats.set(req.model, {
        requestCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        errors: 0,
        latencies: []
      })
    }
    const modelStat = modelStats.get(req.model)!
    modelStat.requestCount++
    modelStat.inputTokens += req.input_tokens || 0
    modelStat.outputTokens += req.output_tokens || 0
    modelStat.cost += req.cost || 0
    if (req.status !== 'completed') modelStat.errors++
    if (req.duration_ms) modelStat.latencies.push(req.duration_ms)

    // Provider aggregations
    if (!providerStats.has(req.provider)) {
      providerStats.set(req.provider, {
        requestCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        errors: 0
      })
    }
    const providerStat = providerStats.get(req.provider)!
    providerStat.requestCount++
    providerStat.inputTokens += req.input_tokens || 0
    providerStat.outputTokens += req.output_tokens || 0
    providerStat.cost += req.cost || 0
    if (req.status !== 'completed') providerStat.errors++

    // Request type aggregations
    if (!requestTypeStats.has(req.request_type)) {
      requestTypeStats.set(req.request_type, {
        count: 0,
        avgLatency: 0,
        latencies: []
      })
    }
    const reqTypeStat = requestTypeStats.get(req.request_type)!
    reqTypeStat.count++
    if (req.duration_ms) reqTypeStat.latencies.push(req.duration_ms)
  })

  // Calculate latency percentiles
  const sortedLatencies = latencies.sort((a, b) => a - b)
  const p50Latency = calculatePercentile(sortedLatencies, 50)
  const p95Latency = calculatePercentile(sortedLatencies, 95)
  const p99Latency = calculatePercentile(sortedLatencies, 99)
  const avgLatency = latencies.length > 0
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length
    : 0

  // Format model breakdown
  const modelBreakdown = Array.from(modelStats.entries()).map(([model, stats]) => {
    const sortedModelLatencies = stats.latencies.sort((a, b) => a - b)
    const avgCostPerRequest = stats.requestCount > 0 ? stats.cost / stats.requestCount : 0
    const avgCostPerToken = (stats.inputTokens + stats.outputTokens) > 0
      ? stats.cost / (stats.inputTokens + stats.outputTokens)
      : 0

    return {
      model,
      requestCount: stats.requestCount,
      totalInputTokens: stats.inputTokens,
      totalOutputTokens: stats.outputTokens,
      totalTokens: stats.inputTokens + stats.outputTokens,
      totalCost: stats.cost,
      errorRate: stats.requestCount > 0 ? stats.errors / stats.requestCount : 0,
      avgLatency: stats.latencies.length > 0
        ? stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length
        : 0,
      p95Latency: calculatePercentile(sortedModelLatencies, 95),
      // Add derived cost fields
      avgCostPerRequest,
      avgCostPerToken,
      costPercentage: 0  // Will be calculated below
    }
  }).sort((a, b) => b.requestCount - a.requestCount) // Sort by request count desc

  // Calculate cost percentages after all models are processed
  const totalModelCost = modelBreakdown.reduce((sum, m) => sum + m.totalCost, 0)
  modelBreakdown.forEach(m => {
    m.costPercentage = totalModelCost > 0 ? (m.totalCost / totalModelCost) * 100 : 0
  })

  // Format provider breakdown
  const providerBreakdown = Array.from(providerStats.entries()).map(([provider, stats]) => ({
    provider,
    requestCount: stats.requestCount,
    totalInputTokens: stats.inputTokens,
    totalOutputTokens: stats.outputTokens,
    totalTokens: stats.inputTokens + stats.outputTokens,
    totalCost: stats.cost,
    errorRate: stats.requestCount > 0 ? stats.errors / stats.requestCount : 0
  })).sort((a, b) => b.requestCount - a.requestCount)

  // Format request type breakdown
  const requestTypeBreakdown = Array.from(requestTypeStats.entries()).map(([type, stats]) => ({
    requestType: type,
    count: stats.count,
    avgLatency: stats.latencies.length > 0
      ? stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length
      : 0
  })).sort((a, b) => b.count - a.count)

  // Create time series data (hourly buckets)
  const timeSeries = createTimeSeries(requests, startDate)

  return {
    timestamp: new Date().toISOString(),
    period,
    startDate: startDate.toISOString(),
    endDate: new Date().toISOString(),

    // Overall metrics
    overview: {
      totalRequests,
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      totalCost,
      errorCount,
      errorRate: totalRequests > 0 ? errorCount / totalRequests : 0,
      avgCostPerRequest: totalRequests > 0 ? totalCost / totalRequests : 0,
      avgTokensPerRequest: totalRequests > 0
        ? (totalInputTokens + totalOutputTokens) / totalRequests
        : 0
    },

    // Latency metrics
    latency: {
      avgLatency,
      p50Latency,
      p95Latency,
      p99Latency,
      minLatency: sortedLatencies.length > 0 ? sortedLatencies[0] : 0,
      maxLatency: sortedLatencies.length > 0 ? sortedLatencies[sortedLatencies.length - 1] : 0,
      histogram: createLatencyHistogram(sortedLatencies)
    },

    // Breakdowns
    byModel: modelBreakdown,
    byProvider: providerBreakdown,
    byRequestType: requestTypeBreakdown,

    // Time series
    timeSeries
  }
}

/**
 * Create latency histogram with buckets
 */
function createLatencyHistogram(sortedLatencies: number[]) {
  const buckets = [
    { range: '0-100ms', min: 0, max: 100, count: 0 },
    { range: '100-500ms', min: 100, max: 500, count: 0 },
    { range: '500-1000ms', min: 500, max: 1000, count: 0 },
    { range: '1-2s', min: 1000, max: 2000, count: 0 },
    { range: '2-5s', min: 2000, max: 5000, count: 0 },
    { range: '5-10s', min: 5000, max: 10000, count: 0 },
    { range: '10s+', min: 10000, max: Infinity, count: 0 }
  ]

  sortedLatencies.forEach(latency => {
    for (const bucket of buckets) {
      if (latency >= bucket.min && latency < bucket.max) {
        bucket.count++
        break
      }
    }
  })

  return buckets
}

/**
 * Create time series data with hourly buckets
 */
function createTimeSeries(
  requests: Array<{
    created_at: Date
    input_tokens: number | null
    output_tokens: number | null
    cost: number | null
    status: string
  }>,
  startDate: Date
) {
  const now = new Date()
  const hourlyBuckets = new Map<string, {
    timestamp: string
    requestCount: number
    tokenCount: number
    cost: number
    errors: number
  }>()

  // Initialize hourly buckets
  const bucketCount = Math.ceil((now.getTime() - startDate.getTime()) / (60 * 60 * 1000))
  for (let i = 0; i < bucketCount; i++) {
    const bucketTime = new Date(startDate.getTime() + i * 60 * 60 * 1000)
    const bucketKey = bucketTime.toISOString().slice(0, 13) + ':00:00.000Z'
    hourlyBuckets.set(bucketKey, {
      timestamp: bucketKey,
      requestCount: 0,
      tokenCount: 0,
      cost: 0,
      errors: 0
    })
  }

  // Fill buckets with data
  requests.forEach(req => {
    const bucketKey = req.created_at.toISOString().slice(0, 13) + ':00:00.000Z'
    const bucket = hourlyBuckets.get(bucketKey)
    if (bucket) {
      bucket.requestCount++
      bucket.tokenCount += (req.input_tokens || 0) + (req.output_tokens || 0)
      bucket.cost += req.cost || 0
      if (req.status !== 'completed') {
        bucket.errors++
      }
    }
  })

  return Array.from(hourlyBuckets.values()).sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  )
}
