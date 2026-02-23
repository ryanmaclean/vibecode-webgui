/**
 * Agent Confirmation Details API Route Handler
 * Issue #889: Human-in-the-Loop approval workflows
 *
 * Endpoints:
 * - GET /api/agents/confirmations/:id - Get confirmation details
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { globalHITLManager } from '@/lib/workflow/hitl-manager'
import { logger } from '@/lib/logger'
import { createAPIRateLimit } from '@/lib/rate-limiting'

const apiRateLimit = createAPIRateLimit(30) // 30 requests per minute

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/agents/confirmations/:id
 * Get confirmation details for a specific agent confirmation request
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
      logger.warn('Agent confirmation API unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { id } = resolvedParams

    // Get confirmation request from HITL Manager
    const confirmationRequest = globalHITLManager.getRequest(id)

    if (!confirmationRequest) {
      logger.warn('Confirmation request not found', {
        userId: session.user.id,
        requestId: id,
      })
      return NextResponse.json(
        { error: 'Confirmation request not found' },
        { status: 404 }
      )
    }

    logger.info('Confirmation request retrieved', {
      userId: session.user.id,
      requestId: id,
      status: confirmationRequest.status,
    })

    return NextResponse.json({
      request: {
        id: confirmationRequest.id,
        type: confirmationRequest.type,
        title: confirmationRequest.title,
        description: confirmationRequest.description,
        agentId: confirmationRequest.agentId,
        taskId: confirmationRequest.taskId,
        status: confirmationRequest.status,
        priority: confirmationRequest.priority,
        requiredApprovers: confirmationRequest.requiredApprovers,
        approvals: confirmationRequest.approvals.map(a => ({
          ...a,
          timestamp: a.timestamp.toISOString(),
        })),
        createdAt: confirmationRequest.createdAt.toISOString(),
        expiresAt: confirmationRequest.expiresAt.toISOString(),
        escalationChain: confirmationRequest.escalationChain,
        currentEscalationLevel: confirmationRequest.currentEscalationLevel,
      },
    })
  } catch (error) {
    logger.error('Failed to get confirmation request', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        error: 'Failed to get confirmation request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
