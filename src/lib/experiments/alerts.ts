/**
 * Guardrail Alerts and Datadog Integration
 *
 * Sends alerts when guardrail violations occur through multiple channels:
 * - Datadog RUM custom events
 * - Datadog monitors (programmatic creation)
 * - Email notifications
 * - Slack webhooks
 * - PagerDuty incidents
 */

import RUMMonitoring from '@/lib/monitoring/rum-client'
import { logger, appLogger } from '@/lib/server-monitoring'
import type { Guardrail, GuardrailViolation } from './guardrails'

/**
 * Alert channel configuration
 */
export interface AlertConfig {
  experimentKey: string
  channel: 'datadog' | 'email' | 'slack' | 'pagerduty'
  recipients: string[]
  metadata?: Record<string, any>
}

/**
 * Datadog monitor configuration
 */
export interface DatadogMonitorConfig {
  name: string
  type: 'metric alert' | 'log alert' | 'composite'
  query: string
  message: string
  tags: string[]
  priority?: 1 | 2 | 3 | 4 | 5
  thresholds?: {
    critical?: number
    warning?: number
    ok?: number
  }
}

/**
 * Send guardrail violation alert through configured channel
 *
 * @param violation - Guardrail violation details
 * @param config - Alert configuration
 *
 * @example
 * await sendGuardrailAlert(violation, {
 *   experimentKey: 'my-experiment',
 *   channel: 'datadog',
 *   recipients: ['team@example.com']
 * });
 */
export async function sendGuardrailAlert(
  violation: GuardrailViolation,
  config: AlertConfig
): Promise<void> {
  try {
    logger.info('Sending guardrail alert', {
      experimentKey: config.experimentKey,
      channel: config.channel,
      metric: violation.guardrail.metricName,
      severity: violation.severity
    })

    switch (config.channel) {
      case 'datadog':
        await sendDatadogAlert(violation, config)
        break

      case 'email':
        await sendEmailAlert(violation, config)
        break

      case 'slack':
        await sendSlackAlert(violation, config)
        break

      case 'pagerduty':
        await sendPagerDutyAlert(violation, config)
        break

      default:
        throw new Error(`Unknown alert channel: ${config.channel}`)
    }

    appLogger.logBusiness('guardrail_alert_sent', {
      feature: 'experimentation',
      metadata: {
        experimentKey: config.experimentKey,
        channel: config.channel,
        severity: violation.severity,
        metric: violation.guardrail.metricName
      }
    })

  } catch (error) {
    logger.error('Failed to send guardrail alert', {
      experimentKey: config.experimentKey,
      channel: config.channel,
      error: (error as Error).message
    })
    throw error
  }
}

/**
 * Track guardrail violation in Datadog RUM
 *
 * Sends custom event to Datadog for real-time monitoring and alerting.
 *
 * @param experimentKey - Experiment identifier
 * @param violation - Violation details
 *
 * @example
 * trackGuardrailViolation('my-experiment', violation);
 */
export function trackGuardrailViolation(
  experimentKey: string,
  violation: GuardrailViolation
): void {
  try {
    RUMMonitoring.addAction('guardrail_violation', {
      experiment: experimentKey,
      metric: violation.guardrail.metricName,
      threshold: violation.threshold,
      currentValue: violation.currentValue,
      percentageDifference: violation.percentageDifference,
      severity: violation.severity,
      operator: violation.guardrail.operator,
      description: violation.guardrail.description,
      recommendation: violation.recommendation,
      timestamp: violation.timestamp.toISOString(),
      category: 'experiment-guardrail'
    })

    // Also track as error if critical
    if (violation.severity === 'critical') {
      RUMMonitoring.addError(
        new Error(`Critical guardrail violation: ${violation.guardrail.metricName}`),
        {
          experiment: experimentKey,
          metric: violation.guardrail.metricName,
          currentValue: violation.currentValue,
          threshold: violation.threshold,
          severity: 'critical',
          category: 'experiment-guardrail'
        }
      )
    }

    logger.debug('Guardrail violation tracked in Datadog RUM', {
      experimentKey,
      metric: violation.guardrail.metricName
    })

  } catch (error) {
    logger.error('Failed to track guardrail violation in Datadog', {
      experimentKey,
      error: (error as Error).message
    })
  }
}

/**
 * Track guardrail evaluation success
 *
 * @param experimentKey - Experiment identifier
 * @param guardrailCount - Number of guardrails evaluated
 */
export function trackGuardrailSuccess(
  experimentKey: string,
  guardrailCount: number
): void {
  try {
    RUMMonitoring.addAction('guardrail_evaluation_success', {
      experiment: experimentKey,
      guardrailCount,
      timestamp: new Date().toISOString(),
      category: 'experiment-guardrail'
    })
  } catch (error) {
    logger.error('Failed to track guardrail success', {
      experimentKey,
      error: (error as Error).message
    })
  }
}

/**
 * Send alert via Datadog
 *
 * @param violation - Violation details
 * @param config - Alert configuration
 */
async function sendDatadogAlert(
  violation: GuardrailViolation,
  config: AlertConfig
): Promise<void> {
  // Track in RUM
  trackGuardrailViolation(config.experimentKey, violation)

  // Send business metric
  RUMMonitoring.trackBusinessMetric('guardrail_violation', 1, {
    experiment: config.experimentKey,
    metric: violation.guardrail.metricName,
    severity: violation.severity,
    percentageDifference: violation.percentageDifference
  })

  logger.info('Datadog alert sent', {
    experimentKey: config.experimentKey,
    metric: violation.guardrail.metricName
  })
}

/**
 * Send email alert
 *
 * @param violation - Violation details
 * @param config - Alert configuration
 */
async function sendEmailAlert(
  violation: GuardrailViolation,
  config: AlertConfig
): Promise<void> {
  const subject = `[${violation.severity.toUpperCase()}] Guardrail Violation: ${config.experimentKey}`

  const body = `
Experiment: ${config.experimentKey}
Metric: ${violation.guardrail.metricName}
Severity: ${violation.severity}

Current Value: ${violation.currentValue.toFixed(4)}
Threshold: ${violation.threshold.toFixed(4)}
Difference: ${violation.percentageDifference.toFixed(2)}%

${violation.recommendation}

Timestamp: ${violation.timestamp.toISOString()}
  `.trim()

  // TODO: Implement actual email sending
  // For now, just log
  logger.info('Email alert would be sent', {
    recipients: config.recipients,
    subject,
    experimentKey: config.experimentKey
  })

  // In production, use a service like SendGrid, AWS SES, etc.
  // await sendEmail({
  //   to: config.recipients,
  //   subject,
  //   body,
  //   html: formatEmailHTML(violation, config)
  // })
}

/**
 * Send Slack alert
 *
 * @param violation - Violation details
 * @param config - Alert configuration
 */
async function sendSlackAlert(
  violation: GuardrailViolation,
  config: AlertConfig
): Promise<void> {
  const color = violation.severity === 'critical' ? 'danger' : 'warning'
  const emoji = violation.severity === 'critical' ? ':rotating_light:' : ':warning:'

  const message = {
    text: `${emoji} Guardrail Violation in ${config.experimentKey}`,
    attachments: [
      {
        color,
        fields: [
          {
            title: 'Experiment',
            value: config.experimentKey,
            short: true
          },
          {
            title: 'Metric',
            value: violation.guardrail.metricName,
            short: true
          },
          {
            title: 'Severity',
            value: violation.severity.toUpperCase(),
            short: true
          },
          {
            title: 'Current Value',
            value: violation.currentValue.toFixed(4),
            short: true
          },
          {
            title: 'Threshold',
            value: violation.threshold.toFixed(4),
            short: true
          },
          {
            title: 'Difference',
            value: `${violation.percentageDifference.toFixed(2)}%`,
            short: true
          },
          {
            title: 'Recommendation',
            value: violation.recommendation,
            short: false
          }
        ],
        footer: 'Experiment Guardrails',
        ts: Math.floor(violation.timestamp.getTime() / 1000)
      }
    ]
  }

  // TODO: Implement actual Slack webhook
  logger.info('Slack alert would be sent', {
    webhooks: config.recipients,
    experimentKey: config.experimentKey,
    message
  })

  // In production, send to Slack webhook:
  // for (const webhook of config.recipients) {
  //   await fetch(webhook, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify(message)
  //   })
  // }
}

/**
 * Send PagerDuty alert
 *
 * @param violation - Violation details
 * @param config - Alert configuration
 */
async function sendPagerDutyAlert(
  violation: GuardrailViolation,
  config: AlertConfig
): Promise<void> {
  const event = {
    routing_key: config.recipients[0], // PagerDuty integration key
    event_action: 'trigger',
    dedup_key: `guardrail_${config.experimentKey}_${violation.guardrail.metricName}`,
    payload: {
      summary: `Guardrail violation in ${config.experimentKey}: ${violation.guardrail.metricName}`,
      severity: violation.severity === 'critical' ? 'critical' : 'warning',
      source: 'experiment-guardrails',
      timestamp: violation.timestamp.toISOString(),
      custom_details: {
        experiment: config.experimentKey,
        metric: violation.guardrail.metricName,
        currentValue: violation.currentValue,
        threshold: violation.threshold,
        percentageDifference: violation.percentageDifference,
        recommendation: violation.recommendation
      }
    }
  }

  // TODO: Implement actual PagerDuty Events API call
  logger.info('PagerDuty alert would be sent', {
    integrationKey: config.recipients[0],
    experimentKey: config.experimentKey,
    event
  })

  // In production, send to PagerDuty:
  // await fetch('https://events.pagerduty.com/v2/enqueue', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(event)
  // })
}

/**
 * Create Datadog monitor programmatically
 *
 * Creates a monitor in Datadog to track guardrail metrics and alert
 * when thresholds are violated.
 *
 * @param experimentKey - Experiment identifier
 * @param guardrail - Guardrail to monitor
 * @returns Monitor ID
 *
 * @example
 * const monitorId = await createDatadogMonitor('my-experiment', guardrail);
 */
export async function createDatadogMonitor(
  experimentKey: string,
  guardrail: Guardrail
): Promise<string> {
  const monitorName = `[Experiment] ${experimentKey} - ${guardrail.metricName}`

  const query = buildMonitorQuery(experimentKey, guardrail)

  const message = `
{{#is_alert}}
Guardrail violation detected in experiment ${experimentKey}!

Metric: ${guardrail.metricName}
Current value: {{value}}
Threshold: ${guardrail.threshold}
Severity: ${guardrail.severity}

${guardrail.description || ''}

Action required: Review experiment and consider pausing if degradation continues.
{{/is_alert}}

{{#is_recovery}}
Guardrail back to normal for ${experimentKey}.
Metric ${guardrail.metricName} is now within acceptable range.
{{/is_recovery}}
  `.trim()

  const monitorConfig: DatadogMonitorConfig = {
    name: monitorName,
    type: 'metric alert',
    query,
    message,
    tags: [
      `experiment:${experimentKey}`,
      `metric:${guardrail.metricName}`,
      `severity:${guardrail.severity}`,
      'source:experiment-guardrails'
    ],
    priority: guardrail.severity === 'critical' ? 1 : 3,
    thresholds: {
      critical: guardrail.severity === 'critical' ? guardrail.threshold : undefined,
      warning: guardrail.severity === 'warning' ? guardrail.threshold : undefined
    }
  }

  // TODO: Implement actual Datadog Monitors API call
  logger.info('Datadog monitor would be created', {
    experimentKey,
    monitorConfig
  })

  // In production, create monitor via Datadog API:
  // const response = await fetch('https://api.datadoghq.com/api/v1/monitor', {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'DD-API-KEY': process.env.DATADOG_API_KEY,
  //     'DD-APPLICATION-KEY': process.env.DATADOG_APP_KEY
  //   },
  //   body: JSON.stringify(monitorConfig)
  // })
  //
  // const data = await response.json()
  // return data.id

  // Return mock ID for now
  const mockId = `monitor_${experimentKey}_${guardrail.metricName}_${Date.now()}`
  return mockId
}

/**
 * Build Datadog monitor query for guardrail
 *
 * @param experimentKey - Experiment identifier
 * @param guardrail - Guardrail configuration
 * @returns Datadog monitor query string
 */
function buildMonitorQuery(experimentKey: string, guardrail: Guardrail): string {
  const metricPath = `experiment.${experimentKey}.${guardrail.metricName}`

  switch (guardrail.operator) {
    case '>':
      return `avg(last_5m):avg:${metricPath}{*} > ${guardrail.threshold}`
    case '<':
      return `avg(last_5m):avg:${metricPath}{*} < ${guardrail.threshold}`
    case '>=':
      return `avg(last_5m):avg:${metricPath}{*} >= ${guardrail.threshold}`
    case '<=':
      return `avg(last_5m):avg:${metricPath}{*} <= ${guardrail.threshold}`
    default:
      return `avg(last_5m):avg:${metricPath}{*}`
  }
}

/**
 * Delete Datadog monitor
 *
 * @param monitorId - Monitor ID to delete
 */
export async function deleteDatadogMonitor(monitorId: string): Promise<void> {
  // TODO: Implement actual Datadog Monitors API call
  logger.info('Datadog monitor would be deleted', { monitorId })

  // In production:
  // await fetch(`https://api.datadoghq.com/api/v1/monitor/${monitorId}`, {
  //   method: 'DELETE',
  //   headers: {
  //     'DD-API-KEY': process.env.DATADOG_API_KEY,
  //     'DD-APPLICATION-KEY': process.env.DATADOG_APP_KEY
  //   }
  // })
}

/**
 * Send batch violation alert for multiple violations
 *
 * @param experimentKey - Experiment identifier
 * @param violations - Array of violations
 * @param config - Alert configuration
 */
export async function sendBatchViolationAlert(
  experimentKey: string,
  violations: GuardrailViolation[],
  config: AlertConfig
): Promise<void> {
  if (violations.length === 0) return

  const criticalCount = violations.filter(v => v.severity === 'critical').length
  const warningCount = violations.filter(v => v.severity === 'warning').length

  // Track in Datadog
  RUMMonitoring.addAction('guardrail_batch_violation', {
    experiment: experimentKey,
    totalViolations: violations.length,
    criticalCount,
    warningCount,
    metrics: violations.map(v => v.guardrail.metricName),
    timestamp: new Date().toISOString(),
    category: 'experiment-guardrail'
  })

  logger.warn('Batch guardrail violations detected', {
    experimentKey,
    totalViolations: violations.length,
    criticalCount,
    warningCount
  })

  // Send individual alerts for critical violations
  const criticalViolations = violations.filter(v => v.severity === 'critical')
  for (const violation of criticalViolations) {
    await sendGuardrailAlert(violation, config)
  }
}

/**
 * Test alert configuration
 *
 * Sends a test alert to verify configuration is working.
 *
 * @param config - Alert configuration to test
 */
export async function testAlertConfiguration(config: AlertConfig): Promise<void> {
  const testViolation: GuardrailViolation = {
    guardrail: {
      metricName: 'test_metric',
      operator: '<',
      threshold: 100,
      severity: 'warning',
      description: 'Test guardrail for configuration verification'
    },
    currentValue: 150,
    threshold: 100,
    percentageDifference: 50,
    severity: 'warning',
    timestamp: new Date(),
    recommendation: 'This is a test alert. If you received this, your alert configuration is working correctly.'
  }

  await sendGuardrailAlert(testViolation, config)

  logger.info('Test alert sent successfully', {
    experimentKey: config.experimentKey,
    channel: config.channel
  })
}
