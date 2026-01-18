/**
 * Demo Guardrail Configurations
 *
 * Example guardrail setups for various experiment scenarios.
 * These can be used as templates for real experiments.
 */

import type { Guardrail } from './guardrails'
import { GUARDRAIL_TEMPLATES } from './guardrail-templates'

/**
 * Speech-to-Text Experiment Guardrails
 *
 * Monitors accuracy, latency, and error rates for STT experiments.
 */
export const speechToTextGuardrails: Guardrail[] = [
  // Critical: Error rate must stay below 1%
  GUARDRAIL_TEMPLATES.maxErrorRate(0.01),

  // Critical: P95 latency must stay below 5 seconds
  GUARDRAIL_TEMPLATES.maxP95Latency(5000),

  // Critical: Word Error Rate must stay below 5%
  {
    metricName: 'word_error_rate',
    operator: '<',
    threshold: 0.05,
    severity: 'critical',
    description: 'Word Error Rate must stay below 5%'
  },

  // Warning: Cost per request should stay reasonable
  GUARDRAIL_TEMPLATES.maxCostPerRequest(0.02)
]

/**
 * Chatbot Performance Experiment Guardrails
 *
 * Monitors user satisfaction, engagement, and response quality.
 */
export const chatbotGuardrails: Guardrail[] = [
  // Critical: Error rate must stay below 2%
  GUARDRAIL_TEMPLATES.maxErrorRate(0.02),

  // Critical: User satisfaction must stay above 4.0/5.0
  GUARDRAIL_TEMPLATES.minUserSatisfaction(4.0),

  // Warning: Users must send at least 2 messages per session
  {
    metricName: 'messages_per_session',
    operator: '>',
    threshold: 2.0,
    severity: 'warning',
    description: 'Users must send at least 2 messages per session'
  },

  // Warning: P95 latency must stay below 3 seconds
  GUARDRAIL_TEMPLATES.maxP95Latency(3000),

  // Critical: Quality score must stay above 0.7
  {
    metricName: 'quality_score',
    operator: '>',
    threshold: 0.7,
    severity: 'critical',
    description: 'Quality score must stay above 0.7'
  }
]

/**
 * Multi-Model AI Experiment Guardrails
 *
 * Monitors cost, quality, and latency for model comparisons.
 */
export const multiModelGuardrails: Guardrail[] = [
  // Warning: Cost per request must not exceed $0.05
  GUARDRAIL_TEMPLATES.maxCostPerRequest(0.05),

  // Warning: P99 latency must stay below 10 seconds
  GUARDRAIL_TEMPLATES.maxP99Latency(10000),

  // Critical: Quality score must stay above 0.7
  {
    metricName: 'quality_score',
    operator: '>',
    threshold: 0.7,
    severity: 'critical',
    description: 'Quality score must stay above 0.7'
  },

  // Critical: Error rate must stay below 1%
  GUARDRAIL_TEMPLATES.maxErrorRate(0.01),

  // Warning: Hourly cost must stay below $100
  GUARDRAIL_TEMPLATES.maxHourlyCost(100)
]

/**
 * E-commerce Checkout Experiment Guardrails
 *
 * Monitors conversion, revenue, and user experience.
 */
export const ecommerceGuardrails: Guardrail[] = [
  // Critical: Conversion rate must stay above 10%
  GUARDRAIL_TEMPLATES.minConversionRate(0.1),

  // Warning: Revenue per user must stay above $5
  GUARDRAIL_TEMPLATES.minRevenuePerUser(5.0),

  // Warning: Cart abandonment must stay below 70%
  GUARDRAIL_TEMPLATES.maxCartAbandonment(0.7),

  // Critical: P95 latency must stay below 2 seconds
  GUARDRAIL_TEMPLATES.maxP95Latency(2000),

  // Critical: Error rate must stay below 0.5%
  GUARDRAIL_TEMPLATES.maxErrorRate(0.005)
]

/**
 * API Performance Experiment Guardrails
 *
 * Monitors latency, errors, and resource usage for API changes.
 */
export const apiPerformanceGuardrails: Guardrail[] = [
  // Critical: P95 latency must stay below 1 second
  GUARDRAIL_TEMPLATES.maxP95Latency(1000),

  // Warning: P99 latency must stay below 5 seconds
  GUARDRAIL_TEMPLATES.maxP99Latency(5000),

  // Critical: 5xx error rate must stay below 0.1%
  GUARDRAIL_TEMPLATES.max5xxRate(0.001),

  // Critical: Overall error rate must stay below 1%
  GUARDRAIL_TEMPLATES.maxErrorRate(0.01),

  // Critical: CPU usage must stay below 80%
  GUARDRAIL_TEMPLATES.maxCPUUsage(80),

  // Warning: Memory usage must stay below 85%
  GUARDRAIL_TEMPLATES.maxMemoryUsage(85)
]

/**
 * Content Recommendation Experiment Guardrails
 *
 * Monitors engagement metrics for recommendation algorithm changes.
 */
export const contentRecommendationGuardrails: Guardrail[] = [
  // Warning: Session duration must stay above 2 minutes
  GUARDRAIL_TEMPLATES.minSessionDuration(120),

  // Warning: Bounce rate must stay below 50%
  GUARDRAIL_TEMPLATES.maxBounceRate(0.5),

  // Critical: User satisfaction must stay above 4.0
  GUARDRAIL_TEMPLATES.minUserSatisfaction(4.0),

  // Warning: P95 latency must stay below 2 seconds
  GUARDRAIL_TEMPLATES.maxP95Latency(2000),

  // Warning: Error rate must stay below 1%
  GUARDRAIL_TEMPLATES.maxErrorRate(0.01)
]

/**
 * Infrastructure Change Guardrails
 *
 * Comprehensive monitoring for infrastructure experiments.
 */
export const infrastructureGuardrails: Guardrail[] = [
  // Critical: Error rate must stay below 0.5%
  GUARDRAIL_TEMPLATES.maxErrorRate(0.005),

  // Critical: P95 latency must stay below 3 seconds
  GUARDRAIL_TEMPLATES.maxP95Latency(3000),

  // Critical: CPU usage must stay below 75%
  GUARDRAIL_TEMPLATES.maxCPUUsage(75),

  // Critical: Memory usage must stay below 80%
  GUARDRAIL_TEMPLATES.maxMemoryUsage(80),

  // Critical: 5xx error rate must stay below 0.1%
  GUARDRAIL_TEMPLATES.max5xxRate(0.001)
]

/**
 * Minimal Safety Guardrails
 *
 * Basic safety net for low-risk experiments.
 */
export const minimalGuardrails: Guardrail[] = [
  // Critical: Error rate must stay below 5%
  GUARDRAIL_TEMPLATES.maxErrorRate(0.05),

  // Warning: P99 latency must stay below 15 seconds
  GUARDRAIL_TEMPLATES.maxP99Latency(15000)
]

/**
 * Strict Safety Guardrails
 *
 * Comprehensive monitoring for high-risk experiments.
 */
export const strictGuardrails: Guardrail[] = [
  // Critical: Error rate must stay below 0.1%
  GUARDRAIL_TEMPLATES.maxErrorRate(0.001),

  // Critical: 5xx error rate must stay below 0.05%
  GUARDRAIL_TEMPLATES.max5xxRate(0.0005),

  // Critical: P95 latency must stay below 1 second
  GUARDRAIL_TEMPLATES.maxP95Latency(1000),

  // Warning: P99 latency must stay below 3 seconds
  GUARDRAIL_TEMPLATES.maxP99Latency(3000),

  // Critical: Quality score must stay above 0.9
  {
    metricName: 'quality_score',
    operator: '>',
    threshold: 0.9,
    severity: 'critical',
    description: 'Quality score must stay above 0.9'
  },

  // Critical: CPU usage must stay below 70%
  GUARDRAIL_TEMPLATES.maxCPUUsage(70),

  // Critical: Memory usage must stay below 75%
  GUARDRAIL_TEMPLATES.maxMemoryUsage(75)
]

/**
 * Get guardrails for a specific experiment type
 */
export function getGuardrailsForExperimentType(
  type: 'speech-to-text' | 'chatbot' | 'multi-model' | 'ecommerce' |
        'api' | 'content-recommendation' | 'infrastructure' | 'minimal' | 'strict'
): Guardrail[] {
  switch (type) {
    case 'speech-to-text':
      return speechToTextGuardrails
    case 'chatbot':
      return chatbotGuardrails
    case 'multi-model':
      return multiModelGuardrails
    case 'ecommerce':
      return ecommerceGuardrails
    case 'api':
      return apiPerformanceGuardrails
    case 'content-recommendation':
      return contentRecommendationGuardrails
    case 'infrastructure':
      return infrastructureGuardrails
    case 'minimal':
      return minimalGuardrails
    case 'strict':
      return strictGuardrails
    default:
      return minimalGuardrails
  }
}
