/**
 * Agent Confirmation Rollback API Route Handler
 * Issue #889: Human-in-the-Loop approval workflows
 *
 * Endpoints:
 * - POST /api/agents/confirmations/:id/rollback - Rollback an approved operation
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { globalHITLManager } from '@/lib/workflow/hitl-manager'
import { logger } from '@/lib/logger'
import { z } from '@/lib/zod-compat'
import { createAPIRateLimit } from '@/lib/rate-limiting'
import { createRollbackService } from '@/lib/agent-framework/rollback/service'
import { logAudit, AuditAction } from '@/lib/audit'

const apiRateLimit = createAPIRateLimit(30) // 30 requests per minute

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Global rollback service instance
const rollbackService = createRollbackService()

// Validation schema for rollback request
const rollbackRequestSchema = z.object({
  comment: z.string().optional(),
  snapshotId: z.string().optional(), // Optional specific snapshot ID to rollback
})

/**
 * POST /api/agents/confirmations/:id/rollback
 * Rollback an approved operation to its previous state
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

    // Parse request body (allow empty body)
    let body = {}
    try {
      const text = await request.text()
      if (text) {
        body = JSON.parse(text)
      }
    } catch {
      // Empty or invalid body, use empty object
    }

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

    const { comment, snapshotId } = validation.data
    const userId = session.user.id

    // Verify confirmation request exists
    const confirmation = globalHITLManager.getRequest(id)
    if (!confirmation) {
      logger.warn('Rollback failed - confirmation not found', {
        userId: session.user.id,
        confirmationId: id,
      })
      return NextResponse.json(
        {
          error: 'Confirmation not found',
          message: 'The specified confirmation request does not exist',
        },
        { status: 404 }
      )
    }

    // Get snapshots for this confirmation
    let snapshotsToRollback
    if (snapshotId) {
      // Rollback specific snapshot
      const snapshot = await rollbackService.getSnapshot(snapshotId)
      if (!snapshot) {
        logger.warn('Rollback failed - snapshot not found', {
          userId: session.user.id,
          confirmationId: id,
          snapshotId,
        })
        return NextResponse.json(
          {
            error: 'Snapshot not found',
            message: 'The specified snapshot does not exist',
          },
          { status: 404 }
        )
      }

      if (snapshot.confirmation_id !== id) {
        logger.warn('Rollback failed - snapshot does not belong to confirmation', {
          userId: session.user.id,
          confirmationId: id,
          snapshotId,
          actualConfirmationId: snapshot.confirmation_id,
        })
        return NextResponse.json(
          {
            error: 'Invalid snapshot',
            message: 'The specified snapshot does not belong to this confirmation',
          },
          { status: 400 }
        )
      }

      snapshotsToRollback = [snapshot]
    } else {
      // Get all available snapshots for the confirmation
      const { snapshots } = await rollbackService.listSnapshots(id, {
        status: 'available',
      })

      if (snapshots.length === 0) {
        logger.warn('Rollback failed - no available snapshots', {
          userId: session.user.id,
          confirmationId: id,
        })
        return NextResponse.json(
          {
            error: 'No snapshots available',
            message: 'No snapshots are available for rollback',
          },
          { status: 404 }
        )
      }

      snapshotsToRollback = snapshots
    }

    // Rollback all snapshots
    const results = []
    for (const snapshot of snapshotsToRollback) {
      const result = await rollbackService.restoreSnapshot(snapshot.id, userId)
      results.push(result)

      // Create audit log entry for each rollback
      await logAudit({
        action: AuditAction.FILE_RESTORED,
        userId,
        resourceType: 'confirmation',
        resourceId: id,
        details: {
          confirmationId: id,
          snapshotId: snapshot.id,
          operationType: snapshot.operation_type,
          filePath: snapshot.file_path,
          comment,
          success: result.success,
          error: result.error,
        },
      })
    }

    // Check if all rollbacks succeeded
    const allSucceeded = results.every((r) => r.success)
    const failedCount = results.filter((r) => !r.success).length

    logger.info('Rollback operation completed', {
      userId: session.user.id,
      confirmationId: id,
      snapshotCount: results.length,
      successCount: results.length - failedCount,
      failedCount,
      allSucceeded,
    })

    return NextResponse.json({
      success: allSucceeded,
      message: allSucceeded
        ? 'Rollback completed successfully'
        : `Rollback partially completed (${failedCount} failed)`,
      rollback: {
        confirmationId: id,
        snapshotCount: results.length,
        successCount: results.length - failedCount,
        failedCount,
        results: results.map((r) => ({
          snapshotId: r.snapshot.id,
          success: r.success,
          error: r.error,
          filePath: r.snapshot.file_path,
          operationType: r.snapshot.operation_type,
        })),
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.error('Failed to rollback operation', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        error: 'Failed to rollback operation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
