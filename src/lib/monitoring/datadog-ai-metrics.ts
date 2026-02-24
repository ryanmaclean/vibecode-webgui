/**
 * Datadog AI Metrics Utility
 *
 * Provides specialized metrics tracking for AI operations with Datadog integration.
 * Tracks token usage, response latency, error rates, and costs for AI model usage.
 *
 * Architecture:
 * - Integrates with existing Datadog stack (dd-trace)
 * - Uses Datadog custom metrics API for detailed AI tracking
 * - Follows standardized naming conventions (vibecode.ai.*)
 * - Supports both agentless and agent-based deployment
 */

import { createServiceLogger } from '@/lib/logging/service-logger'
import { loadSecret } from '@/lib/security/macos-keychain-server'

// Service logger for AI metrics
const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'ai-metrics'
})

/**
 * Standard tags for AI metrics following Datadog unified service tagging
 */
export interface AIMetricTags {
  env: string
  service: string
  version: string
  provider: string
  model: string
  operation?: string
  status?: string
  error_type?: string
  [key: string]: string | undefined
}

/**
 * AI operation metrics
 */
export interface AIOperationMetrics {
  provider: string
  model: string
  operation: 'completion' | 'embedding' | 'chat' | 'stream'
  durationMs: number
  tokensInput?: number
  tokensOutput?: number
  tokensTotal?: number
  cost?: number
  success: boolean
  errorType?: string
  errorMessage?: string
  requestId?: string
}

/**
 * Datadog AI Metrics Service
 *
 * Tracks AI-specific metrics and sends them to Datadog for monitoring,
 * alerting, and cost analysis.
 */
class DatadogAIMetricsService {
  private readonly isEnabled: boolean
  private readonly apiKey: string | undefined
  private readonly site: string
  private readonly standardTags: Omit<AIMetricTags, 'provider' | 'model'>
  private readonly metricsBuffer: Array<{
    metric: string
    points: Array<[number, number]>
    tags: string[]
  }>
  private flushInterval: NodeJS.Timeout | null
  private readonly bufferSize: number = 100
  private readonly flushIntervalMs: number = 10000 // 10 seconds

  constructor() {
    // Determine if monitoring is enabled
    const isMonitoringDisabled = (
      process.env.NEXT_PHASE === 'phase-production-build' ||
      process.env.DOCKER_BUILD === 'true' ||
      process.env.SKIP_MONITORING === 'true' ||
      process.env.CI === 'true' ||
      process.env.DD_ENABLED === 'false' ||
      process.env.PLAYWRIGHT_TEST === 'true'
    )

    this.apiKey = this.getApiKey()
    this.site = process.env.DD_SITE || process.env.DATADOG_SITE || 'datadoghq.com'
    this.isEnabled = !isMonitoringDisabled && !!this.apiKey && process.env.NODE_ENV !== 'test'

    this.standardTags = {
      env: process.env.DD_ENV || process.env.NODE_ENV || 'development',
      service: process.env.DD_SERVICE || 'vibecode-webgui',
      version: process.env.DD_VERSION || process.env.APP_VERSION || '1.0.0'
    }

    this.metricsBuffer = []
    this.flushInterval = null

    if (this.isEnabled) {
      this.startBufferFlushing()
      log.info('Datadog AI metrics service initialized', {
        site: this.site,
        env: this.standardTags.env
      })
    } else {
      log.debug('Datadog AI metrics service disabled', {
        reason: isMonitoringDisabled ? 'monitoring disabled' : 'no API key'
      })
    }
  }

  /**
   * Get Datadog API key from environment or keychain
   */
  private getApiKey(): string | undefined {
    try {
      return (
        loadSecret('DD_API_KEY') ||
        loadSecret('DATADOG_API_KEY') ||
        process.env.DD_API_KEY ||
        process.env.DATADOG_API_KEY
      )
    } catch (error) {
      log.warn('Failed to load Datadog API key', { error })
      return undefined
    }
  }

  /**
   * Record AI operation metrics
   */
  public recordAIOperation(metrics: AIOperationMetrics): void {
    if (!this.isEnabled) return

    const timestamp = Math.floor(Date.now() / 1000)
    const tags = this.buildTags({
      provider: metrics.provider,
      model: this.sanitizeModelName(metrics.model),
      operation: metrics.operation,
      status: metrics.success ? 'success' : 'error',
      ...(metrics.errorType && { error_type: metrics.errorType })
    })

    // Record operation duration
    this.bufferMetric('vibecode.ai.operation.duration', metrics.durationMs, tags, timestamp)

    // Record token usage
    if (metrics.tokensInput !== undefined) {
      this.bufferMetric('vibecode.ai.tokens.input', metrics.tokensInput, tags, timestamp)
    }

    if (metrics.tokensOutput !== undefined) {
      this.bufferMetric('vibecode.ai.tokens.output', metrics.tokensOutput, tags, timestamp)
    }

    if (metrics.tokensTotal !== undefined) {
      this.bufferMetric('vibecode.ai.tokens.total', metrics.tokensTotal, tags, timestamp)
    }

    // Record cost
    if (metrics.cost !== undefined) {
      this.bufferMetric('vibecode.ai.cost', metrics.cost, tags, timestamp)
    }

    // Record operation count
    this.bufferMetric('vibecode.ai.operation.count', 1, tags, timestamp)

    // Record errors separately
    if (!metrics.success) {
      this.recordError(metrics.provider, metrics.model, metrics.operation, metrics.errorType)
    }

    log.debug('AI operation recorded', {
      provider: metrics.provider,
      model: metrics.model,
      operation: metrics.operation,
      duration: metrics.durationMs,
      success: metrics.success
    })
  }

  /**
   * Record AI error
   */
  public recordError(
    provider: string,
    model: string,
    operation: string,
    errorType?: string
  ): void {
    if (!this.isEnabled) return

    const tags = this.buildTags({
      provider,
      model: this.sanitizeModelName(model),
      operation,
      status: 'error',
      ...(errorType && { error_type: errorType })
    })

    const timestamp = Math.floor(Date.now() / 1000)
    this.bufferMetric('vibecode.ai.errors', 1, tags, timestamp)

    log.warn('AI operation error recorded', {
      provider,
      model,
      operation,
      errorType
    })
  }

  /**
   * Record token rate limit metrics
   */
  public recordRateLimit(
    provider: string,
    model: string,
    remaining: number,
    limit: number
  ): void {
    if (!this.isEnabled) return

    const tags = this.buildTags({
      provider,
      model: this.sanitizeModelName(model)
    })

    const timestamp = Math.floor(Date.now() / 1000)
    const utilizationPercent = limit > 0 ? ((limit - remaining) / limit) * 100 : 0

    this.bufferMetric('vibecode.ai.rate_limit.remaining', remaining, tags, timestamp)
    this.bufferMetric('vibecode.ai.rate_limit.limit', limit, tags, timestamp)
    this.bufferMetric('vibecode.ai.rate_limit.utilization', utilizationPercent, tags, timestamp)
  }

  /**
   * Record provider health status
   */
  public recordProviderHealth(
    provider: string,
    model: string,
    status: 'healthy' | 'degraded' | 'down'
  ): void {
    if (!this.isEnabled) return

    const tags = this.buildTags({
      provider,
      model: this.sanitizeModelName(model),
      health_status: status
    })

    const timestamp = Math.floor(Date.now() / 1000)
    const statusValue = status === 'healthy' ? 1 : status === 'degraded' ? 0.5 : 0

    this.bufferMetric('vibecode.ai.provider.health', statusValue, tags, timestamp)
  }

  /**
   * Buffer metric for batch sending
   */
  private bufferMetric(
    metricName: string,
    value: number,
    tags: string[],
    timestamp: number
  ): void {
    this.metricsBuffer.push({
      metric: metricName,
      points: [[timestamp, value]],
      tags
    })

    // Flush if buffer is full
    if (this.metricsBuffer.length >= this.bufferSize) {
      this.flushMetrics()
    }
  }

  /**
   * Build tags array from tag object
   */
  private buildTags(additionalTags: Partial<AIMetricTags>): string[] {
    const allTags = {
      ...this.standardTags,
      ...additionalTags
    }

    return Object.entries(allTags)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => `${key}:${value}`)
  }

  /**
   * Sanitize model name for Datadog tag compatibility
   * Replace slashes and special characters
   */
  private sanitizeModelName(model: string): string {
    return model.replace(/[\/\\:]/g, '_').replace(/\s+/g, '-')
  }

  /**
   * Start periodic buffer flushing
   */
  private startBufferFlushing(): void {
    this.flushInterval = setInterval(() => {
      this.flushMetrics()
    }, this.flushIntervalMs)

    // Ensure flush on process exit
    if (typeof process !== 'undefined') {
      process.on('beforeExit', () => this.flushMetrics())
    }
  }

  /**
   * Flush buffered metrics to Datadog
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return

    const metricsToSend = [...this.metricsBuffer]
    this.metricsBuffer.length = 0

    try {
      await this.sendMetricsToDatadog(metricsToSend)
      log.debug('Flushed metrics to Datadog', { count: metricsToSend.length })
    } catch (error) {
      log.error('Failed to flush metrics to Datadog', { error })
      // Don't re-buffer failed metrics to avoid memory issues
    }
  }

  /**
   * Send metrics to Datadog API
   */
  private async sendMetricsToDatadog(
    metrics: Array<{
      metric: string
      points: Array<[number, number]>
      tags: string[]
    }>
  ): Promise<void> {
    if (!this.apiKey) {
      log.warn('Cannot send metrics: no API key available')
      return
    }

    if (process.env.NODE_ENV === 'development') {
      // Log metrics in development instead of sending
      log.debug('Development metrics (not sent to Datadog)', {
        count: metrics.length,
        sample: metrics.slice(0, 3)
      })
      return
    }

    const url = `https://api.${this.site}/api/v1/series`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': this.apiKey
        },
        body: JSON.stringify({ series: metrics })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Datadog API error: ${response.status} ${errorText}`)
      }

      log.debug('Successfully sent metrics to Datadog', { count: metrics.length })
    } catch (error) {
      log.error('Error sending metrics to Datadog', { error })
      throw error
    }
  }

  /**
   * Shutdown the metrics service
   */
  public async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }

    // Final flush
    await this.flushMetrics()

    log.info('Datadog AI metrics service shutdown')
  }
}

// Singleton instance
export const datadogAIMetrics = new DatadogAIMetricsService()

/**
 * Convenience function to record AI operation
 */
export function recordAIOperation(metrics: AIOperationMetrics): void {
  datadogAIMetrics.recordAIOperation(metrics)
}

/**
 * Convenience function to record AI error
 */
export function recordAIError(
  provider: string,
  model: string,
  operation: string,
  errorType?: string
): void {
  datadogAIMetrics.recordError(provider, model, operation, errorType)
}

/**
 * Convenience function to record rate limit
 */
export function recordAIRateLimit(
  provider: string,
  model: string,
  remaining: number,
  limit: number
): void {
  datadogAIMetrics.recordRateLimit(provider, model, remaining, limit)
}

/**
 * Convenience function to record provider health
 */
export function recordAIProviderHealth(
  provider: string,
  model: string,
  status: 'healthy' | 'degraded' | 'down'
): void {
  datadogAIMetrics.recordProviderHealth(provider, model, status)
}
