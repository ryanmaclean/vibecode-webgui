/**
 * Workflow Approval API Route Handler
 * Issue #889: Human-in-the-Loop approval workflows
 *
 * Endpoints:
 * - POST /api/workflows/:id/approve - Submit approval decision
 * - GET /api/workflows/:id/approve - Get approval request details
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { globalHITLManager } from '@/lib/workflow/hitl-manager'
import { logger } from '@/lib/logger'
import { z } from '@/lib/zod-compat'
import { createAPIRateLimit } from '@/lib/rate-limiting'

const apiRateLimit = createAPIRateLimit(30) // 30 requests per minute

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Validation schema for approval decision
const approvalDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  approverId: z.string(),
  comment: z.string().optional(),
})

/**
 * POST /api/workflows/:id/approve
 * Submit an approval decision for a workflow
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
      logger.warn('Approval API unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { id } = resolvedParams
    const body = await request.json()

    // Validate request body
    const validation = approvalDecisionSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validation.error.format(),
        },
        { status: 400 }
      )
    }

    const { decision, approverId, comment } = validation.data

    // Submit approval to HITL Manager
    const result = globalHITLManager.submitApproval(
      id,
      approverId,
      decision,
      comment
    )

    if (!result) {
      logger.warn('Approval submission failed', {
        userId: session.user.id,
        requestId: id,
        approverId,
      })
      return NextResponse.json(
        {
          error: 'Approval failed',
          message:
            'Request not found, already processed, or approver not authorized',
        },
        { status: 404 }
      )
    }

    logger.info('Approval decision submitted', {
      userId: session.user.id,
      requestId: id,
      approverId,
      decision,
      newStatus: result.status,
    })

    return NextResponse.json({
      success: true,
      message: 'Approval decision submitted',
      approval: {
        id: result.id,
        status: result.status,
        decision,
        approverId,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.error('Failed to submit approval', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        error: 'Failed to submit approval',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/workflows/:id/approve
 * Get approval request details
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
      logger.warn('Approval API unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { id } = resolvedParams

    // Get approval request from HITL Manager
    const request = globalHITLManager.getRequest(id)

    if (!request) {
      logger.warn('Approval request not found', {
        userId: session.user.id,
        requestId: id,
      })
      return NextResponse.json(
        { error: 'Approval request not found' },
        { status: 404 }
      )
    }

    logger.info('Approval request retrieved', {
      userId: session.user.id,
      requestId: id,
      status: request.status,
    })

    return NextResponse.json({
      request: {
        id: request.id,
        type: request.type,
        title: request.title,
        description: request.description,
        agentId: request.agentId,
        taskId: request.taskId,
        status: request.status,
        priority: request.priority,
        requiredApprovers: request.requiredApprovers,
        approvals: request.approvals.map(a => ({
          ...a,
          timestamp: a.timestamp.toISOString(),
        })),
        createdAt: request.createdAt.toISOString(),
        expiresAt: request.expiresAt.toISOString(),
        escalationChain: request.escalationChain,
        currentEscalationLevel: request.currentEscalationLevel,
      },
    })
  } catch (error) {
    logger.error('Failed to get approval request', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        error: 'Failed to get approval request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
