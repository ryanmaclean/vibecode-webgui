/**
 * Individual Workspace Management API
 * Handles specific workspace operations (get, delete, update)
 */

import { NextRequest, NextResponse } from 'next/server'
import { WorkspaceProvisioningService } from '@/lib/services/workspace-provisioning-simple'
<<<<<<< Updated upstream
=======
import { logger } from '@/lib/logger'
import { z } from 'zod'

// Zod validation schemas for workspace ID parameter
const WorkspaceIdParamSchema = z.object({
  id: z.string()
    .min(1, 'Workspace ID cannot be empty')
    .max(64, 'Workspace ID cannot exceed 64 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Workspace ID must contain only alphanumeric characters, hyphens, and underscores'
    )
    .refine(
      (id) => !id.includes('..') && !id.startsWith('.') && !id.endsWith('.'),
      'Workspace ID contains invalid path traversal patterns'
    )
})

// Zod validation schema for PATCH request body
const WorkspaceUpdateSchema = z.object({
  resources: z.object({
    cpu: z.string().regex(/^\d+m?$/, 'Invalid CPU format').optional(),
    memory: z.string().regex(/^\d+(Mi|Gi)$/, 'Invalid memory format').optional(),
    storage: z.string().regex(/^\d+(Mi|Gi)$/, 'Invalid storage format').optional()
  }).optional(),
  scaling: z.object({
    minReplicas: z.number().int().min(0).max(10).optional(),
    maxReplicas: z.number().int().min(1).max(50).optional()
  }).optional(),
  metadata: z.record(
    z.string().max(100, 'Metadata key too long'),
    z.string().max(500, 'Metadata value too long')
  ).optional()
}).strict()
>>>>>>> Stashed changes

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

/**
 * Validate workspace ID with comprehensive security checks
 */
function validateWorkspaceId(id: string): { valid: boolean; error?: string } {
  try {
    WorkspaceIdParamSchema.parse({ id })
    return { valid: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        error: error.errors.map(e => e.message).join(', ')
      }
    }
    return { valid: false, error: 'Validation failed' }
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const workspaceId = id
<<<<<<< Updated upstream
    console.log(`🔍 Getting workspace status: ${workspaceId}`)
=======

    // Validate workspace ID
    const validation = validateWorkspaceId(workspaceId)
    if (!validation.valid) {
      logger.warn('Invalid workspace ID in GET request', {
        workspaceId,
        error: validation.error,
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      })
      return NextResponse.json(
        { error: 'Invalid workspace ID', details: validation.error },
        { status: 400 }
      )
    }

    logger.info('Getting workspace status', { workspaceId })
>>>>>>> Stashed changes

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
    logger.error('Failed to get workspace', { error })
    return NextResponse.json(
      { 
        error: 'Failed to get workspace',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const workspaceId = id
<<<<<<< Updated upstream
    console.log(`🗑️ Deleting workspace: ${workspaceId}`)
=======

    // Validate workspace ID with enhanced logging for destructive operations
    const validation = validateWorkspaceId(workspaceId)
    if (!validation.valid) {
      logger.warn('Invalid workspace ID in DELETE request', {
        workspaceId,
        error: validation.error,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        severity: 'high'
      })
      return NextResponse.json(
        { error: 'Invalid workspace ID', details: validation.error },
        { status: 400 }
      )
    }

    logger.info('Deleting workspace', { workspaceId })
>>>>>>> Stashed changes

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
    logger.error('Failed to delete workspace', { error })
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
<<<<<<< Updated upstream
    console.log(`🔄 Updating workspace: ${workspaceId}`)
=======

    // Validate workspace ID
    const validation = validateWorkspaceId(workspaceId)
    if (!validation.valid) {
      logger.warn('Invalid workspace ID in PATCH request', {
        workspaceId,
        error: validation.error,
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      })
      return NextResponse.json(
        { error: 'Invalid workspace ID', details: validation.error },
        { status: 400 }
      )
    }

    // Parse and validate request body
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    // Validate update payload
    const updateValidation = WorkspaceUpdateSchema.safeParse(body)
    if (!updateValidation.success) {
      logger.warn('Invalid workspace update payload', {
        workspaceId,
        errors: updateValidation.error.errors,
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      })
      return NextResponse.json(
        {
          error: 'Invalid update payload',
          details: updateValidation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        },
        { status: 400 }
      )
    }

    logger.info('Updating workspace', { workspaceId, updates: updateValidation.data })
>>>>>>> Stashed changes

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
      message: 'Workspace update not yet implemented',
      requestedUpdates: updateValidation.data
    })

  } catch (error) {
    logger.error('Failed to update workspace', { error })
    return NextResponse.json(
      { 
        error: 'Failed to update workspace',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
