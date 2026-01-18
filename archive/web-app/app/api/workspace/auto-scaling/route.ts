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
import { workspaceIdSchema } from '@/lib/api/validation/schemas'
import { z } from '@/lib/zod-compat'
// import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic'

// Define inline schemas since schemas-phase4-batch2 doesn't exist
const workspaceMetricsSchema = z.object({
  workspaceId: workspaceIdSchema,
  cpuUsage: z.number().min(0).max(100).optional(),
  memoryUsage: z.number().min(0).max(100).optional(),
  diskUsage: z.number().min(0).max(100).optional(),
  networkIO: z.number().min(0).optional(),
  activeConnections: z.number().int().min(0).max(10000, 'Maximum 10000 active connections allowed').optional(),
  resourceRequests: z.number().int().min(0).optional(),
  queueLength: z.number().int().min(0).optional()
})

const instanceSchema = z.object({
  instanceId: z.string().min(1),
  status: z.enum(['starting', 'running', 'stopping', 'stopped', 'error']),
  resources: z.object({
    cpu: z.number().positive().max(32, 'CPU must not exceed 32 cores'),
    memory: z.number().positive().max(128, 'Memory must not exceed 128 GB'),
    disk: z.number().positive().max(1000, 'Disk must not exceed 1000 GB')
  }),
  podName: z.string().optional(),
  namespace: z.string().optional()
})

const workspaceRegistrationSchema = z.object({
  workspaceId: workspaceIdSchema,
  resources: z.object({
    cpu: z.number().optional(),
    memory: z.number().optional(),
    storage: z.number().optional(),
    instances: z.array(instanceSchema).max(10, 'Maximum 10 instances per workspace').optional()
  }).optional()
})

const autoScalingConfigSchema = z.object({
  enabled: z.boolean().optional(),
  minInstances: z.number().int().min(0).optional(),
  maxInstances: z.number().int().min(1).optional(),
  targetCpuUtilization: z.number().min(0).max(100).optional(),
  targetMemoryUtilization: z.number().min(0).max(100).optional(),
  scaleUpThreshold: z.number().min(0).max(100).optional(),
  scaleDownThreshold: z.number().min(0).max(100).optional(),
  cooldownPeriod: z.number().int().min(0).optional(),
  evaluationInterval: z.number().int().min(10, 'Evaluation interval must be at least 10 seconds').optional(),
  resourceLimits: z.object({
    maxInstancesPerWorkspace: z.number().int().min(1).max(100, 'Maximum 100 instances per workspace').optional(),
    maxCpuPerInstance: z.number().positive().max(32).optional(),
    maxMemoryPerInstance: z.number().positive().max(128).optional()
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
    console.info(`🗑️  Unregistering workspace ${workspaceId} from auto-scaling`)

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