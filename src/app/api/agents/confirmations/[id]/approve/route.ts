/**
 * Agent Confirmation Approval API Route Handler
 * Issue #889: Human-in-the-Loop approval workflows
 *
 * Endpoints:
 * - POST /api/agents/confirmations/:id/approve - Submit approval decision
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
  comment: z.string().optional(),
})

/**
 * POST /api/agents/confirmations/:id/approve
 * Submit an approval decision for an agent confirmation request
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
      logger.warn('Agent approval API unauthorized access attempt')
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

    const { comment } = validation.data
    const approverId = session.user.id

    // Submit approval to HITL Manager
    const result = globalHITLManager.submitApproval(
      id,
      approverId,
      'approved',
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
      decision: 'approved',
      newStatus: result.status,
    })

    return NextResponse.json({
      success: true,
      message: 'Approval decision submitted',
      approval: {
        id: result.id,
        status: result.status,
        decision: 'approved',
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
