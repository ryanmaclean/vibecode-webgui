/**
 * Guardrails Check API Route
 *
 * Manually trigger a guardrail check for an experiment.
 */

import { NextRequest, NextResponse } from 'next/server'
import { evaluateGuardrails } from '@/lib/experiments/guardrails'
import { trackGuardrailViolation, trackGuardrailSuccess } from '@/lib/experiments/alerts'
import type { Guardrail } from '@/lib/experiments/guardrails'
import { logger } from '@/lib/server-monitoring'

/**
 * POST /api/experiments/[key]/guardrails/check
 *
 * Manually trigger a guardrail evaluation.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const { key: experimentKey } = params

    // TODO: Fetch guardrails from database
    // const experiment = await prisma.experiment.findUnique({
    //   where: { key: experimentKey }
    // })
    //
    // if (!experiment) {
    //   return NextResponse.json(
    //     { error: 'Experiment not found' },
    //     { status: 404 }
    //   )
    // }
    //
    // const guardrails = JSON.parse(experiment.guardrails || '[]')

    // Mock guardrails for now
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

    // Evaluate guardrails
    const result = await evaluateGuardrails(experimentKey, guardrails)

    // Track results in Datadog
    if (result.passed) {
      trackGuardrailSuccess(experimentKey, guardrails.length)
    } else {
      // Track each violation
      for (const violation of [...result.violations, ...result.warnings]) {
        trackGuardrailViolation(experimentKey, violation)
      }
    }

    logger.info('Guardrails checked', {
      experimentKey,
      passed: result.passed,
      violationCount: result.violations.length,
      warningCount: result.warnings.length
    })

    return NextResponse.json(result)

  } catch (error) {
    logger.error('Failed to check guardrails', {
      error: (error as Error).message
    })

    return NextResponse.json(
      { error: 'Failed to check guardrails' },
      { status: 500 }
    )
  }
}
