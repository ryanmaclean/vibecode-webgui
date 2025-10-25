/**
 * Experiment Detail API Endpoint
 *
 * GET /api/experiments/[key]
 * Returns detailed experiment data including results and metrics
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getExperimentByKey } from '@/lib/experiments/mock-data'
import { appLogger } from '@/lib/server-monitoring'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const experimentKey = params.key
    const experiment = getExperimentByKey(experimentKey)

    if (!experiment) {
      return NextResponse.json(
        { error: 'Experiment not found' },
        { status: 404 }
      )
    }

    appLogger.logBusiness('experiment_detail_viewed', {
      userId: session.user.id,
      feature: 'experimentation',
      metadata: {
        experimentKey,
        status: experiment.status
      }
    })

    return NextResponse.json({
      success: true,
      experiment
    })
  } catch (error) {
    appLogger.logSecurity('experiment_detail_api_error', {
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

/**
 * PUT /api/experiments/[key]
 * Update experiment configuration
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const experimentKey = params.key
    const body = await request.json()

    // In production, this would update the database
    // For now, just validate the input and return success

    appLogger.logBusiness('experiment_updated', {
      userId: session.user.id,
      feature: 'experimentation',
      metadata: {
        experimentKey,
        updates: Object.keys(body)
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Experiment updated successfully'
    })
  } catch (error) {
    appLogger.logSecurity('experiment_update_api_error', {
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

/**
 * DELETE /api/experiments/[key]
 * Delete or archive experiment
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const experimentKey = params.key

    // In production, this would delete from database
    // For now, just log and return success

    appLogger.logBusiness('experiment_deleted', {
      userId: session.user.id,
      feature: 'experimentation',
      metadata: {
        experimentKey
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Experiment deleted successfully'
    })
  } catch (error) {
    appLogger.logSecurity('experiment_delete_api_error', {
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
