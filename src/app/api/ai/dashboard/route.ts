import { NextRequest, NextResponse } from 'next/server'
import { checkMonitoringAuth, getUnauthorizedResponse } from '@/lib/monitoring/auth'
import { createAPIRateLimit } from '@/lib/rate-limiting'

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(60)

export async function GET(request: NextRequest) {
  const authResult = await checkMonitoringAuth(request)
  if (!authResult.isAuthorized) {
    return getUnauthorizedResponse(authResult.error)
  }
  // return empty data
  return NextResponse.json({
    recentActivity: [],
    usageStats: {
      requestsToday: '0',
      avgResponseTime: '0s',
      topModel: 'N/A'
    }
  })
}
