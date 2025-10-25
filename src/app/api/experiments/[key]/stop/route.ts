/**
 * Stop Experiment API Endpoint
 *
 * POST /api/experiments/[key]/stop
 * Stops a running experiment
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

    if (experiment.status !== 'running' && experiment.status !== 'paused') {
      return NextResponse.json(
        { error: 'Only running or paused experiments can be stopped' },
        { status: 400 }
      )
    }

    // In production, this would update the experiment status in database
    // and set ended_at timestamp

    appLogger.logBusiness('experiment_stopped', {
      userId: session.user.id,
      feature: 'experimentation',
      metadata: {
        experimentKey,
        totalUsers: experiment.results?.totalUsers || 0
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Experiment stopped successfully',
      ended_at: new Date().toISOString()
    })
  } catch (error) {
    appLogger.logSecurity('experiment_stop_api_error', {
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
