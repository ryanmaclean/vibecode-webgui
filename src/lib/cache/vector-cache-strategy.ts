/**
 * Vector Cache Strategy for ValKey/Redis
 * Specialized caching for pgVector similarity searches
 */

import { cache, CacheTTL, CacheKeys } from './redis-client';
import { valkeyLogger } from './valkey-logger';
import { metrics } from '../server-monitoring';

// Interfaces for vector similarity search queries
export interface VectorSimilarityQuery {
  embedding: number[];            // Query embedding vector
  dimension?: number;             // Vector dimension (default 1536)
  limit?: number;                 // Max results to return
  minSimilarity?: number;         // Minimum similarity threshold
  filter?: Record<string, any>;   // Metadata filters
  table?: string;                 // Database table to query
  contentTypes?: string[];        // Content types to filter by
}

// Interface for vector similarity search results
export interface VectorSimilarityResult {
  id: string | number;            // Result ID
  similarity: number;             // Similarity score
  metadata?: Record<string, any>; // Additional metadata
  content?: string;               // Content snippet
  table?: string;                 // Source table
  contentType?: string;           // Content type
}

// Type for result arrays
export type VectorSimilarityResults = VectorSimilarityResult[];

/**
 * Vector Cache Manager - specialized for pgVector similarity searches
 * Provides efficient caching for vector search results with metadata-aware invalidation
 */
export class VectorCacheManager {
  // Default TTLs for different cache types
  private static readonly DEFAULT_TTL = CacheTTL.MEDIUM;          // 5 minutes
  private static readonly EMBEDDINGS_TTL = CacheTTL.EMBEDDINGS;   // 30 days
  private static readonly POPULAR_SEARCH_TTL = CacheTTL.HOUR * 2; // 2 hours

  // Cache operation metrics
  private static hitCount = 0;
  private static missCount = 0;
  private static skipCount = 0;

  /**
   * Calculate cache key for vector similarity search
   * Uses a deterministic approach to create consistent keys for similar searches
   */
  static calculateCacheKey(query: VectorSimilarityQuery, workspace?: string): string {
    // For very high-dimensional vectors, we need a stable but short representation
    // We calculate a fingerprint based on vector quantization 
    const vectorFingerprint = query.embedding.length > 1000
      ? this.getHighDimVectorFingerprint(query.embedding)
      : this.getVectorFingerprint(query.embedding);
    
    // Build a normalized representation of filters
    const filterKey = query.filter ? this.normalizeFilters(query.filter) : '';
    
    // Content type key
    const contentTypeKey = query.contentTypes 
      ? query.contentTypes.sort().join('_')
      : 'all';
    
    // Base key components
    const components = [
      query.table || 'default',
      vectorFingerprint,
      query.limit || 10,
      query.minSimilarity ? query.minSimilarity.toFixed(3) : '0.000',
      contentTypeKey,
      filterKey
    ];
    
    // Include workspace if provided
    if (workspace) {
      components.push(workspace);
    }
    
    // Generate cache key
    return CacheKeys.vectorSearch(
      components.join(':'), 
      workspace
    );
  }
  
  /**
   * Generate a stable fingerprint from a vector
   * Reduces vector dimensions while preserving similarity characteristics
   */
  private static getVectorFingerprint(vector: number[]): string {
    if (!vector || vector.length === 0) {
      return 'empty';
    }
    
    // Handle very small vectors directly (avoid overhead)
    if (vector.length <= 4) {
      return vector.map(v => Math.round(v * 100) / 100).join('_');
    }
    
    // Single-pass statistical feature extraction for optimal performance
    let sum = 0;
    let sumSquares = 0;
    let max = -Infinity;
    let min = Infinity;
    let maxIndex = 0;
    
    // O(n) single pass through vector
    for (let i = 0; i < vector.length; i++) {
      const val = vector[i];
      sum += val;
      sumSquares += val * val;
      
      if (val > max) {
        max = val;
        maxIndex = i;
      }
      if (val < min) {
        min = val;
      }
    }
    
    const length = vector.length;
    const mean = sum / length;
    const variance = (sumSquares / length) - (mean * mean);
    const std = Math.sqrt(Math.max(0, variance)); // Avoid NaN for edge cases
    const l2Norm = Math.sqrt(sumSquares);
    
    // Quantize features to balance precision with cache efficiency
    // Round to 2 decimal places for good similarity preservation
    const features = [
      Math.round(mean * 100) / 100,           // Mean value
      Math.round(std * 100) / 100,            // Standard deviation  
      Math.round(max * 100) / 100,            // Maximum value
      Math.round(min * 100) / 100,            // Minimum value
      Math.round(l2Norm * 100) / 100,         // Vector magnitude
      maxIndex % 1000                         // Dominant dimension (mod 1000 for stability)
    ];
    
    // Create feature string for hashing
    const featureString = features.join('|');
    
    // Fast FNV-1a hash for compact, collision-resistant fingerprint
    return this.fnvHash(featureString);
  }

  /**
   * Fast FNV-1a hash implementation for generating compact fingerprints
   * Returns 8-character hex string for optimal cache key size
   */
  private static fnvHash(str: string): string {
    let hash = 0x811c9dc5; // FNV offset basis (32-bit)
    
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0; // FNV prime, unsigned 32-bit
    }
    
    // Convert to 8-character hex string
    return hash.toString(16).padStart(8, '0');
  }

  /**
   * Alternative fingerprint for very high-dimensional vectors (>1000 dimensions)
   * Uses hybrid approach: statistical features + strategic sampling
   */
  private static getHighDimVectorFingerprint(vector: number[]): string {
    if (vector.length <= 1000) {
      return this.getVectorFingerprint(vector);
    }
    
    // Get statistical fingerprint
    const statFingerprint = this.getVectorFingerprint(vector);
    
    // Add strategic sampling for extra robustness with very high dimensions
    const sampleCount = 8;
    const samples: number[] = [];
    
    // Sample from different regions: start, middle, end, and peaks
    const regions = [
      0,                                  // Start
      Math.floor(vector.length * 0.25),   // First quarter
      Math.floor(vector.length * 0.5),    // Middle
      Math.floor(vector.length * 0.75),   // Third quarter
      vector.length - 1                   // End
    ];
    
    // Add samples from different regions
    regions.forEach(idx => {
      if (samples.length < sampleCount && idx < vector.length) {
        samples.push(Math.round(vector[idx] * 100) / 100);
      }
    });
    
    // Fill remaining slots with max values (captures dominant features)
    const sortedIndices = Array.from({length: vector.length}, (_, i) => i)
      .sort((a, b) => Math.abs(vector[b]) - Math.abs(vector[a]));
    
    for (let i = 0; i < sortedIndices.length && samples.length < sampleCount; i++) {
      const val = vector[sortedIndices[i]];
      if (!samples.some(s => Math.abs(s - val) < 0.01)) { // Avoid duplicates
        samples.push(Math.round(val * 100) / 100);
      }
    }
    
    const sampleString = samples.join('|');
    const sampleHash = this.fnvHash(sampleString);
    
    // Combine statistical and sampling fingerprints
    return `${statFingerprint}_${sampleHash}`;
  }
  
  /**
   * Normalize filters to create consistent cache keys
   */
  private static normalizeFilters(filters: Record<string, any>): string {
    // Sort keys for consistent ordering
    const sortedKeys = Object.keys(filters).sort();
    
    // Build normalized key-value pairs
    const normalizedPairs = sortedKeys.map(key => {
      const value = filters[key];
      
      // Handle arrays consistently
      if (Array.isArray(value)) {
        return `${key}:[${value.sort().join(',')}]`;
      }
      
      // Handle objects with recursive normalization
      if (typeof value === 'object' && value !== null) {
        return `${key}:{${this.normalizeFilters(value)}}`;
      }
      
      // Handle primitive values
      return `${key}:${value}`;
    });
    
    return normalizedPairs.join('|');
  }
  
  /**
   * Get cached vector similarity search results
   */
  static async getCachedResults(
    query: VectorSimilarityQuery,
    workspace?: string
  ): Promise<VectorSimilarityResults | null> {
    const startTime = Date.now();
    const cacheKey = this.calculateCacheKey(query, workspace);
    
    try {
      // Skip cache for queries with unusual filters to avoid cache pollution
      if (this.shouldSkipCache(query)) {
        this.skipCount++;
        metrics.increment('vector_cache.skip');
        return null;
      }
      
      // Get from cache
      const cachedResults = await cache.get<VectorSimilarityResults>(cacheKey);
      const duration = Date.now() - startTime;
      
      // Record metrics
      metrics.histogram('vector_cache.get.duration', duration);
      
      if (cachedResults) {
        this.hitCount++;
        metrics.increment('vector_cache.hit');
        valkeyLogger.debug('Vector cache hit', {
          command: 'get',
          key: cacheKey,
          duration,
          cacheHit: true,
          keyCount: 1,
          valueSize: JSON.stringify(cachedResults).length,
          metadata: { resultCount: cachedResults.length }
        });
        return cachedResults;
      } else {
        this.missCount++;
        metrics.increment('vector_cache.miss');
        return null;
      }
    } catch (error) {
      metrics.increment('vector_cache.error');
      valkeyLogger.error('Vector cache get error', {
        command: 'get',
        key: cacheKey,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
  
  /**
   * Cache vector similarity search results
   */
  static async cacheResults(
    query: VectorSimilarityQuery,
    results: VectorSimilarityResults,
    workspace?: string,
    customTtl?: number
  ): Promise<boolean> {
    const startTime = Date.now();
    const cacheKey = this.calculateCacheKey(query, workspace);
    
    try {
      // Skip caching for empty results or if we should skip cache
      if (results.length === 0 || this.shouldSkipCache(query)) {
        metrics.increment('vector_cache.skip_store');
        return false;
      }
      
      // Determine optimal TTL based on result characteristics
      const optimizedTtl = customTtl || this.getOptimalTtl(query, results);
      
      // Cache results
      await cache.set(cacheKey, results, optimizedTtl);
      
      const duration = Date.now() - startTime;
      metrics.histogram('vector_cache.set.duration', duration);
      metrics.increment('vector_cache.set.success');
      
      valkeyLogger.debug('Vector cache store', {
        command: 'set',
        key: cacheKey,
        duration,
        ttl: optimizedTtl,
        valueSize: JSON.stringify(results).length,
        metadata: { resultCount: results.length }
      });
      
      return true;
    } catch (error) {
      metrics.increment('vector_cache.set.error');
      valkeyLogger.error('Vector cache set error', {
        command: 'set',
        key: cacheKey,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
  
  /**
   * Invalidate cache entries when vector database changes
   */
  static async invalidateForTable(table: string, contentType?: string): Promise<number> {
    try {
      // Create pattern for matching cache keys to invalidate
      let pattern: string;
      
      if (contentType) {
        // Invalidate specific content type
        pattern = `vector:search:${table}:*:*:*:${contentType}*`;
      } else {
        // Invalidate entire table
        pattern = `vector:search:${table}:*`;
      }
      
      // Find matching keys
      const keys = await cache.keys(pattern);
      
      if (keys.length > 0) {
      // Delete matching keys
      await cache.del(keys);
      for (let i = 0; i < keys.length; i++) {
        metrics.increment('vector_cache.invalidated');
      }
        
        valkeyLogger.info('Vector cache invalidated', {
          command: 'del',
          keyCount: keys.length,
          metadata: { table, contentType, pattern }
        });
      }
      
      return keys.length;
    } catch (error) {
      metrics.increment('vector_cache.invalidate.error');
      valkeyLogger.error('Vector cache invalidation error', {
        command: 'invalidate',
        error: error instanceof Error ? error.message : String(error),
        metadata: { table, contentType }
      });
      return 0;
    }
  }
  
  /**
   * Decide whether to skip cache for a query
   */
  private static shouldSkipCache(query: VectorSimilarityQuery): boolean {
    // Skip for very specific filters that are unlikely to be reused
    if (query.filter && Object.keys(query.filter).length > 5) {
      return true;
    }
    
    // Skip for very low similarity thresholds (broad queries)
    if (query.minSimilarity !== undefined && query.minSimilarity < 0.1) {
      return true;
    }
    
    // Skip for unusually large result sets
    if (query.limit !== undefined && query.limit > 100) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Calculate optimal TTL based on query and results
   */
  private static getOptimalTtl(
    query: VectorSimilarityQuery,
    results: VectorSimilarityResults
  ): number {
    // Use longer TTL for stable embeddings like code
    if (query.table === 'rag_chunks' && query.contentTypes?.includes('code')) {
      return this.EMBEDDINGS_TTL;
    }
    
    // Use shorter TTL for smaller result sets (might be more specific)
    if (results.length <= 3) {
      return Math.floor(this.DEFAULT_TTL / 2);
    }
    
    // Use longer TTL for popular/common searches (larger result sets)
    if (results.length >= 10) {
      return this.POPULAR_SEARCH_TTL;
    }
    
    return this.DEFAULT_TTL;
  }
  
  /**
   * Get cache effectiveness metrics
   */
  static getCacheStats(): {
    hitCount: number;
    missCount: number;
    skipCount: number;
    hitRate: number;
  } {
    const total = this.hitCount + this.missCount;
    const hitRate = total > 0 ? this.hitCount / total : 0;
    
    return {
      hitCount: this.hitCount,
      missCount: this.missCount,
      skipCount: this.skipCount,
      hitRate
    };
  }
  
  /**
   * Reset cache metrics
   */
  static resetStats(): void {
    this.hitCount = 0;
    this.missCount = 0;
    this.skipCount = 0;
  }
}

// Export the vector cache manager
export default VectorCacheManager;