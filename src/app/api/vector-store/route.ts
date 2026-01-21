/**
 * Enhanced Vector Store API
 * Unified API for multiple vector database providers
 * Supports PostgreSQL pgvector, Weaviate, and intelligent routing
 *
 * Rate Limited: 50 requests per minute (resource-heavy operations)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { enhancedVectorStore } from '@/lib/vector-stores/enhanced-vector-store'
import { z } from '@/lib/zod-compat'
import { createErrorResponse } from '@/lib/utils/api-response'
import {
  createServiceLogger,
  createPerformanceTimer,
  logError,
  apiLogger
} from '@/lib/logging'
import {
  checkRateLimit,
  createRateLimitedResponse,
  applyRateLimitHeaders,
  RateLimitPresets,
} from '@/lib/rate-limiter'

export const dynamic = 'force-dynamic'

const RATE_LIMIT_PREFIX = 'vector-store'

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'vector-store-api'
})

// Request schemas
const searchSchema = z.object({
  query: z.string().min(1),
  workspaceId: z.number().optional(),
  fileIds: z.array(z.number()).optional(),
  limit: z.number().min(1).max(100).default(10),
  threshold: z.number().min(0).max(1).default(0.7),
  provider: z.enum(['pgvector', 'weaviate', 'auto']).default('auto'),
  searchType: z.enum(['semantic', 'hybrid', 'generative']).default('semantic'),
  generativePrompt: z.string().optional()
})

const storeSchema = z.object({
  workspaceId: z.number(),
  documents: z.array(z.object({
    content: z.string(),
    fileName: z.string(),
    filePath: z.string(),
    language: z.string().optional(),
    fileId: z.number(),
    startLine: z.number().optional(),
    endLine: z.number().optional(),
    tokens: z.number()
  }))
})

const deleteSchema = z.object({
  workspaceId: z.number().optional(),
  fileIds: z.array(z.number()).optional()
}).refine(data => data.workspaceId || data.fileIds?.length, {
  message: "Either workspaceId or fileIds must be provided"
})

/**
 * GET /api/vector-store - Health check and statistics
 */
export async function GET(req: NextRequest) {
  // Apply rate limiting for vector store operations
  const rateLimitResult = await checkRateLimit(req, RateLimitPresets.VECTOR_SEARCH, RATE_LIMIT_PREFIX)
  if (!rateLimitResult.allowed) {
    return createRateLimitedResponse(rateLimitResult, RateLimitPresets.VECTOR_SEARCH)
  }

  const startTime = Date.now()
  const requestContext = apiLogger.logRequest(req)

  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user || !session.user.id) {
      log.warn('Unauthorized access attempt', {
        requestId: requestContext.requestId,
        operation: 'get'
      })

      const response = createErrorResponse('Unauthorized', 401, {
        code: 'UNAUTHORIZED',
        detail: 'Authentication required to access the vector store.',
      })
      apiLogger.logResponse(requestContext, response, startTime)
      return applyRateLimitHeaders(response, rateLimitResult)
    }

    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    log.debug('Vector store GET request', {
      requestId: requestContext.requestId,
      action,
      userId: session.user.id
    })

    if (action === 'health') {
      const timer = createPerformanceTimer('vector-store-health-check', {
        requestId: requestContext.requestId
      })

      const stats = await enhancedVectorStore.healthCheck()
      timer.stop({ providersChecked: stats.providers.length })

      log.info('Health check completed', {
        requestId: requestContext.requestId,
        availableProviders: stats.providers.filter(p => p.available).length,
        totalProviders: stats.providers.length
      })

      const response = NextResponse.json({
        status: 'success',
        data: stats,
        timestamp: new Date().toISOString()
      })
      response.headers.set('x-request-id', requestContext.requestId)
      apiLogger.logResponse(requestContext, response, startTime)
      return applyRateLimitHeaders(response, rateLimitResult)
    }

    if (action === 'providers') {
      const stats = await enhancedVectorStore.healthCheck()
      const recommendedProvider = stats.providers.find(
        (p) => p.available
      )?.id || 'none'

      log.info('Providers info requested', {
        requestId: requestContext.requestId,
        recommendedProvider
      })

      const response = NextResponse.json({
        status: 'success',
        data: {
          providers: stats.providers,
          recommendedProvider
        }
      })
      response.headers.set('x-request-id', requestContext.requestId)
      apiLogger.logResponse(requestContext, response, startTime)
      return applyRateLimitHeaders(response, rateLimitResult)
    }

    const response = NextResponse.json({
      status: 'success',
      message: 'Enhanced Vector Store API',
      endpoints: {
        'GET ?action=health': 'Get health status and statistics',
        'GET ?action=providers': 'Get available providers',
        'POST': 'Search documents',
        'PUT': 'Store documents',
        'DELETE': 'Delete documents'
      }
    })
    response.headers.set('x-request-id', requestContext.requestId)
    apiLogger.logResponse(requestContext, response, startTime)
    return applyRateLimitHeaders(response, rateLimitResult)
  } catch (error) {
    logError(error, {
      operation: 'vector_store_get',
      requestId: requestContext.requestId,
      component: 'vector-store-api'
    })

    const response = createErrorResponse('Vector store error', 500, {
      code: 'VECTOR_STORE_INTERNAL_ERROR',
      detail: error instanceof Error ? error.message : 'Unknown error occurred while handling the vector store request.',
    })
    apiLogger.logResponse(requestContext, response, startTime)
    return applyRateLimitHeaders(response, rateLimitResult)
  }
}

/**
 * POST /api/vector-store - Search documents
 */
export async function POST(req: NextRequest) {
  // Apply rate limiting for vector search (resource-heavy)
  const rateLimitResult = await checkRateLimit(req, RateLimitPresets.VECTOR_SEARCH, RATE_LIMIT_PREFIX)
  if (!rateLimitResult.allowed) {
    return createRateLimitedResponse(rateLimitResult, RateLimitPresets.VECTOR_SEARCH)
  }

  const startTime = Date.now()
  const requestContext = apiLogger.logRequest(req)

  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user || !session.user.id) {
      log.warn('Unauthorized search attempt', {
        requestId: requestContext.requestId
      })

      const response = createErrorResponse('Unauthorized', 401, {
        code: 'UNAUTHORIZED',
        detail: 'Authentication required to search the vector store.',
      })
      apiLogger.logResponse(requestContext, response, startTime)
      return applyRateLimitHeaders(response, rateLimitResult)
    }

    const body = await req.json()
    const searchOptions = searchSchema.parse(body)

    const timer = createPerformanceTimer('vector-store-search', {
      requestId: requestContext.requestId,
      searchType: searchOptions.searchType,
      provider: searchOptions.provider
    })

    log.info('Vector search initiated', {
      requestId: requestContext.requestId,
      queryLength: searchOptions.query.length,
      limit: searchOptions.limit,
      threshold: searchOptions.threshold,
      workspaceId: searchOptions.workspaceId,
      userId: session.user.id
    })

    const results = await enhancedVectorStore.search(searchOptions.query, {
      limit: searchOptions.limit,
      threshold: searchOptions.threshold,
      workspaceId: searchOptions.workspaceId,
      fileIds: searchOptions.fileIds,
    })

    const queryTime = timer.stop({
      success: true,
      resultCount: results.length
    })

    log.info('Vector search completed', {
      requestId: requestContext.requestId,
      resultCount: results.length,
      queryTimeMs: queryTime
    })

    const response = NextResponse.json({
      status: 'success',
      data: {
        results,
        query: searchOptions.query,
        provider: results.length > 0 && results[0]?.metadata?.provider ? results[0].metadata.provider : 'none',
        performance: {
          queryTime,
          resultCount: results.length,
          limit: searchOptions.limit
        }
      },
      timestamp: new Date().toISOString()
    })
    response.headers.set('x-request-id', requestContext.requestId)
    apiLogger.logResponse(requestContext, response, startTime)
    return applyRateLimitHeaders(response, rateLimitResult)
  } catch (error) {
    logError(error, {
      operation: 'vector_store_search',
      requestId: requestContext.requestId,
      component: 'vector-store-api'
    })

    if (error instanceof z.ZodError) {
      log.warn('Invalid search request', {
        requestId: requestContext.requestId,
        validationErrors: error.issues
      })

      const response = createErrorResponse('Invalid request parameters', 400, {
        code: 'VECTOR_STORE_INVALID_REQUEST',
        errors: error.issues,
      })
      apiLogger.logResponse(requestContext, response, startTime)
      return applyRateLimitHeaders(response, rateLimitResult)
    }

    const response = createErrorResponse('Search failed', 500, {
      code: 'VECTOR_STORE_SEARCH_ERROR',
      detail: error instanceof Error ? error.message : 'Unknown error occurred during vector search.',
    })
    apiLogger.logResponse(requestContext, response, startTime)
    return applyRateLimitHeaders(response, rateLimitResult)
  }
}

/**
 * PUT /api/vector-store - Store documents
 */
export async function PUT(req: NextRequest) {
  // Apply rate limiting for vector store operations (resource-heavy)
  const rateLimitResult = await checkRateLimit(req, RateLimitPresets.VECTOR_SEARCH, RATE_LIMIT_PREFIX)
  if (!rateLimitResult.allowed) {
    return createRateLimitedResponse(rateLimitResult, RateLimitPresets.VECTOR_SEARCH)
  }

  const startTime = Date.now()
  const requestContext = apiLogger.logRequest(req)

  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user || !session.user.id) {
      log.warn('Unauthorized store attempt', {
        requestId: requestContext.requestId
      })

      const response = createErrorResponse('Unauthorized', 401, {
        code: 'UNAUTHORIZED',
        detail: 'Authentication required to store documents.',
      })
      apiLogger.logResponse(requestContext, response, startTime)
      return applyRateLimitHeaders(response, rateLimitResult)
    }

    const body = await req.json()
    const storeOptions = storeSchema.parse(body)

    const timer = createPerformanceTimer('vector-store-storage', {
      requestId: requestContext.requestId,
      documentCount: storeOptions.documents.length
    })

    log.info('Document storage initiated', {
      requestId: requestContext.requestId,
      workspaceId: storeOptions.workspaceId,
      documentCount: storeOptions.documents.length,
      totalTokens: storeOptions.documents.reduce((sum, doc) => sum + doc.tokens, 0),
      userId: session.user.id
    })

    const results = await enhancedVectorStore.storeDocuments(
      storeOptions.workspaceId,
      storeOptions.documents
    )

    const storeTime = timer.stop({
      success: true,
      storedCount: results.stored
    })

    log.info('Documents stored successfully', {
      requestId: requestContext.requestId,
      storedCount: results.stored,
      storeTimeMs: storeTime
    })

    const response = NextResponse.json({
      status: 'success',
      data: {
        ...results,
        performance: {
          storeTime,
          documentsProcessed: storeOptions.documents.length
        }
      },
      message: `Stored ${results.stored} documents across available providers`,
      timestamp: new Date().toISOString()
    })
    response.headers.set('x-request-id', requestContext.requestId)
    apiLogger.logResponse(requestContext, response, startTime)
    return applyRateLimitHeaders(response, rateLimitResult)
  } catch (error) {
    logError(error, {
      operation: 'vector_store_put',
      requestId: requestContext.requestId,
      component: 'vector-store-api'
    })

    if (error instanceof z.ZodError) {
      log.warn('Invalid store request', {
        requestId: requestContext.requestId,
        validationErrors: error.issues
      })

      const response = createErrorResponse('Invalid request parameters', 400, {
        code: 'VECTOR_STORE_INVALID_REQUEST',
        errors: error.issues,
      })
      apiLogger.logResponse(requestContext, response, startTime)
      return applyRateLimitHeaders(response, rateLimitResult)
    }

    const response = createErrorResponse('Storage failed', 500, {
      code: 'VECTOR_STORE_STORAGE_ERROR',
      detail: error instanceof Error ? error.message : 'Unknown error occurred while storing documents.',
    })
    apiLogger.logResponse(requestContext, response, startTime)
    return applyRateLimitHeaders(response, rateLimitResult)
  }
}

/**
 * DELETE /api/vector-store - Delete documents
 */
export async function DELETE(req: NextRequest) {
  // Apply rate limiting for vector delete operations
  const rateLimitResult = await checkRateLimit(req, RateLimitPresets.VECTOR_SEARCH, RATE_LIMIT_PREFIX)
  if (!rateLimitResult.allowed) {
    return createRateLimitedResponse(rateLimitResult, RateLimitPresets.VECTOR_SEARCH)
  }

  const startTime = Date.now()
  const requestContext = apiLogger.logRequest(req)

  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user || !session.user.id) {
      log.warn('Unauthorized delete attempt', {
        requestId: requestContext.requestId
      })

      const response = createErrorResponse('Unauthorized', 401, {
        code: 'UNAUTHORIZED',
        detail: 'Authentication required to delete documents.',
      })
      apiLogger.logResponse(requestContext, response, startTime)
      return applyRateLimitHeaders(response, rateLimitResult)
    }

    const body = await req.json()
    const deleteOptions = deleteSchema.parse(body)

    const timer = createPerformanceTimer('vector-store-delete', {
      requestId: requestContext.requestId,
      workspaceId: deleteOptions.workspaceId,
      fileIdCount: deleteOptions.fileIds?.length
    })

    log.info('Document deletion initiated', {
      requestId: requestContext.requestId,
      workspaceId: deleteOptions.workspaceId,
      fileIdCount: deleteOptions.fileIds?.length,
      userId: session.user.id
    })

    const results = await enhancedVectorStore.deleteDocuments(deleteOptions)

    const deleteTime = timer.stop({
      success: true,
      deletedCount: results.totalDeleted
    })

    log.info('Documents deleted successfully', {
      requestId: requestContext.requestId,
      deletedCount: results.totalDeleted,
      deleteTimeMs: deleteTime
    })

    const response = NextResponse.json({
      status: 'success',
      data: {
        ...results,
        performance: {
          deleteTime
        }
      },
      message: `Deleted ${results.totalDeleted} documents from available providers`,
      timestamp: new Date().toISOString()
    })
    response.headers.set('x-request-id', requestContext.requestId)
    apiLogger.logResponse(requestContext, response, startTime)
    return applyRateLimitHeaders(response, rateLimitResult)
  } catch (error) {
    logError(error, {
      operation: 'vector_store_delete',
      requestId: requestContext.requestId,
      component: 'vector-store-api'
    })

    if (error instanceof z.ZodError) {
      log.warn('Invalid delete request', {
        requestId: requestContext.requestId,
        validationErrors: error.issues
      })

      const response = createErrorResponse('Invalid request parameters', 400, {
        code: 'VECTOR_STORE_INVALID_REQUEST',
        errors: error.issues,
      })
      apiLogger.logResponse(requestContext, response, startTime)
      return applyRateLimitHeaders(response, rateLimitResult)
    }

    const response = createErrorResponse('Deletion failed', 500, {
      code: 'VECTOR_STORE_DELETION_ERROR',
      detail: error instanceof Error ? error.message : 'Unknown error occurred while deleting documents.',
    })
    apiLogger.logResponse(requestContext, response, startTime)
    return applyRateLimitHeaders(response, rateLimitResult)
  }
}

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
