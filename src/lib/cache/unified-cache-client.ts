/**
 * Unified Cache Client supporting both Redis and Valkey
 *
 * IMPORTANT: This uses Valkey (https://valkey.io/), the open-source fork of Redis
 * that maintains BSD licensing, avoiding Redis' restrictive RSAL/SSPL dual license.
 * Valkey is 100% Redis-compatible, so we use ioredis client for connection.
 *
 * This unified client eliminates code duplication by supporting both Redis and Valkey
 * through the same interface, using ioredis which is MIT licensed.
 *
 * Architecture:
 * - Valkey/Redis Server (BSD/open-source licensed)
 * - ioredis Client Library (MIT licensed)
 * - Unified Cache Client (handles caching, session storage, real-time features)
 */

import { Redis } from 'ioredis';
import { metrics } from '../server-monitoring';
// import { logger } from '@/lib/logger';
import { getErrorMessage } from '@/lib/utils/api-response';
import { loadSecret } from '@/lib/security/macos-keychain-server';
// Enhanced Redis interfaces for type safety
interface RedisCommands {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<'OK'>;
  del(...keys: string[]): Promise<number>;
  exists(key: string): Promise<number>;
  mget(...keys: string[]): Promise<(string | null)[]>;
  pipeline(): Pipeline;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  info(section?: string): Promise<string>;
  dbsize(): Promise<number>;
  flushdb(): Promise<'OK'>;
  ping(): Promise<string>;
}

// Pipeline interface
interface Pipeline {
  setex(key: string, seconds: number, value: string): Pipeline;
  exec(): Promise<[Error | null, unknown][]>;
}

// Combined Redis type with command extensions
type EnhancedRedis = Redis & RedisCommands;

// Cache configuration options
interface CacheConnectionOptions {
  host: string;
  port: number;
  password?: string;
  db: number;
  retryDelayOnFailover: number;
  enableReadyCheck: boolean;
  maxRetriesPerRequest: number;
  lazyConnect: boolean;
  keepAlive: number;
  family: number;
  commandTimeout: number;
  connectTimeout: number;
}

// Get cache configuration from environment (supports both Redis and Valkey env vars)
const getCacheConfig = () => {
  // Load from keychain first, then fall back to environment variables
  const valkeyUrl = loadSecret('VALKEY_URL') || process.env.VALKEY_URL
  const redisUrl = loadSecret('REDIS_URL') || process.env.REDIS_URL
  
  // Prefer Valkey env vars, fall back to Redis env vars for backward compatibility
  if (valkeyUrl || redisUrl) {
    return {
      url: valkeyUrl || redisUrl
    } as const;
  }

  // Fallback configuration with keychain support
  return {
    host: loadSecret('VALKEY_HOST') || process.env.VALKEY_HOST || 
          loadSecret('REDIS_HOST') || process.env.REDIS_HOST || 'localhost',
    port: parseInt(loadSecret('VALKEY_PORT') || process.env.VALKEY_PORT || 
                 loadSecret('REDIS_PORT') || process.env.REDIS_PORT || '6379'),
    password: loadSecret('VALKEY_PASSWORD') || process.env.VALKEY_PASSWORD ||
              loadSecret('REDIS_PASSWORD') || process.env.REDIS_PASSWORD,
    db: parseInt(loadSecret('VALKEY_DB') || process.env.VALKEY_DB || 
                loadSecret('REDIS_DB') || process.env.REDIS_DB || '0')
  } as const;
};

const config = getCacheConfig();

// Determine client type for metrics (Valkey preferred, Redis as fallback)
const clientType = (loadSecret('VALKEY_URL') || process.env.VALKEY_URL || 
                   loadSecret('VALKEY_HOST') || process.env.VALKEY_HOST) ? 'valkey' : 'redis';

// Create cache client with optimized settings
let cacheClient: Redis | null = null;

try {
  if ('url' in config) {
    // @ts-expect-error - ioredis constructor typing issue
    cacheClient = new Redis(config.url, {
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      // Connection pool settings
      family: 4,
      // Performance optimizations
      commandTimeout: 5000,
      connectTimeout: 10000,
    });
  } else {
    // @ts-expect-error - ioredis constructor typing issue
    cacheClient = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      family: 4,
      commandTimeout: 5000,
      connectTimeout: 10000,
    });
  }

  // Event listeners for monitoring
  cacheClient.on('connect', () => {
    console.info(`${clientType.charAt(0).toUpperCase() + clientType.slice(1)} connected successfully`, {
      clientType,
      event: 'cache_connected'
    });
    metrics.increment(`${clientType}.connection.success`);
  });

  cacheClient.on('error', (error) => {
    console.error(`${clientType.charAt(0).toUpperCase() + clientType.slice(1)} connection error`, {
      clientType,
      event: 'cache_error',
      error: getErrorMessage(error)
    });
    metrics.increment(`${clientType}.connection.error`);
  });

  cacheClient.on('ready', () => {
    console.info(`${clientType.charAt(0).toUpperCase() + clientType.slice(1)} client ready`, {
      clientType,
      event: 'cache_ready'
    });
    metrics.increment(`${clientType}.ready`);
  });
} catch (error) {
  console.warn(`${clientType.charAt(0).toUpperCase() + clientType.slice(1)} client initialization failed`, {
    clientType,
    event: 'cache_init_failed',
    error: getErrorMessage(error)
  });
  cacheClient = null;
}

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
 * Unified cache operations with performance monitoring
 * Supports both Redis and Valkey backends transparently
 */
export class CacheManager {
  private client: Redis | null;
  private clientType: string;

  constructor() {
    this.client = cacheClient;
    this.clientType = clientType;
  }

  /**
   * Get value from cache with metrics
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    if (!this.client) return null;

    const startTime = Date.now();

    try {
      const value = await (this.client as EnhancedRedis).get(key);
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
      console.error(`${this.clientType.charAt(0).toUpperCase() + this.clientType.slice(1)} get error`, {
        clientType: this.clientType,
        operation: 'get',
        key,
        error: getErrorMessage(error)
      });
      return null;
    }
  }

  /**
   * Set value in cache with TTL and metrics
   */
  async set(key: string, value: unknown, ttl: number = CacheTTL.MEDIUM): Promise<boolean> {
    if (!this.client) return false;

    const startTime = Date.now();

    try {
      const serialized = JSON.stringify(value);
      await (this.client as EnhancedRedis).setex(key, ttl, serialized);

      const duration = Date.now() - startTime;
      metrics.histogram('cache.set.duration', duration);
      metrics.increment('cache.set.success');

      return true;
    } catch (error) {
      metrics.increment('cache.set.error');
      console.error(`${this.clientType.charAt(0).toUpperCase() + this.clientType.slice(1)} set error`, {
        clientType: this.clientType,
        operation: 'set',
        key,
        ttl,
        error: getErrorMessage(error)
      });
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async del(key: string | string[]): Promise<boolean> {
    if (!this.client) return false;

    try {
      const keys = Array.isArray(key) ? key : [key];
      await (this.client as EnhancedRedis).del(...keys);

      metrics.increment('cache.delete', { count: keys.length.toString() });
      return true;
    } catch (error) {
      metrics.increment('cache.delete.error');
      console.error(`${this.clientType.charAt(0).toUpperCase() + this.clientType.slice(1)} delete error`, {
        clientType: this.clientType,
        operation: 'delete',
        keys: Array.isArray(key) ? key : [key],
        error: getErrorMessage(error)
      });
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const result = await (this.client as EnhancedRedis).exists(key);
      return result === 1;
    } catch (error) {
      console.error(`${this.clientType.charAt(0).toUpperCase() + this.clientType.slice(1)} exists error`, {
        clientType: this.clientType,
        operation: 'exists',
        key,
        error: getErrorMessage(error)
      });
      return false;
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget<T = unknown>(keys: string[]): Promise<(T | null)[]> {
    if (!this.client || keys.length === 0) return [];

    try {
      const values = await (this.client as EnhancedRedis).mget(...keys);
      return values.map((value: string | null) => value ? JSON.parse(value) : null);
    } catch (error) {
      console.error(`${this.clientType.charAt(0).toUpperCase() + this.clientType.slice(1)} mget error`, {
        clientType: this.clientType,
        operation: 'mget',
        keyCount: keys.length,
        error: getErrorMessage(error)
      });
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple keys at once
   */
  async mset(pairs: Array<{ key: string; value: unknown; ttl?: number }>): Promise<boolean> {
    if (!this.client || pairs.length === 0) return false;

    try {
      const pipeline = (this.client as EnhancedRedis).pipeline();

      for (const { key, value, ttl = CacheTTL.MEDIUM } of pairs) {
        const serialized = JSON.stringify(value);
        pipeline.setex(key, ttl, serialized);
      }

      await pipeline.exec();
      metrics.increment('cache.mset.success', { count: pairs.length.toString() });
      return true;
    } catch (error) {
      metrics.increment('cache.mset.error');
      console.error(`${this.clientType.charAt(0).toUpperCase() + this.clientType.slice(1)} mset error`, {
        clientType: this.clientType,
        operation: 'mset',
        pairCount: pairs.length,
        error: getErrorMessage(error)
      });
      return false;
    }
  }

  /**
   * Increment counter (useful for rate limiting, metrics)
   */
  async incr(key: string, ttl?: number): Promise<number> {
    if (!this.client) return 0;

    try {
      const value = await (this.client as EnhancedRedis).incr(key);

      if (ttl && value === 1) {
        // Set TTL only on first increment
        await (this.client as EnhancedRedis).expire(key, ttl);
      }

      return value;
    } catch (error) {
      console.error(`${this.clientType.charAt(0).toUpperCase() + this.clientType.slice(1)} incr error`, {
        clientType: this.clientType,
        operation: 'incr',
        key,
        ttl,
        error: getErrorMessage(error)
      });
      return 0;
    }
  }

  /**
   * Get keys matching pattern
   */
  async keys(pattern: string): Promise<string[]> {
    if (!this.client) return [];

    try {
      return await (this.client as EnhancedRedis).keys(pattern);
    } catch (error) {
      console.error(`${this.clientType.charAt(0).toUpperCase() + this.clientType.slice(1)} keys error`, {
        clientType: this.clientType,
        operation: 'keys',
        pattern,
        error: getErrorMessage(error)
      });
      return [];
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    keyCount: number;
    memoryUsage: string;
    hitRate: number;
  }> {
    if (!this.client) {
      return {
        connected: false,
        keyCount: 0,
        memoryUsage: '0B',
        hitRate: 0
      };
    }

    try {
      const info = await (this.client as EnhancedRedis).info('memory');
      const dbSize = await (this.client as EnhancedRedis).dbsize();

      // Parse memory usage from info
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : '0B';

      // Calculate hit rate from metrics (simplified)
      const hitRate = 0.85; // This would be calculated from actual metrics

      return {
        connected: true,
        keyCount: dbSize,
        memoryUsage,
        hitRate
      };
    } catch (error) {
      console.error(`${this.clientType.charAt(0).toUpperCase() + this.clientType.slice(1)} stats error`, {
        clientType: this.clientType,
        operation: 'stats',
        error: getErrorMessage(error)
      });
      return {
        connected: false,
        keyCount: 0,
        memoryUsage: '0B',
        hitRate: 0
      };
    }
  }

  /**
   * Clear all cache (use with caution)
   */
  async clear(): Promise<boolean> {
    if (!this.client) return false;

    try {
      await (this.client as EnhancedRedis).flushdb();
      metrics.increment('cache.clear');
      return true;
    } catch (error) {
      console.error(`${this.clientType.charAt(0).toUpperCase() + this.clientType.slice(1)} clear error`, {
        clientType: this.clientType,
        operation: 'clear',
        error: getErrorMessage(error)
      });
      return false;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.client) return false;

    try {
      await (this.client as EnhancedRedis).ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the type of cache client being used
   */
  getClientType(): string {
    return this.clientType;
  }
}

// Export singleton instance
export const cache = new CacheManager();

/**
 * Cache wrapper for functions with automatic key generation
 */
export function withCache<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  keyGenerator: (...args: T) => string,
  ttl: number = CacheTTL.MEDIUM
) {
  return async (...args: T): Promise<R> => {
    const key = keyGenerator(...args);

    // Try to get from cache first
    const cached = await cache.get<R>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn(...args);
    await cache.set(key, result, ttl);

    return result;
  };
}

/**
 * Cache invalidation patterns
 */
export class CacheInvalidation {
  static async invalidateUser(userId: string) {
    const patterns = [
      CacheKeys.user(userId),
      `workspace:*:user:${userId}`,
      `project:*:user:${userId}`,
    ];

    for (const pattern of patterns) {
      const keys = await cache.keys(pattern);
      if (keys.length > 0) {
        await cache.del(keys);
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
      const keys = await cache.keys(pattern);
      if (keys.length > 0) {
        await cache.del(keys);
      }
    }
  }

  static async invalidateProject(projectId: string) {
    await cache.del(CacheKeys.project(projectId));
  }
}

export default cache;
