/**
 * Workspace Auto-Scaling API
 * Manages dynamic resource scaling for workspace instances
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { workspaceAutoScaler } from '@/lib/workspace/auto-scaler'
// import { logger } from '@/lib/logger'
import { validateRequestBody } from '@/lib/api/validation/middleware'
import {
  workspaceMetricsSchema,
  workspaceRegistrationSchema,
  autoScalingConfigSchema
} from '@/lib/api/validation/schemas-phase4-batch2'
import { workspaceIdSchema } from '@/lib/api/validation/schemas'
export const dynamic = 'force-dynamic'

/**
 * GET /api/workspace/auto-scaling - Get scaling status and statistics
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')
    const action = searchParams.get('action')

    if (action === 'stats') {
      const stats = workspaceAutoScaler.getScalingStats()
      return NextResponse.json({
        status: 'success',
        data: stats,
        timestamp: new Date().toISOString()
      })
    }

    if (workspaceId) {
      const workspaceStatus = workspaceAutoScaler.getWorkspaceStatus(workspaceId)
      
      // Check if user owns the workspace (simplified check)
      if (workspaceStatus.metrics?.userId !== session.user.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }

      return NextResponse.json({
        status: 'success',
        data: workspaceStatus,
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json({
      status: 'success',
      message: 'Workspace Auto-Scaling API',
      endpoints: {
        'GET ?workspaceId=<id>': 'Get workspace scaling status',
        'GET ?action=stats': 'Get scaling statistics',
        'POST': 'Update workspace metrics',
        'PUT': 'Register workspace for auto-scaling',
        'PATCH': 'Update auto-scaling configuration'
      }
    })
  } catch (error) {
    console.error('Auto-scaling API error:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/workspace/auto-scaling - Update workspace metrics
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate request body
    const validation = await validateRequestBody(req, workspaceMetricsSchema)
    if (!validation.success) {
      return validation.error as NextResponse
    }

    const metrics = validation.data

    // Add user ID to metrics
    const metricsWithUser = {
      ...metrics,
      userId: session.user.id
    }

    await workspaceAutoScaler.updateMetrics(metrics.workspaceId, metricsWithUser)

    return NextResponse.json({
      status: 'success',
      message: 'Workspace metrics updated',
      data: {
        workspaceId: metrics.workspaceId,
        metricsUpdated: Object.keys(metrics).filter(k => k !== 'workspaceId').length,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Metrics update error:', error)

    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to update metrics',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/workspace/auto-scaling - Register workspace for auto-scaling
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate request body
    const validation = await validateRequestBody(req, workspaceRegistrationSchema)
    if (!validation.success) {
      return validation.error as NextResponse
    }

    const registration = validation.data

    await workspaceAutoScaler.registerWorkspace(
      registration.workspaceId, 
      registration.resources || {}
    )

    // Initialize metrics for the workspace
    await workspaceAutoScaler.updateMetrics(registration.workspaceId, {
      workspaceId: registration.workspaceId,
      userId: session.user.id,
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      networkIO: 0,
      activeConnections: 0,
      resourceRequests: 0,
      queueLength: 0
    })

    return NextResponse.json({
      status: 'success',
      message: 'Workspace registered for auto-scaling',
      data: {
        workspaceId: registration.workspaceId,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Workspace registration error:', error)

    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to register workspace',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/workspace/auto-scaling - Update auto-scaling configuration
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin role
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Validate request body
    const validation = await validateRequestBody(req, autoScalingConfigSchema)
    if (!validation.success) {
      return validation.error as NextResponse
    }

    const config = validation.data

    workspaceAutoScaler.updateConfig(config)

    return NextResponse.json({
      status: 'success',
      message: 'Auto-scaling configuration updated',
      data: {
        configUpdated: Object.keys(config),
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Config update error:', error)

    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to update configuration',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/workspace/auto-scaling - Unregister workspace from auto-scaling
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    // Check ownership
    const status = workspaceAutoScaler.getWorkspaceStatus(workspaceId)
    if (status.metrics?.userId !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // In a real implementation, you would remove the workspace from tracking
    // For now, we'll just log it
    console.log(`🗑️  Unregistering workspace ${workspaceId} from auto-scaling`)

    return NextResponse.json({
      status: 'success',
      message: 'Workspace unregistered from auto-scaling',
      data: {
        workspaceId,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Workspace unregistration error:', error)
    
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to unregister workspace',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}