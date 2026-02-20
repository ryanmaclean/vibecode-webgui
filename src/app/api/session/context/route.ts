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
import { validateRequestBody } from '@/lib/api/validation/middleware'
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
  metadata: z.record(z.unknown()).optional()
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
      userId,
      sessionId,
      workspaceId,
      contentLength: content.length
    })

    // Store context using the service
    const timer = createPerformanceTimer('store-session-context', {
      requestId: requestContext.requestId,
      userId
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
      contextId: storedContext.id,
      userId,
      sessionId: storedContext.sessionId,
      workspaceId: storedContext.workspaceId
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
