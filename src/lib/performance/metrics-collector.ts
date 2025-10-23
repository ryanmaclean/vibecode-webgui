/**
 * Performance Metrics Collection System
 * Comprehensive monitoring for application performance
 */

import { metrics } from '../server-monitoring';
import { cache, CacheKeys, CacheTTL } from '../cache/valkey-client';
// // // import { logger } from '../logger';


export interface PerformanceMetric {
  timestamp: number;
  metric: string;
  value: number;
  tags: Record<string, string>;
}

export interface WebVitalsMetric {
  name: 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
  url: string;
  sessionId?: string;
  userId?: string;
}

export interface APIPerformanceMetric {
  endpoint: string;
  method: string;
  status: number;
  duration: number;
  timestamp: number;
  userId?: string;
  cacheHit?: boolean;
  dbQueries?: number;
  memoryUsage?: number;
}

/**
 * Performance data aggregator
 */
export class PerformanceCollector {
  private metricsBuffer: PerformanceMetric[] = [];
  private webVitalsBuffer: WebVitalsMetric[] = [];
  private apiMetricsBuffer: APIPerformanceMetric[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  
  private readonly BUFFER_SIZE = 1000;
  private readonly FLUSH_INTERVAL = 30000; // 30 seconds

  constructor() {
    this.startBufferFlush();
  }

  /**
   * Record Web Vitals metric
   */
  recordWebVital(metric: WebVitalsMetric) {
    this.webVitalsBuffer.push(metric);
    
    // Send to Datadog immediately for critical metrics
    metrics.histogram(`webvitals.${metric.name.toLowerCase()}`, metric.value, {
      rating: metric.rating,
      url: metric.url,
      user_id: metric.userId || 'anonymous'
    });

    if (this.webVitalsBuffer.length >= this.BUFFER_SIZE) {
      this.flushWebVitals();
    }
  }

  /**
   * Record API performance metric
   */
  recordAPIPerformance(metric: APIPerformanceMetric) {
    this.apiMetricsBuffer.push(metric);
    
    // Send to Datadog
    metrics.histogram('api.request.duration', metric.duration, {
      endpoint: metric.endpoint,
      method: metric.method,
      status: metric.status.toString(),
      cache_hit: metric.cacheHit ? 'true' : 'false'
    });

    metrics.increment('api.request.count', {
      endpoint: metric.endpoint,
      method: metric.method,
      status: metric.status.toString()
    });

    if (metric.memoryUsage) {
      metrics.gauge('api.memory.usage', metric.memoryUsage, {
        endpoint: metric.endpoint
      });
    }

    if (this.apiMetricsBuffer.length >= this.BUFFER_SIZE) {
      this.flushAPIMetrics();
    }
  }

  /**
   * Record custom performance metric
   */
  recordMetric(metric: string, value: number, tags: Record<string, string> = {}) {
    const performanceMetric: PerformanceMetric = {
      timestamp: Date.now(),
      metric,
      value,
      tags
    };

    this.metricsBuffer.push(performanceMetric);
    
    // Send to Datadog
    metrics.histogram(metric, value, tags);

    if (this.metricsBuffer.length >= this.BUFFER_SIZE) {
      this.flushMetrics();
    }
  }

  /**
   * Get performance summary for a time period
   */
  async getPerformanceSummary(minutes: number = 60): Promise<{
    webVitals: {
      cls: { avg: number; p95: number; count: number };
      fid: { avg: number; p95: number; count: number };
      fcp: { avg: number; p95: number; count: number };
      lcp: { avg: number; p95: number; count: number };
      ttfb: { avg: number; p95: number; count: number };
    };
    api: {
      avgResponseTime: number;
      p95ResponseTime: number;
      errorRate: number;
      throughput: number;
      cacheHitRate: number;
    };
    system: {
      memoryUsage: number;
      dbConnections: number;
      cacheHitRate: number;
    };
  }> {
    const cacheKey = CacheKeys.apiMetrics('performance_summary', `${minutes}m`);
    
    // Try to get from cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Calculate metrics from recent data
    const now = Date.now();
    const timeWindow = minutes * 60 * 1000;
    const startTime = now - timeWindow;

    // Filter recent metrics
    const recentWebVitals = this.webVitalsBuffer.filter(m => m.timestamp >= startTime);
    const recentAPIMetrics = this.apiMetricsBuffer.filter(m => m.timestamp >= startTime);

    // Calculate Web Vitals summary
    const webVitals = {
      cls: this.calculateMetricStats(recentWebVitals.filter(m => m.name === 'CLS')),
      fid: this.calculateMetricStats(recentWebVitals.filter(m => m.name === 'FID')),
      fcp: this.calculateMetricStats(recentWebVitals.filter(m => m.name === 'FCP')),
      lcp: this.calculateMetricStats(recentWebVitals.filter(m => m.name === 'LCP')),
      ttfb: this.calculateMetricStats(recentWebVitals.filter(m => m.name === 'TTFB')),
    };

    // Calculate API summary
    const apiDurations = recentAPIMetrics.map(m => m.duration);
    const errorCount = recentAPIMetrics.filter(m => m.status >= 400).length;
    const cacheHits = recentAPIMetrics.filter(m => m.cacheHit).length;

    const api = {
      avgResponseTime: apiDurations.length > 0 ? 
        apiDurations.reduce((a, b) => a + b, 0) / apiDurations.length : 0,
      p95ResponseTime: this.calculatePercentile(apiDurations, 95),
      errorRate: recentAPIMetrics.length > 0 ? 
        (errorCount / recentAPIMetrics.length) * 100 : 0,
      throughput: recentAPIMetrics.length / minutes, // requests per minute
      cacheHitRate: recentAPIMetrics.length > 0 ? 
        (cacheHits / recentAPIMetrics.length) * 100 : 0,
    };

    // Get system metrics
    const cacheStats = await cache.getStats();
    const system = {
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      dbConnections: 0, // This would be fetched from Prisma metrics
      cacheHitRate: cacheStats.hitRate * 100,
    };

    const summary = { webVitals, api, system };
    
    // Cache the summary for 1 minute
    await cache.set(cacheKey, summary, CacheTTL.SHORT);
    
    return summary;
  }

  /**
   * Get slowest endpoints
   */
  async getSlowestEndpoints(limit: number = 10): Promise<Array<{
    endpoint: string;
    avgDuration: number;
    requestCount: number;
    errorRate: number;
  }>> {
    const endpointStats = new Map<string, {
      durations: number[];
      errors: number;
      total: number;
    }>();

    // Aggregate metrics by endpoint
    for (const metric of this.apiMetricsBuffer) {
      const key = `${metric.method} ${metric.endpoint}`;
      const stats = endpointStats.get(key) || { durations: [], errors: 0, total: 0 };
      
      stats.durations.push(metric.duration);
      stats.total++;
      if (metric.status >= 400) {
        stats.errors++;
      }
      
      endpointStats.set(key, stats);
    }

    // Convert to sorted array
    const results = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        avgDuration: stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length,
        requestCount: stats.total,
        errorRate: (stats.errors / stats.total) * 100,
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, limit);

    return results;
  }

  /**
   * Start automatic buffer flushing
   */
  private startBufferFlush() {
    this.flushInterval = setInterval(() => {
      this.flushAllBuffers();
    }, this.FLUSH_INTERVAL);
  }

  /**
   * Stop buffer flushing
   */
  public stopBufferFlush() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flushAllBuffers();
  }

  /**
   * Flush all buffers
   */
  private async flushAllBuffers() {
    await Promise.all([
      this.flushMetrics(),
      this.flushWebVitals(),
      this.flushAPIMetrics()
    ]);
  }

  /**
   * Flush metrics buffer to storage
   */
  private async flushMetrics() {
    if (this.metricsBuffer.length === 0) return;

    try {
      // In production, you would send these to your metrics backend
      const metrics = [...this.metricsBuffer];
      this.metricsBuffer = [];

      // Store in cache for recent access
      const cacheKey = `metrics:recent:${Date.now()}`;
      await cache.set(cacheKey, metrics, CacheTTL.HOUR);
      
      console.info(`Flushed ${metrics.length} performance metrics`);
    } catch (error) {
      console.error('Failed to flush metrics:', { error: error });
    }
  }

  /**
   * Flush Web Vitals buffer
   */
  private async flushWebVitals() {
    if (this.webVitalsBuffer.length === 0) return;

    try {
      const vitals = [...this.webVitalsBuffer];
      this.webVitalsBuffer = [];

      const cacheKey = `webvitals:recent:${Date.now()}`;
      await cache.set(cacheKey, vitals, CacheTTL.HOUR);
      
      console.info(`Flushed ${vitals.length} Web Vitals metrics`);
    } catch (error) {
      console.error('Failed to flush Web Vitals:', { error: error });
    }
  }

  /**
   * Flush API metrics buffer
   */
  private async flushAPIMetrics() {
    if (this.apiMetricsBuffer.length === 0) return;

    try {
      const apiMetrics = [...this.apiMetricsBuffer];
      this.apiMetricsBuffer = [];

      const cacheKey = `api_metrics:recent:${Date.now()}`;
      await cache.set(cacheKey, apiMetrics, CacheTTL.HOUR);
      
      console.info(`Flushed ${apiMetrics.length} API metrics`);
    } catch (error) {
      console.error('Failed to flush API metrics:', { error: error });
    }
  }

  /**
   * Calculate metric statistics
   */
  private calculateMetricStats(metrics: WebVitalsMetric[]): { avg: number; p95: number; count: number } {
    if (metrics.length === 0) {
      return { avg: 0, p95: 0, count: 0 };
    }

    const values = metrics.map(m => m.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const p95 = this.calculatePercentile(values, 95);

    return { avg, p95, count: metrics.length };
  }

  /**
   * Calculate percentile value
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }
}

// Export singleton instance
export const performanceCollector = new PerformanceCollector();

/**
 * Performance monitoring middleware
 */
export function withPerformanceMonitoring<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  metricName: string,
  tags: Record<string, string> = {}
) {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      const result = await fn(...args);
      const duration = Date.now() - startTime;
      const memoryDelta = process.memoryUsage().heapUsed - startMemory;

      performanceCollector.recordMetric(`${metricName}.duration`, duration, {
        ...tags,
        status: 'success'
      });

      performanceCollector.recordMetric(`${metricName}.memory`, memoryDelta, tags);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      performanceCollector.recordMetric(`${metricName}.duration`, duration, {
        ...tags,
        status: 'error'
      });

      performanceCollector.recordMetric(`${metricName}.error`, 1, {
        ...tags,
        error: error instanceof Error ? error.name : 'Unknown'
      });

      throw error;
    }
  };
}

/**
 * API endpoint performance tracker
 */
export function trackAPIPerformance(
  endpoint: string,
  method: string,
  status: number,
  startTime: number,
  options: {
    userId?: string;
    cacheHit?: boolean;
    dbQueries?: number;
  } = {}
) {
  const duration = Date.now() - startTime;
  const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB

  performanceCollector.recordAPIPerformance({
    endpoint,
    method,
    status,
    duration,
    timestamp: Date.now(),
    memoryUsage,
    ...options
  });

  // Log slow requests
  if (duration > 5000) { // 5 seconds
    console.warn(`Slow API request detected: ${method} ${endpoint} - ${duration}ms`);
  }
}

/**
 * Database query performance tracker
 */
export function trackDBQuery(operation: string, model: string, duration: number) {
  performanceCollector.recordMetric('db.query.performance', duration, {
    operation,
    model,
    type: 'database'
  });
}

/**
 * Cache performance tracker
 */
export function trackCacheOperation(operation: 'get' | 'set' | 'del', hit: boolean, duration: number) {
  performanceCollector.recordMetric('cache.operation.performance', duration, {
    operation,
    hit: hit ? 'true' : 'false',
    type: 'cache'
  });
}

/**
 * AI operation performance tracker
 */
export function trackAIOperation(
  provider: string,
  model: string,
  operation: string,
  duration: number,
  tokens?: { input: number; output: number },
  cost?: number
) {
  performanceCollector.recordMetric('ai.operation.performance', duration, {
    provider,
    model,
    operation,
    type: 'ai'
  });

  if (tokens) {
    performanceCollector.recordMetric('ai.tokens.input', tokens.input, { provider, model });
    performanceCollector.recordMetric('ai.tokens.output', tokens.output, { provider, model });
  }

  if (cost) {
    performanceCollector.recordMetric('ai.cost', cost, { provider, model });
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.info('Shutting down performance collector...');
  performanceCollector.stopBufferFlush();
});

process.on('SIGINT', () => {
  console.info('Shutting down performance collector...');
  performanceCollector.stopBufferFlush();
});

export default performanceCollector;