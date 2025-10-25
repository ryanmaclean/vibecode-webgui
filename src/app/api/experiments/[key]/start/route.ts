/**
 * Start Experiment API Endpoint
 *
 * POST /api/experiments/[key]/start
 * Starts a draft experiment
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getExperimentByKey } from '@/lib/experiments/mock-data'
import { appLogger } from '@/lib/server-monitoring'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const experimentKey = params.key
    const experiment = getExperimentByKey(experimentKey)

    if (!experiment) {
      return NextResponse.json(
        { error: 'Experiment not found' },
        { status: 404 }
      )
    }

    if (experiment.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft experiments can be started' },
        { status: 400 }
      )
    }

    // In production, this would update the experiment status in database
    // and set started_at timestamp

    appLogger.logBusiness('experiment_started', {
      userId: session.user.id,
      feature: 'experimentation',
      metadata: {
        experimentKey,
        variants: experiment.config.variants.length
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Experiment started successfully',
      started_at: new Date().toISOString()
    })
  } catch (error) {
    appLogger.logSecurity('experiment_start_api_error', {
      severity: 'medium',
      details: { error: (error as Error).message }
    })

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    )
  }
}
