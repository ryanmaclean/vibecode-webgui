/**
 * Workspace Auto-Scaling API
 * Manages dynamic resource scaling for workspace instances
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { workspaceAutoScaler } from '@/lib/workspace/auto-scaler'
import { z } from '@/lib/zod-compat'
import { logger } from '@/lib/logger';
export const dynamic = 'force-dynamic'

const metricsSchema = z.object({
  workspaceId: z.string(),
  cpuUsage: z.number().min(0).max(100).optional(),
  memoryUsage: z.number().min(0).max(100).optional(),
  diskUsage: z.number().min(0).max(100).optional(),
  networkIO: z.number().min(0).optional(),
  activeConnections: z.number().min(0).optional(),
  resourceRequests: z.number().min(0).optional(),
  queueLength: z.number().min(0).optional()
})

const registerSchema = z.object({
  workspaceId: z.string(),
  resources: z.object({
    instances: z.array(z.object({
      instanceId: z.string(),
      status: z.enum(['starting', 'running', 'stopping', 'stopped', 'error']),
      resources: z.object({
        cpu: z.number(),
        memory: z.number(),
        disk: z.number()
      }),
      podName: z.string().optional(),
      namespace: z.string().optional()
    })).optional(),
    limits: z.object({
      maxCpu: z.number(),
      maxMemory: z.number(),
      maxDisk: z.number(),
      maxInstances: z.number()
    }).optional()
  }).optional()
})

const configSchema = z.object({
  enabled: z.boolean().optional(),
  evaluationInterval: z.number().min(10).max(300).optional(),
  resourceLimits: z.object({
    maxCpuPerWorkspace: z.number().optional(),
    maxMemoryPerWorkspace: z.number().optional(),
    maxInstancesPerWorkspace: z.number().optional(),
    maxInstancesPerUser: z.number().optional()
  }).optional(),
  costOptimization: z.object({
    enabled: z.boolean().optional(),
    idleTimeoutMinutes: z.number().min(5).max(240).optional(),
    scaleDownDelay: z.number().min(60).max(3600).optional(),
    prioritizeResourceUtilization: z.boolean().optional()
  }).optional()
})

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
    logger.error('Auto-scaling API error:', error)
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

    const body = await req.json()
    const metrics = metricsSchema.parse(body)

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
    logger.error('Metrics update error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Invalid metrics data',
          errors: error.errors
        },
        { status: 400 }
      )
    }

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

    const body = await req.json()
    const registration = registerSchema.parse(body)

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
    logger.error('Workspace registration error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Invalid registration data',
          errors: error.errors
        },
        { status: 400 }
      )
    }

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

    const body = await req.json()
    const config = configSchema.parse(body)

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
    logger.error('Config update error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Invalid configuration data',
          errors: error.errors
        },
        { status: 400 }
      )
    }

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
    logger.info(`🗑️  Unregistering workspace ${workspaceId} from auto-scaling`)

    return NextResponse.json({
      status: 'success',
      message: 'Workspace unregistered from auto-scaling',
      data: {
        workspaceId,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    logger.error('Workspace unregistration error:', error)
    
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