/**
 * Workspace Management API
 * Handles workspace creation, listing, and management
 */

import { NextRequest, NextResponse } from 'next/server'
import { WorkspaceProvisioningService } from '@/lib/services/workspace-provisioning-simple'
import { z } from '@/lib/zod-compat'
import { createErrorResponse, getErrorMessage } from '@/lib/api-utils'
// import { logger } from '@/lib/logger';
const CreateWorkspaceRequestSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  framework: z.string(),
  userId: z.string().optional().default('anonymous'),
  files: z.record(z.string()),
  dependencies: z.array(z.string()).default([]),
  environment: z.record(z.string()).default({})
})

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  const logContext = {
    service: 'vibecode-webgui',
    component: 'workspace-creation',
    requestId,
    operation: 'create_workspace'
  }

  try {
    console.info('🚀 Workspace creation API called')

    // Parse and validate request
    const body = await request.json()
    const validatedRequest = CreateWorkspaceRequestSchema.parse(body)

    console.info(`📝 Creating workspace for project: "${validatedRequest.projectName}"`)

    // Check if Kubernetes is available
    if (!process.env.KUBECONFIG && !process.env.KUBERNETES_SERVICE_HOST) {
      console.error('❌ Kubernetes not configured')
      return NextResponse.json(
        { 
          error: 'Workspace service not available',
          message: 'Kubernetes cluster not configured. Please deploy to AKS first.'
        },
        { status: 503 }
      )
    }

    // Initialize workspace provisioning service
    const workspaceService = new WorkspaceProvisioningService()

    // Create workspace
    const workspace = await workspaceService.createWorkspace(validatedRequest)
    const creationTime = Date.now() - startTime

    console.info(`✅ Workspace created successfully in ${creationTime}ms`)
    console.info(`🌐 Workspace URL: ${workspace.url}`)
    console.info(`📊 Resources: ${JSON.stringify(workspace.resources)}`)

    // Return workspace details
    return NextResponse.json({
      success: true,
      workspace,
      metadata: {
        creationTime,
        framework: validatedRequest.framework,
        filesCount: Object.keys(validatedRequest.files).length,
        requestId
      }
    })

  } catch (error) {
    console.error('❌ Workspace creation failed:', error)

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return ErrorResponses.validationError(
        'Invalid request format for workspace creation',
        error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
        requestId
      )
    }

    // Handle Kubernetes errors
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
        return ErrorResponses.forbidden(
          'Insufficient permissions to create workspace',
          requestId
        )
      }

      if (error.message.includes('timeout')) {
        return ErrorResponses.badRequest(
          'Workspace creation timed out. Please try again.',
          requestId
        )
      }

      if (error.message.includes('quota') || error.message.includes('resource')) {
        return ErrorResponses.serviceUnavailable(
          'Insufficient cluster resources. Please try again later.',
          requestId
        )
      }
    }

    // Generic error response
    return createProblemDetailsFromError(error, 500, {
      instance: `/api/workspaces`,
      traceId: requestId,
      fallbackTitle: 'Workspace creation failed'
    })
  }
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('id')
  
  const logContext = {
    service: 'vibecode-webgui',
    component: 'workspace-management',
    requestId,
    operation: workspaceId ? 'get_workspace' : 'list_workspaces',
    workspaceId
  }

  try {
    console.log('Workspace management API called', logContext)

    // Check if Kubernetes is available
    if (!process.env.KUBECONFIG && !process.env.KUBERNETES_SERVICE_HOST) {
      console.warn('Kubernetes not available for workspace management', logContext)
      return NextResponse.json({
        available: false,
        reason: 'Kubernetes cluster not configured',
        requestId
      })
    }

    const workspaceService = new WorkspaceProvisioningService()

    if (workspaceId) {
      // Get specific workspace
      console.log('Fetching specific workspace', { ...logContext, workspaceId })
      const workspace = await workspaceService.getWorkspaceStatus(workspaceId)

      if (!workspace) {
        console.warn('Workspace not found', { ...logContext, workspaceId })
        return ErrorResponses.notFound(
          `Workspace with ID ${workspaceId} not found`,
          requestId
        )
      }

      const responseTime = Date.now() - startTime
      logger.performance('get-workspace', responseTime, logContext)

      return NextResponse.json({
        success: true,
        workspace,
        requestId
      })
    } else {
      // List all workspaces
      console.log('Listing all workspaces', logContext)
      const workspaces = await workspaceService.listWorkspaces()

      const responseTime = Date.now() - startTime
      logger.performance('list-workspaces', responseTime, { 
        ...logContext, 
        workspaceCount: workspaces.length 
      })

      return NextResponse.json({
        success: true,
        workspaces,
        count: workspaces.length,
        service: 'Workspace Provisioning',
        available: true,
        requestId
      })
    }

  } catch (error) {
    console.error('❌ Failed to get workspace info:', error)
    return createErrorResponse('Service error', 500, {
      available: false,
      reason: 'Service error',
      details: getErrorMessage(error)
    })
  }
}
