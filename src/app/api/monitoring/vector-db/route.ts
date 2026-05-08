/**
 * Monitoring Vector DB API Route
 * Provides vector database collection, query, and index health data
 * for the monitoring vector database viewer.
 *
 * Currently returns empty arrays — will be wired to a real vector DB
 * monitoring source in the future.
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkMonitoringAuth, getUnauthorizedResponse } from '@/lib/monitoring/auth'
import { createAPIRateLimit } from '@/lib/rate-limiting'

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(120) // 120 requests per minute

// ── Response interfaces ───────────────────────────────────────────────────

export interface CollectionResponse {
  name: string
  vectorCount: number
  dimensions: number
  indexType: 'HNSW' | 'IVFFlat'
  diskUsageMB: number
  status: 'healthy' | 'warning' | 'rebuilding'
  lastUpdated: string
}

export interface RecentQueryResponse {
  id: string
  queryPreview: string
  collection: string
  similarityScore: number
  latencyMs: number
  resultsCount: number
  timestamp: string
}

export interface IndexHealthResponse {
  collection: string
  fragmentationPct: number
  lastRebuild: string
  suggestion: string
}

export interface VectorDBResponse {
  collections: CollectionResponse[]
  queries: RecentQueryResponse[]
  indexHealth: IndexHealthResponse[]
}

/**
 * GET /api/monitoring/vector-db
 *
 * Returns vector database monitoring data including collections,
 * recent queries, and index health information.
 */
export async function GET(request: NextRequest) {
  const authResult = await checkMonitoringAuth(request)
  if (!authResult.isAuthorized) {
    return getUnauthorizedResponse(authResult.error)
  }

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

  try {
    // TODO: Wire to a real vector DB monitoring source.
    // For now return empty arrays — no mock data.
    const collections: CollectionResponse[] = []
    const queries: RecentQueryResponse[] = []
    const indexHealth: IndexHealthResponse[] = []

    return NextResponse.json(
      { collections, queries, indexHealth } satisfies VectorDBResponse,
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message, collections: [], queries: [], indexHealth: [] },
      { status: 500 }
    )
  }
}
