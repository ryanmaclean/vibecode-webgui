/**
 * Rate Limit Monitoring System
 * Provides real-time monitoring, alerting, and visualization for rate limiting
 */

import { EventEmitter } from 'events'

export interface RateLimitMetrics {
  limiter_name: string
  window_size_ms: number
  max_requests: number
  current_requests: number
  rejected_requests: number
  accepted_requests: number
  utilization_percent: number
  requests_per_second: number
  peak_requests: number
  average_response_time_ms: number
  throttled_clients: number
  total_clients: number
  timestamp: string
  health_status: 'healthy' | 'warning' | 'critical'
}

export interface RateLimitAlert {
  id: string
  limiter_name: string
  alert_type: 'limit_exceeded' | 'high_utilization' | 'burst_detected' | 'client_throttled'
  severity: 'warning' | 'critical'
  message: string
  threshold: number
  current_value: number
  timestamp: string
  resolved: boolean
  resolution_timestamp?: string
}

export interface RateLimitCapacityReport {
  limiter_name: string
  current_utilization: number
  peak_utilization_24h: number
  average_utilization_24h: number
  recommended_max_requests: number
  growth_trend: 'increasing' | 'stable' | 'decreasing'
  capacity_headroom: number
  projected_limit_time?: string
}

/**
 * Rate Limit Monitoring and Alerting System
 */
export class RateLimitMonitor extends EventEmitter {
  private limiters: Map<string, RateLimitMetrics> = new Map()
  private alerts: Map<string, RateLimitAlert> = new Map()
  private metricsHistory: Map<string, RateLimitMetrics[]> = new Map()
  private maxHistorySize = 1000 // Keep last 1000 metrics per limiter

  // Alert thresholds
  private thresholds = {
    utilization_warning: 70, // 70% utilization
    utilization_critical: 85, // 85% utilization
    rejection_rate_warning: 10, // 10% rejection rate
    rejection_rate_critical: 25, // 25% rejection rate
    burst_threshold: 90 // 90% utilization triggers burst alert
  }

  private monitoringInterval?: NodeJS.Timeout
  private alertCheckInterval?: NodeJS.Timeout

  constructor() {
    super()
    this.startMonitoring()
  }

  /**
   * Register a rate limiter for monitoring
   */
  public registerLimiter(limiterName: string, initialMetrics: Partial<RateLimitMetrics>) {
    const metrics: RateLimitMetrics = {
      limiter_name: limiterName,
      window_size_ms: initialMetrics.window_size_ms || 60000,
      max_requests: initialMetrics.max_requests || 100,
      current_requests: initialMetrics.current_requests || 0,
      rejected_requests: initialMetrics.rejected_requests || 0,
      accepted_requests: initialMetrics.accepted_requests || 0,
      utilization_percent: 0,
      requests_per_second: 0,
      peak_requests: initialMetrics.peak_requests || 0,
      average_response_time_ms: initialMetrics.average_response_time_ms || 0,
      throttled_clients: initialMetrics.throttled_clients || 0,
      total_clients: initialMetrics.total_clients || 0,
      timestamp: new Date().toISOString(),
      health_status: 'healthy'
    }

    // Calculate utilization
    metrics.utilization_percent = metrics.max_requests > 0
      ? Math.round((metrics.current_requests / metrics.max_requests) * 100)
      : 0

    // Calculate requests per second
    metrics.requests_per_second = metrics.window_size_ms > 0
      ? Math.round((metrics.current_requests / metrics.window_size_ms) * 1000)
      : 0

    this.limiters.set(limiterName, metrics)
    this.initializeHistory(limiterName)
  }

  /**
   * Update metrics for a specific limiter
   */
  public updateLimiterMetrics(limiterName: string, metrics: Partial<RateLimitMetrics>) {
    const existingMetrics = this.limiters.get(limiterName)
    if (!existingMetrics) {
      return
    }

    const updatedMetrics: RateLimitMetrics = {
      ...existingMetrics,
      ...metrics,
      timestamp: new Date().toISOString()
    }

    // Recalculate utilization
    updatedMetrics.utilization_percent = updatedMetrics.max_requests > 0
      ? Math.round((updatedMetrics.current_requests / updatedMetrics.max_requests) * 100)
      : 0

    // Recalculate requests per second
    updatedMetrics.requests_per_second = updatedMetrics.window_size_ms > 0
      ? Math.round((updatedMetrics.current_requests / updatedMetrics.window_size_ms) * 1000)
      : 0

    // Update peak requests
    updatedMetrics.peak_requests = Math.max(
      updatedMetrics.peak_requests,
      updatedMetrics.current_requests
    )

    // Determine health status
    updatedMetrics.health_status = this.calculateHealthStatus(updatedMetrics)

    this.limiters.set(limiterName, updatedMetrics)
    this.addToHistory(limiterName, updatedMetrics)

    // Emit update event
    this.emit('metricsUpdated', limiterName, updatedMetrics)
  }

  /**
   * Get current metrics for all limiters
   */
  public getAllLimiterMetrics(): RateLimitMetrics[] {
    return Array.from(this.limiters.values())
  }

  /**
   * Get metrics for a specific limiter
   */
  public getLimiterMetrics(limiterName: string): RateLimitMetrics | undefined {
    return this.limiters.get(limiterName)
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): RateLimitAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved)
  }

  /**
   * Get capacity planning report for all limiters
   */
  public generateCapacityReport(): RateLimitCapacityReport[] {
    const reports: RateLimitCapacityReport[] = []

    for (const [limiterName, currentMetrics] of this.limiters) {
      const history = this.metricsHistory.get(limiterName) || []
      const last24h = history.filter(m =>
        new Date(m.timestamp).getTime() > Date.now() - (24 * 60 * 60 * 1000)
      )

      if (last24h.length === 0) continue

      const utilizationValues = last24h.map(m => m.utilization_percent)
      const peakUtilization = Math.max(...utilizationValues)
      const avgUtilization = utilizationValues.reduce((a, b) => a + b, 0) / utilizationValues.length

      // Simple trend calculation
      const recentUtilization = utilizationValues.slice(-10).reduce((a, b) => a + b, 0) / 10
      const olderUtilization = utilizationValues.slice(0, 10).reduce((a, b) => a + b, 0) / 10

      let growthTrend: 'increasing' | 'stable' | 'decreasing' = 'stable'
      if (recentUtilization > olderUtilization + 5) growthTrend = 'increasing'
      else if (recentUtilization < olderUtilization - 5) growthTrend = 'decreasing'

      // Calculate recommended max requests
      const recommendedMax = Math.max(
        currentMetrics.max_requests,
        Math.ceil(currentMetrics.max_requests * (peakUtilization / 70)) // Target 70% peak utilization
      )

      const capacityHeadroom = Math.max(0, 100 - currentMetrics.utilization_percent)

      reports.push({
        limiter_name: limiterName,
        current_utilization: currentMetrics.utilization_percent,
        peak_utilization_24h: peakUtilization,
        average_utilization_24h: Math.round(avgUtilization),
        recommended_max_requests: recommendedMax,
        growth_trend: growthTrend,
        capacity_headroom: capacityHeadroom,
        projected_limit_time: growthTrend === 'increasing' && capacityHeadroom < 20
          ? this.calculateLimitTime(history)
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

    // Update limiter health every 5 seconds
    this.monitoringInterval = setInterval(() => {
      this.updateLimiterHealth()
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
    for (const [limiterName, metrics] of this.limiters) {
      this.checkUtilizationAlerts(limiterName, metrics)
      this.checkRejectionAlerts(limiterName, metrics)
      this.checkBurstAlerts(limiterName, metrics)
    }
  }

  /**
   * Check utilization-based alerts
   */
  private checkUtilizationAlerts(limiterName: string, metrics: RateLimitMetrics) {
    const alertId = `${limiterName}-utilization`
    const existingAlert = this.alerts.get(alertId)

    if (metrics.utilization_percent >= this.thresholds.utilization_critical) {
      if (!existingAlert || existingAlert.resolved) {
        this.createAlert({
          id: alertId,
          limiter_name: limiterName,
          alert_type: 'high_utilization',
          severity: 'critical',
          message: `Critical rate limit utilization: ${metrics.utilization_percent}%`,
          threshold: this.thresholds.utilization_critical,
          current_value: metrics.utilization_percent,
          timestamp: new Date().toISOString(),
          resolved: false
        })
      }
    } else if (metrics.utilization_percent >= this.thresholds.utilization_warning) {
      if (!existingAlert || existingAlert.resolved || existingAlert.severity !== 'warning') {
        this.createAlert({
          id: alertId,
          limiter_name: limiterName,
          alert_type: 'high_utilization',
          severity: 'warning',
          message: `High rate limit utilization: ${metrics.utilization_percent}%`,
          threshold: this.thresholds.utilization_warning,
          current_value: metrics.utilization_percent,
          timestamp: new Date().toISOString(),
          resolved: false
        })
      }
    } else if (existingAlert && !existingAlert.resolved) {
      // Resolve alert if utilization is back to normal
      this.resolveAlert(alertId)
    }
  }

  /**
   * Check rejection rate alerts
   */
  private checkRejectionAlerts(limiterName: string, metrics: RateLimitMetrics) {
    const alertId = `${limiterName}-rejection`
    const existingAlert = this.alerts.get(alertId)

    const totalRequests = metrics.accepted_requests + metrics.rejected_requests
    const rejectionRate = totalRequests > 0
      ? Math.round((metrics.rejected_requests / totalRequests) * 100)
      : 0

    if (rejectionRate >= this.thresholds.rejection_rate_critical) {
      if (!existingAlert || existingAlert.resolved) {
        this.createAlert({
          id: alertId,
          limiter_name: limiterName,
          alert_type: 'limit_exceeded',
          severity: 'critical',
          message: `Critical rejection rate: ${rejectionRate}%`,
          threshold: this.thresholds.rejection_rate_critical,
          current_value: rejectionRate,
          timestamp: new Date().toISOString(),
          resolved: false
        })
      }
    } else if (rejectionRate >= this.thresholds.rejection_rate_warning) {
      if (!existingAlert || existingAlert.resolved || existingAlert.severity !== 'warning') {
        this.createAlert({
          id: alertId,
          limiter_name: limiterName,
          alert_type: 'limit_exceeded',
          severity: 'warning',
          message: `High rejection rate: ${rejectionRate}%`,
          threshold: this.thresholds.rejection_rate_warning,
          current_value: rejectionRate,
          timestamp: new Date().toISOString(),
          resolved: false
        })
      }
    } else if (existingAlert && !existingAlert.resolved) {
      this.resolveAlert(alertId)
    }
  }

  /**
   * Check for burst alerts
   */
  private checkBurstAlerts(limiterName: string, metrics: RateLimitMetrics) {
    const alertId = `${limiterName}-burst`
    const existingAlert = this.alerts.get(alertId)

    if (metrics.utilization_percent >= this.thresholds.burst_threshold) {
      if (!existingAlert || existingAlert.resolved) {
        this.createAlert({
          id: alertId,
          limiter_name: limiterName,
          alert_type: 'burst_detected',
          severity: 'critical',
          message: `Burst detected: ${metrics.current_requests}/${metrics.max_requests} requests`,
          threshold: this.thresholds.burst_threshold,
          current_value: metrics.utilization_percent,
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
  private createAlert(alert: RateLimitAlert) {
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
  private calculateHealthStatus(metrics: RateLimitMetrics): 'healthy' | 'warning' | 'critical' {
    const totalRequests = metrics.accepted_requests + metrics.rejected_requests
    const rejectionRate = totalRequests > 0
      ? Math.round((metrics.rejected_requests / totalRequests) * 100)
      : 0

    if (metrics.utilization_percent >= this.thresholds.utilization_critical ||
        rejectionRate >= this.thresholds.rejection_rate_critical) {
      return 'critical'
    }

    if (metrics.utilization_percent >= this.thresholds.utilization_warning ||
        rejectionRate >= this.thresholds.rejection_rate_warning) {
      return 'warning'
    }

    return 'healthy'
  }

  /**
   * Initialize metrics history for a limiter
   */
  private initializeHistory(limiterName: string) {
    if (!this.metricsHistory.has(limiterName)) {
      this.metricsHistory.set(limiterName, [])
    }
  }

  /**
   * Add metrics to history
   */
  private addToHistory(limiterName: string, metrics: RateLimitMetrics) {
    const history = this.metricsHistory.get(limiterName) || []
    history.push({...metrics})

    // Keep only the last maxHistorySize entries
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize)
    }

    this.metricsHistory.set(limiterName, history)
  }

  /**
   * Update limiter health status
   */
  private updateLimiterHealth() {
    for (const [limiterName, metrics] of this.limiters) {
      // In a real implementation, this would fetch actual metrics from the limiter
      // For now, we'll just verify the health status is current
      const updatedHealth = this.calculateHealthStatus(metrics)
      if (metrics.health_status !== updatedHealth) {
        this.updateLimiterMetrics(limiterName, { health_status: updatedHealth })
      }
    }
  }

  /**
   * Calculate projected limit time
   */
  private calculateLimitTime(history: RateLimitMetrics[]): string {
    if (history.length < 10) return 'Insufficient data'

    // Simple linear regression on utilization trend
    const recentData = history.slice(-20)
    const timePoints = recentData.map((_, index) => index)
    const utilizations = recentData.map(m => m.utilization_percent)

    // Calculate slope
    const n = timePoints.length
    const sumX = timePoints.reduce((a, b) => a + b, 0)
    const sumY = utilizations.reduce((a, b) => a + b, 0)
    const sumXY = timePoints.reduce((sum, x, i) => sum + x * utilizations[i], 0)
    const sumX2 = timePoints.reduce((sum, x) => sum + x * x, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)

    if (slope <= 0) return 'Not trending toward limit'

    const currentUtilization = utilizations[utilizations.length - 1]
    const utilizationToLimit = 95 - currentUtilization
    const timeToLimit = utilizationToLimit / slope

    // Convert to minutes (assuming data points are every 30 seconds)
    const minutesToLimit = timeToLimit * 0.5

    if (minutesToLimit < 60) {
      return `${Math.round(minutesToLimit)} minutes`
    } else if (minutesToLimit < 1440) {
      return `${Math.round(minutesToLimit / 60)} hours`
    } else {
      return `${Math.round(minutesToLimit / 1440)} days`
    }
  }

  /**
   * Get limiter metrics history
   */
  public getLimiterHistory(limiterName: string, limit?: number): RateLimitMetrics[] {
    const history = this.metricsHistory.get(limiterName) || []
    return limit ? history.slice(-limit) : history
  }

  /**
   * Get system-wide limiter overview
   */
  public getSystemOverview() {
    const allMetrics = this.getAllLimiterMetrics()
    const activeAlerts = this.getActiveAlerts()

    const totalRequests = allMetrics.reduce((sum, m) => sum + m.current_requests, 0)
    const totalMaxRequests = allMetrics.reduce((sum, m) => sum + m.max_requests, 0)
    const systemUtilization = totalMaxRequests > 0
      ? Math.round((totalRequests / totalMaxRequests) * 100)
      : 0

    const healthyLimiters = allMetrics.filter(m => m.health_status === 'healthy').length
    const warningLimiters = allMetrics.filter(m => m.health_status === 'warning').length
    const criticalLimiters = allMetrics.filter(m => m.health_status === 'critical').length

    return {
      total_limiters: allMetrics.length,
      system_utilization_percent: systemUtilization,
      total_requests: totalRequests,
      total_max_requests: totalMaxRequests,
      healthy_limiters: healthyLimiters,
      warning_limiters: warningLimiters,
      critical_limiters: criticalLimiters,
      active_alerts: activeAlerts.length,
      critical_alerts: activeAlerts.filter(a => a.severity === 'critical').length,
      warning_alerts: activeAlerts.filter(a => a.severity === 'warning').length,
      timestamp: new Date().toISOString()
    }
  }
}

// Global instance for application-wide monitoring
export const rateLimitMonitor = new RateLimitMonitor()
