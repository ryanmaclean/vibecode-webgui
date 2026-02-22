/**
 * AI Quality Tracker Service
 *
 * Tracks AI suggestion quality metrics with DataDog integration.
 * Records acceptance/rejection rates, edit distances, user ratings,
 * and emits metrics for monitoring and analysis.
 *
 * @example
 * ```typescript
 * const tracker = getQualityTracker();
 *
 * // Track a new suggestion
 * const suggestionId = await tracker.trackSuggestion({
 *   modelId: 'anthropic/claude-3.5-sonnet',
 *   suggestion: 'function add(a, b) { return a + b; }',
 *   context: { language: 'typescript' }
 * });
 *
 * // Track acceptance with edits
 * await tracker.trackAcceptance(suggestionId, {
 *   finalCode: 'function add(a: number, b: number): number { return a + b; }',
 *   timeToAccept: 5000
 * });
 * ```
 */

import { logger } from '@/lib/logger';
import { getMetricsProvider, type IMetricsProvider, type MetricTags } from '@/lib/monitoring/metrics-provider';
import { calculateCodeEditDistance, type EditDistanceResult } from './edit-distance';
import type { QualityMetrics, UserRating, QualityTrackingConfig } from '@/types/ai-quality-metrics';

// =============================================================================
// Types
// =============================================================================

/**
 * AI suggestion tracking data
 */
export interface SuggestionData {
  /** Unique ID for this suggestion */
  id: string;
  /** Model that generated the suggestion */
  modelId: string;
  /** The suggested code */
  suggestion: string;
  /** Programming language */
  language?: string;
  /** User/workspace context */
  userId?: string;
  workspaceId?: string;
  projectId?: string;
  /** Additional context */
  context?: Record<string, unknown>;
  /** Timestamp when suggestion was generated */
  timestamp: number;
}

/**
 * Suggestion acceptance event data
 */
export interface AcceptanceData {
  /** Final code after user edits */
  finalCode: string;
  /** Time from suggestion to acceptance (ms) */
  timeToAccept: number;
  /** Whether code was modified before acceptance */
  wasModified?: boolean;
}

/**
 * Suggestion rejection event data
 */
export interface RejectionData {
  /** Time from suggestion to rejection (ms) */
  timeToReject: number;
  /** Optional rejection reason */
  reason?: 'irrelevant' | 'incorrect' | 'incomplete' | 'style' | 'other';
}

/**
 * User rating data
 */
export interface RatingData {
  /** Star rating (1-5) */
  rating: UserRating;
  /** Optional comment */
  comment?: string;
  /** User ID */
  userId: string;
}

// =============================================================================
// Quality Tracker Service
// =============================================================================

export class QualityTracker {
  private metricsProvider: IMetricsProvider;
  private config: QualityTrackingConfig;
  private suggestions: Map<string, SuggestionData> = new Map();

  constructor(
    metricsProvider: IMetricsProvider,
    config: Partial<QualityTrackingConfig> = {}
  ) {
    this.metricsProvider = metricsProvider;
    this.config = {
      enabled: config.enabled ?? true,
      defaultMethod: config.defaultMethod ?? 'heuristic',
      useLLMJudge: config.useLLMJudge ?? false,
      samplingRate: config.samplingRate ?? 1.0,
      minSampleSize: config.minSampleSize ?? 10,
      trendWindowDays: config.trendWindowDays ?? 7,
      thresholds: config.thresholds,
      judgeModelId: config.judgeModelId,
    };

    if (this.config.enabled) {
      logger.info('[QualityTracker] Initialized', { config: this.config });
    }
  }

  /**
   * Track a new AI suggestion
   */
  async trackSuggestion(data: Omit<SuggestionData, 'id' | 'timestamp'>): Promise<string> {
    if (!this.config.enabled || !this.shouldSample()) {
      return this.generateId();
    }

    const suggestion: SuggestionData = {
      ...data,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    this.suggestions.set(suggestion.id, suggestion);

    // Emit metrics
    this.emitMetric('suggestion.generated', 1, {
      model: suggestion.modelId,
      language: suggestion.language || 'unknown',
    });

    logger.info('[QualityTracker] Suggestion tracked', {
      id: suggestion.id,
      modelId: suggestion.modelId,
    });

    return suggestion.id;
  }

  /**
   * Track suggestion acceptance
   */
  async trackAcceptance(
    suggestionId: string,
    data: AcceptanceData
  ): Promise<void> {
    if (!this.config.enabled) return;

    const suggestion = this.suggestions.get(suggestionId);
    if (!suggestion) {
      logger.warn('[QualityTracker] Suggestion not found for acceptance', { suggestionId });
      return;
    }

    // Calculate edit distance
    const editMetrics = calculateCodeEditDistance(
      suggestion.suggestion,
      data.finalCode
    );

    const tags: MetricTags = {
      model: suggestion.modelId,
      language: suggestion.language || 'unknown',
      modified: data.wasModified ?? (editMetrics.distance > 0),
      change_magnitude: editMetrics.changeMagnitude,
    };

    // Emit acceptance metrics
    this.emitMetric('suggestion.accepted', 1, tags);
    this.emitMetric('suggestion.time_to_accept', data.timeToAccept, tags);
    this.emitMetric('suggestion.edit_distance', editMetrics.distance, tags);
    this.emitMetric('suggestion.similarity', editMetrics.similarity, tags);

    logger.info('[QualityTracker] Acceptance tracked', {
      suggestionId,
      editDistance: editMetrics.distance,
      similarity: editMetrics.similarity,
      changeMagnitude: editMetrics.changeMagnitude,
      timeToAccept: data.timeToAccept,
    });

    // Clean up stored suggestion
    this.suggestions.delete(suggestionId);
  }

  /**
   * Track suggestion rejection
   */
  async trackRejection(
    suggestionId: string,
    data: RejectionData
  ): Promise<void> {
    if (!this.config.enabled) return;

    const suggestion = this.suggestions.get(suggestionId);
    if (!suggestion) {
      logger.warn('[QualityTracker] Suggestion not found for rejection', { suggestionId });
      return;
    }

    const tags: MetricTags = {
      model: suggestion.modelId,
      language: suggestion.language || 'unknown',
      reason: data.reason || 'unknown',
    };

    // Emit rejection metrics
    this.emitMetric('suggestion.rejected', 1, tags);
    this.emitMetric('suggestion.time_to_reject', data.timeToReject, tags);

    logger.info('[QualityTracker] Rejection tracked', {
      suggestionId,
      reason: data.reason,
      timeToReject: data.timeToReject,
    });

    // Clean up stored suggestion
    this.suggestions.delete(suggestionId);
  }

  /**
   * Track user rating
   */
  async trackRating(
    suggestionId: string,
    data: RatingData
  ): Promise<void> {
    if (!this.config.enabled) return;

    const suggestion = this.suggestions.get(suggestionId);
    if (!suggestion) {
      logger.warn('[QualityTracker] Suggestion not found for rating', { suggestionId });
      return;
    }

    const tags: MetricTags = {
      model: suggestion.modelId,
      language: suggestion.language || 'unknown',
      rating: data.rating,
    };

    // Emit rating metrics
    this.emitMetric('suggestion.rated', 1, tags);
    this.emitMetric('suggestion.rating', data.rating, tags);

    logger.info('[QualityTracker] Rating tracked', {
      suggestionId,
      rating: data.rating,
      userId: data.userId,
    });
  }

  /**
   * Track quality metrics for a suggestion
   */
  async trackQualityMetrics(
    suggestionId: string,
    metrics: QualityMetrics
  ): Promise<void> {
    if (!this.config.enabled) return;

    const suggestion = this.suggestions.get(suggestionId);
    if (!suggestion) {
      logger.warn('[QualityTracker] Suggestion not found for quality metrics', { suggestionId });
      return;
    }

    const tags: MetricTags = {
      model: suggestion.modelId,
      language: suggestion.language || 'unknown',
    };

    // Emit individual quality dimension metrics
    this.emitMetric('quality.relevance', metrics.relevance, tags);
    this.emitMetric('quality.completeness', metrics.completeness, tags);
    this.emitMetric('quality.accuracy', metrics.accuracy, tags);
    this.emitMetric('quality.coherence', metrics.coherence, tags);

    // Calculate and emit overall quality score
    const overallScore = (
      metrics.relevance +
      metrics.completeness +
      metrics.accuracy +
      metrics.coherence
    ) / 4;

    this.emitMetric('quality.overall', overallScore, tags);

    logger.info('[QualityTracker] Quality metrics tracked', {
      suggestionId,
      metrics,
      overallScore,
    });
  }

  /**
   * Get acceptance rate for a model
   */
  getAcceptanceRate(modelId: string): number {
    // In production, this would query the database
    // For now, return a placeholder
    return 0;
  }

  /**
   * Get average edit distance for a model
   */
  getAverageEditDistance(modelId: string): number {
    // In production, this would query the database
    // For now, return a placeholder
    return 0;
  }

  /**
   * Flush any buffered metrics
   */
  async flush(): Promise<void> {
    await this.metricsProvider.flush();
  }

  /**
   * Shutdown the tracker
   */
  async shutdown(): Promise<void> {
    await this.metricsProvider.shutdown();
    this.suggestions.clear();
  }

  // Private helper methods

  private emitMetric(name: string, value: number, tags: MetricTags = {}): void {
    const prefixedName = `ai.quality.${name}`;

    if (name.includes('time') || name.includes('duration')) {
      this.metricsProvider.timing(prefixedName, value, { tags });
    } else if (name.includes('distance') || name.includes('rating') || name.includes('quality')) {
      this.metricsProvider.gauge(prefixedName, value, { tags });
    } else {
      this.metricsProvider.increment(prefixedName, value, { tags });
    }
  }

  private generateId(): string {
    return `suggestion_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private shouldSample(): boolean {
    return Math.random() < this.config.samplingRate;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let globalTracker: QualityTracker | null = null;

/**
 * Get the global quality tracker instance
 */
export function getQualityTracker(config?: Partial<QualityTrackingConfig>): QualityTracker {
  if (!globalTracker) {
    const metricsProvider = getMetricsProvider();
    globalTracker = new QualityTracker(metricsProvider, config);
  }
  return globalTracker;
}

/**
 * Create a new quality tracker instance
 */
export function createQualityTracker(
  metricsProvider?: IMetricsProvider,
  config?: Partial<QualityTrackingConfig>
): QualityTracker {
  const provider = metricsProvider || getMetricsProvider();
  return new QualityTracker(provider, config);
}

/**
 * Reset the global tracker (mainly for testing)
 */
export function resetQualityTracker(): void {
  globalTracker = null;
}
