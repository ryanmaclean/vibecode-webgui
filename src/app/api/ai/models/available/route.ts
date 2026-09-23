import { NextRequest, NextResponse } from 'next/server'
import { checkMonitoringAuth, getUnauthorizedResponse } from '@/lib/monitoring/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse | Response> {
  const authResult = await checkMonitoringAuth(request)
  if (!authResult.isAuthorized) {
    return getUnauthorizedResponse(authResult.error)
  }
  return NextResponse.json({ models: [] })
}
