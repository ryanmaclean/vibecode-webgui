/**
 * LLM Response Cache
 * Implements semantic caching for LLM responses using embedding-based similarity matching
 *
 * This cache reduces API calls and latency by returning cached responses for semantically
 * similar queries. Uses Redis for storage and pgvector for similarity searches.
 */

import { CacheTTL, CACHE_PREFIXES } from './cache-constants';
import type { EmbeddingService } from '../ai/embedding-service';

// Dynamic imports for Redis to avoid circular dependencies
let redisClient: any = null;

// Statistics tracking
let hitCount = 0;
let missCount = 0;
let writeCount = 0;
let errorCount = 0;

/**
 * LLM query and response types
 */
export interface LLMQuery {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  provider?: string;
  metadata?: Record<string, any>;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
  metadata?: Record<string, any>;
  cachedAt?: number;
  embedding?: number[];
}

export interface CachedLLMEntry {
  query: LLMQuery;
  response: LLMResponse;
  embedding: number[];
  createdAt: number;
  expiresAt: number;
  hitCount: number;
}

export interface LLMCacheConfig {
  similarityThreshold?: number; // Minimum cosine similarity to consider a cache hit
  ttl?: CacheTTL; // Default TTL for cache entries
  maxCacheSize?: number; // Maximum number of entries to cache
  enableSemanticSearch?: boolean; // Whether to use vector similarity
  embeddingService?: EmbeddingService; // Service for generating embeddings
}

interface InternalLLMCacheConfig {
  similarityThreshold: number;
  ttl: CacheTTL;
  maxCacheSize: number;
  enableSemanticSearch: boolean;
  embeddingService?: EmbeddingService;
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
      redisClient = null;
    }
  }
  return redisClient;
}

/**
 * LLM Response Cache Manager
 * Manages caching of LLM responses with semantic similarity matching
 */
export class LLMResponseCache {
  private config: InternalLLMCacheConfig;
  private embeddingService?: EmbeddingService;

  constructor(config: LLMCacheConfig = {}) {
    this.config = {
      similarityThreshold: config.similarityThreshold ?? 0.85,
      ttl: config.ttl ?? CacheTTL.LONG,
      maxCacheSize: config.maxCacheSize ?? 1000,
      enableSemanticSearch: config.enableSemanticSearch ?? true,
      embeddingService: config.embeddingService,
    };

    this.embeddingService = config.embeddingService;
  }

  /**
   * Generate cache key from query
   */
  private getCacheKey(query: LLMQuery): string {
    // Create a deterministic key from query parameters
    const keyComponents = [
      query.prompt,
      query.model || 'default',
      query.temperature?.toFixed(2) || '0.7',
      query.maxTokens || 'auto',
      query.provider || 'default',
    ];

    const keyString = keyComponents.join('::');
    return `${CACHE_PREFIXES.EMBEDDING}llm:${this.hashString(keyString)}`;
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
  private calculateCosineSimilarity(a: number[], b: number[]): number {
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
   * Get cached response for a query
   */
  async get(query: LLMQuery): Promise<LLMResponse | null> {
    try {
      const redis = await getRedisClient();
      if (!redis) {
        missCount++;
        return null;
      }

      // Try exact match first
      const cacheKey = this.getCacheKey(query);
      const cachedData = await redis.get(cacheKey) as CachedLLMEntry | null;

      if (cachedData) {
        // Update hit count
        cachedData.hitCount++;
        await redis.set(cacheKey, cachedData, this.config.ttl);

        hitCount++;
        return {
          ...cachedData.response,
          cachedAt: cachedData.createdAt,
        };
      }

      // If semantic search is enabled, try similarity matching
      if (this.config.enableSemanticSearch && this.embeddingService) {
        const similarResponse = await this.findSimilarResponse(query);
        if (similarResponse) {
          hitCount++;
          return similarResponse;
        }
      }

      missCount++;
      return null;
    } catch (error) {
      errorCount++;
      missCount++;
      return null;
    }
  }

  /**
   * Find similar cached response using embedding similarity
   */
  private async findSimilarResponse(query: LLMQuery): Promise<LLMResponse | null> {
    if (!this.embeddingService) {
      return null;
    }

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embeddingService.generateEmbedding(query.prompt);

      // Get all cached entries (in production, use vector database for this)
      const redis = await getRedisClient();
      if (!redis) {
        return null;
      }

      // For now, we'll use a simple linear search
      // In production, this should use pgvector or similar
      const pattern = `${CACHE_PREFIXES.EMBEDDING}llm:*`;
      const keys = await this.getAllCacheKeys(pattern);

      let bestMatch: CachedLLMEntry | null = null;
      let bestSimilarity = 0;

      for (const key of keys) {
        const entry = await redis.get(key) as CachedLLMEntry | null;
        if (!entry || !entry.embedding) {
          continue;
        }

        // Calculate similarity
        const similarity = this.calculateCosineSimilarity(queryEmbedding, entry.embedding);

        // Check if this is a better match
        if (similarity > bestSimilarity && similarity >= this.config.similarityThreshold) {
          // Also check if model and provider match
          if (
            (!query.model || entry.query.model === query.model) &&
            (!query.provider || entry.query.provider === query.provider)
          ) {
            bestMatch = entry;
            bestSimilarity = similarity;
          }
        }
      }

      if (bestMatch) {
        return {
          ...bestMatch.response,
          cachedAt: bestMatch.createdAt,
          metadata: {
            ...bestMatch.response.metadata,
            similarity: bestSimilarity,
            semanticMatch: true,
          },
        };
      }

      return null;
    } catch (error) {
      errorCount++;
      return null;
    }
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

      // Use SCAN instead of KEYS for better performance in production
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
   * Cache a response
   */
  async set(query: LLMQuery, response: LLMResponse, ttl?: CacheTTL): Promise<boolean> {
    try {
      const redis = await getRedisClient();
      if (!redis) {
        return false;
      }

      // Generate embedding if service is available
      let embedding: number[] | undefined;
      if (this.embeddingService) {
        try {
          embedding = await this.embeddingService.generateEmbedding(query.prompt);
        } catch (error) {
          // Continue without embedding if generation fails
          embedding = undefined;
        }
      }

      const cacheKey = this.getCacheKey(query);
      const cacheTTL = ttl ?? this.config.ttl;
      const ttlMs = this.getTTLInMs(cacheTTL);

      const entry: CachedLLMEntry = {
        query,
        response,
        embedding: embedding || [],
        createdAt: Date.now(),
        expiresAt: Date.now() + ttlMs,
        hitCount: 0,
      };

      await redis.set(cacheKey, entry, cacheTTL);
      writeCount++;

      return true;
    } catch (error) {
      errorCount++;
      return false;
    }
  }

  /**
   * Invalidate a specific cache entry
   */
  async invalidate(query: LLMQuery): Promise<boolean> {
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
   * Clear all LLM cache entries
   */
  async clear(): Promise<boolean> {
    try {
      const redis = await getRedisClient();
      if (!redis) {
        return false;
      }

      const pattern = `${CACHE_PREFIXES.EMBEDDING}llm:*`;
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
   * Get cache statistics
   */
  getStats(): {
    hits: number;
    misses: number;
    writes: number;
    errors: number;
    hitRate: number;
  } {
    const total = hitCount + missCount;
    const hitRate = total > 0 ? hitCount / total : 0;

    return {
      hits: hitCount,
      misses: missCount,
      writes: writeCount,
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
    writeCount = 0;
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
  getConfig(): InternalLLMCacheConfig {
    return { ...this.config };
  }

  /**
   * Update cache configuration
   */
  updateConfig(config: Partial<LLMCacheConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    if (config.embeddingService) {
      this.embeddingService = config.embeddingService;
    }
  }
}

/**
 * Export singleton instance for global use
 */
let llmCacheInstance: LLMResponseCache | null = null;

/**
 * Get or create LLM response cache instance
 */
export function getLLMResponseCache(config?: LLMCacheConfig): LLMResponseCache {
  if (!llmCacheInstance) {
    llmCacheInstance = new LLMResponseCache(config);
  } else if (config) {
    llmCacheInstance.updateConfig(config);
  }

  return llmCacheInstance;
}

/**
 * Reset LLM response cache instance
 */
export function resetLLMResponseCache(): void {
  llmCacheInstance = null;
}
