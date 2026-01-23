/**
 * Cache Utilities
 * Provides a unified caching layer with TTL-based expiration
 * Supports both in-memory caching and Redis/Valkey backends
 */

import { cache as redisCache, CacheKeys, CacheTTL as RedisCacheTTL } from './unified-cache-client';
import { CacheTTL, CACHE_PREFIXES } from './cache-constants';
import { metrics } from '../server-monitoring';

/**
 * In-memory cache entry with TTL tracking
 */
interface MemoryCacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
  accessCount: number;
}

/**
 * Cache options for get/set operations
 */
export interface CacheOptions {
  /** TTL in seconds (default: 300 = 5 minutes) */
  ttl?: number;
  /** Whether to use memory cache as fallback (default: true) */
  useMemoryFallback?: boolean;
  /** Whether to track metrics (default: true) */
  trackMetrics?: boolean;
  /** Cache key prefix */
  prefix?: string;
}

/**
 * Memory cache with LRU eviction and TTL support
 */
class MemoryCache {
  private cache: Map<string, MemoryCacheEntry<unknown>> = new Map();
  private maxEntries: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxEntries: number = 10000, cleanupIntervalMs: number = 60000) {
    this.maxEntries = maxEntries;

    // Start periodic cleanup
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
    }
  }

  /**
   * Get value from memory cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update access count for LRU
    entry.accessCount++;
    return entry.value as T;
  }

  /**
   * Set value in memory cache with TTL
   */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxEntries) {
      this.evictLRU();
    }

    const now = Date.now();
    this.cache.set(key, {
      value,
      expiresAt: now + (ttlSeconds * 1000),
      createdAt: now,
      accessCount: 1,
    });
  }

  /**
   * Delete key from memory cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete keys matching a pattern
   */
  deletePattern(pattern: string): number {
    let deleted = 0;
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getStats(): { size: number; maxEntries: number } {
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
    };
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      // Prioritize expired entries
      if (Date.now() > entry.expiresAt) {
        this.cache.delete(key);
        return;
      }

      // Otherwise find least accessed
      if (entry.accessCount < oldestAccess) {
        oldestAccess = entry.accessCount;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Dispose cleanup interval
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton memory cache instance
const memoryCache = new MemoryCache();

/**
 * Generate a cache key with optional prefix
 */
export function generateCacheKey(parts: string[], prefix?: string): string {
  const key = parts.join(':');
  return prefix ? `${prefix}${key}` : key;
}

/**
 * Get value from cache with automatic fallback to memory cache
 */
export async function cacheGet<T>(
  key: string,
  options: CacheOptions = {}
): Promise<T | null> {
  const { useMemoryFallback = true, trackMetrics = true } = options;
  const startTime = Date.now();

  try {
    // Try Redis/Valkey first
    const redisValue = await redisCache.get<T>(key);
    if (redisValue !== null) {
      if (trackMetrics) {
        metrics.increment('cache.unified.hit', { source: 'redis' });
      }
      return redisValue;
    }

    // Fall back to memory cache
    if (useMemoryFallback) {
      const memValue = memoryCache.get<T>(key);
      if (memValue !== null) {
        if (trackMetrics) {
          metrics.increment('cache.unified.hit', { source: 'memory' });
        }
        return memValue;
      }
    }

    if (trackMetrics) {
      metrics.increment('cache.unified.miss');
    }
    return null;

  } catch (error) {
    // Redis unavailable, try memory cache
    if (useMemoryFallback) {
      const memValue = memoryCache.get<T>(key);
      if (memValue !== null) {
        if (trackMetrics) {
          metrics.increment('cache.unified.hit', { source: 'memory_fallback' });
        }
        return memValue;
      }
    }

    if (trackMetrics) {
      metrics.increment('cache.unified.error');
    }
    return null;

  } finally {
    if (trackMetrics) {
      metrics.histogram('cache.unified.get.duration', Date.now() - startTime);
    }
  }
}

/**
 * Set value in cache with automatic memory cache backup
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  options: CacheOptions = {}
): Promise<boolean> {
  const { ttl = CacheTTL.MEDIUM, useMemoryFallback = true, trackMetrics = true } = options;
  const startTime = Date.now();

  try {
    // Set in Redis/Valkey
    const success = await redisCache.set(key, value, ttl);

    // Also set in memory cache for faster access
    if (useMemoryFallback) {
      memoryCache.set(key, value, ttl);
    }

    if (trackMetrics) {
      metrics.increment('cache.unified.set', { success: success.toString() });
    }

    return success;

  } catch (error) {
    // Redis unavailable, use memory cache only
    if (useMemoryFallback) {
      memoryCache.set(key, value, ttl);
      if (trackMetrics) {
        metrics.increment('cache.unified.set', { source: 'memory_fallback' });
      }
      return true;
    }

    if (trackMetrics) {
      metrics.increment('cache.unified.set.error');
    }
    return false;

  } finally {
    if (trackMetrics) {
      metrics.histogram('cache.unified.set.duration', Date.now() - startTime);
    }
  }
}

/**
 * Delete key from both caches
 */
export async function cacheDelete(key: string): Promise<boolean> {
  try {
    const redisResult = await redisCache.del(key);
    memoryCache.delete(key);
    return redisResult;
  } catch {
    memoryCache.delete(key);
    return true;
  }
}

/**
 * Delete keys matching a pattern
 */
export async function cacheDeletePattern(pattern: string): Promise<number> {
  try {
    const keys = await redisCache.keys(pattern);
    if (keys.length > 0) {
      await redisCache.del(keys);
    }
    const memDeleted = memoryCache.deletePattern(pattern);
    return Math.max(keys.length, memDeleted);
  } catch {
    return memoryCache.deletePattern(pattern);
  }
}

/**
 * Get or set value with automatic caching (cache-aside pattern)
 */
export async function cacheGetOrSet<T>(
  key: string,
  factory: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  // Try to get from cache first
  const cached = await cacheGet<T>(key, options);
  if (cached !== null) {
    return cached;
  }

  // Execute factory function
  const value = await factory();

  // Cache the result
  await cacheSet(key, value, options);

  return value;
}

/**
 * Decorator for caching function results
 * @param keyGenerator Function to generate cache key from arguments
 * @param options Cache options
 */
export function withCaching<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyGenerator: (...args: TArgs) => string,
  options: CacheOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const key = keyGenerator(...args);

    // Try cache first
    const cached = await cacheGet<TResult>(key, options);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn(...args);
    await cacheSet(key, result, options);

    return result;
  };
}

/**
 * Cache key generators for common use cases
 */
export const CacheKeyGenerators = {
  /** Generate key for user-related data */
  user: (userId: string) => generateCacheKey(['user', userId], CACHE_PREFIXES.USER),

  /** Generate key for workspace data */
  workspace: (workspaceId: string) => generateCacheKey(['workspace', workspaceId]),

  /** Generate key for user preferences */
  userPreferences: (userId: number) => generateCacheKey(['preferences', userId.toString()], CACHE_PREFIXES.USER),

  /** Generate key for templates */
  templates: () => generateCacheKey(['templates', 'all']),

  /** Generate key for feature flag */
  featureFlag: (flagKey: string, userId: string) => generateCacheKey(['feature', flagKey, userId]),

  /** Generate key for API response */
  apiResponse: (endpoint: string, params?: string) => {
    const parts = ['api', endpoint];
    if (params) {
      parts.push(Buffer.from(params).toString('base64').slice(0, 32));
    }
    return generateCacheKey(parts);
  },

  /** Generate key for database query */
  dbQuery: (table: string, operation: string, params?: string) => {
    const parts = [CACHE_PREFIXES.QUERY, table, operation];
    if (params) {
      parts.push(Buffer.from(params).toString('base64').slice(0, 32));
    }
    return generateCacheKey(parts);
  },

  /** Generate key for session data */
  session: (sessionId: string) => generateCacheKey(['session', sessionId], CACHE_PREFIXES.SESSION),
};

/**
 * Cache invalidation helpers
 */
export const CacheInvalidators = {
  /** Invalidate all user-related cache */
  async invalidateUser(userId: string): Promise<void> {
    await cacheDeletePattern(`${CACHE_PREFIXES.USER}*${userId}*`);
  },

  /** Invalidate workspace cache */
  async invalidateWorkspace(workspaceId: string): Promise<void> {
    await cacheDeletePattern(`*workspace:${workspaceId}*`);
  },

  /** Invalidate templates cache */
  async invalidateTemplates(): Promise<void> {
    await cacheDelete(CacheKeyGenerators.templates());
  },

  /** Invalidate feature flag cache for user */
  async invalidateFeatureFlag(flagKey: string, userId?: string): Promise<void> {
    if (userId) {
      await cacheDelete(CacheKeyGenerators.featureFlag(flagKey, userId));
    } else {
      await cacheDeletePattern(`*feature:${flagKey}*`);
    }
  },
};

/**
 * TTL presets for common cache durations
 */
export const TTLPresets = {
  /** Very short TTL for frequently changing data (1 minute) */
  VERY_SHORT: 60,
  /** Short TTL (5 minutes) */
  SHORT: CacheTTL.SHORT,
  /** Medium TTL (30 minutes) */
  MEDIUM: CacheTTL.MEDIUM,
  /** Long TTL (1 hour) */
  LONG: CacheTTL.LONG,
  /** Very long TTL (24 hours) */
  VERY_LONG: CacheTTL.VERY_LONG,
  /** Templates - longer cache as they rarely change (2 hours) */
  TEMPLATES: 7200,
  /** User preferences (15 minutes) */
  USER_PREFERENCES: 900,
  /** Feature flags (10 minutes) */
  FEATURE_FLAGS: 600,
  /** Health checks (30 seconds) */
  HEALTH_CHECK: 30,
  /** Session data (1 hour) */
  SESSION: 3600,
};

/**
 * Get memory cache stats
 */
export function getMemoryCacheStats(): { size: number; maxEntries: number } {
  return memoryCache.getStats();
}

/**
 * Clear memory cache
 */
export function clearMemoryCache(): void {
  memoryCache.clear();
}

// Re-export commonly used items
export { CacheKeys, RedisCacheTTL as RedisClientTTL };
export { CacheTTL, CACHE_PREFIXES };
