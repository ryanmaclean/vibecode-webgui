/**
 * Guardrails API Routes
 *
 * REST API for managing and evaluating experiment guardrails.
 */

import { NextRequest, NextResponse } from 'next/server'
import { evaluateGuardrails } from '@/lib/experiments/guardrails'
import type { Guardrail } from '@/lib/experiments/guardrails'
import { logger } from '@/lib/server-monitoring'

/**
 * GET /api/experiments/[key]/guardrails
 *
 * Evaluate all guardrails for an experiment and return current status.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const { key: experimentKey } = params

    // TODO: Fetch guardrail configuration from database
    // For now, return mock data
    const guardrails: Guardrail[] = [
      {
        metricName: 'error_rate',
        operator: '<',
        threshold: 0.01,
        severity: 'critical',
        description: 'Error rate must stay below 1%'
      },
      {
        metricName: 'latency_p95',
        operator: '<',
        threshold: 5000,
        severity: 'warning',
        description: 'P95 latency must stay below 5000ms'
      }
    ]

    const result = await evaluateGuardrails(experimentKey, guardrails)

    return NextResponse.json(result)

  } catch (error) {
    logger.error('Failed to evaluate guardrails', {
      error: (error as Error).message
    })

    return NextResponse.json(
      { error: 'Failed to evaluate guardrails' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/experiments/[key]/guardrails
 *
 * Update guardrail configuration for an experiment.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const { key: experimentKey } = params
    const body = await request.json()
    const guardrails: Guardrail[] = body.guardrails

    if (!Array.isArray(guardrails)) {
      return NextResponse.json(
        { error: 'Invalid guardrails format' },
        { status: 400 }
      )
    }

    // Validate guardrails
    for (const guardrail of guardrails) {
      if (!guardrail.metricName || !guardrail.operator || guardrail.threshold === undefined) {
        return NextResponse.json(
          { error: 'Invalid guardrail configuration' },
          { status: 400 }
        )
      }

      if (!['>', '<', '>=', '<='].includes(guardrail.operator)) {
        return NextResponse.json(
          { error: 'Invalid operator' },
          { status: 400 }
        )
      }

      if (!['warning', 'critical'].includes(guardrail.severity)) {
        return NextResponse.json(
          { error: 'Invalid severity' },
          { status: 400 }
        )
      }
    }

    // TODO: Store guardrails in database
    // await prisma.experiment.update({
    //   where: { key: experimentKey },
    //   data: { guardrails: JSON.stringify(guardrails) }
    // })

    logger.info('Guardrails updated', {
      experimentKey,
      guardrailCount: guardrails.length
    })

    return NextResponse.json({
      success: true,
      guardrails
    })

  } catch (error) {
    logger.error('Failed to update guardrails', {
      error: (error as Error).message
    })

    return NextResponse.json(
      { error: 'Failed to update guardrails' },
      { status: 500 }
    )
  }
}
