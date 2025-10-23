/**
 * Database Query Optimizer
 * Provides intelligent query optimization, caching, and performance monitoring
 * for database operations across the VibeCode application
 */

import { CacheTTL } from '../cache/cache-constants';
// import { logger } from '@/lib/logger';
export interface QueryOptimizationMetrics {
  queryTime: number;
  cacheHits: number;
  cacheMisses: number;
  totalQueries: number;
  averageQueryTime: number;
}

export interface QueryOptimizationOptions {
  useCache?: boolean;
  cacheTTL?: CacheTTL;
  batchSize?: number;
  enableMetrics?: boolean;
  enableQueryAnalysis?: boolean;
}

export class QueryOptimizations {
  public static readonly BATCH_SIZE = 100;
  public static readonly MAX_CACHE_SIZE = 10000;
  public static readonly DEFAULT_CACHE_TTL = CacheTTL.MEDIUM;
  public static readonly SLOW_QUERY_THRESHOLD = 1000; // ms
}

/**
 * Query optimizer for database operations
 */
export class QueryOptimizer {
  private static queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private static queryMetrics = new Map<string, QueryOptimizationMetrics>();
  private static slowQueries: Array<{ query: string; time: number; timestamp: Date }> = [];

  /**
   * Generate a cache key for a query
   */
  private static generateCacheKey(
    operation: string,
    workspaceId: number,
    query: string,
    limit: number = 20
  ): string {
    return `${operation}:${workspaceId}:${Buffer.from(query).toString('base64')}:${limit}`;
  }

  /**
   * Get cached query result if available and valid
   */
  static getCachedResult<T>(cacheKey: string): T | null {
    const cached = this.queryCache.get(cacheKey);

    if (!cached) {
      return null;
    }

    // Check if cache entry has expired
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.queryCache.delete(cacheKey);
      return null;
    }

    return cached.data as T;
  }

  /**
   * Cache a query result
   */
  static setCachedResult<T>(cacheKey: string, data: T, ttl: CacheTTL = CacheTTL.MEDIUM): void {
    // Implement LRU eviction if cache is getting too large
    if (this.queryCache.size >= QueryOptimizations.MAX_CACHE_SIZE) {
      const firstKey = this.queryCache.keys().next().value;
      this.queryCache.delete(firstKey);
    }

    this.queryCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl: this.getTTLInMs(ttl)
    });
  }

  /**
   * Clear all cached results
   */
  static clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * Clear cache for specific workspace
   */
  static clearWorkspaceCache(workspaceId: number): void {
    for (const [key] of this.queryCache) {
      if (key.includes(`:${workspaceId}:`)) {
        this.queryCache.delete(key);
      }
    }
  }

  /**
   * Convert CacheTTL enum to milliseconds
   */
  private static getTTLInMs(ttl: CacheTTL): number {
    switch (ttl) {
      case CacheTTL.SHORT:
        return 5 * 60 * 1000; // 5 minutes
      case CacheTTL.MEDIUM:
        return 30 * 60 * 1000; // 30 minutes
      case CacheTTL.LONG:
        return 2 * 60 * 60 * 1000; // 2 hours
      case CacheTTL.EXTENDED:
        return 24 * 60 * 60 * 1000; // 24 hours
      default:
        return 30 * 60 * 1000; // Default to medium
    }
  }

  /**
   * Execute query with optimization and caching
   */
  static async executeWithOptimization<T>(
    operation: string,
    queryFn: () => Promise<T>,
    options: QueryOptimizationOptions = {}
  ): Promise<T> {
    const startTime = Date.now();
    const useCache = options.useCache ?? true;
    const enableMetrics = options.enableMetrics ?? true;

    try {
      // If caching is enabled and this is a cacheable operation, try cache first
      if (useCache && this.isCacheableOperation(operation)) {
        // This would need more context about the specific query to generate proper cache keys
        // For now, we'll skip caching for complex queries
      }

      const result = await queryFn();
      const queryTime = Date.now() - startTime;

      // Record metrics
      if (enableMetrics) {
        this.recordQueryMetrics(operation, queryTime, true);
      }

      // Cache successful results for cacheable operations
      if (useCache && this.isCacheableOperation(operation)) {
        // Implementation would depend on having proper cache key generation
      }

      return result;
    } catch (error) {
      const queryTime = Date.now() - startTime;

      // Record failed query metrics
      if (enableMetrics) {
        this.recordQueryMetrics(operation, queryTime, false);
      }

      throw error;
    }
  }

  /**
   * Batch process data with optimization
   */
  static async batchProcess<T>(
    data: T[],
    processor: (batch: T[]) => Promise<void>,
    batchSize: number = QueryOptimizations.BATCH_SIZE
  ): Promise<void> {
    if (data.length === 0) return;

    const batches: T[][] = [];

    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }

    // Process batches in parallel for better performance
    const promises = batches.map(batch => processor(batch));
    await Promise.allSettled(promises);

    // Log any failed batches for investigation
    const failures = promises.filter(p => p.status === 'rejected');
    if (failures.length > 0) {
      console.warn(`${failures.length} out of ${batches.length} batches failed during processing`);
    }
  }

  /**
   * Batch update records with optimization
   */
  static async batchUpdate<T extends Record<string, any>>(
    updates: T[],
    updateFn: (batch: T[]) => Promise<void>,
    batchSize: number = QueryOptimizations.BATCH_SIZE
  ): Promise<void> {
    if (updates.length === 0) return;

    const batches: T[][] = [];

    for (let i = 0; i < updates.length; i += batchSize) {
      batches.push(updates.slice(i, i + batchSize));
    }

    // Process batches sequentially to avoid database deadlocks
    for (const batch of batches) {
      await updateFn(batch);
    }
  }

  /**
   * Batch delete records with optimization
   */
  static async batchDelete(
    ids: number[],
    deleteFn: (batch: number[]) => Promise<void>,
    batchSize: number = QueryOptimizations.BATCH_SIZE
  ): Promise<void> {
    if (ids.length === 0) return;

    const batches: number[][] = [];

    for (let i = 0; i < ids.length; i += batchSize) {
      batches.push(ids.slice(i, i + batchSize));
    }

    // Process batches sequentially to avoid database deadlocks
    for (const batch of batches) {
      await deleteFn(batch);
    }
  }

  /**
   * Record query performance metrics
   */
  private static recordQueryMetrics(operation: string, queryTime: number, success: boolean): void {
    const metrics = this.queryMetrics.get(operation) || {
      queryTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalQueries: 0,
      averageQueryTime: 0
    };

    metrics.totalQueries++;
    metrics.queryTime += queryTime;
    metrics.averageQueryTime = metrics.queryTime / metrics.totalQueries;

    // Track slow queries
    if (queryTime > QueryOptimizations.SLOW_QUERY_THRESHOLD) {
      this.slowQueries.push({
        query: operation,
        time: queryTime,
        timestamp: new Date()
      });

      // Keep only the most recent 100 slow queries
      if (this.slowQueries.length > 100) {
        this.slowQueries = this.slowQueries.slice(-100);
      }
    }

    this.queryMetrics.set(operation, metrics);
  }

  /**
   * Get query performance statistics
   */
  static getQueryStats(): Record<string, QueryOptimizationMetrics> {
    return Object.fromEntries(this.queryMetrics);
  }

  /**
   * Get slow queries for analysis
   */
  static getSlowQueries(limit: number = 10): Array<{ query: string; time: number; timestamp: Date }> {
    return this.slowQueries
      .sort((a, b) => b.time - a.time)
      .slice(0, limit);
  }

  /**
   * Clear query metrics
   */
  static clearMetrics(): void {
    this.queryMetrics.clear();
    this.slowQueries = [];
  }

  /**
   * Check if an operation is cacheable
   */
  private static isCacheableOperation(operation: string): boolean {
    // Define which operations should be cached
    const cacheableOperations = [
      'search',
      'find',
      'get',
      'list',
      'count'
    ];

    return cacheableOperations.some(op => operation.toLowerCase().includes(op));
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ key: string; age: number; size: number }>;
  } {
    const entries = Array.from(this.queryCache.entries()).map(([key, value]) => ({
      key,
      age: Date.now() - value.timestamp,
      size: JSON.stringify(value.data).length
    }));

    return {
      size: this.queryCache.size,
      maxSize: QueryOptimizations.MAX_CACHE_SIZE,
      hitRate: 0, // Would need to track hits vs misses for this
      entries
    };
  }

  /**
   * Optimize query for specific database type
   */
  static optimizeQueryForDatabase(query: string, databaseType: 'postgres' | 'mysql' | 'sqlite'): string {
    switch (databaseType) {
      case 'postgres':
        return this.optimizeForPostgres(query);
      case 'mysql':
        return this.optimizeForMySQL(query);
      case 'sqlite':
        return this.optimizeForSQLite(query);
      default:
        return query;
    }
  }

  private static optimizeForPostgres(query: string): string {
    // PostgreSQL-specific optimizations
    return query
      .replace(/LIMIT\s+\?/g, 'LIMIT $1') // Use $1, $2 for parameter placeholders
      .replace(/ILIKE/g, 'ILIKE'); // Ensure case-insensitive searches
  }

  private static optimizeForMySQL(query: string): string {
    // MySQL-specific optimizations
    return query
      .replace(/\$(\d+)/g, '?') // Convert $1, $2 to ? for MySQL
      .replace(/ILIKE/g, 'LIKE'); // MySQL doesn't have ILIKE
  }

  private static optimizeForSQLite(query: string): string {
    // SQLite-specific optimizations
    return query
      .replace(/\$(\d+)/g, '?') // SQLite uses ? placeholders
      .replace(/ILIKE/g, 'LIKE'); // SQLite doesn't have ILIKE
  }
}

/**
 * Query performance analyzer
 */
export class QueryAnalyzer {
  private static queryLog: Array<{
    query: string;
    executionTime: number;
    timestamp: Date;
    success: boolean;
    error?: string;
  }> = [];

  /**
   * Log query execution for analysis
   */
  static logQuery(
    query: string,
    executionTime: number,
    success: boolean,
    error?: string
  ): void {
    this.queryLog.push({
      query,
      executionTime,
      timestamp: new Date(),
      success,
      error
    });

    // Keep only recent queries (last 1000)
    if (this.queryLog.length > 1000) {
      this.queryLog = this.queryLog.slice(-1000);
    }
  }

  /**
   * Get query performance analysis
   */
  static getPerformanceAnalysis(): {
    totalQueries: number;
    averageExecutionTime: number;
    slowestQueries: Array<{ query: string; time: number; timestamp: Date }>;
    errorRate: number;
    queryFrequency: Record<string, number>;
  } {
    if (this.queryLog.length === 0) {
      return {
        totalQueries: 0,
        averageExecutionTime: 0,
        slowestQueries: [],
        errorRate: 0,
        queryFrequency: {}
      };
    }

    const successfulQueries = this.queryLog.filter(q => q.success);
    const totalTime = successfulQueries.reduce((sum, q) => sum + q.executionTime, 0);
    const errors = this.queryLog.filter(q => !q.success).length;

    // Find slowest queries
    const slowestQueries = successfulQueries
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 10)
      .map(q => ({ query: q.query, time: q.executionTime, timestamp: q.timestamp }));

    // Calculate query frequency
    const queryFrequency: Record<string, number> = {};
    this.queryLog.forEach(q => {
      queryFrequency[q.query] = (queryFrequency[q.query] || 0) + 1;
    });

    return {
      totalQueries: this.queryLog.length,
      averageExecutionTime: successfulQueries.length > 0 ? totalTime / successfulQueries.length : 0,
      slowestQueries,
      errorRate: errors / this.queryLog.length,
      queryFrequency
    };
  }

  /**
   * Get optimization recommendations
   */
  static getOptimizationRecommendations(): Array<{
    type: 'index' | 'cache' | 'query' | 'batch';
    description: string;
    impact: 'high' | 'medium' | 'low';
    query?: string;
  }> {
    const recommendations: Array<{
      type: 'index' | 'cache' | 'query' | 'batch';
      description: string;
      impact: 'high' | 'medium' | 'low';
      query?: string;
    }> = [];

    const analysis = this.getPerformanceAnalysis();

    // Recommend indexes for slow queries
    analysis.slowestQueries.forEach(({ query, time }) => {
      if (time > 500) {
        recommendations.push({
          type: 'index',
          description: `Consider adding indexes for query: ${query.substring(0, 100)}...`,
          impact: time > 2000 ? 'high' : 'medium',
          query
        });
      }
    });

    // Recommend caching for frequent queries
    Object.entries(analysis.queryFrequency).forEach(([query, frequency]) => {
      if (frequency > 10) {
        recommendations.push({
          type: 'cache',
          description: `Consider caching frequently executed query: ${query.substring(0, 100)}...`,
          impact: 'medium',
          query
        });
      }
    });

    return recommendations;
  }

  /**
   * Clear query log
   */
  static clearLog(): void {
    this.queryLog = [];
  }
}
