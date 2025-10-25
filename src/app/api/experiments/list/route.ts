/**
 * Experiments List API Endpoint
 *
 * GET /api/experiments/list
 * Returns all experiments with metadata and results
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { mockExperiments } from '@/lib/experiments/mock-data'
import { appLogger } from '@/lib/server-monitoring'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    let experiments = [...mockExperiments]

    // Filter by status
    if (status && status !== 'all') {
      experiments = experiments.filter(exp => exp.status === status)
    }

    // Filter by search query
    if (search) {
      const query = search.toLowerCase()
      experiments = experiments.filter(
        exp =>
          exp.name.toLowerCase().includes(query) ||
          exp.hypothesis.toLowerCase().includes(query) ||
          exp.key.toLowerCase().includes(query)
      )
    }

    appLogger.logBusiness('experiments_list_viewed', {
      userId: session.user.id,
      feature: 'experimentation',
      metadata: {
        count: experiments.length,
        status,
        hasSearch: !!search
      }
    })

    return NextResponse.json({
      success: true,
      experiments,
      total: mockExperiments.length,
      filtered: experiments.length
    })
  } catch (error) {
    appLogger.logSecurity('experiment_list_api_error', {
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
