/**
 * Base Vector Cache Adapter
 * Provides common functionality for all vector cache adapters
 */

import { IVectorCacheAdapter } from '../interfaces/vector-cache-adapter';
import { CacheStats, VectorSimilarityQuery, VectorSimilarityResults } from '../interfaces/vector-types';

export abstract class BaseVectorCacheAdapter implements IVectorCacheAdapter {
  protected enabled: boolean;
  protected connectionString?: string;
  protected ttl: {
    default: number;
    min: number;
    max: number;
  };
  protected options: Record<string, any>;
  protected stats: CacheStats = {
    hitCount: 0,
    missCount: 0,
    skipCount: 0,
    hitRate: 0
  };

  constructor(
    enabled: boolean = true,
    connectionString?: string,
    ttl: { default: number; min: number; max: number } = { default: 3600, min: 60, max: 86400 },
    options: Record<string, any> = {}
  ) {
    this.enabled = enabled;
    this.connectionString = connectionString;
    this.ttl = ttl;
    this.options = options;
  }

  /**
   * Get cached results for a vector similarity query
   * This method should be implemented by subclasses
   */
  abstract getCachedResults(query: VectorSimilarityQuery, workspace?: string): Promise<VectorSimilarityResults | null>;

  /**
   * Cache results from a vector similarity query
   * This method should be implemented by subclasses
   */
  abstract cacheResults(
    query: VectorSimilarityQuery, 
    results: VectorSimilarityResults, 
    workspace?: string, 
    ttl?: number
  ): Promise<boolean>;

  /**
   * Invalidate cache entries for a specific table and content type
   * This method should be implemented by subclasses
   */
  abstract invalidate(table: string, contentType?: string): Promise<number>;

  /**
   * Get cache effectiveness statistics
   */
  getCacheStats(): CacheStats {
    const total = this.stats.hitCount + this.stats.missCount;
    this.stats.hitRate = total > 0 ? this.stats.hitCount / total : 0;
    return { ...this.stats };
  }

  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable or disable caching
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Update cache statistics
   */
  protected updateStats(type: 'hit' | 'miss' | 'skip'): void {
    if (type === 'hit') {
      this.stats.hitCount++;
    } else if (type === 'miss') {
      this.stats.missCount++;
    } else if (type === 'skip') {
      this.stats.skipCount++;
    }
    
    const total = this.stats.hitCount + this.stats.missCount;
    this.stats.hitRate = total > 0 ? this.stats.hitCount / total : 0;
  }

  /**
   * Generate cache key from query and workspace
   */
  protected generateCacheKey(query: VectorSimilarityQuery, workspace?: string): string {
    // Create a deterministic key from the query parameters
    const queryKey = JSON.stringify({
      embedding: this.hashEmbedding(query.embedding),
      dimension: query.dimension,
      limit: query.limit,
      minSimilarity: query.minSimilarity,
      filter: query.filter,
      table: query.table,
      contentTypes: query.contentTypes,
      workspace
    });

    // Return a hash of the query key
    return this.hashString(queryKey);
  }

  /**
   * Create a compact hash representation of an embedding vector
   * We don't need to store the full embedding in the cache key
   */
  protected hashEmbedding(embedding: number[]): string {
    if (!embedding || embedding.length === 0) return '0';
    
    // Take a subset of values from the embedding (first, middle, last)
    const len = embedding.length;
    const sample = [
      embedding[0],
      embedding[Math.floor(len / 4)],
      embedding[Math.floor(len / 2)],
      embedding[Math.floor(3 * len / 4)],
      embedding[len - 1]
    ];
    
    // Convert to string with limited precision
    return sample.map(v => v.toFixed(4)).join('_');
  }

  /**
   * Generate a simple hash from a string
   * Used for cache keys
   */
  protected hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  /**
   * Determine appropriate TTL for caching
   * Defaults to the configured default TTL if not specified
   */
  protected getTTL(customTTL?: number): number {
    if (customTTL !== undefined) {
      // Clamp TTL to configured min/max
      return Math.max(this.ttl.min, Math.min(customTTL, this.ttl.max));
    }
    return this.ttl.default;
  }
}