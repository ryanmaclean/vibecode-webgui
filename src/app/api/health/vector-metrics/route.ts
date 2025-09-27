import { NextRequest, NextResponse } from 'next/server'
import { enhancedVectorStore } from '@/lib/vector-stores/enhanced-vector-store'
// import { prismaPoolOptimizer } from '@/lib/db/prisma-pool-optimizer'
import { vectorQueryCache } from '@/lib/vector-stores/query-cache'
import { vectorQueryCache as enhancedVectorQueryCache } from '@/lib/vector-stores/vector-query-cache'
import { getMetricsCollector } from '@/lib/db/database-metrics'
import { getVectorMetricsCollector } from '@/lib/metrics/VectorMetricsCollector'

export async function GET(_request: NextRequest) {
  try {
    // Use enhanced vector store and metrics
    const stats = await enhancedVectorStore.healthCheck()
    
    // const poolMetrics = await prismaPoolOptimizer.collectMetrics()
    const poolMetrics = {
      status: 'unavailable',
      activeConnections: 0,
      connectionUtilization: 0,
      avgQueryTime: 0,
      pendingRequests: 0
    }
    
    // Get metrics from both old and new systems
    const legacyCacheStats = vectorQueryCache.getStats()
    const legacyCacheAnalytics = vectorQueryCache.getAnalytics()
    const enhancedCacheStats = enhancedVectorStore.getVectorCacheStats()
    const enhancedCacheAnalytics = enhancedVectorStore.getVectorCacheAnalytics()
    
    // Database metrics (existing system)
    const dbMetrics = getMetricsCollector()
    const dbVectorMetrics = dbMetrics.getVectorMetrics()
    
    // Enhanced vector metrics (new system)
    const enhancedVectorMetrics = enhancedVectorStore.getVectorMetrics()
    const enhancedProviderInsights = enhancedVectorStore.getEnhancedProviderSelectionInsights()
    
    // Legacy provider insights for backward compatibility
    const legacyProviderInsights = enhancedVectorStore.getProviderSelectionInsights()
    
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
      // Legacy cache metrics (backward compatibility)
      queryCache: {
        size: legacyCacheStats.size,
        maxSize: legacyCacheStats.maxSize,
        hitRate: `${(legacyCacheStats.hitRate * 100).toFixed(1)}%`,
        totalHits: legacyCacheStats.totalHits,
        totalMisses: legacyCacheStats.totalMisses,
        efficiency: legacyCacheStats.efficiency,
        utilization: `${legacyCacheAnalytics.cacheUtilization.toFixed(1)}%`,
        avgAccessFrequency: legacyCacheAnalytics.avgAccessFrequency,
        topQueries: legacyCacheAnalytics.mostFrequentQueries.slice(0, 5)
      },
      // Enhanced cache metrics (new system)
      enhancedCache: {
        size: enhancedCacheStats.size,
        maxSize: enhancedCacheStats.maxSize,
        hitRate: `${(enhancedCacheStats.hitRate * 100).toFixed(1)}%`,
        totalHits: enhancedCacheStats.totalHits,
        totalMisses: enhancedCacheStats.totalMisses,
        efficiency: enhancedCacheStats.efficiency,
        memoryUsage: `${(enhancedCacheStats.memoryUsage / 1024 / 1024).toFixed(1)}MB`,
        utilization: `${enhancedCacheAnalytics.cacheUtilization.toFixed(1)}%`,
        avgAccessFrequency: enhancedCacheAnalytics.avgAccessFrequency,
        evictionRate: `${enhancedCacheAnalytics.evictionRate.toFixed(1)}%`,
        topQueries: enhancedCacheAnalytics.mostFrequentQueries.slice(0, 5),
        providerDistribution: {
          pgvector: enhancedCacheAnalytics.providerDistribution.get('pgvector') || 0,
          weaviate: enhancedCacheAnalytics.providerDistribution.get('weaviate') || 0
        }
      },
      // Legacy vector operations (backward compatibility)
      vectorOperations: {
        totalSearches: dbVectorMetrics.totalSearches,
        totalStores: dbVectorMetrics.totalStores,
        cacheEfficiency: `${dbVectorMetrics.cacheEfficiency.toFixed(1)}%`,
        providerSwitchRate: `${dbVectorMetrics.providerSwitchRate.toFixed(1)}%`,
        averageSearchTime: `${dbVectorMetrics.averageSearchTime}ms`,
        failedOperations: dbVectorMetrics.failedOperations,
        health: dbVectorMetrics.failedOperations < 5 ? 'healthy' : 'degraded'
      },
      // Enhanced vector metrics (new system)
      enhancedVectorMetrics: {
        totalSearches: enhancedVectorMetrics.totalSearches,
        totalEmbeddings: enhancedVectorMetrics.totalEmbeddings,
        avgSearchTime: `${enhancedVectorMetrics.avgSearchTime.toFixed(1)}ms`,
        p95SearchTime: `${enhancedVectorMetrics.p95SearchTime.toFixed(1)}ms`,
        p99SearchTime: `${enhancedVectorMetrics.p99SearchTime.toFixed(1)}ms`,
        cacheHitRate: `${enhancedVectorMetrics.cacheHitRate.toFixed(1)}%`,
        errorRate: `${enhancedVectorMetrics.errorRate.toFixed(1)}%`,
        providerSwitches: enhancedVectorMetrics.providerSwitches,
        providerPreference: enhancedVectorMetrics.providerPreference,
        totalErrors: enhancedVectorMetrics.totalErrors,
        searchTimesByProvider: {
          pgvector: `${enhancedVectorMetrics.searchTimesByProvider.get('pgvector')?.slice(-1)[0] || 0}ms`,
          weaviate: `${enhancedVectorMetrics.searchTimesByProvider.get('weaviate')?.slice(-1)[0] || 0}ms`
        }
      },
      // Legacy provider selection (backward compatibility)
      providerSelection: {
        recommendation: legacyProviderInsights.recommendation,
        pgvector: {
          performanceScore: legacyProviderInsights.pgvector.score,
          avgResponseTime: `${legacyProviderInsights.pgvector.avgTime}ms`,
          errorRate: `${legacyProviderInsights.pgvector.errorRate}%`,
          status: legacyProviderInsights.pgvector.score > 0.7 ? 'excellent' : legacyProviderInsights.pgvector.score > 0.5 ? 'good' : 'needs_attention'
        },
        weaviate: {
          performanceScore: legacyProviderInsights.weaviate.score,
          avgResponseTime: `${legacyProviderInsights.weaviate.avgTime}ms`,
          errorRate: `${legacyProviderInsights.weaviate.errorRate}%`,
          status: legacyProviderInsights.weaviate.score > 0.7 ? 'excellent' : legacyProviderInsights.weaviate.score > 0.5 ? 'good' : 'needs_attention'
        }
      },
      // Enhanced provider insights (new system)
      enhancedProviderInsights: {
        recommendation: enhancedProviderInsights.recommendation,
        status: enhancedProviderInsights.status,
        pgvector: {
          score: enhancedProviderInsights.pgvector.score.toFixed(3),
          avgTime: `${enhancedProviderInsights.pgvector.avgTime.toFixed(1)}ms`,
          errorRate: `${enhancedProviderInsights.pgvector.errorRate.toFixed(1)}%`,
          successfulQueries: enhancedProviderInsights.pgvector.successfulQueries,
          totalQueries: enhancedProviderInsights.pgvector.totalQueries,
          reliability: enhancedProviderInsights.pgvector.errorRate < 5 ? 'excellent' : enhancedProviderInsights.pgvector.errorRate < 10 ? 'good' : 'needs_attention'
        },
        weaviate: {
          score: enhancedProviderInsights.weaviate.score.toFixed(3),
          avgTime: `${enhancedProviderInsights.weaviate.avgTime.toFixed(1)}ms`,
          errorRate: `${enhancedProviderInsights.weaviate.errorRate.toFixed(1)}%`,
          successfulQueries: enhancedProviderInsights.weaviate.successfulQueries,
          totalQueries: enhancedProviderInsights.weaviate.totalQueries,
          reliability: enhancedProviderInsights.weaviate.errorRate < 5 ? 'excellent' : enhancedProviderInsights.weaviate.errorRate < 10 ? 'good' : 'needs_attention'
        }
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