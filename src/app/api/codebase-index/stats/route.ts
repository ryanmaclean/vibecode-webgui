/**
 * Codebase Index Coverage Statistics API
 * Provides detailed statistics about indexed files and coverage
 *
 * Rate Limited: 10 requests per minute
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CodebaseIndexer } from '@/lib/indexing/codebase-indexer'
import { z } from '@/lib/zod-compat'
import { createErrorResponse } from '@/lib/utils/api-response'
import {
  createServiceLogger,
  createPerformanceTimer,
  logError,
  apiLogger
} from '@/lib/logging'
import { createAPIRateLimit } from '@/lib/rate-limiting'

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(10) // 10 requests per minute

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'codebase-index-stats-api'
})

// Request schema
const statsSchema = z.object({
  projectId: z.coerce.number().int().positive()
})

/**
 * GET /api/codebase-index/stats - Get index coverage statistics
 */
export async function GET(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await apiRateLimit(req)
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

  const startTime = Date.now()
  const requestContext = apiLogger.logRequest(req)

  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user || !session.user.id) {
      log.warn('Unauthorized access attempt', {
        requestId: requestContext.requestId,
        operation: 'get-stats'
      })

      const response = createErrorResponse('Unauthorized', 401, {
        code: 'UNAUTHORIZED',
        detail: 'Authentication required to access index statistics.',
      })
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    const { searchParams } = new URL(req.url)
    const projectIdParam = searchParams.get('projectId')

    if (!projectIdParam) {
      const response = createErrorResponse('Bad Request', 400, {
        code: 'MISSING_PROJECT_ID',
        detail: 'projectId query parameter is required',
      })
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    const parseResult = statsSchema.safeParse({ projectId: projectIdParam })
    if (!parseResult.success) {
      const response = createErrorResponse('Bad Request', 400, {
        code: 'INVALID_PROJECT_ID',
        detail: 'projectId must be a positive integer',
        validationErrors: parseResult.error.issues,
      })
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    const { projectId } = parseResult.data

    log.debug('Getting index coverage statistics', {
      requestId: requestContext.requestId,
      projectId,
      userId: session.user.id
    })

    const timer = createPerformanceTimer('get-index-stats', {
      requestId: requestContext.requestId,
      projectId
    })

    const indexer = new CodebaseIndexer()
    const status = await indexer.getIndexStatus(projectId)

    timer.stop({
      indexedFiles: status.indexedFiles,
      totalChunks: status.totalChunks
    })

    // Build comprehensive coverage statistics
    const coverageStats = {
      projectId: status.projectId,
      coverage: {
        totalFiles: status.totalFiles,
        indexedFiles: status.indexedFiles,
        unindexedFiles: status.totalFiles - status.indexedFiles,
        coveragePercentage: status.progress,
        totalChunks: status.totalChunks
      },
      status: {
        isIndexing: status.isIndexing,
        lastIndexedAt: status.lastIndexedAt?.toISOString() ?? null
      }
    }

    log.info('Index coverage statistics retrieved', {
      requestId: requestContext.requestId,
      projectId,
      stats: {
        indexedFiles: coverageStats.coverage.indexedFiles,
        totalFiles: coverageStats.coverage.totalFiles,
        coveragePercentage: coverageStats.coverage.coveragePercentage
      }
    })

    const response = NextResponse.json({
      status: 'success',
      data: coverageStats,
      timestamp: new Date().toISOString()
    })
    response.headers.set('x-request-id', requestContext.requestId)
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  } catch (error) {
    logError(error, {
      operation: 'codebase_index_stats',
      requestId: requestContext.requestId,
      component: 'codebase-index-stats-api'
    })

    const response = createErrorResponse('Internal Server Error', 500, {
      code: 'INDEX_STATS_ERROR',
      detail: error instanceof Error ? error.message : 'Unknown error occurred while retrieving index statistics.',
    })
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  }
}
