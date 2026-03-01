/**
 * Tests for Query Optimizer Module
 *
 * Tests caching behavior, batch operations, metrics tracking,
 * database-specific optimizations, and performance analysis.
 */

import {
  QueryOptimizer,
  QueryAnalyzer,
  QueryOptimizations,
  QueryOptimizationOptions,
  QueryOptimizationMetrics
} from '../../../../src/lib/database/query-optimizer';
import { CacheTTL } from '../../../../src/lib/cache/cache-constants';

describe('QueryOptimizer', () => {
  beforeEach(() => {
    // Clear all caches and metrics before each test
    QueryOptimizer.clearCache();
    QueryOptimizer.clearMetrics();
    jest.clearAllMocks();
  });

  describe('Cache Operations', () => {
    it('should cache and retrieve query results', () => {
      const cacheKey = 'test:key:123';
      const testData = { id: 1, name: 'Test Data' };

      QueryOptimizer.setCachedResult(cacheKey, testData);
      const result = QueryOptimizer.getCachedResult(cacheKey);

      expect(result).toEqual(testData);
    });

    it('should return null for non-existent cache key', () => {
      const result = QueryOptimizer.getCachedResult('non-existent-key');
      expect(result).toBeNull();
    });

    it('should respect cache TTL and expire old entries', () => {
      jest.useFakeTimers();
      const cacheKey = 'test:key:ttl';
      const testData = { id: 1, name: 'Test Data' };

      QueryOptimizer.setCachedResult(cacheKey, testData, CacheTTL.SHORT);

      // Should be available immediately
      expect(QueryOptimizer.getCachedResult(cacheKey)).toEqual(testData);

      // Fast-forward past TTL (5 minutes + 1ms)
      jest.advanceTimersByTime(5 * 60 * 1000 + 1);

      // Should be expired
      expect(QueryOptimizer.getCachedResult(cacheKey)).toBeNull();

      jest.useRealTimers();
    });

    it('should clear all cached results', () => {
      QueryOptimizer.setCachedResult('key1', { data: 1 });
      QueryOptimizer.setCachedResult('key2', { data: 2 });

      QueryOptimizer.clearCache();

      expect(QueryOptimizer.getCachedResult('key1')).toBeNull();
      expect(QueryOptimizer.getCachedResult('key2')).toBeNull();
    });

    it('should clear cache for specific workspace', () => {
      QueryOptimizer.setCachedResult('search:100:abc:20', { data: 1 });
      QueryOptimizer.setCachedResult('search:200:def:20', { data: 2 });
      QueryOptimizer.setCachedResult('search:100:ghi:20', { data: 3 });

      QueryOptimizer.clearWorkspaceCache(100);

      expect(QueryOptimizer.getCachedResult('search:100:abc:20')).toBeNull();
      expect(QueryOptimizer.getCachedResult('search:100:ghi:20')).toBeNull();
      expect(QueryOptimizer.getCachedResult('search:200:def:20')).toEqual({ data: 2 });
    });

    it('should implement LRU eviction when cache exceeds max size', () => {
      const maxSize = QueryOptimizations.MAX_CACHE_SIZE;

      // Fill cache to max size
      for (let i = 0; i < maxSize; i++) {
        QueryOptimizer.setCachedResult(`key:${i}`, { id: i });
      }

      // Add one more item - should evict the first key
      QueryOptimizer.setCachedResult('new-key', { id: 'new' });

      const stats = QueryOptimizer.getCacheStats();
      expect(stats.size).toBe(maxSize);
      expect(QueryOptimizer.getCachedResult('key:0')).toBeNull();
      expect(QueryOptimizer.getCachedResult('new-key')).toEqual({ id: 'new' });
    });

    it('should cache with different TTL values', () => {
      jest.useFakeTimers();

      QueryOptimizer.setCachedResult('short', { data: 1 }, CacheTTL.SHORT);
      QueryOptimizer.setCachedResult('medium', { data: 2 }, CacheTTL.MEDIUM);
      QueryOptimizer.setCachedResult('long', { data: 3 }, CacheTTL.LONG);
      QueryOptimizer.setCachedResult('very-long', { data: 4 }, CacheTTL.VERY_LONG);

      // After 6 minutes, SHORT should expire, others should remain
      jest.advanceTimersByTime(6 * 60 * 1000);

      expect(QueryOptimizer.getCachedResult('short')).toBeNull();
      expect(QueryOptimizer.getCachedResult('medium')).toEqual({ data: 2 });
      expect(QueryOptimizer.getCachedResult('long')).toEqual({ data: 3 });
      expect(QueryOptimizer.getCachedResult('very-long')).toEqual({ data: 4 });

      jest.useRealTimers();
    });

    it('should return cache statistics', () => {
      QueryOptimizer.setCachedResult('key1', { data: 'value1' });
      QueryOptimizer.setCachedResult('key2', { data: 'value2' });

      const stats = QueryOptimizer.getCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(QueryOptimizations.MAX_CACHE_SIZE);
      expect(stats.entries).toHaveLength(2);
      expect(stats.entries[0]).toHaveProperty('key');
      expect(stats.entries[0]).toHaveProperty('age');
      expect(stats.entries[0]).toHaveProperty('size');
    });
  });

  describe('Batch Operations', () => {
    it('should process batches in parallel', async () => {
      const data = Array.from({ length: 250 }, (_, i) => i);
      const processedBatches: number[][] = [];
      const processor = jest.fn(async (batch: number[]) => {
        processedBatches.push(batch);
      });

      await QueryOptimizer.batchProcess(data, processor, 100);

      // Should create 3 batches (100, 100, 50)
      expect(processedBatches).toHaveLength(3);
      expect(processedBatches[0]).toHaveLength(100);
      expect(processedBatches[1]).toHaveLength(100);
      expect(processedBatches[2]).toHaveLength(50);
      expect(processor).toHaveBeenCalledTimes(3);
    });

    it('should handle empty data array in batchProcess', async () => {
      const processor = jest.fn();
      await QueryOptimizer.batchProcess([], processor);
      expect(processor).not.toHaveBeenCalled();
    });

    it('should log failures in batchProcess but continue', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const data = [1, 2, 3, 4, 5];
      const processor = jest.fn()
        .mockRejectedValueOnce(new Error('Batch 1 failed'))
        .mockResolvedValueOnce(undefined);

      await QueryOptimizer.batchProcess(data, processor, 3);

      expect(processor).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('1 out of 2 batches failed')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should process batch updates sequentially', async () => {
      const updates = [
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' },
        { id: 3, name: 'User 3' }
      ];
      const processedBatches: typeof updates[] = [];
      const updateFn = jest.fn(async (batch: typeof updates) => {
        processedBatches.push(batch);
      });

      await QueryOptimizer.batchUpdate(updates, updateFn, 2);

      // Should create 2 batches (2, 1)
      expect(processedBatches).toHaveLength(2);
      expect(processedBatches[0]).toHaveLength(2);
      expect(processedBatches[1]).toHaveLength(1);
      expect(updateFn).toHaveBeenCalledTimes(2);
    });

    it('should handle empty updates array in batchUpdate', async () => {
      const updateFn = jest.fn();
      await QueryOptimizer.batchUpdate([], updateFn);
      expect(updateFn).not.toHaveBeenCalled();
    });

    it('should process batch deletes sequentially', async () => {
      const ids = [1, 2, 3, 4, 5];
      const processedBatches: number[][] = [];
      const deleteFn = jest.fn(async (batch: number[]) => {
        processedBatches.push(batch);
      });

      await QueryOptimizer.batchDelete(ids, deleteFn, 2);

      // Should create 3 batches (2, 2, 1)
      expect(processedBatches).toHaveLength(3);
      expect(processedBatches[0]).toHaveLength(2);
      expect(processedBatches[1]).toHaveLength(2);
      expect(processedBatches[2]).toHaveLength(1);
      expect(deleteFn).toHaveBeenCalledTimes(3);
    });

    it('should handle empty ids array in batchDelete', async () => {
      const deleteFn = jest.fn();
      await QueryOptimizer.batchDelete([], deleteFn);
      expect(deleteFn).not.toHaveBeenCalled();
    });

    it('should use default batch size if not specified', async () => {
      const data = Array.from({ length: 250 }, (_, i) => i);
      const processor = jest.fn(async () => {});

      await QueryOptimizer.batchProcess(data, processor);

      // Default batch size is 100, so 250 items = 3 batches
      expect(processor).toHaveBeenCalledTimes(3);
    });
  });

  describe('Query Metrics', () => {
    it('should record query metrics', async () => {
      const queryFn = jest.fn().mockResolvedValue({ data: 'result' });

      await QueryOptimizer.executeWithOptimization('search-users', queryFn, {
        useCache: false,
        enableMetrics: true
      });

      const stats = QueryOptimizer.getQueryStats();
      expect(stats['search-users']).toBeDefined();
      expect(stats['search-users'].totalQueries).toBe(1);
      expect(stats['search-users'].averageQueryTime).toBeGreaterThanOrEqual(0);
    });

    it('should track slow queries above threshold', async () => {
      const slowQueryFn = jest.fn(async () => {
        // Simulate slow query
        await new Promise(resolve => setTimeout(resolve, 1100));
        return { data: 'result' };
      });

      await QueryOptimizer.executeWithOptimization('slow-search', slowQueryFn, {
        useCache: false,
        enableMetrics: true
      });

      const slowQueries = QueryOptimizer.getSlowQueries();
      expect(slowQueries.length).toBeGreaterThan(0);
      expect(slowQueries[0].query).toBe('slow-search');
      expect(slowQueries[0].time).toBeGreaterThan(QueryOptimizations.SLOW_QUERY_THRESHOLD);
    });

    it('should limit slow queries to 100 most recent', async () => {
      // Mock Date.now to simulate slow queries without waiting
      const originalDateNow = Date.now;
      let mockTime = 0;
      Date.now = jest.fn(() => {
        mockTime += 1100; // Each query takes 1100ms
        return mockTime;
      });

      // Simulate 150 slow queries
      for (let i = 0; i < 150; i++) {
        const slowQueryFn = jest.fn().mockResolvedValue({ data: i });

        await QueryOptimizer.executeWithOptimization(`slow-query-${i}`, slowQueryFn, {
          useCache: false,
          enableMetrics: true
        });
      }

      const slowQueries = QueryOptimizer.getSlowQueries(200);
      expect(slowQueries.length).toBe(100); // Should keep only 100 most recent

      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('should calculate average query time correctly', async () => {
      const queryFn1 = jest.fn().mockResolvedValue({ data: 1 });
      const queryFn2 = jest.fn().mockResolvedValue({ data: 2 });

      await QueryOptimizer.executeWithOptimization('test-op', queryFn1);
      await QueryOptimizer.executeWithOptimization('test-op', queryFn2);

      const stats = QueryOptimizer.getQueryStats();
      expect(stats['test-op'].totalQueries).toBe(2);
      expect(stats['test-op'].averageQueryTime).toBeGreaterThanOrEqual(0);
    });

    it('should clear metrics and slow queries', async () => {
      const queryFn = jest.fn().mockResolvedValue({ data: 'result' });
      await QueryOptimizer.executeWithOptimization('test-op', queryFn);

      QueryOptimizer.clearMetrics();

      const stats = QueryOptimizer.getQueryStats();
      const slowQueries = QueryOptimizer.getSlowQueries();

      expect(Object.keys(stats)).toHaveLength(0);
      expect(slowQueries).toHaveLength(0);
    });

    it('should return slow queries sorted by time and limited', async () => {
      // Create multiple slow queries with different times
      for (let i = 0; i < 5; i++) {
        const slowQueryFn = jest.fn(async () => {
          await new Promise(resolve => setTimeout(resolve, 1000 + i * 100));
          return { data: i };
        });

        await QueryOptimizer.executeWithOptimization(`query-${i}`, slowQueryFn, {
          useCache: false,
          enableMetrics: true
        });
      }

      const slowQueries = QueryOptimizer.getSlowQueries(3);
      expect(slowQueries.length).toBe(3);
      // Should be sorted by time descending
      expect(slowQueries[0].time).toBeGreaterThanOrEqual(slowQueries[1].time);
      expect(slowQueries[1].time).toBeGreaterThanOrEqual(slowQueries[2].time);
    });
  });

  describe('Execute with Optimization', () => {
    it('should execute query and return result', async () => {
      const expectedResult = { id: 1, data: 'test' };
      const queryFn = jest.fn().mockResolvedValue(expectedResult);

      const result = await QueryOptimizer.executeWithOptimization('test-op', queryFn);

      expect(result).toEqual(expectedResult);
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('should record metrics on successful query', async () => {
      const queryFn = jest.fn().mockResolvedValue({ data: 'result' });

      await QueryOptimizer.executeWithOptimization('test-op', queryFn, {
        enableMetrics: true
      });

      const stats = QueryOptimizer.getQueryStats();
      expect(stats['test-op']).toBeDefined();
      expect(stats['test-op'].totalQueries).toBe(1);
    });

    it('should record metrics on failed query and rethrow error', async () => {
      const error = new Error('Query failed');
      const queryFn = jest.fn().mockRejectedValue(error);

      await expect(
        QueryOptimizer.executeWithOptimization('test-op', queryFn, {
          enableMetrics: true
        })
      ).rejects.toThrow('Query failed');

      const stats = QueryOptimizer.getQueryStats();
      expect(stats['test-op']).toBeDefined();
      expect(stats['test-op'].totalQueries).toBe(1);
    });

    it('should not record metrics when disabled', async () => {
      const queryFn = jest.fn().mockResolvedValue({ data: 'result' });

      await QueryOptimizer.executeWithOptimization('test-op', queryFn, {
        enableMetrics: false
      });

      const stats = QueryOptimizer.getQueryStats();
      expect(stats['test-op']).toBeUndefined();
    });

    it('should handle errors and still record metrics', async () => {
      const error = new Error('Database error');
      const queryFn = jest.fn().mockRejectedValue(error);

      await expect(
        QueryOptimizer.executeWithOptimization('failing-op', queryFn)
      ).rejects.toThrow('Database error');

      const stats = QueryOptimizer.getQueryStats();
      expect(stats['failing-op']).toBeDefined();
      expect(stats['failing-op'].totalQueries).toBe(1);
    });
  });

  describe('Database-Specific Optimizations', () => {
    it('should optimize queries for PostgreSQL', () => {
      const query = 'SELECT * FROM users WHERE name ILIKE ? LIMIT ?';
      const optimized = QueryOptimizer.optimizeQueryForDatabase(query, 'postgres');

      expect(optimized).toContain('LIMIT $1');
      expect(optimized).toContain('ILIKE');
    });

    it('should optimize queries for MySQL', () => {
      const query = 'SELECT * FROM users WHERE name ILIKE $1 LIMIT $2';
      const optimized = QueryOptimizer.optimizeQueryForDatabase(query, 'mysql');

      expect(optimized).not.toContain('$1');
      expect(optimized).toContain('?');
      expect(optimized).toContain('LIKE');
      expect(optimized).not.toContain('ILIKE');
    });

    it('should optimize queries for SQLite', () => {
      const query = 'SELECT * FROM users WHERE name ILIKE $1 LIMIT $2';
      const optimized = QueryOptimizer.optimizeQueryForDatabase(query, 'sqlite');

      expect(optimized).not.toContain('$1');
      expect(optimized).toContain('?');
      expect(optimized).toContain('LIKE');
      expect(optimized).not.toContain('ILIKE');
    });

    it('should handle multiple parameter placeholders in PostgreSQL', () => {
      const query = 'SELECT * FROM users WHERE name = ? AND age = ? LIMIT ?';
      const optimized = QueryOptimizer.optimizeQueryForDatabase(query, 'postgres');

      expect(optimized).toContain('LIMIT $1');
    });

    it('should handle multiple parameter placeholders in MySQL', () => {
      const query = 'SELECT * FROM users WHERE name = $1 AND age = $2 LIMIT $3';
      const optimized = QueryOptimizer.optimizeQueryForDatabase(query, 'mysql');

      expect(optimized).toBe('SELECT * FROM users WHERE name = ? AND age = ? LIMIT ?');
    });
  });

  describe('Cache Statistics', () => {
    it('should provide accurate cache statistics', () => {
      QueryOptimizer.setCachedResult('key1', { data: 'small' });
      QueryOptimizer.setCachedResult('key2', { data: 'larger data here' });

      const stats = QueryOptimizer.getCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(QueryOptimizations.MAX_CACHE_SIZE);
      expect(stats.entries).toHaveLength(2);
      expect(stats.entries[0].size).toBeGreaterThan(0);
      expect(stats.entries[0].age).toBeGreaterThanOrEqual(0);
    });

    it('should track entry age in cache stats', () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);

      QueryOptimizer.setCachedResult('test-key', { data: 'value' });

      // Advance time by 5 seconds
      jest.advanceTimersByTime(5000);

      const stats = QueryOptimizer.getCacheStats();
      const entry = stats.entries.find(e => e.key === 'test-key');

      expect(entry).toBeDefined();
      expect(entry!.age).toBeGreaterThanOrEqual(5000);

      jest.useRealTimers();
    });
  });
});

describe('QueryAnalyzer', () => {
  beforeEach(() => {
    QueryAnalyzer.clearLog();
    jest.clearAllMocks();
  });

  describe('Query Logging', () => {
    it('should log query execution', () => {
      QueryAnalyzer.logQuery('SELECT * FROM users', 100, true);

      const analysis = QueryAnalyzer.getPerformanceAnalysis();
      expect(analysis.totalQueries).toBe(1);
      expect(analysis.averageExecutionTime).toBe(100);
    });

    it('should log multiple queries', () => {
      QueryAnalyzer.logQuery('SELECT * FROM users', 100, true);
      QueryAnalyzer.logQuery('SELECT * FROM posts', 200, true);
      QueryAnalyzer.logQuery('SELECT * FROM comments', 150, true);

      const analysis = QueryAnalyzer.getPerformanceAnalysis();
      expect(analysis.totalQueries).toBe(3);
      expect(analysis.averageExecutionTime).toBe(150); // (100 + 200 + 150) / 3
    });

    it('should track query errors', () => {
      QueryAnalyzer.logQuery('SELECT * FROM users', 100, true);
      QueryAnalyzer.logQuery('INVALID QUERY', 50, false, 'Syntax error');

      const analysis = QueryAnalyzer.getPerformanceAnalysis();
      expect(analysis.totalQueries).toBe(2);
      expect(analysis.errorRate).toBe(0.5); // 1 error out of 2 queries
    });

    it('should limit log to 1000 most recent queries', () => {
      // Log 1100 queries
      for (let i = 0; i < 1100; i++) {
        QueryAnalyzer.logQuery(`query-${i}`, 100, true);
      }

      const analysis = QueryAnalyzer.getPerformanceAnalysis();
      expect(analysis.totalQueries).toBe(1000); // Should keep only 1000
    });

    it('should clear query log', () => {
      QueryAnalyzer.logQuery('SELECT * FROM users', 100, true);
      QueryAnalyzer.logQuery('SELECT * FROM posts', 200, true);

      QueryAnalyzer.clearLog();

      const analysis = QueryAnalyzer.getPerformanceAnalysis();
      expect(analysis.totalQueries).toBe(0);
    });
  });

  describe('Performance Analysis', () => {
    it('should return empty analysis when no queries logged', () => {
      const analysis = QueryAnalyzer.getPerformanceAnalysis();

      expect(analysis.totalQueries).toBe(0);
      expect(analysis.averageExecutionTime).toBe(0);
      expect(analysis.slowestQueries).toEqual([]);
      expect(analysis.errorRate).toBe(0);
      expect(analysis.queryFrequency).toEqual({});
    });

    it('should identify slowest queries', () => {
      QueryAnalyzer.logQuery('fast-query', 10, true);
      QueryAnalyzer.logQuery('slow-query-1', 1000, true);
      QueryAnalyzer.logQuery('slow-query-2', 2000, true);
      QueryAnalyzer.logQuery('medium-query', 500, true);

      const analysis = QueryAnalyzer.getPerformanceAnalysis();
      expect(analysis.slowestQueries).toHaveLength(4);
      expect(analysis.slowestQueries[0].query).toBe('slow-query-2');
      expect(analysis.slowestQueries[0].time).toBe(2000);
      expect(analysis.slowestQueries[1].query).toBe('slow-query-1');
      expect(analysis.slowestQueries[1].time).toBe(1000);
    });

    it('should limit slowest queries to 10', () => {
      // Log 15 queries with different execution times
      for (let i = 0; i < 15; i++) {
        QueryAnalyzer.logQuery(`query-${i}`, i * 100, true);
      }

      const analysis = QueryAnalyzer.getPerformanceAnalysis();
      expect(analysis.slowestQueries).toHaveLength(10);
    });

    it('should calculate query frequency', () => {
      QueryAnalyzer.logQuery('SELECT users', 100, true);
      QueryAnalyzer.logQuery('SELECT users', 110, true);
      QueryAnalyzer.logQuery('SELECT users', 120, true);
      QueryAnalyzer.logQuery('SELECT posts', 200, true);
      QueryAnalyzer.logQuery('SELECT posts', 210, true);

      const analysis = QueryAnalyzer.getPerformanceAnalysis();
      expect(analysis.queryFrequency['SELECT users']).toBe(3);
      expect(analysis.queryFrequency['SELECT posts']).toBe(2);
    });

    it('should calculate error rate correctly', () => {
      QueryAnalyzer.logQuery('query-1', 100, true);
      QueryAnalyzer.logQuery('query-2', 100, false, 'Error 1');
      QueryAnalyzer.logQuery('query-3', 100, true);
      QueryAnalyzer.logQuery('query-4', 100, false, 'Error 2');

      const analysis = QueryAnalyzer.getPerformanceAnalysis();
      expect(analysis.errorRate).toBe(0.5); // 2 errors out of 4 queries
    });

    it('should exclude failed queries from average execution time', () => {
      QueryAnalyzer.logQuery('success-1', 100, true);
      QueryAnalyzer.logQuery('failed-1', 50, false, 'Error');
      QueryAnalyzer.logQuery('success-2', 200, true);

      const analysis = QueryAnalyzer.getPerformanceAnalysis();
      // Average should only include successful queries: (100 + 200) / 2 = 150
      expect(analysis.averageExecutionTime).toBe(150);
    });
  });

  describe('Optimization Recommendations', () => {
    it('should recommend indexes for slow queries', () => {
      QueryAnalyzer.logQuery('SELECT * FROM large_table WHERE unindexed_column = 1', 2500, true);

      const recommendations = QueryAnalyzer.getOptimizationRecommendations();
      const indexRecs = recommendations.filter(r => r.type === 'index');

      expect(indexRecs.length).toBeGreaterThan(0);
      expect(indexRecs[0].impact).toBe('high'); // > 2000ms
      expect(indexRecs[0].description).toContain('Consider adding indexes');
    });

    it('should recommend medium impact for moderately slow queries', () => {
      QueryAnalyzer.logQuery('SELECT * FROM table WHERE column = 1', 1000, true);

      const recommendations = QueryAnalyzer.getOptimizationRecommendations();
      const indexRecs = recommendations.filter(r => r.type === 'index');

      expect(indexRecs.length).toBeGreaterThan(0);
      expect(indexRecs[0].impact).toBe('medium'); // > 500ms but < 2000ms
    });

    it('should not recommend indexes for fast queries', () => {
      QueryAnalyzer.logQuery('SELECT * FROM table WHERE id = 1', 100, true);

      const recommendations = QueryAnalyzer.getOptimizationRecommendations();
      const indexRecs = recommendations.filter(r => r.type === 'index');

      expect(indexRecs).toHaveLength(0); // < 500ms, no recommendation
    });

    it('should recommend caching for frequent queries', () => {
      // Execute same query 15 times
      for (let i = 0; i < 15; i++) {
        QueryAnalyzer.logQuery('SELECT * FROM frequently_accessed_table', 100, true);
      }

      const recommendations = QueryAnalyzer.getOptimizationRecommendations();
      const cacheRecs = recommendations.filter(r => r.type === 'cache');

      expect(cacheRecs.length).toBeGreaterThan(0);
      expect(cacheRecs[0].description).toContain('Consider caching');
      expect(cacheRecs[0].impact).toBe('medium');
    });

    it('should not recommend caching for infrequent queries', () => {
      QueryAnalyzer.logQuery('SELECT * FROM rarely_accessed_table', 100, true);

      const recommendations = QueryAnalyzer.getOptimizationRecommendations();
      const cacheRecs = recommendations.filter(r => r.type === 'cache');

      expect(cacheRecs).toHaveLength(0); // < 10 executions
    });

    it('should provide multiple recommendations when applicable', () => {
      // Slow and frequent query
      for (let i = 0; i < 15; i++) {
        QueryAnalyzer.logQuery('SELECT * FROM slow_frequent_table WHERE unindexed = 1', 1500, true);
      }

      const recommendations = QueryAnalyzer.getOptimizationRecommendations();

      expect(recommendations.length).toBeGreaterThan(0);
      const hasIndexRec = recommendations.some(r => r.type === 'index');
      const hasCacheRec = recommendations.some(r => r.type === 'cache');

      expect(hasIndexRec).toBe(true);
      expect(hasCacheRec).toBe(true);
    });

    it('should truncate long query strings in recommendations', () => {
      const longQuery = 'SELECT * FROM table WHERE ' + 'column = 1 AND '.repeat(50) + 'id = 1';
      QueryAnalyzer.logQuery(longQuery, 2000, true);

      const recommendations = QueryAnalyzer.getOptimizationRecommendations();
      const indexRec = recommendations.find(r => r.type === 'index');

      expect(indexRec).toBeDefined();
      expect(indexRec!.description).toContain('...');
      expect(indexRec!.description.length).toBeLessThan(longQuery.length + 50);
    });
  });

  describe('Integration with QueryOptimizer', () => {
    it('should work alongside QueryOptimizer metrics', async () => {
      // Use QueryOptimizer to execute queries
      const queryFn = jest.fn().mockResolvedValue({ data: 'result' });
      await QueryOptimizer.executeWithOptimization('test-operation', queryFn);

      // Manually log to QueryAnalyzer
      QueryAnalyzer.logQuery('test-operation', 150, true);

      // Both should maintain independent state
      const optimizerStats = QueryOptimizer.getQueryStats();
      const analyzerStats = QueryAnalyzer.getPerformanceAnalysis();

      expect(optimizerStats['test-operation']).toBeDefined();
      expect(analyzerStats.totalQueries).toBe(1);
    });
  });
});

describe('QueryOptimizations Constants', () => {
  it('should define correct batch size', () => {
    expect(QueryOptimizations.BATCH_SIZE).toBe(100);
  });

  it('should define correct max cache size', () => {
    expect(QueryOptimizations.MAX_CACHE_SIZE).toBe(10000);
  });

  it('should define correct default cache TTL', () => {
    expect(QueryOptimizations.DEFAULT_CACHE_TTL).toBe(CacheTTL.MEDIUM);
  });

  it('should define correct slow query threshold', () => {
    expect(QueryOptimizations.SLOW_QUERY_THRESHOLD).toBe(1000);
  });
});
