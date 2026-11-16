/**
 * Agent Emergency Stop API Route Handler
 * Issue #889: Human-in-the-Loop approval workflows
 *
 * Endpoints:
 * - POST /api/agents/:id/stop - Emergency stop running agent
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
 * POST /api/agents/:id/stop
 * Emergency stop a running agent
 * - Gracefully stop the agent
 * - Reject all pending confirmations for this agent
 * - Create audit log entry
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
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
      logger.warn('Agent stop API unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { id: agentId } = resolvedParams

    // Stop agent via HITL Manager
    // This will:
    // 1. Stop the running agent
    // 2. Reject all pending confirmations for this agent
    // 3. Create audit log entries
    const result = globalHITLManager.stopAgent(agentId, session.user.id)

    if (!result) {
      logger.warn('Agent stop failed - agent not found', {
        userId: session.user.id,
        agentId,
      })
      return NextResponse.json(
        {
          error: 'Agent not found',
          message: 'The specified agent does not exist or is not running',
        },
        { status: 404 }
      )
    }

    logger.info('Agent emergency stop executed', {
      userId: session.user.id,
      agentId,
      stoppedBy: session.user.id,
      rejectedConfirmations: result.rejectedConfirmations,
    })

    return NextResponse.json({
      success: true,
      message: 'Agent stopped successfully',
      agent: {
        id: agentId,
        stoppedAt: new Date().toISOString(),
        stoppedBy: session.user.id,
        rejectedConfirmations: result.rejectedConfirmations,
      },
    })
  } catch (error) {
    logger.error('Failed to stop agent', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        error: 'Failed to stop agent',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
