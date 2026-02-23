/**
 * Agent Confirmations API Route Handler
 * Issue #889: Human-in-the-Loop approval workflows
 *
 * Endpoints:
 * - GET /api/agents/confirmations - List pending confirmation requests
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { createAPIRateLimit } from '@/lib/rate-limiting'

const apiRateLimit = createAPIRateLimit(30) // 30 requests per minute

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/agents/confirmations
 * List all pending confirmation requests
 */
export async function GET(request: NextRequest) {
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
      logger.warn('Confirmations API unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters for pagination and filtering
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const status = searchParams.get('status') || 'pending'
    const agentId = searchParams.get('agent_id')
    const riskLevel = searchParams.get('risk_level')

    const skip = (page - 1) * limit

    // Build where clause for filtering
    const where: {
      status?: string
      agent_id?: string
      risk_level?: string
    } = {}

    if (status) {
      where.status = status
    }

    if (agentId) {
      where.agent_id = agentId
    }

    if (riskLevel) {
      where.risk_level = riskLevel
    }

    // Query confirmation requests from database
    const [confirmations, total] = await Promise.all([
      prisma.confirmationRequest.findMany({
        where,
        orderBy: {
          created_at: 'desc',
        },
        skip,
        take: limit,
        select: {
          id: true,
          request_id: true,
          agent_id: true,
          action_type: true,
          file_path: true,
          status: true,
          risk_level: true,
          metadata: true,
          created_at: true,
          expires_at: true,
          approved_at: true,
          approved_by: true,
        },
      }),
      prisma.confirmationRequest.count({ where }),
    ])

    logger.info('Confirmation requests retrieved', {
      userId: session.user.id,
      count: confirmations.length,
      total,
      page,
      limit,
      status,
    })

    return NextResponse.json({
      confirmations: confirmations.map(
        (confirmation: {
          id: string
          request_id: string
          agent_id: string
          action_type: string
          file_path: string | null
          status: string
          risk_level: string
          metadata: unknown
          created_at: Date
          expires_at: Date
          approved_at: Date | null
          approved_by: number | null
        }) => ({
        id: confirmation.id,
        request_id: confirmation.request_id,
        agent_id: confirmation.agent_id,
        action_type: confirmation.action_type,
        file_path: confirmation.file_path,
        status: confirmation.status,
        risk_level: confirmation.risk_level,
        metadata: confirmation.metadata,
        created_at: confirmation.created_at.toISOString(),
        expires_at: confirmation.expires_at.toISOString(),
        approved_at: confirmation.approved_at?.toISOString() ?? null,
        approved_by: confirmation.approved_by,
      })
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    logger.error('Failed to retrieve confirmation requests', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        error: 'Failed to retrieve confirmation requests',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
