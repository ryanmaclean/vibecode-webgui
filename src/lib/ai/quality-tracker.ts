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
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import {
  QualityDegradationDetector,
  type QualityDegradationAlert,
  type DegradationThresholds
} from './quality-degradation-detector';
import { QualityAlertManager } from './quality-alerts';

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
  private degradationDetector: QualityDegradationDetector | null = null;
  private alertManager: QualityAlertManager | null = null;
  private monitoringInterval?: NodeJS.Timeout;

  constructor(
    metricsProvider: IMetricsProvider,
    config: Partial<QualityTrackingConfig> = {},
    degradationDetector?: QualityDegradationDetector,
    alertManager?: QualityAlertManager
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

    this.degradationDetector = degradationDetector || null;
    this.alertManager = alertManager || null;

    if (this.config.enabled) {
      logger.info('[QualityTracker] Initialized', { config: this.config });

      // Start periodic degradation monitoring if detector and alert manager are available
      if (this.degradationDetector && this.alertManager) {
        this.startDegradationMonitoring();
      }
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

    // Store in memory cache for fast lookups
    this.suggestions.set(suggestion.id, suggestion);

    // Persist to database
    try {
      const createData: Record<string, unknown> = {
        model_id: suggestion.modelId,
        suggestion: suggestion.suggestion,
        language: suggestion.language,
        context: suggestion.context as Prisma.InputJsonValue,
        timestamp: new Date(suggestion.timestamp),
        outcome: 'pending',
      };

      // Only add optional foreign keys if they exist
      if (suggestion.userId) {
        createData.user_id = parseInt(suggestion.userId);
      }
      if (suggestion.workspaceId) {
        createData.workspace_id = parseInt(suggestion.workspaceId);
      }
      if (suggestion.projectId) {
        createData.project_id = parseInt(suggestion.projectId);
      }

      await prisma.aISuggestion.create({
        data: createData as Prisma.AISuggestionUncheckedCreateInput,
      });
    } catch (error) {
      logger.error('[QualityTracker] Failed to persist suggestion to database', {
        error,
        suggestionId: suggestion.id,
      });
      // Continue even if DB persistence fails
    }

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

    // Persist acceptance to database
    try {
      await prisma.aISuggestion.updateMany({
        where: {
          model_id: suggestion.modelId,
          timestamp: new Date(suggestion.timestamp),
          outcome: 'pending',
        },
        data: {
          outcome: 'accepted',
          final_code: data.finalCode,
          edit_distance: editMetrics.distance,
          similarity: editMetrics.similarity,
          time_to_accept: data.timeToAccept,
        },
      });
    } catch (error) {
      logger.error('[QualityTracker] Failed to persist acceptance to database', {
        error,
        suggestionId,
      });
      // Continue even if DB persistence fails
    }

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

    // Persist rejection to database
    try {
      await prisma.aISuggestion.updateMany({
        where: {
          model_id: suggestion.modelId,
          timestamp: new Date(suggestion.timestamp),
          outcome: 'pending',
        },
        data: {
          outcome: 'rejected',
          time_to_reject: data.timeToReject,
          rejection_reason: data.reason,
        },
      });
    } catch (error) {
      logger.error('[QualityTracker] Failed to persist rejection to database', {
        error,
        suggestionId,
      });
      // Continue even if DB persistence fails
    }

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

    // Persist rating to database
    try {
      await prisma.aISuggestion.updateMany({
        where: {
          model_id: suggestion.modelId,
          timestamp: new Date(suggestion.timestamp),
          user_id: parseInt(data.userId),
        },
        data: {
          rating: data.rating,
          rating_comment: data.comment,
        },
      });
    } catch (error) {
      logger.error('[QualityTracker] Failed to persist rating to database', {
        error,
        suggestionId,
      });
      // Continue even if DB persistence fails
    }

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
  async getAcceptanceRate(modelId: string): Promise<number> {
    try {
      const total = await prisma.aISuggestion.count({
        where: {
          model_id: modelId,
          outcome: { in: ['accepted', 'rejected'] },
        },
      });

      if (total === 0) return 0;

      const accepted = await prisma.aISuggestion.count({
        where: {
          model_id: modelId,
          outcome: 'accepted',
        },
      });

      return accepted / total;
    } catch (error) {
      logger.error('[QualityTracker] Failed to get acceptance rate', {
        error,
        modelId,
      });
      return 0;
    }
  }

  /**
   * Get average edit distance for a model
   */
  async getAverageEditDistance(modelId: string): Promise<number> {
    try {
      const result = await prisma.aISuggestion.aggregate({
        where: {
          model_id: modelId,
          outcome: 'accepted',
          edit_distance: { not: null },
        },
        _avg: {
          edit_distance: true,
        },
      });

      return result._avg.edit_distance ?? 0;
    } catch (error) {
      logger.error('[QualityTracker] Failed to get average edit distance', {
        error,
        modelId,
      });
      return 0;
    }
  }

  /**
   * Start periodic degradation monitoring
   */
  startDegradationMonitoring(intervalMs: number = 300000): void {
    if (!this.degradationDetector || !this.alertManager) {
      logger.warn('[QualityTracker] Cannot start monitoring: detector or alert manager not initialized');
      return;
    }

    if (this.monitoringInterval) {
      logger.warn('[QualityTracker] Degradation monitoring already started');
      return;
    }

    logger.info('[QualityTracker] Starting degradation monitoring', { intervalMs });

    // Subscribe to degradation alerts
    this.degradationDetector.on('degradationDetected', (alert: QualityDegradationAlert) => {
      this.handleDegradationAlert(alert);
    });

    // Start periodic checks
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkForDegradation();
      } catch (error) {
        logger.error('[QualityTracker] Error during degradation check', { error });
      }
    }, intervalMs);
  }

  /**
   * Stop periodic degradation monitoring
   */
  stopDegradationMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      logger.info('[QualityTracker] Degradation monitoring stopped');
    }

    if (this.degradationDetector) {
      this.degradationDetector.removeAllListeners('degradationDetected');
    }
  }

  /**
   * Run a degradation check across all models
   */
  async checkForDegradation(): Promise<void> {
    if (!this.degradationDetector) {
      logger.warn('[QualityTracker] Cannot check degradation: detector not initialized');
      return;
    }

    logger.info('[QualityTracker] Running degradation check');

    try {
      const results = await this.degradationDetector.checkAllModels();

      logger.info('[QualityTracker] Degradation check complete', {
        modelsChecked: results.length,
        degradationDetected: results.filter(r => r.hasDegradation).length,
      });

      // Alerts are emitted via the 'degradationDetected' event
      // and handled by handleDegradationAlert()
    } catch (error) {
      logger.error('[QualityTracker] Failed to check for degradation', { error });
      throw error;
    }
  }

  /**
   * Handle a detected degradation alert
   */
  private async handleDegradationAlert(alert: QualityDegradationAlert): Promise<void> {
    if (!this.alertManager) {
      logger.warn('[QualityTracker] Cannot handle alert: alert manager not initialized');
      return;
    }

    try {
      logger.warn('[QualityTracker] Degradation alert detected', {
        modelId: alert.modelId,
        alertType: alert.alertType,
        severity: alert.severity,
        message: alert.message,
      });

      // Create the alert in the database
      const alertRecord = await this.alertManager.createAlert(alert);

      // Emit metrics for the alert
      this.emitMetric('degradation.alert', 1, {
        model: alert.modelId,
        alert_type: alert.alertType,
        severity: alert.severity,
      });

      logger.info('[QualityTracker] Alert created', {
        alertId: alertRecord.id,
        modelId: alert.modelId,
        alertType: alert.alertType,
      });
    } catch (error) {
      logger.error('[QualityTracker] Failed to handle degradation alert', {
        error,
        alert,
      });
    }
  }

  /**
   * Get active degradation alerts
   */
  async getActiveAlerts(modelId?: string): Promise<any[]> {
    if (!this.alertManager) {
      logger.warn('[QualityTracker] Cannot get alerts: alert manager not initialized');
      return [];
    }

    try {
      return await this.alertManager.getActiveAlerts({ modelId });
    } catch (error) {
      logger.error('[QualityTracker] Failed to get active alerts', { error, modelId });
      return [];
    }
  }

  /**
   * Resolve a degradation alert
   */
  async resolveAlert(alertId: number, resolutionNote?: string): Promise<void> {
    if (!this.alertManager) {
      logger.warn('[QualityTracker] Cannot resolve alert: alert manager not initialized');
      return;
    }

    try {
      await this.alertManager.resolveAlert(alertId, resolutionNote);
      logger.info('[QualityTracker] Alert resolved', { alertId, resolutionNote });
    } catch (error) {
      logger.error('[QualityTracker] Failed to resolve alert', { error, alertId });
      throw error;
    }
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
    this.stopDegradationMonitoring();
    await this.metricsProvider.shutdown();
    this.suggestions.clear();

    if (this.degradationDetector) {
      this.degradationDetector.shutdown();
    }

    if (this.alertManager) {
      this.alertManager.shutdown();
    }
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
export function getQualityTracker(
  config?: Partial<QualityTrackingConfig>,
  degradationThresholds?: Partial<DegradationThresholds>
): QualityTracker {
  if (!globalTracker) {
    const metricsProvider = getMetricsProvider();

    // Initialize degradation detector and alert manager
    const degradationDetector = new QualityDegradationDetector(prisma, degradationThresholds);
    const alertManager = new QualityAlertManager(prisma);

    globalTracker = new QualityTracker(
      metricsProvider,
      config,
      degradationDetector,
      alertManager
    );
  }
  return globalTracker;
}

/**
 * Create a new quality tracker instance
 */
export function createQualityTracker(
  metricsProvider?: IMetricsProvider,
  config?: Partial<QualityTrackingConfig>,
  degradationDetector?: QualityDegradationDetector,
  alertManager?: QualityAlertManager
): QualityTracker {
  const provider = metricsProvider || getMetricsProvider();
  return new QualityTracker(provider, config, degradationDetector, alertManager);
}

/**
 * Reset the global tracker (mainly for testing)
 */
export function resetQualityTracker(): void {
  globalTracker = null;
}
