import { NextRequest, NextResponse } from 'next/server'
import { checkMonitoringAuth, getUnauthorizedResponse } from '@/lib/monitoring/auth'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
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
