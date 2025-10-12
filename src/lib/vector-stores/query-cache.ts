/**
 * Query Result Cache for Enhanced Vector Store
 * Caches search results to reduce provider switching overhead
 */

import { logger } from '@/lib/logger';

interface CachedResult {
  results: any[]
  timestamp: number
  provider: 'pgvector' | 'weaviate'
  queryHash: string
}

export class VectorQueryCache {
  private cache: Map<string, CachedResult> = new Map()
  private maxCacheSize: number = 1000
  private cacheExpiryMs: number = 300000 // 5 minutes
  private hitCount: number = 0
  private missCount: number = 0
  private accessFrequency: Map<string, number> = new Map()
  private lastCleanup: number = Date.now()

  /**
   * Generate cache key from query options
   */
  private generateCacheKey(query: string, options: any): string {
    const key = `${query}:${JSON.stringify(options)}`
    return Buffer.from(key).toString('base64').substring(0, 32)
  }

  /**
   * Get cached results if available and not expired
   */
  getCachedResults(query: string, options: any): any[] | null {
    const key = this.generateCacheKey(query, options)
    const cached = this.cache.get(key)
    
    if (!cached) {
      this.missCount++
      return null
    }
    
    const isExpired = Date.now() - cached.timestamp > this.cacheExpiryMs
    if (isExpired) {
      this.cache.delete(key)
      this.accessFrequency.delete(key)
      this.missCount++
      return null
    }
    
    // Track access frequency for intelligent eviction
    this.accessFrequency.set(key, (this.accessFrequency.get(key) || 0) + 1)
    this.hitCount++
    
    logger.info(`Cache hit for query: ${query.substring(0, 50)}...`)
    return cached.results
  }

  /**
   * Cache search results with intelligent eviction
   */
  cacheResults(query: string, options: any, results: any[], provider: 'pgvector' | 'weaviate'): void {
    const key = this.generateCacheKey(query, options)
    
    // Trigger automatic cleanup if needed
    this.performMaintenanceIfNeeded()
    
    // Intelligent eviction if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      this.evictLeastFrequentlyUsed()
    }
    
    this.cache.set(key, {
      results,
      timestamp: Date.now(),
      provider,
      queryHash: key
    })
    
    // Initialize access frequency
    this.accessFrequency.set(key, 1)
    
    logger.info(`Cached ${results.length} results for query: ${query.substring(0, 50)}...`)
  }

  /**
   * Evict least frequently used entries
   */
  private evictLeastFrequentlyUsed(): void {
    if (this.cache.size === 0) return
    
    let leastUsedKey = ''
    let minFrequency = Infinity
    
    for (const [key, frequency] of this.accessFrequency.entries()) {
      if (frequency < minFrequency) {
        minFrequency = frequency
        leastUsedKey = key
      }
    }
    
    if (leastUsedKey) {
      this.cache.delete(leastUsedKey)
      this.accessFrequency.delete(leastUsedKey)
    }
  }

  /**
   * Perform periodic maintenance
   */
  private performMaintenanceIfNeeded(): void {
    const now = Date.now()
    const maintenanceInterval = 60000 // 1 minute
    
    if (now - this.lastCleanup > maintenanceInterval) {
      this.cleanup()
      this.lastCleanup = now
    }
  }

  /**
   * Clear expired entries
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.cacheExpiryMs) {
        this.cache.delete(key)
        this.accessFrequency.delete(key)
      }
    }
  }

  /**
   * Get enhanced cache statistics
   */
  getStats(): {
    size: number
    maxSize: number
    hitRate: number
    totalHits: number
    totalMisses: number
    efficiency: string
  } {
    const totalRequests = this.hitCount + this.missCount
    const actualHitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0
    
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hitRate: Math.round(actualHitRate * 100) / 100,
      totalHits: this.hitCount,
      totalMisses: this.missCount,
      efficiency: actualHitRate > 0.8 ? 'excellent' : actualHitRate > 0.6 ? 'good' : actualHitRate > 0.4 ? 'fair' : 'poor'
    }
  }

  /**
   * Get detailed cache analysis
   */
  getAnalytics(): {
    mostFrequentQueries: Array<{ key: string, frequency: number }>
    cacheUtilization: number
    avgAccessFrequency: number
  } {
    const frequencyEntries = Array.from(this.accessFrequency.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([key, frequency]) => ({ key: key.substring(0, 8), frequency }))
    
    const totalAccesses = Array.from(this.accessFrequency.values()).reduce((sum, freq) => sum + freq, 0)
    const avgAccessFrequency = this.accessFrequency.size > 0 ? totalAccesses / this.accessFrequency.size : 0
    
    return {
      mostFrequentQueries: frequencyEntries,
      cacheUtilization: (this.cache.size / this.maxCacheSize) * 100,
      avgAccessFrequency: Math.round(avgAccessFrequency * 100) / 100
    }
  }

  /**
   * Clear all cached results
   */
  clear(): void {
    this.cache.clear()
  }
}

export const vectorQueryCache = new VectorQueryCache()