/**
 * Vector Query Cache
 * Enhanced caching layer for vector search results with intelligent eviction and analytics
 * Provides TTL-based expiration, LFU eviction, and detailed hit/miss tracking
 */

import { vectorMetricsCollector } from '../metrics/VectorMetricsCollector';

export interface CachedVectorResult {
  results: any[];
  timestamp: number;
  provider: 'pgvector' | 'weaviate';
  queryHash: string;
  queryTime: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

export interface VectorCacheStats {
  size: number;
  maxSize: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  avgQueryTime: number;
  efficiency: 'excellent' | 'good' | 'fair' | 'poor';
  memoryUsage: number; // Estimated memory usage in bytes
}

export interface VectorCacheAnalytics {
  mostFrequentQueries: Array<{ 
    key: string; 
    frequency: number; 
    avgTime: number; 
    provider: string;
  }>;
  providerDistribution: Map<'pgvector' | 'weaviate', number>;
  cacheUtilization: number;
  avgAccessFrequency: number;
  evictionRate: number;
  hitRateByProvider: Map<'pgvector' | 'weaviate', number>;
}

export class VectorQueryCache {
  private cache: Map<string, CachedVectorResult> = new Map();
  private accessFrequency: Map<string, number> = new Map();
  private hitCount: number = 0;
  private missCount: number = 0;
  private evictionCount: number = 0;
  private lastCleanup: number = Date.now();
  
  private readonly maxCacheSize: number;
  private readonly defaultTtlMs: number;
  private readonly maxTtlMs: number;
  private readonly cleanupIntervalMs: number;
  private readonly maxMemoryUsage: number; // Max memory usage in bytes

  constructor(options?: {
    maxSize?: number;
    defaultTtlMs?: number;
    maxTtlMs?: number;
    cleanupIntervalMs?: number;
    maxMemoryUsage?: number;
  }) {
    this.maxCacheSize = options?.maxSize || 1000;
    this.defaultTtlMs = options?.defaultTtlMs || 300000; // 5 minutes
    this.maxTtlMs = options?.maxTtlMs || 1800000; // 30 minutes
    this.cleanupIntervalMs = options?.cleanupIntervalMs || 60000; // 1 minute
    this.maxMemoryUsage = options?.maxMemoryUsage || 50 * 1024 * 1024; // 50MB
  }

  /**
   * Generate cache key from query and options
   */
  private generateCacheKey(query: string, options: any): string {
    const keyData = {
      q: query.toLowerCase().trim(),
      opts: {
        workspaceId: options.workspaceId,
        fileIds: options.fileIds?.sort(),
        limit: options.limit,
        threshold: options.threshold,
        searchType: options.searchType,
        provider: options.provider
      }
    };
    
    const keyString = JSON.stringify(keyData);
    const hash = this.hashString(keyString);
    return `vec_${hash.substring(0, 16)}`;
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get cached results if available and not expired
   */
  getCachedResults(query: string, options: any): any[] | null {
    const key = this.generateCacheKey(query, options);
    const cached = this.cache.get(key);
    
    this.performMaintenanceIfNeeded();
    
    if (!cached) {
      this.missCount++;
      return null;
    }
    
    const now = Date.now();
    const isExpired = now - cached.timestamp > cached.ttl;
    
    if (isExpired) {
      this.cache.delete(key);
      this.accessFrequency.delete(key);
      this.missCount++;
      return null;
    }
    
    // Update access tracking
    cached.accessCount++;
    cached.lastAccessed = now;
    this.accessFrequency.set(key, (this.accessFrequency.get(key) || 0) + 1);
    this.hitCount++;
    
    // Record cache hit in metrics
    vectorMetricsCollector.recordVectorSearch(
      cached.provider,
      cached.queryTime,
      cached.results.length,
      true // cache hit
    );
    
    console.log(`Vector cache HIT for query: ${query.substring(0, 50)}... (${cached.provider})`);
    return cached.results;
  }

  /**
   * Cache search results with intelligent TTL and eviction
   */
  cacheResults(
    query: string, 
    options: any, 
    results: any[], 
    provider: 'pgvector' | 'weaviate',
    queryTime?: number
  ): void {
    if (results.length === 0) {
      // Don't cache empty results
      return;
    }

    const key = this.generateCacheKey(query, options);
    const now = Date.now();
    
    // Intelligent TTL based on query complexity and result size
    const ttl = this.calculateIntelligentTTL(query, results.length, provider);
    
    // Perform maintenance and eviction if needed
    this.performMaintenanceIfNeeded();
    this.evictIfNecessary();
    
    const cachedResult: CachedVectorResult = {
      results,
      timestamp: now,
      provider,
      queryHash: key,
      queryTime: queryTime || 0,
      ttl,
      accessCount: 1,
      lastAccessed: now
    };
    
    this.cache.set(key, cachedResult);
    this.accessFrequency.set(key, 1);
    
    console.log(`Vector cache STORE: ${results.length} results for query: ${query.substring(0, 50)}... (${provider}, TTL: ${ttl/1000}s)`);
  }

  /**
   * Calculate intelligent TTL based on query characteristics
   */
  private calculateIntelligentTTL(query: string, resultCount: number, provider: 'pgvector' | 'weaviate'): number {
    let ttl = this.defaultTtlMs;
    
    // Longer TTL for queries with more results (likely more stable)
    if (resultCount > 10) {
      ttl *= 1.5;
    } else if (resultCount > 50) {
      ttl *= 2;
    }
    
    // Shorter TTL for very specific queries (likely to change)
    if (query.length > 200) {
      ttl *= 0.7;
    }
    
    // Provider-specific adjustments
    if (provider === 'weaviate') {
      // Weaviate results might be more dynamic
      ttl *= 0.8;
    }
    
    return Math.min(ttl, this.maxTtlMs);
  }

  /**
   * Evict entries if cache is full or memory usage is high
   */
  private evictIfNecessary(): void {
    const memoryUsage = this.estimateMemoryUsage();
    
    if (this.cache.size >= this.maxCacheSize || memoryUsage > this.maxMemoryUsage) {
      const entriesToEvict = Math.max(1, Math.floor(this.cache.size * 0.1)); // Evict 10%
      this.evictLeastRecentlyUsed(entriesToEvict);
    }
  }

  /**
   * Evict least recently used entries
   */
  private evictLeastRecentlyUsed(count: number): void {
    const entries = Array.from(this.cache.entries())
      .sort(([,a], [,b]) => {
        // Sort by access frequency and recency
        const aScore = a.accessCount * 0.7 + (a.lastAccessed / 1000000) * 0.3;
        const bScore = b.accessCount * 0.7 + (b.lastAccessed / 1000000) * 0.3;
        return aScore - bScore;
      });
    
    for (let i = 0; i < count && i < entries.length; i++) {
      const [key] = entries[i];
      this.cache.delete(key);
      this.accessFrequency.delete(key);
      this.evictionCount++;
      
      // Record eviction in metrics
      vectorMetricsCollector.recordCacheEviction();
    }
  }

  /**
   * Estimate memory usage of cached data
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    
    for (const [key, cached] of this.cache.entries()) {
      // Estimate size of key
      totalSize += key.length * 2; // UTF-16 characters
      
      // Estimate size of cached result
      totalSize += JSON.stringify(cached).length * 2;
    }
    
    return totalSize;
  }

  /**
   * Perform periodic maintenance
   */
  private performMaintenanceIfNeeded(): void {
    const now = Date.now();
    
    if (now - this.lastCleanup > this.cleanupIntervalMs) {
      this.cleanup();
      this.lastCleanup = now;
    }
  }

  /**
   * Clear expired entries
   */
  cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.cache.delete(key);
        this.accessFrequency.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Vector cache cleanup: removed ${cleanedCount} expired entries`);
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): VectorCacheStats {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;
    
    // Calculate average query time from cached results
    let totalQueryTime = 0;
    let queryCount = 0;
    for (const cached of this.cache.values()) {
      if (cached.queryTime > 0) {
        totalQueryTime += cached.queryTime;
        queryCount++;
      }
    }
    const avgQueryTime = queryCount > 0 ? totalQueryTime / queryCount : 0;
    
    let efficiency: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
    if (hitRate > 0.8) efficiency = 'excellent';
    else if (hitRate > 0.6) efficiency = 'good';
    else if (hitRate > 0.4) efficiency = 'fair';
    
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hitRate: Math.round(hitRate * 1000) / 1000,
      totalHits: this.hitCount,
      totalMisses: this.missCount,
      avgQueryTime: Math.round(avgQueryTime),
      efficiency,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Get detailed cache analytics
   */
  getAnalytics(): VectorCacheAnalytics {
    const frequencyEntries = Array.from(this.accessFrequency.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    
    const mostFrequentQueries = frequencyEntries.map(([key, frequency]) => {
      const cached = this.cache.get(key);
      return {
        key: key.substring(0, 12),
        frequency,
        avgTime: cached?.queryTime || 0,
        provider: cached?.provider || 'unknown'
      };
    });
    
    // Provider distribution
    const providerDistribution = new Map<'pgvector' | 'weaviate', number>();
    const hitRateByProvider = new Map<'pgvector' | 'weaviate', number>();
    const hitsByProvider = new Map<'pgvector' | 'weaviate', number>();
    
    for (const cached of this.cache.values()) {
      const count = providerDistribution.get(cached.provider) || 0;
      providerDistribution.set(cached.provider, count + 1);
      
      const hits = hitsByProvider.get(cached.provider) || 0;
      hitsByProvider.set(cached.provider, hits + cached.accessCount - 1); // -1 because first access was a miss
    }
    
    // Calculate hit rates by provider
    for (const [provider, hits] of hitsByProvider.entries()) {
      const totalQueries = (providerDistribution.get(provider) || 0) + hits;
      const hitRate = totalQueries > 0 ? hits / totalQueries : 0;
      hitRateByProvider.set(provider, hitRate);
    }
    
    const totalAccesses = Array.from(this.accessFrequency.values()).reduce((sum, freq) => sum + freq, 0);
    const avgAccessFrequency = this.accessFrequency.size > 0 ? totalAccesses / this.accessFrequency.size : 0;
    
    const totalOperations = this.hitCount + this.missCount + this.evictionCount;
    const evictionRate = totalOperations > 0 ? (this.evictionCount / totalOperations) * 100 : 0;
    
    return {
      mostFrequentQueries,
      providerDistribution,
      cacheUtilization: (this.cache.size / this.maxCacheSize) * 100,
      avgAccessFrequency: Math.round(avgAccessFrequency * 100) / 100,
      evictionRate: Math.round(evictionRate * 100) / 100,
      hitRateByProvider
    };
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidateByPattern(pattern: string): number {
    let invalidatedCount = 0;
    const regex = new RegExp(pattern, 'i');
    
    for (const [key, cached] of this.cache.entries()) {
      if (regex.test(key) || cached.results.some(result => 
        typeof result.content === 'string' && regex.test(result.content)
      )) {
        this.cache.delete(key);
        this.accessFrequency.delete(key);
        invalidatedCount++;
      }
    }
    
    console.log(`Vector cache invalidation: removed ${invalidatedCount} entries matching pattern "${pattern}"`);
    return invalidatedCount;
  }

  /**
   * Invalidate cache entries for a specific workspace
   */
  invalidateWorkspace(workspaceId: number): number {
    let invalidatedCount = 0;
    
    for (const [key, cached] of this.cache.entries()) {
      if (cached.results.some(result => result.metadata?.workspaceId === workspaceId)) {
        this.cache.delete(key);
        this.accessFrequency.delete(key);
        invalidatedCount++;
      }
    }
    
    console.log(`Vector cache invalidation: removed ${invalidatedCount} entries for workspace ${workspaceId}`);
    return invalidatedCount;
  }

  /**
   * Warm up cache with common queries
   */
  warmUpCache(commonQueries: Array<{query: string, options: any}>): void {
    console.log(`Vector cache warm-up: preparing ${commonQueries.length} common queries`);
    // This would trigger searches for common queries to populate the cache
    // Implementation would depend on the vector store integration
  }

  /**
   * Clear all cached results
   */
  clear(): void {
    this.cache.clear();
    this.accessFrequency.clear();
    this.hitCount = 0;
    this.missCount = 0;
    this.evictionCount = 0;
    console.log('Vector cache cleared');
  }

  /**
   * Export cache statistics for monitoring
   */
  exportMetrics(): any {
    const stats = this.getStats();
    const analytics = this.getAnalytics();
    
    return {
      timestamp: new Date().toISOString(),
      stats,
      analytics,
      config: {
        maxSize: this.maxCacheSize,
        defaultTtlMs: this.defaultTtlMs,
        maxTtlMs: this.maxTtlMs,
        maxMemoryUsage: this.maxMemoryUsage
      }
    };
  }
}

// Export singleton instance for backward compatibility with existing code
export const vectorQueryCache = new VectorQueryCache();

// Export constructor for custom instances
export { VectorQueryCache as VectorQueryCacheClass };