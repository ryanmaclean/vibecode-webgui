/**
 * Enhanced Cache Manager for VibeCode WebGUI
 * Handles caching, session storage, and real-time features with fallback support
 */

import { metrics } from '../server-monitoring';
import { RedisError } from './redis-error';
import { LocalFallbackCache } from './local-fallback-cache';
import { redisConnection, RedisClientType } from './redis-connection';

// Cache key generators
export const CacheKeys = {
  user: (userId: string) => `user:${userId}`,
  workspace: (workspaceId: string) => `workspace:${workspaceId}`,
  project: (projectId: string) => `project:${projectId}`,
  aiResponse: (hash: string) => `ai:response:${hash}`,
  vectorSearch: (query: string, workspaceId?: string) => 
    `vector:search:${Buffer.from(query + (workspaceId || '')).toString('base64')}`,
  fileContent: (fileId: string) => `file:content:${fileId}`,
  embeddings: (contentHash: string) => `embeddings:${contentHash}`,
  rateLimit: (identifier: string) => `ratelimit:${identifier}`,
  session: (sessionId: string) => `session:${sessionId}`,
  apiMetrics: (endpoint: string, timeWindow: string) => `metrics:${endpoint}:${timeWindow}`,
};

// Cache TTL constants (in seconds)
export const CacheTTL = {
  SHORT: 60,           // 1 minute
  MEDIUM: 300,         // 5 minutes  
  LONG: 1800,          // 30 minutes
  HOUR: 3600,          // 1 hour
  DAY: 86400,          // 24 hours
  WEEK: 604800,        // 7 days
  EMBEDDINGS: 2592000, // 30 days (embeddings rarely change)
};

/**
 * Enhanced cache operations with performance monitoring and error handling
 */
export class CacheManager {
  private redis: RedisClientType | null = null;
  private readonly localCache: LocalFallbackCache;
  private readonly useLocalFallback: boolean;

  constructor(options = { useLocalFallback: true }) {
    this.redis = redisConnection.getClient();
    this.useLocalFallback = options.useLocalFallback;
    this.localCache = new LocalFallbackCache();
  }

  /**
   * Get value from cache with metrics and error handling
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (!this.redis) {
      // Fallback to local cache if Redis is unavailable
      if (this.useLocalFallback) {
        return this.localCache.get<T>(key);
      }
      return null;
    }

    const startTime = Date.now();
    
    try {
      const value = await this.redis.get(key);
      const duration = Date.now() - startTime;
      
      metrics.histogram('cache.get.duration', duration);
      
      if (value) {
        metrics.increment('cache.hit');
        return JSON.parse(value);
      } else {
        metrics.increment('cache.miss');
        return null;
      }
    } catch (error) {
      metrics.increment('cache.error');
      console.error('Cache get error:', error);
      
      // Fallback to local cache on Redis failure
      if (this.useLocalFallback) {
        const localValue = this.localCache.get<T>(key);
        if (localValue !== null) {
          metrics.increment('cache.hit.local.fallback');
          return localValue;
        }
      }
      
      throw new RedisError(`Failed to get value for key: ${key}`, 'get', error);
    }
  }

  /**
   * Set value in cache with TTL and metrics
   */
  async set(key: string, value: any, ttl: number = CacheTTL.MEDIUM): Promise<boolean> {
    // Store in local fallback cache
    if (this.useLocalFallback) {
      this.localCache.set(key, value, ttl);
      
      if (!this.redis) {
        metrics.increment('cache.set.local');
        return true;
      }
    }
    
    if (!this.redis) return false;

    const startTime = Date.now();
    
    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttl, serialized);
      
      const duration = Date.now() - startTime;
      metrics.histogram('cache.set.duration', duration);
      metrics.increment('cache.set.success');
      
      return true;
    } catch (error) {
      metrics.increment('cache.set.error');
      console.error('Cache set error:', error);
      throw new RedisError(`Failed to set value for key: ${key}`, 'set', error);
    }
  }

  /**
   * Delete key from cache with error handling
   */
  async del(key: string | string[]): Promise<boolean> {
    // Remove from local fallback cache
    if (this.useLocalFallback) {
      const keys = Array.isArray(key) ? key : [key];
      keys.forEach(k => this.localCache.delete(k));
      
      if (!this.redis) {
        metrics.increment('cache.delete.local');
        return true;
      }
    }
    
    if (!this.redis) return false;

    try {
      const keys = Array.isArray(key) ? key : [key];
      await this.redis.del(keys);
      
      metrics.increment('cache.delete');
      return true;
    } catch (error) {
      metrics.increment('cache.delete.error');
      console.error('Cache delete error:', error);
      throw new RedisError(`Failed to delete key(s): ${Array.isArray(key) ? key.join(', ') : key}`, 'del', error);
    }
  }

  /**
   * Check if key exists with error handling
   */
  async exists(key: string): Promise<boolean> {
    // Check local fallback cache
    if (this.useLocalFallback) {
      const exists = this.localCache.has(key);
      if (exists) {
        metrics.increment('cache.exists.local');
        return true;
      }
      
      if (!this.redis) {
        return false;
      }
    }
    
    if (!this.redis) return false;

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      throw new RedisError(`Failed to check existence of key: ${key}`, 'exists', error);
    }
  }

  /**
   * Get multiple keys at once with error handling
   */
  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    if (!this.redis || keys.length === 0) {
      // Fallback to local cache if Redis is unavailable
      if (this.useLocalFallback) {
        return this.localCache.mget<T>(keys);
      }
      return keys.map(() => null);
    }

    try {
      const values = await this.redis.mget(keys);
      return values.map((value: string | null) => value ? JSON.parse(value) : null);
    } catch (error) {
      console.error('Cache mget error:', error);
      
      // Fallback to local cache on Redis failure
      if (this.useLocalFallback) {
        const localValues = this.localCache.mget<T>(keys);
        metrics.increment('cache.mget.fallback');
        return localValues;
      }
      
      throw new RedisError(`Failed to get multiple values for keys: ${keys.join(', ')}`, 'mget', error);
    }
  }

  /**
   * Set multiple keys at once with error handling
   */
  async mset(pairs: Array<{ key: string; value: any; ttl?: number }>): Promise<boolean> {
    // Store in local fallback cache
    if (this.useLocalFallback) {
      for (const { key, value, ttl = CacheTTL.MEDIUM } of pairs) {
        this.localCache.set(key, value, ttl);
      }
      
      if (!this.redis || pairs.length === 0) {
        metrics.increment('cache.mset.local');
        return true;
      }
    }
    
    if (!this.redis || pairs.length === 0) return false;

    try {
      const pipeline = this.redis.pipeline();
      
      for (const { key, value, ttl = CacheTTL.MEDIUM } of pairs) {
        const serialized = JSON.stringify(value);
        pipeline.setex(key, ttl, serialized);
      }
      
      await pipeline.exec();
      metrics.increment('cache.mset.success');
      return true;
    } catch (error) {
      metrics.increment('cache.mset.error');
      console.error('Cache mset error:', error);
      throw new RedisError(`Failed to set multiple values for ${pairs.length} keys`, 'mset', error);
    }
  }

  /**
   * Increment counter with error handling
   */
  async incr(key: string, ttl?: number): Promise<number> {
    if (!this.redis) {
      // No good local fallback for atomic increments
      return 0;
    }

    try {
      const value = await this.redis.incr(key);
      
      if (ttl && value === 1) {
        // Set TTL only on first increment
        await this.redis.expire(key, ttl);
      }
      
      return value;
    } catch (error) {
      console.error('Cache incr error:', error);
      throw new RedisError(`Failed to increment counter for key: ${key}`, 'incr', error);
    }
  }

  /**
   * Get keys matching pattern with error handling
   */
  async keys(pattern: string): Promise<string[]> {
    if (!this.redis) {
      // Limited local fallback for key pattern matching
      if (this.useLocalFallback) {
        return this.localCache.keysMatching(pattern);
      }
      return [];
    }

    try {
      return await this.redis.keys(pattern);
    } catch (error) {
      console.error('Cache keys error:', error);
      throw new RedisError(`Failed to get keys matching pattern: ${pattern}`, 'keys', error);
    }
  }

  /**
   * Get cache statistics with error handling
   */
  async getStats(): Promise<{
    connected: boolean;
    keyCount: number;
    memoryUsage: string;
    hitRate: number;
    localFallbackEnabled: boolean;
    localFallbackSize: number;
  }> {
    const localFallbackStats = {
      localFallbackEnabled: this.useLocalFallback,
      localFallbackSize: this.useLocalFallback ? this.localCache.size : 0
    };
    
    if (!this.redis) {
      return {
        connected: false,
        keyCount: this.useLocalFallback ? this.localCache.size : 0,
        memoryUsage: '0B',
        hitRate: 0,
        ...localFallbackStats
      };
    }

    try {
      const info = await this.redis.info('memory');
      const dbSize = await this.redis.dbsize();
      
      // Parse memory usage from info
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : '0B';

      // Calculate hit rate from metrics (simplified)
      const hitRate = 0.85; // This would be calculated from actual metrics
      
      return {
        connected: true,
        keyCount: dbSize,
        memoryUsage,
        hitRate,
        ...localFallbackStats
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return {
        connected: false,
        keyCount: this.useLocalFallback ? this.localCache.size : 0,
        memoryUsage: '0B',
        hitRate: 0,
        ...localFallbackStats
      };
    }
  }

  /**
   * Clear all cache with error handling
   */
  async clear(): Promise<boolean> {
    // Clear local fallback cache
    if (this.useLocalFallback) {
      this.localCache.clear();
      metrics.increment('cache.clear.local');
      
      if (!this.redis) {
        return true;
      }
    }
    
    if (!this.redis) return false;

    try {
      await this.redis.flushdb();
      metrics.increment('cache.clear');
      return true;
    } catch (error) {
      console.error('Cache clear error:', error);
      throw new RedisError('Failed to clear cache', 'clear', error);
    }
  }

  /**
   * Health check with error handling
   */
  async healthCheck(): Promise<boolean> {
    if (!this.redis) return false;

    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Cache health check failed:', error);
      return false;
    }
  }

  /**
   * Attempt to reconnect to Redis if disconnected
   */
  async reconnect(): Promise<boolean> {
    try {
      return await redisConnection.reconnect();
    } catch (error) {
      console.error('Error during Redis reconnection:', error);
      return false;
    } finally {
      // Update our Redis client reference
      this.redis = redisConnection.getClient();
    }
  }
}

/**
 * Cache wrapper for functions with automatic key generation and error handling
 */
export function withCache<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  keyGenerator: (...args: T) => string,
  ttl: number = CacheTTL.MEDIUM
) {
  return async (...args: T): Promise<R> => {
    const key = keyGenerator(...args);
    
    try {
      // Try to get from cache first
      const cached = await cache.get<R>(key);
      if (cached !== null) {
        return cached;
      }
    } catch (error) {
      // Log but continue to execute the function
      console.warn(`Cache retrieval failed for key ${key}, falling back to function execution:`, error);
    }
    
    // Execute function
    const result = await fn(...args);
    
    try {
      // Cache result
      await cache.set(key, result, ttl);
    } catch (error) {
      // Log but don't fail the operation
      console.warn(`Failed to cache result for key ${key}:`, error);
    }
    
    return result;
  };
}

/**
 * Cache invalidation patterns with error handling
 */
export class CacheInvalidation {
  static async invalidateUser(userId: string) {
    const patterns = [
      CacheKeys.user(userId),
      `workspace:*:user:${userId}`,
      `project:*:user:${userId}`,
    ];
    
    for (const pattern of patterns) {
      try {
        const keys = await cache.keys(pattern);
        if (keys.length > 0) {
          await cache.del(keys);
        }
      } catch (error) {
        console.error(`Failed to invalidate user cache for pattern ${pattern}:`, error);
        // Continue with other patterns even if one fails
      }
    }
  }

  static async invalidateWorkspace(workspaceId: string) {
    const patterns = [
      CacheKeys.workspace(workspaceId),
      `project:*:workspace:${workspaceId}`,
      `vector:search:*:${workspaceId}`,
    ];
    
    for (const pattern of patterns) {
      try {
        const keys = await cache.keys(pattern);
        if (keys.length > 0) {
          await cache.del(keys);
        }
      } catch (error) {
        console.error(`Failed to invalidate workspace cache for pattern ${pattern}:`, error);
        // Continue with other patterns even if one fails
      }
    }
  }

  static async invalidateProject(projectId: string) {
    try {
      await cache.del(CacheKeys.project(projectId));
    } catch (error) {
      console.error(`Failed to invalidate project cache for project ${projectId}:`, error);
      // Let the error propagate as this is a simple operation that should succeed
      throw error;
    }
  }
}

// Export singleton instance
export const cache = new CacheManager();

export default cache;