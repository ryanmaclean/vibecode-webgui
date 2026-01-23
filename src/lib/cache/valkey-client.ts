/**
 * Valkey Client Configuration with Performance Optimization
 *
 * IMPORTANT LICENSE COMPLIANCE:
 * This implementation uses Valkey (https://valkey.io/), the open-source fork of Redis
 * that maintains BSD licensing, avoiding Redis' restrictive RSAL/SSPL dual license.
 *
 * Valkey is Redis-compatible, so we use the MIT-licensed ioredis client while keeping all
 * functionality parity with Redis. This module exposes the shared cache surface (`cache`,
 * `CacheKeys`, `CacheTTL`) that the application expects.
 */

import { Redis, RedisOptions } from 'ioredis';
import { metrics } from '../server-monitoring';
// import { logger } from '@/lib/logger';

// Type extension for Redis commands to fix TS2339 errors
interface RedisCommands {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<'OK'>;
  del(...keys: string[]): Promise<number>;
  exists(...keys: string[]): Promise<number>;
  mget(...keys: string[]): Promise<(string | null)[]>;
  pipeline(): RedisPipeline;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  info(section?: string): Promise<string>;
  dbsize(): Promise<number>;
  flushdb(): Promise<'OK'>;
  ping(): Promise<string>;
}

interface RedisPipeline {
  setex(key: string, seconds: number, value: string): RedisPipeline;
  exec(): Promise<[Error | null, unknown][]>;
}

type EnhancedRedis = Redis & RedisCommands;

type StandardConfig = {
  type: 'standard';
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
};

type UpstashConfig = {
  type: 'upstash';
  url: string;
  token: string;
};

type ValkeyConnectionConfig = StandardConfig | UpstashConfig;

const getValkeyConfig = (): ValkeyConnectionConfig => {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return {
      type: 'upstash',
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    };
  }

  if (process.env.VALKEY_URL || process.env.REDIS_URL) {
    return {
      type: 'standard',
      url: process.env.VALKEY_URL || process.env.REDIS_URL,
    };
  }

  return {
    type: 'standard',
    host: process.env.VALKEY_HOST || process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.VALKEY_PORT || process.env.REDIS_PORT || '6379', 10),
    password: process.env.VALKEY_PASSWORD || process.env.REDIS_PASSWORD,
    db: parseInt(process.env.VALKEY_DB || process.env.REDIS_DB || '0', 10),
  };
};

const connectionConfig = getValkeyConfig();

let valkeyClient: Redis | null = null;

try {
  if (connectionConfig.type === 'standard') {
    if (connectionConfig.url) {
      valkeyClient = new Redis(connectionConfig.url);
    } else {
      // Build Redis options object from standard config with defaults
      // Type assertion needed due to ioredis overload resolution issues
      const redisOptions: RedisOptions = {
        host: connectionConfig.host ?? 'localhost',
        port: connectionConfig.port ?? 6379,
        ...(connectionConfig.password && { password: connectionConfig.password }),
        ...(connectionConfig.db !== undefined && { db: connectionConfig.db })
      };
      valkeyClient = new Redis(redisOptions as unknown as string);
    }

    valkeyClient.on('connect', () => {
      metrics.increment('valkey.connection.success');
    });

    valkeyClient.on('error', () => {
      metrics.increment('valkey.connection.error');
    });

    valkeyClient.on('ready', () => {
      metrics.increment('valkey.ready');
    });
  } else if (connectionConfig.type === 'upstash') {
    // Upstash exposes an HTTP API; callers should use dedicated clients.
    // Not yet implemented
  }
} catch {
  valkeyClient = null;
}

export const CacheKeys = {
  user: (userId: string) => `user:${userId}`,
  workspace: (workspaceId: string) => `workspace:${workspaceId}`,
  project: (projectId: string) => `project:${projectId}`,
  aiResponse: (hash: string) => `ai:response:${hash}`,
  vectorSearch: (query: string, workspaceId?: string) =>
    `vector:search:${Buffer.from(`${query}${workspaceId ?? ''}`).toString('base64')}`,
  fileContent: (fileId: string) => `file:content:${fileId}`,
  embeddings: (contentHash: string) => `embeddings:${contentHash}`,
  rateLimit: (identifier: string) => `ratelimit:${identifier}`,
  session: (sessionId: string) => `session:${sessionId}`,
  apiMetrics: (endpoint: string, timeWindow: string) => `metrics:${endpoint}:${timeWindow}`,
} as const;

export const CacheTTL = {
  SHORT: 60,
  MEDIUM: 300,
  LONG: 1_800,
  HOUR: 3_600,
  DAY: 86_400,
  WEEK: 604_800,
  EMBEDDINGS: 2_592_000,
} as const;

export class ValkeyManager {
  private readonly client: Redis | null;

  constructor() {
    this.client = valkeyClient;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    if (!this.client) return null;

    const start = Date.now();
    try {
      const value = await (this.client as EnhancedRedis).get(key);
      metrics.histogram('cache.get.duration', Date.now() - start);

      if (!value) {
        metrics.increment('cache.miss');
        return null;
      }

      metrics.increment('cache.hit');
      return JSON.parse(value) as T;
    } catch {
      metrics.increment('cache.error');
      return null;
    }
  }

  async set(key: string, value: unknown, ttl: number = CacheTTL.MEDIUM): Promise<boolean> {
    if (!this.client) return false;

    const start = Date.now();
    try {
      await (this.client as EnhancedRedis).setex(key, ttl, JSON.stringify(value));
      metrics.histogram('cache.set.duration', Date.now() - start);
      metrics.increment('cache.set.success');
      return true;
    } catch {
      metrics.increment('cache.set.error');
      return false;
    }
  }

  async del(key: string | string[]): Promise<boolean> {
    if (!this.client) return false;

    const keys = Array.isArray(key) ? key : [key];
    try {
      await (this.client as EnhancedRedis).del(...keys);
      metrics.increment('cache.delete', { count: keys.length.toString() });
      return true;
    } catch {
      metrics.increment('cache.delete.error');
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      return (await (this.client as EnhancedRedis).exists(key)) === 1;
    } catch {
      return false;
    }
  }

  async mget<T = unknown>(keys: string[]): Promise<(T | null)[]> {
    if (!this.client || keys.length === 0) return [];

    try {
      const values = await (this.client as EnhancedRedis).mget(...keys);
      return values.map((value: string | null) => (value ? (JSON.parse(value) as T) : null));
    } catch {
      return keys.map(() => null);
    }
  }

  async mset(pairs: Array<{ key: string; value: unknown; ttl?: number }>): Promise<boolean> {
    if (!this.client || pairs.length === 0) return false;

    try {
      const pipeline = (this.client as EnhancedRedis).pipeline();
      pairs.forEach(({ key, value, ttl = CacheTTL.MEDIUM }) => {
        pipeline.setex(key, ttl, JSON.stringify(value));
      });
      await pipeline.exec();
      metrics.increment('cache.mset.success', { count: pairs.length.toString() });
      return true;
    } catch {
      metrics.increment('cache.mset.error');
      return false;
    }
  }

  async incr(key: string, ttl?: number): Promise<number> {
    if (!this.client) return 0;

    try {
      const value = await (this.client as EnhancedRedis).incr(key);
      if (ttl && value === 1) {
        await (this.client as EnhancedRedis).expire(key, ttl);
      }
      return value;
    } catch {
      return 0;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.client) return [];

    try {
      return await (this.client as EnhancedRedis).keys(pattern);
    } catch {
      return [];
    }
  }

  async getStats(): Promise<{
    connected: boolean;
    keyCount: number;
    memoryUsage: string;
    hitRate: number;
  }> {
    if (!this.client) {
      return { connected: false, keyCount: 0, memoryUsage: '0B', hitRate: 0 };
    }

    try {
      const info = await (this.client as EnhancedRedis).info('memory');
      const dbSize = await (this.client as EnhancedRedis).dbsize();
      const memoryMatch = info.match(/used_memory_human:(.+)/);

      return {
        connected: true,
        keyCount: dbSize,
        memoryUsage: memoryMatch ? memoryMatch[1].trim() : '0B',
        hitRate: 0.85, // Placeholder until real metrics are wired
      };
    } catch {
      return { connected: false, keyCount: 0, memoryUsage: '0B', hitRate: 0 };
    }
  }

  async clear(): Promise<boolean> {
    if (!this.client) return false;

    try {
      await (this.client as EnhancedRedis).flushdb();
      metrics.increment('cache.clear');
      return true;
    } catch {
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client) return false;

    try {
      await (this.client as EnhancedRedis).ping();
      return true;
    } catch {
      return false;
    }
  }
}

export const cache = new ValkeyManager();

export function withCache<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  keyGenerator: (...args: T) => string,
  ttl: number = CacheTTL.MEDIUM,
) {
  return async (...args: T): Promise<R> => {
    const key = keyGenerator(...args);
    const cached = await cache.get<R>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const result = await fn(...args);
    await cache.set(key, result, ttl);
    return result;
  };
}

export class CacheInvalidation {
  static async invalidateUser(userId: string): Promise<void> {
    const patterns = [
      CacheKeys.user(userId),
      `workspace:*:user:${userId}`,
      `project:*:user:${userId}`,
    ];

    for (const pattern of patterns) {
      const keys = await cache.keys(pattern);
      if (keys.length) {
        await cache.del(keys);
      }
    }
  }

  static async invalidateWorkspace(workspaceId: string): Promise<void> {
    const patterns = [
      CacheKeys.workspace(workspaceId),
      `project:*:workspace:${workspaceId}`,
      `vector:search:*:${workspaceId}`,
    ];

    for (const pattern of patterns) {
      const keys = await cache.keys(pattern);
      if (keys.length) {
        await cache.del(keys);
      }
    }
  }

  static async invalidateProject(projectId: string): Promise<void> {
    await cache.del(CacheKeys.project(projectId));
  }
}

// Export function for getting the Valkey client
export function getValkeyClient() {
  return cache;
}

export default cache;
