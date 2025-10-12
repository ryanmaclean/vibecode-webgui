/**
 * AgentAPI Database Query Layer
 *
 * Optimized PostgreSQL queries with:
 * - Connection pooling via Prisma
 * - Query performance <50ms P95
 * - Proper indexing utilization
 * - Batch operations for efficiency
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { agentSessionCache, agentHealthCache, conversationContextCache } from '../cache/agentapi-redis-strategy';
import { metrics } from '../server-monitoring';
import { logger } from '@/lib/logger';
// =====================================================
// Database Client Configuration
// =====================================================

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

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
  }) {
    const startTime = Date.now();

    try {
      const session = await prisma.$transaction(async (tx) => {
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
            agentapiPort: data.agentapiPort || 8766,
            environmentVars: (data.environmentVars || {}) as Prisma.InputJsonValue,
            maxMemoryMb: data.maxMemoryMb || 1024,
            maxCpuCores: data.maxCpuCores || 0.5,
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
        lastActivityAt: session.lastActivityAt?.toISOString() || null,
        activeConnections: session.activeConnections,
      });

      const latency = Date.now() - startTime;
      metrics.histogram('agent.session.create', latency);
      metrics.increment('agent.session.created', { agent_type: data.agentType });

      return session;
    } catch (error) {
      metrics.increment('agent.session.create.error');
      throw error;
    }
  }

  /**
   * Get agent session by ID (with cache)
   * Target: <50ms P95 latency
   */
  static async getSession(agentId: string) {
    const startTime = Date.now();

    try {
      // Try cache first
      const cached = await agentSessionCache.getSession(agentId);
      if (cached) {
        const latency = Date.now() - startTime;
        metrics.histogram('agent.session.get.cached', latency);
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
          lastActivityAt: session.lastActivityAt?.toISOString() || null,
          activeConnections: session.activeConnections,
        });
      }

      const latency = Date.now() - startTime;
      metrics.histogram('agent.session.get.db', latency);

      return session;
    } catch (error) {
      metrics.increment('agent.session.get.error');
      throw error;
    }
  }

  /**
   * List agents for workspace
   */
  static async listWorkspaceAgents(workspaceId: number, includeDeleted = false) {
    const startTime = Date.now();

    try {
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

      const latency = Date.now() - startTime;
      metrics.histogram('agent.session.list_workspace', latency);

      return agents;
    } catch (error) {
      metrics.increment('agent.session.list.error');
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
  ) {
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
      metrics.histogram('agent.session.update_status', latency);
      metrics.increment('agent.session.status_changed', { status });

      return session;
    } catch (error) {
      metrics.increment('agent.session.update.error');
      throw error;
    }
  }

  /**
   * Soft delete agent session
   */
  static async deleteSession(agentId: string) {
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
      metrics.histogram('agent.session.delete', latency);
      metrics.increment('agent.session.deleted');
    } catch (error) {
      metrics.increment('agent.session.delete.error');
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
  }) {
    const startTime = Date.now();

    try {
      const message = await prisma.agentConversation.create({
        data: {
          agentSessionId: data.agentSessionId,
          conversationId: data.conversationId,
          direction: data.direction,
          role: data.role,
          content: data.content,
          contextFiles: (data.contextFiles || []) as Prisma.InputJsonValue,
          inputTokens: data.inputTokens,
          outputTokens: data.outputTokens,
          totalTokens: (data.inputTokens || 0) + (data.outputTokens || 0),
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
      metrics.histogram('agent.conversation.save', dbLatency);
      metrics.increment('agent.conversation.message_saved');

      return message;
    } catch (error) {
      metrics.increment('agent.conversation.save.error');
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
  ) {
    const startTime = Date.now();

    try {
      // Try cache for recent context
      if (limit <= 10) {
        const cached = await conversationContextCache.getContext(agentSessionId, conversationId);
        if (cached) {
          metrics.histogram('agent.conversation.history.cached', Date.now() - startTime);
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
          chronological.map(m => ({ role: m.role, content: m.content }))
        );
      }

      const latency = Date.now() - startTime;
      metrics.histogram('agent.conversation.history.db', latency);

      return chronological;
    } catch (error) {
      metrics.increment('agent.conversation.history.error');
      throw error;
    }
  }

  /**
   * Get conversation statistics
   */
  static async getConversationStats(agentSessionId: string) {
    const startTime = Date.now();

    try {
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

      const latency = Date.now() - startTime;
      metrics.histogram('agent.conversation.stats', latency);

      return stats[0] || null;
    } catch (error) {
      metrics.increment('agent.conversation.stats.error');
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
  static async recordMetrics(metrics: Array<{
    agentSessionId: string;
    cpuUsagePercent?: number;
    memoryUsageMb?: number;
    messageCount?: number;
    errorCount?: number;
    avgLatencyMs?: number;
    healthStatus: string;
    healthScore?: number;
  }>) {
    const startTime = Date.now();

    try {
      await prisma.agentHealthMetric.createMany({
        data: metrics.map(m => ({
          agentSessionId: m.agentSessionId,
          metricTimestamp: new Date(),
          cpuUsagePercent: m.cpuUsagePercent,
          memoryUsageMb: m.memoryUsageMb,
          messageCount: m.messageCount || 0,
          errorCount: m.errorCount || 0,
          avgLatencyMs: m.avgLatencyMs,
          healthStatus: m.healthStatus,
          healthScore: m.healthScore,
        })),
      });

      const latency = Date.now() - startTime;
      metrics.histogram('agent.health.record_batch', latency, {
        batch_size: metrics.length.toString(),
      });
    } catch (error) {
      metrics.increment('agent.health.record.error');
      throw error;
    }
  }

  /**
   * Get recent health metrics (last 24 hours)
   */
  static async getRecentMetrics(agentSessionId: string, hours = 24) {
    const startTime = Date.now();

    try {
      // Try cache first (5-minute TTL)
      const cached = await agentHealthCache.getHealthMetrics(agentSessionId);
      if (cached) {
        return cached;
      }

      const metrics = await prisma.agentHealthMetric.findMany({
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
      metrics.histogram('agent.health.get_recent', latency);

      return metrics;
    } catch (error) {
      metrics.increment('agent.health.get.error');
      throw error;
    }
  }

  /**
   * Get aggregated health statistics
   */
  static async getHealthStats(agentSessionId: string) {
    const startTime = Date.now();

    try {
      const stats = await prisma.$queryRaw`
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

      const latency = Date.now() - startTime;
      metrics.histogram('agent.health.stats', latency);

      return stats[0];
    } catch (error) {
      metrics.increment('agent.health.stats.error');
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
  }) {
    try {
      await prisma.agentEvent.create({
        data: {
          agentSessionId: data.agentSessionId,
          eventType: data.eventType,
          eventCategory: data.eventCategory,
          eventSeverity: data.eventSeverity || 'info',
          eventMessage: data.eventMessage,
          eventData: (data.eventData || {}) as Prisma.InputJsonValue,
          userId: data.userId,
          workspaceId: data.workspaceId,
        },
      });

      metrics.increment('agent.event.logged', {
        event_type: data.eventType,
        severity: data.eventSeverity || 'info',
      });
    } catch (error) {
      logger.error('Event logging error:', error);
      // Don't throw - event logging is non-critical
    }
  }

  /**
   * Get recent events (for debugging)
   */
  static async getRecentEvents(agentSessionId: string, limit = 100) {
    return await prisma.agentEvent.findMany({
      where: { agentSessionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get error events (for monitoring)
   */
  static async getErrorEvents(agentSessionId: string, hours = 24) {
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
  static async batchGetSessions(agentIds: string[]) {
    const startTime = Date.now();

    try {
      const sessions = await prisma.agentSession.findMany({
        where: {
          id: { in: agentIds },
          deletedAt: null,
        },
      });

      const latency = Date.now() - startTime;
      metrics.histogram('agent.batch.get_sessions', latency, {
        batch_size: agentIds.length.toString(),
      });

      return sessions;
    } catch (error) {
      metrics.increment('agent.batch.get.error');
      throw error;
    }
  }

  /**
   * Update multiple sessions (batch status update)
   */
  static async batchUpdateStatus(agentIds: string[], status: string) {
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
      metrics.histogram('agent.batch.update_status', latency, {
        batch_size: agentIds.length.toString(),
      });

      // Invalidate caches
      await Promise.all(agentIds.map(id => agentSessionCache.invalidateSession(id)));
    } catch (error) {
      metrics.increment('agent.batch.update.error');
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
  static async archiveOldConversations() {
    return await prisma.$queryRaw`SELECT archive_old_agent_conversations()`;
  }

  /**
   * Archive old metrics (30+ days)
   */
  static async archiveOldMetrics() {
    return await prisma.$queryRaw`SELECT archive_old_agent_metrics()`;
  }

  /**
   * Cleanup stale sessions (inactive 24+ hours)
   */
  static async cleanupStaleSessions() {
    return await prisma.$queryRaw`SELECT cleanup_stale_agent_sessions()`;
  }

  /**
   * Refresh materialized view
   */
  static async refreshStats() {
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
