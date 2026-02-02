/**
 * Workspace Management API
 * Handles workspace creation, listing, and management
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { WorkspaceProvisioningService } from '@/lib/services/workspace-provisioning-simple'
import { z } from '@/lib/zod-compat'
import { createErrorResponse, getErrorMessage, createErrorResponseFromError, ApiErrors } from '@/lib/api-utils'
import {
  createServiceLogger,
  createPerformanceTimer,
  logError,
  apiLogger
} from '@/lib/logging'
import { cacheGet, cacheSet, cacheDelete, CacheKeyGenerators, TTLPresets } from '@/lib/cache/cache-utils'
import {
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  getPaginationFromSearchParams,
} from '@/lib/api/pagination'
import { createAPIRateLimit } from '@/lib/rate-limiting'

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'workspace-api'
})

const apiRateLimit = createAPIRateLimit(60) // 60 req/min for workspace operations

const CreateWorkspaceRequestSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  framework: z.string(),
  userId: z.string().optional().default('anonymous'),
  files: z.record(z.string(), z.string()),
  dependencies: z.array(z.string()).default([]),
  environment: z.record(z.string(), z.string()).default({})
})

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestContext = apiLogger.logRequest(request)
  const timer = createPerformanceTimer('workspace-creation', {
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
      log.warn('Unauthorized workspace creation attempt', {
        requestId: requestContext.requestId,
        operation: 'create_workspace'
      })
      const response = ApiErrors.unauthorized(
        'Authentication required to create workspaces',
        requestContext.requestId
      )
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    log.info('Workspace creation API called', {
      requestId: requestContext.requestId,
      operation: 'create_workspace',
      userId: session.user.id
    })

    // Parse and validate request
    const body = await request.json()
    const validatedRequest = CreateWorkspaceRequestSchema.parse(body)

    log.info('Creating workspace for project', {
      requestId: requestContext.requestId,
      projectName: validatedRequest.projectName,
      framework: validatedRequest.framework,
      userId: validatedRequest.userId
    })

    // Check if Kubernetes is available
    if (!process.env.KUBECONFIG && !process.env.KUBERNETES_SERVICE_HOST) {
      log.warn('Kubernetes not configured', {
        requestId: requestContext.requestId
      })

      const response = NextResponse.json(
        {
          error: 'Workspace service not available',
          message: 'Kubernetes cluster not configured. Please deploy to AKS first.',
          requestId: requestContext.requestId
        },
        { status: 503 }
      )
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    // Initialize workspace provisioning service
    const workspaceService = new WorkspaceProvisioningService()

    // Create workspace
    const workspace = await workspaceService.createWorkspace(validatedRequest)
    const duration = timer.stop({
      success: true,
      projectName: validatedRequest.projectName
    })

    log.info('Workspace created successfully', {
      requestId: requestContext.requestId,
      workspaceId: workspace.id,
      workspaceUrl: workspace.url,
      durationMs: duration,
      resources: workspace.resources
    })

    // Invalidate workspace list cache since a new workspace was created
    await cacheDelete('workspaces:list:all')

    const response = NextResponse.json({
      success: true,
      workspace,
      metadata: {
        creationTime: duration,
        framework: validatedRequest.framework,
        filesCount: Object.keys(validatedRequest.files).length,
        requestId: requestContext.requestId
      }
    })

    response.headers.set('x-request-id', requestContext.requestId)
    apiLogger.logResponse(requestContext, response, startTime)
    return response

  } catch (error) {
    timer.stop({ success: false })

    logError(error, {
      operation: 'create_workspace',
      requestId: requestContext.requestId,
      component: 'workspace-api'
    })

    // Handle validation errors
    if (error instanceof z.ZodError) {
      const response = ApiErrors.badRequest(
        `Invalid request format for workspace creation: ${error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        requestContext.requestId
      )
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    // Handle Kubernetes errors
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
        const response = ApiErrors.forbidden(
          'Insufficient permissions to create workspace',
          requestContext.requestId
        )
        apiLogger.logResponse(requestContext, response, startTime)
        return response
      }

      if (error.message.includes('timeout')) {
        const response = ApiErrors.badRequest(
          'Workspace creation timed out. Please try again.',
          requestContext.requestId
        )
        apiLogger.logResponse(requestContext, response, startTime)
        return response
      }

      if (error.message.includes('quota') || error.message.includes('resource')) {
        const response = ApiErrors.serviceUnavailable(
          'Insufficient cluster resources. Please try again later.',
          requestContext.requestId
        )
        apiLogger.logResponse(requestContext, response, startTime)
        return response
      }
    }

    // Generic error response
    const response = createErrorResponseFromError(error, 500, 'Workspace creation failed')
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestContext = apiLogger.logRequest(request)
  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('id')

  const operation = workspaceId ? 'get_workspace' : 'list_workspaces'
  const timer = createPerformanceTimer(operation, {
    requestId: requestContext.requestId,
    workspaceId
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
      log.warn('Unauthorized workspace access attempt', {
        requestId: requestContext.requestId,
        operation
      })
      const response = ApiErrors.unauthorized(
        'Authentication required to access workspaces',
        requestContext.requestId
      )
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    log.info('Workspace management API called', {
      requestId: requestContext.requestId,
      operation,
      workspaceId,
      userId: session.user.id
    })

    // Check if Kubernetes is available
    if (!process.env.KUBECONFIG && !process.env.KUBERNETES_SERVICE_HOST) {
      log.warn('Kubernetes not available for workspace management', {
        requestId: requestContext.requestId,
        operation
      })

      const response = NextResponse.json({
        available: false,
        reason: 'Kubernetes cluster not configured',
        requestId: requestContext.requestId
      })
      timer.stop({ success: true, kubernetesAvailable: false })
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    const workspaceService = new WorkspaceProvisioningService()

    if (workspaceId) {
      // Get specific workspace
      log.debug('Fetching specific workspace', {
        requestId: requestContext.requestId,
        workspaceId
      })

      // Try cache first for workspace status
      const cacheKey = CacheKeyGenerators.workspace(workspaceId)
      const cachedWorkspace = await cacheGet(cacheKey)

      if (cachedWorkspace) {
        const duration = timer.stop({ success: true, cached: true })
        log.info('Workspace retrieved from cache', {
          requestId: requestContext.requestId,
          workspaceId,
          durationMs: duration
        })

        const response = NextResponse.json({
          success: true,
          workspace: cachedWorkspace,
          requestId: requestContext.requestId
        })
        response.headers.set('x-request-id', requestContext.requestId)
        response.headers.set('x-cache', 'HIT')
        apiLogger.logResponse(requestContext, response, startTime)
        return response
      }

      const workspace = await workspaceService.getWorkspaceStatus(workspaceId)

      if (!workspace) {
        log.warn('Workspace not found', {
          requestId: requestContext.requestId,
          workspaceId
        })

        const response = ApiErrors.notFound(
          `Workspace with ID ${workspaceId} not found`,
          requestContext.requestId
        )
        timer.stop({ success: false, reason: 'not_found' })
        apiLogger.logResponse(requestContext, response, startTime)
        return response
      }

      // Cache workspace status for 1 minute (status changes frequently)
      await cacheSet(cacheKey, workspace, { ttl: 60 })

      const duration = timer.stop({ success: true })

      log.info('Workspace retrieved successfully', {
        requestId: requestContext.requestId,
        workspaceId,
        durationMs: duration
      })

      const response = NextResponse.json({
        success: true,
        workspace,
        requestId: requestContext.requestId
      })
      response.headers.set('x-request-id', requestContext.requestId)
      response.headers.set('x-cache', 'MISS')
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    } else {
      // List all workspaces with pagination
      const pagination = getPaginationFromSearchParams(
        searchParams,
        MAX_PAGE_SIZE.WORKSPACES,
        DEFAULT_PAGE_SIZE.WORKSPACES
      )

      log.debug('Listing workspaces with pagination', {
        requestId: requestContext.requestId,
        limit: pagination.limit,
        offset: pagination.offset
      })

      // Try cache first for workspace list (cache key includes pagination)
      const listCacheKey = `workspaces:list:${pagination.limit}:${pagination.offset}`
      const cachedList = await cacheGet<unknown[]>(listCacheKey)

      if (cachedList) {
        const duration = timer.stop({
          success: true,
          workspaceCount: cachedList.length,
          cached: true
        })

        log.info('Workspaces list retrieved from cache', {
          requestId: requestContext.requestId,
          workspaceCount: cachedList.length,
          durationMs: duration
        })

        const response = NextResponse.json({
          success: true,
          workspaces: cachedList,
          count: cachedList.length,
          service: 'Workspace Provisioning',
          available: true,
          requestId: requestContext.requestId,
          pagination: {
            limit: pagination.limit,
            offset: pagination.offset,
            hasMore: cachedList.length === pagination.limit
          }
        })
        response.headers.set('x-request-id', requestContext.requestId)
        response.headers.set('x-cache', 'HIT')
        apiLogger.logResponse(requestContext, response, startTime)
        return response
      }

      const workspaces = await workspaceService.listWorkspaces()

      // Cache workspace list for 30 seconds (list can change frequently)
      await cacheSet(listCacheKey, workspaces, { ttl: 30 })

      const duration = timer.stop({
        success: true,
        workspaceCount: workspaces.length
      })

      log.info('Workspaces listed successfully', {
        requestId: requestContext.requestId,
        workspaceCount: workspaces.length,
        durationMs: duration
      })

      // Apply pagination to results (workspace service may return all, we slice here)
      const paginatedWorkspaces = workspaces.slice(pagination.offset, pagination.offset + pagination.limit)

      const response = NextResponse.json({
        success: true,
        workspaces: paginatedWorkspaces,
        count: paginatedWorkspaces.length,
        totalCount: workspaces.length,
        service: 'Workspace Provisioning',
        available: true,
        requestId: requestContext.requestId,
        pagination: {
          limit: pagination.limit,
          offset: pagination.offset,
          hasMore: pagination.offset + pagination.limit < workspaces.length,
          total: workspaces.length
        }
      })
      response.headers.set('x-request-id', requestContext.requestId)
      response.headers.set('x-cache', 'MISS')
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

  } catch (error) {
    timer.stop({ success: false })

    logError(error, {
      operation,
      requestId: requestContext.requestId,
      component: 'workspace-api',
      metadata: { workspaceId }
    })

    const response = createErrorResponse('Service error', 500, {
      available: false,
      reason: 'Service error',
      details: getErrorMessage(error),
      requestId: requestContext.requestId
    })
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  }
}
