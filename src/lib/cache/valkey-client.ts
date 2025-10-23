/**
 * Valkey Client for Caching
 * Provides Valkey-based caching functionality as Redis-compatible alternative
 */

import { createClient, RedisClientType } from 'redis';
import { logger } from '@/lib/logger';
export interface ValkeyConfig {
  host: string;
  port: number;
  password?: string;
  database?: number;
  keyPrefix?: string;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
  type?: 'standard' | 'cluster' | 'sentinel';
  url?: string;
}

/**
 * Valkey-based cache client (Redis-compatible)
 */
export class ValkeyCacheClient {
  private client: RedisClientType | null = null;
  private config: ValkeyConfig;
  private isConnected = false;

  constructor(config: ValkeyConfig) {
    this.config = {
      keyPrefix: 'vibecode:',
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      type: 'standard',
      ...config
    };
  }

  /**
   * Initialize Valkey connection
   */
  async connect(): Promise<void> {
    try {
      let clientOptions: any = {
        socket: {
          host: this.config.host,
          port: this.config.port,
        },
        password: this.config.password,
        database: this.config.database || 0,
        keyPrefix: this.config.keyPrefix,
        retry_strategy: (options: any) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.error('Valkey server connection refused');
            return new Error('Valkey server connection refused');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            logger.error('Valkey retry time exhausted');
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 10) {
            logger.error('Valkey max retry attempts exceeded');
            return new Error('Max retry attempts exceeded');
          }
          return Math.min(options.attempt * 100, 3000);
        }
      };

      // Handle URL-based configuration
      if (this.config.url) {
        clientOptions = {
          url: this.config.url,
          retry_strategy: clientOptions.retry_strategy
        };
      }

      this.client = createClient(clientOptions);

      // Event listeners for monitoring
      this.client.on('connect', () => {
        logger.info('Valkey client connected');
        this.isConnected = true;
      });

      this.client.on('error', (error: Error) => {
        logger.error('Valkey client error:', error);
        this.isConnected = false;
      });

      this.client.on('ready', () => {
        logger.info('Valkey client ready');
        this.isConnected = true;
      });

      this.client.on('end', () => {
        logger.info('Valkey client connection ended');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      logger.warn('Valkey client initialization failed:', error);
      this.client = null;
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Close Valkey connection
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Check if Valkey is connected
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

      const parsed = JSON.parse(value);
      const now = Date.now();

      // Check if entry has expired (assuming TTL format)
      if (parsed.expiry && now > parsed.expiry) {
        await this.client.del(key);
        return null;
      }

      return parsed.value || parsed;
    } catch (error) {
      logger.warn(`Failed to get Valkey key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set<T>(
    key: string,
    value: T,
    ttlSeconds?: number
  ): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const data = {
        value,
        expiry: ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null,
        createdAt: Date.now()
      };

      const serialized = JSON.stringify(data);

      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }

      return true;
    } catch (error) {
      logger.warn(`Failed to set Valkey key ${key}:`, error);
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
      logger.warn(`Failed to delete Valkey key ${key}:`, error);
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
      logger.warn(`Failed to delete Valkey keys:`, error);
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
      logger.warn(`Failed to check Valkey key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set multiple key-value pairs
   */
  async setMany(pairs: Array<{ key: string; value: any; ttl?: number }>): Promise<boolean> {
    if (!this.client || !this.isConnected || pairs.length === 0) {
      return false;
    }

    try {
      const pipeline = this.client.multi();

      for (const { key, value, ttl } of pairs) {
        const data = {
          value,
          expiry: ttl ? Date.now() + (ttl * 1000) : null,
          createdAt: Date.now()
        };

        const serialized = JSON.stringify(data);

        if (ttl) {
          pipeline.setEx(key, ttl, serialized);
        } else {
          pipeline.set(key, serialized);
        }
      }

      await pipeline.exec();
      return true;
    } catch (error) {
      logger.warn('Failed to set multiple Valkey entries:', error);
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
          const parsed = JSON.parse(value);

          // Handle both old format (direct value) and new format (with expiry)
          if (parsed.expiry && now > parsed.expiry) {
            return null;
          }

          return parsed.value || parsed;
        } catch (parseError) {
          logger.warn('Failed to parse cached value:', parseError);
          return null;
        }
      });
    } catch (error) {
      logger.warn('Failed to get multiple Valkey entries:', error);
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
      logger.warn(`Failed to increment Valkey key ${key}:`, error);
      return null;
    }
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
      logger.warn('Failed to clear Valkey cache:', error);
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
      logger.warn('Failed to get Valkey stats:', error);
      return { connected: this.isConnected };
    }
  }

  /**
   * Extract key count from Valkey INFO command output
   */
  private extractKeyCount(infoOutput: string): number {
    const match = infoOutput.match(/db0:keys=(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Extract memory usage from Valkey INFO command output
   */
  private extractMemoryUsage(infoOutput: string): number {
    const match = infoOutput.match(/used_memory:(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Get the underlying Valkey client
   */
  getClient(): RedisClientType | null {
    return this.client;
  }

  /**
   * Get configuration
   */
  getConfig(): ValkeyConfig {
    return { ...this.config };
  }
}

/**
 * Get Valkey configuration from environment
 */
export function getValkeyConfig(): ValkeyConfig & { type: string } {
  return {
    type: process.env.VALKEY_TYPE || 'standard',
    host: process.env.VALKEY_HOST || 'localhost',
    port: parseInt(process.env.VALKEY_PORT || '6379'),
    password: process.env.VALKEY_PASSWORD,
    database: process.env.VALKEY_DATABASE ? parseInt(process.env.VALKEY_DATABASE) : 0,
    keyPrefix: process.env.VALKEY_KEY_PREFIX || 'vibecode:',
    url: process.env.VALKEY_URL,
  };
}

// Export singleton instance for global use
let valkeyClient: ValkeyCacheClient | null = null;

/**
 * Get or create Valkey cache client instance
 */
export async function getValkeyClient(config?: ValkeyConfig): Promise<ValkeyCacheClient | null> {
  if (valkeyClient && valkeyClient.isHealthy()) {
    return valkeyClient;
  }

  const finalConfig = config || getValkeyConfig();

  try {
    valkeyClient = new ValkeyCacheClient(finalConfig);
    await valkeyClient.connect();
    return valkeyClient;
  } catch (error) {
    logger.error('Failed to initialize Valkey client:', error);
    return null;
  }
}

/**
 * Close Valkey client connection
 */
export async function closeValkeyClient(): Promise<void> {
  if (valkeyClient) {
    await valkeyClient.disconnect();
    valkeyClient = null;
  }
}

// Cache keys and TTL constants for performance metrics
export const CacheKeys = {
  PERFORMANCE_METRICS: 'performance:metrics',
  AGENT_HEALTH: 'agent:health',
  CONVERSATION_CONTEXT: 'conversation:context',
  SESSION_DATA: 'session:data'
} as const;

export const CacheTTL = {
  SHORT: 300,     // 5 minutes
  MEDIUM: 1800,   // 30 minutes  
  LONG: 3600,     // 1 hour
  EXTENDED: 7200  // 2 hours
} as const;

// Default cache instance
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const client = await getValkeyClient();
    return client ? client.get<T>(key) : null;
  },
  
  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    const client = await getValkeyClient();
    return client ? client.set(key, value, ttl) : false;
  },
  
  async delete(key: string): Promise<boolean> {
    const client = await getValkeyClient();
    return client ? client.delete(key) : false;
  },
  
  async exists(key: string): Promise<boolean> {
    const client = await getValkeyClient();
    return client ? client.exists(key) : false;
  }
};
