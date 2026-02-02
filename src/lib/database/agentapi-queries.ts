/**
 * AgentAPI Database Query Layer
 *
 * Optimized PostgreSQL queries with:
 * - Connection pooling via Prisma
 * - Query performance <50ms P95
 * - Proper indexing utilization
 * - Batch operations for efficiency
 * - Query caching with automatic invalidation
 * - N+1 query prevention via batch loaders
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { agentSessionCache, agentHealthCache, conversationContextCache } from '../cache/agentapi-redis-strategy';
import { metrics as serverMetrics } from '../server-monitoring';
import { cacheGet, cacheSet, cacheDelete, CacheKeyGenerators, TTLPresets } from '../cache/cache-utils';
import { QueryCacheManager } from './query-cache-strategy';
// import { logger } from '@/lib/logger';

// Type definitions for models not yet in Prisma schema
// These allow the code to compile while the database schema is being developed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentModel = any;

// Type for health stats from raw query
interface HealthStatsResult {
  avg_cpu: number | null;
  max_cpu: number | null;
  avg_memory: number | null;
  max_memory: number | null;
  avg_latency: number | null;
  p95_latency: number | null;
  total_errors: number | null;
}

// Type for batch operation results
interface BatchResult {
  count: number;
}

// =====================================================
// Database Client Configuration
// =====================================================

// Load database URL from environment variable
// Note: loadSecret is async, so we use env directly for synchronous initialization
const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/placeholder';

const prismaBase = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: databaseUrl
    },
  },
});

// Cast to allow agent model references - these models are expected in the schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = prismaBase as any;

// Connection pool configuration (via DATABASE_URL connection string)
// Example: postgresql://user:pass@localhost:5432/vibecode?connection_limit=20&pool_timeout=10

// =====================================================
// Agent Session Queries
// =====================================================

export class AgentSessionQueries {
  /**
   * Create new agent session
   * Returns: Agent session with workspace/user metadata
   */
  static async createSession(data: {
    id: string;
    workspaceId: number;
    userId: number;
    agentType: string;
    agentConfig: object;
    agentapiUrl: string;
    agentapiPort?: number;
    environmentVars?: object;
    maxMemoryMb?: number;
    maxCpuCores?: number;
  }): Promise<AgentModel> {
    const startTime = Date.now();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = await prisma.$transaction(async (tx: any) => {
        // Check workspace agent limit (max 3 per workspace)
        const activeCount = await tx.agentSession.count({
          where: {
            workspaceId: data.workspaceId,
            status: { in: ['ready', 'active', 'idle'] },
            deletedAt: null,
          },
        });

        if (activeCount >= 3) {
          throw new Error('Maximum agents per workspace (3) reached');
        }

        // Create session
        return await tx.agentSession.create({
          data: {
            id: data.id,
            workspaceId: data.workspaceId,
            userId: data.userId,
            agentType: data.agentType,
            agentConfig: data.agentConfig as Prisma.InputJsonValue,
            status: 'initializing',
            agentapiUrl: data.agentapiUrl,
            agentapiPort: data.agentapiPort ?? 8766,
            environmentVars: (data.environmentVars ?? {}) as Prisma.InputJsonValue,
            maxMemoryMb: data.maxMemoryMb ?? 1024,
            maxCpuCores: data.maxCpuCores ?? 0.5,
          },
          include: {
            workspace: { select: { id: true, name: true } },
            user: { select: { id: true, email: true, name: true } },
          },
        });
      });

      // Cache session
      await agentSessionCache.cacheSession({
        id: session.id,
        workspaceId: session.workspaceId,
        userId: session.userId,
        agentType: session.agentType,
        status: session.status,
        agentapiUrl: session.agentapiUrl,
        agentapiPort: session.agentapiPort,
        lastActivityAt: session.lastActivityAt?.toISOString() ?? null,
        activeConnections: session.activeConnections,
      });

      const latency = Date.now() - startTime;
      serverMetrics.histogram('agent.session.create', latency);
      serverMetrics.increment('agent.session.created', { agent_type: data.agentType });

      return session;
    } catch (error) {
      serverMetrics.increment('agent.session.create.error');
      throw error;
    }
  }

  /**
   * Get agent session by ID (with cache)
   * Target: <50ms P95 latency
   */
  static async getSession(agentId: string): Promise<AgentModel | null> {
    const startTime = Date.now();

    try {
      // Try cache first
      const cached = await agentSessionCache.getSession(agentId);
      if (cached) {
        const latency = Date.now() - startTime;
        serverMetrics.histogram('agent.session.get.cached', latency);
        return cached;
      }

      // Cache miss - fetch from DB
      const session = await prisma.agentSession.findUnique({
        where: { id: agentId },
        include: {
          workspace: { select: { id: true, name: true, workspaceId: true } },
          user: { select: { id: true, email: true, name: true } },
        },
      });

      if (session) {
        // Cache for next time
        await agentSessionCache.cacheSession({
          id: session.id,
          workspaceId: session.workspaceId,
          userId: session.userId,
          agentType: session.agentType,
          status: session.status,
          agentapiUrl: session.agentapiUrl,
          agentapiPort: session.agentapiPort,
          lastActivityAt: session.lastActivityAt?.toISOString() ?? null,
          activeConnections: session.activeConnections,
        });
      }

      const latency = Date.now() - startTime;
      serverMetrics.histogram('agent.session.get.db', latency);

      return session;
    } catch (error) {
      serverMetrics.increment('agent.session.get.error');
      throw error;
    }
  }

  /**
   * List agents for workspace (with caching)
   */
  static async listWorkspaceAgents(workspaceId: number, includeDeleted = false): Promise<AgentModel[]> {
    const startTime = Date.now();
    const cacheKey = CacheKeyGenerators.dbQuery('agent_session', 'list', `ws:${workspaceId}:del:${includeDeleted}`);

    try {
      // Try cache first (only for non-deleted queries which are more common)
      if (!includeDeleted) {
        const cached = await cacheGet<AgentModel[]>(cacheKey);
        if (cached) {
          const latency = Date.now() - startTime;
          serverMetrics.histogram('agent.session.list_workspace.cached', latency);
          return cached;
        }
      }

      const agents = await prisma.agentSession.findMany({
        where: {
          workspaceId,
          ...(includeDeleted ? {} : { deletedAt: null }),
        },
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      });

      // Cache the result for non-deleted queries (2 minute TTL as agent status changes frequently)
      if (!includeDeleted && agents.length > 0) {
        await cacheSet(cacheKey, agents, { ttl: 120 }); // 2 minutes
      }

      const latency = Date.now() - startTime;
      serverMetrics.histogram('agent.session.list_workspace', latency);

      return agents;
    } catch (error) {
      serverMetrics.increment('agent.session.list.error');
      throw error;
    }
  }

  /**
   * Update agent status
   */
  static async updateStatus(
    agentId: string,
    status: string,
    options?: { startedAt?: Date; stoppedAt?: Date }
  ): Promise<AgentModel> {
    const startTime = Date.now();

    try {
      const session = await prisma.agentSession.update({
        where: { id: agentId },
        data: {
          status,
          ...(options?.startedAt && { startedAt: options.startedAt }),
          ...(options?.stoppedAt && { stoppedAt: options.stoppedAt }),
          lastActivityAt: new Date(),
        },
      });

      // Invalidate cache
      await agentSessionCache.invalidateSession(agentId);

      const latency = Date.now() - startTime;
      serverMetrics.histogram('agent.session.update_status', latency);
      serverMetrics.increment('agent.session.status_changed', { status });

      return session;
    } catch (error) {
      serverMetrics.increment('agent.session.update.error');
      throw error;
    }
  }

  /**
   * Soft delete agent session
   */
  static async deleteSession(agentId: string): Promise<void> {
    const startTime = Date.now();

    try {
      await prisma.$transaction([
        // Update session
        prisma.agentSession.update({
          where: { id: agentId },
          data: {
            status: 'deleted',
            deletedAt: new Date(),
            stoppedAt: new Date(),
          },
        }),

        // Log event
        prisma.agentEvent.create({
          data: {
            agentSessionId: agentId,
            eventType: 'session_deleted',
            eventCategory: 'lifecycle',
            eventSeverity: 'info',
            eventMessage: 'Agent session deleted',
          },
        }),
      ]);

      // Invalidate cache
      await agentSessionCache.invalidateSession(agentId);

      const latency = Date.now() - startTime;
      serverMetrics.histogram('agent.session.delete', latency);
      serverMetrics.increment('agent.session.deleted');
    } catch (error) {
      serverMetrics.increment('agent.session.delete.error');
      throw error;
    }
  }
}

// =====================================================
// Conversation Queries
// =====================================================

export class AgentConversationQueries {
  /**
   * Save message to conversation history
   */
  static async saveMessage(data: {
    agentSessionId: string;
    conversationId: string;
    direction: 'user_to_agent' | 'agent_to_user';
    role: 'user' | 'assistant' | 'system';
    content: string;
    contextFiles?: string[];
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
    modelUsed?: string;
  }): Promise<AgentModel> {
    const startTime = Date.now();

    try {
      const message = await prisma.agentConversation.create({
        data: {
          agentSessionId: data.agentSessionId,
          conversationId: data.conversationId,
          direction: data.direction,
          role: data.role,
          content: data.content,
          contextFiles: (data.contextFiles ?? []) as Prisma.InputJsonValue,
          inputTokens: data.inputTokens,
          outputTokens: data.outputTokens,
          totalTokens: (data.inputTokens ?? 0) + (data.outputTokens ?? 0),
          latencyMs: data.latencyMs,
          modelUsed: data.modelUsed,
          status: 'completed',
        },
      });

      // Update session last message timestamp
      await prisma.agentSession.update({
        where: { id: data.agentSessionId },
        data: {
          lastMessageAt: new Date(),
          lastActivityAt: new Date(),
        },
      });

      const dbLatency = Date.now() - startTime;
      serverMetrics.histogram('agent.conversation.save', dbLatency);
      serverMetrics.increment('agent.conversation.message_saved');

      return message;
    } catch (error) {
      serverMetrics.increment('agent.conversation.save.error');
      throw error;
    }
  }

  /**
   * Get conversation history (with cache)
   * Target: <100ms P95 for 50 messages
   */
  static async getHistory(
    agentSessionId: string,
    conversationId: string,
    limit = 50
  ): Promise<AgentModel[]> {
    const startTime = Date.now();

    try {
      // Try cache for recent context
      if (limit <= 10) {
        const cached = await conversationContextCache.getContext(agentSessionId, conversationId);
        if (cached) {
          serverMetrics.histogram('agent.conversation.history.cached', Date.now() - startTime);
          return cached;
        }
      }

      // Fetch from DB
      const messages = await prisma.agentConversation.findMany({
        where: {
          agentSessionId,
          conversationId,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          direction: true,
          role: true,
          content: true,
          inputTokens: true,
          outputTokens: true,
          latencyMs: true,
          createdAt: true,
        },
      });

      // Reverse to get chronological order
      const chronological = messages.reverse();

      // Cache recent context (last 10 messages)
      if (chronological.length > 0 && limit <= 10) {
        await conversationContextCache.cacheContext(
          agentSessionId,
          conversationId,
          chronological.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }))
        );
      }

      const latency = Date.now() - startTime;
      serverMetrics.histogram('agent.conversation.history.db', latency);

      return chronological;
    } catch (error) {
      serverMetrics.increment('agent.conversation.history.error');
      throw error;
    }
  }

  /**
   * Get conversation statistics (with caching)
   */
  static async getConversationStats(agentSessionId: string): Promise<AgentModel | null> {
    const startTime = Date.now();
    const cacheKey = CacheKeyGenerators.dbQuery('agent_conversation', 'stats', agentSessionId);

    try {
      // Try cache first (stats change less frequently)
      const cached = await cacheGet<AgentModel>(cacheKey);
      if (cached) {
        const latency = Date.now() - startTime;
        serverMetrics.histogram('agent.conversation.stats.cached', latency);
        return cached;
      }

      const stats = await prisma.agentConversation.groupBy({
        by: ['agentSessionId'],
        where: { agentSessionId },
        _count: { id: true },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
        },
        _avg: { latencyMs: true },
      });

      const result = stats[0] ?? null;

      // Cache stats for 5 minutes
      if (result) {
        await cacheSet(cacheKey, result, { ttl: TTLPresets.SHORT });
      }

      const latency = Date.now() - startTime;
      serverMetrics.histogram('agent.conversation.stats', latency);

      return result;
    } catch (error) {
      serverMetrics.increment('agent.conversation.stats.error');
      throw error;
    }
  }
}

// =====================================================
// Health Metrics Queries
// =====================================================

export class AgentHealthQueries {
  /**
   * Record health metrics (batch insert for efficiency)
   */
  static async recordMetrics(healthMetrics: Array<{
    agentSessionId: string;
    cpuUsagePercent?: number;
    memoryUsageMb?: number;
    messageCount?: number;
    errorCount?: number;
    avgLatencyMs?: number;
    healthStatus: string;
    healthScore?: number;
  }>): Promise<void> {
    const startTime = Date.now();

    try {
      await prisma.agentHealthMetric.createMany({
        data: healthMetrics.map(m => ({
          agentSessionId: m.agentSessionId,
          metricTimestamp: new Date(),
          cpuUsagePercent: m.cpuUsagePercent,
          memoryUsageMb: m.memoryUsageMb,
          messageCount: m.messageCount ?? 0,
          errorCount: m.errorCount ?? 0,
          avgLatencyMs: m.avgLatencyMs,
          healthStatus: m.healthStatus,
          healthScore: m.healthScore,
        })),
      });

      const latency = Date.now() - startTime;
      serverMetrics.histogram('agent.health.record_batch', latency, {
        batch_size: healthMetrics.length.toString(),
      });
    } catch (error) {
      serverMetrics.increment('agent.health.record.error');
      throw error;
    }
  }

  /**
   * Get recent health metrics (last 24 hours)
   */
  static async getRecentMetrics(agentSessionId: string, hours = 24): Promise<AgentModel[]> {
    const startTime = Date.now();

    try {
      // Try cache first (5-minute TTL)
      const cached = await agentHealthCache.getHealthMetrics(agentSessionId);
      if (cached) {
        return cached;
      }

      const healthMetrics = await prisma.agentHealthMetric.findMany({
        where: {
          agentSessionId,
          metricTimestamp: {
            gte: new Date(Date.now() - hours * 60 * 60 * 1000),
          },
        },
        orderBy: { metricTimestamp: 'desc' },
        take: 288, // 5-minute intervals for 24 hours
      });

      const latency = Date.now() - startTime;
      serverMetrics.histogram('agent.health.get_recent', latency);

      return healthMetrics;
    } catch (error) {
      serverMetrics.increment('agent.health.get.error');
      throw error;
    }
  }

  /**
   * Get aggregated health statistics (with caching)
   */
  static async getHealthStats(agentSessionId: string): Promise<HealthStatsResult | undefined> {
    const startTime = Date.now();
    const cacheKey = CacheKeyGenerators.dbQuery('agent_health', 'stats', agentSessionId);

    try {
      // Try cache first (health stats aggregates can be cached for a short period)
      const cached = await cacheGet<HealthStatsResult>(cacheKey);
      if (cached) {
        const latency = Date.now() - startTime;
        serverMetrics.histogram('agent.health.stats.cached', latency);
        return cached;
      }

      const stats = await prisma.$queryRaw<HealthStatsResult[]>`
        SELECT
          AVG(cpu_usage_percent) as avg_cpu,
          MAX(cpu_usage_percent) as max_cpu,
          AVG(memory_usage_mb) as avg_memory,
          MAX(memory_usage_mb) as max_memory,
          AVG(avg_latency_ms) as avg_latency,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY avg_latency_ms) as p95_latency,
          SUM(error_count) as total_errors
        FROM agent_health_metrics
        WHERE agent_session_id = ${agentSessionId}
          AND metric_timestamp > NOW() - INTERVAL '24 hours'
      `;

      const result = stats[0];

      // Cache health stats for 1 minute (they're computationally expensive)
      if (result) {
        await cacheSet(cacheKey, result, { ttl: 60 });
      }

      const latency = Date.now() - startTime;
      serverMetrics.histogram('agent.health.stats', latency);

      return result;
    } catch (error) {
      serverMetrics.increment('agent.health.stats.error');
      throw error;
    }
  }
}

// =====================================================
// Event Queries
// =====================================================

export class AgentEventQueries {
  /**
   * Log agent event
   */
  static async logEvent(data: {
    agentSessionId: string;
    eventType: string;
    eventCategory: 'lifecycle' | 'message' | 'error' | 'performance' | 'security' | 'system';
    eventSeverity?: 'debug' | 'info' | 'warning' | 'error' | 'critical';
    eventMessage?: string;
    eventData?: object;
    userId?: number;
    workspaceId?: number;
  }): Promise<void> {
    try {
      await prisma.agentEvent.create({
        data: {
          agentSessionId: data.agentSessionId,
          eventType: data.eventType,
          eventCategory: data.eventCategory,
          eventSeverity: data.eventSeverity ?? 'info',
          eventMessage: data.eventMessage,
          eventData: (data.eventData ?? {}) as Prisma.InputJsonValue,
          userId: data.userId,
          workspaceId: data.workspaceId,
        },
      });

      serverMetrics.increment('agent.event.logged', {
        event_type: data.eventType,
        severity: data.eventSeverity ?? 'info',
      });
    } catch (error) {
      console.error('Event logging error:', error);
      // Don't throw - event logging is non-critical
    }
  }

  /**
   * Get recent events (for debugging)
   */
  static async getRecentEvents(agentSessionId: string, limit = 100): Promise<AgentModel[]> {
    return await prisma.agentEvent.findMany({
      where: { agentSessionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get error events (for monitoring)
   */
  static async getErrorEvents(agentSessionId: string, hours = 24): Promise<AgentModel[]> {
    return await prisma.agentEvent.findMany({
      where: {
        agentSessionId,
        eventSeverity: { in: ['error', 'critical'] },
        createdAt: {
          gte: new Date(Date.now() - hours * 60 * 60 * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

// =====================================================
// Batch Operations
// =====================================================

export class AgentBatchQueries {
  /**
   * Get multiple agent sessions (batch lookup)
   */
  static async batchGetSessions(agentIds: string[]): Promise<AgentModel[]> {
    const startTime = Date.now();

    try {
      const sessions = await prisma.agentSession.findMany({
        where: {
          id: { in: agentIds },
          deletedAt: null,
        },
      });

      const latency = Date.now() - startTime;
      serverMetrics.histogram('agent.batch.get_sessions', latency, {
        batch_size: agentIds.length.toString(),
      });

      return sessions;
    } catch (error) {
      serverMetrics.increment('agent.batch.get.error');
      throw error;
    }
  }

  /**
   * Update multiple sessions (batch status update)
   */
  static async batchUpdateStatus(agentIds: string[], status: string): Promise<void> {
    const startTime = Date.now();

    try {
      await prisma.agentSession.updateMany({
        where: { id: { in: agentIds } },
        data: {
          status,
          lastActivityAt: new Date(),
        },
      });

      const latency = Date.now() - startTime;
      serverMetrics.histogram('agent.batch.update_status', latency, {
        batch_size: agentIds.length.toString(),
      });

      // Invalidate caches
      await Promise.all(agentIds.map(id => agentSessionCache.invalidateSession(id)));
    } catch (error) {
      serverMetrics.increment('agent.batch.update.error');
      throw error;
    }
  }

  /**
   * Batch create RAG chunks (optimized for bulk ingestion)
   */
  static async batchCreateRAGChunks(chunks: Array<{
    content: string;
    metadata?: object;
    file_id?: number;
    user_id: number;
    workspace_id?: number;
    project_id?: number;
    chunk_index?: number;
    token_count?: number;
    start_line?: number;
    end_line?: number;
    chunk_id?: string;
  }>): Promise<{ created: number; batches: number }> {
    const startTime = Date.now();

    try {
      // Process in batches of 1000 to avoid memory issues
      const batchSize = 1000;
      const results: BatchResult[] = [];

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);

        const batchResult = await prisma.rAGChunk.createMany({
          data: batch.map(chunk => ({
            content: chunk.content,
            metadata: (chunk.metadata ?? {}) as Prisma.InputJsonValue,
            file_id: chunk.file_id,
            user_id: chunk.user_id,
            workspace_id: chunk.workspace_id,
            project_id: chunk.project_id,
            chunk_index: chunk.chunk_index,
            token_count: chunk.token_count,
            start_line: chunk.start_line,
            end_line: chunk.end_line,
            chunk_id: chunk.chunk_id,
          })),
          skipDuplicates: true, // Skip duplicates for resilience
        });

        results.push(batchResult);
      }

      const totalCreated = results.reduce((sum: number, result: BatchResult) => sum + result.count, 0);
      const latency = Date.now() - startTime;

      serverMetrics.histogram('agent.batch.create_rag_chunks', latency, {
        batch_size: chunks.length.toString(),
        total_created: totalCreated.toString(),
      });

      return { created: totalCreated, batches: results.length };
    } catch (error) {
      serverMetrics.increment('agent.batch.create_rag.error');
      throw error;
    }
  }

  /**
   * Batch update workspace metadata
   * Optimized: Uses transaction for atomicity and single round trip
   */
  static async batchUpdateWorkspaces(updates: Array<{
    id: number;
    name?: string;
    description?: string;
    status?: string;
    url?: string;
  }>): Promise<AgentModel[]> {
    const startTime = Date.now();

    if (updates.length === 0) {
      return [];
    }

    try {
      // Use transaction for atomicity
      const results = await prisma.$transaction(
        updates.map(update =>
          prisma.workspace.update({
            where: { id: update.id },
            data: {
              ...(update.name && { name: update.name }),
              ...(update.description && { description: update.description }),
              ...(update.status && { status: update.status }),
              ...(update.url && { url: update.url }),
              updated_at: new Date(),
            },
          })
        )
      );

      const latency = Date.now() - startTime;
      serverMetrics.histogram('agent.batch.update_workspaces', latency, {
        batch_size: updates.length.toString(),
      });

      // Invalidate workspace caches
      await Promise.all(
        updates.map(update =>
          QueryCacheManager.invalidateByKey(
            QueryCacheManager.generateCacheKey('workspace', 'getById', { id: update.id })
          )
        )
      );

      return results;
    } catch (error) {
      serverMetrics.increment('agent.batch.update_workspaces.error');
      throw error;
    }
  }

  /**
   * Batch create files (optimized for bulk file import)
   */
  static async batchCreateFiles(files: Array<{
    name: string;
    path: string;
    content?: string;
    size?: number;
    mime_type?: string;
    language?: string;
    lines?: number;
    checksum?: string;
    user_id: number;
    workspace_id?: number;
    project_id?: number;
  }>): Promise<{ created: number; batches: number }> {
    const startTime = Date.now();

    try {
      // Process in batches to avoid connection limits
      const batchSize = 500;
      const results: BatchResult[] = [];

      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);

        const batchResult = await prisma.file.createMany({
          data: batch,
          skipDuplicates: true,
        });

        results.push(batchResult);
      }

      const totalCreated = results.reduce((sum: number, result: BatchResult) => sum + result.count, 0);
      const latency = Date.now() - startTime;

      serverMetrics.histogram('agent.batch.create_files', latency, {
        batch_size: files.length.toString(),
        total_created: totalCreated.toString(),
      });

      return { created: totalCreated, batches: results.length };
    } catch (error) {
      serverMetrics.increment('agent.batch.create_files.error');
      throw error;
    }
  }

  /**
   * Batch delete operations (soft delete for workspaces and projects)
   */
  static async batchSoftDelete(operations: Array<{
    table: 'workspace' | 'project' | 'file';
    ids: number[];
    userId: number; // For authorization
  }>): Promise<{ affected: number; operations: BatchResult[] }> {
    const startTime = Date.now();

    try {
      const results = await Promise.all(
        operations.map(async (op): Promise<BatchResult> => {
          switch (op.table) {
            case 'workspace':
              return await prisma.workspace.updateMany({
                where: {
                  id: { in: op.ids },
                  user_id: op.userId, // Security: only delete own workspaces
                },
                data: {
                  status: 'archived',
                  updated_at: new Date(),
                },
              });

            case 'project':
              return await prisma.project.updateMany({
                where: {
                  id: { in: op.ids },
                  user_id: op.userId, // Security: only delete own projects
                },
                data: {
                  status: 'archived',
                  updated_at: new Date(),
                },
              });

            case 'file':
              // For files, we do hard delete as they're content
              return await prisma.file.deleteMany({
                where: {
                  id: { in: op.ids },
                  user_id: op.userId, // Security: only delete own files
                },
              });

            default:
              throw new Error(`Unsupported table for batch delete: ${op.table}`);
          }
        })
      );

      const latency = Date.now() - startTime;
      const totalAffected = results.reduce((sum: number, result: BatchResult) => sum + result.count, 0);

      serverMetrics.histogram('agent.batch.soft_delete', latency, {
        operations_count: operations.length.toString(),
        total_affected: totalAffected.toString(),
      });

      return { affected: totalAffected, operations: results };
    } catch (error) {
      serverMetrics.increment('agent.batch.soft_delete.error');
      throw error;
    }
  }

  /**
   * Batch cleanup old records (for maintenance)
   */
  static async batchCleanupOldRecords(days: number = 90): Promise<{
    cleaned: number;
    conversations: number;
    healthMetrics: number;
    events: number;
    workspaces: number;
  }> {
    const startTime = Date.now();
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    try {
      const results: BatchResult[] = await Promise.all([
        // Archive old conversations
        prisma.agentConversation.deleteMany({
          where: {
            createdAt: { lt: cutoffDate },
            // Keep important conversations (e.g., those with high token usage)
            totalTokens: { lt: 10000 },
          },
        }),

        // Archive old health metrics
        prisma.agentHealthMetric.deleteMany({
          where: {
            metricTimestamp: { lt: cutoffDate },
          },
        }),

        // Archive old events (except errors)
        prisma.agentEvent.deleteMany({
          where: {
            createdAt: { lt: cutoffDate },
            eventSeverity: { notIn: ['error', 'critical'] },
          },
        }),

        // Update old archived workspaces to deleted status
        prisma.workspace.updateMany({
          where: {
            status: 'archived',
            updated_at: { lt: cutoffDate },
          },
          data: {
            status: 'deleted',
            updated_at: new Date(),
          },
        }),
      ]);

      const latency = Date.now() - startTime;
      const totalCleaned = results.reduce((sum: number, result: BatchResult) => sum + result.count, 0);

      serverMetrics.histogram('agent.batch.cleanup', latency, {
        days: days.toString(),
        total_cleaned: totalCleaned.toString(),
      });

      return {
        cleaned: totalCleaned,
        conversations: results[0].count,
        healthMetrics: results[1].count,
        events: results[2].count,
        workspaces: results[3].count,
      };
    } catch (error) {
      serverMetrics.increment('agent.batch.cleanup.error');
      throw error;
    }
  }
}

// =====================================================
// Maintenance Queries
// =====================================================

export class AgentMaintenanceQueries {
  /**
   * Archive old conversations (90+ days)
   */
  static async archiveOldConversations(): Promise<unknown> {
    return await prisma.$queryRaw`SELECT archive_old_agent_conversations()`;
  }

  /**
   * Archive old metrics (30+ days)
   */
  static async archiveOldMetrics(): Promise<unknown> {
    return await prisma.$queryRaw`SELECT archive_old_agent_metrics()`;
  }

  /**
   * Cleanup stale sessions (inactive 24+ hours)
   */
  static async cleanupStaleSessions(): Promise<unknown> {
    return await prisma.$queryRaw`SELECT cleanup_stale_agent_sessions()`;
  }

  /**
   * Refresh materialized view
   */
  static async refreshStats(): Promise<unknown> {
    return await prisma.$queryRaw`SELECT refresh_agent_session_stats()`;
  }
}

// Export instances
export default {
  sessions: AgentSessionQueries,
  conversations: AgentConversationQueries,
  health: AgentHealthQueries,
  events: AgentEventQueries,
  batch: AgentBatchQueries,
  maintenance: AgentMaintenanceQueries,
};
