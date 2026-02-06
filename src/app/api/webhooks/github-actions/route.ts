import { NextRequest, NextResponse } from 'next/server'
import {
  createProblemResponse,
  createSuccessResponse,
  generateTraceId,
} from '@/lib/api-utils'
import { logger } from '@/lib/logger'
import { createGastownClientFromEnv } from '@/lib/gastown/client'
import type { WorkflowRunEventPayload } from '@/lib/webhooks/github-actions'
import {
  evaluateWorkflowRunFailure,
  verifyGitHubSignature,
} from '@/lib/webhooks/github-actions'
import { createAPIRateLimit } from '@/lib/rate-limiting'
import { incrementGastownMetric } from '@/lib/monitoring/gastown-metrics'

const apiRateLimit = createAPIRateLimit(100) // 100 requests per minute - webhooks can be bursty

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
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

  const traceId = generateTraceId()
  const eventName = request.headers.get('x-github-event')
  const deliveryId = request.headers.get('x-github-delivery')
  const signatureHeader = request.headers.get('x-hub-signature-256')

  const secret = process.env.GITHUB_WEBHOOK_SECRET
  if (!secret) {
    logger.error('GitHub webhook secret is not configured', { traceId })
    return createProblemResponse({
      title: 'Service Unavailable',
      status: 503,
      detail: 'GITHUB_WEBHOOK_SECRET must be set to verify GitHub webhooks',
      code: 'MISSING_GITHUB_SECRET',
      traceId,
    })
  }

  const rawBody = await request.text()

  if (!verifyGitHubSignature(rawBody, signatureHeader, secret)) {
    logger.warn('GitHub webhook signature verification failed', {
      traceId,
      deliveryId,
    })
    return createProblemResponse({
      title: 'Invalid signature',
      status: 401,
      detail: 'GitHub webhook signature verification failed',
      code: 'INVALID_SIGNATURE',
      traceId,
    })
  }

  let payload: WorkflowRunEventPayload
  try {
    payload = JSON.parse(rawBody)
  } catch (error) {
    logger.warn('GitHub webhook payload is not valid JSON', {
      traceId,
      deliveryId,
      error: error instanceof Error ? error.message : String(error),
    })
    return createProblemResponse({
      title: 'Invalid payload',
      status: 400,
      detail: 'GitHub webhook payload must be valid JSON',
      code: 'INVALID_PAYLOAD',
      traceId,
    })
  }

  if (eventName !== 'workflow_run') {
    logger.info('Ignoring unsupported GitHub event', {
      traceId,
      deliveryId,
      eventName,
    })
    return createSuccessResponse(
      {
        ignored: true,
        reason: `Event ${eventName || 'unknown'} is not handled`,
        traceId,
      },
      { status: 202, traceId }
    )
  }

  const evaluation = evaluateWorkflowRunFailure(payload)
  if (!evaluation.shouldProcess || !evaluation.payload) {
    logger.info('GitHub workflow_run event ignored', {
      traceId,
      deliveryId,
      reason: evaluation.reason,
    })
    return createSuccessResponse(
      {
        ignored: true,
        reason: evaluation.reason || 'workflow run not eligible',
        traceId,
      },
      { status: 202, traceId }
    )
  }

  const gastownEndpoint = process.env.GASTOWN_WEBHOOK_URL || process.env.GASTOWN_WEBHOOK
  if (!gastownEndpoint) {
    logger.error('Gastown webhook endpoint is not configured', { traceId })
    return createProblemResponse({
      title: 'Service Unavailable',
      status: 503,
      detail: 'Set GASTOWN_WEBHOOK_URL (or GASTOWN_WEBHOOK) to enable CI failure notifications',
      code: 'MISSING_GASTOWN_ENDPOINT',
      traceId,
    })
  }

  try {
    const gastownClient = createGastownClientFromEnv()
    incrementGastownMetric('gastown.mayor.task.count', 1, {
      source: 'github_actions',
      event: 'workflow_run',
    })
    logger.info('role_activity', {
      event_type: 'role_activity',
      role: 'mayor',
      source: 'github_actions',
      action: 'task_assigned',
      trace_id: traceId,
      delivery_id: deliveryId,
    })
    const result = await gastownClient.reportWorkflowFailure(traceId, evaluation.payload, {
      deliveryId,
    })

    return createSuccessResponse(
      {
        processed: true,
        beadId: result.beadId,
        polecat: result.polecat,
        status: result.status,
        traceId,
      },
      { status: 200, traceId }
    )
  } catch (error) {
    logger.error('Failed to notify Gastown about workflow failure', {
      traceId,
      deliveryId,
      error: error instanceof Error ? error.message : String(error),
    })

    return createProblemResponse({
      title: 'Failed to dispatch CI failure',
      status: 502,
      detail: error instanceof Error ? error.message : 'Unable to reach Gastown webhook',
      code: 'GASTOWN_DISPATCH_FAILED',
      traceId,
    })
  }
}
