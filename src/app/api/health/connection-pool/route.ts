import { NextRequest, NextResponse } from 'next/server'
import { prismaPoolOptimizer } from '@/lib/db/prisma-pool-optimizer'

export async function GET(request: NextRequest) {
  try {
    // Collect current metrics
    const currentMetrics = await prismaPoolOptimizer.collectMetrics()
    const poolStats = prismaPoolOptimizer.getPoolStats()
    const currentConfig = prismaPoolOptimizer.getCurrentConfig()
    const analysis = prismaPoolOptimizer.analyzeAndOptimize()

    return NextResponse.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      connectionPool: {
        current: currentMetrics,
        configuration: currentConfig,
        statistics: poolStats,
        optimization: {
          recommendation: analysis.recommendation,
          suggestedChanges: analysis.suggestedConfig,
          reasoning: analysis.reasoning
        },
        performance: {
          utilizationRate: currentMetrics.connectionUtilization,
          avgQueryTime: currentMetrics.avgQueryTime,
          pendingRequests: currentMetrics.pendingRequests,
          efficiency: currentMetrics.connectionUtilization < 0.8 ? 'good' : 'needs_optimization'
        }
      }
    })
  } catch (error) {
    console.error('Connection pool metrics error:', error)
    return NextResponse.json(
      { 
        status: 'error', 
        error: 'Failed to collect connection pool metrics',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, config } = body

    if (action === 'optimize') {
      const analysis = prismaPoolOptimizer.analyzeAndOptimize()
      if (analysis.recommendation === 'optimize') {
        prismaPoolOptimizer.applyConfig(analysis.suggestedConfig)
        
        return NextResponse.json({
          status: 'success',
          message: 'Connection pool optimized',
          appliedConfig: analysis.suggestedConfig,
          reasoning: analysis.reasoning
        })
      } else {
        return NextResponse.json({
          status: 'no_change',
          message: 'No optimization needed',
          recommendation: analysis.recommendation
        })
      }
    }

    if (action === 'configure' && config) {
      prismaPoolOptimizer.applyConfig(config)
      
      return NextResponse.json({
        status: 'success',
        message: 'Configuration applied',
        newConfig: prismaPoolOptimizer.getCurrentConfig()
      })
    }

    if (action === 'reset') {
      prismaPoolOptimizer.reset()
      
      return NextResponse.json({
        status: 'success',
        message: 'Pool optimizer reset to defaults'
      })
    }

    return NextResponse.json(
      { status: 'error', error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Connection pool configuration error:', error)
    return NextResponse.json(
      { 
        status: 'error', 
        error: 'Failed to configure connection pool',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}