/**
 * Workspace Management API
 * Handles workspace creation, listing, and management
 */

import { NextRequest, NextResponse } from 'next/server'
import { WorkspaceProvisioningService } from '@/lib/services/workspace-provisioning-simple'
import { z } from 'zod'

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
  try {
    console.log('🚀 Workspace creation API called')

    // Parse and validate request
    const body = await request.json()
    const validatedRequest = CreateWorkspaceRequestSchema.parse(body)

    console.log(`📝 Creating workspace for project: "${validatedRequest.projectName}"`)

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
    const startTime = Date.now()
    const workspace = await workspaceService.createWorkspace(validatedRequest)
    const creationTime = Date.now() - startTime

    console.log(`✅ Workspace created successfully in ${creationTime}ms`)
    console.log(`🌐 Workspace URL: ${workspace.url}`)
    console.log(`📊 Resources: ${JSON.stringify(workspace.resources)}`)

    // Return workspace details
    return NextResponse.json({
      success: true,
      workspace,
      metadata: {
        creationTime,
        framework: validatedRequest.framework,
        filesCount: Object.keys(validatedRequest.files).length
      }
    })

  } catch (error) {
    console.error('❌ Workspace creation failed:', error)

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request format',
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        },
        { status: 400 }
      )
    }

    // Handle Kubernetes errors
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
        return NextResponse.json(
          { error: 'Insufficient permissions to create workspace' },
          { status: 403 }
        )
      }

      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'Workspace creation timed out. Please try again.' },
          { status: 408 }
        )
      }

      if (error.message.includes('quota') || error.message.includes('resource')) {
        return NextResponse.json(
          { error: 'Insufficient cluster resources. Please try again later.' },
          { status: 507 }
        )
      }
    }

    // Generic error response
    return NextResponse.json(
      { 
        error: 'Workspace creation failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('id')

    // Check if Kubernetes is available
    if (!process.env.KUBECONFIG && !process.env.KUBERNETES_SERVICE_HOST) {
      return NextResponse.json({
        available: false,
        reason: 'Kubernetes cluster not configured'
      })
    }

    const workspaceService = new WorkspaceProvisioningService()

    if (workspaceId) {
      // Get specific workspace
      const workspace = await workspaceService.getWorkspaceStatus(workspaceId)
      
      if (!workspace) {
        return NextResponse.json(
          { error: 'Workspace not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        workspace
      })
    } else {
      // List all workspaces
      const workspaces = await workspaceService.listWorkspaces()

      return NextResponse.json({
        success: true,
        workspaces,
        count: workspaces.length,
        service: 'Workspace Provisioning',
        available: true
      })
    }

  } catch (error) {
    console.error('❌ Failed to get workspace info:', error)
    return NextResponse.json({
      available: false,
      reason: 'Service error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
