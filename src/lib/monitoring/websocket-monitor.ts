/**
 * WebSocket Connection Monitoring System
 * Provides real-time monitoring, alerting, and visualization for WebSocket connection pools
 */

import { EventEmitter } from 'events'

export interface WebSocketMetrics {
  pool_name: string
  total_connections: number
  active_connections: number
  idle_connections: number
  failed_connections: number
  pending_requests: number
  max_connections: number
  utilization_percent: number
  total_messages: number
  total_bytes: number
  average_latency_ms: number
  peak_connections: number
  uptime_ms: number
  timestamp: string
  health_status: 'healthy' | 'warning' | 'critical'
}

export interface WebSocketAlert {
  id: string
  pool_name: string
  alert_type: 'connection_limit' | 'high_utilization' | 'high_latency' | 'connection_failures' | 'pending_backlog'
  severity: 'warning' | 'critical'
  message: string
  threshold: number
  current_value: number
  timestamp: string
  resolved: boolean
  resolution_timestamp?: string
}

export interface WebSocketCapacityReport {
  pool_name: string
  current_utilization: number
  peak_utilization_24h: number
  average_utilization_24h: number
  recommended_max_connections: number
  growth_trend: 'increasing' | 'stable' | 'decreasing'
  capacity_headroom: number
  average_latency_24h: number
  failure_rate_24h: number
  projected_exhaustion_time?: string
}

/**
 * WebSocket Connection Pool Monitoring and Alerting System
 */
export class WebSocketMonitor extends EventEmitter {
  private pools: Map<string, WebSocketMetrics> = new Map()
  private alerts: Map<string, WebSocketAlert> = new Map()
  private metricsHistory: Map<string, WebSocketMetrics[]> = new Map()
  private maxHistorySize = 1000 // Keep last 1000 metrics per pool

  // Alert thresholds
  private thresholds = {
    utilization_warning: 70, // 70% utilization
    utilization_critical: 85, // 85% utilization
    latency_warning: 500, // 500ms latency
    latency_critical: 2000, // 2 second latency
    failure_rate_warning: 5, // 5% failure rate
    failure_rate_critical: 10, // 10% failure rate
    pending_requests_warning: 10, // 10 pending requests
    pending_requests_critical: 25 // 25 pending requests
  }

  private monitoringInterval?: NodeJS.Timeout
  private alertCheckInterval?: NodeJS.Timeout

  constructor() {
    super()
    this.startMonitoring()
  }

  /**
   * Register a WebSocket pool for monitoring
   */
  public registerPool(poolName: string, initialMetrics: Partial<WebSocketMetrics>) {
    const metrics: WebSocketMetrics = {
      pool_name: poolName,
      total_connections: initialMetrics.total_connections || 0,
      active_connections: initialMetrics.active_connections || 0,
      idle_connections: initialMetrics.idle_connections || 0,
      failed_connections: initialMetrics.failed_connections || 0,
      pending_requests: initialMetrics.pending_requests || 0,
      max_connections: initialMetrics.max_connections || 100,
      utilization_percent: 0,
      total_messages: initialMetrics.total_messages || 0,
      total_bytes: initialMetrics.total_bytes || 0,
      average_latency_ms: initialMetrics.average_latency_ms || 0,
      peak_connections: initialMetrics.peak_connections || 0,
      uptime_ms: initialMetrics.uptime_ms || 0,
      timestamp: new Date().toISOString(),
      health_status: 'healthy'
    }

    // Calculate utilization
    metrics.utilization_percent = metrics.max_connections > 0
      ? Math.round((metrics.total_connections / metrics.max_connections) * 100)
      : 0

    this.pools.set(poolName, metrics)
    this.initializeHistory(poolName)
  }

  /**
   * Update metrics for a specific pool
   */
  public updatePoolMetrics(poolName: string, metrics: Partial<WebSocketMetrics>) {
    const existingMetrics = this.pools.get(poolName)
    if (!existingMetrics) {
      return
    }

    const updatedMetrics: WebSocketMetrics = {
      ...existingMetrics,
      ...metrics,
      timestamp: new Date().toISOString()
    }

    // Recalculate utilization
    updatedMetrics.utilization_percent = updatedMetrics.max_connections > 0
      ? Math.round((updatedMetrics.total_connections / updatedMetrics.max_connections) * 100)
      : 0

    // Update peak connections
    updatedMetrics.peak_connections = Math.max(
      updatedMetrics.peak_connections,
      updatedMetrics.total_connections
    )

    // Determine health status
    updatedMetrics.health_status = this.calculateHealthStatus(updatedMetrics)

    this.pools.set(poolName, updatedMetrics)
    this.addToHistory(poolName, updatedMetrics)

    // Emit update event
    this.emit('metricsUpdated', poolName, updatedMetrics)
  }

  /**
   * Get current metrics for all pools
   */
  public getAllPoolMetrics(): WebSocketMetrics[] {
    return Array.from(this.pools.values())
  }

  /**
   * Get metrics for a specific pool
   */
  public getPoolMetrics(poolName: string): WebSocketMetrics | undefined {
    return this.pools.get(poolName)
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): WebSocketAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved)
  }

  /**
   * Get capacity planning report for all pools
   */
  public generateCapacityReport(): WebSocketCapacityReport[] {
    const reports: WebSocketCapacityReport[] = []

    for (const [poolName, currentMetrics] of this.pools) {
      const history = this.metricsHistory.get(poolName) || []
      const last24h = history.filter(m =>
        new Date(m.timestamp).getTime() > Date.now() - (24 * 60 * 60 * 1000)
      )

      if (last24h.length === 0) continue

      const utilizationValues = last24h.map(m => m.utilization_percent)
      const peakUtilization = Math.max(...utilizationValues)
      const avgUtilization = utilizationValues.reduce((a, b) => a + b, 0) / utilizationValues.length

      // Calculate average latency over 24h
      const latencyValues = last24h.map(m => m.average_latency_ms)
      const avgLatency = latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length

      // Calculate failure rate over 24h
      const totalConnections = last24h[last24h.length - 1]?.total_connections || 0
      const failedConnections = last24h[last24h.length - 1]?.failed_connections || 0
      const failureRate = totalConnections > 0
        ? Math.round((failedConnections / totalConnections) * 100)
        : 0

      // Simple trend calculation
      const recentUtilization = utilizationValues.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, utilizationValues.length)
      const olderUtilization = utilizationValues.slice(0, 10).reduce((a, b) => a + b, 0) / Math.min(10, utilizationValues.length)

      let growthTrend: 'increasing' | 'stable' | 'decreasing' = 'stable'
      if (recentUtilization > olderUtilization + 5) growthTrend = 'increasing'
      else if (recentUtilization < olderUtilization - 5) growthTrend = 'decreasing'

      // Calculate recommended max connections
      const recommendedMax = Math.max(
        10, // Minimum 10 connections
        Math.ceil(currentMetrics.max_connections * (peakUtilization / 70)) // Target 70% peak utilization
      )

      const capacityHeadroom = Math.max(0, 100 - currentMetrics.utilization_percent)

      reports.push({
        pool_name: poolName,
        current_utilization: currentMetrics.utilization_percent,
        peak_utilization_24h: peakUtilization,
        average_utilization_24h: Math.round(avgUtilization),
        recommended_max_connections: recommendedMax,
        growth_trend: growthTrend,
        capacity_headroom: capacityHeadroom,
        average_latency_24h: Math.round(avgLatency),
        failure_rate_24h: failureRate,
        projected_exhaustion_time: growthTrend === 'increasing' && capacityHeadroom < 20
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

    // Update pool health every 5 seconds
    this.monitoringInterval = setInterval(() => {
      this.updatePoolHealth()
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
    for (const [poolName, metrics] of this.pools) {
      this.checkUtilizationAlerts(poolName, metrics)
      this.checkLatencyAlerts(poolName, metrics)
      this.checkFailureAlerts(poolName, metrics)
      this.checkPendingRequestAlerts(poolName, metrics)
    }
  }

  /**
   * Check utilization-based alerts
   */
  private checkUtilizationAlerts(poolName: string, metrics: WebSocketMetrics) {
    const alertId = `${poolName}-utilization`
    const existingAlert = this.alerts.get(alertId)

    if (metrics.utilization_percent >= this.thresholds.utilization_critical) {
      if (!existingAlert || existingAlert.resolved) {
        this.createAlert({
          id: alertId,
          pool_name: poolName,
          alert_type: 'high_utilization',
          severity: 'critical',
          message: `Critical WebSocket pool utilization: ${metrics.utilization_percent}%`,
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
          pool_name: poolName,
          alert_type: 'high_utilization',
          severity: 'warning',
          message: `High WebSocket pool utilization: ${metrics.utilization_percent}%`,
          threshold: this.thresholds.utilization_warning,
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
   * Check latency alerts
   */
  private checkLatencyAlerts(poolName: string, metrics: WebSocketMetrics) {
    const alertId = `${poolName}-latency`
    const existingAlert = this.alerts.get(alertId)

    if (metrics.average_latency_ms >= this.thresholds.latency_critical) {
      if (!existingAlert || existingAlert.resolved) {
        this.createAlert({
          id: alertId,
          pool_name: poolName,
          alert_type: 'high_latency',
          severity: 'critical',
          message: `Critical WebSocket latency: ${Math.round(metrics.average_latency_ms)}ms`,
          threshold: this.thresholds.latency_critical,
          current_value: metrics.average_latency_ms,
          timestamp: new Date().toISOString(),
          resolved: false
        })
      }
    } else if (metrics.average_latency_ms >= this.thresholds.latency_warning) {
      if (!existingAlert || existingAlert.resolved || existingAlert.severity !== 'warning') {
        this.createAlert({
          id: alertId,
          pool_name: poolName,
          alert_type: 'high_latency',
          severity: 'warning',
          message: `High WebSocket latency: ${Math.round(metrics.average_latency_ms)}ms`,
          threshold: this.thresholds.latency_warning,
          current_value: metrics.average_latency_ms,
          timestamp: new Date().toISOString(),
          resolved: false
        })
      }
    } else if (existingAlert && !existingAlert.resolved) {
      this.resolveAlert(alertId)
    }
  }

  /**
   * Check failure rate alerts
   */
  private checkFailureAlerts(poolName: string, metrics: WebSocketMetrics) {
    const alertId = `${poolName}-failures`
    const existingAlert = this.alerts.get(alertId)

    const failureRate = metrics.total_connections > 0
      ? Math.round((metrics.failed_connections / metrics.total_connections) * 100)
      : 0

    if (failureRate >= this.thresholds.failure_rate_critical) {
      if (!existingAlert || existingAlert.resolved) {
        this.createAlert({
          id: alertId,
          pool_name: poolName,
          alert_type: 'connection_failures',
          severity: 'critical',
          message: `Critical WebSocket failure rate: ${failureRate}%`,
          threshold: this.thresholds.failure_rate_critical,
          current_value: failureRate,
          timestamp: new Date().toISOString(),
          resolved: false
        })
      }
    } else if (failureRate >= this.thresholds.failure_rate_warning) {
      if (!existingAlert || existingAlert.resolved || existingAlert.severity !== 'warning') {
        this.createAlert({
          id: alertId,
          pool_name: poolName,
          alert_type: 'connection_failures',
          severity: 'warning',
          message: `High WebSocket failure rate: ${failureRate}%`,
          threshold: this.thresholds.failure_rate_warning,
          current_value: failureRate,
          timestamp: new Date().toISOString(),
          resolved: false
        })
      }
    } else if (existingAlert && !existingAlert.resolved) {
      this.resolveAlert(alertId)
    }
  }

  /**
   * Check pending request alerts
   */
  private checkPendingRequestAlerts(poolName: string, metrics: WebSocketMetrics) {
    const alertId = `${poolName}-pending`
    const existingAlert = this.alerts.get(alertId)

    if (metrics.pending_requests >= this.thresholds.pending_requests_critical) {
      if (!existingAlert || existingAlert.resolved) {
        this.createAlert({
          id: alertId,
          pool_name: poolName,
          alert_type: 'pending_backlog',
          severity: 'critical',
          message: `Critical pending WebSocket requests: ${metrics.pending_requests}`,
          threshold: this.thresholds.pending_requests_critical,
          current_value: metrics.pending_requests,
          timestamp: new Date().toISOString(),
          resolved: false
        })
      }
    } else if (metrics.pending_requests >= this.thresholds.pending_requests_warning) {
      if (!existingAlert || existingAlert.resolved || existingAlert.severity !== 'warning') {
        this.createAlert({
          id: alertId,
          pool_name: poolName,
          alert_type: 'pending_backlog',
          severity: 'warning',
          message: `High pending WebSocket requests: ${metrics.pending_requests}`,
          threshold: this.thresholds.pending_requests_warning,
          current_value: metrics.pending_requests,
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
  private createAlert(alert: WebSocketAlert) {
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
  private calculateHealthStatus(metrics: WebSocketMetrics): 'healthy' | 'warning' | 'critical' {
    const failureRate = metrics.total_connections > 0
      ? Math.round((metrics.failed_connections / metrics.total_connections) * 100)
      : 0

    if (metrics.utilization_percent >= this.thresholds.utilization_critical ||
        metrics.average_latency_ms >= this.thresholds.latency_critical ||
        failureRate >= this.thresholds.failure_rate_critical ||
        metrics.pending_requests >= this.thresholds.pending_requests_critical) {
      return 'critical'
    }

    if (metrics.utilization_percent >= this.thresholds.utilization_warning ||
        metrics.average_latency_ms >= this.thresholds.latency_warning ||
        failureRate >= this.thresholds.failure_rate_warning ||
        metrics.pending_requests >= this.thresholds.pending_requests_warning) {
      return 'warning'
    }

    return 'healthy'
  }

  /**
   * Initialize metrics history for a pool
   */
  private initializeHistory(poolName: string) {
    if (!this.metricsHistory.has(poolName)) {
      this.metricsHistory.set(poolName, [])
    }
  }

  /**
   * Add metrics to history
   */
  private addToHistory(poolName: string, metrics: WebSocketMetrics) {
    const history = this.metricsHistory.get(poolName) || []
    history.push({...metrics})

    // Keep only the last maxHistorySize entries
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize)
    }

    this.metricsHistory.set(poolName, history)
  }

  /**
   * Update pool health status
   */
  private updatePoolHealth() {
    for (const [poolName, metrics] of this.pools) {
      const updatedHealth = this.calculateHealthStatus(metrics)
      if (metrics.health_status !== updatedHealth) {
        this.updatePoolMetrics(poolName, { health_status: updatedHealth })
      }
    }
  }

  /**
   * Calculate projected exhaustion time
   */
  private calculateExhaustionTime(history: WebSocketMetrics[]): string {
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

    if (slope <= 0) return 'Not trending toward exhaustion'

    const currentUtilization = utilizations[utilizations.length - 1]
    const utilizationToExhaustion = 95 - currentUtilization
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
   * Get pool metrics history
   */
  public getPoolHistory(poolName: string, limit?: number): WebSocketMetrics[] {
    const history = this.metricsHistory.get(poolName) || []
    return limit ? history.slice(-limit) : history
  }

  /**
   * Get system-wide pool overview
   */
  public getSystemOverview() {
    const allMetrics = this.getAllPoolMetrics()
    const activeAlerts = this.getActiveAlerts()

    const totalConnections = allMetrics.reduce((sum, m) => sum + m.total_connections, 0)
    const totalMaxConnections = allMetrics.reduce((sum, m) => sum + m.max_connections, 0)
    const systemUtilization = totalMaxConnections > 0
      ? Math.round((totalConnections / totalMaxConnections) * 100)
      : 0

    const totalMessages = allMetrics.reduce((sum, m) => sum + m.total_messages, 0)
    const totalBytes = allMetrics.reduce((sum, m) => sum + m.total_bytes, 0)
    const avgLatency = allMetrics.length > 0
      ? allMetrics.reduce((sum, m) => sum + m.average_latency_ms, 0) / allMetrics.length
      : 0

    const healthyPools = allMetrics.filter(m => m.health_status === 'healthy').length
    const warningPools = allMetrics.filter(m => m.health_status === 'warning').length
    const criticalPools = allMetrics.filter(m => m.health_status === 'critical').length

    return {
      total_pools: allMetrics.length,
      system_utilization_percent: systemUtilization,
      total_connections: totalConnections,
      total_max_connections: totalMaxConnections,
      total_messages: totalMessages,
      total_bytes: totalBytes,
      average_latency_ms: Math.round(avgLatency),
      healthy_pools: healthyPools,
      warning_pools: warningPools,
      critical_pools: criticalPools,
      active_alerts: activeAlerts.length,
      critical_alerts: activeAlerts.filter(a => a.severity === 'critical').length,
      warning_alerts: activeAlerts.filter(a => a.severity === 'warning').length,
      timestamp: new Date().toISOString()
    }
  }
}

// Global instance for application-wide monitoring
export const webSocketMonitor = new WebSocketMonitor()
