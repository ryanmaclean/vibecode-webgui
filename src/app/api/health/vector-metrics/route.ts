import { NextRequest, NextResponse } from 'next/server'
import { enhancedVectorStore } from '@/lib/vector-stores/enhanced-vector-store'
import { prismaPoolOptimizer } from '@/lib/db/prisma-pool-optimizer'
import { vectorQueryCache } from '@/lib/vector-stores/query-cache'

export async function GET(request: NextRequest) {
  try {
    const stats = await enhancedVectorStore.healthCheck()
    const poolMetrics = await prismaPoolOptimizer.collectMetrics()
    const cacheStats = vectorQueryCache.getStats()
    
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
      },
      connectionPool: {
        activeConnections: poolMetrics.activeConnections,
        utilization: poolMetrics.connectionUtilization,
        avgQueryTime: poolMetrics.avgQueryTime,
        pendingRequests: poolMetrics.pendingRequests,
        efficiency: poolMetrics.connectionUtilization < 0.8 ? 'optimal' : 'high_load'
      },
      queryCache: {
        size: cacheStats.size,
        maxSize: cacheStats.maxSize,
        hitRate: cacheStats.hitRate,
        efficiency: cacheStats.hitRate > 0.7 ? 'excellent' : 'needs_warming'
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