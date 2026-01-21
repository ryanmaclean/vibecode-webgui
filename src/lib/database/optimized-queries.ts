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

// Type definitions for batch operations
interface BatchQueryOptions<T> {
  /** Maximum batch size for queries */
  batchSize?: number;
  /** Cache TTL in seconds */
  cacheTTL?: number;
  /** Enable metrics tracking */
  trackMetrics?: boolean;
  /** Custom cache key prefix */
  cachePrefix?: string;
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
 */
export class BatchLoader<K, V> {
  private batch: Map<K, Array<(value: V | null) => void>> = new Map();
  private batchScheduled = false;
  private readonly batchFn: (keys: K[]) => Promise<Map<K, V>>;
  private readonly options: BatchQueryOptions<V>;

  constructor(
    batchFn: (keys: K[]) => Promise<Map<K, V>>,
    options: BatchQueryOptions<V> = {}
  ) {
    this.batchFn = batchFn;
    this.options = {
      batchSize: options.batchSize ?? 100,
      cacheTTL: options.cacheTTL ?? TTLPresets.SHORT,
      trackMetrics: options.trackMetrics ?? true,
      cachePrefix: options.cachePrefix ?? 'batch',
    };
  }

  /**
   * Load a single item - will be batched with other requests
   */
  async load(key: K): Promise<V | null> {
    return new Promise((resolve) => {
      const existing = this.batch.get(key);
      if (existing) {
        existing.push(resolve);
      } else {
        this.batch.set(key, [resolve]);
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
   * Execute the batched query
   */
  private async executeBatch(): Promise<void> {
    const currentBatch = new Map(this.batch);
    this.batch.clear();
    this.batchScheduled = false;

    if (currentBatch.size === 0) return;

    const keys = Array.from(currentBatch.keys());
    const startTime = Date.now();

    try {
      // Execute batch query
      const results = await this.batchFn(keys);

      // Resolve all promises
      const entries = Array.from(currentBatch.entries());
      for (const [key, resolvers] of entries) {
        const value = results.get(key) ?? null;
        resolvers.forEach((resolve) => resolve(value));
      }

      // Track metrics
      if (this.options.trackMetrics) {
        const queryTime = Date.now() - startTime;
        metrics.histogram('db.batch.query_time', queryTime, {
          operation: this.options.cachePrefix ?? 'batch',
          batch_size: keys.length.toString(),
        });
        metrics.increment('db.batch.queries', {
          operation: this.options.cachePrefix ?? 'batch',
        });
      }
    } catch (error) {
      // Reject all promises on error
      const batchEntries = Array.from(currentBatch.entries());
      for (const [, resolvers] of batchEntries) {
        resolvers.forEach((resolve) => resolve(null));
      }

      if (this.options.trackMetrics) {
        metrics.increment('db.batch.errors', {
          operation: this.options.cachePrefix ?? 'batch',
        });
      }

      throw error;
    }
  }

  /**
   * Clear the loader (useful between requests)
   */
  clear(): void {
    this.batch.clear();
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
      workspaceLimit = 10,
      projectLimit = 10,
    } = options;

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

    const { messageLimit = 50, includeUser = false } = options;

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

    const { status = 'active', limit = 20 } = options;

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
   * Clear all loaders (call between requests)
   */
  clear(): void {
    this.userLoader.clear();
    this.workspaceLoader.clear();
    this.projectLoader.clear();
    this.conversationLoader.clear();
  }
}

/**
 * Create a new query context for a request
 */
export function createQueryContext(): QueryContext {
  return new QueryContext();
}

export default OptimizedQueries;
