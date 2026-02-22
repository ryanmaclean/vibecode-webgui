/**
 * Workflow Rollback API Route Handler
 * Provides endpoint for rolling back workflow executions to previous checkpoints
 *
 * Endpoints:
 * - POST /api/workflows/:id/rollback - Rollback execution to checkpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getWorkflowEngine } from '@/lib/workflow'
import { logger } from '@/lib/logger'
import { z } from '@/lib/zod-compat'
import { createAPIRateLimit } from '@/lib/rate-limiting'

const apiRateLimit = createAPIRateLimit(30) // 30 requests per minute

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Validation schema for rollback request
const rollbackRequestSchema = z.object({
  checkpointId: z.string(),
})

/**
 * POST /api/workflows/:id/rollback
 * Rollback workflow execution to a previous checkpoint
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
      logger.warn('Rollback API unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { id } = resolvedParams
    const body = await request.json()

    // Validate request body
    const validation = rollbackRequestSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validation.error.format(),
        },
        { status: 400 }
      )
    }

    const { checkpointId } = validation.data

    // Get workflow engine
    const engine = getWorkflowEngine()

    // Verify execution exists
    const execution = engine.getExecution(id)
    if (!execution) {
      logger.warn('Rollback failed: execution not found', {
        userId: session.user.id,
        executionId: id,
      })
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      )
    }

    // Perform rollback
    const rollbackResult = await engine.rollbackToCheckpoint(id, checkpointId)

    logger.info('Workflow execution rolled back', {
      userId: session.user.id,
      executionId: id,
      checkpointId,
      nodesAffected: rollbackResult.nodesAffected,
    })

    return NextResponse.json({
      success: true,
      message: 'Execution rolled back successfully',
      result: {
        success: rollbackResult.success,
        checkpointId: rollbackResult.checkpoint.id,
        nodesAffected: rollbackResult.nodesAffected,
        timestamp: rollbackResult.timestamp.toISOString(),
        checkpoint: {
          id: rollbackResult.checkpoint.id,
          timestamp: rollbackResult.checkpoint.timestamp.toISOString(),
          completedNodes: rollbackResult.checkpoint.completedNodes,
        },
      },
    })
  } catch (error) {
    logger.error('Failed to rollback workflow execution', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        error: 'Failed to rollback execution',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
