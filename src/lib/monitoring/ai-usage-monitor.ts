/**
 * AI Usage Monitoring System
 * Provides real-time monitoring, alerting, and visualization for AI model usage, token consumption, and provider health
 */

import { EventEmitter } from 'events'

export interface AIUsageMetrics {
  provider_name: string
  model_name: string
  total_requests: number
  successful_requests: number
  failed_requests: number
  total_tokens_input: number
  total_tokens_output: number
  total_tokens: number
  average_response_time_ms: number
  error_rate_percent: number
  requests_per_minute: number
  tokens_per_minute: number
  estimated_cost_usd: number
  rate_limit_remaining?: number
  rate_limit_total?: number
  rate_limit_utilization_percent: number
  timestamp: string
  health_status: 'healthy' | 'warning' | 'critical'
}

export interface AIUsageAlert {
  id: string
  provider_name: string
  model_name: string
  alert_type: 'high_token_usage' | 'high_error_rate' | 'rate_limit_approaching' | 'high_cost' | 'slow_response'
  severity: 'warning' | 'critical'
  message: string
  threshold: number
  current_value: number
  timestamp: string
  resolved: boolean
  resolution_timestamp?: string
}

export interface AIUsageCapacityReport {
  provider_name: string
  model_name: string
  current_requests_per_minute: number
  peak_requests_per_minute_24h: number
  average_requests_per_minute_24h: number
  current_tokens_per_minute: number
  peak_tokens_per_minute_24h: number
  average_tokens_per_minute_24h: number
  estimated_daily_cost_usd: number
  estimated_monthly_cost_usd: number
  growth_trend: 'increasing' | 'stable' | 'decreasing'
  rate_limit_headroom: number
  projected_rate_limit_exhaustion?: string
}

/**
 * AI Usage Monitoring and Alerting System
 */
export class AIUsageMonitor extends EventEmitter {
  private providers: Map<string, AIUsageMetrics> = new Map()
  private alerts: Map<string, AIUsageAlert> = new Map()
  private metricsHistory: Map<string, AIUsageMetrics[]> = new Map()
  private maxHistorySize = 1000 // Keep last 1000 metrics per provider

  // Alert thresholds
  private thresholds = {
    token_usage_warning: 50000, // 50k tokens per minute
    token_usage_critical: 100000, // 100k tokens per minute
    error_rate_warning: 5, // 5% error rate
    error_rate_critical: 15, // 15% error rate
    rate_limit_warning: 70, // 70% rate limit utilization
    rate_limit_critical: 85, // 85% rate limit utilization
    cost_warning: 10, // $10 per hour
    cost_critical: 50, // $50 per hour
    response_time_warning: 5000, // 5 seconds
    response_time_critical: 15000 // 15 seconds
  }

  private monitoringInterval?: NodeJS.Timeout
  private alertCheckInterval?: NodeJS.Timeout

  constructor() {
    super()
    this.startMonitoring()
  }

  /**
   * Register an AI provider/model for monitoring
   */
  public registerProvider(providerName: string, modelName: string, initialMetrics: Partial<AIUsageMetrics>) {
    const key = this.getProviderKey(providerName, modelName)
    const metrics: AIUsageMetrics = {
      provider_name: providerName,
      model_name: modelName,
      total_requests: initialMetrics.total_requests || 0,
      successful_requests: initialMetrics.successful_requests || 0,
      failed_requests: initialMetrics.failed_requests || 0,
      total_tokens_input: initialMetrics.total_tokens_input || 0,
      total_tokens_output: initialMetrics.total_tokens_output || 0,
      total_tokens: initialMetrics.total_tokens || 0,
      average_response_time_ms: initialMetrics.average_response_time_ms || 0,
      error_rate_percent: 0,
      requests_per_minute: initialMetrics.requests_per_minute || 0,
      tokens_per_minute: initialMetrics.tokens_per_minute || 0,
      estimated_cost_usd: initialMetrics.estimated_cost_usd || 0,
      rate_limit_remaining: initialMetrics.rate_limit_remaining,
      rate_limit_total: initialMetrics.rate_limit_total,
      rate_limit_utilization_percent: 0,
      timestamp: new Date().toISOString(),
      health_status: 'healthy'
    }

    // Calculate error rate
    if (metrics.total_requests > 0) {
      metrics.error_rate_percent = Math.round((metrics.failed_requests / metrics.total_requests) * 100)
    }

    // Calculate rate limit utilization
    if (metrics.rate_limit_total && metrics.rate_limit_remaining !== undefined) {
      const used = metrics.rate_limit_total - metrics.rate_limit_remaining
      metrics.rate_limit_utilization_percent = Math.round((used / metrics.rate_limit_total) * 100)
    }

    this.providers.set(key, metrics)
    this.initializeHistory(key)
  }

  /**
   * Update metrics for a specific provider/model
   */
  public updateProviderMetrics(providerName: string, modelName: string, metrics: Partial<AIUsageMetrics>) {
    const key = this.getProviderKey(providerName, modelName)
    const existingMetrics = this.providers.get(key)
    if (!existingMetrics) {
      return
    }

    const updatedMetrics: AIUsageMetrics = {
      ...existingMetrics,
      ...metrics,
      timestamp: new Date().toISOString()
    }

    // Recalculate derived metrics
    if (updatedMetrics.total_requests > 0) {
      updatedMetrics.error_rate_percent = Math.round(
        (updatedMetrics.failed_requests / updatedMetrics.total_requests) * 100
      )
    }

    if (updatedMetrics.rate_limit_total && updatedMetrics.rate_limit_remaining !== undefined) {
      const used = updatedMetrics.rate_limit_total - updatedMetrics.rate_limit_remaining
      updatedMetrics.rate_limit_utilization_percent = Math.round((used / updatedMetrics.rate_limit_total) * 100)
    }

    updatedMetrics.total_tokens = updatedMetrics.total_tokens_input + updatedMetrics.total_tokens_output

    // Determine health status
    updatedMetrics.health_status = this.calculateHealthStatus(updatedMetrics)

    this.providers.set(key, updatedMetrics)
    this.addToHistory(key, updatedMetrics)

    // Emit update event
    this.emit('metricsUpdated', providerName, modelName, updatedMetrics)
  }

  /**
   * Get current metrics for all providers
   */
  public getAllProviderMetrics(): AIUsageMetrics[] {
    return Array.from(this.providers.values())
  }

  /**
   * Get metrics for a specific provider/model
   */
  public getProviderMetrics(providerName: string, modelName: string): AIUsageMetrics | undefined {
    const key = this.getProviderKey(providerName, modelName)
    return this.providers.get(key)
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): AIUsageAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved)
  }

  /**
   * Get capacity planning report for all providers
   */
  public generateCapacityReport(): AIUsageCapacityReport[] {
    const reports: AIUsageCapacityReport[] = []

    for (const [key, currentMetrics] of this.providers) {
      const history = this.metricsHistory.get(key) || []
      const last24h = history.filter(m =>
        new Date(m.timestamp).getTime() > Date.now() - (24 * 60 * 60 * 1000)
      )

      if (last24h.length === 0) continue

      const requestRates = last24h.map(m => m.requests_per_minute)
      const tokenRates = last24h.map(m => m.tokens_per_minute)
      const costs = last24h.map(m => m.estimated_cost_usd)

      const peakRequestRate = Math.max(...requestRates)
      const avgRequestRate = requestRates.reduce((a, b) => a + b, 0) / requestRates.length

      const peakTokenRate = Math.max(...tokenRates)
      const avgTokenRate = tokenRates.reduce((a, b) => a + b, 0) / tokenRates.length

      const avgCost = costs.reduce((a, b) => a + b, 0) / costs.length

      // Simple trend calculation
      const recentRequestRate = requestRates.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, requestRates.length)
      const olderRequestRate = requestRates.slice(0, 10).reduce((a, b) => a + b, 0) / Math.min(10, requestRates.length)

      let growthTrend: 'increasing' | 'stable' | 'decreasing' = 'stable'
      if (recentRequestRate > olderRequestRate + 5) growthTrend = 'increasing'
      else if (recentRequestRate < olderRequestRate - 5) growthTrend = 'decreasing'

      const rateLimitHeadroom = Math.max(0, 100 - currentMetrics.rate_limit_utilization_percent)

      // Estimate daily and monthly costs (assuming current hourly rate)
      const estimatedDailyCost = avgCost * 24
      const estimatedMonthlyCost = estimatedDailyCost * 30

      reports.push({
        provider_name: currentMetrics.provider_name,
        model_name: currentMetrics.model_name,
        current_requests_per_minute: currentMetrics.requests_per_minute,
        peak_requests_per_minute_24h: Math.round(peakRequestRate),
        average_requests_per_minute_24h: Math.round(avgRequestRate),
        current_tokens_per_minute: currentMetrics.tokens_per_minute,
        peak_tokens_per_minute_24h: Math.round(peakTokenRate),
        average_tokens_per_minute_24h: Math.round(avgTokenRate),
        estimated_daily_cost_usd: Math.round(estimatedDailyCost * 100) / 100,
        estimated_monthly_cost_usd: Math.round(estimatedMonthlyCost * 100) / 100,
        growth_trend: growthTrend,
        rate_limit_headroom: rateLimitHeadroom,
        projected_rate_limit_exhaustion: growthTrend === 'increasing' && rateLimitHeadroom < 20
          ? this.calculateExhaustionTime(history)
          : undefined
      })
    }

    return reports
  }

  /**
   * Start automatic monitoring and alerting
   */
  private startMonitoring() {
    // Check for alerts every 30 seconds
    this.alertCheckInterval = setInterval(() => {
      this.checkForAlerts()
    }, 30000)

    // Update provider health every 5 seconds
    this.monitoringInterval = setInterval(() => {
      this.updateProviderHealth()
    }, 5000)
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring() {
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval)
    }
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }
  }

  /**
   * Check for alert conditions
   */
  private checkForAlerts() {
    for (const [key, metrics] of this.providers) {
      this.checkTokenUsageAlerts(key, metrics)
      this.checkErrorRateAlerts(key, metrics)
      this.checkRateLimitAlerts(key, metrics)
      this.checkCostAlerts(key, metrics)
      this.checkResponseTimeAlerts(key, metrics)
    }
  }

  /**
   * Check token usage alerts
   */
  private checkTokenUsageAlerts(key: string, metrics: AIUsageMetrics) {
    const alertId = `${key}-token-usage`
    const existingAlert = this.alerts.get(alertId)

    if (metrics.tokens_per_minute >= this.thresholds.token_usage_critical) {
      if (!existingAlert || existingAlert.resolved) {
        this.createAlert({
          id: alertId,
          provider_name: metrics.provider_name,
          model_name: metrics.model_name,
          alert_type: 'high_token_usage',
          severity: 'critical',
          message: `Critical token usage: ${metrics.tokens_per_minute.toLocaleString()} tokens/min`,
          threshold: this.thresholds.token_usage_critical,
          current_value: metrics.tokens_per_minute,
          timestamp: new Date().toISOString(),
          resolved: false
        })
      }
    } else if (metrics.tokens_per_minute >= this.thresholds.token_usage_warning) {
      if (!existingAlert || existingAlert.resolved || existingAlert.severity !== 'warning') {
        this.createAlert({
          id: alertId,
          provider_name: metrics.provider_name,
          model_name: metrics.model_name,
          alert_type: 'high_token_usage',
          severity: 'warning',
          message: `High token usage: ${metrics.tokens_per_minute.toLocaleString()} tokens/min`,
          threshold: this.thresholds.token_usage_warning,
          current_value: metrics.tokens_per_minute,
          timestamp: new Date().toISOString(),
          resolved: false
        })
      }
    } else if (existingAlert && !existingAlert.resolved) {
      this.resolveAlert(alertId)
    }
  }

  /**
   * Check error rate alerts
   */
  private checkErrorRateAlerts(key: string, metrics: AIUsageMetrics) {
    const alertId = `${key}-error-rate`
    const existingAlert = this.alerts.get(alertId)

    if (metrics.error_rate_percent >= this.thresholds.error_rate_critical) {
      if (!existingAlert || existingAlert.resolved) {
        this.createAlert({
          id: alertId,
          provider_name: metrics.provider_name,
          model_name: metrics.model_name,
          alert_type: 'high_error_rate',
          severity: 'critical',
          message: `Critical error rate: ${metrics.error_rate_percent}%`,
          threshold: this.thresholds.error_rate_critical,
          current_value: metrics.error_rate_percent,
          timestamp: new Date().toISOString(),
          resolved: false
        })
      }
    } else if (metrics.error_rate_percent >= this.thresholds.error_rate_warning) {
      if (!existingAlert || existingAlert.resolved || existingAlert.severity !== 'warning') {
        this.createAlert({
          id: alertId,
          provider_name: metrics.provider_name,
          model_name: metrics.model_name,
          alert_type: 'high_error_rate',
          severity: 'warning',
          message: `High error rate: ${metrics.error_rate_percent}%`,
          threshold: this.thresholds.error_rate_warning,
          current_value: metrics.error_rate_percent,
          timestamp: new Date().toISOString(),
          resolved: false
        })
      }
    } else if (existingAlert && !existingAlert.resolved) {
      this.resolveAlert(alertId)
    }
  }

  /**
   * Check rate limit alerts
   */
  private checkRateLimitAlerts(key: string, metrics: AIUsageMetrics) {
    const alertId = `${key}-rate-limit`
    const existingAlert = this.alerts.get(alertId)

    if (metrics.rate_limit_utilization_percent >= this.thresholds.rate_limit_critical) {
      if (!existingAlert || existingAlert.resolved) {
        this.createAlert({
          id: alertId,
          provider_name: metrics.provider_name,
          model_name: metrics.model_name,
          alert_type: 'rate_limit_approaching',
          severity: 'critical',
          message: `Critical rate limit utilization: ${metrics.rate_limit_utilization_percent}%`,
          threshold: this.thresholds.rate_limit_critical,
          current_value: metrics.rate_limit_utilization_percent,
          timestamp: new Date().toISOString(),
          resolved: false
        })
      }
    } else if (metrics.rate_limit_utilization_percent >= this.thresholds.rate_limit_warning) {
      if (!existingAlert || existingAlert.resolved || existingAlert.severity !== 'warning') {
        this.createAlert({
          id: alertId,
          provider_name: metrics.provider_name,
          model_name: metrics.model_name,
          alert_type: 'rate_limit_approaching',
          severity: 'warning',
          message: `High rate limit utilization: ${metrics.rate_limit_utilization_percent}%`,
          threshold: this.thresholds.rate_limit_warning,
          current_value: metrics.rate_limit_utilization_percent,
          timestamp: new Date().toISOString(),
          resolved: false
        })
      }
    } else if (existingAlert && !existingAlert.resolved) {
      this.resolveAlert(alertId)
    }
  }

  /**
   * Check cost alerts
   */
  private checkCostAlerts(key: string, metrics: AIUsageMetrics) {
    const alertId = `${key}-cost`
    const existingAlert = this.alerts.get(alertId)
    const hourlyCost = metrics.estimated_cost_usd

    if (hourlyCost >= this.thresholds.cost_critical) {
      if (!existingAlert || existingAlert.resolved) {
        this.createAlert({
          id: alertId,
          provider_name: metrics.provider_name,
          model_name: metrics.model_name,
          alert_type: 'high_cost',
          severity: 'critical',
          message: `Critical cost rate: $${hourlyCost.toFixed(2)}/hour`,
          threshold: this.thresholds.cost_critical,
          current_value: hourlyCost,
          timestamp: new Date().toISOString(),
          resolved: false
        })
      }
    } else if (hourlyCost >= this.thresholds.cost_warning) {
      if (!existingAlert || existingAlert.resolved || existingAlert.severity !== 'warning') {
        this.createAlert({
          id: alertId,
          provider_name: metrics.provider_name,
          model_name: metrics.model_name,
          alert_type: 'high_cost',
          severity: 'warning',
          message: `High cost rate: $${hourlyCost.toFixed(2)}/hour`,
          threshold: this.thresholds.cost_warning,
          current_value: hourlyCost,
          timestamp: new Date().toISOString(),
          resolved: false
        })
      }
    } else if (existingAlert && !existingAlert.resolved) {
      this.resolveAlert(alertId)
    }
  }

  /**
   * Check response time alerts
   */
  private checkResponseTimeAlerts(key: string, metrics: AIUsageMetrics) {
    const alertId = `${key}-response-time`
    const existingAlert = this.alerts.get(alertId)

    if (metrics.average_response_time_ms >= this.thresholds.response_time_critical) {
      if (!existingAlert || existingAlert.resolved) {
        this.createAlert({
          id: alertId,
          provider_name: metrics.provider_name,
          model_name: metrics.model_name,
          alert_type: 'slow_response',
          severity: 'critical',
          message: `Critical response time: ${metrics.average_response_time_ms}ms`,
          threshold: this.thresholds.response_time_critical,
          current_value: metrics.average_response_time_ms,
          timestamp: new Date().toISOString(),
          resolved: false
        })
      }
    } else if (metrics.average_response_time_ms >= this.thresholds.response_time_warning) {
      if (!existingAlert || existingAlert.resolved || existingAlert.severity !== 'warning') {
        this.createAlert({
          id: alertId,
          provider_name: metrics.provider_name,
          model_name: metrics.model_name,
          alert_type: 'slow_response',
          severity: 'warning',
          message: `Slow response time: ${metrics.average_response_time_ms}ms`,
          threshold: this.thresholds.response_time_warning,
          current_value: metrics.average_response_time_ms,
          timestamp: new Date().toISOString(),
          resolved: false
        })
      }
    } else if (existingAlert && !existingAlert.resolved) {
      this.resolveAlert(alertId)
    }
  }

  /**
   * Create a new alert
   */
  private createAlert(alert: AIUsageAlert) {
    this.alerts.set(alert.id, alert)
    this.emit('alertCreated', alert)
  }

  /**
   * Resolve an alert
   */
  private resolveAlert(alertId: string) {
    const alert = this.alerts.get(alertId)
    if (alert && !alert.resolved) {
      alert.resolved = true
      alert.resolution_timestamp = new Date().toISOString()
      this.alerts.set(alertId, alert)
      this.emit('alertResolved', alert)
    }
  }

  /**
   * Calculate health status based on metrics
   */
  private calculateHealthStatus(metrics: AIUsageMetrics): 'healthy' | 'warning' | 'critical' {
    if (
      metrics.error_rate_percent >= this.thresholds.error_rate_critical ||
      metrics.rate_limit_utilization_percent >= this.thresholds.rate_limit_critical ||
      metrics.average_response_time_ms >= this.thresholds.response_time_critical
    ) {
      return 'critical'
    }

    if (
      metrics.error_rate_percent >= this.thresholds.error_rate_warning ||
      metrics.rate_limit_utilization_percent >= this.thresholds.rate_limit_warning ||
      metrics.average_response_time_ms >= this.thresholds.response_time_warning
    ) {
      return 'warning'
    }

    return 'healthy'
  }

  /**
   * Initialize metrics history for a provider
   */
  private initializeHistory(key: string) {
    if (!this.metricsHistory.has(key)) {
      this.metricsHistory.set(key, [])
    }
  }

  /**
   * Add metrics to history
   */
  private addToHistory(key: string, metrics: AIUsageMetrics) {
    const history = this.metricsHistory.get(key) || []
    history.push({ ...metrics })

    // Keep only the last maxHistorySize entries
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize)
    }

    this.metricsHistory.set(key, history)
  }

  /**
   * Update provider health status
   */
  private updateProviderHealth() {
    for (const [key, metrics] of this.providers) {
      const updatedHealth = this.calculateHealthStatus(metrics)
      if (metrics.health_status !== updatedHealth) {
        const [providerName, modelName] = this.parseProviderKey(key)
        this.updateProviderMetrics(providerName, modelName, { health_status: updatedHealth })
      }
    }
  }

  /**
   * Calculate projected exhaustion time
   */
  private calculateExhaustionTime(history: AIUsageMetrics[]): string {
    if (history.length < 10) return 'Insufficient data'

    // Simple linear regression on rate limit utilization trend
    const recentData = history.slice(-20)
    const timePoints = recentData.map((_, index) => index)
    const utilizations = recentData.map(m => m.rate_limit_utilization_percent)

    // Calculate slope
    const n = timePoints.length
    const sumX = timePoints.reduce((a, b) => a + b, 0)
    const sumY = utilizations.reduce((a, b) => a + b, 0)
    const sumXY = timePoints.reduce((sum, x, i) => sum + x * utilizations[i], 0)
    const sumX2 = timePoints.reduce((sum, x) => sum + x * x, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)

    if (slope <= 0) return 'Not trending toward exhaustion'

    const currentUtilization = utilizations[utilizations.length - 1]
    const utilizationToExhaustion = 100 - currentUtilization
    const timeToExhaustion = utilizationToExhaustion / slope

    // Convert to minutes (assuming data points are every 30 seconds)
    const minutesToExhaustion = timeToExhaustion * 0.5

    if (minutesToExhaustion < 60) {
      return `${Math.round(minutesToExhaustion)} minutes`
    } else if (minutesToExhaustion < 1440) {
      return `${Math.round(minutesToExhaustion / 60)} hours`
    } else {
      return `${Math.round(minutesToExhaustion / 1440)} days`
    }
  }

  /**
   * Get provider metrics history
   */
  public getProviderHistory(providerName: string, modelName: string, limit?: number): AIUsageMetrics[] {
    const key = this.getProviderKey(providerName, modelName)
    const history = this.metricsHistory.get(key) || []
    return limit ? history.slice(-limit) : history
  }

  /**
   * Get system-wide AI usage overview
   */
  public getSystemOverview() {
    const allMetrics = this.getAllProviderMetrics()
    const activeAlerts = this.getActiveAlerts()

    const totalRequests = allMetrics.reduce((sum, m) => sum + m.total_requests, 0)
    const totalTokens = allMetrics.reduce((sum, m) => sum + m.total_tokens, 0)
    const totalCost = allMetrics.reduce((sum, m) => sum + m.estimated_cost_usd, 0)

    const healthyProviders = allMetrics.filter(m => m.health_status === 'healthy').length
    const warningProviders = allMetrics.filter(m => m.health_status === 'warning').length
    const criticalProviders = allMetrics.filter(m => m.health_status === 'critical').length

    const avgErrorRate = allMetrics.length > 0
      ? allMetrics.reduce((sum, m) => sum + m.error_rate_percent, 0) / allMetrics.length
      : 0

    return {
      total_providers: allMetrics.length,
      total_requests: totalRequests,
      total_tokens: totalTokens,
      estimated_hourly_cost_usd: Math.round(totalCost * 100) / 100,
      estimated_daily_cost_usd: Math.round(totalCost * 24 * 100) / 100,
      estimated_monthly_cost_usd: Math.round(totalCost * 24 * 30 * 100) / 100,
      average_error_rate_percent: Math.round(avgErrorRate * 100) / 100,
      healthy_providers: healthyProviders,
      warning_providers: warningProviders,
      critical_providers: criticalProviders,
      active_alerts: activeAlerts.length,
      critical_alerts: activeAlerts.filter(a => a.severity === 'critical').length,
      warning_alerts: activeAlerts.filter(a => a.severity === 'warning').length,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Generate provider key from provider and model name
   */
  private getProviderKey(providerName: string, modelName: string): string {
    return `${providerName}::${modelName}`
  }

  /**
   * Parse provider key back to provider and model name
   */
  private parseProviderKey(key: string): [string, string] {
    const [providerName, modelName] = key.split('::')
    return [providerName, modelName]
  }
}

// Global instance for application-wide monitoring
export const aiUsageMonitor = new AIUsageMonitor()
