/**
 * Query Cache Strategy Module
 *
 * Provides intelligent caching strategies for database queries
 * with automatic invalidation, TTL management, and cache warming.
 *
 * TypeScript strict mode compliant.
 */

import { cacheGet, cacheSet, cacheDelete, cacheDeletePattern, TTLPresets } from '../cache/cache-utils';
import { metrics } from '../server-monitoring';
import { BatchLoaderInvalidation } from './optimized-queries';

/**
 * Cache strategy types for different query patterns
 */
export enum CacheStrategy {
  /** No caching - always hit the database */
  NONE = 'none',
  /** Short-lived cache for frequently changing data */
  SHORT = 'short',
  /** Medium-lived cache for moderately stable data */
  MEDIUM = 'medium',
  /** Long-lived cache for stable data */
  LONG = 'long',
  /** Cache until explicit invalidation */
  UNTIL_INVALIDATED = 'until_invalidated',
  /** Stale-while-revalidate pattern */
  SWR = 'swr',
}

/**
 * Cache configuration for a specific query type
 */
interface QueryCacheConfig {
  /** Cache strategy to use */
  strategy: CacheStrategy;
  /** Custom TTL override in seconds */
  ttlOverride?: number;
  /** Tags for bulk invalidation */
  tags: string[];
  /** Whether to use stale data while revalidating */
  staleWhileRevalidate?: boolean;
  /** Maximum stale time in seconds */
  maxStaleTime?: number;
}

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttl: number;
  tags: string[];
  staleAfter?: number;
}

/**
 * Default cache configurations for common entity types
 */
export const ENTITY_CACHE_CONFIGS: Record<string, QueryCacheConfig> = {
  // User data - short cache as user actions are frequent
  user: {
    strategy: CacheStrategy.SHORT,
    tags: ['user'],
    staleWhileRevalidate: true,
    maxStaleTime: 60,
  },

  // Workspace data - medium cache, invalidated on updates
  workspace: {
    strategy: CacheStrategy.MEDIUM,
    tags: ['workspace'],
    staleWhileRevalidate: true,
    maxStaleTime: 120,
  },

  // Project data - medium cache
  project: {
    strategy: CacheStrategy.MEDIUM,
    tags: ['project', 'workspace'],
    staleWhileRevalidate: true,
    maxStaleTime: 120,
  },

  // Conversation data - short cache due to active nature
  conversation: {
    strategy: CacheStrategy.SHORT,
    tags: ['conversation'],
    staleWhileRevalidate: false,
  },

  // Message data - very short or no cache (real-time)
  message: {
    strategy: CacheStrategy.NONE,
    tags: ['message', 'conversation'],
  },

  // AI request data - long cache as it's historical
  aiRequest: {
    strategy: CacheStrategy.LONG,
    tags: ['ai_request'],
  },

  // File metadata - medium cache
  file: {
    strategy: CacheStrategy.MEDIUM,
    tags: ['file', 'workspace', 'project'],
  },

  // RAG chunks - long cache as content rarely changes
  ragChunk: {
    strategy: CacheStrategy.LONG,
    tags: ['rag', 'file'],
  },

  // Settings - long cache with invalidation on update
  setting: {
    strategy: CacheStrategy.UNTIL_INVALIDATED,
    tags: ['setting'],
    ttlOverride: TTLPresets.VERY_LONG,
  },

  // Session data - short cache
  session: {
    strategy: CacheStrategy.SHORT,
    tags: ['session', 'user'],
    ttlOverride: TTLPresets.SESSION,
  },

  // Agent memory - medium cache
  agentMemory: {
    strategy: CacheStrategy.MEDIUM,
    tags: ['agent', 'memory'],
  },
};

/**
 * Query cache manager with intelligent caching strategies
 */
export class QueryCacheManager {
  private static revalidationQueue: Set<string> = new Set();
  private static revalidationCallbacks: Map<string, () => Promise<unknown>> = new Map();

  /**
   * Get TTL for a cache strategy
   */
  private static getTTLForStrategy(strategy: CacheStrategy, override?: number): number {
    if (override !== undefined) {
      return override;
    }

    switch (strategy) {
      case CacheStrategy.NONE:
        return 0;
      case CacheStrategy.SHORT:
        return TTLPresets.SHORT; // 5 minutes
      case CacheStrategy.MEDIUM:
        return TTLPresets.MEDIUM; // 30 minutes
      case CacheStrategy.LONG:
        return TTLPresets.LONG; // 1 hour
      case CacheStrategy.UNTIL_INVALIDATED:
        return TTLPresets.VERY_LONG; // 24 hours
      case CacheStrategy.SWR:
        return TTLPresets.SHORT;
      default:
        return TTLPresets.MEDIUM;
    }
  }

  /**
   * Generate a cache key for a query
   */
  static generateCacheKey(
    entityType: string,
    operation: string,
    params: Record<string, unknown>
  ): string {
    const paramStr = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
      .join('|');

    const hash = Buffer.from(paramStr).toString('base64').slice(0, 32);
    return `query:${entityType}:${operation}:${hash}`;
  }

  /**
   * Get cached query result with strategy awareness
   */
  static async get<T>(
    entityType: string,
    cacheKey: string,
    options: {
      allowStale?: boolean;
      onStale?: () => Promise<T>;
    } = {}
  ): Promise<{ data: T | null; isStale: boolean }> {
    const config = ENTITY_CACHE_CONFIGS[entityType];
    if (!config || config.strategy === CacheStrategy.NONE) {
      return { data: null, isStale: false };
    }

    const startTime = Date.now();
    const entry = await cacheGet<CacheEntry<T>>(cacheKey);

    if (!entry) {
      metrics.increment('query.cache.miss', { entity: entityType });
      return { data: null, isStale: false };
    }

    const now = Date.now();
    const age = now - entry.cachedAt;
    const isExpired = age > entry.ttl * 1000;
    const isStale = entry.staleAfter !== undefined && age > entry.staleAfter * 1000;

    metrics.histogram('query.cache.age', age, { entity: entityType });

    // Check if completely expired
    if (isExpired && !options.allowStale) {
      metrics.increment('query.cache.expired', { entity: entityType });
      await cacheDelete(cacheKey);
      return { data: null, isStale: false };
    }

    // Stale-while-revalidate pattern
    if (isStale && config.staleWhileRevalidate && options.onStale) {
      // Return stale data immediately but trigger revalidation
      this.scheduleRevalidation(cacheKey, options.onStale);
      metrics.increment('query.cache.stale_hit', { entity: entityType });
      return { data: entry.data, isStale: true };
    }

    // Fresh cache hit
    metrics.increment('query.cache.hit', { entity: entityType });
    metrics.histogram('query.cache.get_time', Date.now() - startTime, { entity: entityType });

    return { data: entry.data, isStale: false };
  }

  /**
   * Set cached query result with strategy awareness
   */
  static async set<T>(
    entityType: string,
    cacheKey: string,
    data: T,
    customTTL?: number
  ): Promise<boolean> {
    const config = ENTITY_CACHE_CONFIGS[entityType];
    if (!config || config.strategy === CacheStrategy.NONE) {
      return false;
    }

    const ttl = this.getTTLForStrategy(config.strategy, customTTL ?? config.ttlOverride);
    const staleAfter = config.staleWhileRevalidate && config.maxStaleTime
      ? Math.floor(ttl * 0.7) // Consider stale at 70% of TTL
      : undefined;

    const entry: CacheEntry<T> = {
      data,
      cachedAt: Date.now(),
      ttl,
      tags: config.tags,
      staleAfter,
    };

    const success = await cacheSet(cacheKey, entry, { ttl });

    if (success) {
      metrics.increment('query.cache.set', { entity: entityType });
    }

    return success;
  }

  /**
   * Invalidate cache by entity type
   */
  static async invalidateByEntity(entityType: string): Promise<number> {
    const pattern = `query:${entityType}:*`;
    const deleted = await cacheDeletePattern(pattern);
    metrics.increment('query.cache.invalidate', { entity: entityType, count: deleted.toString() });
    return deleted;
  }

  /**
   * Invalidate cache by tag
   */
  static async invalidateByTag(tag: string): Promise<number> {
    // Find all entity types with this tag and invalidate them
    let totalDeleted = 0;

    for (const [entityType, config] of Object.entries(ENTITY_CACHE_CONFIGS)) {
      if (config.tags.includes(tag)) {
        const deleted = await this.invalidateByEntity(entityType);
        totalDeleted += deleted;
      }
    }

    metrics.increment('query.cache.tag_invalidate', { tag, count: totalDeleted.toString() });
    return totalDeleted;
  }

  /**
   * Invalidate cache by specific key
   */
  static async invalidateByKey(cacheKey: string): Promise<boolean> {
    const success = await cacheDelete(cacheKey);
    metrics.increment('query.cache.key_invalidate', { success: success.toString() });
    return success;
  }

  /**
   * Schedule background revalidation (stale-while-revalidate)
   */
  private static scheduleRevalidation<T>(
    cacheKey: string,
    revalidateFn: () => Promise<T>
  ): void {
    if (this.revalidationQueue.has(cacheKey)) {
      return; // Already scheduled
    }

    this.revalidationQueue.add(cacheKey);
    this.revalidationCallbacks.set(cacheKey, revalidateFn);

    // Execute revalidation asynchronously
    Promise.resolve().then(async () => {
      try {
        await revalidateFn();
        metrics.increment('query.cache.revalidate_success');
      } catch (error) {
        metrics.increment('query.cache.revalidate_error');
        console.error('Cache revalidation failed:', error);
      } finally {
        this.revalidationQueue.delete(cacheKey);
        this.revalidationCallbacks.delete(cacheKey);
      }
    });
  }

  /**
   * Get pending revalidation count (for monitoring)
   */
  static getPendingRevalidations(): number {
    return this.revalidationQueue.size;
  }

  /**
   * Execute a query with caching
   */
  static async executeWithCache<T>(
    entityType: string,
    operation: string,
    params: Record<string, unknown>,
    queryFn: () => Promise<T>,
    options: {
      customTTL?: number;
      bypassCache?: boolean;
    } = {}
  ): Promise<T> {
    const config = ENTITY_CACHE_CONFIGS[entityType];
    const cacheKey = this.generateCacheKey(entityType, operation, params);
    const startTime = Date.now();

    // Check if caching should be bypassed
    if (options.bypassCache || !config || config.strategy === CacheStrategy.NONE) {
      const result = await queryFn();
      metrics.histogram('query.db_time', Date.now() - startTime, { entity: entityType, cached: 'false' });
      return result;
    }

    // Try to get from cache
    const { data: cached, isStale } = await this.get<T>(entityType, cacheKey, {
      allowStale: config.staleWhileRevalidate,
      onStale: queryFn,
    });

    if (cached !== null) {
      metrics.histogram('query.time', Date.now() - startTime, { entity: entityType, cached: 'true', stale: isStale.toString() });
      return cached;
    }

    // Cache miss - execute query
    const result = await queryFn();
    const dbTime = Date.now() - startTime;

    // Cache the result
    await this.set(entityType, cacheKey, result, options.customTTL);

    metrics.histogram('query.db_time', dbTime, { entity: entityType, cached: 'false' });
    metrics.histogram('query.time', Date.now() - startTime, { entity: entityType, cached: 'false' });

    return result;
  }
}

/**
 * Cache invalidation helpers for common operations
 * Integrates both QueryCacheManager and BatchLoader invalidation
 */
export const CacheInvalidation = {
  /**
   * Invalidate all caches related to a user
   * Clears both query cache and BatchLoader cache
   */
  async onUserUpdate(userId: number): Promise<void> {
    // Invalidate query cache
    await QueryCacheManager.invalidateByTag('user');
    await cacheDeletePattern(`*user:${userId}*`);

    // Invalidate BatchLoader cache
    BatchLoaderInvalidation.invalidateKey('user_loader', userId);

    metrics.increment('cache.invalidation.user', { user_id: userId.toString() });
  },

  /**
   * Invalidate all caches related to a workspace
   * Clears both query cache and BatchLoader cache
   */
  async onWorkspaceUpdate(workspaceId: number): Promise<void> {
    // Invalidate query cache
    await QueryCacheManager.invalidateByTag('workspace');
    await cacheDeletePattern(`*workspace:${workspaceId}*`);

    // Invalidate BatchLoader cache
    BatchLoaderInvalidation.invalidateKey('workspace_loader', workspaceId);

    metrics.increment('cache.invalidation.workspace', { workspace_id: workspaceId.toString() });
  },

  /**
   * Invalidate all caches related to a project
   * Clears both query cache and BatchLoader cache
   */
  async onProjectUpdate(projectId: number): Promise<void> {
    // Invalidate query cache
    await QueryCacheManager.invalidateByTag('project');
    await cacheDeletePattern(`*project:${projectId}*`);

    // Invalidate BatchLoader cache
    BatchLoaderInvalidation.invalidateKey('project_loader', projectId);

    metrics.increment('cache.invalidation.project', { project_id: projectId.toString() });
  },

  /**
   * Invalidate all caches related to a conversation
   * Clears both query cache and BatchLoader cache
   */
  async onConversationUpdate(conversationId: string): Promise<void> {
    // Invalidate query cache
    await QueryCacheManager.invalidateByTag('conversation');
    await cacheDeletePattern(`*conversation:${conversationId}*`);

    // Invalidate BatchLoader cache
    BatchLoaderInvalidation.invalidateKey('conversation_loader', conversationId);

    metrics.increment('cache.invalidation.conversation', { conversation_id: conversationId });
  },

  /**
   * Invalidate all caches related to files
   */
  async onFileUpdate(fileId: number): Promise<void> {
    await QueryCacheManager.invalidateByTag('file');
    await cacheDeletePattern(`*file:${fileId}*`);

    metrics.increment('cache.invalidation.file', { file_id: fileId.toString() });
  },

  /**
   * Invalidate all caches related to RAG
   */
  async onRAGUpdate(workspaceId?: number): Promise<void> {
    await QueryCacheManager.invalidateByTag('rag');
    if (workspaceId) {
      await cacheDeletePattern(`*rag*workspace:${workspaceId}*`);
    }

    metrics.increment('cache.invalidation.rag', { workspace_id: workspaceId?.toString() ?? 'all' });
  },

  /**
   * Invalidate all query caches (nuclear option)
   * Also clears all registered BatchLoader caches
   */
  async invalidateAll(): Promise<void> {
    await cacheDeletePattern('query:*');
    BatchLoaderInvalidation.clearAllLoaders();

    metrics.increment('cache.invalidation.all');
  },

  /**
   * Invalidate multiple users at once
   */
  async onUsersUpdate(userIds: number[]): Promise<void> {
    await QueryCacheManager.invalidateByTag('user');
    for (const userId of userIds) {
      await cacheDeletePattern(`*user:${userId}*`);
      BatchLoaderInvalidation.invalidateKey('user_loader', userId);
    }

    metrics.increment('cache.invalidation.users_bulk', { count: userIds.length.toString() });
  },

  /**
   * Invalidate multiple workspaces at once
   */
  async onWorkspacesUpdate(workspaceIds: number[]): Promise<void> {
    await QueryCacheManager.invalidateByTag('workspace');
    for (const workspaceId of workspaceIds) {
      await cacheDeletePattern(`*workspace:${workspaceId}*`);
      BatchLoaderInvalidation.invalidateKey('workspace_loader', workspaceId);
    }

    metrics.increment('cache.invalidation.workspaces_bulk', { count: workspaceIds.length.toString() });
  },

  /**
   * Invalidate multiple projects at once
   */
  async onProjectsUpdate(projectIds: number[]): Promise<void> {
    await QueryCacheManager.invalidateByTag('project');
    for (const projectId of projectIds) {
      await cacheDeletePattern(`*project:${projectId}*`);
      BatchLoaderInvalidation.invalidateKey('project_loader', projectId);
    }

    metrics.increment('cache.invalidation.projects_bulk', { count: projectIds.length.toString() });
  },

  /**
   * Invalidate multiple conversations at once
   */
  async onConversationsUpdate(conversationIds: string[]): Promise<void> {
    await QueryCacheManager.invalidateByTag('conversation');
    for (const conversationId of conversationIds) {
      await cacheDeletePattern(`*conversation:${conversationId}*`);
      BatchLoaderInvalidation.invalidateKey('conversation_loader', conversationId);
    }

    metrics.increment('cache.invalidation.conversations_bulk', { count: conversationIds.length.toString() });
  },
};

/**
 * Decorator for caching method results
 */
export function CacheQuery(
  entityType: string,
  options: { customTTL?: number; keyGenerator?: (...args: unknown[]) => string } = {}
) {
  return function <T extends (...args: unknown[]) => Promise<unknown>>(
    _target: unknown,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ): TypedPropertyDescriptor<T> {
    const originalMethod = descriptor.value;

    if (!originalMethod) {
      return descriptor;
    }

    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
      const cacheKey = options.keyGenerator
        ? options.keyGenerator(...args)
        : QueryCacheManager.generateCacheKey(entityType, propertyKey, { args });

      return QueryCacheManager.executeWithCache(
        entityType,
        propertyKey,
        { args },
        () => originalMethod.apply(this, args) as Promise<unknown>,
        options
      );
    } as T;

    return descriptor;
  };
}

export default QueryCacheManager;
