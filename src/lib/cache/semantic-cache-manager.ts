/**
 * Semantic Cache Manager
 * Manages semantic similarity-based caching using embeddings and vector search
 * Provides efficient query matching for LLM response caching
 */

import { CacheTTL } from './cache-constants';
import type { EmbeddingService } from '../ai/embedding-service';

// Dynamic import for Redis to avoid circular dependencies
let redisClient: any = null;

// Statistics tracking
let hitCount = 0;
let missCount = 0;
let skipCount = 0;
let errorCount = 0;

/**
 * Semantic query structure
 */
export interface SemanticQuery {
  text: string;
  embedding?: number[];
  metadata?: Record<string, any>;
  provider?: string;
  model?: string;
}

/**
 * Semantic cache entry
 */
export interface SemanticCacheEntry<T = any> {
  query: SemanticQuery;
  data: T;
  embedding: number[];
  createdAt: number;
  expiresAt: number;
  hitCount: number;
  similarity?: number;
}

/**
 * Similarity search result
 */
export interface SimilaritySearchResult<T = any> {
  entry: SemanticCacheEntry<T>;
  similarity: number;
  isExactMatch: boolean;
}

/**
 * Configuration for semantic cache
 */
export interface SemanticCacheConfig {
  similarityThreshold?: number;
  ttl?: CacheTTL;
  maxResults?: number;
  enablePgVector?: boolean;
  embeddingService?: EmbeddingService;
  requireExactModelMatch?: boolean;
  requireExactProviderMatch?: boolean;
}

interface InternalSemanticCacheConfig {
  similarityThreshold: number;
  ttl: CacheTTL;
  maxResults: number;
  enablePgVector: boolean;
  embeddingService?: EmbeddingService;
  requireExactModelMatch: boolean;
  requireExactProviderMatch: boolean;
}

/**
 * Initialize Redis client lazily
 */
async function getRedisClient() {
  if (!redisClient) {
    try {
      const redisModule = await import('./redis-client');
      redisClient = await redisModule.getRedisClient();
    } catch (err) {
      // Redis not available, use in-memory fallback
      redisClient = null;
    }
  }
  return redisClient;
}

/**
 * Semantic Cache Manager
 * Provides similarity-based caching using embeddings
 */
export class SemanticCacheManager<T = any> {
  private config: InternalSemanticCacheConfig;
  private embeddingService?: EmbeddingService;
  private cachePrefix: string;

  constructor(cachePrefix: string = 'semantic', config: SemanticCacheConfig = {}) {
    this.cachePrefix = cachePrefix;
    this.config = {
      similarityThreshold: config.similarityThreshold ?? 0.85,
      ttl: config.ttl ?? CacheTTL.LONG,
      maxResults: config.maxResults ?? 10,
      enablePgVector: config.enablePgVector ?? false,
      embeddingService: config.embeddingService,
      requireExactModelMatch: config.requireExactModelMatch ?? true,
      requireExactProviderMatch: config.requireExactProviderMatch ?? true,
    };

    this.embeddingService = config.embeddingService;
  }

  /**
   * Calculate cache key from query
   */
  private getCacheKey(query: SemanticQuery): string {
    const keyComponents = [
      query.text,
      query.model || 'default',
      query.provider || 'default',
    ];

    const keyString = keyComponents.join('::');
    return `${this.cachePrefix}:${this.hashString(keyString)}`;
  }

  /**
   * Simple hash function for generating cache keys
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  public static calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same dimensions');
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Generate or retrieve embedding for a query
   */
  private async getQueryEmbedding(query: SemanticQuery): Promise<number[] | null> {
    // Use provided embedding if available
    if (query.embedding && query.embedding.length > 0) {
      return query.embedding;
    }

    // Generate embedding if service is available
    if (this.embeddingService) {
      try {
        return await this.embeddingService.generateEmbedding(query.text);
      } catch (error) {
        errorCount++;
        return null;
      }
    }

    return null;
  }

  /**
   * Find similar cached entries using embedding similarity
   */
  async findSimilar(query: SemanticQuery): Promise<SimilaritySearchResult<T> | null> {
    try {
      const redis = await getRedisClient();
      if (!redis) {
        missCount++;
        return null;
      }

      // Try exact match first
      const exactKey = this.getCacheKey(query);
      const exactMatch = await redis.get(exactKey) as SemanticCacheEntry<T> | null;

      if (exactMatch) {
        // Update hit count
        exactMatch.hitCount++;
        await redis.set(exactKey, exactMatch, this.config.ttl);

        hitCount++;
        return {
          entry: exactMatch,
          similarity: 1.0,
          isExactMatch: true,
        };
      }

      // If no exact match, try semantic similarity
      const queryEmbedding = await this.getQueryEmbedding(query);
      if (!queryEmbedding) {
        missCount++;
        return null;
      }

      // Use pgvector if enabled, otherwise fall back to linear search
      if (this.config.enablePgVector) {
        return await this.findSimilarWithPgVector(query, queryEmbedding);
      } else {
        return await this.findSimilarWithLinearSearch(query, queryEmbedding);
      }
    } catch (error) {
      errorCount++;
      missCount++;
      return null;
    }
  }

  /**
   * Find similar entries using pgvector database
   */
  private async findSimilarWithPgVector(
    query: SemanticQuery,
    queryEmbedding: number[]
  ): Promise<SimilaritySearchResult<T> | null> {
    // TODO: Implement pgvector integration
    // For now, fall back to linear search
    return await this.findSimilarWithLinearSearch(query, queryEmbedding);
  }

  /**
   * Find similar entries using linear search
   */
  private async findSimilarWithLinearSearch(
    query: SemanticQuery,
    queryEmbedding: number[]
  ): Promise<SimilaritySearchResult<T> | null> {
    try {
      const redis = await getRedisClient();
      if (!redis) {
        return null;
      }

      // Get all cached entries
      const pattern = `${this.cachePrefix}:*`;
      const keys = await this.getAllCacheKeys(pattern);

      let bestMatch: SemanticCacheEntry<T> | null = null;
      let bestSimilarity = 0;

      for (const key of keys) {
        const entry = await redis.get(key) as SemanticCacheEntry<T> | null;
        if (!entry || !entry.embedding) {
          continue;
        }

        // Check if entry is expired
        if (entry.expiresAt < Date.now()) {
          continue;
        }

        // Calculate similarity
        const similarity = SemanticCacheManager.calculateCosineSimilarity(
          queryEmbedding,
          entry.embedding
        );

        // Check if this is a better match
        if (similarity > bestSimilarity && similarity >= this.config.similarityThreshold) {
          // Check metadata matching requirements
          if (this.matchesRequirements(query, entry.query)) {
            bestMatch = entry;
            bestSimilarity = similarity;
          }
        }
      }

      if (bestMatch) {
        hitCount++;
        return {
          entry: bestMatch,
          similarity: bestSimilarity,
          isExactMatch: false,
        };
      }

      missCount++;
      return null;
    } catch (error) {
      errorCount++;
      return null;
    }
  }

  /**
   * Check if a cached entry matches the query requirements
   */
  private matchesRequirements(query: SemanticQuery, cachedQuery: SemanticQuery): boolean {
    // Check model match if required
    if (this.config.requireExactModelMatch) {
      if (query.model && cachedQuery.model && query.model !== cachedQuery.model) {
        return false;
      }
    }

    // Check provider match if required
    if (this.config.requireExactProviderMatch) {
      if (query.provider && cachedQuery.provider && query.provider !== cachedQuery.provider) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get all cache keys matching a pattern
   */
  private async getAllCacheKeys(pattern: string): Promise<string[]> {
    try {
      const redis = await getRedisClient();
      if (!redis) {
        return [];
      }

      const client = redis.getClient();
      if (!client) {
        return [];
      }

      // Use SCAN instead of KEYS for better performance
      const keys: string[] = [];
      let cursor = 0;

      do {
        const result = await client.scan(cursor, {
          MATCH: pattern,
          COUNT: 100,
        });

        cursor = result.cursor;
        keys.push(...result.keys);
      } while (cursor !== 0);

      return keys;
    } catch (error) {
      return [];
    }
  }

  /**
   * Cache an entry with its embedding
   */
  async set(query: SemanticQuery, data: T, ttl?: CacheTTL): Promise<boolean> {
    try {
      const redis = await getRedisClient();
      if (!redis) {
        return false;
      }

      // Generate embedding if not provided
      const embedding = await this.getQueryEmbedding(query);
      if (!embedding) {
        // Can't cache without embedding for semantic search
        return false;
      }

      const cacheKey = this.getCacheKey(query);
      const cacheTTL = ttl ?? this.config.ttl;
      const ttlMs = this.getTTLInMs(cacheTTL);

      const entry: SemanticCacheEntry<T> = {
        query,
        data,
        embedding,
        createdAt: Date.now(),
        expiresAt: Date.now() + ttlMs,
        hitCount: 0,
      };

      await redis.set(cacheKey, entry, cacheTTL);

      return true;
    } catch (error) {
      errorCount++;
      return false;
    }
  }

  /**
   * Invalidate a specific cache entry
   */
  async invalidate(query: SemanticQuery): Promise<boolean> {
    try {
      const redis = await getRedisClient();
      if (!redis) {
        return false;
      }

      const cacheKey = this.getCacheKey(query);
      return await redis.delete(cacheKey);
    } catch (error) {
      errorCount++;
      return false;
    }
  }

  /**
   * Clear all cache entries for this prefix
   */
  async clear(): Promise<boolean> {
    try {
      const redis = await getRedisClient();
      if (!redis) {
        return false;
      }

      const pattern = `${this.cachePrefix}:*`;
      const keys = await this.getAllCacheKeys(pattern);

      if (keys.length === 0) {
        return true;
      }

      await redis.deleteMany(keys);
      return true;
    } catch (error) {
      errorCount++;
      return false;
    }
  }

  /**
   * Determine if a query should skip caching
   */
  public shouldSkipCache(query: SemanticQuery): boolean {
    // Skip if query text is too short
    if (!query.text || query.text.trim().length < 10) {
      skipCount++;
      return true;
    }

    // Skip if no embedding service is available and no embedding provided
    if (!this.embeddingService && !query.embedding) {
      skipCount++;
      return true;
    }

    return false;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    hits: number;
    misses: number;
    skips: number;
    errors: number;
    hitRate: number;
  } {
    const total = hitCount + missCount;
    const hitRate = total > 0 ? hitCount / total : 0;

    return {
      hits: hitCount,
      misses: missCount,
      skips: skipCount,
      errors: errorCount,
      hitRate,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    hitCount = 0;
    missCount = 0;
    skipCount = 0;
    errorCount = 0;
  }

  /**
   * Convert CacheTTL enum to milliseconds
   */
  private getTTLInMs(ttl: CacheTTL): number {
    switch (ttl) {
      case CacheTTL.SHORT:
        return 5 * 60 * 1000; // 5 minutes
      case CacheTTL.MEDIUM:
        return 30 * 60 * 1000; // 30 minutes
      case CacheTTL.LONG:
        return 60 * 60 * 1000; // 1 hour
      case CacheTTL.VERY_LONG:
        return 24 * 60 * 60 * 1000; // 24 hours
      default:
        return 60 * 60 * 1000; // Default to 1 hour
    }
  }

  /**
   * Get cache configuration
   */
  getConfig(): InternalSemanticCacheConfig {
    return { ...this.config };
  }

  /**
   * Update cache configuration
   */
  updateConfig(config: Partial<SemanticCacheConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    if (config.embeddingService) {
      this.embeddingService = config.embeddingService;
    }
  }

  /**
   * Get embedding service
   */
  getEmbeddingService(): EmbeddingService | undefined {
    return this.embeddingService;
  }

  /**
   * Set embedding service
   */
  setEmbeddingService(service: EmbeddingService): void {
    this.embeddingService = service;
    this.config.embeddingService = service;
  }
}

/**
 * Create a semantic cache manager instance
 */
export function createSemanticCacheManager<T = any>(
  cachePrefix: string = 'semantic',
  config?: SemanticCacheConfig
): SemanticCacheManager<T> {
  return new SemanticCacheManager<T>(cachePrefix, config);
}
