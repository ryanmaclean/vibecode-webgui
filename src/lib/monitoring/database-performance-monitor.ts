/**
 * Database Performance Monitor
 * 
 * Provides comprehensive monitoring for database performance including:
 * - Query performance tracking
 * - Slow query detection and logging
 * - Connection pool utilization monitoring
 * - Database health metrics
 * - Performance alerts and recommendations
 */

import { PrismaClient } from '@prisma/client';
// import { logger } from '@/lib/logger';
import { metrics } from '@/lib/server-monitoring';

interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  error?: string;
  rowsAffected?: number;
  userId?: number;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRANSACTION';
}

interface SlowQueryThresholds {
  warning: number;  // milliseconds
  critical: number; // milliseconds
}

interface DatabaseHealthMetrics {
  connectionPoolUtilization: number;
  avgQueryTime: number;
  slowQueryCount: number;
  errorRate: number;
  throughput: number; // queries per second
  lastHealthCheck: Date;
}

interface PerformanceAlert {
  type: 'slow_query' | 'high_error_rate' | 'connection_pool_full' | 'memory_usage';
  severity: 'warning' | 'critical';
  message: string;
  metrics: Record<string, any>;
  timestamp: Date;
}

export class DatabasePerformanceMonitor {
  private queryMetrics: QueryMetrics[] = [];
  private slowQueryThresholds: SlowQueryThresholds = {
    warning: 1000,   // 1 second
    critical: 5000,  // 5 seconds
  };
  private maxMetricsHistory = 10000; // Keep last 10k queries
  private alertCallbacks: Array<(alert: PerformanceAlert) => void> = [];
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.startHealthCheckMonitoring();
  }

  /**
   * Start continuous health check monitoring
   */
  private startHealthCheckMonitoring(): void {
    // Run health checks every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('Database health check failed:', error);
      }
    }, 30000);
  }

  /**
   * Stop monitoring
   */
  public stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Track a database query's performance
   */
  public trackQuery(metrics: Omit<QueryMetrics, 'timestamp'>): void {
    const queryMetric: QueryMetrics = {
      ...metrics,
      timestamp: new Date(),
    };

    this.queryMetrics.push(queryMetric);

    // Maintain metrics history limit
    if (this.queryMetrics.length > this.maxMetricsHistory) {
      this.queryMetrics = this.queryMetrics.slice(-this.maxMetricsHistory);
    }

    // Check for slow queries
    this.checkSlowQuery(queryMetric);

    // Update global metrics
    this.updateGlobalMetrics(queryMetric);
  }

  /**
   * Wrapper to monitor Prisma queries automatically
   */
  public async monitorQuery<T>(
    queryName: string,
    operation: QueryMetrics['operation'],
    queryFn: () => Promise<T>,
    userId?: number
  ): Promise<T> {
    const startTime = Date.now();
    let result: T;
    let error: string | undefined;
    let success = true;

    try {
      result = await queryFn();
      return result;
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : 'Unknown error';
      throw err;
    } finally {
      const duration = Date.now() - startTime;
      
      this.trackQuery({
        query: queryName,
        duration,
        success,
        error,
        operation,
        userId,
      });
    }
  }

  /**
   * Check if a query is slow and create alerts
   */
  private checkSlowQuery(queryMetric: QueryMetrics): void {
    if (queryMetric.duration >= this.slowQueryThresholds.critical) {
      this.createAlert({
        type: 'slow_query',
        severity: 'critical',
        message: `Critical slow query detected: ${queryMetric.query} took ${queryMetric.duration}ms`,
        metrics: { 
          duration: queryMetric.duration, 
          query: queryMetric.query,
          operation: queryMetric.operation 
        },
        timestamp: queryMetric.timestamp,
      });
    } else if (queryMetric.duration >= this.slowQueryThresholds.warning) {
      this.createAlert({
        type: 'slow_query',
        severity: 'warning',
        message: `Slow query detected: ${queryMetric.query} took ${queryMetric.duration}ms`,
        metrics: { 
          duration: queryMetric.duration, 
          query: queryMetric.query,
          operation: queryMetric.operation 
        },
        timestamp: queryMetric.timestamp,
      });
    }
  }

  /**
   * Update global metrics
   */
  private updateGlobalMetrics(queryMetric: QueryMetrics): void {
    // Update server monitoring metrics
    metrics.histogram('db.query.duration', queryMetric.duration, {
      operation: queryMetric.operation,
      success: queryMetric.success.toString(),
    });

    metrics.increment('db.query.total', {
      operation: queryMetric.operation,
      success: queryMetric.success.toString(),
    });

    if (!queryMetric.success) {
      metrics.increment('db.query.errors', {
        operation: queryMetric.operation,
      });
    }
  }

  /**
   * Perform comprehensive database health check
   */
  private async performHealthCheck(): Promise<DatabaseHealthMetrics> {
    const recentMetrics = this.getRecentMetrics(300000); // Last 5 minutes
    const now = new Date();

    // Calculate health metrics
    const totalQueries = recentMetrics.length;
    const errorCount = recentMetrics.filter(m => !m.success).length;
    const slowQueries = recentMetrics.filter(m => 
      m.duration >= this.slowQueryThresholds.warning
    ).length;

    const avgQueryTime = totalQueries > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / totalQueries 
      : 0;

    const errorRate = totalQueries > 0 ? errorCount / totalQueries : 0;
    const throughput = totalQueries / 300; // queries per second over 5 minutes

    // Estimate connection pool utilization (this would need actual pool metrics)
    const connectionPoolUtilization = await this.estimateConnectionPoolUtilization();

    const healthMetrics: DatabaseHealthMetrics = {
      connectionPoolUtilization,
      avgQueryTime,
      slowQueryCount: slowQueries,
      errorRate,
      throughput,
      lastHealthCheck: now,
    };

    // Check for health alerts
    this.checkHealthAlerts(healthMetrics);

    // Log health summary
    console.info('Database health check completed', {
      avgQueryTime: Math.round(avgQueryTime),
      errorRate: Math.round(errorRate * 100),
      slowQueries,
      throughput: Math.round(throughput * 100) / 100,
      connectionPoolUtilization: Math.round(connectionPoolUtilization * 100),
    });

    return healthMetrics;
  }

  /**
   * Estimate connection pool utilization
   */
  private async estimateConnectionPoolUtilization(): Promise<number> {
    try {
      // Use pg_stat_activity to check active connections
      const result = await this.prisma.$queryRaw`
        SELECT COUNT(*) as active_connections
        FROM pg_stat_activity 
        WHERE state = 'active' 
        AND application_name LIKE 'vibecode%'
      ` as [{ active_connections: bigint }];

      const activeConnections = Number(result[0].active_connections);
      const maxConnections = 20; // Default max, should be configurable
      
      return Math.min(activeConnections / maxConnections, 1.0);
    } catch (error) {
      console.warn('Failed to estimate connection pool utilization:', error);
      return 0;
    }
  }

  /**
   * Check for health-based alerts
   */
  private checkHealthAlerts(health: DatabaseHealthMetrics): void {
    // High error rate alert
    if (health.errorRate > 0.1) { // 10% error rate
      this.createAlert({
        type: 'high_error_rate',
        severity: health.errorRate > 0.2 ? 'critical' : 'warning',
        message: `High database error rate: ${Math.round(health.errorRate * 100)}%`,
        metrics: { errorRate: health.errorRate },
        timestamp: health.lastHealthCheck,
      });
    }

    // Connection pool utilization alert
    if (health.connectionPoolUtilization > 0.8) {
      this.createAlert({
        type: 'connection_pool_full',
        severity: health.connectionPoolUtilization > 0.95 ? 'critical' : 'warning',
        message: `High connection pool utilization: ${Math.round(health.connectionPoolUtilization * 100)}%`,
        metrics: { utilization: health.connectionPoolUtilization },
        timestamp: health.lastHealthCheck,
      });
    }
  }

  /**
   * Create and dispatch an alert
   */
  private createAlert(alert: PerformanceAlert): void {
    console.warn(`Database performance alert: ${alert.message}`, {
      type: alert.type,
      severity: alert.severity,
      metrics: alert.metrics,
    });

    // Dispatch to registered callbacks
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Alert callback failed:', error);
      }
    });

    // Update global metrics
    metrics.increment('db.alerts.total', {
      type: alert.type,
      severity: alert.severity,
    });
  }

  /**
   * Register an alert callback
   */
  public onAlert(callback: (alert: PerformanceAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Get recent query metrics
   */
  public getRecentMetrics(timeWindowMs: number = 300000): QueryMetrics[] {
    const cutoff = new Date(Date.now() - timeWindowMs);
    return this.queryMetrics.filter(m => m.timestamp >= cutoff);
  }

  /**
   * Get slow queries in a time window
   */
  public getSlowQueries(timeWindowMs: number = 3600000): QueryMetrics[] {
    const recentMetrics = this.getRecentMetrics(timeWindowMs);
    return recentMetrics.filter(m => m.duration >= this.slowQueryThresholds.warning);
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(timeWindowMs: number = 3600000): {
    totalQueries: number;
    avgQueryTime: number;
    slowQueries: number;
    errorRate: number;
    topSlowQueries: Array<{ query: string; avgDuration: number; count: number }>;
  } {
    const recentMetrics = this.getRecentMetrics(timeWindowMs);
    
    const totalQueries = recentMetrics.length;
    const errorCount = recentMetrics.filter(m => !m.success).length;
    const slowQueries = recentMetrics.filter(m => 
      m.duration >= this.slowQueryThresholds.warning
    ).length;

    const avgQueryTime = totalQueries > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / totalQueries 
      : 0;

    const errorRate = totalQueries > 0 ? errorCount / totalQueries : 0;

    // Aggregate slow queries by query name
    const queryStats = new Map<string, { durations: number[]; count: number }>();
    
    recentMetrics
      .filter(m => m.duration >= this.slowQueryThresholds.warning)
      .forEach(m => {
        if (!queryStats.has(m.query)) {
          queryStats.set(m.query, { durations: [], count: 0 });
        }
        const stats = queryStats.get(m.query)!;
        stats.durations.push(m.duration);
        stats.count++;
      });

    const topSlowQueries = Array.from(queryStats.entries())
      .map(([query, stats]) => ({
        query,
        avgDuration: stats.durations.reduce((sum, d) => sum + d, 0) / stats.durations.length,
        count: stats.count,
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10);

    return {
      totalQueries,
      avgQueryTime,
      slowQueries,
      errorRate,
      topSlowQueries,
    };
  }

  /**
   * Configure slow query thresholds
   */
  public setSlowQueryThresholds(thresholds: Partial<SlowQueryThresholds>): void {
    this.slowQueryThresholds = { ...this.slowQueryThresholds, ...thresholds };
    console.info('Updated slow query thresholds:', this.slowQueryThresholds);
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): {
    slowQueryThresholds: SlowQueryThresholds;
    maxMetricsHistory: number;
    alertCallbackCount: number;
  } {
    return {
      slowQueryThresholds: this.slowQueryThresholds,
      maxMetricsHistory: this.maxMetricsHistory,
      alertCallbackCount: this.alertCallbacks.length,
    };
  }

  /**
   * Clear metrics history
   */
  public clearMetrics(): void {
    this.queryMetrics = [];
    console.info('Database performance metrics cleared');
  }

  /**
   * Export metrics for external analysis
   */
  public exportMetrics(): QueryMetrics[] {
    return [...this.queryMetrics];
  }

  /**
   * Get database statistics from PostgreSQL
   */
  public async getDatabaseStatistics(): Promise<{
    totalConnections: number;
    activeConnections: number;
    longRunningQueries: number;
    databaseSize: string;
    cacheHitRatio: number;
  }> {
    try {
      const [connections, longRunning, size, cacheStats] = await Promise.all([
        // Connection statistics
        this.prisma.$queryRaw`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE state = 'active') as active
          FROM pg_stat_activity
          WHERE application_name LIKE 'vibecode%'
        ` as [{ total: bigint; active: bigint }],

        // Long running queries (> 30 seconds)
        this.prisma.$queryRaw`
          SELECT COUNT(*) as count
          FROM pg_stat_activity 
          WHERE state = 'active' 
          AND now() - query_start > interval '30 seconds'
          AND application_name LIKE 'vibecode%'
        ` as [{ count: bigint }],

        // Database size
        this.prisma.$queryRaw`
          SELECT pg_size_pretty(pg_database_size(current_database())) as size
        ` as [{ size: string }],

        // Cache hit ratio
        this.prisma.$queryRaw`
          SELECT 
            ROUND(
              (sum(heap_blks_hit) * 100.0) / 
              GREATEST(sum(heap_blks_hit) + sum(heap_blks_read), 1)
            , 2) as cache_hit_ratio
          FROM pg_statio_user_tables
        ` as [{ cache_hit_ratio: number }],
      ]);

      return {
        totalConnections: Number(connections[0].total),
        activeConnections: Number(connections[0].active),
        longRunningQueries: Number(longRunning[0].count),
        databaseSize: size[0].size,
        cacheHitRatio: cacheStats[0]?.cache_hit_ratio || 0,
      };
    } catch (error) {
      console.error('Failed to get database statistics:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const createDatabaseMonitor = (prisma: PrismaClient) => 
  new DatabasePerformanceMonitor(prisma);