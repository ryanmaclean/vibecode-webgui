/**
 * File Watcher Lifecycle Management API
 * Manages file watcher instances for automatic incremental indexing
 *
 * Rate Limited: 10 requests per minute
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { FileWatcher } from '@/lib/indexing/file-watcher'
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
  component: 'file-watcher-api'
})

// Request schema for watch lifecycle management
const watchSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  workspaceId: z.coerce.number().int().positive(),
  projectPath: z.string().min(1),
  action: z.enum(['start', 'stop', 'status'])
})

// Global file watcher registry
// Maps projectId to { watcher, indexer }
const watcherRegistry = new Map<number, {
  watcher: FileWatcher
  indexer: CodebaseIndexer
  startedAt: Date
}>()

/**
 * POST /api/codebase-index/watch - Manage file watcher lifecycle
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
        operation: 'file-watcher-lifecycle'
      })

      const response = createErrorResponse('Unauthorized', 401, {
        code: 'UNAUTHORIZED',
        detail: 'Authentication required to manage file watchers.',
      })
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    const body = await req.json()
    const parseResult = watchSchema.safeParse(body)

    if (!parseResult.success) {
      const response = createErrorResponse('Bad Request', 400, {
        code: 'INVALID_REQUEST_BODY',
        detail: 'Invalid request body',
        validationErrors: parseResult.error.issues,
      })
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    const { projectId, workspaceId, projectPath, action } = parseResult.data

    log.info('File watcher lifecycle request', {
      requestId: requestContext.requestId,
      projectId,
      workspaceId,
      userId: session.user.id,
      action
    })

    const timer = createPerformanceTimer('file-watcher-lifecycle', {
      requestId: requestContext.requestId,
      projectId,
      action
    })

    let responseData: Record<string, unknown> = {}

    switch (action) {
      case 'start': {
        // Check if watcher already exists for this project
        if (watcherRegistry.has(projectId)) {
          const existing = watcherRegistry.get(projectId)
          if (existing?.watcher.isActive()) {
            const response = createErrorResponse('Conflict', 409, {
              code: 'WATCHER_ALREADY_RUNNING',
              detail: `File watcher is already running for project ${projectId}`,
            })
            apiLogger.logResponse(requestContext, response, startTime)
            return response
          } else {
            // Clean up inactive watcher
            await existing?.watcher.dispose()
            watcherRegistry.delete(projectId)
          }
        }

        // Create new file watcher
        const watcher = new FileWatcher({
          watchPath: projectPath,
          workspaceId: workspaceId.toString(),
          projectId: projectId.toString()
        })

        // Create indexer and integrate with watcher
        const indexer = new CodebaseIndexer()
        indexer.integrateWithFileWatcher(
          watcher,
          workspaceId,
          projectId,
          parseInt(session.user.id),
          projectPath
        )

        // Start watching
        await watcher.start()

        // Store in registry
        watcherRegistry.set(projectId, {
          watcher,
          indexer,
          startedAt: new Date()
        })

        log.info('File watcher started', {
          requestId: requestContext.requestId,
          projectId,
          projectPath
        })

        responseData = {
          projectId,
          status: 'started',
          watching: true,
          projectPath,
          startedAt: new Date().toISOString()
        }
        break
      }

      case 'stop': {
        const entry = watcherRegistry.get(projectId)
        if (!entry) {
          const response = createErrorResponse('Not Found', 404, {
            code: 'WATCHER_NOT_FOUND',
            detail: `No active file watcher found for project ${projectId}`,
          })
          apiLogger.logResponse(requestContext, response, startTime)
          return response
        }

        // Stop and dispose watcher
        await entry.watcher.stop()
        await entry.watcher.dispose()
        watcherRegistry.delete(projectId)

        log.info('File watcher stopped', {
          requestId: requestContext.requestId,
          projectId
        })

        responseData = {
          projectId,
          status: 'stopped',
          watching: false
        }
        break
      }

      case 'status': {
        const entry = watcherRegistry.get(projectId)
        const isActive = entry?.watcher.isActive() ?? false

        responseData = {
          projectId,
          watching: isActive,
          startedAt: entry?.startedAt?.toISOString() ?? null,
          config: isActive ? entry?.watcher.getConfig() : null
        }
        break
      }
    }

    timer.stop({ action, success: true })

    const response = NextResponse.json({
      status: 'success',
      data: responseData,
      timestamp: new Date().toISOString()
    })
    response.headers.set('x-request-id', requestContext.requestId)
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  } catch (error) {
    logError(error, {
      operation: 'file_watcher_lifecycle',
      requestId: requestContext.requestId,
      component: 'file-watcher-api'
    })

    const response = createErrorResponse('Internal Server Error', 500, {
      code: 'FILE_WATCHER_ERROR',
      detail: error instanceof Error ? error.message : 'Unknown error occurred while managing file watcher.',
    })
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  }
}
