/**
 * Codebase Indexing API
 * Manages full codebase semantic indexing for projects
 *
 * Rate Limited: 10 requests per minute (resource-heavy operations)
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
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(10) // 10 requests per minute

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'codebase-index-api'
})

// Request schemas
const statusSchema = z.object({
  projectId: z.coerce.number().int().positive()
})

const indexProjectSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  workspaceId: z.coerce.number().int().positive(),
  projectPath: z.string().min(1)
})

const reindexFileSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  workspaceId: z.coerce.number().int().positive(),
  filePath: z.string().min(1)
})

const deleteIndexSchema = z.object({
  projectId: z.coerce.number().int().positive()
})

/**
 * GET /api/codebase-index - Get indexing status
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
        operation: 'get-status'
      })

      const response = createErrorResponse('Unauthorized', 401, {
        code: 'UNAUTHORIZED',
        detail: 'Authentication required to access the codebase index.',
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

    const parseResult = statusSchema.safeParse({ projectId: projectIdParam })
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

    log.debug('Getting indexing status', {
      requestId: requestContext.requestId,
      projectId,
      userId: session.user.id
    })

    const timer = createPerformanceTimer('get-index-status', {
      requestId: requestContext.requestId,
      projectId
    })

    const indexer = new CodebaseIndexer()
    const status = await indexer.getIndexStatus(projectId)

    timer.stop({
      indexedFiles: status.indexedFiles,
      totalChunks: status.totalChunks
    })

    log.info('Indexing status retrieved', {
      requestId: requestContext.requestId,
      projectId,
      status: {
        indexedFiles: status.indexedFiles,
        totalFiles: status.totalFiles,
        progress: status.progress,
        isIndexing: status.isIndexing
      }
    })

    const response = NextResponse.json({
      status: 'success',
      data: status,
      timestamp: new Date().toISOString()
    })
    response.headers.set('x-request-id', requestContext.requestId)
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  } catch (error) {
    logError(error, {
      operation: 'codebase_index_get',
      requestId: requestContext.requestId,
      component: 'codebase-index-api'
    })

    const response = createErrorResponse('Internal Server Error', 500, {
      code: 'CODEBASE_INDEX_ERROR',
      detail: error instanceof Error ? error.message : 'Unknown error occurred while retrieving index status.',
    })
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  }
}

/**
 * POST /api/codebase-index - Trigger full project indexing
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
        operation: 'index-project'
      })

      const response = createErrorResponse('Unauthorized', 401, {
        code: 'UNAUTHORIZED',
        detail: 'Authentication required to trigger project indexing.',
      })
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    const body = await req.json()
    const parseResult = indexProjectSchema.safeParse(body)

    if (!parseResult.success) {
      const response = createErrorResponse('Bad Request', 400, {
        code: 'INVALID_REQUEST_BODY',
        detail: 'Invalid request body',
        validationErrors: parseResult.error.issues,
      })
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    const { projectId, workspaceId, projectPath } = parseResult.data

    log.info('Starting project indexing', {
      requestId: requestContext.requestId,
      projectId,
      workspaceId,
      userId: session.user.id,
      projectPath
    })

    const timer = createPerformanceTimer('index-project', {
      requestId: requestContext.requestId,
      projectId
    })

    const indexer = new CodebaseIndexer()

    // Start indexing (this is async and may take a while)
    // In a production system, this would be moved to a background job
    const results = await indexer.indexProject(
      projectId,
      workspaceId,
      parseInt(session.user.id),
      projectPath
    )

    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    timer.stop({
      totalFiles: results.length,
      successCount,
      failureCount
    })

    log.info('Project indexing completed', {
      requestId: requestContext.requestId,
      projectId,
      totalFiles: results.length,
      successCount,
      failureCount
    })

    const response = NextResponse.json({
      status: 'success',
      data: {
        projectId,
        totalFiles: results.length,
        successCount,
        failureCount,
        results
      },
      timestamp: new Date().toISOString()
    })
    response.headers.set('x-request-id', requestContext.requestId)
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  } catch (error) {
    logError(error, {
      operation: 'codebase_index_post',
      requestId: requestContext.requestId,
      component: 'codebase-index-api'
    })

    const response = createErrorResponse('Internal Server Error', 500, {
      code: 'INDEXING_FAILED',
      detail: error instanceof Error ? error.message : 'Unknown error occurred while indexing project.',
    })
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  }
}

/**
 * PUT /api/codebase-index - Re-index specific file
 */
export async function PUT(req: NextRequest) {
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
        operation: 'reindex-file'
      })

      const response = createErrorResponse('Unauthorized', 401, {
        code: 'UNAUTHORIZED',
        detail: 'Authentication required to re-index files.',
      })
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    const body = await req.json()
    const parseResult = reindexFileSchema.safeParse(body)

    if (!parseResult.success) {
      const response = createErrorResponse('Bad Request', 400, {
        code: 'INVALID_REQUEST_BODY',
        detail: 'Invalid request body',
        validationErrors: parseResult.error.issues,
      })
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    const { projectId, workspaceId, filePath } = parseResult.data

    log.info('Re-indexing file', {
      requestId: requestContext.requestId,
      projectId,
      workspaceId,
      userId: session.user.id,
      filePath
    })

    const timer = createPerformanceTimer('reindex-file', {
      requestId: requestContext.requestId,
      projectId,
      filePath
    })

    const indexer = new CodebaseIndexer()
    const result = await indexer.updateIndex(
      filePath,
      projectId,
      workspaceId,
      parseInt(session.user.id)
    )

    timer.stop({ success: result.success })

    log.info('File re-indexed', {
      requestId: requestContext.requestId,
      projectId,
      filePath,
      success: result.success,
      chunkCount: result.chunkCount
    })

    const response = NextResponse.json({
      status: 'success',
      data: result,
      timestamp: new Date().toISOString()
    })
    response.headers.set('x-request-id', requestContext.requestId)
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  } catch (error) {
    logError(error, {
      operation: 'codebase_index_put',
      requestId: requestContext.requestId,
      component: 'codebase-index-api'
    })

    const response = createErrorResponse('Internal Server Error', 500, {
      code: 'REINDEX_FAILED',
      detail: error instanceof Error ? error.message : 'Unknown error occurred while re-indexing file.',
    })
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  }
}

/**
 * DELETE /api/codebase-index - Clear index for project
 */
export async function DELETE(req: NextRequest) {
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
        operation: 'delete-index'
      })

      const response = createErrorResponse('Unauthorized', 401, {
        code: 'UNAUTHORIZED',
        detail: 'Authentication required to delete project index.',
      })
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    const body = await req.json()
    const parseResult = deleteIndexSchema.safeParse(body)

    if (!parseResult.success) {
      const response = createErrorResponse('Bad Request', 400, {
        code: 'INVALID_REQUEST_BODY',
        detail: 'Invalid request body',
        validationErrors: parseResult.error.issues,
      })
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    const { projectId } = parseResult.data

    log.info('Deleting project index', {
      requestId: requestContext.requestId,
      projectId,
      userId: session.user.id
    })

    const timer = createPerformanceTimer('delete-index', {
      requestId: requestContext.requestId,
      projectId
    })

    // Delete all codebase index entries for the project
    const deletedIndexes = await prisma.codebaseIndex.deleteMany({
      where: { project_id: projectId }
    })

    // Delete all RAG chunks for the project
    // Note: This will delete all chunks for the project, including those from codebase indexing
    const deletedChunks = await prisma.rAGChunk.deleteMany({
      where: {
        project_id: projectId
      }
    })

    timer.stop({
      deletedIndexes: deletedIndexes.count,
      deletedChunks: deletedChunks.count
    })

    log.info('Project index deleted', {
      requestId: requestContext.requestId,
      projectId,
      deletedIndexes: deletedIndexes.count,
      deletedChunks: deletedChunks.count
    })

    const response = NextResponse.json({
      status: 'success',
      data: {
        projectId,
        deletedIndexes: deletedIndexes.count,
        deletedChunks: deletedChunks.count
      },
      timestamp: new Date().toISOString()
    })
    response.headers.set('x-request-id', requestContext.requestId)
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  } catch (error) {
    logError(error, {
      operation: 'codebase_index_delete',
      requestId: requestContext.requestId,
      component: 'codebase-index-api'
    })

    const response = createErrorResponse('Internal Server Error', 500, {
      code: 'DELETE_INDEX_FAILED',
      detail: error instanceof Error ? error.message : 'Unknown error occurred while deleting project index.',
    })
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  }
}
