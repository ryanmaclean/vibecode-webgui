/**
 * Workspace Templates API
 * Handles listing and browsing of workspace templates
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { WorkspaceTemplateService } from '@/lib/workspace-templates'
import { z } from '@/lib/zod-compat'
import { createErrorResponse, getErrorMessage, createErrorResponseFromError, ApiErrors } from '@/lib/api-utils'
import {
  createServiceLogger,
  createPerformanceTimer,
  logError,
  apiLogger
} from '@/lib/logging'
import { cacheGetOrSet, CacheKeyGenerators, TTLPresets } from '@/lib/cache/cache-utils'
import {
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  getPaginationFromSearchParams,
} from '@/lib/api/pagination'
import { createAPIRateLimit } from '@/lib/rate-limiting'

export const dynamic = 'force-dynamic'

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'workspace-templates-api'
})

const apiRateLimit = createAPIRateLimit(60) // 60 req/min for template browsing

const ListTemplatesQuerySchema = z.object({
  framework: z.string().optional(),
  language: z.string().optional(),
  isPublic: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? Math.min(parseInt(val, 10), MAX_PAGE_SIZE.DEFAULT) : DEFAULT_PAGE_SIZE.DEFAULT)
})

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestContext = apiLogger.logRequest(request)
  const timer = createPerformanceTimer('workspace-templates-list', {
    requestId: requestContext.requestId
  })

  // Rate limiting check
  const rateLimitResult = await apiRateLimit(request)
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Too many requests' }, {
      status: 429,
      headers: {
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.reset.toString(),
        'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
      },
    })
  }

  try {
    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      log.warn('Unauthorized workspace templates list attempt', {
        requestId: requestContext.requestId,
        operation: 'list_workspace_templates'
      })
      const response = ApiErrors.unauthorized(
        'Authentication required to view workspace templates',
        requestContext.requestId
      )
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    log.info('Workspace templates list API called', {
      requestId: requestContext.requestId,
      operation: 'list_workspace_templates',
      userId: session.user.id
    })

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams.entries())
    const validatedQuery = ListTemplatesQuerySchema.parse(queryParams)

    const { page, limit, framework, language, isPublic } = validatedQuery
    const offset = (page - 1) * limit

    log.info('Listing workspace templates', {
      requestId: requestContext.requestId,
      userId: session.user.id,
      page,
      limit,
      offset,
      filters: { framework, language, isPublic }
    })

    // Build cache key based on query parameters
    const cacheKey = `workspace-templates:list:${session.user.id}:${framework || 'all'}:${language || 'all'}:${isPublic ?? 'all'}:${page}:${limit}`

    // Get templates from cache or database
    const templates = await cacheGetOrSet(
      cacheKey,
      async () => {
        const workspaceTemplateService = new WorkspaceTemplateService()

        return await workspaceTemplateService.listTemplates({
          userId: parseInt(session.user.id, 10),
          framework,
          language,
          isPublic,
          limit,
          offset
        })
      },
      { ttl: TTLPresets.MEDIUM } // Cache for 5 minutes
    )

    const duration = timer.stop({
      success: true,
      count: templates.length
    })

    log.info('Workspace templates listed successfully', {
      requestId: requestContext.requestId,
      count: templates.length,
      durationMs: duration,
      filters: { framework, language, isPublic },
      pagination: { page, limit, offset }
    })

    const response = NextResponse.json({
      success: true,
      templates,
      pagination: {
        page,
        limit,
        offset,
        count: templates.length,
        hasMore: templates.length === limit
      },
      filters: {
        framework,
        language,
        isPublic
      },
      metadata: {
        requestId: requestContext.requestId,
        cached: false // Will be true if served from cache on subsequent requests
      }
    })

    response.headers.set('x-request-id', requestContext.requestId)
    apiLogger.logResponse(requestContext, response, startTime)
    return response

  } catch (error) {
    timer.stop({ success: false })

    logError(error, {
      operation: 'list_workspace_templates',
      requestId: requestContext.requestId,
      component: 'workspace-templates-api'
    })

    // Handle validation errors
    if (error instanceof z.ZodError) {
      const response = ApiErrors.badRequest(
        `Invalid query parameters: ${error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        requestContext.requestId
      )
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    // Handle other errors
    const response = createErrorResponseFromError(
      error,
      500,
      'Failed to list workspace templates',
      requestContext.requestId
    )
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  }
}
