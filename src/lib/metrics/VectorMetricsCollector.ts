/**
 * VectorMetricsCollector
 * Specialized metrics collection for vector store operations
 * Provides detailed performance tracking, provider comparison, and optimization insights
 */

export interface VectorOperationMetrics {
  // Search operations
  totalSearches: number;
  avgSearchTime: number;
  p95SearchTime: number;
  p99SearchTime: number;
  searchTimesByProvider: Map<'pgvector' | 'weaviate', number[]>;
  
  // Storage operations
  totalEmbeddings: number;
  avgEmbeddingTime: number;
  embeddingTimesByProvider: Map<'pgvector' | 'weaviate', number[]>;
  
  // Cache metrics
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  cacheEvictions: number;
  
  // Provider switching
  providerSwitches: number;
  providerPreference: 'pgvector' | 'weaviate' | 'balanced';
  
  // Error tracking
  errorsByProvider: Map<'pgvector' | 'weaviate', number>;
  totalErrors: number;
  errorRate: number;
  
  // Performance comparisons
  providerPerformanceScores: Map<'pgvector' | 'weaviate', number>;
  lastProviderComparisonTimestamp: number;
}

export interface VectorProviderInsights {
  pgvector: {
    score: number;
    avgTime: number;
    errorRate: number;
    successfulQueries: number;
    totalQueries: number;
  };
  weaviate: {
    score: number;
    avgTime: number;
    errorRate: number;
    successfulQueries: number;
    totalQueries: number;
  };
  recommendation: 'pgvector' | 'weaviate' | 'balanced';
  status: string;
}

export class VectorMetricsCollector {
  private searchTimes: Map<'pgvector' | 'weaviate', number[]> = new Map([
    ['pgvector', []],
    ['weaviate', []]
  ]);
  
  private embeddingTimes: Map<'pgvector' | 'weaviate', number[]> = new Map([
    ['pgvector', []],
    ['weaviate', []]
  ]);
  
  private errorCounts: Map<'pgvector' | 'weaviate', number> = new Map([
    ['pgvector', 0],
    ['weaviate', 0]
  ]);

  private totalSearches: number = 0;
  private totalEmbeddings: number = 0;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private cacheEvictions: number = 0;
  private providerSwitches: number = 0;
  private lastProviderUsed: 'pgvector' | 'weaviate' | null = null;

  private readonly maxHistorySize: number = 1000;
  private readonly performanceWindowMs: number = 300000; // 5 minutes

  /**
   * Record a vector search operation
   */
  recordVectorSearch(
    provider: 'pgvector' | 'weaviate',
    queryTime: number,
    resultCount: number,
    cacheHit: boolean = false
  ): void {
    this.totalSearches++;
    
    // Track search time by provider
    const providerTimes = this.searchTimes.get(provider) || [];
    providerTimes.push(queryTime);
    
    // Keep only recent measurements for performance
    if (providerTimes.length > this.maxHistorySize) {
      providerTimes.shift();
    }
    
    this.searchTimes.set(provider, providerTimes);
    
    // Track cache performance
    if (cacheHit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }
    
    // Track provider switching
    if (this.lastProviderUsed && this.lastProviderUsed !== provider) {
      this.providerSwitches++;
    }
    this.lastProviderUsed = provider;
  }

  /**
   * Record a vector embedding/storage operation
   */
  recordVectorEmbedding(
    provider: 'pgvector' | 'weaviate',
    embeddingTime: number,
    documentCount: number
  ): void {
    this.totalEmbeddings += documentCount;
    
    const providerTimes = this.embeddingTimes.get(provider) || [];
    providerTimes.push(embeddingTime);
    
    if (providerTimes.length > this.maxHistorySize) {
      providerTimes.shift();
    }
    
    this.embeddingTimes.set(provider, providerTimes);
  }

  /**
   * Record a vector operation error
   */
  recordVectorError(provider: 'pgvector' | 'weaviate', operation: string): void {
    const currentErrors = this.errorCounts.get(provider) || 0;
    this.errorCounts.set(provider, currentErrors + 1);
  }

  /**
   * Record cache eviction
   */
  recordCacheEviction(): void {
    this.cacheEvictions++;
  }

  /**
   * Get comprehensive vector operation metrics
   */
  getMetrics(): VectorOperationMetrics {
    const pgvectorSearchTimes = this.searchTimes.get('pgvector') || [];
    const weaviateSearchTimes = this.searchTimes.get('weaviate') || [];
    const allSearchTimes = [...pgvectorSearchTimes, ...weaviateSearchTimes];

    const pgvectorEmbeddingTimes = this.embeddingTimes.get('pgvector') || [];
    const weaviateEmbeddingTimes = this.embeddingTimes.get('weaviate') || [];
    const allEmbeddingTimes = [...pgvectorEmbeddingTimes, ...weaviateEmbeddingTimes];

    const totalCacheRequests = this.cacheHits + this.cacheMisses;
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, errors) => sum + errors, 0);

    return {
      totalSearches: this.totalSearches,
      avgSearchTime: this.calculateAverage(allSearchTimes),
      p95SearchTime: this.calculatePercentile(allSearchTimes, 95),
      p99SearchTime: this.calculatePercentile(allSearchTimes, 99),
      searchTimesByProvider: this.searchTimes,
      
      totalEmbeddings: this.totalEmbeddings,
      avgEmbeddingTime: this.calculateAverage(allEmbeddingTimes),
      embeddingTimesByProvider: this.embeddingTimes,
      
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate: totalCacheRequests > 0 ? (this.cacheHits / totalCacheRequests) * 100 : 0,
      cacheEvictions: this.cacheEvictions,
      
      providerSwitches: this.providerSwitches,
      providerPreference: this.getProviderPreference(),
      
      errorsByProvider: this.errorCounts,
      totalErrors: totalErrors,
      errorRate: this.totalSearches > 0 ? (totalErrors / this.totalSearches) * 100 : 0,
      
      providerPerformanceScores: this.calculateProviderScores(),
      lastProviderComparisonTimestamp: Date.now()
    };
  }

  /**
   * Get provider selection insights for intelligent routing
   */
  getProviderSelectionInsights(): VectorProviderInsights {
    const pgvectorTimes = this.searchTimes.get('pgvector') || [];
    const weaviateTimes = this.searchTimes.get('weaviate') || [];
    
    const pgvectorErrors = this.errorCounts.get('pgvector') || 0;
    const weaviateErrors = this.errorCounts.get('weaviate') || 0;
    
    const pgvectorQueries = pgvectorTimes.length;
    const weaviateQueries = weaviateTimes.length;
    
    const pgvectorAvgTime = this.calculateAverage(pgvectorTimes);
    const weaviateAvgTime = this.calculateAverage(weaviateTimes);
    
    const pgvectorErrorRate = pgvectorQueries > 0 ? (pgvectorErrors / pgvectorQueries) * 100 : 0;
    const weaviateErrorRate = weaviateQueries > 0 ? (weaviateErrors / weaviateQueries) * 100 : 0;
    
    const pgvectorScore = this.calculateProviderScore(pgvectorAvgTime, pgvectorErrorRate, pgvectorQueries);
    const weaviateScore = this.calculateProviderScore(weaviateAvgTime, weaviateErrorRate, weaviateQueries);

    return {
      pgvector: {
        score: pgvectorScore,
        avgTime: pgvectorAvgTime,
        errorRate: pgvectorErrorRate,
        successfulQueries: pgvectorQueries - pgvectorErrors,
        totalQueries: pgvectorQueries
      },
      weaviate: {
        score: weaviateScore,
        avgTime: weaviateAvgTime,
        errorRate: weaviateErrorRate,
        successfulQueries: weaviateQueries - weaviateErrors,
        totalQueries: weaviateQueries
      },
      recommendation: this.getRecommendation(pgvectorScore, weaviateScore),
      status: this.getOverallStatus(pgvectorScore, weaviateScore)
    };
  }

  /**
   * Submit metrics to Datadog if available
   */
  async submitToDatadog(): Promise<boolean> {
    try {
      // This would integrate with the existing Datadog service
      // const { DatadogMetricsService } = await import('../../services/ai-gateway/src/services/datadog-metrics');
      // const datadogService = new DatadogMetricsService();
      
      const metrics = this.getMetrics();
      
      // Example metrics that would be submitted
      const metricsToSubmit = [
        { metric: 'vibecode.vector.search.total', value: metrics.totalSearches },
        { metric: 'vibecode.vector.search.avg_time', value: metrics.avgSearchTime },
        { metric: 'vibecode.vector.cache.hit_rate', value: metrics.cacheHitRate },
        { metric: 'vibecode.vector.error.rate', value: metrics.errorRate },
        { metric: 'vibecode.vector.provider.switches', value: metrics.providerSwitches }
      ];

      // In a real implementation, this would submit to Datadog
      console.log('Would submit vector metrics to Datadog:', metricsToSubmit);
      return true;
    } catch (error) {
      console.warn('Failed to submit vector metrics to Datadog:', error);
      return false;
    }
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.searchTimes.clear();
    this.searchTimes.set('pgvector', []);
    this.searchTimes.set('weaviate', []);
    
    this.embeddingTimes.clear();
    this.embeddingTimes.set('pgvector', []);
    this.embeddingTimes.set('weaviate', []);
    
    this.errorCounts.clear();
    this.errorCounts.set('pgvector', 0);
    this.errorCounts.set('weaviate', 0);
    
    this.totalSearches = 0;
    this.totalEmbeddings = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.cacheEvictions = 0;
    this.providerSwitches = 0;
    this.lastProviderUsed = null;
  }

  // Private helper methods

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private calculateProviderScore(avgTime: number, errorRate: number, queryCount: number): number {
    if (queryCount === 0) return 0;
    
    // Speed score (lower time = higher score, max 1000ms baseline)
    const speedScore = Math.max(0, (1000 - avgTime) / 1000);
    
    // Reliability score (lower error rate = higher score)
    const reliabilityScore = Math.max(0, (100 - errorRate) / 100);
    
    // Experience score (more queries = more confidence in score)
    const experienceScore = Math.min(1, queryCount / 100);
    
    // Weighted average (speed: 40%, reliability: 40%, experience: 20%)
    return (speedScore * 0.4) + (reliabilityScore * 0.4) + (experienceScore * 0.2);
  }

  private calculateProviderScores(): Map<'pgvector' | 'weaviate', number> {
    const insights = this.getProviderSelectionInsights();
    return new Map([
      ['pgvector', insights.pgvector.score],
      ['weaviate', insights.weaviate.score]
    ]);
  }

  private getProviderPreference(): 'pgvector' | 'weaviate' | 'balanced' {
    const insights = this.getProviderSelectionInsights();
    const scoreDiff = Math.abs(insights.pgvector.score - insights.weaviate.score);
    
    if (scoreDiff < 0.1) return 'balanced';
    return insights.pgvector.score > insights.weaviate.score ? 'pgvector' : 'weaviate';
  }

  private getRecommendation(pgvectorScore: number, weaviateScore: number): 'pgvector' | 'weaviate' | 'balanced' {
    const scoreDiff = Math.abs(pgvectorScore - weaviateScore);
    
    if (scoreDiff < 0.15) return 'balanced';
    return pgvectorScore > weaviateScore ? 'pgvector' : 'weaviate';
  }

  private getOverallStatus(pgvectorScore: number, weaviateScore: number): string {
    const maxScore = Math.max(pgvectorScore, weaviateScore);
    
    if (maxScore > 0.8) return 'excellent';
    if (maxScore > 0.6) return 'good';
    if (maxScore > 0.4) return 'fair';
    return 'needs_attention';
  }
}

// Singleton instance
const globalVectorMetricsCollector = new VectorMetricsCollector();

export function getVectorMetricsCollector(): VectorMetricsCollector {
  return globalVectorMetricsCollector;
}

// Export default instance for convenience
export const vectorMetricsCollector = globalVectorMetricsCollector;
