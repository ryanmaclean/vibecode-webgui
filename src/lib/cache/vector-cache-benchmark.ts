/**
 * ValKey Vector Cache Benchmark Tool
 * Measures performance of pgVector with ValKey caching
 */

import { PrismaClient } from '@prisma/client';
import { VectorCacheManager } from './vector-cache-strategy';
import { PgVectorSearch } from './pgvector-search';
import { valkeyLogger } from './valkey-logger';
import { metrics } from '../server-monitoring';

/**
 * Benchmark interface for results
 */
interface BenchmarkResults {
  operation: string;
  runCount: number;
  cacheEnabled: boolean;
  totalTimeMs: number;
  averageTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  medianTimeMs: number;
  p95TimeMs: number;
  cacheHitRate?: number;
  dbQueryCount?: number;
}

// Interface for metrics history collection
interface MetricsData {
  count: number;
  sum: number;
  min?: number;
  max?: number;
  avg?: number;
}

/**
 * Vector Cache Benchmark Tool
 * Provides benchmarking utilities for ValKey caching with pgVector
 */
export class VectorCacheBenchmark {
  private static readonly DEFAULT_RUNS = 10;
  private static metricsHistory: Record<string, MetricsData> = {};
  
  /**
   * Clear metrics tracking for a fresh benchmark
   */
  private static resetMetricsTracking(metricNames: string[]): void {
    for (const name of metricNames) {
      this.metricsHistory[name] = {
        count: 0,
        sum: 0
      };
    }
  }
  
  /**
   * Track metric for a run
   */
  private static trackMetric(name: string, value: number): void {
    if (!this.metricsHistory[name]) {
      this.metricsHistory[name] = {
        count: 0,
        sum: 0
      };
    }
    
    const metric = this.metricsHistory[name];
    metric.count++;
    metric.sum += value;
    
    if (metric.min === undefined || value < metric.min) {
      metric.min = value;
    }
    
    if (metric.max === undefined || value > metric.max) {
      metric.max = value;
    }
    
    metric.avg = metric.sum / metric.count;
  }
  
  /**
   * Get metrics data
   */
  private static getMetricsData(name: string): MetricsData | undefined {
    return this.metricsHistory[name];
  }
  
  /**
   * Benchmark vector similarity search with and without caching
   */
  static async benchmarkSimilaritySearch(
    options: {
      runs?: number;
      embedding?: number[];
      contentType?: string;
      minSimilarity?: number;
      limit?: number;
      cleanCache?: boolean;
    } = {}
  ): Promise<{
    withCache: BenchmarkResults;
    withoutCache: BenchmarkResults;
    improvement: number;
  }> {
    // Set defaults
    const runs = options.runs || this.DEFAULT_RUNS;
    const cleanCache = options.cleanCache !== false;
    
    // Generate random embedding if not provided
    const embedding = options.embedding || this.generateRandomEmbedding(1536);
    
    // Reset metrics tracking
    this.resetMetricsTracking([
      'pgvector.search.db.duration',
      'pgvector.search.total.duration',
      'pgvector.search.cached.duration'
    ]);
    
    // Clear cache if requested
    if (cleanCache) {
      await VectorCacheManager.invalidateForTable('rag_chunks');
      VectorCacheManager.resetStats();
    }
    
    // Benchmark without cache
    valkeyLogger.info('Starting vector search benchmark without cache', {
      command: 'benchmark_start',
      metadata: { runs, cacheEnabled: false }
    });
    
    const withoutCacheResults = await this.runSearchBenchmark(
      embedding,
      {
        ...options,
        useCache: false
      },
      runs
    );
    
    // Benchmark with cache
    valkeyLogger.info('Starting vector search benchmark with cache', {
      command: 'benchmark_start',
      metadata: { runs, cacheEnabled: true }
    });
    
    const withCacheResults = await this.runSearchBenchmark(
      embedding,
      {
        ...options,
        useCache: true
      },
      runs
    );
    
    // Calculate improvement
    const improvement = (
      (withoutCacheResults.averageTimeMs - withCacheResults.averageTimeMs) /
      withoutCacheResults.averageTimeMs
    ) * 100;
    
    // Get cache stats
    const cacheStats = VectorCacheManager.getCacheStats();
    
    // Log results
    valkeyLogger.info('Vector search benchmark completed', {
      command: 'benchmark_complete',
      metadata: {
        withCache: withCacheResults,
        withoutCache: withoutCacheResults,
        improvement: improvement.toFixed(2) + '%',
        cacheStats
      }
    });
    
    return {
      withCache: withCacheResults,
      withoutCache: withoutCacheResults,
      improvement
    };
  }
  
  /**
   * Run vector similarity search benchmark
   */
  private static async runSearchBenchmark(
    embedding: number[],
    options: {
      contentType?: string;
      minSimilarity?: number;
      limit?: number;
      useCache: boolean;
    },
    runs: number
  ): Promise<BenchmarkResults> {
    const times: number[] = [];
    let totalTime = 0;
    
    // Run benchmark for specified number of runs
    for (let i = 0; i < runs; i++) {
      const startTime = Date.now();
      
      // Run vector search
      const results = await PgVectorSearch.findSimilarCode(embedding, {
        contentTypes: options.contentType ? [options.contentType] : undefined,
        minSimilarity: options.minSimilarity,
        limit: options.limit,
        useCache: options.useCache
      });
      
      const duration = Date.now() - startTime;
      
      // Track metrics
      this.trackMetric('pgvector.search.total.duration', duration);
      
      // For tracking DB query count
      if (!options.useCache || i === 0) {
        this.trackMetric('pgvector.search.db.count', 1);
      }
      
      times.push(duration);
      totalTime += duration;
    }
    
    // Sort times for percentile calculations
    times.sort((a, b) => a - b);
    
    // Calculate stats
    const minTime = times[0];
    const maxTime = times[times.length - 1];
    const averageTime = totalTime / runs;
    const medianTime = times[Math.floor(times.length / 2)];
    const p95Index = Math.floor(times.length * 0.95);
    const p95Time = times[p95Index] || maxTime;
    
    // Get cache stats if enabled
    let cacheHitRate: number | undefined;
    if (options.useCache) {
      const stats = VectorCacheManager.getCacheStats();
      cacheHitRate = stats.hitRate;
    }
    
    // Get database query count
    const dbQueryMetrics = this.getMetricsData('pgvector.search.db.count');
    const dbQueryCount = dbQueryMetrics?.count;
    
    return {
      operation: 'vector_similarity_search',
      runCount: runs,
      cacheEnabled: options.useCache,
      totalTimeMs: totalTime,
      averageTimeMs: averageTime,
      minTimeMs: minTime,
      maxTimeMs: maxTime,
      medianTimeMs: medianTime,
      p95TimeMs: p95Time,
      cacheHitRate,
      dbQueryCount
    };
  }
  
  /**
   * Benchmark cache invalidation performance
   */
  static async benchmarkCacheInvalidation(
    options: {
      runs?: number;
      tablesToInvalidate?: ('rag_chunks' | 'ai_embeddings')[];
      contentTypes?: string[];
    } = {}
  ): Promise<BenchmarkResults> {
    // Set defaults
    const runs = options.runs || this.DEFAULT_RUNS;
    const tables = options.tablesToInvalidate || ['rag_chunks', 'ai_embeddings'];
    const contentTypes = options.contentTypes || [undefined];
    
    // Reset metrics tracking
    this.resetMetricsTracking(['vector_cache.invalidation.duration']);
    
    valkeyLogger.info('Starting cache invalidation benchmark', {
      command: 'benchmark_invalidation_start',
      metadata: { runs, tables, contentTypes }
    });
    
    const times: number[] = [];
    let totalTime = 0;
    
    // Run benchmark for specified number of runs
    for (let i = 0; i < runs; i++) {
      // Populate cache with some data first to ensure there's something to invalidate
      const embedding = this.generateRandomEmbedding(1536);
      await PgVectorSearch.findSimilarCode(embedding, { useCache: true });
      
      // Benchmark invalidation
      const startTime = Date.now();
      
      // Invalidate all specified tables and content types
      for (const table of tables) {
        for (const contentType of contentTypes) {
          await VectorCacheManager.invalidateForTable(table, contentType);
        }
      }
      
      const duration = Date.now() - startTime;
      
      // Track metrics
      this.trackMetric('vector_cache.invalidation.duration', duration);
      
      times.push(duration);
      totalTime += duration;
    }
    
    // Sort times for percentile calculations
    times.sort((a, b) => a - b);
    
    // Calculate stats
    const minTime = times[0];
    const maxTime = times[times.length - 1];
    const averageTime = totalTime / runs;
    const medianTime = times[Math.floor(times.length / 2)];
    const p95Index = Math.floor(times.length * 0.95);
    const p95Time = times[p95Index] || maxTime;
    
    const results = {
      operation: 'cache_invalidation',
      runCount: runs,
      cacheEnabled: true,
      totalTimeMs: totalTime,
      averageTimeMs: averageTime,
      minTimeMs: minTime,
      maxTimeMs: maxTime,
      medianTimeMs: medianTime,
      p95TimeMs: p95Time
    };
    
    // Log results
    valkeyLogger.info('Cache invalidation benchmark completed', {
      command: 'benchmark_invalidation_complete',
      metadata: {
        results,
        tables,
        contentTypes
      }
    });
    
    return results;
  }
  
  /**
   * Generate a random embedding for testing
   */
  static generateRandomEmbedding(dimensions: number): number[] {
    const embedding: number[] = [];
    
    // Generate random values
    for (let i = 0; i < dimensions; i++) {
      embedding.push(Math.random() * 2 - 1); // Random value between -1 and 1
    }
    
    // Normalize to unit vector
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );
    
    return embedding.map(val => val / magnitude);
  }
  
  /**
   * Run comprehensive benchmark suite
   */
  static async runComprehensiveBenchmark(): Promise<{
    similaritySearch: {
      withCache: BenchmarkResults;
      withoutCache: BenchmarkResults;
      improvement: number;
    };
    invalidation: BenchmarkResults;
    summary: string;
  }> {
    // Reset metrics and cache stats
    this.resetMetricsTracking([
      'pgvector.search.db.duration',
      'pgvector.search.total.duration',
      'pgvector.search.cached.duration',
      'vector_cache.invalidation.duration'
    ]);
    VectorCacheManager.resetStats();
    
    valkeyLogger.info('Starting comprehensive benchmark suite', {
      command: 'benchmark_comprehensive_start'
    });
    
    // Run similarity search benchmark
    const similarityResults = await this.benchmarkSimilaritySearch({
      runs: 20,
      cleanCache: true
    });
    
    // Run invalidation benchmark
    const invalidationResults = await this.benchmarkCacheInvalidation({
      runs: 10
    });
    
    // Get cache stats
    const cacheStats = VectorCacheManager.getCacheStats();
    const hitRatePercent = (cacheStats.hitRate * 100).toFixed(2);
    
    // Generate summary
    const summary = `
ValKey pgVector Cache Benchmark Results:

Vector Search Performance:
  Without Cache: ${similarityResults.withoutCache.averageTimeMs.toFixed(2)}ms avg (${similarityResults.withoutCache.p95TimeMs.toFixed(2)}ms p95)
  With Cache:    ${similarityResults.withCache.averageTimeMs.toFixed(2)}ms avg (${similarityResults.withCache.p95TimeMs.toFixed(2)}ms p95)
  Improvement:   ${similarityResults.improvement.toFixed(2)}%

Cache Invalidation Performance:
  Average Time:  ${invalidationResults.averageTimeMs.toFixed(2)}ms
  P95 Time:      ${invalidationResults.p95TimeMs.toFixed(2)}ms

Cache Efficiency:
  Hit Rate:      ${hitRatePercent}%
  Hit Count:     ${cacheStats.hitCount}
  Miss Count:    ${cacheStats.missCount}
    `.trim();
    
    valkeyLogger.info('Comprehensive benchmark complete', {
      command: 'benchmark_comprehensive_complete',
      metadata: {
        similarityResults,
        invalidationResults,
        summary
      }
    });
    
    return {
      similaritySearch: similarityResults,
      invalidation: invalidationResults,
      summary
    };
  }
}

export default VectorCacheBenchmark;