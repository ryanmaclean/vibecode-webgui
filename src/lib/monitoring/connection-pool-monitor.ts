/**
 * Connection Pool Monitoring System
 * Provides real-time monitoring, alerting, and visualization for database connection pools
 */

import { EventEmitter } from 'events'
import { logger } from '@/lib/logger';
export interface ConnectionPoolMetrics {
  pool_name: string
  total_connections: number
  active_connections: number
  idle_connections: number
  waiting_count: number
  max_connections: number
  min_connections: number
  utilization_percent: number
  average_wait_time_ms: number
  peak_connections: number
  connections_created: number
  connections_destroyed: number
  timestamp: string
  health_status: 'healthy' | 'warning' | 'critical'
}

export interface PoolAlert {
  id: string
  pool_name: string
  alert_type: 'pool_exhaustion' | 'high_utilization' | 'long_wait_time' | 'connection_leak'
  severity: 'warning' | 'critical'
  message: string
  threshold: number
  current_value: number
  timestamp: string
  resolved: boolean
  resolution_timestamp?: string
}

export interface PoolCapacityReport {
  pool_name: string
  current_utilization: number
  peak_utilization_24h: number
  average_utilization_24h: number
  recommended_max_connections: number
  growth_trend: 'increasing' | 'stable' | 'decreasing'
  capacity_headroom: number
  projected_exhaustion_time?: string
}

/**
 * Connection Pool Monitoring and Alerting System
 */
export class ConnectionPoolMonitor extends EventEmitter {
  private pools: Map<string, ConnectionPoolMetrics> = new Map()
  private alerts: Map<string, PoolAlert> = new Map()
  private metricsHistory: Map<string, ConnectionPoolMetrics[]> = new Map()
  private maxHistorySize = 1000 // Keep last 1000 metrics per pool
  
  // Alert thresholds
  private thresholds = {
    utilization_warning: 70, // 70% utilization
    utilization_critical: 85, // 85% utilization  
    wait_time_warning: 1000, // 1 second wait time
    wait_time_critical: 5000, // 5 second wait time
    exhaustion_threshold: 95 // 95% utilization triggers exhaustion alert
  }

  private monitoringInterval?: NodeJS.Timeout
  private alertCheckInterval?: NodeJS.Timeout

  constructor() {
    super()
    this.startMonitoring()
  }

  /**
   * Register a connection pool for monitoring
   */
  public registerPool(poolName: string, initialMetrics: Partial<ConnectionPoolMetrics>) {
    const metrics: ConnectionPoolMetrics = {
      pool_name: poolName,
      total_connections: initialMetrics.total_connections || 0,
      active_connections: initialMetrics.active_connections || 0,
      idle_connections: initialMetrics.idle_connections || 0,
      waiting_count: initialMetrics.waiting_count || 0,
      max_connections: initialMetrics.max_connections || 10,
      min_connections: initialMetrics.min_connections || 1,
      utilization_percent: 0,
      average_wait_time_ms: 0,
      peak_connections: initialMetrics.peak_connections || 0,
      connections_created: initialMetrics.connections_created || 0,
      connections_destroyed: initialMetrics.connections_destroyed || 0,
      timestamp: new Date().toISOString(),
      health_status: 'healthy'
    }

    // Calculate utilization
    metrics.utilization_percent = metrics.max_connections > 0 
      ? Math.round((metrics.active_connections / metrics.max_connections) * 100)
      : 0

    this.pools.set(poolName, metrics)
    this.initializeHistory(poolName)
    
    logger.info(`📊 Registered pool '${poolName}' for monitoring`)
  }

  /**
   * Update metrics for a specific pool
   */
  public updatePoolMetrics(poolName: string, metrics: Partial<ConnectionPoolMetrics>) {
    const existingMetrics = this.pools.get(poolName)
    if (!existingMetrics) {
      logger.warn(`Pool '${poolName}' not registered for monitoring`)
      return
    }

    const updatedMetrics: ConnectionPoolMetrics = {
      ...existingMetrics,
      ...metrics,
      timestamp: new Date().toISOString()
    }

    // Recalculate utilization
    updatedMetrics.utilization_percent = updatedMetrics.max_connections > 0
      ? Math.round((updatedMetrics.active_connections / updatedMetrics.max_connections) * 100)
      : 0

    // Update peak connections
    updatedMetrics.peak_connections = Math.max(
      updatedMetrics.peak_connections, 
      updatedMetrics.active_connections
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
  public getAllPoolMetrics(): ConnectionPoolMetrics[] {
    return Array.from(this.pools.values())
  }

  /**
   * Get metrics for a specific pool
   */
  public getPoolMetrics(poolName: string): ConnectionPoolMetrics | undefined {
    return this.pools.get(poolName)
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): PoolAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved)
  }

  /**
   * Get capacity planning report for all pools
   */
  public generateCapacityReport(): PoolCapacityReport[] {
    const reports: PoolCapacityReport[] = []

    for (const [poolName, currentMetrics] of this.pools) {
      const history = this.metricsHistory.get(poolName) || []
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

      // Calculate recommended max connections
      const recommendedMax = Math.max(
        currentMetrics.min_connections,
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

    logger.info('🔍 Connection pool monitoring started')
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
    logger.info('🛑 Connection pool monitoring stopped')
  }

  /**
   * Check for alert conditions
   */
  private checkForAlerts() {
    for (const [poolName, metrics] of this.pools) {
      this.checkUtilizationAlerts(poolName, metrics)
      this.checkWaitTimeAlerts(poolName, metrics)
      this.checkExhaustionAlerts(poolName, metrics)
    }
  }

  /**
   * Check utilization-based alerts
   */
  private checkUtilizationAlerts(poolName: string, metrics: ConnectionPoolMetrics) {
    const alertId = `${poolName}-utilization`
    const existingAlert = this.alerts.get(alertId)

    if (metrics.utilization_percent >= this.thresholds.utilization_critical) {
      if (!existingAlert || existingAlert.resolved) {
        this.createAlert({
          id: alertId,
          pool_name: poolName,
          alert_type: 'high_utilization',
          severity: 'critical',
          message: `Critical connection pool utilization: ${metrics.utilization_percent}%`,
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
          message: `High connection pool utilization: ${metrics.utilization_percent}%`,
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
   * Check wait time alerts
   */
  private checkWaitTimeAlerts(poolName: string, metrics: ConnectionPoolMetrics) {
    const alertId = `${poolName}-wait-time`
    const existingAlert = this.alerts.get(alertId)

    if (metrics.average_wait_time_ms >= this.thresholds.wait_time_critical) {
      if (!existingAlert || existingAlert.resolved) {
        this.createAlert({
          id: alertId,
          pool_name: poolName,
          alert_type: 'long_wait_time',
          severity: 'critical',
          message: `Critical connection wait time: ${metrics.average_wait_time_ms}ms`,
          threshold: this.thresholds.wait_time_critical,
          current_value: metrics.average_wait_time_ms,
          timestamp: new Date().toISOString(),
          resolved: false
        })
      }
    } else if (metrics.average_wait_time_ms >= this.thresholds.wait_time_warning) {
      if (!existingAlert || existingAlert.resolved || existingAlert.severity !== 'warning') {
        this.createAlert({
          id: alertId,
          pool_name: poolName,
          alert_type: 'long_wait_time',
          severity: 'warning',
          message: `High connection wait time: ${metrics.average_wait_time_ms}ms`,
          threshold: this.thresholds.wait_time_warning,
          current_value: metrics.average_wait_time_ms,
          timestamp: new Date().toISOString(),
          resolved: false
        })
      }
    } else if (existingAlert && !existingAlert.resolved) {
      this.resolveAlert(alertId)
    }
  }

  /**
   * Check for pool exhaustion alerts
   */
  private checkExhaustionAlerts(poolName: string, metrics: ConnectionPoolMetrics) {
    const alertId = `${poolName}-exhaustion`
    const existingAlert = this.alerts.get(alertId)

    if (metrics.utilization_percent >= this.thresholds.exhaustion_threshold) {
      if (!existingAlert || existingAlert.resolved) {
        this.createAlert({
          id: alertId,
          pool_name: poolName,
          alert_type: 'pool_exhaustion',
          severity: 'critical',
          message: `Connection pool near exhaustion: ${metrics.active_connections}/${metrics.max_connections} connections`,
          threshold: this.thresholds.exhaustion_threshold,
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
  private createAlert(alert: PoolAlert) {
    this.alerts.set(alert.id, alert)
    this.emit('alertCreated', alert)
    logger.warn(`🚨 ALERT: ${alert.message} (Pool: ${alert.pool_name})`)
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
      logger.info(`✅ RESOLVED: ${alert.message} (Pool: ${alert.pool_name})`)
    }
  }

  /**
   * Calculate health status based on metrics
   */
  private calculateHealthStatus(metrics: ConnectionPoolMetrics): 'healthy' | 'warning' | 'critical' {
    if (metrics.utilization_percent >= this.thresholds.utilization_critical ||
        metrics.average_wait_time_ms >= this.thresholds.wait_time_critical) {
      return 'critical'
    }
    
    if (metrics.utilization_percent >= this.thresholds.utilization_warning ||
        metrics.average_wait_time_ms >= this.thresholds.wait_time_warning) {
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
  private addToHistory(poolName: string, metrics: ConnectionPoolMetrics) {
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
      // In a real implementation, this would fetch actual metrics from the pool
      // For now, we'll just verify the health status is current
      const updatedHealth = this.calculateHealthStatus(metrics)
      if (metrics.health_status !== updatedHealth) {
        this.updatePoolMetrics(poolName, { health_status: updatedHealth })
      }
    }
  }

  /**
   * Calculate projected exhaustion time
   */
  private calculateExhaustionTime(history: ConnectionPoolMetrics[]): string {
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
  public getPoolHistory(poolName: string, limit?: number): ConnectionPoolMetrics[] {
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

    const healthyPools = allMetrics.filter(m => m.health_status === 'healthy').length
    const warningPools = allMetrics.filter(m => m.health_status === 'warning').length
    const criticalPools = allMetrics.filter(m => m.health_status === 'critical').length

    return {
      total_pools: allMetrics.length,
      system_utilization_percent: systemUtilization,
      total_connections: totalConnections,
      total_max_connections: totalMaxConnections,
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
export const connectionPoolMonitor = new ConnectionPoolMonitor()