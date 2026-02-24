/**
 * Semantic Search API
 * Provides pgvector-powered semantic code search across indexed codebase
 *
 * Rate Limited: 30 requests per minute (moderate usage)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from '@/lib/zod-compat'
import { createErrorResponse } from '@/lib/utils/api-response'
import {
  createServiceLogger,
  createPerformanceTimer,
  logError,
  apiLogger
} from '@/lib/logging'
import { createAPIRateLimit } from '@/lib/rate-limiting'
import { prisma } from '@/lib/prisma'
import { EmbeddingServiceFactory } from '@/lib/ai/embeddingServiceFactory'

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(30) // 30 requests per minute

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'semantic-search-api'
})

// Request schema
const searchSchema = z.object({
  query: z.string().min(1).max(1000),
  projectId: z.coerce.number().int().positive(),
  limit: z.coerce.number().int().positive().max(50).optional().default(5),
  minSimilarity: z.coerce.number().min(0).max(1).optional().default(0.7)
})

// Search result interface
interface SearchResult {
  id: number
  content: string
  similarity: number
  filePath: string
  fileName: string
  language: string
  startLine: number | null
  endLine: number | null
  chunkIndex: number | null
}

/**
 * POST /api/semantic-search - Search for semantically similar code chunks
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
    const session = await getServerSession(authOptions)
    if (!session || !session.user || !session.user.id) {
      log.warn('Unauthorized access attempt', {
        requestId: requestContext.requestId,
        operation: 'semantic-search'
      })

      const response = createErrorResponse('Unauthorized', 401, {
        code: 'UNAUTHORIZED',
        detail: 'Authentication required to perform semantic search.',
      })
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    const body = await req.json()
    const parseResult = searchSchema.safeParse(body)

    if (!parseResult.success) {
      const response = createErrorResponse('Bad Request', 400, {
        code: 'INVALID_REQUEST',
        detail: 'Invalid request parameters',
        validationErrors: parseResult.error.issues,
      })
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    const { query, projectId, limit, minSimilarity } = parseResult.data

    log.debug('Starting semantic search', {
      requestId: requestContext.requestId,
      projectId,
      query: query.substring(0, 100),
      limit,
      minSimilarity,
      userId: session.user.id
    })

    const timer = createPerformanceTimer('semantic-search', {
      requestId: requestContext.requestId,
      projectId,
      queryLength: query.length
    })

    // Initialize embedding service
    const embeddingFactory = new EmbeddingServiceFactory(prisma)
    const embeddingService = embeddingFactory.createEmbeddingServiceFromEnv()

    if (!embeddingService) {
      const response = createErrorResponse('Service Unavailable', 503, {
        code: 'EMBEDDING_SERVICE_UNAVAILABLE',
        detail: 'Embedding service is not configured. Check API configuration.',
      })
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    // Generate embedding for the query
    const queryEmbedding = await embeddingService.generateEmbedding(query)
    const embeddingString = `[${queryEmbedding.join(',')}]`

    // Perform vector similarity search using cosine distance
    // pgvector's <=> operator returns cosine distance (0 = identical, 2 = opposite)
    const results = await prisma.$queryRaw<Array<{
      id: number
      content: string
      metadata: { filePath?: string; fileName?: string; language?: string }
      start_line: number | null
      end_line: number | null
      chunk_index: number | null
      distance: number
    }>>`
      SELECT
        id,
        content,
        metadata,
        start_line,
        end_line,
        chunk_index,
        (embedding <=> ${embeddingString}::vector) as distance
      FROM rag_chunks
      WHERE project_id = ${projectId}
      ORDER BY embedding <=> ${embeddingString}::vector
      LIMIT ${limit * 2}
    `

    // Convert distance to similarity score and filter by threshold
    const searchResults: SearchResult[] = results
      .map(row => {
        // Convert cosine distance to similarity: 1 - (distance / 2)
        // Distance range is [0, 2], similarity range is [0, 1]
        const similarity = 1 - (row.distance / 2)

        return {
          id: row.id,
          content: row.content,
          similarity,
          filePath: row.metadata?.filePath || 'unknown',
          fileName: row.metadata?.fileName || 'unknown',
          language: row.metadata?.language || 'unknown',
          startLine: row.start_line,
          endLine: row.end_line,
          chunkIndex: row.chunk_index
        }
      })
      .filter(result => result.similarity >= minSimilarity)
      .slice(0, limit)

    timer.stop({
      resultsCount: searchResults.length,
      topSimilarity: searchResults[0]?.similarity
    })

    log.info('Semantic search completed', {
      requestId: requestContext.requestId,
      projectId,
      resultsCount: searchResults.length,
      topSimilarity: searchResults[0]?.similarity,
      duration: Date.now() - startTime
    })

    const response = NextResponse.json({
      status: 'success',
      data: {
        results: searchResults,
        query,
        projectId,
        limit,
        minSimilarity,
        totalResults: searchResults.length
      },
      timestamp: new Date().toISOString()
    })
    response.headers.set('x-request-id', requestContext.requestId)
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  } catch (error) {
    logError(error, {
      operation: 'semantic_search',
      requestId: requestContext.requestId,
      component: 'semantic-search-api'
    })

    const response = createErrorResponse('Internal Server Error', 500, {
      code: 'SEMANTIC_SEARCH_ERROR',
      detail: error instanceof Error ? error.message : 'Unknown error occurred during semantic search.',
    })
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  }
}
