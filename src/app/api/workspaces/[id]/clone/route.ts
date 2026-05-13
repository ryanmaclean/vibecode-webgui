/**
 * Workspace Clone API
 * Handles cloning existing workspaces
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { WorkspaceProvisioningService } from '@/lib/services/workspace-provisioning-simple'
import { z } from '@/lib/zod-compat'
import { ApiErrors } from '@/lib/api-utils'
import {
  createServiceLogger,
  createPerformanceTimer,
  logError,
  apiLogger
} from '@/lib/logging'
import { cacheDelete } from '@/lib/cache/cache-utils'
import { createAPIRateLimit } from '@/lib/rate-limiting'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'workspace-clone-api'
})

const apiRateLimit = createAPIRateLimit(60) // 60 req/min for workspace operations

const CloneWorkspaceRequestSchema = z.object({
  name: z.string().min(1, 'Workspace name is required')
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  const requestContext = apiLogger.logRequest(request)
  const timer = createPerformanceTimer('workspace-clone', {
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
      log.warn('Unauthorized workspace clone attempt', {
        requestId: requestContext.requestId,
        operation: 'clone_workspace'
      })
      const response = ApiErrors.unauthorized(
        'Authentication required to clone workspaces',
        requestContext.requestId
      )
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    const { id } = await params
    const workspaceId = id

    log.info('Workspace clone API called', {
      requestId: requestContext.requestId,
      operation: 'clone_workspace',
      userId: session.user.id,
      workspaceId
    })

    // Parse and validate request
    const body = await request.json()
    const validatedRequest = CloneWorkspaceRequestSchema.parse(body)

    log.info('Cloning workspace', {
      requestId: requestContext.requestId,
      sourceWorkspaceId: workspaceId,
      newWorkspaceName: validatedRequest.name,
      userId: session.user.id
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

    // Fetch source workspace from database to get configuration
    const sourceWorkspace = await prisma.workspace.findUnique({
      where: { workspace_id: workspaceId },
      include: {
        projects: {
          select: {
            name: true,
            framework: true,
            language: true,
            template: true
          }
        }
      }
    })

    if (!sourceWorkspace) {
      log.warn('Source workspace not found', {
        requestId: requestContext.requestId,
        workspaceId
      })
      const response = ApiErrors.notFound(
        `Workspace not found: ${workspaceId}`,
        requestContext.requestId
      )
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    if (sourceWorkspace.user_id !== parseInt(session.user.id, 10)) {
      log.warn('Forbidden workspace clone attempt', {
        requestId: requestContext.requestId,
        workspaceId,
        ownerId: sourceWorkspace.user_id,
        requestingUserId: session.user.id
      })
      const response = NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    // Extract configuration from source workspace
    // Framework and language are stored in the database
    // Files, dependencies, and environment are not stored in DB (only exist in K8s workspace)
    const sourceFramework = sourceWorkspace.projects[0]?.framework || 'react'

    // Create cloned workspace with same configuration
    const clonedWorkspace = await workspaceService.createWorkspace({
      projectId: `${workspaceId}-clone-${Date.now()}`,
      projectName: validatedRequest.name,
      framework: sourceFramework,
      userId: session.user.id,
      files: {}, // Not stored in database - would need to fetch from K8s workspace
      dependencies: [], // Not stored in database - would need to fetch from K8s workspace
      environment: {} // Not stored in database - would need to fetch from K8s workspace
    })

    const duration = timer.stop({
      success: true,
      sourceWorkspaceId: workspaceId
    })

    log.info('Workspace cloned successfully', {
      requestId: requestContext.requestId,
      sourceWorkspaceId: workspaceId,
      clonedWorkspaceId: clonedWorkspace.id,
      clonedWorkspaceUrl: clonedWorkspace.url,
      durationMs: duration
    })

    // Invalidate workspace list cache since a new workspace was created
    await cacheDelete('workspaces:list:all')

    const response = NextResponse.json({
      success: true,
      workspace: clonedWorkspace,
      sourceWorkspaceId: workspaceId,
      metadata: {
        cloneTime: duration,
        requestId: requestContext.requestId
      }
    })

    response.headers.set('x-request-id', requestContext.requestId)
    apiLogger.logResponse(requestContext, response, startTime)
    return response

  } catch (error) {
    timer.stop({ success: false })

    logError(error, {
      operation: 'clone_workspace',
      requestId: requestContext.requestId,
      component: 'workspace-clone-api'
    })

    // Handle validation errors
    if (error instanceof z.ZodError) {
      const response = ApiErrors.badRequest(
        `Invalid request format for workspace clone: ${error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        requestContext.requestId
      )
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    // Handle Kubernetes errors
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
        const response = ApiErrors.forbidden(
          'Insufficient permissions to clone workspace',
          requestContext.requestId
        )
        apiLogger.logResponse(requestContext, response, startTime)
        return response
      }

      if (error.message.includes('timeout')) {
        const response = ApiErrors.badRequest(
          'Workspace clone timed out. Please try again.',
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
    const response = NextResponse.json(
      {
        error: 'Failed to clone workspace',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        requestId: requestContext.requestId
      },
      { status: 500 }
    )
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  }
}
