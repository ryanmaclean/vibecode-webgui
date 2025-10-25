/**
 * Datadog LLM Observability Integration for Experiments
 *
 * This module integrates our experiments with Datadog's LLM Observability
 * to track AI model performance, costs, and quality metrics.
 */

import RUMMonitoring from '../monitoring/rum-client';

export interface LLMExperimentMetrics {
  experimentKey: string;
  variantKey: string;
  userId: string;
  sessionId?: string;

  // Model information
  model: string;
  provider: string;

  // Performance metrics
  latencyMs: number;
  timeToFirstTokenMs?: number;
  tokensPrompt: number;
  tokensCompletion: number;
  tokensTotal: number;

  // Cost metrics
  costUsd: number;
  costPer1kTokens?: number;

  // Quality metrics
  qualityScore?: number;
  accuracy?: number;
  userRating?: number;

  // Additional metadata
  promptLength?: number;
  responseLength?: number;
  temperature?: number;
  maxTokens?: number;
  error?: string;

  timestamp?: number;
}

export interface ExperimentAssignment {
  experimentKey: string;
  variantKey: string;
  userId: string;
  sessionId?: string;
  assignmentProbability?: number;
  timestamp?: number;
}

export interface ExperimentMetric {
  experimentKey: string;
  variantKey: string;
  userId: string;
  metricName: string;
  metricValue: number;
  metricType: 'conversion' | 'continuous' | 'count';
  timestamp?: number;
  metadata?: Record<string, any>;
}

/**
 * Datadog LLM Experiment Tracker
 *
 * Sends all experiment data to Datadog RUM with proper LLM observability tags
 */
export class DatadogLLMExperimentTracker {
  /**
   * Track LLM experiment interaction with full Datadog LLM observability
   */
  static trackLLMExperiment(metrics: LLMExperimentMetrics): void {
    const timestamp = metrics.timestamp || Date.now();

    // Track as Datadog RUM custom action with LLM-specific context
    RUMMonitoring.addAction('llm.experiment.interaction', {
      // Experiment context
      experiment_key: metrics.experimentKey,
      variant_key: metrics.variantKey,
      user_id: metrics.userId,
      session_id: metrics.sessionId,

      // LLM model information
      'llm.model': metrics.model,
      'llm.provider': metrics.provider,
      'llm.temperature': metrics.temperature,
      'llm.max_tokens': metrics.maxTokens,

      // Performance metrics for Datadog LLM Observability
      'llm.latency_ms': metrics.latencyMs,
      'llm.ttft_ms': metrics.timeToFirstTokenMs,
      'llm.tokens.prompt': metrics.tokensPrompt,
      'llm.tokens.completion': metrics.tokensCompletion,
      'llm.tokens.total': metrics.tokensTotal,

      // Cost tracking
      'llm.cost.usd': metrics.costUsd,
      'llm.cost.per_1k_tokens': metrics.costPer1kTokens,

      // Quality metrics
      'llm.quality.score': metrics.qualityScore,
      'llm.quality.accuracy': metrics.accuracy,
      'llm.quality.user_rating': metrics.userRating,

      // Additional context
      'llm.prompt_length': metrics.promptLength,
      'llm.response_length': metrics.responseLength,
      'llm.error': metrics.error,

      // Categorization for Datadog
      category: 'llm-experiment',
      timestamp,
    });

    // Also track as AI interaction for general AI observability
    RUMMonitoring.trackAIInteraction('experiment', {
      model: metrics.model,
      provider: metrics.provider,
      promptLength: metrics.promptLength,
      responseLength: metrics.responseLength,
      latency: metrics.latencyMs,
      cost: metrics.costUsd,
      userId: metrics.userId,
      sessionId: metrics.sessionId,
    });

    // Track as feature flag evaluation to show in Datadog Experiments UI
    RUMMonitoring.addFeatureFlag(metrics.experimentKey, metrics.variantKey);
  }

  /**
   * Track experiment assignment (which variant user got)
   */
  static trackAssignment(assignment: ExperimentAssignment): void {
    const timestamp = assignment.timestamp || Date.now();

    RUMMonitoring.addAction('experiment.assignment', {
      experiment_key: assignment.experimentKey,
      variant_key: assignment.variantKey,
      user_id: assignment.userId,
      session_id: assignment.sessionId,
      assignment_probability: assignment.assignmentProbability,
      category: 'experiment-assignment',
      timestamp,
    });

    // Track as feature flag for Datadog Experiments visibility
    RUMMonitoring.addFeatureFlag(assignment.experimentKey, assignment.variantKey);
  }

  /**
   * Track general experiment metric (conversions, revenue, etc.)
   */
  static trackMetric(metric: ExperimentMetric): void {
    const timestamp = metric.timestamp || Date.now();

    RUMMonitoring.addAction('experiment.metric', {
      experiment_key: metric.experimentKey,
      variant_key: metric.variantKey,
      user_id: metric.userId,
      metric_name: metric.metricName,
      metric_value: metric.metricValue,
      metric_type: metric.metricType,
      category: 'experiment-metric',
      timestamp,
      ...metric.metadata,
    });

    // Also track as business metric if it's a conversion
    if (metric.metricType === 'conversion') {
      RUMMonitoring.trackBusinessMetric(
        `experiment.${metric.experimentKey}.${metric.metricName}`,
        metric.metricValue,
        {
          variant: metric.variantKey,
          user_id: metric.userId,
        }
      );
    }
  }

  /**
   * Track experiment error
   */
  static trackError(
    experimentKey: string,
    variantKey: string,
    error: Error | string,
    context?: Record<string, any>
  ): void {
    RUMMonitoring.trackError(error, {
      component: 'experiment',
      action: 'llm-interaction',
      severity: 'medium',
      metadata: {
        experiment_key: experimentKey,
        variant_key: variantKey,
        ...context,
      },
    });
  }

  /**
   * Track comparison between models (for multi-model experiments)
   */
  static trackModelComparison(
    experimentKey: string,
    models: Array<{
      variantKey: string;
      model: string;
      metrics: Partial<LLMExperimentMetrics>;
    }>
  ): void {
    RUMMonitoring.addAction('llm.model_comparison', {
      experiment_key: experimentKey,
      models: models.map(m => ({
        variant: m.variantKey,
        model: m.model,
        latency: m.metrics.latencyMs,
        cost: m.metrics.costUsd,
        quality: m.metrics.qualityScore,
        tokens: m.metrics.tokensTotal,
      })),
      category: 'llm-comparison',
      timestamp: Date.now(),
    });
  }

  /**
   * Track experiment lifecycle events
   */
  static trackLifecycleEvent(
    experimentKey: string,
    event: 'started' | 'paused' | 'resumed' | 'completed' | 'archived',
    metadata?: Record<string, any>
  ): void {
    RUMMonitoring.addAction(`experiment.lifecycle.${event}`, {
      experiment_key: experimentKey,
      category: 'experiment-lifecycle',
      timestamp: Date.now(),
      ...metadata,
    });
  }

  /**
   * Track guardrail violation
   */
  static trackGuardrailViolation(
    experimentKey: string,
    variantKey: string,
    violation: {
      metricName: string;
      threshold: number;
      actualValue: number;
      severity: 'warning' | 'critical';
    }
  ): void {
    RUMMonitoring.addAction('experiment.guardrail_violation', {
      experiment_key: experimentKey,
      variant_key: variantKey,
      metric_name: violation.metricName,
      threshold: violation.threshold,
      actual_value: violation.actualValue,
      severity: violation.severity,
      category: 'experiment-guardrail',
      timestamp: Date.now(),
    });

    // Also track as error if critical
    if (violation.severity === 'critical') {
      RUMMonitoring.trackError(
        `Guardrail violation: ${violation.metricName} exceeded threshold`,
        {
          component: 'experiment-guardrails',
          action: 'threshold_check',
          severity: 'high',
          metadata: {
            experiment_key: experimentKey,
            variant_key: variantKey,
            ...violation,
          },
        }
      );
    }
  }

  /**
   * Track sample ratio mismatch (SRM) detection
   */
  static trackSRM(
    experimentKey: string,
    srmResult: {
      hasMismatch: boolean;
      pValue: number;
      expectedRatios: Record<string, number>;
      observedRatios: Record<string, number>;
      severity: 'none' | 'low' | 'medium' | 'high';
    }
  ): void {
    RUMMonitoring.addAction('experiment.srm_check', {
      experiment_key: experimentKey,
      has_mismatch: srmResult.hasMismatch,
      p_value: srmResult.pValue,
      severity: srmResult.severity,
      expected_ratios: srmResult.expectedRatios,
      observed_ratios: srmResult.observedRatios,
      category: 'experiment-quality',
      timestamp: Date.now(),
    });

    // Track as error if significant mismatch
    if (srmResult.hasMismatch && srmResult.severity !== 'none') {
      RUMMonitoring.trackError(
        'Sample Ratio Mismatch detected',
        {
          component: 'experiment-quality',
          action: 'srm_check',
          severity: srmResult.severity === 'high' ? 'high' : 'medium',
          metadata: {
            experiment_key: experimentKey,
            ...srmResult,
          },
        }
      );
    }
  }

  /**
   * Track statistical significance detection
   */
  static trackStatisticalSignificance(
    experimentKey: string,
    metric: string,
    result: {
      significant: boolean;
      pValue: number;
      confidenceInterval: { lower: number; upper: number };
      controlMean: number;
      treatmentMean: number;
      relativeImprovement: number;
    }
  ): void {
    RUMMonitoring.addAction('experiment.statistical_significance', {
      experiment_key: experimentKey,
      metric,
      significant: result.significant,
      p_value: result.pValue,
      control_mean: result.controlMean,
      treatment_mean: result.treatmentMean,
      relative_improvement: result.relativeImprovement,
      ci_lower: result.confidenceInterval.lower,
      ci_upper: result.confidenceInterval.upper,
      category: 'experiment-results',
      timestamp: Date.now(),
    });
  }
}

// Export singleton instance
export const datadogLLMTracker = DatadogLLMExperimentTracker;

// Export default
export default datadogLLMTracker;
