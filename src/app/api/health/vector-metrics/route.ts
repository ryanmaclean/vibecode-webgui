import { NextRequest, NextResponse } from 'next/server'
<<<<<<< HEAD
// import { enhancedVectorStore } from '@/lib/vector-stores/enhanced-vector-store'
// import { prismaPoolOptimizer } from '@/lib/db/prisma-pool-optimizer'
=======
import { enhancedVectorStore } from '@/lib/vector-stores/enhanced-vector-store'
import { prismaPoolOptimizer } from '@/lib/db/connection-pool'
>>>>>>> fix/consolidated-dependency-updates
import { vectorQueryCache } from '@/lib/vector-stores/query-cache'
import { getMetricsCollector } from '@/lib/db/database-metrics'
import { logger } from '../../../../lib/logger';


export async function GET(_request: NextRequest) {
  try {
    // const stats = await enhancedVectorStore.healthCheck()
    const stats = {
      status: 'unavailable',
      providers: [] as Array<{ id: string; available: boolean }>,
      totalDocuments: 0,
      performance: {
        avgQueryTime: 0,
        queriesPerSecond: 0,
        errorRate: '0%'
      }
    }
    // const poolMetrics = await prismaPoolOptimizer.collectMetrics()
    const poolMetrics = {
      status: 'unavailable',
      activeConnections: 0,
      connectionUtilization: 0,
      avgQueryTime: 0,
      pendingRequests: 0
    }
    const cacheStats = vectorQueryCache.getStats()
    const cacheAnalytics = vectorQueryCache.getAnalytics()
    const dbMetrics = getMetricsCollector()
    const vectorMetrics = dbMetrics.getVectorMetrics()
    // const providerInsights = enhancedVectorStore.getProviderSelectionInsights()
    const providerInsights = {
      status: 'unavailable',
      recommendation: 'none',
      pgvector: { score: 0, avgTime: 0, errorRate: 0 },
      weaviate: { score: 0, avgTime: 0, errorRate: 0 }
    }
    
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
        hitRate: `${(cacheStats.hitRate * 100).toFixed(1)}%`,
        totalHits: cacheStats.totalHits,
        totalMisses: cacheStats.totalMisses,
        efficiency: cacheStats.efficiency,
        utilization: `${cacheAnalytics.cacheUtilization.toFixed(1)}%`,
        avgAccessFrequency: cacheAnalytics.avgAccessFrequency,
        topQueries: cacheAnalytics.mostFrequentQueries.slice(0, 5)
      },
      vectorOperations: {
        totalSearches: vectorMetrics.totalSearches,
        totalStores: vectorMetrics.totalStores,
        cacheEfficiency: `${vectorMetrics.cacheEfficiency.toFixed(1)}%`,
        providerSwitchRate: `${vectorMetrics.providerSwitchRate.toFixed(1)}%`,
        averageSearchTime: `${vectorMetrics.averageSearchTime}ms`,
        failedOperations: vectorMetrics.failedOperations,
        health: vectorMetrics.failedOperations < 5 ? 'healthy' : 'degraded'
      },
      providerSelection: {
        recommendation: providerInsights.recommendation,
        pgvector: {
          performanceScore: providerInsights.pgvector.score,
          avgResponseTime: `${providerInsights.pgvector.avgTime}ms`,
          errorRate: `${providerInsights.pgvector.errorRate}%`,
          status: providerInsights.pgvector.score > 0.7 ? 'excellent' : providerInsights.pgvector.score > 0.5 ? 'good' : 'needs_attention'
        },
        weaviate: {
          performanceScore: providerInsights.weaviate.score,
          avgResponseTime: `${providerInsights.weaviate.avgTime}ms`,
          errorRate: `${providerInsights.weaviate.errorRate}%`,
          status: providerInsights.weaviate.score > 0.7 ? 'excellent' : providerInsights.weaviate.score > 0.5 ? 'good' : 'needs_attention'
        }
      }
    })
  } catch (error) {
    logger.error('Vector metrics error:', { error: error })
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