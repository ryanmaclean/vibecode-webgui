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

import { Redis } from 'ioredis';
import { metrics } from '../server-monitoring';
// import { logger } from '@/lib/logger';

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
      valkeyClient = new Redis(connectionConfig.url, {
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30_000,
        family: 4,
        commandTimeout: 5_000,
        connectTimeout: 10_000,
      });
    } else {
      valkeyClient = new Redis({
        host: connectionConfig.host,
        port: connectionConfig.port,
        password: connectionConfig.password,
        db: connectionConfig.db,
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30_000,
        family: 4,
        commandTimeout: 5_000,
        connectTimeout: 10_000,
      });
    }

    valkeyClient.on('connect', () => {
      console.log('Valkey connected successfully');
      metrics.increment('valkey.connection.success');
    });

    valkeyClient.on('error', (error) => {
      console.error('Valkey connection error', { error });
      metrics.increment('valkey.connection.error');
    });

    valkeyClient.on('ready', () => {
      console.log('Valkey client ready');
      metrics.increment('valkey.ready');
    });
  } else if (connectionConfig.type === 'upstash') {
    // Upstash exposes an HTTP API; callers should use dedicated clients.
    console.warn('Upstash Valkey configuration detected but HTTP client is not yet implemented.');
  }
} catch (error) {
  console.warn('Valkey client initialization failed', { error });
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
      const value = await this.client.get(key);
      metrics.histogram('cache.get.duration', Date.now() - start);

      if (!value) {
        metrics.increment('cache.miss');
        return null;
      }

      metrics.increment('cache.hit');
      return JSON.parse(value) as T;
    } catch (error) {
      metrics.increment('cache.error');
      console.error('Valkey get error', { key, error });
      return null;
    }
  }

  async set(key: string, value: unknown, ttl: number = CacheTTL.MEDIUM): Promise<boolean> {
    if (!this.client) return false;

    const start = Date.now();
    try {
      await this.client.setex(key, ttl, JSON.stringify(value));
      metrics.histogram('cache.set.duration', Date.now() - start);
      metrics.increment('cache.set.success');
      return true;
    } catch (error) {
      metrics.increment('cache.set.error');
      console.error('Valkey set error', { key, error });
      return false;
    }
  }

  async del(key: string | string[]): Promise<boolean> {
    if (!this.client) return false;

    const keys = Array.isArray(key) ? key : [key];
    try {
      await this.client.del(...keys);
      metrics.increment('cache.delete', { count: keys.length });
      return true;
    } catch (error) {
      metrics.increment('cache.delete.error');
      console.error('Valkey delete error', { keys, error });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      return (await this.client.exists(key)) === 1;
    } catch (error) {
      console.error('Valkey exists error', { key, error });
      return false;
    }
  }

  async mget<T = unknown>(keys: string[]): Promise<(T | null)[]> {
    if (!this.client || keys.length === 0) return [];

    try {
      const values = await this.client.mget(...keys);
      return values.map((value) => (value ? (JSON.parse(value) as T) : null));
    } catch (error) {
      console.error('Valkey mget error', { keys, error });
      return keys.map(() => null);
    }
  }

  async mset(pairs: Array<{ key: string; value: unknown; ttl?: number }>): Promise<boolean> {
    if (!this.client || pairs.length === 0) return false;

    try {
      const pipeline = this.client.pipeline();
      pairs.forEach(({ key, value, ttl = CacheTTL.MEDIUM }) => {
        pipeline.setex(key, ttl, JSON.stringify(value));
      });
      await pipeline.exec();
      metrics.increment('cache.mset.success', { count: pairs.length });
      return true;
    } catch (error) {
      metrics.increment('cache.mset.error');
      console.error('Valkey mset error', { pairsCount: pairs.length, error });
      return false;
    }
  }

  async incr(key: string, ttl?: number): Promise<number> {
    if (!this.client) return 0;

    try {
      const value = await this.client.incr(key);
      if (ttl && value === 1) {
        await this.client.expire(key, ttl);
      }
      return value;
    } catch (error) {
      console.error('Valkey incr error', { key, error });
      return 0;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.client) return [];

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      console.error('Valkey keys error', { pattern, error });
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
      const info = await this.client.info('memory');
      const dbSize = await this.client.dbsize();
      const memoryMatch = info.match(/used_memory_human:(.+)/);

      return {
        connected: true,
        keyCount: dbSize,
        memoryUsage: memoryMatch ? memoryMatch[1].trim() : '0B',
        hitRate: 0.85, // Placeholder until real metrics are wired
      };
    } catch (error) {
      console.error('Valkey stats error', { error });
      return { connected: false, keyCount: 0, memoryUsage: '0B', hitRate: 0 };
    }
  }

  async clear(): Promise<boolean> {
    if (!this.client) return false;

    try {
      await this.client.flushdb();
      metrics.increment('cache.clear');
      return true;
    } catch (error) {
      console.error('Valkey clear error', { error });
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client) return false;

    try {
      await this.client.ping();
      return true;
    } catch (error) {
      console.warn('Valkey health check failed', { error });
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

export default cache;
