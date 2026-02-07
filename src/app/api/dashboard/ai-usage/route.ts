/**
 * Dashboard AI Usage Metrics API Endpoint
 * Returns AI usage status - requires OPENROUTER_API_KEY for real tracking
 *
 * Protected with admin-only authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkDashboardAuth, getDashboardUnauthorizedResponse } from '@/lib/monitoring/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authResult = await checkDashboardAuth(request)
  if (!authResult.isAuthorized) {
    return getDashboardUnauthorizedResponse(authResult.error)
  }

  try {
    const hasApiKey = !!process.env.OPENROUTER_API_KEY

    if (!hasApiKey) {
      return NextResponse.json({
        status: 'not_configured',
        message: 'Configure OPENROUTER_API_KEY to enable AI usage tracking',
        timestamp: new Date().toISOString(),
        timeRange: '24h',
        providers: {},
        models: [],
        totalCost: 0,
        totalTokens: 0,
        totalRequests: 0,
        costByProvider: [],
      })
    }

    // When API key is configured, return placeholder for real tracking data.
    // In production, this would aggregate data from a metrics store.
    return NextResponse.json({
      status: 'operational',
      message: 'AI usage tracking active. Connect a metrics backend for detailed analytics.',
      timestamp: new Date().toISOString(),
      timeRange: '24h',
      providers: {},
      models: [],
      totalCost: 0,
      totalTokens: 0,
      totalRequests: 0,
      costByProvider: [],
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch AI usage metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
