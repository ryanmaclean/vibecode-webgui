/**
 * Individual Workspace Management API
 * Handles specific workspace operations (get, delete, update)
 */

import { NextRequest, NextResponse } from 'next/server'
import { WorkspaceProvisioningService } from '@/lib/services/workspace-provisioning-simple'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const workspaceId = id
    console.log(`🔍 Getting workspace status: ${workspaceId}`)

    // Check if Kubernetes is available
    if (!process.env.KUBECONFIG && !process.env.KUBERNETES_SERVICE_HOST) {
      return NextResponse.json(
        { error: 'Workspace service not available' },
        { status: 503 }
      )
    }

    const workspaceService = new WorkspaceProvisioningService()
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

  } catch (error) {
    console.error('❌ Failed to get workspace:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get workspace',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const workspaceId = id
    console.log(`🗑️ Deleting workspace: ${workspaceId}`)

    // Check if Kubernetes is available
    if (!process.env.KUBECONFIG && !process.env.KUBERNETES_SERVICE_HOST) {
      return NextResponse.json(
        { error: 'Workspace service not available' },
        { status: 503 }
      )
    }

    const workspaceService = new WorkspaceProvisioningService()
    await workspaceService.deleteWorkspace(workspaceId)

    console.log(`✅ Workspace deleted: ${workspaceId}`)

    return NextResponse.json({
      success: true,
      message: `Workspace ${workspaceId} deleted successfully`
    })

  } catch (error) {
    console.error('❌ Failed to delete workspace:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete workspace',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const workspaceId = id
    console.log(`🔄 Updating workspace: ${workspaceId}`)

    // For now, we'll just return the current status
    // TODO: Implement workspace updates (scaling, configuration changes)
    
    const workspaceService = new WorkspaceProvisioningService()
    const workspace = await workspaceService.getWorkspaceStatus(workspaceId)

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      workspace,
      message: 'Workspace update not yet implemented'
    })

  } catch (error) {
    console.error('❌ Failed to update workspace:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update workspace',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
