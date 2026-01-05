/**
 * Vector Cache Strategy
 * Implements caching for vector similarity searches with Redis backend
 */

// Vector similarity query type
export interface VectorSimilarityQuery {
  embedding: number[];
  table: string;
  limit?: number;
  minSimilarity?: number;
  contentTypes?: string[];
  filter?: Record<string, any>;
}

// Vector similarity results type
export type VectorSimilarityResults = Array<{
  id: string | number;
  similarity: number;
  metadata?: Record<string, any>;
  content?: string;
  table?: string;
  contentType?: string;
}>;

// Dynamic import for Redis to avoid circular dependencies
let redisClient: any = null;
let CacheTTL: any = null;

// Statistics tracking
let hitCount = 0;
let missCount = 0;
let skipCount = 0;

/**
 * Initialize Redis client lazily
 */
async function getRedisClient() {
  if (!redisClient) {
    try {
      const redisModule = await import('./redis-client');
      redisClient = redisModule.cache;
      CacheTTL = redisModule.CacheTTL;
    } catch (err) {
      // Redis not available, use in-memory fallback
      redisClient = null;
    }
  }
  return redisClient;
}

// Vector cache manager implementation
export class VectorCacheManager {
  /**
   * Calculate cache key from query parameters
   */
  public static calculateCacheKey(query: VectorSimilarityQuery, workspace?: string): string {
    // Generate vector fingerprint for compact representation
    const vectorFingerprint = this.getVectorFingerprint(query.embedding);

    // Build cache key components
    const filterKey = query.filter ? JSON.stringify(query.filter) : '';
    const contentTypeKey = query.contentTypes ? query.contentTypes.sort().join('_') : 'all';

    const components = [
      query.table || 'default',
      vectorFingerprint,
      query.limit || 10,
      query.minSimilarity ? query.minSimilarity.toFixed(3) : '0.000',
      contentTypeKey,
      filterKey
    ];

    if (workspace) {
      components.push(workspace);
    }

    return `vector:search:${Buffer.from(components.join(':')).toString('base64')}`;
  }

  /**
   * Generate a compact fingerprint from a vector
   */
  private static getVectorFingerprint(vector: number[]): string {
    if (!vector || vector.length === 0) return 'empty';

    // Calculate statistical features
    let sum = 0;
    let max = -Infinity;
    let min = Infinity;

    for (let i = 0; i < vector.length; i++) {
      const val = vector[i];
      sum += val;
      if (val > max) max = val;
      if (val < min) min = val;
    }

    const mean = sum / vector.length;
    const features = [
      Math.round(mean * 100) / 100,
      Math.round(max * 100) / 100,
      Math.round(min * 100) / 100
    ];

    return features.join('|');
  }

  /**
   * Get cached results if available
   */
  public static async getCachedResults(
    query: VectorSimilarityQuery,
    workspace?: string
  ): Promise<VectorSimilarityResults | null> {
    try {
      const cacheKey = this.calculateCacheKey(query, workspace);

      // Check if we should skip cache for this query
      if (this.shouldSkipCache(query)) {
        skipCount++;
        return null;
      }

      const redis = await getRedisClient();
      if (!redis) {
        return null;
      }

      const cachedData = await redis.get(cacheKey);

      if (cachedData) {
        hitCount++;
        return typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
      } else {
        missCount++;
        return null;
      }
    } catch (err) {
      // Cache read error - return null to fall back to database
      missCount++;
      return null;
    }
  }

  /**
   * Cache results for future retrieval
   */
  public static async cacheResults(
    query: VectorSimilarityQuery,
    results: VectorSimilarityResults,
    workspace?: string,
    customTtl?: number
  ): Promise<boolean> {
    try {
      // Don't cache empty results or queries that should be skipped
      if (!results || results.length === 0 || this.shouldSkipCache(query)) {
        return false;
      }

      const redis = await getRedisClient();
      if (!redis) {
        return false;
      }

      const cacheKey = this.calculateCacheKey(query, workspace);

      // Determine TTL based on query characteristics
      let ttl = customTtl || this.calculateTtl(query, results);

      // Store in cache
      await redis.set(cacheKey, JSON.stringify(results), ttl);

      return true;
    } catch (err) {
      // Cache write error - don't fail the operation
      return false;
    }
  }

  /**
   * Calculate appropriate TTL for a query
   */
  private static calculateTtl(query: VectorSimilarityQuery, results: VectorSimilarityResults): number {
    // Default TTL
    const defaultTtl = CacheTTL?.EMBEDDINGS || 2592000; // 30 days

    // Shorter TTL for small result sets (likely specific queries)
    if (results.length < 3) {
      return Math.floor(defaultTtl / 2);
    }

    // Use default for most queries
    return defaultTtl;
  }

  /**
   * Determine if a query should skip caching
   */
  private static shouldSkipCache(query: VectorSimilarityQuery): boolean {
    // Skip if too many filter conditions (very specific query)
    if (query.filter && Object.keys(query.filter).length > 5) {
      return true;
    }

    // Skip if very low similarity threshold (exploratory query)
    if (query.minSimilarity !== undefined && query.minSimilarity < 0.1) {
      return true;
    }

    // Skip if requesting very large result set
    if (query.limit !== undefined && query.limit > 100) {
      return true;
    }

    return false;
  }

  /**
   * Invalidate cache entries for a specific table
   */
  public static async invalidateForTable(table: string, contentType?: string): Promise<number> {
    try {
      const redis = await getRedisClient();
      if (!redis) {
        return 0;
      }

      // Build pattern to match cache keys
      let pattern: string;
      if (contentType) {
        pattern = `vector:search:*${table}*${contentType}*`;
      } else {
        pattern = `vector:search:*${table}*`;
      }

      // Find and delete matching keys
      const keys = await redis.keys(pattern);
      if (keys && keys.length > 0) {
        await redis.del(keys);
        return keys.length;
      }

      return 0;
    } catch (err) {
      return 0;
    }
  }

  /**
   * Get cache performance statistics
   */
  public static getCacheStats(): {
    hitCount: number;
    missCount: number;
    skipCount: number;
    hitRate: number;
  } {
    const total = hitCount + missCount;
    const hitRate = total > 0 ? hitCount / total : 0;

    return {
      hitCount,
      missCount,
      skipCount,
      hitRate
    };
  }

  /**
   * Reset cache statistics
   */
  public static resetStats(): void {
    hitCount = 0;
    missCount = 0;
    skipCount = 0;
  }
}