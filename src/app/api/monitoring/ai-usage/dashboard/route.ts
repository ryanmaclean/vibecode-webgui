/**
 * AI Usage Monitoring Dashboard API
 * Provides real-time AI model usage metrics, alerts, and cost tracking
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkMonitoringAuth, getUnauthorizedResponse } from '../../../../../lib/monitoring/auth'
import { aiUsageMonitor } from '../../../../../lib/monitoring/ai-usage-monitor'
import { createAPIRateLimit } from '@/lib/rate-limiting'

const apiRateLimit = createAPIRateLimit(120) // 120 requests per minute - monitoring data

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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
  const authResult = await checkMonitoringAuth(request)
  if (!authResult.isAuthorized) {
    return getUnauthorizedResponse(authResult.error)
  }

  try {
    const { searchParams } = new URL(request.url)
    const providerName = searchParams.get('provider')
    const modelName = searchParams.get('model')
    const includeHistory = searchParams.get('history') === 'true'
    const historyLimit = parseInt(searchParams.get('limit') || '100')

    // Return specific provider/model data
    if (providerName && modelName) {
      const providerMetrics = aiUsageMonitor.getProviderMetrics(providerName, modelName)
      if (!providerMetrics) {
        return NextResponse.json(
          { error: `Provider '${providerName}' with model '${modelName}' not found` },
          { status: 404 }
        )
      }

      const response: any = {
        provider: providerMetrics,
        timestamp: new Date().toISOString()
      }

      if (includeHistory) {
        response.history = aiUsageMonitor.getProviderHistory(providerName, modelName, historyLimit)
      }

      return NextResponse.json(response)
    }

    // Return dashboard overview
    const systemOverview = aiUsageMonitor.getSystemOverview()
    const allProviders = aiUsageMonitor.getAllProviderMetrics()
    const activeAlerts = aiUsageMonitor.getActiveAlerts()
    const capacityReports = aiUsageMonitor.generateCapacityReport()

    const dashboardData = {
      overview: systemOverview,
      providers: allProviders.map(provider => ({
        ...provider,
        alerts: activeAlerts.filter(alert =>
          alert.provider_name === provider.provider_name &&
          alert.model_name === provider.model_name
        )
      })),
      alerts: {
        active: activeAlerts,
        critical: activeAlerts.filter(a => a.severity === 'critical'),
        warning: activeAlerts.filter(a => a.severity === 'warning')
      },
      capacity_planning: capacityReports,
      recommendations: generateRecommendations(allProviders, activeAlerts, capacityReports),
      timestamp: new Date().toISOString()
    }

    // Include history for critical providers if requested
    if (includeHistory) {
      const criticalProviders = allProviders.filter(p => p.health_status === 'critical')
      dashboardData.providers = dashboardData.providers.map(provider => {
        if (criticalProviders.some(cp =>
          cp.provider_name === provider.provider_name &&
          cp.model_name === provider.model_name
        )) {
          return {
            ...provider,
            history: aiUsageMonitor.getProviderHistory(
              provider.provider_name,
              provider.model_name,
              historyLimit
            )
          }
        }
        return provider
      })
    }

    return NextResponse.json(dashboardData)

  } catch (error) {
    console.error('AI usage dashboard error:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch AI usage data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

/**
 * Generate actionable recommendations based on current state
 */
function generateRecommendations(providers: any[], _alerts: any[], capacityReports: any[]) {
  const recommendations: Array<{
    type: 'cost_optimization' | 'performance' | 'alert' | 'rate_limiting'
    priority: 'high' | 'medium' | 'low'
    provider_name?: string
    model_name?: string
    message: string
    action: string
  }> = []

  // Check for providers with high error rates
  providers.forEach(provider => {
    if (provider.error_rate_percent >= 10) {
      recommendations.push({
        type: 'performance',
        priority: provider.error_rate_percent >= 15 ? 'high' : 'medium',
        provider_name: provider.provider_name,
        model_name: provider.model_name,
        message: `Provider '${provider.provider_name}/${provider.model_name}' has ${provider.error_rate_percent}% error rate`,
        action: 'Investigate API issues, check rate limits, or consider failover to alternate provider'
      })
    }
  })

  // Check for high rate limit utilization
  providers.forEach(provider => {
    if (provider.rate_limit_utilization_percent >= 80) {
      recommendations.push({
        type: 'rate_limiting',
        priority: 'high',
        provider_name: provider.provider_name,
        model_name: provider.model_name,
        message: `Provider '${provider.provider_name}/${provider.model_name}' is ${provider.rate_limit_utilization_percent}% of rate limit`,
        action: 'Implement request queuing, add caching, or upgrade API tier'
      })
    }
  })

  // Check capacity reports for cost optimization
  capacityReports.forEach(report => {
    if (report.estimated_monthly_cost_usd > 1000) {
      recommendations.push({
        type: 'cost_optimization',
        priority: report.estimated_monthly_cost_usd > 5000 ? 'high' : 'medium',
        provider_name: report.provider_name,
        model_name: report.model_name,
        message: `Provider '${report.provider_name}/${report.model_name}' estimated monthly cost: $${report.estimated_monthly_cost_usd}`,
        action: 'Consider implementing response caching, request batching, or using a more cost-effective model'
      })
    }

    if (report.growth_trend === 'increasing' && report.rate_limit_headroom < 30) {
      recommendations.push({
        type: 'rate_limiting',
        priority: 'high',
        provider_name: report.provider_name,
        model_name: report.model_name,
        message: `Provider '${report.provider_name}/${report.model_name}' shows increasing usage trend with only ${report.rate_limit_headroom}% headroom`,
        action: report.projected_rate_limit_exhaustion
          ? `Projected exhaustion in ${report.projected_rate_limit_exhaustion} - upgrade tier immediately`
          : 'Monitor closely and prepare to upgrade API tier'
      })
    }
  })

  // Check for slow response times
  providers.forEach(provider => {
    if (provider.average_response_time_ms > 5000) {
      recommendations.push({
        type: 'performance',
        priority: provider.average_response_time_ms > 10000 ? 'high' : 'medium',
        provider_name: provider.provider_name,
        model_name: provider.model_name,
        message: `Provider '${provider.provider_name}/${provider.model_name}' has slow response time: ${provider.average_response_time_ms}ms`,
        action: 'Consider switching to a faster model, implementing timeout handling, or using async processing'
      })
    }
  })

  // Check for high token usage
  providers.forEach(provider => {
    if (provider.tokens_per_minute > 50000) {
      const dailyCost = capacityReports.find(r =>
        r.provider_name === provider.provider_name &&
        r.model_name === provider.model_name
      )?.estimated_daily_cost_usd || 0

      recommendations.push({
        type: 'cost_optimization',
        priority: dailyCost > 100 ? 'high' : 'medium',
        provider_name: provider.provider_name,
        model_name: provider.model_name,
        message: `Provider '${provider.provider_name}/${provider.model_name}' has high token usage: ${provider.tokens_per_minute.toLocaleString()} tokens/min`,
        action: 'Optimize prompts to reduce token count, implement caching, or consider a more efficient model'
      })
    }
  })

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return recommendations
}
