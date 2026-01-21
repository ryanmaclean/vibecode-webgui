/**
 * Optimized Database Queries Module
 *
 * Provides N+1 query prevention, batch operations, query caching,
 * and index recommendations for database operations.
 *
 * TypeScript strict mode compliant.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { cacheGet, cacheSet, cacheDelete, CacheKeyGenerators, TTLPresets } from '../cache/cache-utils';
import { metrics } from '../server-monitoring';
import {
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  clampLimit,
} from '@/lib/api/pagination';

// Type definitions for batch operations
interface BatchQueryOptions<K, T> {
  /** Maximum batch size for queries */
  batchSize?: number;
  /** Cache TTL in seconds */
  cacheTTL?: number;
  /** Enable metrics tracking */
  trackMetrics?: boolean;
  /** Custom cache key prefix */
  cachePrefix?: string;
  /** Number of retry attempts for failed batch queries (default: 0) */
  retryCount?: number;
  /** Callback invoked when an error occurs during batch execution */
  onError?: (error: Error, keys: K[]) => void;
}

/**
 * Error class for batch query failures with context
 */
export class BatchQueryError extends Error {
  public readonly keys: unknown[];
  public readonly originalError: Error;
  public readonly operation: string;
  public readonly attemptNumber: number;

  constructor(
    message: string,
    keys: unknown[],
    originalError: Error,
    operation: string,
    attemptNumber: number = 1
  ) {
    super(message);
    this.name = 'BatchQueryError';
    this.keys = keys;
    this.originalError = originalError;
    this.operation = operation;
    this.attemptNumber = attemptNumber;
  }
}

/**
 * Resolver type that can either resolve a value or reject with an error
 */
interface BatchResolver<V> {
  resolve: (value: V | null) => void;
  reject: (error: Error) => void;
}

/**
 * Cached entry with expiration tracking for time-based cache invalidation
 */
interface CachedEntry<V> {
  value: V;
  expiresAt: number;
}

interface QueryMetrics {
  queryTime: number;
  cacheHit: boolean;
  batchSize: number;
  operation: string;
}

interface IndexRecommendation {
  table: string;
  columns: string[];
  reason: string;
  priority: 'high' | 'medium' | 'low';
  estimatedImprovement: string;
}

/**
 * DataLoader-style batch loader for preventing N+1 queries
 * Groups individual queries into efficient batch queries
 *
 * Enhanced error handling features:
 * - Configurable retry logic with retryCount option
 * - Detailed error context with BatchQueryError
 * - Per-key error tracking within batches
 * - Custom error callback via onError option
 * - Proper promise rejection instead of resolving to null
 */
export class BatchLoader<K, V> {
  private batch: Map<K, BatchResolver<V>[]> = new Map();
  private cache: Map<K, CachedEntry<V>> = new Map();
  private batchScheduled = false;
  private cacheCleanupTimer: ReturnType<typeof setInterval> | null = null;
  private readonly batchFn: (keys: K[]) => Promise<Map<K, V>>;
  private readonly options: Required<Omit<BatchQueryOptions<K, V>, 'onError'>> & { onError?: (error: Error, keys: K[]) => void };

  constructor(
    batchFn: (keys: K[]) => Promise<Map<K, V>>,
    options: BatchQueryOptions<K, V> = {}
  ) {
    this.batchFn = batchFn;
    this.options = {
      batchSize: options.batchSize ?? 100,
      cacheTTL: options.cacheTTL ?? TTLPresets.SHORT,
      trackMetrics: options.trackMetrics ?? true,
      cachePrefix: options.cachePrefix ?? 'batch',
      retryCount: options.retryCount ?? 0,
      onError: options.onError,
    };

    // Start periodic cache cleanup if TTL is set
    if (this.options.cacheTTL > 0) {
      this.startCacheCleanup();
    }
  }

  /**
   * Start periodic cache cleanup to remove expired entries
   */
  private startCacheCleanup(): void {
    // Clean up at half the TTL interval, or every minute, whichever is smaller
    const cleanupInterval = Math.min(60000, (this.options.cacheTTL * 1000) / 2);

    if (typeof setInterval !== 'undefined') {
      this.cacheCleanupTimer = setInterval(() => {
        this.cleanupExpiredCache();
      }, cleanupInterval);
    }
  }

  /**
   * Remove expired entries from cache
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    const keysToDelete: K[] = [];
    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));

    if (this.options.trackMetrics && keysToDelete.length > 0) {
      metrics.increment('db.batch.cache_expired', {
        operation: this.options.cachePrefix,
        count: keysToDelete.length.toString(),
      });
    }
  }

  /**
   * Get a cached value if it exists and hasn't expired
   */
  private getCached(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set a value in the cache with TTL
   */
  private setCached(key: K, value: V): void {
    if (this.options.cacheTTL <= 0) {
      return;
    }

    const expiresAt = Date.now() + (this.options.cacheTTL * 1000);
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Load a single item - will be batched with other requests
   * Returns a promise that properly rejects on error (not resolving to null)
   */
  async load(key: K): Promise<V | null> {
    // Check cache first (with TTL expiration check)
    const cached = this.getCached(key);
    if (cached !== undefined) {
      if (this.options.trackMetrics) {
        metrics.increment('db.batch.cache_hit', {
          operation: this.options.cachePrefix,
        });
      }
      return cached;
    }

    if (this.options.trackMetrics) {
      metrics.increment('db.batch.cache_miss', {
        operation: this.options.cachePrefix,
      });
    }

    return new Promise((resolve, reject) => {
      const existing = this.batch.get(key);
      const resolver: BatchResolver<V> = { resolve, reject };

      if (existing) {
        existing.push(resolver);
      } else {
        this.batch.set(key, [resolver]);
      }

      if (!this.batchScheduled) {
        this.batchScheduled = true;
        // Use setImmediate/nextTick to batch within the same event loop tick
        if (typeof setImmediate !== 'undefined') {
          setImmediate(() => this.executeBatch());
        } else {
          Promise.resolve().then(() => this.executeBatch());
        }
      }
    });
  }

  /**
   * Load multiple items at once
   */
  async loadMany(keys: K[]): Promise<Array<V | null>> {
    return Promise.all(keys.map((key) => this.load(key)));
  }

  /**
   * Format keys for logging (handles various key types)
   */
  private formatKeysForLog(keys: K[]): string {
    if (keys.length === 0) return '[]';
    if (keys.length <= 10) {
      return JSON.stringify(keys);
    }
    const firstTen = keys.slice(0, 10).map(k => JSON.stringify(k)).join(', ');
    return `[${firstTen}... and ${keys.length - 10} more]`;
  }

  /**
   * Execute batch with retry logic
   */
  private async executeBatchWithRetry(
    keys: K[],
    currentBatch: Map<K, BatchResolver<V>[]>,
    attemptNumber: number = 1
  ): Promise<Map<K, V>> {
    const startTime = Date.now();
    const operation = this.options.cachePrefix ?? 'batch';

    try {
      const results = await this.batchFn(keys);

      // Track successful metrics
      if (this.options.trackMetrics) {
        const queryTime = Date.now() - startTime;
        metrics.histogram('db.batch.query_time', queryTime, {
          operation,
          batch_size: keys.length.toString(),
          attempt: attemptNumber.toString(),
        });
        metrics.increment('db.batch.queries', {
          operation,
          status: 'success',
        });
      }

      return results;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const keysFormatted = this.formatKeysForLog(keys);

      // Create detailed error with context
      const batchError = new BatchQueryError(
        `Batch query failed for operation '${operation}' on attempt ${attemptNumber}/${this.options.retryCount + 1}. Keys: ${keysFormatted}. Original error: ${err.message}`,
        keys as unknown[],
        err,
        operation,
        attemptNumber
      );

      // Log detailed error information
      console.error(`[BatchLoader] Batch query error:`, {
        operation,
        attemptNumber,
        maxAttempts: this.options.retryCount + 1,
        batchSize: keys.length,
        keys: keysFormatted,
        error: err.message,
        stack: err.stack,
      });

      // Track error metrics with detail
      if (this.options.trackMetrics) {
        metrics.increment('db.batch.errors', {
          operation,
          attempt: attemptNumber.toString(),
          error_type: err.name || 'UnknownError',
        });
        metrics.histogram('db.batch.error_time', Date.now() - startTime, {
          operation,
          attempt: attemptNumber.toString(),
        });
      }

      // Invoke custom error callback if provided
      if (this.options.onError) {
        try {
          this.options.onError(batchError, keys);
        } catch (callbackError) {
          console.error('[BatchLoader] Error in onError callback:', callbackError);
        }
      }

      // Retry if we have attempts remaining
      if (attemptNumber <= this.options.retryCount) {
        console.warn(`[BatchLoader] Retrying batch query (attempt ${attemptNumber + 1}/${this.options.retryCount + 1}) for operation '${operation}'`);

        // Exponential backoff: 100ms, 200ms, 400ms, etc.
        const backoffMs = Math.min(100 * Math.pow(2, attemptNumber - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, backoffMs));

        if (this.options.trackMetrics) {
          metrics.increment('db.batch.retries', {
            operation,
            attempt: (attemptNumber + 1).toString(),
          });
        }

        return this.executeBatchWithRetry(keys, currentBatch, attemptNumber + 1);
      }

      // All retries exhausted, throw the error
      throw batchError;
    }
  }

  /**
   * Execute the batched query with enhanced error handling
   */
  private async executeBatch(): Promise<void> {
    const currentBatch = new Map(this.batch);
    this.batch.clear();
    this.batchScheduled = false;

    if (currentBatch.size === 0) return;

    const keys = Array.from(currentBatch.keys());
    const operation = this.options.cachePrefix ?? 'batch';

    try {
      // Execute batch query with retry logic
      const results = await this.executeBatchWithRetry(keys, currentBatch);

      // Resolve all promises with results
      const entries = Array.from(currentBatch.entries());
      for (const [key, resolvers] of entries) {
        const value = results.get(key) ?? null;
        // Cache the result with TTL
        if (value !== null) {
          this.setCached(key, value);
        }
        resolvers.forEach(({ resolve }) => resolve(value));
      }

    } catch (error) {
      // All retries failed - reject all promises with the error
      const err = error instanceof BatchQueryError ? error :
        new BatchQueryError(
          `Batch query failed for operation '${operation}'`,
          keys as unknown[],
          error instanceof Error ? error : new Error(String(error)),
          operation
        );

      const batchEntries = Array.from(currentBatch.entries());
      for (const [key, resolvers] of batchEntries) {
        const keysFormatted = this.formatKeysForLog([key]);
        const keyError = new BatchQueryError(
          `Failed to load key ${keysFormatted} in batch operation '${operation}': ${err.message}`,
          [key] as unknown[],
          err.originalError,
          operation,
          err.attemptNumber
        );
        resolvers.forEach(({ reject }) => reject(keyError));
      }

      // Track final failure
      if (this.options.trackMetrics) {
        metrics.increment('db.batch.final_failures', {
          operation,
          batch_size: keys.length.toString(),
        });
      }
    }
  }

  /**
   * Clear a specific key from cache, or clear pending batch if no key provided
   * Use this when you know specific data has changed
   *
   * @param key Optional key to clear from cache. If not provided, clears pending batch only.
   */
  clear(key?: K): void {
    if (key !== undefined) {
      this.cache.delete(key);
      if (this.options.trackMetrics) {
        metrics.increment('db.batch.cache_invalidate', {
          operation: this.options.cachePrefix,
          scope: 'single',
        });
      }
    } else {
      this.batch.clear();
    }
  }

  /**
   * Clear multiple keys from cache
   * Use this when multiple related records have changed
   *
   * @param keys Array of keys to clear from cache
   */
  clearMany(keys: K[]): void {
    for (const key of keys) {
      this.cache.delete(key);
    }
    if (this.options.trackMetrics && keys.length > 0) {
      metrics.increment('db.batch.cache_invalidate', {
        operation: this.options.cachePrefix,
        scope: 'many',
        count: keys.length.toString(),
      });
    }
  }

  /**
   * Clear all cached values and pending batches
   * Use this when bulk data changes or for complete cache invalidation
   */
  clearAll(): void {
    this.batch.clear();
    this.cache.clear();
    if (this.options.trackMetrics) {
      metrics.increment('db.batch.cache_invalidate', {
        operation: this.options.cachePrefix,
        scope: 'all',
      });
    }
  }

  /**
   * Prime the cache with a known value
   * Use this to pre-populate cache after writes
   *
   * @param key Key to prime
   * @param value Value to cache
   */
  prime(key: K, value: V): void {
    this.setCached(key, value);
  }

  /**
   * Prime multiple values into cache
   * Use this after bulk operations to avoid cache misses
   *
   * @param entries Map of key-value pairs to prime
   */
  primeMany(entries: Map<K, V>): void {
    entries.forEach((value, key) => {
      this.setCached(key, value);
    });
  }

  /**
   * Get current cache size (useful for monitoring)
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Get current pending batch size (useful for monitoring)
   */
  getPendingSize(): number {
    return this.batch.size;
  }

  /**
   * Dispose of the loader and clean up resources
   * Call this when the loader is no longer needed
   */
  dispose(): void {
    this.batch.clear();
    this.cache.clear();
    if (this.cacheCleanupTimer) {
      clearInterval(this.cacheCleanupTimer);
      this.cacheCleanupTimer = null;
    }
  }
}

/**
 * Optimized query utilities for common database operations
 */
export class OptimizedQueries {
  private static prisma: PrismaClient | null = null;

  /**
   * Initialize with Prisma client
   */
  static initialize(prisma: PrismaClient): void {
    this.prisma = prisma;
  }

  /**
   * Get the Prisma client (throws if not initialized)
   */
  private static getPrisma(): PrismaClient {
    if (!this.prisma) {
      throw new Error('OptimizedQueries not initialized. Call initialize() first.');
    }
    return this.prisma;
  }

  // =====================================================
  // Batch Loaders for Common Entities
  // =====================================================

  /**
   * Batch loader for users by ID
   */
  static createUserLoader(): BatchLoader<number, Prisma.UserGetPayload<{}>> {
    return new BatchLoader(
      async (ids: number[]) => {
        const prisma = this.getPrisma();
        const users = await prisma.user.findMany({
          where: { id: { in: ids } },
        });
        return new Map(users.map((user) => [user.id, user]));
      },
      { cachePrefix: 'user_loader' }
    );
  }

  /**
   * Batch loader for workspaces by ID
   */
  static createWorkspaceLoader(): BatchLoader<number, Prisma.WorkspaceGetPayload<{}>> {
    return new BatchLoader(
      async (ids: number[]) => {
        const prisma = this.getPrisma();
        const workspaces = await prisma.workspace.findMany({
          where: { id: { in: ids } },
        });
        return new Map(workspaces.map((ws) => [ws.id, ws]));
      },
      { cachePrefix: 'workspace_loader' }
    );
  }

  /**
   * Batch loader for projects by ID
   */
  static createProjectLoader(): BatchLoader<number, Prisma.ProjectGetPayload<{}>> {
    return new BatchLoader(
      async (ids: number[]) => {
        const prisma = this.getPrisma();
        const projects = await prisma.project.findMany({
          where: { id: { in: ids } },
        });
        return new Map(projects.map((proj) => [proj.id, proj]));
      },
      { cachePrefix: 'project_loader' }
    );
  }

  /**
   * Batch loader for conversations by ID
   */
  static createConversationLoader(): BatchLoader<string, Prisma.ConversationGetPayload<{}>> {
    return new BatchLoader(
      async (ids: string[]) => {
        const prisma = this.getPrisma();
        const conversations = await prisma.conversation.findMany({
          where: { id: { in: ids } },
        });
        return new Map(conversations.map((conv) => [conv.id, conv]));
      },
      { cachePrefix: 'conversation_loader' }
    );
  }

  // =====================================================
  // Optimized Batch Operations
  // =====================================================

  /**
   * Batch fetch users with their related data
   * Prevents N+1 by loading relations in a single query
   */
  static async batchGetUsersWithRelations(
    userIds: number[],
    options: {
      includeWorkspaces?: boolean;
      includeProjects?: boolean;
      workspaceLimit?: number;
      projectLimit?: number;
    } = {}
  ): Promise<Map<number, Prisma.UserGetPayload<{ include: { workspaces: true; projects: true } }>>> {
    const prisma = this.getPrisma();
    const startTime = Date.now();

    const {
      includeWorkspaces = true,
      includeProjects = true,
    } = options;
    // Validate and cap limits to prevent resource exhaustion
    const workspaceLimit = clampLimit(options.workspaceLimit ?? 10, MAX_PAGE_SIZE.WORKSPACES, 10);
    const projectLimit = clampLimit(options.projectLimit ?? 10, MAX_PAGE_SIZE.PROJECTS, 10);

    // Build include clause based on options
    const include: Prisma.UserInclude = {};
    if (includeWorkspaces) {
      include.workspaces = {
        take: workspaceLimit,
        orderBy: { updated_at: 'desc' },
        where: { status: 'active' },
      };
    }
    if (includeProjects) {
      include.projects = {
        take: projectLimit,
        orderBy: { updated_at: 'desc' },
        where: { status: 'active' },
      };
    }

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      include,
    });

    metrics.histogram('db.optimized.batch_users', Date.now() - startTime, {
      user_count: userIds.length.toString(),
    });

    return new Map(users.map((user) => [user.id, user as Prisma.UserGetPayload<{ include: { workspaces: true; projects: true } }>]));
  }

  /**
   * Batch fetch conversations with messages
   * Uses pagination-aware loading to prevent memory issues
   */
  static async batchGetConversationsWithMessages(
    conversationIds: string[],
    options: {
      messageLimit?: number;
      includeUser?: boolean;
    } = {}
  ): Promise<Map<string, Prisma.ConversationGetPayload<{ include: { messages: true; user: true } }>>> {
    const prisma = this.getPrisma();
    const startTime = Date.now();

    const { includeUser = false } = options;
    // Validate and cap messageLimit to prevent resource exhaustion
    const messageLimit = clampLimit(options.messageLimit ?? 50, MAX_PAGE_SIZE.MESSAGES, 50);

    const conversations = await prisma.conversation.findMany({
      where: { id: { in: conversationIds } },
      include: {
        messages: {
          take: messageLimit,
          orderBy: { created_at: 'desc' },
        },
        ...(includeUser ? { user: { select: { id: true, name: true, email: true } } } : {}),
      },
    });

    metrics.histogram('db.optimized.batch_conversations', Date.now() - startTime, {
      conversation_count: conversationIds.length.toString(),
    });

    return new Map(conversations.map((conv) => [conv.id, conv as Prisma.ConversationGetPayload<{ include: { messages: true; user: true } }>]));
  }

  /**
   * Batch fetch workspace projects with file counts
   * Optimized alternative to loading projects one-by-one
   */
  static async batchGetWorkspaceProjects(
    workspaceIds: number[],
    options: {
      status?: string;
      limit?: number;
    } = {}
  ): Promise<Map<number, Array<Prisma.ProjectGetPayload<{ include: { _count: { select: { files: true } } } }>>>> {
    const prisma = this.getPrisma();
    const startTime = Date.now();

    const { status = 'active' } = options;
    // Validate and cap limit to prevent resource exhaustion
    const limit = clampLimit(options.limit ?? 20, MAX_PAGE_SIZE.PROJECTS, 20);

    const projects = await prisma.project.findMany({
      where: {
        workspace_id: { in: workspaceIds },
        status,
      },
      include: {
        _count: {
          select: { files: true },
        },
      },
      orderBy: { updated_at: 'desc' },
    });

    // Group projects by workspace_id
    const grouped = new Map<number, Array<Prisma.ProjectGetPayload<{ include: { _count: { select: { files: true } } } }>>>();

    for (const project of projects) {
      if (project.workspace_id !== null) {
        const existing = grouped.get(project.workspace_id) ?? [];
        if (existing.length < limit) {
          existing.push(project);
          grouped.set(project.workspace_id, existing);
        }
      }
    }

    // Ensure all requested workspace IDs have an entry
    for (const id of workspaceIds) {
      if (!grouped.has(id)) {
        grouped.set(id, []);
      }
    }

    metrics.histogram('db.optimized.batch_workspace_projects', Date.now() - startTime, {
      workspace_count: workspaceIds.length.toString(),
    });

    return grouped;
  }

  // =====================================================
  // Cached Query Wrappers
  // =====================================================

  /**
   * Get user with caching
   */
  static async getCachedUser(
    userId: number,
    options: { bypassCache?: boolean; ttl?: number } = {}
  ): Promise<Prisma.UserGetPayload<{}> | null> {
    const { bypassCache = false, ttl = TTLPresets.SHORT } = options;
    const cacheKey = CacheKeyGenerators.user(userId.toString());

    if (!bypassCache) {
      const cached = await cacheGet<Prisma.UserGetPayload<{}>>(cacheKey);
      if (cached) {
        metrics.increment('db.cache.hit', { entity: 'user' });
        return cached;
      }
      metrics.increment('db.cache.miss', { entity: 'user' });
    }

    const prisma = this.getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (user) {
      await cacheSet(cacheKey, user, { ttl });
    }

    return user;
  }

  /**
   * Get workspace with caching
   */
  static async getCachedWorkspace(
    workspaceId: number | string,
    options: { bypassCache?: boolean; ttl?: number } = {}
  ): Promise<Prisma.WorkspaceGetPayload<{}> | null> {
    const { bypassCache = false, ttl = TTLPresets.MEDIUM } = options;
    const cacheKey = CacheKeyGenerators.workspace(workspaceId.toString());

    if (!bypassCache) {
      const cached = await cacheGet<Prisma.WorkspaceGetPayload<{}>>(cacheKey);
      if (cached) {
        metrics.increment('db.cache.hit', { entity: 'workspace' });
        return cached;
      }
      metrics.increment('db.cache.miss', { entity: 'workspace' });
    }

    const prisma = this.getPrisma();
    const where: Prisma.WorkspaceWhereUniqueInput =
      typeof workspaceId === 'number'
        ? { id: workspaceId }
        : { workspace_id: workspaceId };

    const workspace = await prisma.workspace.findUnique({ where });

    if (workspace) {
      await cacheSet(cacheKey, workspace, { ttl });
    }

    return workspace;
  }

  /**
   * Get conversation with caching
   */
  static async getCachedConversation(
    conversationId: string,
    options: { bypassCache?: boolean; ttl?: number; includeMessages?: boolean; messageLimit?: number } = {}
  ): Promise<Prisma.ConversationGetPayload<{ include?: { messages: boolean } }> | null> {
    const { bypassCache = false, ttl = TTLPresets.SHORT, includeMessages = false, messageLimit = 50 } = options;
    const cacheKey = `conversation:${conversationId}:${includeMessages ? `msg${messageLimit}` : 'base'}`;

    if (!bypassCache) {
      const cached = await cacheGet<Prisma.ConversationGetPayload<{ include?: { messages: boolean } }>>(cacheKey);
      if (cached) {
        metrics.increment('db.cache.hit', { entity: 'conversation' });
        return cached;
      }
      metrics.increment('db.cache.miss', { entity: 'conversation' });
    }

    const prisma = this.getPrisma();
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: includeMessages
        ? {
            messages: {
              take: messageLimit,
              orderBy: { created_at: 'asc' },
            },
          }
        : undefined,
    });

    if (conversation) {
      await cacheSet(cacheKey, conversation, { ttl });
    }

    return conversation;
  }

  // =====================================================
  // Index Recommendation Engine
  // =====================================================

  /**
   * Get index recommendations based on common query patterns
   */
  static getIndexRecommendations(): IndexRecommendation[] {
    return [
      // Conversation queries
      {
        table: 'conversations',
        columns: ['user_id', 'status', 'updated_at'],
        reason: 'Frequently filtered by user_id and status, sorted by updated_at',
        priority: 'high',
        estimatedImprovement: '50-70% faster for user conversation lists',
      },
      {
        table: 'conversations',
        columns: ['workspace_id', 'status', 'updated_at'],
        reason: 'Workspace conversation listings with status filter',
        priority: 'high',
        estimatedImprovement: '40-60% faster for workspace dashboards',
      },

      // Message queries
      {
        table: 'messages',
        columns: ['conversation_id', 'created_at'],
        reason: 'Message retrieval is always by conversation ordered by time',
        priority: 'high',
        estimatedImprovement: '60-80% faster for message loading',
      },
      {
        table: 'messages',
        columns: ['conversation_id', 'role'],
        reason: 'Filtering messages by role within a conversation',
        priority: 'medium',
        estimatedImprovement: '30-50% faster for role-based message filtering',
      },

      // RAG chunks
      {
        table: 'rag_chunks',
        columns: ['workspace_id', 'project_id', 'file_id'],
        reason: 'RAG search scoped to workspace/project/file',
        priority: 'high',
        estimatedImprovement: '50-70% faster for scoped vector searches',
      },
      {
        table: 'rag_chunks',
        columns: ['file_id', 'chunk_index'],
        reason: 'Sequential chunk retrieval for file reconstruction',
        priority: 'medium',
        estimatedImprovement: '40-60% faster for file chunk loading',
      },

      // AI requests
      {
        table: 'ai_requests',
        columns: ['user_id', 'status', 'created_at'],
        reason: 'User request history with status filtering',
        priority: 'medium',
        estimatedImprovement: '30-50% faster for user AI request lists',
      },
      {
        table: 'ai_requests',
        columns: ['project_id', 'request_type', 'created_at'],
        reason: 'Project-scoped request analysis',
        priority: 'medium',
        estimatedImprovement: '30-50% faster for project AI usage analytics',
      },

      // Events
      {
        table: 'events',
        columns: ['user_id', 'event_type', 'created_at'],
        reason: 'User activity tracking queries',
        priority: 'low',
        estimatedImprovement: '20-40% faster for analytics queries',
      },

      // Agent memory
      {
        table: 'agent_memory',
        columns: ['agent_id', 'tier', 'accessed_at'],
        reason: 'Agent memory retrieval by tier with LRU ordering',
        priority: 'high',
        estimatedImprovement: '50-70% faster for agent memory lookups',
      },
    ];
  }

  /**
   * Generate SQL for recommended indexes
   */
  static generateIndexSQL(): string[] {
    const recommendations = this.getIndexRecommendations();
    return recommendations.map((rec) => {
      const indexName = `idx_${rec.table}_${rec.columns.join('_')}`;
      return `CREATE INDEX IF NOT EXISTS ${indexName} ON ${rec.table} (${rec.columns.join(', ')});`;
    });
  }

  // =====================================================
  // N+1 Query Detection
  // =====================================================

  private static queryLog: Array<{
    query: string;
    timestamp: number;
    model: string;
  }> = [];

  /**
   * Log a query for N+1 detection (called from Prisma middleware)
   */
  static logQuery(model: string, operation: string): void {
    const now = Date.now();
    const query = `${model}.${operation}`;

    // Keep only recent queries (last 100ms window)
    this.queryLog = this.queryLog.filter((q) => now - q.timestamp < 100);
    this.queryLog.push({ query, timestamp: now, model });
  }

  /**
   * Detect potential N+1 patterns
   */
  static detectN1Patterns(): Array<{
    pattern: string;
    count: number;
    suggestion: string;
  }> {
    const patterns: Array<{
      pattern: string;
      count: number;
      suggestion: string;
    }> = [];

    // Group queries by model
    const modelCounts = new Map<string, number>();
    for (const log of this.queryLog) {
      const count = modelCounts.get(log.model) ?? 0;
      modelCounts.set(log.model, count + 1);
    }

    // Check for N+1 patterns (same model queried many times in short window)
    const modelCountEntries = Array.from(modelCounts.entries());
    for (const [model, count] of modelCountEntries) {
      if (count > 3) {
        patterns.push({
          pattern: `${model} queried ${count} times in rapid succession`,
          count,
          suggestion: `Use batch loading or include relations: consider using BatchLoader for ${model}`,
        });
      }
    }

    return patterns;
  }

  /**
   * Clear query log
   */
  static clearQueryLog(): void {
    this.queryLog = [];
  }
}

/**
 * Query context for request-scoped batch loaders
 * Creates fresh loaders per request to prevent cross-request data leakage
 */
export class QueryContext {
  private userLoader: BatchLoader<number, Prisma.UserGetPayload<{}>>;
  private workspaceLoader: BatchLoader<number, Prisma.WorkspaceGetPayload<{}>>;
  private projectLoader: BatchLoader<number, Prisma.ProjectGetPayload<{}>>;
  private conversationLoader: BatchLoader<string, Prisma.ConversationGetPayload<{}>>;

  constructor() {
    this.userLoader = OptimizedQueries.createUserLoader();
    this.workspaceLoader = OptimizedQueries.createWorkspaceLoader();
    this.projectLoader = OptimizedQueries.createProjectLoader();
    this.conversationLoader = OptimizedQueries.createConversationLoader();
  }

  /**
   * Load user by ID (batched)
   */
  async loadUser(id: number): Promise<Prisma.UserGetPayload<{}> | null> {
    return this.userLoader.load(id);
  }

  /**
   * Load workspace by ID (batched)
   */
  async loadWorkspace(id: number): Promise<Prisma.WorkspaceGetPayload<{}> | null> {
    return this.workspaceLoader.load(id);
  }

  /**
   * Load project by ID (batched)
   */
  async loadProject(id: number): Promise<Prisma.ProjectGetPayload<{}> | null> {
    return this.projectLoader.load(id);
  }

  /**
   * Load conversation by ID (batched)
   */
  async loadConversation(id: string): Promise<Prisma.ConversationGetPayload<{}> | null> {
    return this.conversationLoader.load(id);
  }

  /**
   * Load multiple users (batched)
   */
  async loadUsers(ids: number[]): Promise<Array<Prisma.UserGetPayload<{}> | null>> {
    return this.userLoader.loadMany(ids);
  }

  /**
   * Load multiple workspaces (batched)
   */
  async loadWorkspaces(ids: number[]): Promise<Array<Prisma.WorkspaceGetPayload<{}> | null>> {
    return this.workspaceLoader.loadMany(ids);
  }

  /**
   * Load multiple projects (batched)
   */
  async loadProjects(ids: number[]): Promise<Array<Prisma.ProjectGetPayload<{}> | null>> {
    return this.projectLoader.loadMany(ids);
  }

  /**
   * Load multiple conversations (batched)
   */
  async loadConversations(ids: string[]): Promise<Array<Prisma.ConversationGetPayload<{}> | null>> {
    return this.conversationLoader.loadMany(ids);
  }

  /**
   * Clear pending batches for all loaders (call between requests)
   * Note: This does NOT clear caches - use clearAllCaches() for that
   */
  clear(): void {
    this.userLoader.clear();
    this.workspaceLoader.clear();
    this.projectLoader.clear();
    this.conversationLoader.clear();
  }

  /**
   * Clear all caches and pending batches
   * Use this when you need a complete reset
   */
  clearAllCaches(): void {
    this.userLoader.clearAll();
    this.workspaceLoader.clearAll();
    this.projectLoader.clearAll();
    this.conversationLoader.clearAll();
  }

  /**
   * Invalidate cache for a specific user
   */
  invalidateUser(id: number): void {
    this.userLoader.clear(id);
  }

  /**
   * Invalidate cache for specific users
   */
  invalidateUsers(ids: number[]): void {
    this.userLoader.clearMany(ids);
  }

  /**
   * Invalidate cache for a specific workspace
   */
  invalidateWorkspace(id: number): void {
    this.workspaceLoader.clear(id);
  }

  /**
   * Invalidate cache for specific workspaces
   */
  invalidateWorkspaces(ids: number[]): void {
    this.workspaceLoader.clearMany(ids);
  }

  /**
   * Invalidate cache for a specific project
   */
  invalidateProject(id: number): void {
    this.projectLoader.clear(id);
  }

  /**
   * Invalidate cache for specific projects
   */
  invalidateProjects(ids: number[]): void {
    this.projectLoader.clearMany(ids);
  }

  /**
   * Invalidate cache for a specific conversation
   */
  invalidateConversation(id: string): void {
    this.conversationLoader.clear(id);
  }

  /**
   * Invalidate cache for specific conversations
   */
  invalidateConversations(ids: string[]): void {
    this.conversationLoader.clearMany(ids);
  }

  /**
   * Prime user cache with known value (use after creates/updates)
   */
  primeUser(id: number, user: Prisma.UserGetPayload<{}>): void {
    this.userLoader.prime(id, user);
  }

  /**
   * Prime workspace cache with known value (use after creates/updates)
   */
  primeWorkspace(id: number, workspace: Prisma.WorkspaceGetPayload<{}>): void {
    this.workspaceLoader.prime(id, workspace);
  }

  /**
   * Prime project cache with known value (use after creates/updates)
   */
  primeProject(id: number, project: Prisma.ProjectGetPayload<{}>): void {
    this.projectLoader.prime(id, project);
  }

  /**
   * Prime conversation cache with known value (use after creates/updates)
   */
  primeConversation(id: string, conversation: Prisma.ConversationGetPayload<{}>): void {
    this.conversationLoader.prime(id, conversation);
  }

  /**
   * Dispose of all loaders and clean up resources
   */
  dispose(): void {
    this.userLoader.dispose();
    this.workspaceLoader.dispose();
    this.projectLoader.dispose();
    this.conversationLoader.dispose();
  }
}

/**
 * Create a new query context for a request
 */
export function createQueryContext(): QueryContext {
  return new QueryContext();
}

// =====================================================
// Global Batch Loader Invalidation Helpers
// =====================================================

/**
 * Registry to track all active BatchLoader instances for global invalidation
 */
class BatchLoaderRegistry {
  private static loaders: Map<string, BatchLoader<unknown, unknown>> = new Map();

  /**
   * Register a loader for global invalidation
   */
  static register<K, V>(name: string, loader: BatchLoader<K, V>): void {
    this.loaders.set(name, loader as BatchLoader<unknown, unknown>);
  }

  /**
   * Unregister a loader
   */
  static unregister(name: string): void {
    this.loaders.delete(name);
  }

  /**
   * Get a registered loader
   */
  static get<K, V>(name: string): BatchLoader<K, V> | undefined {
    return this.loaders.get(name) as BatchLoader<K, V> | undefined;
  }

  /**
   * Clear all registered loaders' caches
   */
  static clearAll(): void {
    this.loaders.forEach((loader) => {
      loader.clearAll();
    });
  }

  /**
   * Dispose all registered loaders
   */
  static disposeAll(): void {
    this.loaders.forEach((loader) => {
      loader.dispose();
    });
    this.loaders.clear();
  }

  /**
   * Get all registered loader names
   */
  static getRegisteredNames(): string[] {
    return Array.from(this.loaders.keys());
  }
}

/**
 * BatchLoader invalidation helpers for use when data changes
 * These helpers work with registered loaders for application-wide cache invalidation
 */
export const BatchLoaderInvalidation = {
  /**
   * Register a loader for global invalidation
   */
  register<K, V>(name: string, loader: BatchLoader<K, V>): void {
    BatchLoaderRegistry.register(name, loader);
  },

  /**
   * Unregister a loader
   */
  unregister(name: string): void {
    BatchLoaderRegistry.unregister(name);
  },

  /**
   * Clear all registered loaders' caches
   * Use this for bulk data changes or deployment scenarios
   */
  clearAllLoaders(): void {
    BatchLoaderRegistry.clearAll();
    metrics.increment('db.batch.global_invalidate', { scope: 'all' });
  },

  /**
   * Dispose all registered loaders (cleanup)
   */
  disposeAllLoaders(): void {
    BatchLoaderRegistry.disposeAll();
  },

  /**
   * Get registered loader names (for monitoring/debugging)
   */
  getRegisteredLoaders(): string[] {
    return BatchLoaderRegistry.getRegisteredNames();
  },

  /**
   * Invalidate a specific loader by name
   */
  invalidateLoader(name: string): boolean {
    const loader = BatchLoaderRegistry.get(name);
    if (loader) {
      loader.clearAll();
      metrics.increment('db.batch.global_invalidate', { scope: 'loader', loader: name });
      return true;
    }
    return false;
  },

  /**
   * Invalidate a specific key in a named loader
   */
  invalidateKey<K>(loaderName: string, key: K): boolean {
    const loader = BatchLoaderRegistry.get<K, unknown>(loaderName);
    if (loader) {
      loader.clear(key);
      return true;
    }
    return false;
  },

  /**
   * Prime a value in a named loader (use after writes)
   */
  prime<K, V>(loaderName: string, key: K, value: V): boolean {
    const loader = BatchLoaderRegistry.get<K, V>(loaderName);
    if (loader) {
      loader.prime(key, value);
      return true;
    }
    return false;
  },
};

export { BatchLoaderRegistry };
export default OptimizedQueries;
