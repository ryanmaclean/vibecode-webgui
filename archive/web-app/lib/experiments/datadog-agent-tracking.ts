/**
 * Server-Side Datadog Agent Tracking for Experiments
 *
 * Uses DogStatsD (UDP localhost:8125) to send metrics directly to the Datadog agent
 * This works in Node.js (server-side) unlike RUM which requires a browser.
 */

import { StatsD } from 'hot-shots';
import type { LLMExperimentMetrics, ExperimentAssignment, ExperimentMetric } from './datadog-llm-tracking';

// Initialize DogStatsD client
const dogstatsd = new StatsD({
  host: 'localhost',
  port: 8125,
  prefix: 'vibecode.experiments.',
  globalTags: {
    service: 'vibecode-experiments',
    env: process.env.DD_ENV || 'development'
  }
});

export class DatadogAgentExperimentTracker {
  /**
   * Track LLM experiment with full observability metrics
   */
  static trackLLMExperiment(metrics: LLMExperimentMetrics): void {
    const tags = [
      `experiment:${metrics.experimentKey}`,
      `variant:${metrics.variantKey}`,
      `model:${metrics.model}`,
      `provider:${metrics.provider}`,
      `user_id:${metrics.userId}`,
    ];

    // Track latency
    dogstatsd.histogram('llm.latency_ms', metrics.latencyMs, tags);

    // Track time to first token
    if (metrics.timeToFirstTokenMs) {
      dogstatsd.histogram('llm.ttft_ms', metrics.timeToFirstTokenMs, tags);
    }

    // Track token usage
    dogstatsd.histogram('llm.tokens.prompt', metrics.tokensPrompt, tags);
    dogstatsd.histogram('llm.tokens.completion', metrics.tokensCompletion, tags);
    dogstatsd.histogram('llm.tokens.total', metrics.tokensTotal, tags);

    // Track cost
    dogstatsd.histogram('llm.cost.usd', metrics.costUsd, tags);

    // Track quality
    if (metrics.qualityScore !== undefined) {
      dogstatsd.histogram('llm.quality.score', metrics.qualityScore, tags);
    }

    // Increment interaction counter
    dogstatsd.increment('llm.interactions', 1, tags);

    console.log(`[Datadog Agent] Tracked LLM experiment: ${metrics.experimentKey}/${metrics.variantKey}`);
  }

  /**
   * Track experiment assignment
   */
  static trackAssignment(assignment: ExperimentAssignment): void {
    const tags = [
      `experiment:${assignment.experimentKey}`,
      `variant:${assignment.variantKey}`,
      `user_id:${assignment.userId}`,
    ];

    // Increment assignment counter
    dogstatsd.increment('assignments', 1, tags);

    console.log(`[Datadog Agent] Tracked assignment: ${assignment.experimentKey}/${assignment.variantKey}`);
  }

  /**
   * Track experiment metric (conversions, continuous metrics)
   */
  static trackMetric(metric: ExperimentMetric): void {
    const tags = [
      `experiment:${metric.experimentKey}`,
      `variant:${metric.variantKey}`,
      `metric:${metric.metricName}`,
      `type:${metric.metricType}`,
      `user_id:${metric.userId}`,
    ];

    if (metric.metricType === 'conversion') {
      // Track as counter
      dogstatsd.increment(`conversions.${metric.metricName}`, metric.metricValue, tags);
    } else if (metric.metricType === 'continuous') {
      // Track as histogram
      dogstatsd.histogram(`metrics.${metric.metricName}`, metric.metricValue, tags);
    } else if (metric.metricType === 'count') {
      // Track as counter
      dogstatsd.increment(`counts.${metric.metricName}`, metric.metricValue, tags);
    }

    console.log(`[Datadog Agent] Tracked metric: ${metric.metricName} = ${metric.metricValue}`);
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
    const tags = [
      `experiment:${experimentKey}`,
      `variant:${variantKey}`,
      `error:${error instanceof Error ? error.name : 'unknown'}`,
    ];

    dogstatsd.increment('errors', 1, tags);

    console.error(`[Datadog Agent] Tracked error in ${experimentKey}/${variantKey}:`, error);
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
    const tags = [
      `experiment:${experimentKey}`,
      `variant:${variantKey}`,
      `metric:${violation.metricName}`,
      `severity:${violation.severity}`,
    ];

    dogstatsd.increment('guardrail_violations', 1, tags);
    dogstatsd.histogram('guardrail.threshold', violation.threshold, tags);
    dogstatsd.histogram('guardrail.actual_value', violation.actualValue, tags);

    console.warn(
      `[Datadog Agent] Guardrail violation: ${violation.metricName} = ${violation.actualValue} (threshold: ${violation.threshold})`
    );
  }

  /**
   * Close the DogStatsD connection
   */
  static close(): void {
    dogstatsd.close();
  }
}

// Export singleton instance
export const datadogAgentTracker = DatadogAgentExperimentTracker;

// Export default
export default datadogAgentTracker;
