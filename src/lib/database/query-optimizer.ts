/**
 * Database Query Optimization Utilities
 * Provides query optimization, connection pooling, and performance monitoring
 */

import { Prisma } from '@prisma/client';
import { cache, CacheKeys, CacheTTL, withCache } from '../cache/valkey-client';
import { trackDBQuery } from '../performance/metrics-collector';

/**
 * Query optimization configurations
 */
export const QueryOptimizations = {
  // Batch size for bulk operations
  BATCH_SIZE: 100,
  
  // Include optimizations for common queries
  USER_INCLUDES: {
    sessions: {
      take: 5,
      orderBy: { expires: 'desc' as const }
    },
    workspaces: {
      take: 10,
      orderBy: { updated_at: 'desc' as const },
      include: {
        projects: {
          take: 5,
          orderBy: { updated_at: 'desc' as const }
        }
      }
    }
  },

  WORKSPACE_INCLUDES: {
    user: {
      select: {
        id: true,
        name: true,
        email: true,
        image: true
      }
    },
    projects: {
      take: 20,
      orderBy: { updated_at: 'desc' as const },
      include: {
        files: {
          take: 10,
          orderBy: { updated_at: 'desc' as const }
        }
      }
    },
    _count: {
      select: {
        projects: true,
        files: true
      }
    }
  },

  PROJECT_INCLUDES: {
    workspace: {
      select: {
        id: true,
        name: true,
        workspace_id: true
      }
    },
    files: {
      take: 50,
      orderBy: { updated_at: 'desc' as const }
    },
    _count: {
      select: {
        files: true
      }
    }
  }
};

/**
 * Database connection pool manager
 */
export class ConnectionPoolManager {
  private static instance: ConnectionPoolManager;
  private connectionCount = 0;
  private queryCount = 0;
  private slowQueryThreshold = 1000; // 1 second

  public static getInstance(): ConnectionPoolManager {
    if (!ConnectionPoolManager.instance) {
      ConnectionPoolManager.instance = new ConnectionPoolManager();
    }
    return ConnectionPoolManager.instance;
  }

  /**
   * Track database operations
   */
  trackQuery(operation: string, model: string, duration: number) {
    this.queryCount++;
    trackDBQuery(operation, model, duration);

    if (duration > this.slowQueryThreshold) {
      console.warn(`Slow query detected: ${model}.${operation} took ${duration}ms`);
    }
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      connectionCount: this.connectionCount,
      queryCount: this.queryCount,
      slowQueryThreshold: this.slowQueryThreshold
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.connectionCount = 0;
    this.queryCount = 0;
  }
}

/**
 * Cached database operations
 */
export class CachedQueries {
  /**
   * Get user with caching
   */
  static getUserById = withCache(
    async (userId: number, include = QueryOptimizations.USER_INCLUDES) => {
      const { prisma } = await import('../prisma');
      return prisma.user.findUnique({
        where: { id: userId },
        include
      });
    },
    (userId: number) => CacheKeys.user(userId.toString()),
    CacheTTL.MEDIUM
  );

  /**
   * Get workspace with caching
   */
  static getWorkspaceById = withCache(
    async (workspaceId: number, include = QueryOptimizations.WORKSPACE_INCLUDES) => {
      const { prisma } = await import('../prisma');
      return prisma.workspace.findUnique({
        where: { id: workspaceId },
        include
      });
    },
    (workspaceId: number) => CacheKeys.workspace(workspaceId.toString()),
    CacheTTL.MEDIUM
  );

  /**
   * Get project with caching
   */
  static getProjectById = withCache(
    async (projectId: number, include = QueryOptimizations.PROJECT_INCLUDES) => {
      const { prisma } = await import('../prisma');
      return prisma.project.findUnique({
        where: { id: projectId },
        include
      });
    },
    (projectId: number) => CacheKeys.project(projectId.toString()),
    CacheTTL.MEDIUM
  );

  /**
   * Get user workspaces with caching
   */
  static getUserWorkspaces = withCache(
    async (userId: number, limit = 20) => {
      const { prisma } = await import('../prisma');
      return prisma.workspace.findMany({
        where: { user_id: userId },
        include: QueryOptimizations.WORKSPACE_INCLUDES,
        orderBy: { updated_at: 'desc' },
        take: limit
      });
    },
    (userId: number, limit: number = 20) => `user:${userId}:workspaces:${limit}`,
    CacheTTL.SHORT
  );

  /**
   * Get workspace projects with caching
   */
  static getWorkspaceProjects = withCache(
    async (workspaceId: number, limit = 50) => {
      const { prisma } = await import('../prisma');
      return prisma.project.findMany({
        where: { workspace_id: workspaceId },
        include: QueryOptimizations.PROJECT_INCLUDES,
        orderBy: { updated_at: 'desc' },
        take: limit
      });
    },
    (workspaceId: number, limit: number = 50) => `workspace:${workspaceId}:projects:${limit}`,
    CacheTTL.SHORT
  );

  /**
   * Get file content with caching (for RAG and code analysis)
   */
  static getFileContent = withCache(
    async (fileId: number) => {
      const { prisma } = await import('../prisma');
      return prisma.file.findUnique({
        where: { id: fileId },
        select: {
          id: true,
          name: true,
          path: true,
          content: true,
          language: true,
          size: true,
          updated_at: true
        }
      });
    },
    (fileId: number) => CacheKeys.fileContent(fileId.toString()),
    CacheTTL.LONG
  );

  /**
   * Search files by content (with caching for common searches)
   */
  static searchFiles = withCache(
    async (workspaceId: number, query: string, limit = 20) => {
      const { prisma } = await import('../prisma');
      return prisma.file.findMany({
        where: {
          workspace_id: workspaceId,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { path: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          name: true,
          path: true,
          language: true,
          size: true,
          updated_at: true
        },
        orderBy: { updated_at: 'desc' },
        take: limit
      });
    },
    (workspaceId: number, query: string, limit: number = 20) => 
      `search:files:${workspaceId}:${Buffer.from ? Buffer.from(query).toString('base64') : btoa(query)}:${limit}`,
    CacheTTL.SHORT
  );
}

/**
 * Bulk operations optimizer
 */
export class BulkOperations {
  /**
   * Batch create records with optimized chunking
   */
  static async batchCreate<T>(
    model: any,
    data: T[],
    batchSize = QueryOptimizations.BATCH_SIZE
  ): Promise<void> {
    if (data.length === 0) return;

    const batches: T[][] = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      await model.createMany({
        data: batch,
        skipDuplicates: true
      });
    }
  }

  /**
   * Batch update records with optimized queries
   */
  static async batchUpdate<T extends { id: number }>(
    model: any,
    updates: T[],
    batchSize = QueryOptimizations.BATCH_SIZE
  ): Promise<void> {
    if (updates.length === 0) return;

    const batches: T[][] = [];
    for (let i = 0; i < updates.length; i += batchSize) {
      batches.push(updates.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const { prisma } = await import('../prisma');
      const transaction = batch.map((update: T) => 
        model.update({
          where: { id: update.id },
          data: update
        })
      );
      
      await prisma.$transaction(transaction);
    }
  }

  /**
   * Batch delete records efficiently
   */
  static async batchDelete(
    model: any,
    ids: number[],
    batchSize = QueryOptimizations.BATCH_SIZE
  ): Promise<void> {
    if (ids.length === 0) return;

    const batches: number[][] = [];
    for (let i = 0; i < ids.length; i += batchSize) {
      batches.push(ids.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      await model.deleteMany({
        where: {
          id: {
            in: batch
          }
        }
      });
    }
  }
}

/**
 * Query performance analyzer
 */
export class QueryAnalyzer {
  // Changed from private to protected static to allow access via bracket notation
  protected static queryLog: Array<{
    query: string;
    duration: number;
    timestamp: number;
    model: string;
    operation: string;
  }> = [];

  /**
   * Log query performance
   */
  static logQuery(query: string, duration: number, model: string, operation: string) {
    this.queryLog.push({
      query,
      duration,
      timestamp: Date.now(),
      model,
      operation
    });

    // Keep only last 1000 queries
    if (this.queryLog.length > 1000) {
      this.queryLog = this.queryLog.slice(-1000);
    }
  }

  /**
   * Get slow queries report
   */
  static getSlowQueries(threshold = 1000, limit = 20) {
    return this.queryLog
      .filter(q => q.duration > threshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Get query statistics by model
   */
  static getModelStats() {
    const stats = new Map<string, {
      count: number;
      totalDuration: number;
      avgDuration: number;
      maxDuration: number;
    }>();

    for (const query of this.queryLog) {
      const current = stats.get(query.model) || {
        count: 0,
        totalDuration: 0,
        avgDuration: 0,
        maxDuration: 0
      };

      current.count++;
      current.totalDuration += query.duration;
      current.avgDuration = current.totalDuration / current.count;
      current.maxDuration = Math.max(current.maxDuration, query.duration);

      stats.set(query.model, current);
    }

    return Array.from(stats.entries()).map(([model, stats]) => ({
      model,
      ...stats
    }));
  }

  /**
   * Get the query log (added accessor method)
   */
  static getQueryLog() {
    return this.queryLog;
  }

  /**
   * Clear query log
   */
  static clearLog() {
    this.queryLog = [];
  }
}

  /**
   * Database health monitor
   */
  export class DatabaseHealthMonitor {
    /**
     * Check database connectivity and performance
     */
    static async healthCheck(): Promise<{
      connected: boolean;
      responseTime: number;
      activeConnections?: number;
      errorRate: number;
      recommendations: string[];
    }> {
      const startTime = Date.now();
      const recommendations: string[] = [];

      try {
        const { prisma } = await import('../prisma');
        
        // Simple connectivity test
        await prisma.$queryRaw`SELECT 1`;
        const responseTime = Date.now() - startTime;

        // Get connection info if available
        let activeConnections: number | undefined;
        try {
          const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()
          `;
          activeConnections = Number(result[0]?.count || 0);
        } catch {
          // Connection info not available
        }

        // Calculate error rate from recent queries
        const recentQueries = QueryAnalyzer.getQueryLog().slice(-100);
        const errors = recentQueries.filter(q => q.duration < 0); // Assuming negative duration indicates error
        const errorRate = recentQueries.length > 0 ? (errors.length / recentQueries.length) * 100 : 0;

        // Generate recommendations
        if (responseTime > 500) {
          recommendations.push('Database response time is slow - consider optimizing queries');
        }

        if (activeConnections && activeConnections > 80) {
          recommendations.push('High number of database connections - consider connection pooling');
        }

        if (errorRate > 5) {
          recommendations.push('High database error rate - check logs for issues');
        }

        const slowQueries = QueryAnalyzer.getSlowQueries(1000, 5);
        if (slowQueries.length > 0) {
          recommendations.push(`${slowQueries.length} slow queries detected - consider adding indexes`);
        }

        return {
          connected: true,
          responseTime,
          activeConnections,
          errorRate,
          recommendations
        };

      } catch (error: any) {
        return {
          connected: false,
          responseTime: Date.now() - startTime,
          errorRate: 100,
          recommendations: ['Database connection failed - check connection string and database status']
        };
      }
    }

  /**
   * Get database performance metrics
   */
  static async getPerformanceMetrics(): Promise<{
    tableStats: Array<{
      table: string;
      rowCount: number;
      size: string;
      indexSize: string;
    }>;
    slowQueries: any[];
    connectionPool: any;
  }> {
    try {
      const { prisma } = await import('../prisma');

      // Get table statistics
      const tableStats = await prisma.$queryRaw<Array<{
        table: string;
        rowcount: bigint;
        size: string;
        indexsize: string;
      }>>`
        SELECT 
          schemaname||'.'||tablename as table,
          n_tup_ins + n_tup_upd + n_tup_del as rowcount,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as indexsize
        FROM pg_stat_user_tables 
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 10
      `;

      const slowQueries = QueryAnalyzer.getSlowQueries(500, 10);
      const connectionPool = ConnectionPoolManager.getInstance().getStats();

      return {
        tableStats: tableStats.map(stat => ({
          table: stat.table,
          rowCount: Number(stat.rowcount),
          size: stat.size,
          indexSize: stat.indexsize
        })),
        slowQueries,
        connectionPool
      };

    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      return {
        tableStats: [],
        slowQueries: [],
        connectionPool: {}
      };
    }
  }
}

/**
 * Cache invalidation on database changes
 */
export class CacheInvalidationHooks {
  /**
   * Invalidate cache after user update
   */
  static async afterUserUpdate(userId: number) {
    await cache.del([
      CacheKeys.user(userId.toString()),
      `user:${userId}:workspaces:*`
    ]);
  }

  /**
   * Invalidate cache after workspace update
   */
  static async afterWorkspaceUpdate(workspaceId: number, userId?: number) {
    const keysToDelete = [
      CacheKeys.workspace(workspaceId.toString()),
      `workspace:${workspaceId}:projects:*`
    ];

    if (userId) {
      keysToDelete.push(`user:${userId}:workspaces:*`);
    }

    await cache.del(keysToDelete);
  }

  /**
   * Invalidate cache after project update
   */
  static async afterProjectUpdate(projectId: number, workspaceId?: number) {
    const keysToDelete = [CacheKeys.project(projectId.toString())];

    if (workspaceId) {
      keysToDelete.push(`workspace:${workspaceId}:projects:*`);
    }

    await cache.del(keysToDelete);
  }

  /**
   * Invalidate file-related cache
   */
  static async afterFileUpdate(fileId: number, workspaceId?: number) {
    const keysToDelete = [CacheKeys.fileContent(fileId.toString())];

    if (workspaceId) {
      // Invalidate file search cache
      const searchKeys = await cache.keys(`search:files:${workspaceId}:*`);
      keysToDelete.push(...searchKeys);
    }

    await cache.del(keysToDelete);
  }
}

export default {
  CachedQueries,
  BulkOperations,
  QueryAnalyzer,
  DatabaseHealthMonitor,
  CacheInvalidationHooks,
  ConnectionPoolManager
};