/**
 * LLM Operations API Endpoint
 * Provides comprehensive LLM operations metrics and monitoring data
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkMonitoringAuth, getUnauthorizedResponse } from '../../../../lib/monitoring/auth'
import { cache, CacheTTL } from '../../../../lib/cache/unified-cache-client'

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Check authentication first
  const authResult = await checkMonitoringAuth(request)
  if (!authResult.isAuthorized) {
    return getUnauthorizedResponse(authResult.error)
  }

  try {
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || '1h'
    const skipCache = searchParams.get('skip_cache') === 'true'

    // Cache key for LLM ops data
    const cacheKey = `monitoring:llm-ops:${timeframe}`

    // Try cache first for faster response times
    if (!skipCache) {
      const cached = await cache.get(cacheKey)
      if (cached) {
        return NextResponse.json({
          ...cached,
          from_cache: true,
          cache_hit: true,
          timestamp: new Date().toISOString()
        })
      }
    }

    // Parallel execution for optimal performance
    const startTime = Date.now()
    const [llmMetrics, providerStatus] = await Promise.allSettled([
      getLLMMetrics(timeframe),
      getProviderStatus()
    ])

    const processingTime = Date.now() - startTime
    const metrics = llmMetrics.status === 'fulfilled' ? llmMetrics.value : getDefaultMetrics()
    const providers = providerStatus.status === 'fulfilled' ? providerStatus.value : {}

    // Build response with comprehensive LLM operations data
    const response = {
      timestamp: new Date().toISOString(),
      timeframe,
      processing_time_ms: processingTime,
      from_cache: false,
      cache_hit: false,

      // LLM Request Metrics
      requests: {
        total: metrics.totalRequests,
        successful: metrics.successfulRequests,
        failed: metrics.failedRequests,
        success_rate: metrics.totalRequests > 0
          ? Math.round((metrics.successfulRequests / metrics.totalRequests) * 100)
          : 0
      },

      // Token Usage
      tokens: {
        total: metrics.totalTokens,
        prompt: metrics.promptTokens,
        completion: metrics.completionTokens,
        average_per_request: metrics.totalRequests > 0
          ? Math.round(metrics.totalTokens / metrics.totalRequests)
          : 0
      },

      // Performance Metrics
      performance: {
        average_latency_ms: metrics.averageLatency,
        p50_latency_ms: metrics.p50Latency,
        p95_latency_ms: metrics.p95Latency,
        p99_latency_ms: metrics.p99Latency,
        fastest_request_ms: metrics.fastestRequest,
        slowest_request_ms: metrics.slowestRequest
      },

      // Cost Tracking
      costs: {
        total: metrics.totalCost,
        currency: 'USD',
        average_per_request: metrics.totalRequests > 0
          ? (metrics.totalCost / metrics.totalRequests).toFixed(4)
          : '0.0000',
        by_provider: metrics.costByProvider
      },

      // Model Usage Distribution
      models: metrics.modelUsage,

      // Provider Status
      providers,

      // Error Analysis
      errors: {
        total: metrics.failedRequests,
        rate_limiting: metrics.rateLimitErrors,
        timeouts: metrics.timeoutErrors,
        authentication: metrics.authErrors,
        other: metrics.otherErrors,
        by_type: metrics.errorsByType
      },

      // Cache Performance (if applicable)
      cache_stats: {
        enabled: !skipCache,
        processing_time_ms: processingTime,
        parallel_execution: true
      }
    }

    // Cache the response for 30 seconds (balance between freshness and performance)
    if (!skipCache) {
      await cache.set(cacheKey, response, CacheTTL.SHORT / 2) // 30 seconds
    }

    return NextResponse.json(response)

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch LLM operations data',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Helper function to get LLM metrics
async function getLLMMetrics(timeframe: string): Promise<LLMMetrics> {
  try {
    // In production, this would query a metrics database or analytics service
    // For now, return placeholder data based on configuration
    const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY

    // Return configured vs not-configured metrics
    if (!hasOpenRouterKey && !hasOpenAIKey && !hasAnthropicKey) {
      return getDefaultMetrics()
    }

    // When API keys are configured, return placeholder for real metrics
    // In production, this would aggregate from a time-series database
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      averageLatency: 0,
      p50Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      fastestRequest: 0,
      slowestRequest: 0,
      totalCost: 0,
      costByProvider: [],
      modelUsage: [],
      rateLimitErrors: 0,
      timeoutErrors: 0,
      authErrors: 0,
      otherErrors: 0,
      errorsByType: []
    }
  } catch (error) {
    return getDefaultMetrics()
  }
}

// Helper function to get provider status
async function getProviderStatus(): Promise<Record<string, ProviderInfo>> {
  const providers: Record<string, ProviderInfo> = {}

  // Check OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    providers.openrouter = {
      configured: true,
      status: 'operational',
      models_available: ['anthropic/claude-3-opus', 'anthropic/claude-3-sonnet', 'openai/gpt-4']
    }
  } else {
    providers.openrouter = {
      configured: false,
      status: 'not_configured',
      models_available: []
    }
  }

  // Check OpenAI
  if (process.env.OPENAI_API_KEY) {
    providers.openai = {
      configured: true,
      status: 'operational',
      models_available: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
    }
  } else {
    providers.openai = {
      configured: false,
      status: 'not_configured',
      models_available: []
    }
  }

  // Check Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    providers.anthropic = {
      configured: true,
      status: 'operational',
      models_available: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku']
    }
  } else {
    providers.anthropic = {
      configured: false,
      status: 'not_configured',
      models_available: []
    }
  }

  return providers
}

// Helper function to get default metrics
function getDefaultMetrics(): LLMMetrics {
  return {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    averageLatency: 0,
    p50Latency: 0,
    p95Latency: 0,
    p99Latency: 0,
    fastestRequest: 0,
    slowestRequest: 0,
    totalCost: 0,
    costByProvider: [],
    modelUsage: [],
    rateLimitErrors: 0,
    timeoutErrors: 0,
    authErrors: 0,
    otherErrors: 0,
    errorsByType: []
  }
}

// Type definitions
interface LLMMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  totalTokens: number
  promptTokens: number
  completionTokens: number
  averageLatency: number
  p50Latency: number
  p95Latency: number
  p99Latency: number
  fastestRequest: number
  slowestRequest: number
  totalCost: number
  costByProvider: Array<{ provider: string; cost: number }>
  modelUsage: Array<{ model: string; count: number; tokens: number }>
  rateLimitErrors: number
  timeoutErrors: number
  authErrors: number
  otherErrors: number
  errorsByType: Array<{ type: string; count: number }>
}

interface ProviderInfo {
  configured: boolean
  status: 'operational' | 'not_configured' | 'degraded' | 'error'
  models_available: string[]
}
