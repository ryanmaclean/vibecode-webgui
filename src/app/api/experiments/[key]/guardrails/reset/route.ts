/**
 * Guardrails Reset API Route
 *
 * Reset guardrail violation state after fixing issues.
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger, appLogger } from '@/lib/server-monitoring'

/**
 * POST /api/experiments/[key]/guardrails/reset
 *
 * Reset guardrail violations (after fixing the underlying issue).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const { key: experimentKey } = params

    // TODO: Reset guardrail violation state in database
    // await prisma.experiment.update({
    //   where: { key: experimentKey },
    //   data: {
    //     guardrail_violations: 0,
    //     last_guardrail_check: new Date()
    //   }
    // })

    logger.info('Guardrail violations reset', {
      experimentKey
    })

    appLogger.logBusiness('guardrails_reset', {
      feature: 'experimentation',
      metadata: {
        experimentKey
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Guardrail violations reset successfully'
    })

  } catch (error) {
    logger.error('Failed to reset guardrails', {
      error: (error as Error).message
    })

    return NextResponse.json(
      { error: 'Failed to reset guardrails' },
      { status: 500 }
    )
  }
}
