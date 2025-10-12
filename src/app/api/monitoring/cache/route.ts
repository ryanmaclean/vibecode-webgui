/**
 * Cache Monitoring and Management API
 * Provides cache statistics, management operations, and health monitoring
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkMonitoringAuth, getUnauthorizedResponse } from '../../../../lib/monitoring/auth'
import { queryCache } from '../../../../lib/cache/query-cache'
import { vectorCacheAdapter } from '../../../../lib/cache/vector-cache-adapter'
import { logger } from '@/lib/logger';
// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Check authentication
  const authResult = await checkMonitoringAuth(request)
  if (!authResult.isAuthorized) {
    return getUnauthorizedResponse(authResult.error)
  }

  try {
    const { searchParams } = new URL(request.url)
    const operation = searchParams.get('operation')
    const tag = searchParams.get('tag')

    // Handle specific operations
    if (operation === 'stats') {
      const stats = vectorCacheAdapter.getCacheStats()
      return NextResponse.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      })
    }

    if (operation === 'metrics') {
      const metrics = vectorCacheAdapter.getMetrics()
      return NextResponse.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      })
    }

    if (operation === 'entries' && tag) {
      const entries = queryCache.getByTag(tag)
      return NextResponse.json({
        success: true,
        data: {
          tag,
          count: entries.length,
          entries: entries.map(entry => ({
            key: entry.key,
            size: entry.size,
            accessCount: entry.accessCount,
            lastAccessed: entry.lastAccessed,
            metadata: entry.metadata
          }))
        },
        timestamp: new Date().toISOString()
      })
    }

    // Default: Return comprehensive cache overview
    const metrics = vectorCacheAdapter.getMetrics()
    const stats = vectorCacheAdapter.getCacheStats()
    
    const cacheOverview = {
      health: {
        status: getCacheHealthStatus(metrics),
        hitRate: metrics.hitRate,
        missRate: metrics.missRate,
        utilizationPercent: (metrics.totalSize / stats.config.maxSize) * 100,
        entryUtilizationPercent: (metrics.totalEntries / stats.config.maxEntries) * 100
      },
      performance: {
        totalHits: metrics.totalHits,
        totalMisses: metrics.totalMisses,
        averageAccessTime: metrics.averageAccessTime,
        hitRatePercent: Math.round(metrics.hitRate * 100),
        missRatePercent: Math.round(metrics.missRate * 100)
      },
      storage: {
        totalEntries: metrics.totalEntries,
        totalSize: metrics.totalSize,
        maxEntries: stats.config.maxEntries,
        maxSize: stats.config.maxSize,
        memoryUsage: metrics.memoryUsage,
        storageEfficiency: Math.round((metrics.totalSize / (metrics.totalSize + metrics.memoryUsage)) * 100)
      },
      maintenance: {
        evictionCount: metrics.evictionCount,
        expiredCount: metrics.expiredCount,
        cleanupEnabled: true,
        compressionEnabled: stats.config.enableCompression
      },
      analytics: {
        topKeys: stats.topKeys,
        sizeDistribution: stats.sizeDistribution,
        typeDistribution: stats.typeDistribution,
        oldestEntry: stats.oldestEntry
      },
      config: stats.config,
      recommendations: generateCacheRecommendations(metrics, stats)
    }

    return NextResponse.json({
      success: true,
      data: cacheOverview,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Cache monitoring error:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to fetch cache data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Check authentication
  const authResult = await checkMonitoringAuth(request)
  if (!authResult.isAuthorized) {
    return getUnauthorizedResponse(authResult.error)
  }

  try {
    const body = await request.json()
    const { operation, tag, key, data } = body

    let result: any = {}

    switch (operation) {
      case 'clear':
        queryCache.clear()
        result = { message: 'Cache cleared successfully' }
        break

      case 'invalidate_tag':
        if (!tag) {
          return NextResponse.json(
            { error: 'Tag is required for invalidate_tag operation' },
            { status: 400 }
          )
        }
        const deletedCount = await vectorCacheAdapter.invalidateByTag(tag)
        result = { message: `Invalidated ${deletedCount} entries with tag: ${tag}` }
        break

      case 'invalidate_key':
        if (!key) {
          return NextResponse.json(
            { error: 'Key is required for invalidate_key operation' },
            { status: 400 }
          )
        }
        const deleted = await vectorCacheAdapter.invalidate(key)
        result = { 
          message: deleted ? `Key '${key}' invalidated` : `Key '${key}' not found`,
          deleted
        }
        break

      case 'warm_up':
        if (!data || !Array.isArray(data)) {
          return NextResponse.json(
            { error: 'Data array is required for warm_up operation' },
            { status: 400 }
          )
        }
        await vectorCacheAdapter.warmUpCommonQueries(data)
        result = { message: `Warmed up cache with ${data.length} entries` }
        break

      case 'set':
        if (!key || data === undefined) {
          return NextResponse.json(
            { error: 'Key and data are required for set operation' },
            { status: 400 }
          )
        }
        await queryCache.set(key, data, body.options)
        result = { message: `Set cache entry for key: ${key}` }
        break

      default:
        return NextResponse.json(
          { error: `Unknown operation: ${operation}` },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      operation,
      result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Cache operation error:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to execute cache operation',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

/**
 * Determine cache health status based on metrics
 */
function getCacheHealthStatus(metrics: any): 'healthy' | 'warning' | 'critical' {
  // Check hit rate
  if (metrics.hitRate < 0.3) return 'critical' // Less than 30% hit rate
  if (metrics.hitRate < 0.6) return 'warning'  // Less than 60% hit rate
  
  // Check average access time
  if (metrics.averageAccessTime > 100) return 'warning' // Over 100ms average
  if (metrics.averageAccessTime > 500) return 'critical' // Over 500ms average
  
  return 'healthy'
}

/**
 * Generate cache optimization recommendations
 */
function generateCacheRecommendations(metrics: any, stats: any) {
  const recommendations: Array<{
    type: 'performance' | 'storage' | 'configuration'
    priority: 'high' | 'medium' | 'low'
    message: string
    action: string
  }> = []

  // Hit rate recommendations
  if (metrics.hitRate < 0.5) {
    recommendations.push({
      type: 'performance',
      priority: 'high',
      message: `Cache hit rate is low: ${Math.round(metrics.hitRate * 100)}%`,
      action: 'Consider increasing TTL values or improving cache key strategies'
    })
  }

  // Storage utilization recommendations
  const storageUtilization = (metrics.totalSize / stats.config.maxSize) * 100
  if (storageUtilization > 80) {
    recommendations.push({
      type: 'storage',
      priority: 'high',
      message: `Cache storage ${Math.round(storageUtilization)}% full`,
      action: 'Consider increasing maxSize or enabling compression'
    })
  }

  // Entry utilization recommendations
  const entryUtilization = (metrics.totalEntries / stats.config.maxEntries) * 100
  if (entryUtilization > 80) {
    recommendations.push({
      type: 'storage',
      priority: 'medium',
      message: `Cache entries ${Math.round(entryUtilization)}% full`,
      action: 'Consider increasing maxEntries or reducing TTL values'
    })
  }

  // Performance recommendations
  if (metrics.averageAccessTime > 50) {
    recommendations.push({
      type: 'performance',
      priority: 'medium',
      message: `Average access time is high: ${metrics.averageAccessTime.toFixed(1)}ms`,
      action: 'Consider enabling compression or optimizing data structures'
    })
  }

  // Configuration recommendations
  if (!stats.config.enableCompression && stats.sizeDistribution.large > stats.sizeDistribution.small) {
    recommendations.push({
      type: 'configuration',
      priority: 'low',
      message: 'Large entries detected but compression is disabled',
      action: 'Consider enabling compression to save memory'
    })
  }

  // Eviction recommendations
  if (metrics.evictionCount > metrics.totalHits * 0.1) {
    recommendations.push({
      type: 'configuration',
      priority: 'medium',
      message: 'High eviction rate detected',
      action: 'Consider increasing cache size or adjusting TTL values'
    })
  }

  return recommendations
}