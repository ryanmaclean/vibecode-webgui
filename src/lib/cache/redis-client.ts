/**
 * Redis Client for Caching
 * Provides Redis-based caching functionality for VibeCode
 */

import { createClient, RedisClientType } from 'redis';
import { CacheTTL } from './cache-constants';
// import { logger } from '@/lib/logger';
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  database?: number;
  keyPrefix?: string;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
}

export interface CacheEntry<T = any> {
  value: T;
  expiry: number;
  createdAt: number;
}

/**
 * Redis-based cache client
 */
export class RedisCacheClient {
  private client: RedisClientType | null = null;
  private config: RedisConfig;
  private isConnected = false;

  constructor(config: RedisConfig) {
    this.config = {
      keyPrefix: 'vibecode:',
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      ...config
    };
  }

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    try {
      this.client = createClient({
        socket: {
          host: this.config.host,
          port: this.config.port,
        },
        password: this.config.password,
        database: this.config.database || 0,
        keyPrefix: this.config.keyPrefix,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            console.error('Redis server connection refused');
            return new Error('Redis server connection refused');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            console.error('Redis retry time exhausted');
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 10) {
            console.error('Redis max retry attempts exceeded');
            return new Error('Max retry attempts exceeded');
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      // Event listeners for monitoring
      this.client.on('connect', () => {
        console.log('Redis client connected');
        this.isConnected = true;
      });

      this.client.on('error', (error) => {
        console.error('Redis client error:', error);
        this.isConnected = false;
      });

      this.client.on('ready', () => {
        console.log('Redis client ready');
        this.isConnected = true;
      });

      this.client.on('end', () => {
        console.log('Redis client connection ended');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.warn('Redis client initialization failed:', error);
      this.client = null;
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Check if Redis is connected
   */
  isHealthy(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.client || !this.isConnected) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (value === null) {
        return null;
      }

      const parsed = JSON.parse(value) as CacheEntry<T>;
      const now = Date.now();

      // Check if entry has expired
      if (parsed.expiry && now > parsed.expiry) {
        await this.client.del(key);
        return null;
      }

      return parsed.value;
    } catch (error) {
      console.warn(`Failed to get cache key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(
    key: string,
    value: T,
    ttl: CacheTTL = CacheTTL.MEDIUM
  ): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const ttlMs = this.getTTLInMs(ttl);
      const cacheEntry: CacheEntry<T> = {
        value,
        expiry: Date.now() + ttlMs,
        createdAt: Date.now()
      };

      const serialized = JSON.stringify(cacheEntry);
      await this.client.setEx(key, Math.floor(ttlMs / 1000), serialized);
      return true;
    } catch (error) {
      console.warn(`Failed to set cache key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      console.warn(`Failed to delete cache key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys from cache
   */
  async deleteMany(keys: string[]): Promise<number> {
    if (!this.client || !this.isConnected || keys.length === 0) {
      return 0;
    }

    try {
      const result = await this.client.del(keys);
      return result;
    } catch (error) {
      console.warn(`Failed to delete cache keys:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result > 0;
    } catch (error) {
      console.warn(`Failed to check cache key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set multiple key-value pairs
   */
  async setMany(pairs: Array<{ key: string; value: any; ttl?: CacheTTL }>): Promise<boolean> {
    if (!this.client || !this.isConnected || pairs.length === 0) {
      return false;
    }

    try {
      const pipeline = this.client.multi();

      for (const { key, value, ttl = CacheTTL.MEDIUM } of pairs) {
        const ttlMs = this.getTTLInMs(ttl);
        const cacheEntry: CacheEntry = {
          value,
          expiry: Date.now() + ttlMs,
          createdAt: Date.now()
        };

        const serialized = JSON.stringify(cacheEntry);
        pipeline.setEx(key, Math.floor(ttlMs / 1000), serialized);
      }

      await pipeline.exec();
      return true;
    } catch (error) {
      console.warn('Failed to set multiple cache entries:', error);
      return false;
    }
  }

  /**
   * Get multiple values from cache
   */
  async getMany<T>(keys: string[]): Promise<Array<T | null>> {
    if (!this.client || !this.isConnected || keys.length === 0) {
      return keys.map(() => null);
    }

    try {
      const values = await this.client.mGet(keys);
      const now = Date.now();

      return values.map(value => {
        if (value === null) return null;

        try {
          const parsed = JSON.parse(value) as CacheEntry<T>;

          // Check if entry has expired
          if (parsed.expiry && now > parsed.expiry) {
            return null;
          }

          return parsed.value;
        } catch (parseError) {
          console.warn('Failed to parse cached value:', parseError);
          return null;
        }
      });
    } catch (error) {
      console.warn('Failed to get multiple cache entries:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Increment numeric value in cache
   */
  async increment(key: string, increment: number = 1): Promise<number | null> {
    if (!this.client || !this.isConnected) {
      return null;
    }

    try {
      const result = await this.client.incrBy(key, increment);
      return result;
    } catch (error) {
      console.warn(`Failed to increment cache key ${key}:`, error);
      return null;
    }
  }

  /**
   * Get or set pattern - atomic operation
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl: CacheTTL = CacheTTL.MEDIUM
  ): Promise<T> {
    const existing = await this.get<T>(key);

    if (existing !== null) {
      return existing;
    }

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      await this.client.flushAll();
      return true;
    } catch (error) {
      console.warn('Failed to clear cache:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    keyCount?: number;
    memoryUsage?: number;
    hitRate?: number;
  }> {
    if (!this.client || !this.isConnected) {
      return { connected: false };
    }

    try {
      const info = await this.client.info('memory');
      const keyspaceInfo = await this.client.info('keyspace');

      return {
        connected: true,
        keyCount: this.extractKeyCount(keyspaceInfo),
        memoryUsage: this.extractMemoryUsage(info),
      };
    } catch (error) {
      console.warn('Failed to get cache stats:', error);
      return { connected: this.isConnected };
    }
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
        return 2 * 60 * 60 * 1000; // 2 hours
      case CacheTTL.EXTENDED:
        return 24 * 60 * 60 * 1000; // 24 hours
      default:
        return 30 * 60 * 1000; // Default to medium
    }
  }

  /**
   * Extract key count from Redis INFO command output
   */
  private extractKeyCount(infoOutput: string): number {
    const match = infoOutput.match(/db0:keys=(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Extract memory usage from Redis INFO command output
   */
  private extractMemoryUsage(infoOutput: string): number {
    const match = infoOutput.match(/used_memory:(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Get the underlying Redis client (for advanced operations)
   */
  getClient(): RedisClientType | null {
    return this.client;
  }

  /**
   * Get configuration
   */
  getConfig(): RedisConfig {
    return { ...this.config };
  }
}

// Export singleton instance for global use
let redisClient: RedisCacheClient | null = null;

/**
 * Get or create Redis cache client instance
 */
export async function getRedisClient(config?: RedisConfig): Promise<RedisCacheClient | null> {
  if (redisClient && redisClient.isHealthy()) {
    return redisClient;
  }

  if (!config) {
    console.warn('No Redis configuration provided');
    return null;
  }

  try {
    redisClient = new RedisCacheClient(config);
    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('Failed to initialize Redis client:', error);
    return null;
  }
}

/**
 * Close Redis client connection
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.disconnect();
    redisClient = null;
  }
}
