/**
 * LLM Metrics Collector
 *
 * Collects and aggregates LLM operation metrics for real-time and historical analysis.
 * Provides interfaces for tracking costs, token usage, latency, and error rates
 * across different models, providers, users, and projects.
 */

import tracer from '../../instrument';

export interface LLMMetric {
  // Identifiers
  operationId: string;
  model: string;
  provider: string;
  userId?: string;
  projectId?: string;
  sessionId?: string;

  // Performance metrics
  latencyMs: number;
  timeToFirstTokenMs?: number;

  // Token usage
  tokensPrompt: number;
  tokensCompletion: number;
  tokensTotal: number;

  // Cost metrics
  costUsd: number;
  costPer1kTokens?: number;

  // Quality metrics
  success: boolean;
  errorType?: string;
  errorMessage?: string;

  // Additional metadata
  operation: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface AggregatedMetrics {
  // Time range
  startTime: number;
  endTime: number;
  durationMs: number;

  // Request metrics
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number;

  // Performance metrics
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;

  // Token usage
  totalTokensPrompt: number;
  totalTokensCompletion: number;
  totalTokens: number;
  avgTokensPerRequest: number;

  // Cost metrics
  totalCostUsd: number;
  avgCostPerRequest: number;
  avgCostPer1kTokens: number;

  // Breakdown by dimension
  byModel?: Record<string, Partial<AggregatedMetrics>>;
  byProvider?: Record<string, Partial<AggregatedMetrics>>;
  byUser?: Record<string, Partial<AggregatedMetrics>>;
  byProject?: Record<string, Partial<AggregatedMetrics>>;
}

export interface MetricFilter {
  model?: string;
  provider?: string;
  userId?: string;
  projectId?: string;
  sessionId?: string;
  startTime?: number;
  endTime?: number;
  operation?: string;
  success?: boolean;
}

export interface MetricQuery {
  filter?: MetricFilter;
  groupBy?: ('model' | 'provider' | 'user' | 'project')[];
  limit?: number;
  offset?: number;
}

/**
 * LLM Metrics Collector
 *
 * Collects and stores LLM operation metrics in memory for real-time aggregation.
 * Metrics are also sent to Datadog for long-term storage and analysis.
 */
export class LLMMetricsCollector {
  private static metrics: LLMMetric[] = [];
  private static readonly MAX_METRICS_IN_MEMORY = 10000;
  private static readonly CLEANUP_THRESHOLD = 12000;

  /**
   * Record a single LLM operation metric
   */
  static recordMetric(metric: LLMMetric): void {
    // Store in memory
    this.metrics.push(metric);

    // Cleanup old metrics if we exceed threshold
    if (this.metrics.length > this.CLEANUP_THRESHOLD) {
      this.cleanup();
    }

    // Send to Datadog via StatsD
    this.sendToDatadog(metric);
  }

  /**
   * Record metrics from an LLM operation
   */
  static recordOperation(params: {
    operationId: string;
    operation: string;
    model: string;
    provider: string;
    latencyMs: number;
    tokensPrompt: number;
    tokensCompletion: number;
    costUsd: number;
    success: boolean;
    userId?: string;
    projectId?: string;
    sessionId?: string;
    timeToFirstTokenMs?: number;
    errorType?: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }): void {
    const metric: LLMMetric = {
      operationId: params.operationId,
      operation: params.operation,
      model: params.model,
      provider: params.provider,
      latencyMs: params.latencyMs,
      tokensPrompt: params.tokensPrompt,
      tokensCompletion: params.tokensCompletion,
      tokensTotal: params.tokensPrompt + params.tokensCompletion,
      costUsd: params.costUsd,
      success: params.success,
      timestamp: Date.now(),
      userId: params.userId,
      projectId: params.projectId,
      sessionId: params.sessionId,
      timeToFirstTokenMs: params.timeToFirstTokenMs,
      errorType: params.errorType,
      errorMessage: params.errorMessage,
      metadata: params.metadata,
    };

    // Calculate cost per 1k tokens
    if (metric.tokensTotal > 0) {
      metric.costPer1kTokens = (metric.costUsd / metric.tokensTotal) * 1000;
    }

    this.recordMetric(metric);
  }

  /**
   * Get aggregated metrics based on query
   */
  static getAggregatedMetrics(query?: MetricQuery): AggregatedMetrics {
    const filteredMetrics = this.filterMetrics(query?.filter);

    if (filteredMetrics.length === 0) {
      return this.emptyAggregation();
    }

    const latencies = filteredMetrics.map(m => m.latencyMs).sort((a, b) => a - b);
    const successfulRequests = filteredMetrics.filter(m => m.success).length;
    const failedRequests = filteredMetrics.filter(m => !m.success).length;
    const totalRequests = filteredMetrics.length;

    const totalTokensPrompt = filteredMetrics.reduce((sum, m) => sum + m.tokensPrompt, 0);
    const totalTokensCompletion = filteredMetrics.reduce((sum, m) => sum + m.tokensCompletion, 0);
    const totalTokens = totalTokensPrompt + totalTokensCompletion;
    const totalCostUsd = filteredMetrics.reduce((sum, m) => sum + m.costUsd, 0);

    const startTime = Math.min(...filteredMetrics.map(m => m.timestamp));
    const endTime = Math.max(...filteredMetrics.map(m => m.timestamp));

    const aggregated: AggregatedMetrics = {
      startTime,
      endTime,
      durationMs: endTime - startTime,
      totalRequests,
      successfulRequests,
      failedRequests,
      errorRate: totalRequests > 0 ? failedRequests / totalRequests : 0,
      avgLatencyMs: latencies.reduce((sum, val) => sum + val, 0) / latencies.length,
      p50LatencyMs: this.percentile(latencies, 0.5),
      p95LatencyMs: this.percentile(latencies, 0.95),
      p99LatencyMs: this.percentile(latencies, 0.99),
      minLatencyMs: Math.min(...latencies),
      maxLatencyMs: Math.max(...latencies),
      totalTokensPrompt,
      totalTokensCompletion,
      totalTokens,
      avgTokensPerRequest: totalRequests > 0 ? totalTokens / totalRequests : 0,
      totalCostUsd,
      avgCostPerRequest: totalRequests > 0 ? totalCostUsd / totalRequests : 0,
      avgCostPer1kTokens: totalTokens > 0 ? (totalCostUsd / totalTokens) * 1000 : 0,
    };

    // Add group-by aggregations
    if (query?.groupBy) {
      if (query.groupBy.includes('model')) {
        aggregated.byModel = this.aggregateByDimension(filteredMetrics, 'model');
      }
      if (query.groupBy.includes('provider')) {
        aggregated.byProvider = this.aggregateByDimension(filteredMetrics, 'provider');
      }
      if (query.groupBy.includes('user')) {
        aggregated.byUser = this.aggregateByDimension(filteredMetrics, 'userId');
      }
      if (query.groupBy.includes('project')) {
        aggregated.byProject = this.aggregateByDimension(filteredMetrics, 'projectId');
      }
    }

    return aggregated;
  }

  /**
   * Get individual metrics based on filter
   */
  static getMetrics(query?: MetricQuery): LLMMetric[] {
    let filteredMetrics = this.filterMetrics(query?.filter);

    // Apply offset and limit
    const offset = query?.offset ?? 0;
    const limit = query?.limit ?? 100;
    filteredMetrics = filteredMetrics.slice(offset, offset + limit);

    return filteredMetrics;
  }

  /**
   * Get metrics count
   */
  static getMetricsCount(filter?: MetricFilter): number {
    return this.filterMetrics(filter).length;
  }

  /**
   * Get real-time metrics for the last N milliseconds
   */
  static getRealtimeMetrics(durationMs: number): AggregatedMetrics {
    const now = Date.now();
    const startTime = now - durationMs;

    return this.getAggregatedMetrics({
      filter: { startTime, endTime: now }
    });
  }

  /**
   * Clear all metrics from memory
   */
  static clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Get current metrics count
   */
  static getCurrentCount(): number {
    return this.metrics.length;
  }

  /**
   * Filter metrics based on criteria
   */
  private static filterMetrics(filter?: MetricFilter): LLMMetric[] {
    if (!filter) {
      return [...this.metrics];
    }

    return this.metrics.filter(metric => {
      if (filter.model && metric.model !== filter.model) return false;
      if (filter.provider && metric.provider !== filter.provider) return false;
      if (filter.userId && metric.userId !== filter.userId) return false;
      if (filter.projectId && metric.projectId !== filter.projectId) return false;
      if (filter.sessionId && metric.sessionId !== filter.sessionId) return false;
      if (filter.operation && metric.operation !== filter.operation) return false;
      if (filter.success !== undefined && metric.success !== filter.success) return false;
      if (filter.startTime && metric.timestamp < filter.startTime) return false;
      if (filter.endTime && metric.timestamp > filter.endTime) return false;
      return true;
    });
  }

  /**
   * Aggregate metrics by a dimension
   */
  private static aggregateByDimension(
    metrics: LLMMetric[],
    dimension: 'model' | 'provider' | 'userId' | 'projectId'
  ): Record<string, Partial<AggregatedMetrics>> {
    const groups: Record<string, LLMMetric[]> = {};

    metrics.forEach(metric => {
      const key = metric[dimension] || 'unknown';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(metric);
    });

    const result: Record<string, Partial<AggregatedMetrics>> = {};

    Object.entries(groups).forEach(([key, groupMetrics]) => {
      const latencies = groupMetrics.map(m => m.latencyMs).sort((a, b) => a - b);
      const successfulRequests = groupMetrics.filter(m => m.success).length;
      const failedRequests = groupMetrics.filter(m => !m.success).length;
      const totalRequests = groupMetrics.length;

      const totalTokensPrompt = groupMetrics.reduce((sum, m) => sum + m.tokensPrompt, 0);
      const totalTokensCompletion = groupMetrics.reduce((sum, m) => sum + m.tokensCompletion, 0);
      const totalTokens = totalTokensPrompt + totalTokensCompletion;
      const totalCostUsd = groupMetrics.reduce((sum, m) => sum + m.costUsd, 0);

      result[key] = {
        totalRequests,
        successfulRequests,
        failedRequests,
        errorRate: totalRequests > 0 ? failedRequests / totalRequests : 0,
        avgLatencyMs: latencies.reduce((sum, val) => sum + val, 0) / latencies.length,
        p95LatencyMs: this.percentile(latencies, 0.95),
        totalTokensPrompt,
        totalTokensCompletion,
        totalTokens,
        avgTokensPerRequest: totalRequests > 0 ? totalTokens / totalRequests : 0,
        totalCostUsd,
        avgCostPerRequest: totalRequests > 0 ? totalCostUsd / totalRequests : 0,
        avgCostPer1kTokens: totalTokens > 0 ? (totalCostUsd / totalTokens) * 1000 : 0,
      };
    });

    return result;
  }

  /**
   * Calculate percentile from sorted array
   */
  private static percentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    if (sortedArray.length === 1) return sortedArray[0];

    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  /**
   * Send metric to Datadog
   */
  private static sendToDatadog(metric: LLMMetric): void {
    const statsd = tracer.dogstatsd;
    if (!statsd) return;

    const tags = {
      model: metric.model,
      provider: metric.provider,
      operation: metric.operation,
      success: String(metric.success),
      env: process.env.DD_ENV || 'development',
    };

    // Increment request counter
    statsd.increment('llm.requests.total', 1, tags);

    if (metric.success) {
      statsd.increment('llm.requests.success', 1, tags);
    } else {
      statsd.increment('llm.requests.error', 1, tags);
      if (metric.errorType) {
        statsd.increment('llm.requests.error_by_type', 1, {
          ...tags,
          error_type: metric.errorType,
        });
      }
    }

    // Send latency metrics
    statsd.histogram('llm.latency.ms', metric.latencyMs, tags);

    if (metric.timeToFirstTokenMs) {
      statsd.histogram('llm.ttft.ms', metric.timeToFirstTokenMs, tags);
    }

    // Send token metrics
    statsd.histogram('llm.tokens.prompt', metric.tokensPrompt, tags);
    statsd.histogram('llm.tokens.completion', metric.tokensCompletion, tags);
    statsd.histogram('llm.tokens.total', metric.tokensTotal, tags);

    // Send cost metrics
    statsd.histogram('llm.cost.usd', metric.costUsd, tags);
    if (metric.costPer1kTokens) {
      statsd.histogram('llm.cost.per_1k_tokens', metric.costPer1kTokens, tags);
    }

    // Send metrics by user if available
    if (metric.userId) {
      statsd.increment('llm.requests.by_user', 1, {
        ...tags,
        user_id: metric.userId,
      });
      statsd.histogram('llm.cost.by_user', metric.costUsd, {
        ...tags,
        user_id: metric.userId,
      });
    }

    // Send metrics by project if available
    if (metric.projectId) {
      statsd.increment('llm.requests.by_project', 1, {
        ...tags,
        project_id: metric.projectId,
      });
      statsd.histogram('llm.cost.by_project', metric.costUsd, {
        ...tags,
        project_id: metric.projectId,
      });
    }
  }

  /**
   * Cleanup old metrics to prevent memory issues
   */
  private static cleanup(): void {
    // Keep only the most recent MAX_METRICS_IN_MEMORY metrics
    const toRemove = this.metrics.length - this.MAX_METRICS_IN_MEMORY;
    if (toRemove > 0) {
      this.metrics.splice(0, toRemove);
    }
  }

  /**
   * Return empty aggregation structure
   */
  private static emptyAggregation(): AggregatedMetrics {
    const now = Date.now();
    return {
      startTime: now,
      endTime: now,
      durationMs: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      errorRate: 0,
      avgLatencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      minLatencyMs: 0,
      maxLatencyMs: 0,
      totalTokensPrompt: 0,
      totalTokensCompletion: 0,
      totalTokens: 0,
      avgTokensPerRequest: 0,
      totalCostUsd: 0,
      avgCostPerRequest: 0,
      avgCostPer1kTokens: 0,
    };
  }
}

/**
 * Export singleton instance for convenience
 */
export const metricsCollector = LLMMetricsCollector;

export default metricsCollector;
