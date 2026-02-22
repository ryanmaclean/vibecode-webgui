/**
 * Session Context API
 * Manages persistent session context with vector embeddings for semantic search
 * Enables context to survive app restarts and degradation-free long sessions
 *
 * Rate Limited: 30 requests per minute
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PersistentContextService } from '@/lib/session/persistent-context-service'
import { z } from '@/lib/zod-compat'
import { validateRequestBody, validateQueryParams } from '@/lib/api/validation/middleware'
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

const apiRateLimit = createAPIRateLimit(30) // 30 requests per minute

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'session-context-api'
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

// Request schema for storing session context
const storeContextSchema = z.object({
  content: z.string().min(1).max(50000), // Allow up to ~50KB of context
  sessionId: z.string().min(1).max(200).optional(),
  workspaceId: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
})

/**
 * POST /api/session/context - Store session context
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
        operation: 'store_context'
      })

      const response = createErrorResponse('Unauthorized', 401, {
        code: 'UNAUTHORIZED',
        detail: 'Authentication required to store session context.',
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
    const validation = await validateRequestBody(req, storeContextSchema)
    if (!validation.success) {
      log.warn('Session context validation failed', {
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

    const { content, sessionId, workspaceId, metadata } = validation.data as z.infer<typeof storeContextSchema>

    log.debug('Storing session context', {
      requestId: requestContext.requestId,
      userId: userId.toString(),
      sessionId,
      workspaceId: workspaceId?.toString(),
      contentLength: content.length
    })

    // Store context using the service
    const timer = createPerformanceTimer('store-session-context', {
      requestId: requestContext.requestId,
      userId: userId.toString()
    })

    const contextService = getContextService()
    const storedContext = await contextService.storeContext({
      content,
      sessionId,
      userId,
      workspaceId,
      metadata
    })

    timer.stop({ contextId: storedContext.id })

    log.info('Session context stored successfully', {
      requestId: requestContext.requestId,
      contextId: storedContext.id.toString(),
      userId: userId.toString(),
      sessionId: storedContext.sessionId ?? undefined,
      workspaceId: storedContext.workspaceId?.toString()
    })

    const response = NextResponse.json(
      {
        status: 'success',
        data: {
          id: storedContext.id,
          sessionId: storedContext.sessionId,
          workspaceId: storedContext.workspaceId,
          createdAt: storedContext.createdAt.toISOString(),
          updatedAt: storedContext.updatedAt.toISOString()
        },
        message: 'Session context stored successfully'
      },
      { status: 201 }
    )

    response.headers.set('x-request-id', requestContext.requestId)
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  } catch (error) {
    logError(error, {
      operation: 'store_session_context',
      requestId: requestContext.requestId,
      component: 'session-context-api'
    })

    const response = createErrorResponse('Failed to store session context', 500, {
      code: 'STORE_CONTEXT_ERROR',
      detail: error instanceof Error ? error.message : 'Unknown error occurred while storing context.',
    })
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  }
}

// Query parameters schema for retrieving session context
const retrieveContextSchema = z.object({
  sessionId: z.string().min(1).max(200).optional(),
  workspaceId: z.string().regex(/^\d+$/, 'Workspace ID must be a number').optional(),
  limit: z.string().regex(/^\d+$/, 'Limit must be a number').optional(),
  orderBy: z.enum(['createdAt', 'updatedAt']).optional(),
  orderDirection: z.enum(['asc', 'desc']).optional()
})

/**
 * GET /api/session/context - Retrieve session context
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
    // Authentication
    const session = await getServerSession(authOptions)
    if (!session || !session.user || !session.user.id) {
      log.warn('Unauthorized access attempt', {
        requestId: requestContext.requestId,
        operation: 'retrieve_context'
      })

      const response = createErrorResponse('Unauthorized', 401, {
        code: 'UNAUTHORIZED',
        detail: 'Authentication required to retrieve session context.',
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

    // Validate query parameters
    const validation = validateQueryParams(req, retrieveContextSchema)
    if (!validation.success) {
      log.warn('Session context query validation failed', {
        requestId: requestContext.requestId,
      })
      apiLogger.logResponse(requestContext, validation.error, startTime)
      return validation.error
    }

    const { sessionId, workspaceId, limit, orderBy, orderDirection } = validation.data

    log.debug('Retrieving session context', {
      requestId: requestContext.requestId,
      userId: userId.toString(),
      sessionId,
      workspaceId,
      limit
    })

    // Retrieve context using the service
    const timer = createPerformanceTimer('retrieve-session-context', {
      requestId: requestContext.requestId,
      userId: userId.toString()
    })

    const contextService = getContextService()
    const contexts = await contextService.retrieveContext({
      userId,
      sessionId,
      workspaceId: workspaceId ? parseInt(workspaceId) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      orderBy: orderBy as 'createdAt' | 'updatedAt' | undefined,
      orderDirection: orderDirection as 'asc' | 'desc' | undefined
    })

    timer.stop({ count: contexts.length })

    log.info('Session context retrieved successfully', {
      requestId: requestContext.requestId,
      userId: userId.toString(),
      sessionId,
      workspaceId,
      count: contexts.length
    })

    const response = NextResponse.json(
      {
        status: 'success',
        data: {
          contexts: contexts.map(ctx => ({
            id: ctx.id,
            content: ctx.content,
            sessionId: ctx.sessionId,
            workspaceId: ctx.workspaceId,
            metadata: ctx.metadata,
            createdAt: ctx.createdAt.toISOString(),
            updatedAt: ctx.updatedAt.toISOString()
          })),
          count: contexts.length
        },
        message: 'Session context retrieved successfully'
      },
      { status: 200 }
    )

    response.headers.set('x-request-id', requestContext.requestId)
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  } catch (error) {
    logError(error, {
      operation: 'retrieve_session_context',
      requestId: requestContext.requestId,
      component: 'session-context-api'
    })

    const response = createErrorResponse('Failed to retrieve session context', 500, {
      code: 'RETRIEVE_CONTEXT_ERROR',
      detail: error instanceof Error ? error.message : 'Unknown error occurred while retrieving context.',
    })
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  }
}

// Query parameters schema for deleting session context
const deleteContextSchema = z.object({
  sessionId: z.string().min(1).max(200).optional(),
  workspaceId: z.string().regex(/^\d+$/, 'Workspace ID must be a number').optional()
})

/**
 * DELETE /api/session/context - Clear session context
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
    // Authentication
    const session = await getServerSession(authOptions)
    if (!session || !session.user || !session.user.id) {
      log.warn('Unauthorized access attempt', {
        requestId: requestContext.requestId,
        operation: 'clear_context'
      })

      const response = createErrorResponse('Unauthorized', 401, {
        code: 'UNAUTHORIZED',
        detail: 'Authentication required to clear session context.',
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

    // Validate query parameters
    const validation = validateQueryParams(req, deleteContextSchema)
    if (!validation.success) {
      log.warn('Session context delete validation failed', {
        requestId: requestContext.requestId,
      })
      apiLogger.logResponse(requestContext, validation.error, startTime)
      return validation.error
    }

    const { sessionId, workspaceId } = validation.data

    log.debug('Clearing session context', {
      requestId: requestContext.requestId,
      userId: userId.toString(),
      sessionId,
      workspaceId
    })

    // Clear context using the service
    const timer = createPerformanceTimer('clear-session-context', {
      requestId: requestContext.requestId,
      userId: userId.toString()
    })

    const contextService = getContextService()
    let deletedCount: number

    if (sessionId) {
      deletedCount = await contextService.deleteSessionContext(sessionId, userId)
    } else if (workspaceId) {
      deletedCount = await contextService.deleteWorkspaceContext(parseInt(workspaceId))
    } else {
      deletedCount = await contextService.deleteUserContext(userId)
    }

    timer.stop({ deletedCount })

    log.info('Session context cleared successfully', {
      requestId: requestContext.requestId,
      userId: userId.toString(),
      sessionId,
      workspaceId,
      deletedCount
    })

    const response = NextResponse.json(
      {
        status: 'success',
        data: {
          deletedCount
        },
        message: 'Session context cleared successfully'
      },
      { status: 200 }
    )

    response.headers.set('x-request-id', requestContext.requestId)
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  } catch (error) {
    logError(error, {
      operation: 'clear_session_context',
      requestId: requestContext.requestId,
      component: 'session-context-api'
    })

    const response = createErrorResponse('Failed to clear session context', 500, {
      code: 'CLEAR_CONTEXT_ERROR',
      detail: error instanceof Error ? error.message : 'Unknown error occurred while clearing context.',
    })
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  }
}
