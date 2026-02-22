/**
 * Session Context Search API
 * Provides semantic search capabilities for persistent session context
 * Enables finding relevant historical context using vector similarity
 *
 * Rate Limited: 30 requests per minute (resource-heavy operations)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PersistentContextService } from '@/lib/session/persistent-context-service'
import { z } from '@/lib/zod-compat'
import { validateRequestBody } from '@/lib/api/validation/middleware'
import { createErrorResponse } from '@/lib/utils/api-response'
import {
  createServiceLogger,
  createPerformanceTimer,
  logError,
  apiLogger
} from '@/lib/logging'
import { createAPIRateLimit } from '@/lib/rate-limiting'
import { cache, CacheKeys, CacheTTL } from '@/lib/cache/unified-cache-client'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(30) // 30 requests per minute

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'session-context-search'
})

// Singleton instance of PersistentContextService
let persistentContextService: PersistentContextService | null = null

function getContextService(): PersistentContextService {
  if (!persistentContextService) {
    persistentContextService = new PersistentContextService({
      prismaClient: prisma,
      enableLogging: true,
      enableMetrics: true
    })
  }
  return persistentContextService
}

// Request schema for semantic search
const searchContextSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty').max(5000),
  sessionId: z.string().min(1).max(200).optional(),
  workspaceId: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(50).default(5),
  minSimilarity: z.number().min(0).max(1).default(0.7)
})

/**
 * Generate a cache key for session context search requests
 */
function generateSearchCacheKey(query: string, userId: number, options: {
  sessionId?: string
  workspaceId?: number
  limit?: number
  minSimilarity?: number
}): string {
  const params = {
    query,
    userId,
    ...options
  }
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(params))
    .digest('hex')
  return `session-context:search:${hash}`
}

/**
 * POST /api/session/context/search - Semantic search for session context
 */
export async function POST(req: NextRequest) {
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
    // Authentication
    const session = await getServerSession(authOptions)
    if (!session || !session.user || !session.user.id) {
      log.warn('Unauthorized access attempt', {
        requestId: requestContext.requestId,
        operation: 'search_context'
      })

      const response = createErrorResponse('Unauthorized', 401, {
        code: 'UNAUTHORIZED',
        detail: 'Authentication required for session context search.',
      })
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    const userId = parseInt(session.user.id)
    if (isNaN(userId)) {
      log.error('Invalid user ID in session', {
        requestId: requestContext.requestId,
        userId: session.user.id
      })

      const response = createErrorResponse('Invalid user ID', 400, {
        code: 'INVALID_USER_ID',
        detail: 'User ID must be a valid integer.',
      })
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    // Validate request body
    const validation = await validateRequestBody(req, searchContextSchema)
    if (!validation.success) {
      log.warn('Session context search validation failed', {
        requestId: requestContext.requestId,
        errors: validation.error,
      })

      const response = createErrorResponse('Invalid request data', 400, {
        code: 'VALIDATION_ERROR',
        detail: 'Request validation failed.',
        validation: validation.error
      })
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    const { query, sessionId, workspaceId, limit, minSimilarity } = validation.data as z.infer<typeof searchContextSchema>

    // Generate cache key for the search request
    const searchParams = { sessionId, workspaceId, limit, minSimilarity }
    const cacheKey = generateSearchCacheKey(query, userId, searchParams)

    // Try cache first - provides 70-90% reduction in latency for repeated queries
    const cached = await cache.get(cacheKey)
    if (cached) {
      log.info('Session context search cache hit', {
        requestId: requestContext.requestId,
        query: query.substring(0, 50),
        cacheKey
      })

      const response = NextResponse.json({
        status: 'success',
        data: {
          ...cached,
          from_cache: true,
          cache_hit: true
        },
        message: 'Session context search results retrieved from cache'
      })

      response.headers.set('x-request-id', requestContext.requestId)
      response.headers.set('x-cache-status', 'HIT')
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    log.debug('Searching session context', {
      requestId: requestContext.requestId,
      userId: userId.toString(),
      sessionId,
      workspaceId,
      queryLength: query.length,
      limit,
      minSimilarity
    })

    // Perform semantic search using the service
    const timer = createPerformanceTimer('search-session-context', {
      requestId: requestContext.requestId,
      userId: userId.toString()
    })

    const contextService = getContextService()
    const searchResults = await contextService.searchContext(query, {
      userId,
      sessionId,
      workspaceId,
      limit,
      minSimilarity
    })

    timer.stop({ resultsCount: searchResults.length })

    log.info('Session context search completed', {
      requestId: requestContext.requestId,
      userId: userId.toString(),
      query: query.substring(0, 50),
      resultsCount: searchResults.length,
      minSimilarity
    })

    const responseData = {
      query,
      results: searchResults.map(result => ({
        id: result.id,
        content: result.content,
        sessionId: result.sessionId,
        workspaceId: result.workspaceId,
        metadata: result.metadata,
        similarity: result.similarity,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString()
      })),
      total_results: searchResults.length,
      search_params: {
        sessionId,
        workspaceId,
        limit,
        minSimilarity
      },
      from_cache: false,
      cache_hit: false
    }

    // Cache the search results for 30 minutes (longer for expensive vector operations)
    await cache.set(cacheKey, responseData, CacheTTL.LONG)
    log.debug('Session context search results cached', {
      requestId: requestContext.requestId,
      cacheKey,
      resultsCount: searchResults.length
    })

    const response = NextResponse.json(
      {
        status: 'success',
        data: responseData,
        message: 'Session context search completed successfully'
      },
      { status: 200 }
    )

    response.headers.set('x-request-id', requestContext.requestId)
    response.headers.set('x-cache-status', 'MISS')
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  } catch (error) {
    logError(error, {
      operation: 'search_session_context',
      requestId: requestContext.requestId,
      component: 'session-context-search'
    })

    const response = createErrorResponse('Failed to search session context', 500, {
      code: 'SEARCH_CONTEXT_ERROR',
      detail: error instanceof Error ? error.message : 'Unknown error occurred while searching context.',
    })
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  }
}
