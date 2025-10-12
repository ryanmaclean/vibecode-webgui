/**
 * Redis Vector Cache Adapter
 * Caches vector similarity results in Redis
 */

// Import Redis with proper typing
import Redis from 'ioredis';
import { BaseVectorCacheAdapter } from './base-vector-cache-adapter';
import { VectorSimilarityQuery, VectorSimilarityResults } from '../interfaces/vector-types';
import { logger } from '@/lib/logger';
export class RedisVectorCacheAdapter extends BaseVectorCacheAdapter {
  private client: Redis | null = null;
  private keyPrefix: string;
  private namespace: string;

  constructor(
    connectionString?: string,
    ttl: { default: number; min: number; max: number } = { default: 3600, min: 60, max: 86400 },
    options: Record<string, any> = {}
  ) {
    super(true, connectionString, ttl, options);
    this.keyPrefix = options.keyPrefix || 'vector:cache:';
    this.namespace = options.namespace || 'default';
    this.initClient();
  }

  /**
   * Initialize Redis client
   */
  private initClient(): void {
    try {
      if (this.connectionString) {
        this.client = new Redis(this.connectionString);
      } else {
        // Default connection for local development
        this.client = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB || '0'),
          maxRetriesPerRequest: 3,
          connectTimeout: 5000,
          ...this.options.clientOptions
        });
      }

      this.client.on('error', (err: Error) => {
        logger.error('Redis cache connection error:', err);
      });
    } catch (error) {
      logger.error('Failed to initialize Redis cache:', error);
      this.client = null;
    }
  }

  /**
   * Get cached results for a vector similarity query
   */
  async getCachedResults(query: VectorSimilarityQuery, workspace?: string): Promise<VectorSimilarityResults | null> {
    if (!this.client || !this.enabled) {
      this.updateStats('skip');
      return null;
    }

    try {
      const cacheKey = this.generateCacheKey(query, workspace);
      const fullKey = `${this.keyPrefix}${this.namespace}:${workspace || 'global'}:${cacheKey}`;
      
      const cachedData = await this.client.get(fullKey);
      
      if (cachedData) {
        try {
          const results = JSON.parse(cachedData) as VectorSimilarityResults;
          this.updateStats('hit');
          return results;
        } catch (parseError) {
          logger.warn('Error parsing cached results:', parseError);
          this.updateStats('miss');
          return null;
        }
      } else {
        this.updateStats('miss');
        return null;
      }
    } catch (error) {
      logger.error('Error getting cached results:', error);
      this.updateStats('skip');
      return null;
    }
  }

  /**
   * Cache results from a vector similarity query
   */
  async cacheResults(
    query: VectorSimilarityQuery, 
    results: VectorSimilarityResults, 
    workspace?: string, 
    ttl?: number
  ): Promise<boolean> {
    if (!this.client || !this.enabled || !results || results.length === 0) {
      return false;
    }

    try {
      const cacheKey = this.generateCacheKey(query, workspace);
      const fullKey = `${this.keyPrefix}${this.namespace}:${workspace || 'global'}:${cacheKey}`;
      
      // Determine TTL
      const cacheTTL = this.getTTL(ttl);
      
      // Store results as JSON string with TTL
      await this.client.set(fullKey, JSON.stringify(results));
      await this.client.expire(fullKey, cacheTTL);
      
      return true;
    } catch (error) {
      logger.error('Error caching results:', error);
      return false;
    }
  }

  /**
   * Invalidate cache entries for a specific table and content type
   */
  async invalidate(table: string, contentType?: string): Promise<number> {
    if (!this.client || !this.enabled) {
      return 0;
    }

    try {
      // Create pattern to match keys for this table and optional content type
      let pattern: string;
      if (contentType) {
        pattern = `${this.keyPrefix}${this.namespace}:*:*${table}*${contentType}*`;
      } else {
        pattern = `${this.keyPrefix}${this.namespace}:*:*${table}*`;
      }
      
      // Find keys matching pattern
      const keys = await this.client.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      // Delete keys in batches to avoid blocking Redis
      const batchSize = 100;
      let deletedCount = 0;
      
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        if (batch.length > 0) {
          // Delete each key in the batch
          for (const key of batch) {
            const deleted = await this.client.del(key);
            deletedCount += deleted;
          }
        }
      }
      
      return deletedCount;
    } catch (error) {
      logger.error('Error invalidating cache:', error);
      return 0;
    }
  }

  /**
   * Close the Redis connection
   */
  async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch (error) {
        logger.error('Error closing Redis connection:', error);
      }
      this.client = null;
    }
  }
}