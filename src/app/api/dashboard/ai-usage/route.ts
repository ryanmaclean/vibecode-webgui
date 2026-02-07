// STUB: Returns mock data
/**
 * Dashboard AI Usage Metrics API Endpoint
 * Provides AI model usage, costs, and performance metrics
 *
 * Enhanced Monitoring Dashboards feature (AGENT 97)
 * Protected with admin-only authentication (hq-018)
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkDashboardAuth, getDashboardUnauthorizedResponse } from '@/lib/monitoring/auth'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface ProviderUsage {
  requests: number
  tokens: {
    input: number
    output: number
    total: number
  }
  cost: number
  avgLatency: number
}

interface ModelUsage {
  name: string
  requests: number
  tokens: number
  avgLatency: number
  cost: number
}

interface AIUsageMetrics {
  timestamp: string
  timeRange: string
  providers: Record<string, ProviderUsage>
  models: ModelUsage[]
  totalCost: number
  totalTokens: number
  totalRequests: number
  costByProvider: Array<{
    provider: string
    cost: number
    percentage: number
  }>
}

export async function GET(request: NextRequest) {
  // Check admin authentication
  const authResult = await checkDashboardAuth(request)
  if (!authResult.isAuthorized) {
    return getDashboardUnauthorizedResponse(authResult.error)
  }

  try {
    // In a production environment, this would aggregate data from:
    // - AI request logs
    // - Provider API usage tracking
    // - Cost calculation service
    // - Performance monitoring metrics

    // For demo purposes, generate mock data based on realistic usage patterns
    const metrics = generateMockAIUsage()

    return NextResponse.json(metrics, { status: 200 })
  } catch (error) {
    console.error('Dashboard AI usage API error:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch AI usage metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Helper function to generate mock AI usage data
function generateMockAIUsage(): AIUsageMetrics {
  const timestamp = new Date().toISOString()

  // Mock provider usage
  const providers: Record<string, ProviderUsage> = {
    openrouter: {
      requests: Math.floor(Math.random() * 500) + 200,
      tokens: {
        input: Math.floor(Math.random() * 50000) + 10000,
        output: Math.floor(Math.random() * 30000) + 8000,
        total: 0 // Will calculate below
      },
      cost: 0, // Will calculate below
      avgLatency: Math.floor(Math.random() * 2000) + 800
    },
    anthropic: {
      requests: Math.floor(Math.random() * 400) + 150,
      tokens: {
        input: Math.floor(Math.random() * 40000) + 8000,
        output: Math.floor(Math.random() * 25000) + 6000,
        total: 0
      },
      cost: 0,
      avgLatency: Math.floor(Math.random() * 1500) + 600
    },
    openai: {
      requests: Math.floor(Math.random() * 300) + 100,
      tokens: {
        input: Math.floor(Math.random() * 35000) + 7000,
        output: Math.floor(Math.random() * 20000) + 5000,
        total: 0
      },
      cost: 0,
      avgLatency: Math.floor(Math.random() * 1800) + 700
    }
  }

  // Calculate total tokens and costs for each provider
  // Using approximate pricing: $0.03 per 1K input tokens, $0.06 per 1K output tokens
  Object.values(providers).forEach(provider => {
    provider.tokens.total = provider.tokens.input + provider.tokens.output
    provider.cost = (provider.tokens.input / 1000) * 0.03 + (provider.tokens.output / 1000) * 0.06
  })

  // Mock top models usage
  const models: ModelUsage[] = [
    {
      name: 'claude-3.5-sonnet',
      requests: Math.floor(Math.random() * 300) + 150,
      tokens: Math.floor(Math.random() * 40000) + 15000,
      avgLatency: Math.floor(Math.random() * 1500) + 700,
      cost: 0
    },
    {
      name: 'gpt-4-turbo',
      requests: Math.floor(Math.random() * 200) + 100,
      tokens: Math.floor(Math.random() * 30000) + 12000,
      avgLatency: Math.floor(Math.random() * 2000) + 800,
      cost: 0
    },
    {
      name: 'gpt-3.5-turbo',
      requests: Math.floor(Math.random() * 250) + 120,
      tokens: Math.floor(Math.random() * 35000) + 10000,
      avgLatency: Math.floor(Math.random() * 1000) + 500,
      cost: 0
    },
    {
      name: 'claude-3-opus',
      requests: Math.floor(Math.random() * 150) + 80,
      tokens: Math.floor(Math.random() * 25000) + 8000,
      avgLatency: Math.floor(Math.random() * 1800) + 900,
      cost: 0
    },
    {
      name: 'llama-3-70b',
      requests: Math.floor(Math.random() * 180) + 90,
      tokens: Math.floor(Math.random() * 28000) + 9000,
      avgLatency: Math.floor(Math.random() * 1200) + 600,
      cost: 0
    }
  ]

  // Calculate costs for models (using average pricing)
  models.forEach(model => {
    model.cost = (model.tokens / 1000) * 0.045 // Average cost per 1K tokens
  })

  // Calculate totals
  const totalCost = Object.values(providers).reduce((sum, p) => sum + p.cost, 0)
  const totalTokens = Object.values(providers).reduce((sum, p) => sum + p.tokens.total, 0)
  const totalRequests = Object.values(providers).reduce((sum, p) => sum + p.requests, 0)

  // Calculate cost by provider percentages
  const costByProvider = Object.entries(providers).map(([name, provider]) => ({
    provider: name,
    cost: provider.cost,
    percentage: (provider.cost / totalCost) * 100
  })).sort((a, b) => b.cost - a.cost)

  return {
    timestamp,
    timeRange: '24h',
    providers,
    models,
    totalCost,
    totalTokens,
    totalRequests,
    costByProvider
  }
}
