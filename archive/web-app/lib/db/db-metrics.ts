/**
 * Database Metrics Collector
 * 
 * Collects and provides metrics about database operations, query performance,
 * and connection pool health for monitoring and alerting systems.
 */

import { logger } from '../logger';
import { getConnectionPoolStatus } from './robust-db-connection';

// Query metrics interface
interface QueryMetrics {
  totalQueries: number;
  totalQueriesPerSecond: number;
  avgQueryTime: number;
  p95QueryTime: number;
  p99QueryTime: number;
  errorRate: number;
  slowQueries: number;
  queriesByType: Record<string, number>;
  queriesByTable: Record<string, number>;
}

// Query timing data
interface QueryTiming {
  query: string;
  duration: number;
  success: boolean;
  timestamp: number;
  type: string;
  table?: string;
  error?: string;
}

/**
 * Database Metrics Collector Class
 */
class DatabaseMetricsCollector {
  private queryTimings: QueryTiming[] = [];
  private startTime: number = Date.now();
  private maxStoredQueries: number = 1000;
  
  // Connection metrics
  private connectionMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    poolUtilization: 0
  };

  /**
   * Record a database query for metrics collection
   */
  public recordQuery(
    query: string,
    duration: number,
    successOrOptions: boolean | Record<string, unknown> = true,
    maybeOptions?: Record<string, unknown> | Error
  ): void {
    const success = typeof successOrOptions === 'boolean' ? successOrOptions : true;
    let options: Record<string, unknown> = {};
    if (typeof successOrOptions === 'object' && successOrOptions !== null && typeof successOrOptions !== 'boolean') {
      options = successOrOptions as Record<string, unknown>;
    }
    if (maybeOptions instanceof Error) {
      options = { ...options, error: maybeOptions.message };
    } else if (maybeOptions && typeof maybeOptions === 'object') {
      options = { ...options, ...(maybeOptions as Record<string, unknown>) };
    }

    const timing: QueryTiming = {
      query: query.substring(0, 200), // Truncate long queries
      duration,
      success,
      timestamp: Date.now(),
      type: typeof options.type === 'string' ? (options.type as string) : this.extractQueryType(query),
      table: typeof options.table === 'string' ? (options.table as string) : this.extractTableName(query),
      error: typeof options.error === 'string' ? (options.error as string) : undefined
    };
    
    this.queryTimings.push(timing);
    
    // Keep only recent queries to prevent memory leaks
    if (this.queryTimings.length > this.maxStoredQueries) {
      this.queryTimings = this.queryTimings.slice(-this.maxStoredQueries);
    }
    
    // Log slow queries
    if (duration > 1000) { // Queries taking more than 1 second
      logger.warn('Slow database query detected', {
        query: timing.query,
        duration: timing.duration,
        type: timing.type,
        table: timing.table
      });
    }
  }

  /**
   * Extract query type from SQL string
   */
  private extractQueryType(query: string): string {
    const normalizedQuery = query.trim().toUpperCase();
    
    if (normalizedQuery.startsWith('SELECT')) return 'SELECT';
    if (normalizedQuery.startsWith('INSERT')) return 'INSERT';
    if (normalizedQuery.startsWith('UPDATE')) return 'UPDATE';
    if (normalizedQuery.startsWith('DELETE')) return 'DELETE';
    if (normalizedQuery.startsWith('CREATE')) return 'CREATE';
    if (normalizedQuery.startsWith('DROP')) return 'DROP';
    if (normalizedQuery.startsWith('ALTER')) return 'ALTER';
    if (normalizedQuery.startsWith('WITH')) return 'CTE'; // Common Table Expression
    
    return 'OTHER';
  }

  /**
   * Extract table name from SQL query (basic implementation)
   */
  private extractTableName(query: string): string | undefined {
    const normalizedQuery = query.trim().toUpperCase();
    
    // Simple regex patterns for common queries
    const patterns = [
      /FROM\s+([`"]?)(\w+)\1/i,
      /INTO\s+([`"]?)(\w+)\1/i,
      /UPDATE\s+([`"]?)(\w+)\1/i,
      /DELETE\s+FROM\s+([`"]?)(\w+)\1/i,
      /CREATE\s+TABLE\s+([`"]?)(\w+)\1/i
    ];
    
    for (const pattern of patterns) {
      const match = normalizedQuery.match(pattern);
      if (match && match[2]) {
        return match[2].toLowerCase();
      }
    }
    
    return undefined;
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Get comprehensive database metrics
   */
  public getMetrics(): QueryMetrics {
    const now = Date.now();
    const timeWindow = 300000; // 5 minutes
    const recentQueries = this.queryTimings.filter(
      q => now - q.timestamp <= timeWindow
    );
    
    if (recentQueries.length === 0) {
      return {
        totalQueries: 0,
        totalQueriesPerSecond: 0,
        avgQueryTime: 0,
        p95QueryTime: 0,
        p99QueryTime: 0,
        errorRate: 0,
        slowQueries: 0,
        queriesByType: {},
        queriesByTable: {}
      };
    }
    
    // Calculate basic metrics
    const totalQueries = recentQueries.length;
    const timeSpanSeconds = Math.max(1, timeWindow / 1000);
    const totalQueriesPerSecond = totalQueries / timeSpanSeconds;
    
    // Calculate timing metrics
    const durations = recentQueries.map(q => q.duration).sort((a, b) => a - b);
    const avgQueryTime = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const p95QueryTime = this.calculatePercentile(durations, 95);
    const p99QueryTime = this.calculatePercentile(durations, 99);
    
    // Calculate error rate
    const errorCount = recentQueries.filter(q => !q.success).length;
    const errorRate = totalQueries > 0 ? errorCount / totalQueries : 0;
    
    // Count slow queries (> 1 second)
    const slowQueries = recentQueries.filter(q => q.duration > 1000).length;
    
    // Group by query type
    const queriesByType: Record<string, number> = {};
    recentQueries.forEach(q => {
      queriesByType[q.type] = (queriesByType[q.type] || 0) + 1;
    });
    
    // Group by table
    const queriesByTable: Record<string, number> = {};
    recentQueries.forEach(q => {
      if (q.table) {
        queriesByTable[q.table] = (queriesByTable[q.table] || 0) + 1;
      }
    });
    
    return {
      totalQueries,
      totalQueriesPerSecond,
      avgQueryTime,
      p95QueryTime,
      p99QueryTime,
      errorRate,
      slowQueries,
      queriesByType,
      queriesByTable
    };
  }

  /**
   * Update connection metrics from pool status
   */
  public setConnectionMetrics(
    totalConnections: number,
    activeConnections: number,
    idleConnections: number,
    poolUtilization: number
  ): void {
    this.connectionMetrics = {
      totalConnections,
      activeConnections,
      idleConnections,
      poolUtilization
    };
  }

  /**
   * Get connection pool metrics
   */
  public getConnectionMetrics() {
    return { ...this.connectionMetrics };
  }

  /**
   * Get recent query history for debugging
   */
  public getRecentQueries(limit: number = 50): QueryTiming[] {
    return this.queryTimings
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get slow queries for optimization
   */
  public getSlowQueries(threshold: number = 1000, limit: number = 20): QueryTiming[] {
    return this.queryTimings
      .filter(q => q.duration > threshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Reset all metrics (useful for testing)
   */
  public reset(): void {
    this.queryTimings = [];
    this.startTime = Date.now();
    this.connectionMetrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      poolUtilization: 0
    };
    
    logger.info('Database metrics collector reset');
  }

  /**
   * Get uptime in seconds
   */
  public getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Export metrics in Prometheus format
   */
  public toPrometheusFormat(): string {
    const metrics = this.getMetrics();
    const timestamp = Date.now();
    const lines: string[] = [];

    // Query metrics
    lines.push(`# HELP db_queries_total Total number of database queries`);
    lines.push(`# TYPE db_queries_total counter`);
    lines.push(`db_queries_total ${metrics.totalQueries} ${timestamp}`);

    lines.push(`# HELP db_query_duration_avg Average query duration in ms`);
    lines.push(`# TYPE db_query_duration_avg gauge`);
    lines.push(`db_query_duration_avg ${metrics.avgQueryTime} ${timestamp}`);

    lines.push(`# HELP db_query_duration_p95 95th percentile query duration in ms`);
    lines.push(`# TYPE db_query_duration_p95 gauge`);
    lines.push(`db_query_duration_p95 ${metrics.p95QueryTime} ${timestamp}`);

    lines.push(`# HELP db_query_error_rate Query error rate`);
    lines.push(`# TYPE db_query_error_rate gauge`);
    lines.push(`db_query_error_rate ${metrics.errorRate} ${timestamp}`);

    // Connection metrics
    const connMetrics = this.getConnectionMetrics();
    lines.push(`# HELP db_connections_total Total database connections`);
    lines.push(`# TYPE db_connections_total gauge`);
    lines.push(`db_connections_total ${connMetrics.totalConnections} ${timestamp}`);

    lines.push(`# HELP db_connections_active Active database connections`);
    lines.push(`# TYPE db_connections_active gauge`);
    lines.push(`db_connections_active ${connMetrics.activeConnections} ${timestamp}`);

    lines.push(`# HELP db_pool_utilization Connection pool utilization percentage`);
    lines.push(`# TYPE db_pool_utilization gauge`);
    lines.push(`db_pool_utilization ${connMetrics.poolUtilization} ${timestamp}`);

    return lines.join('\n') + '\n';
  }
}

// Global singleton instance
let metricsCollector: DatabaseMetricsCollector | null = null;

/**
 * Get the global database metrics collector instance
 */
export function getDatabaseMetricsCollector(): DatabaseMetricsCollector {
  if (!metricsCollector) {
    metricsCollector = new DatabaseMetricsCollector();
    logger.info('Database metrics collector initialized');
  }
  return metricsCollector;
}

/**
 * Create a middleware function for automatic query tracking
 * This can be used with Prisma middleware to automatically track all queries
 */
export function createQueryTrackingMiddleware() {
  const collector = getDatabaseMetricsCollector();
  
  return async (params: any, next: any) => {
    const startTime = Date.now();
    let success = true;
    let error: string | undefined;
    
    try {
      const result = await next(params);
      return result;
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const duration = Date.now() - startTime;
      
      // Record the query metrics
      collector.recordQuery(
        `${params.model}.${params.action}`,
        duration,
        success,
        {
          type: params.action?.toUpperCase(),
          table: params.model,
          error
        }
      );
    }
  };
}

// Export types
export type { QueryMetrics, QueryTiming };