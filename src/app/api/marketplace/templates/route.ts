import { NextRequest, NextResponse } from 'next/server'
import { checkMonitoringAuth, getUnauthorizedResponse } from '@/lib/monitoring/auth'

export const dynamic = 'force-dynamic'

/**
 * Marketplace templates API endpoint.
 *
 * Returns the full response schema expected by the TemplateMarketplace UI
 * component and any other consumers. When no backend is configured, this
 * returns structurally valid empty collections so the UI can render its
 * empty state without errors.
 */
export async function GET(request: NextRequest): Promise<NextResponse | Response> {
  const authResult = await checkMonitoringAuth(request)
  if (!authResult.isAuthorized) {
    return getUnauthorizedResponse(authResult.error)
  }

  return NextResponse.json({
    templates: [],
    categories: [
      { id: 'frontend', name: 'Frontend', count: 0 },
      { id: 'backend', name: 'Backend', count: 0 },
      { id: 'fullstack', name: 'Fullstack', count: 0 },
      { id: 'mobile', name: 'Mobile', count: 0 },
      { id: 'desktop', name: 'Desktop', count: 0 },
      { id: 'library', name: 'Library', count: 0 },
    ],
    featured: [],
    total: 0,
  })
}
