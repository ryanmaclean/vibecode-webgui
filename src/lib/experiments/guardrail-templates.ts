/**
 * Guardrail Templates
 *
 * Pre-configured guardrails for common experiment scenarios.
 * Provides ready-to-use templates for error rates, latency, cost,
 * quality metrics, and conversion rates.
 */

import type { Guardrail } from './guardrails'

/**
 * Collection of common guardrail templates
 */
export const GUARDRAIL_TEMPLATES = {
  // ==================== ERROR RATE GUARDRAILS ====================

  /**
   * Maximum error rate guardrail
   *
   * Ensures error rate stays below acceptable threshold.
   *
   * @param threshold - Maximum allowed error rate (0-1, default: 0.01 = 1%)
   * @returns Critical guardrail for error rate
   *
   * @example
   * const guardrail = GUARDRAIL_TEMPLATES.maxErrorRate(0.01); // 1% max
   */
  maxErrorRate: (threshold: number = 0.01): Guardrail => ({
    metricName: 'error_rate',
    operator: '<',
    threshold,
    severity: 'critical',
    description: `Error rate must not exceed ${(threshold * 100).toFixed(1)}%`
  }),

  /**
   * Maximum error count guardrail
   *
   * Caps absolute number of errors regardless of traffic volume.
   *
   * @param threshold - Maximum allowed error count (default: 100)
   * @returns Critical guardrail for error count
   */
  maxErrorCount: (threshold: number = 100): Guardrail => ({
    metricName: 'error_count',
    operator: '<',
    threshold,
    severity: 'critical',
    description: `Error count must not exceed ${threshold}`
  }),

  /**
   * Maximum 5xx error rate guardrail
   *
   * Monitors server-side errors specifically.
   *
   * @param threshold - Maximum 5xx rate (default: 0.005 = 0.5%)
   */
  max5xxRate: (threshold: number = 0.005): Guardrail => ({
    metricName: 'error_5xx_rate',
    operator: '<',
    threshold,
    severity: 'critical',
    description: `5xx error rate must not exceed ${(threshold * 100).toFixed(2)}%`
  }),

  // ==================== LATENCY GUARDRAILS ====================

  /**
   * Maximum P50 latency guardrail
   *
   * Ensures median response time stays acceptable.
   *
   * @param threshold - Maximum P50 latency in ms (default: 2000)
   */
  maxP50Latency: (threshold: number = 2000): Guardrail => ({
    metricName: 'latency_p50',
    operator: '<',
    threshold,
    severity: 'warning',
    description: `P50 latency must not exceed ${threshold}ms`
  }),

  /**
   * Maximum P95 latency guardrail
   *
   * Ensures 95th percentile latency stays within bounds.
   *
   * @param threshold - Maximum P95 latency in ms (default: 5000)
   */
  maxP95Latency: (threshold: number = 5000): Guardrail => ({
    metricName: 'latency_p95',
    operator: '<',
    threshold,
    severity: 'critical',
    description: `P95 latency must not exceed ${threshold}ms`
  }),

  /**
   * Maximum P99 latency guardrail
   *
   * Ensures tail latency doesn't degrade severely.
   *
   * @param threshold - Maximum P99 latency in ms (default: 10000)
   */
  maxP99Latency: (threshold: number = 10000): Guardrail => ({
    metricName: 'latency_p99',
    operator: '<',
    threshold,
    severity: 'warning',
    description: `P99 latency must not exceed ${threshold}ms`
  }),

  /**
   * Maximum average latency guardrail
   *
   * @param threshold - Maximum average latency in ms (default: 3000)
   */
  maxAvgLatency: (threshold: number = 3000): Guardrail => ({
    metricName: 'latency_avg',
    operator: '<',
    threshold,
    severity: 'warning',
    description: `Average latency must not exceed ${threshold}ms`
  }),

  // ==================== COST GUARDRAILS ====================

  /**
   * Maximum cost per request guardrail
   *
   * Prevents runaway costs in AI/API-heavy experiments.
   *
   * @param threshold - Maximum cost per request in USD (default: 0.05)
   */
  maxCostPerRequest: (threshold: number = 0.05): Guardrail => ({
    metricName: 'cost_per_request',
    operator: '<',
    threshold,
    severity: 'warning',
    description: `Cost per request must not exceed $${threshold.toFixed(2)}`
  }),

  /**
   * Maximum total cost guardrail
   *
   * @param threshold - Maximum total cost in USD (default: 1000)
   */
  maxTotalCost: (threshold: number = 1000): Guardrail => ({
    metricName: 'total_cost',
    operator: '<',
    threshold,
    severity: 'critical',
    description: `Total cost must not exceed $${threshold.toFixed(2)}`
  }),

  /**
   * Maximum hourly cost rate guardrail
   *
   * @param threshold - Maximum cost per hour in USD (default: 100)
   */
  maxHourlyCost: (threshold: number = 100): Guardrail => ({
    metricName: 'cost_per_hour',
    operator: '<',
    threshold,
    severity: 'critical',
    description: `Hourly cost must not exceed $${threshold.toFixed(2)}/hour`
  }),

  // ==================== QUALITY GUARDRAILS ====================

  /**
   * Minimum user satisfaction guardrail
   *
   * Ensures user satisfaction stays above threshold (e.g., rating scale).
   *
   * @param threshold - Minimum satisfaction score (default: 4.0 out of 5)
   */
  minUserSatisfaction: (threshold: number = 4.0): Guardrail => ({
    metricName: 'user_satisfaction',
    operator: '>',
    threshold,
    severity: 'critical',
    description: `User satisfaction must stay above ${threshold.toFixed(1)}/5.0`
  }),

  /**
   * Minimum NPS (Net Promoter Score) guardrail
   *
   * @param threshold - Minimum NPS score (default: 50)
   */
  minNPS: (threshold: number = 50): Guardrail => ({
    metricName: 'nps_score',
    operator: '>',
    threshold,
    severity: 'warning',
    description: `NPS score must stay above ${threshold}`
  }),

  /**
   * Minimum quality score guardrail
   *
   * Generic quality metric (0-1 scale).
   *
   * @param threshold - Minimum quality score (default: 0.7)
   */
  minQualityScore: (threshold: number = 0.7): Guardrail => ({
    metricName: 'quality_score',
    operator: '>',
    threshold,
    severity: 'critical',
    description: `Quality score must stay above ${threshold.toFixed(2)}`
  }),

  /**
   * Maximum Word Error Rate (WER) for speech recognition
   *
   * @param threshold - Maximum WER (default: 0.05 = 5%)
   */
  maxWordErrorRate: (threshold: number = 0.05): Guardrail => ({
    metricName: 'word_error_rate',
    operator: '<',
    threshold,
    severity: 'critical',
    description: `Word Error Rate must stay below ${(threshold * 100).toFixed(1)}%`
  }),

  // ==================== CONVERSION GUARDRAILS ====================

  /**
   * Minimum conversion rate guardrail
   *
   * Ensures conversion rate doesn't drop below threshold.
   *
   * @param threshold - Minimum conversion rate (default: 0.1 = 10%)
   */
  minConversionRate: (threshold: number = 0.1): Guardrail => ({
    metricName: 'conversion_rate',
    operator: '>',
    threshold,
    severity: 'warning',
    description: `Conversion rate must stay above ${(threshold * 100).toFixed(1)}%`
  }),

  /**
   * Minimum revenue per user guardrail
   *
   * @param threshold - Minimum revenue per user in USD (default: 5.0)
   */
  minRevenuePerUser: (threshold: number = 5.0): Guardrail => ({
    metricName: 'revenue_per_user',
    operator: '>',
    threshold,
    severity: 'warning',
    description: `Revenue per user must stay above $${threshold.toFixed(2)}`
  }),

  /**
   * Maximum cart abandonment rate guardrail
   *
   * @param threshold - Maximum abandonment rate (default: 0.7 = 70%)
   */
  maxCartAbandonment: (threshold: number = 0.7): Guardrail => ({
    metricName: 'cart_abandonment_rate',
    operator: '<',
    threshold,
    severity: 'warning',
    description: `Cart abandonment must stay below ${(threshold * 100).toFixed(1)}%`
  }),

  // ==================== ENGAGEMENT GUARDRAILS ====================

  /**
   * Minimum session duration guardrail
   *
   * @param threshold - Minimum average session duration in seconds (default: 120)
   */
  minSessionDuration: (threshold: number = 120): Guardrail => ({
    metricName: 'session_duration_avg',
    operator: '>',
    threshold,
    severity: 'warning',
    description: `Average session duration must stay above ${threshold}s`
  }),

  /**
   * Minimum messages per session (for chatbots)
   *
   * @param threshold - Minimum messages per session (default: 2.0)
   */
  minMessagesPerSession: (threshold: number = 2.0): Guardrail => ({
    metricName: 'messages_per_session',
    operator: '>',
    threshold,
    severity: 'warning',
    description: `Users must send at least ${threshold.toFixed(1)} messages per session`
  }),

  /**
   * Maximum bounce rate guardrail
   *
   * @param threshold - Maximum bounce rate (default: 0.6 = 60%)
   */
  maxBounceRate: (threshold: number = 0.6): Guardrail => ({
    metricName: 'bounce_rate',
    operator: '<',
    threshold,
    severity: 'warning',
    description: `Bounce rate must stay below ${(threshold * 100).toFixed(1)}%`
  }),

  // ==================== RESOURCE UTILIZATION ====================

  /**
   * Maximum CPU utilization guardrail
   *
   * @param threshold - Maximum CPU usage percentage (default: 80)
   */
  maxCPUUsage: (threshold: number = 80): Guardrail => ({
    metricName: 'cpu_usage_percent',
    operator: '<',
    threshold,
    severity: 'critical',
    description: `CPU usage must stay below ${threshold}%`
  }),

  /**
   * Maximum memory utilization guardrail
   *
   * @param threshold - Maximum memory usage percentage (default: 85)
   */
  maxMemoryUsage: (threshold: number = 85): Guardrail => ({
    metricName: 'memory_usage_percent',
    operator: '<',
    threshold,
    severity: 'critical',
    description: `Memory usage must stay below ${threshold}%`
  }),

  /**
   * Maximum request rate guardrail
   *
   * @param threshold - Maximum requests per second (default: 1000)
   */
  maxRequestRate: (threshold: number = 1000): Guardrail => ({
    metricName: 'requests_per_second',
    operator: '<',
    threshold,
    severity: 'warning',
    description: `Request rate must stay below ${threshold} req/s`
  })
}

/**
 * Pre-configured guardrail sets for common experiment types
 */
export const GUARDRAIL_PRESETS = {
  /**
   * Speech-to-text experiment guardrails
   *
   * Monitors accuracy, latency, and error rates for STT experiments.
   */
  speechToText: (): Guardrail[] => [
    GUARDRAIL_TEMPLATES.maxErrorRate(0.01),
    GUARDRAIL_TEMPLATES.maxP95Latency(5000),
    GUARDRAIL_TEMPLATES.maxWordErrorRate(0.05),
    GUARDRAIL_TEMPLATES.maxCostPerRequest(0.02)
  ],

  /**
   * Chatbot performance experiment guardrails
   *
   * Monitors user satisfaction, engagement, and response quality.
   */
  chatbot: (): Guardrail[] => [
    GUARDRAIL_TEMPLATES.maxErrorRate(0.02),
    GUARDRAIL_TEMPLATES.minUserSatisfaction(4.0),
    GUARDRAIL_TEMPLATES.minMessagesPerSession(2.0),
    GUARDRAIL_TEMPLATES.maxP95Latency(3000),
    GUARDRAIL_TEMPLATES.minQualityScore(0.7)
  ],

  /**
   * Multi-model AI experiment guardrails
   *
   * Monitors cost, quality, and latency for model comparisons.
   */
  multiModel: (): Guardrail[] => [
    GUARDRAIL_TEMPLATES.maxCostPerRequest(0.05),
    GUARDRAIL_TEMPLATES.maxP99Latency(10000),
    GUARDRAIL_TEMPLATES.minQualityScore(0.7),
    GUARDRAIL_TEMPLATES.maxErrorRate(0.01)
  ],

  /**
   * E-commerce checkout experiment guardrails
   *
   * Monitors conversion, revenue, and cart abandonment.
   */
  ecommerce: (): Guardrail[] => [
    GUARDRAIL_TEMPLATES.minConversionRate(0.1),
    GUARDRAIL_TEMPLATES.minRevenuePerUser(5.0),
    GUARDRAIL_TEMPLATES.maxCartAbandonment(0.7),
    GUARDRAIL_TEMPLATES.maxP95Latency(2000),
    GUARDRAIL_TEMPLATES.maxErrorRate(0.005)
  ],

  /**
   * API performance experiment guardrails
   *
   * Monitors latency, errors, and resource usage.
   */
  api: (): Guardrail[] => [
    GUARDRAIL_TEMPLATES.maxP95Latency(1000),
    GUARDRAIL_TEMPLATES.maxP99Latency(5000),
    GUARDRAIL_TEMPLATES.max5xxRate(0.001),
    GUARDRAIL_TEMPLATES.maxErrorRate(0.01),
    GUARDRAIL_TEMPLATES.maxCPUUsage(80)
  ],

  /**
   * Content recommendation experiment guardrails
   *
   * Monitors engagement and user satisfaction.
   */
  contentRecommendation: (): Guardrail[] => [
    GUARDRAIL_TEMPLATES.minSessionDuration(120),
    GUARDRAIL_TEMPLATES.maxBounceRate(0.5),
    GUARDRAIL_TEMPLATES.minUserSatisfaction(4.0),
    GUARDRAIL_TEMPLATES.maxP95Latency(2000)
  ],

  /**
   * Infrastructure change guardrails
   *
   * Monitors system health during infrastructure experiments.
   */
  infrastructure: (): Guardrail[] => [
    GUARDRAIL_TEMPLATES.maxErrorRate(0.005),
    GUARDRAIL_TEMPLATES.maxP95Latency(3000),
    GUARDRAIL_TEMPLATES.maxCPUUsage(75),
    GUARDRAIL_TEMPLATES.maxMemoryUsage(80),
    GUARDRAIL_TEMPLATES.max5xxRate(0.001)
  ],

  /**
   * Minimal safety guardrails
   *
   * Basic safety net for low-risk experiments.
   */
  minimal: (): Guardrail[] => [
    GUARDRAIL_TEMPLATES.maxErrorRate(0.05),
    GUARDRAIL_TEMPLATES.maxP99Latency(15000)
  ],

  /**
   * Strict safety guardrails
   *
   * Comprehensive monitoring for high-risk experiments.
   */
  strict: (): Guardrail[] => [
    GUARDRAIL_TEMPLATES.maxErrorRate(0.001),
    GUARDRAIL_TEMPLATES.max5xxRate(0.0005),
    GUARDRAIL_TEMPLATES.maxP95Latency(1000),
    GUARDRAIL_TEMPLATES.maxP99Latency(3000),
    GUARDRAIL_TEMPLATES.minQualityScore(0.9),
    GUARDRAIL_TEMPLATES.maxCPUUsage(70),
    GUARDRAIL_TEMPLATES.maxMemoryUsage(75)
  ]
}

/**
 * Helper function to create custom guardrail
 *
 * @param metricName - Name of metric to monitor
 * @param operator - Comparison operator
 * @param threshold - Threshold value
 * @param severity - Violation severity
 * @param description - Optional description
 * @returns Custom guardrail
 *
 * @example
 * const customGuardrail = createGuardrail(
 *   'custom_metric',
 *   '<',
 *   100,
 *   'critical',
 *   'Custom metric must stay below 100'
 * );
 */
export function createGuardrail(
  metricName: string,
  operator: '>' | '<' | '>=' | '<=',
  threshold: number,
  severity: 'warning' | 'critical',
  description?: string
): Guardrail {
  return {
    metricName,
    operator,
    threshold,
    severity,
    description: description || `${metricName} must be ${operator} ${threshold}`
  }
}

/**
 * Get guardrail template by name
 *
 * @param templateName - Name of template (e.g., 'maxErrorRate')
 * @param threshold - Optional threshold override
 * @returns Guardrail from template
 */
export function getTemplate(
  templateName: keyof typeof GUARDRAIL_TEMPLATES,
  threshold?: number
): Guardrail {
  const template = GUARDRAIL_TEMPLATES[templateName]

  if (!template) {
    throw new Error(`Unknown guardrail template: ${templateName}`)
  }

  return threshold !== undefined ? template(threshold) : template()
}

/**
 * Get preset guardrail set by name
 *
 * @param presetName - Name of preset (e.g., 'speechToText')
 * @returns Array of guardrails
 */
export function getPreset(
  presetName: keyof typeof GUARDRAIL_PRESETS
): Guardrail[] {
  const preset = GUARDRAIL_PRESETS[presetName]

  if (!preset) {
    throw new Error(`Unknown guardrail preset: ${presetName}`)
  }

  return preset()
}
