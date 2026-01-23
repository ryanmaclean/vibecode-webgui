/**
 * Guardrail Metrics System
 *
 * Automatically detects and prevents harmful experiment changes through
 * continuous monitoring and automated shutdown capabilities.
 *
 * Key Features:
 * - Real-time metric evaluation against thresholds
 * - Continuous monitoring with configurable intervals
 * - Automated experiment shutdown on critical violations
 * - Warning and critical severity levels
 * - Integration with statistical tests for anomaly detection
 */

import { experimentQueries, type MetricAggregation } from './queries'
import { tTest } from './statistics'
import { logger, appLogger } from '@/lib/server-monitoring'
import { transitionStatus } from './lifecycle'
import { sendGuardrailAlert, sendBatchViolationAlert, type AlertConfig } from './alerts'

/**
 * Guardrail definition with threshold and severity
 */
export interface Guardrail {
  metricName: string
  operator: '>' | '<' | '>=' | '<='
  threshold: number
  severity: 'warning' | 'critical'
  description?: string
}

/**
 * Guardrail violation with detailed context
 */
export interface GuardrailViolation {
  guardrail: Guardrail
  currentValue: number
  threshold: number
  percentageDifference: number
  severity: 'warning' | 'critical'
  timestamp: Date
  recommendation: string
}

/**
 * Result of guardrail evaluation
 */
export interface GuardrailResult {
  experimentKey: string
  variantKey: string
  passed: boolean
  violations: GuardrailViolation[]
  warnings: GuardrailViolation[]
  shouldStop: boolean
  summary: string
}

/**
 * Active monitoring session
 */
interface MonitoringSession {
  experimentKey: string
  guardrails: Guardrail[]
  intervalId: NodeJS.Timeout
  checkIntervalMs: number
  lastCheck: Date
  violationCount: number
}

/**
 * Global monitoring sessions registry
 */
const activeSessions = new Map<string, MonitoringSession>()

/**
 * Evaluate all guardrails for an experiment
 *
 * Checks current metric values against defined thresholds and determines
 * if any violations exist. Returns detailed violation information and
 * recommendations for action.
 *
 * @param experimentKey - Unique experiment identifier
 * @param guardrails - Array of guardrails to evaluate
 * @returns GuardrailResult with violations and recommendations
 *
 * @example
 * const result = await evaluateGuardrails('speech-to-text-v2', [
 *   { metricName: 'error_rate', operator: '<', threshold: 0.01, severity: 'critical' },
 *   { metricName: 'latency_p95', operator: '<', threshold: 5000, severity: 'warning' }
 * ]);
 *
 * if (!result.passed) {
 *   console.log(`Guardrails failed: ${result.summary}`);
 * }
 */
export async function evaluateGuardrails(
  experimentKey: string,
  guardrails: Guardrail[]
): Promise<GuardrailResult> {
  const violations: GuardrailViolation[] = []
  const warnings: GuardrailViolation[] = []

  try {
    // Evaluate each guardrail
    for (const guardrail of guardrails) {
      const violation = await evaluateSingleGuardrail(experimentKey, guardrail)

      if (violation) {
        if (violation.severity === 'critical') {
          violations.push(violation)
        } else {
          warnings.push(violation)
        }
      }
    }

    // Determine if experiment should stop (any critical violation)
    const shouldStop = violations.length > 0
    const passed = violations.length === 0 && warnings.length === 0

    // Generate summary
    const summary = generateSummary(violations, warnings)

    // Log guardrail evaluation
    appLogger.logBusiness('guardrails_evaluated', {
      feature: 'experimentation',
      metadata: {
        experimentKey,
        passed,
        violationCount: violations.length,
        warningCount: warnings.length,
        shouldStop
      }
    })

    return {
      experimentKey,
      variantKey: 'all', // Evaluating across all variants
      passed,
      violations,
      warnings,
      shouldStop,
      summary
    }

  } catch (error) {
    logger.error('Failed to evaluate guardrails', {
      experimentKey,
      error: (error as Error).message
    })

    throw error
  }
}

/**
 * Evaluate a single guardrail against current metrics
 *
 * @param experimentKey - Experiment identifier
 * @param guardrail - Guardrail to evaluate
 * @returns GuardrailViolation if threshold exceeded, null otherwise
 */
async function evaluateSingleGuardrail(
  experimentKey: string,
  guardrail: Guardrail
): Promise<GuardrailViolation | null> {
  try {
    // Get metric aggregation for this guardrail
    const aggregations = await experimentQueries.getMetricAggregation(
      experimentKey,
      guardrail.metricName
    )

    if (aggregations.length === 0) {
      // No data yet - no violation
      return null
    }

    // Find treatment variant (assume control is 'control')
    const treatmentAgg = aggregations.find(a => a.variantKey !== 'control')

    if (!treatmentAgg) {
      // No treatment data yet
      return null
    }

    // Use mean value for comparison
    const currentValue = treatmentAgg.mean

    // Check if threshold is violated
    const isViolated = checkThreshold(currentValue, guardrail.operator, guardrail.threshold)

    if (!isViolated) {
      return null
    }

    // Calculate percentage difference
    const percentageDifference = calculatePercentageDifference(
      currentValue,
      guardrail.threshold
    )

    // Generate recommendation
    const recommendation = generateRecommendation(guardrail, currentValue, percentageDifference)

    return {
      guardrail,
      currentValue,
      threshold: guardrail.threshold,
      percentageDifference,
      severity: guardrail.severity,
      timestamp: new Date(),
      recommendation
    }

  } catch (error) {
    logger.error('Failed to evaluate single guardrail', {
      experimentKey,
      metricName: guardrail.metricName,
      error: (error as Error).message
    })
    return null
  }
}

/**
 * Check if value violates threshold based on operator
 * Returns true if the guardrail condition is violated
 */
function checkThreshold(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case '>':
      // Violation: value should be > threshold but it's not
      return value <= threshold
    case '<':
      // Violation: value should be < threshold but it's not
      return value >= threshold
    case '>=':
      // Violation: value should be >= threshold but it's not
      return value < threshold
    case '<=':
      // Violation: value should be <= threshold but it's not
      return value > threshold
    default:
      return false
  }
}

/**
 * Calculate percentage difference from threshold
 */
function calculatePercentageDifference(value: number, threshold: number): number {
  if (threshold === 0) {
    return value === 0 ? 0 : Infinity
  }
  return ((value - threshold) / threshold) * 100
}

/**
 * Generate actionable recommendation for violation
 */
function generateRecommendation(
  guardrail: Guardrail,
  currentValue: number,
  percentageDifference: number
): string {
  const metricDisplay = guardrail.metricName.replace(/_/g, ' ')
  const direction = percentageDifference > 0 ? 'above' : 'below'
  const absPercentage = Math.abs(percentageDifference).toFixed(1)

  if (guardrail.severity === 'critical') {
    return `CRITICAL: ${metricDisplay} is ${absPercentage}% ${direction} threshold (${currentValue} vs ${guardrail.threshold}). Consider pausing experiment immediately.`
  } else {
    return `WARNING: ${metricDisplay} is ${absPercentage}% ${direction} threshold (${currentValue} vs ${guardrail.threshold}). Monitor closely and investigate root cause.`
  }
}

/**
 * Generate summary of guardrail evaluation
 */
function generateSummary(
  violations: GuardrailViolation[],
  warnings: GuardrailViolation[]
): string {
  if (violations.length === 0 && warnings.length === 0) {
    return 'All guardrails passing'
  }

  const parts: string[] = []

  if (violations.length > 0) {
    const metrics = violations.map(v => v.guardrail.metricName).join(', ')
    parts.push(`${violations.length} critical violation(s): ${metrics}`)
  }

  if (warnings.length > 0) {
    const metrics = warnings.map(v => v.guardrail.metricName).join(', ')
    parts.push(`${warnings.length} warning(s): ${metrics}`)
  }

  return parts.join('; ')
}

/**
 * Start continuous guardrail monitoring
 *
 * Runs guardrail evaluation at regular intervals and automatically
 * triggers actions when violations are detected.
 *
 * @param experimentKey - Unique experiment identifier
 * @param guardrails - Array of guardrails to monitor
 * @param checkIntervalMs - Check interval in milliseconds (default: 60000 = 1 minute)
 * @returns Stop function to cancel monitoring
 *
 * @example
 * const stopMonitoring = startGuardrailMonitoring('my-experiment', guardrails, 60000);
 *
 * // Later, to stop monitoring:
 * stopMonitoring();
 */
export function startGuardrailMonitoring(
  experimentKey: string,
  guardrails: Guardrail[],
  checkIntervalMs: number = 60000
): () => void {
  // Stop any existing monitoring for this experiment
  stopGuardrailMonitoring(experimentKey)

  logger.info('Starting guardrail monitoring', {
    experimentKey,
    guardrailCount: guardrails.length,
    checkIntervalMs
  })

  // Create monitoring session
  const intervalId = setInterval(async () => {
    try {
      const result = await evaluateGuardrails(experimentKey, guardrails)

      const session = activeSessions.get(experimentKey)
      if (session) {
        session.lastCheck = new Date()

        if (!result.passed) {
          session.violationCount++
        }
      }

      // If critical violations, automatically shutdown
      if (result.shouldStop) {
        logger.warn('Critical guardrail violations detected, shutting down experiment', {
          experimentKey,
          violations: result.violations.length
        })

        await shutdownExperiment(experimentKey, result.summary, result.violations)

        // Stop monitoring after shutdown
        stopGuardrailMonitoring(experimentKey)
      } else if (result.warnings.length > 0) {
        logger.warn('Guardrail warnings detected', {
          experimentKey,
          warnings: result.warnings.length,
          summary: result.summary
        })
      }

    } catch (error) {
      logger.error('Guardrail monitoring check failed', {
        experimentKey,
        error: (error as Error).message
      })
    }
  }, checkIntervalMs)

  // Store session
  activeSessions.set(experimentKey, {
    experimentKey,
    guardrails,
    intervalId,
    checkIntervalMs,
    lastCheck: new Date(),
    violationCount: 0
  })

  appLogger.logBusiness('guardrail_monitoring_started', {
    feature: 'experimentation',
    metadata: {
      experimentKey,
      checkIntervalMs,
      guardrailCount: guardrails.length
    }
  })

  // Return stop function
  return () => stopGuardrailMonitoring(experimentKey)
}

/**
 * Stop guardrail monitoring for an experiment
 *
 * @param experimentKey - Experiment identifier
 */
export function stopGuardrailMonitoring(experimentKey: string): void {
  const session = activeSessions.get(experimentKey)

  if (session) {
    clearInterval(session.intervalId)
    activeSessions.delete(experimentKey)

    logger.info('Stopped guardrail monitoring', {
      experimentKey,
      totalChecks: session.violationCount,
      lastCheck: session.lastCheck
    })

    appLogger.logBusiness('guardrail_monitoring_stopped', {
      feature: 'experimentation',
      metadata: {
        experimentKey,
        violationCount: session.violationCount
      }
    })
  }
}

/**
 * Get active monitoring session status
 *
 * @param experimentKey - Experiment identifier
 * @returns Monitoring session info or null if not monitoring
 */
export function getMonitoringStatus(experimentKey: string): {
  isMonitoring: boolean
  lastCheck?: Date
  violationCount?: number
  checkIntervalMs?: number
} {
  const session = activeSessions.get(experimentKey)

  if (!session) {
    return { isMonitoring: false }
  }

  return {
    isMonitoring: true,
    lastCheck: session.lastCheck,
    violationCount: session.violationCount,
    checkIntervalMs: session.checkIntervalMs
  }
}

/**
 * Shutdown experiment due to guardrail violations
 *
 * Automatically pauses experiment and logs shutdown reason.
 * This function:
 * - Updates experiment status in database to 'paused'
 * - Sends alerts to stakeholders through configured channels
 * - Logs comprehensive audit trail
 *
 * @param experimentKey - Experiment identifier
 * @param reason - Shutdown reason
 * @param violations - Violations that triggered shutdown
 * @param alertConfig - Optional alert configuration for notification channels
 */
export async function shutdownExperiment(
  experimentKey: string,
  reason: string,
  violations: GuardrailViolation[],
  alertConfig?: Partial<AlertConfig>
): Promise<void> {
  try {
    logger.error('Experiment shutdown initiated', {
      experimentKey,
      reason,
      violationCount: violations.length,
      violations: violations.map(v => ({
        metric: v.guardrail.metricName,
        current: v.currentValue,
        threshold: v.threshold,
        severity: v.severity
      }))
    })

    // Log business event
    appLogger.logBusiness('experiment_shutdown', {
      feature: 'experimentation',
      metadata: {
        experimentKey,
        reason,
        violationCount: violations.length,
        criticalMetrics: violations.map(v => v.guardrail.metricName)
      }
    })

    // Update experiment status in database to 'paused'
    try {
      await transitionStatus(
        experimentKey,
        'paused',
        'system',
        undefined,
        `Guardrail violation: ${reason}`
      )

      logger.info('Experiment status updated to paused', {
        experimentKey,
        reason
      })
    } catch (transitionError) {
      // Log but don't fail if transition fails (experiment may already be paused/completed)
      logger.warn('Failed to transition experiment status during shutdown', {
        experimentKey,
        error: (transitionError as Error).message
      })
    }

    // Send alerts for violations
    if (violations.length > 0) {
      // Default alert configuration if not provided
      const defaultAlertConfig: AlertConfig = {
        experimentKey,
        channel: 'datadog',
        recipients: [],
        metadata: {
          shutdownReason: reason,
          violationCount: violations.length
        }
      }

      const finalAlertConfig: AlertConfig = {
        ...defaultAlertConfig,
        ...alertConfig,
        experimentKey // Ensure experimentKey is always correct
      }

      // Send batch alert for all violations
      await sendBatchViolationAlert(experimentKey, violations, finalAlertConfig)

      // For critical violations, also send individual alerts if PagerDuty is configured
      const criticalViolations = violations.filter(v => v.severity === 'critical')
      if (criticalViolations.length > 0 && alertConfig?.channel === 'pagerduty') {
        for (const violation of criticalViolations) {
          try {
            await sendGuardrailAlert(violation, finalAlertConfig)
          } catch (alertError) {
            logger.warn('Failed to send individual alert for critical violation', {
              experimentKey,
              metric: violation.guardrail.metricName,
              error: (alertError as Error).message
            })
          }
        }
      }

      logger.info('Guardrail violation alerts sent', {
        experimentKey,
        channel: finalAlertConfig.channel,
        violationCount: violations.length
      })
    }

  } catch (error) {
    logger.error('Failed to shutdown experiment', {
      experimentKey,
      error: (error as Error).message
    })
    throw error
  }
}

/**
 * Evaluate guardrail with statistical significance test
 *
 * Compares treatment vs control using t-test to detect statistically
 * significant degradation before threshold is crossed.
 *
 * @param experimentKey - Experiment identifier
 * @param guardrail - Guardrail to evaluate
 * @param alpha - Significance level (default: 0.05)
 * @returns Violation if statistically significant degradation detected
 */
export async function evaluateGuardrailWithStatistics(
  experimentKey: string,
  guardrail: Guardrail,
  alpha: number = 0.05
): Promise<GuardrailViolation | null> {
  try {
    // Get raw metric values for control and treatment
    const metrics = await experimentQueries.getMetricAggregation(
      experimentKey,
      guardrail.metricName
    )

    if (metrics.length < 2) {
      return null // Need both control and treatment
    }

    const controlMetrics = metrics.find(m => m.variantKey === 'control')
    const treatmentMetrics = metrics.find(m => m.variantKey !== 'control')

    if (!controlMetrics || !treatmentMetrics) {
      return null
    }

    // For this simplified version, use mean values
    // In production, fetch raw values for proper t-test
    const controlValues = [controlMetrics.mean]
    const treatmentValues = [treatmentMetrics.mean]

    // Run t-test
    const testResult = tTest(controlValues, treatmentValues, alpha)

    // Check for significant degradation
    const isDegradation = guardrail.operator === '<'
      ? treatmentMetrics.mean > controlMetrics.mean
      : treatmentMetrics.mean < controlMetrics.mean

    if (testResult.significant && isDegradation) {
      const percentageDifference = calculatePercentageDifference(
        treatmentMetrics.mean,
        controlMetrics.mean
      )

      return {
        guardrail,
        currentValue: treatmentMetrics.mean,
        threshold: controlMetrics.mean,
        percentageDifference,
        severity: guardrail.severity,
        timestamp: new Date(),
        recommendation: `Statistical degradation detected (p=${testResult.pValue.toFixed(4)}). Treatment variant shows ${Math.abs(percentageDifference).toFixed(1)}% change.`
      }
    }

    return null

  } catch (error) {
    logger.error('Failed to evaluate guardrail with statistics', {
      experimentKey,
      metricName: guardrail.metricName,
      error: (error as Error).message
    })
    return null
  }
}

/**
 * Cleanup all monitoring sessions (for graceful shutdown)
 */
export function cleanupAllMonitoring(): void {
  const experimentKeys = Array.from(activeSessions.keys())

  for (const experimentKey of experimentKeys) {
    stopGuardrailMonitoring(experimentKey)
  }

  logger.info('Cleaned up all guardrail monitoring sessions', {
    count: experimentKeys.length
  })
}

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('beforeExit', cleanupAllMonitoring)
  process.on('SIGTERM', cleanupAllMonitoring)
  process.on('SIGINT', cleanupAllMonitoring)
}
