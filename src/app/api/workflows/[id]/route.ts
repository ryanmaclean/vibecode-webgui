/**
 * Individual Workflow API Route Handler
 * Provides RESTful endpoints for individual workflow operations
 *
 * Endpoints:
 * - GET /api/workflows/:id - Get workflow definition or execution details
 * - POST /api/workflows/:id - Update workflow or control execution
 * - DELETE /api/workflows/:id - Delete workflow definition
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getWorkflowEngine } from '@/lib/workflow'
import type { WorkflowDefinition } from '@/lib/workflow/types'
import { logger } from '@/lib/logger'
import { z } from '@/lib/zod-compat'
import { createAPIRateLimit } from '@/lib/rate-limiting'

const apiRateLimit = createAPIRateLimit(30) // 30 requests per minute

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Validation schemas
const updateWorkflowSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
  nodes: z.array(z.any()).optional(),
  edges: z.array(z.any()).optional(),
  config: z.record(z.any()).optional(),
})

const controlExecutionSchema = z.object({
  action: z.enum(['pause', 'resume', 'cancel', 'rollback']),
  checkpointId: z.string().optional(), // Required for rollback
})

/**
 * GET /api/workflows/:id
 * Get workflow definition or execution details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting
    const rateLimitResult = await apiRateLimit(request)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
          },
        }
      )
    }

    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      logger.warn('Workflows API unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { id } = resolvedParams
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'execution' // 'definition' or 'execution'
    const includeAudit = searchParams.get('includeAudit') === 'true'
    const includeCheckpoints = searchParams.get('includeCheckpoints') === 'true'

    const engine = getWorkflowEngine()

    if (type === 'execution') {
      // Get execution details
      const execution = engine.getExecution(id)

      if (!execution) {
        return NextResponse.json(
          { error: 'Execution not found' },
          { status: 404 }
        )
      }

      // Convert Map to object for JSON serialization
      const nodesObject: Record<string, any> = {}
      execution.nodes.forEach((value, key) => {
        nodesObject[key] = {
          ...value,
          startedAt: value.startedAt?.toISOString(),
          completedAt: value.completedAt?.toISOString(),
          logs: value.logs.map(log => ({
            ...log,
            timestamp: log.timestamp.toISOString(),
          })),
        }
      })

      const response: any = {
        execution: {
          ...execution,
          nodes: nodesObject,
          metadata: {
            ...execution.metadata,
            startedAt: execution.metadata.startedAt.toISOString(),
            completedAt: execution.metadata.completedAt?.toISOString(),
          },
          checkpoints: execution.checkpoints.map(cp => ({
            ...cp,
            timestamp: cp.timestamp.toISOString(),
          })),
        },
      }

      // Include audit trail if requested
      if (includeAudit) {
        const auditEntries = engine.getExecutionAudit(id)
        response.audit = auditEntries.map(entry => ({
          ...entry,
          timestamp: entry.timestamp.toISOString(),
        }))
      }

      // Include checkpoints if requested
      if (includeCheckpoints) {
        const checkpoints = engine.getCheckpoints(id)
        response.checkpoints = checkpoints.map(cp => ({
          ...cp,
          timestamp: cp.timestamp.toISOString(),
        }))
      }

      logger.info('Workflow execution retrieved', {
        userId: session.user.id,
        executionId: id,
      })

      return NextResponse.json(response)
    } else {
      // Get workflow definition
      // In a real implementation, retrieve from database
      // For now, return not found since we don't have persistent storage

      logger.warn('Workflow definition retrieval not yet implemented', {
        userId: session.user.id,
        workflowId: id,
      })

      return NextResponse.json(
        {
          error: 'Workflow definition storage not yet implemented',
          message:
            'Workflow definitions are validated but not persisted. Use executions to run workflows.',
        },
        { status: 501 }
      )
    }
  } catch (error) {
    logger.error('Failed to get workflow', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        error: 'Failed to get workflow',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/workflows/:id
 * Update workflow definition or control execution
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting
    const rateLimitResult = await apiRateLimit(request)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
          },
        }
      )
    }

    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      logger.warn('Workflows API unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { id } = resolvedParams
    const body = await request.json()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'execution' // 'definition' or 'execution'

    const engine = getWorkflowEngine()

    if (type === 'execution') {
      // Control execution (pause, resume, cancel, rollback)
      const validation = controlExecutionSchema.safeParse(body)
      if (!validation.success) {
        return NextResponse.json(
          {
            error: 'Invalid request',
            details: validation.error.format(),
          },
          { status: 400 }
        )
      }

      const { action, checkpointId } = validation.data
      const execution = engine.getExecution(id)

      if (!execution) {
        return NextResponse.json(
          { error: 'Execution not found' },
          { status: 404 }
        )
      }

      switch (action) {
        case 'cancel':
          await engine.cancelExecution(id)
          logger.info('Workflow execution cancelled', {
            userId: session.user.id,
            executionId: id,
          })
          return NextResponse.json({
            success: true,
            message: 'Execution cancelled',
            execution: { id, status: 'cancelled' },
          })

        case 'resume':
          if (!checkpointId) {
            return NextResponse.json(
              { error: 'checkpointId required for resume action' },
              { status: 400 }
            )
          }
          const resumedExecution = await engine.resumeExecution(id, checkpointId)
          logger.info('Workflow execution resumed', {
            userId: session.user.id,
            executionId: id,
            checkpointId,
          })
          return NextResponse.json({
            success: true,
            message: 'Execution resumed',
            execution: {
              id: resumedExecution.id,
              status: resumedExecution.status,
            },
          })

        case 'rollback':
          if (!checkpointId) {
            return NextResponse.json(
              { error: 'checkpointId required for rollback action' },
              { status: 400 }
            )
          }
          const rollbackResult = await engine.rollbackToCheckpoint(id, checkpointId)
          logger.info('Workflow execution rolled back', {
            userId: session.user.id,
            executionId: id,
            checkpointId,
            nodesAffected: rollbackResult.nodesAffected,
          })
          return NextResponse.json({
            success: true,
            message: 'Execution rolled back',
            result: rollbackResult,
          })

        case 'pause':
          // Pause is not currently supported in the engine
          logger.warn('Pause action not yet implemented', {
            userId: session.user.id,
            executionId: id,
          })
          return NextResponse.json(
            { error: 'Pause action not yet implemented' },
            { status: 501 }
          )

        default:
          return NextResponse.json(
            { error: 'Invalid action' },
            { status: 400 }
          )
      }
    } else {
      // Update workflow definition
      const validation = updateWorkflowSchema.safeParse(body)
      if (!validation.success) {
        return NextResponse.json(
          {
            error: 'Invalid workflow update',
            details: validation.error.format(),
          },
          { status: 400 }
        )
      }

      // In a real implementation, update in database
      logger.warn('Workflow definition update not yet implemented', {
        userId: session.user.id,
        workflowId: id,
      })

      return NextResponse.json(
        {
          error: 'Workflow definition storage not yet implemented',
          message:
            'Workflow definitions are validated but not persisted. Use executions to run workflows.',
        },
        { status: 501 }
      )
    }
  } catch (error) {
    logger.error('Failed to update workflow', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        error: 'Failed to update workflow',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/workflows/:id
 * Delete workflow definition
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting
    const rateLimitResult = await apiRateLimit(request)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
          },
        }
      )
    }

    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      logger.warn('Workflows API unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { id } = resolvedParams

    // In a real implementation, delete from database
    logger.warn('Workflow definition deletion not yet implemented', {
      userId: session.user.id,
      workflowId: id,
    })

    return NextResponse.json(
      {
        error: 'Workflow definition storage not yet implemented',
        message:
          'Workflow definitions are validated but not persisted. Use executions to run workflows.',
      },
      { status: 501 }
    )
  } catch (error) {
    logger.error('Failed to delete workflow', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        error: 'Failed to delete workflow',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
