import { NextRequest, NextResponse } from 'next/server'
import { enhancedVectorStore } from '@/lib/vector-stores/enhanced-vector-store'

export async function GET(request: NextRequest) {
  try {
    const stats = await enhancedVectorStore.healthCheck()
    
    return NextResponse.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      vectorStore: stats,
      performance: {
        totalProviders: stats.providers.length,
        availableProviders: stats.providers.filter(p => p.available).length,
        totalDocuments: stats.totalDocuments,
        avgQueryTime: stats.performance.avgQueryTime,
        queriesPerSecond: stats.performance.queriesPerSecond,
        errorRate: stats.performance.errorRate
      }
    })
  } catch (error) {
    console.error('Vector metrics error:', error)
    return NextResponse.json(
      { 
        status: 'error', 
        error: 'Failed to collect vector metrics',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}