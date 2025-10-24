/**
 * Enhanced Alerting System for VibeCode WebGUI
 * Advanced alerting with dynamic thresholds, anomaly detection, and smart notifications
 */

// import { logger } from '@/lib/logger'
import { alertsManager, AlertConfig } from './alerts-configuration'
import { performanceBaselines, PerformanceBaseline } from './performance-baselines'
import { datadogMetrics } from './datadog-metrics'

export interface SmartAlert {
  id: string
  name: string
  operation: string
  type: 'threshold' | 'anomaly' | 'trend' | 'composite'
  severity: 'info' | 'warning' | 'critical'
  conditions: AlertCondition[]
  actions: AlertAction[]
  cooldown: number // minutes
  enabled: boolean
  lastTriggered?: Date
  triggerCount: number
  createdAt: Date
}

export interface AlertCondition {
  metric: string
  operator: '>' | '<' | '>=' | '<=' | '==' | '!='
  value: number | 'baseline_p95' | 'baseline_p99' | 'baseline_mean'
  timeWindow: number // minutes
  aggregation: 'avg' | 'max' | 'min' | 'sum' | 'count'
}

export interface AlertAction {
  type: 'log' | 'metric' | 'notification' | 'webhook' | 'auto_scale'
  config: Record<string, any>
}

export interface AnomalyDetectionConfig {
  operation: string
  sensitivity: 'low' | 'medium' | 'high'
  minDataPoints: number
  stdDeviationThreshold: number
  enabled: boolean
}

class EnhancedAlertingService {
  private alerts = new Map<string, SmartAlert>()
  private recentMetrics = new Map<string, Array<{ value: number; timestamp: Date }>>()
  private anomalyConfigs = new Map<string, AnomalyDetectionConfig>()
  private maxMetricHistory = 1000
  
  constructor() {
    this.initializeDefaultAlerts()
    this.initializeAnomalyDetection()
    
    // Start periodic checks
    setInterval(() => this.runPeriodicChecks(), 60000) // Every minute
  }

  /**
   * Initialize default smart alerts
   */
  private initializeDefaultAlerts() {
    const defaultAlerts: Omit<SmartAlert, 'id' | 'createdAt' | 'triggerCount' | 'lastTriggered'>[] = [
      {
        name: 'AI Response Time Degradation',
        operation: 'ai.chat_completion',
        type: 'threshold',
        severity: 'warning',
        conditions: [
          {
            metric: 'vibecode.ai.response_time',
            operator: '>',
            value: 'baseline_p95',
            timeWindow: 5,
            aggregation: 'avg'
          }
        ],
        actions: [
          { type: 'log', config: { level: 'warning' } },
          { type: 'metric', config: { name: 'vibecode.alerts.ai_slow', value: 1 } }
        ],
        cooldown: 15,
        enabled: true
      },
      {
        name: 'Database Query Performance Alert',
        operation: 'db.query',
        type: 'composite',
        severity: 'critical',
        conditions: [
          {
            metric: 'vibecode.database.query_time',
            operator: '>',
            value: 'baseline_p99',
            timeWindow: 10,
            aggregation: 'avg'
          },
          {
            metric: 'vibecode.database.errors',
            operator: '>',
            value: 5,
            timeWindow: 5,
            aggregation: 'sum'
          }
        ],
        actions: [
          { type: 'log', config: { level: 'critical' } },
          { type: 'metric', config: { name: 'vibecode.alerts.db_critical', value: 1 } },
          { type: 'notification', config: { channels: ['#alerts', '#database-team'] } }
        ],
        cooldown: 30,
        enabled: true
      },
      {
        name: 'High Error Rate Anomaly',
        operation: 'api.errors',
        type: 'anomaly',
        severity: 'critical',
        conditions: [
          {
            metric: 'vibecode.api.errors.rate',
            operator: '>',
            value: 3, // 3 standard deviations
            timeWindow: 15,
            aggregation: 'avg'
          }
        ],
        actions: [
          { type: 'log', config: { level: 'critical' } },
          { type: 'metric', config: { name: 'vibecode.alerts.error_anomaly', value: 1 } },
          { type: 'notification', config: { channels: ['#critical-alerts'] } }
        ],
        cooldown: 60,
        enabled: true
      },
      {
        name: 'Memory Usage Trend Alert',
        operation: 'system.memory',
        type: 'trend',
        severity: 'warning',
        conditions: [
          {
            metric: 'vibecode.system.memory.usage_percent',
            operator: '>',
            value: 85,
            timeWindow: 30,
            aggregation: 'avg'
          }
        ],
        actions: [
          { type: 'log', config: { level: 'warning' } },
          { type: 'metric', config: { name: 'vibecode.alerts.memory_trend', value: 1 } }
        ],
        cooldown: 45,
        enabled: true
      },
      {
        name: 'User Session Failure Spike',
        operation: 'business.user_session',
        type: 'threshold',
        severity: 'warning',
        conditions: [
          {
            metric: 'vibecode.user.session_failures',
            operator: '>',
            value: 10,
            timeWindow: 10,
            aggregation: 'sum'
          }
        ],
        actions: [
          { type: 'log', config: { level: 'warning' } },
          { type: 'metric', config: { name: 'vibecode.alerts.session_failures', value: 1 } }
        ],
        cooldown: 20,
        enabled: true
      }
    ]

    defaultAlerts.forEach(alertConfig => {
      const alert: SmartAlert = {
        ...alertConfig,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        triggerCount: 0
      }
      this.alerts.set(alert.id, alert)
    })

    console.log('Enhanced alerting system initialized', {
      total_alerts: this.alerts.size,
      enabled_alerts: Array.from(this.alerts.values()).filter(a => a.enabled).length
    })
  }

  /**
   * Initialize anomaly detection configurations
   */
  private initializeAnomalyDetection() {
    const anomalyConfigs: AnomalyDetectionConfig[] = [
      {
        operation: 'api.response_time',
        sensitivity: 'medium',
        minDataPoints: 50,
        stdDeviationThreshold: 2.5,
        enabled: true
      },
      {
        operation: 'db.query_time',
        sensitivity: 'high',
        minDataPoints: 100,
        stdDeviationThreshold: 2.0,
        enabled: true
      },
      {
        operation: 'ai.chat_completion',
        sensitivity: 'low',
        minDataPoints: 30,
        stdDeviationThreshold: 3.0,
        enabled: true
      },
      {
        operation: 'error.rate',
        sensitivity: 'high',
        minDataPoints: 20,
        stdDeviationThreshold: 1.5,
        enabled: true
      }
    ]

    anomalyConfigs.forEach(config => {
      this.anomalyConfigs.set(config.operation, config)
    })
  }

  /**
   * Record a metric value for alerting
   */
  recordMetric(operation: string, metric: string, value: number) {
    const key = `${operation}.${metric}`
    
    if (!this.recentMetrics.has(key)) {
      this.recentMetrics.set(key, [])
    }
    
    const metrics = this.recentMetrics.get(key)!
    metrics.push({ value, timestamp: new Date() })
    
    // Keep only recent metrics
    if (metrics.length > this.maxMetricHistory) {
      metrics.shift()
    }
    
    // Check for anomalies
    this.checkAnomalies(operation, metric, value)
    
    // Evaluate relevant alerts
    this.evaluateAlerts(operation, metric, value)
  }

  /**
   * Check for anomalies using statistical analysis
   */
  private checkAnomalies(operation: string, metric: string, value: number) {
    const config = this.anomalyConfigs.get(operation)
    if (!config || !config.enabled) return
    
    const key = `${operation}.${metric}`
    const metrics = this.recentMetrics.get(key)
    
    if (!metrics || metrics.length < config.minDataPoints) return
    
    // Calculate recent baseline (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentValues = metrics
      .filter(m => m.timestamp > oneDayAgo)
      .map(m => m.value)
    
    if (recentValues.length < config.minDataPoints) return
    
    // Calculate statistics
    const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length
    const variance = recentValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / recentValues.length
    const stdDeviation = Math.sqrt(variance)
    
    // Check if current value is anomalous
    const zScore = Math.abs((value - mean) / stdDeviation)
    
    if (zScore > config.stdDeviationThreshold) {
      this.triggerAnomalyAlert(operation, metric, value, mean, stdDeviation, zScore)
    }
  }

  /**
   * Trigger anomaly alert
   */
  private triggerAnomalyAlert(
    operation: string,
    metric: string,
    value: number,
    mean: number,
    stdDeviation: number,
    zScore: number
  ) {
    const severity = zScore > 4 ? 'critical' : zScore > 3 ? 'warning' : 'info'
    
    logger[severity](`Anomaly detected: ${operation}.${metric}`, {
      operation,
      metric,
      current_value: value,
      baseline_mean: Math.round(mean),
      standard_deviation: Math.round(stdDeviation),
      z_score: Math.round(zScore * 100) / 100,
      severity
    })
    
    // Submit anomaly metric
    datadogMetrics.recordError('anomaly_detected', operation, metric, {
      tags: {
        metric,
        severity,
        z_score: zScore.toString()
      }
    })
  }

  /**
   * Evaluate all relevant alerts
   */
  private evaluateAlerts(operation: string, metric: string, value: number) {
    const relevantAlerts = Array.from(this.alerts.values())
      .filter(alert => 
        alert.enabled && 
        alert.operation === operation &&
        this.isAlertCooldownExpired(alert)
      )
    
    relevantAlerts.forEach(alert => {
      if (this.evaluateAlertConditions(alert, metric, value)) {
        this.triggerAlert(alert, { operation, metric, value })
      }
    })
  }

  /**
   * Check if alert cooldown has expired
   */
  private isAlertCooldownExpired(alert: SmartAlert): boolean {
    if (!alert.lastTriggered) return true
    
    const cooldownMs = alert.cooldown * 60 * 1000
    return (Date.now() - alert.lastTriggered.getTime()) > cooldownMs
  }

  /**
   * Evaluate alert conditions
   */
  private evaluateAlertConditions(alert: SmartAlert, metric: string, value: number): boolean {
    return alert.conditions.every(condition => {
      if (condition.metric !== metric) return true // Skip non-matching metrics
      
      let threshold = condition.value
      
      // Resolve baseline-relative thresholds
      if (typeof threshold === 'string' && threshold.startsWith('baseline_')) {
        const baseline = performanceBaselines.getBaseline(alert.operation)
        if (!baseline) return false // No baseline available
        
        switch (threshold) {
          case 'baseline_p95':
            threshold = baseline.p95
            break
          case 'baseline_p99':
            threshold = baseline.p99
            break
          case 'baseline_mean':
            threshold = baseline.mean
            break
          default:
            return false
        }
      }
      
      // Evaluate condition
      switch (condition.operator) {
        case '>':
          return value > threshold
        case '<':
          return value < threshold
        case '>=':
          return value >= threshold
        case '<=':
          return value <= threshold
        case '==':
          return value === threshold
        case '!=':
          return value !== threshold
        default:
          return false
      }
    })
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(alert: SmartAlert, context: { operation: string; metric: string; value: number }) {
    alert.lastTriggered = new Date()
    alert.triggerCount++
    
    logger[alert.severity](`Alert triggered: ${alert.name}`, {
      alert_id: alert.id,
      alert_name: alert.name,
      operation: context.operation,
      metric: context.metric,
      value: context.value,
      severity: alert.severity,
      trigger_count: alert.triggerCount
    })
    
    // Execute alert actions
    alert.actions.forEach(action => {
      this.executeAlertAction(action, alert, context)
    })
    
    // Update alert in storage
    this.alerts.set(alert.id, alert)
  }

  /**
   * Execute an alert action
   */
  private executeAlertAction(
    action: AlertAction,
    alert: SmartAlert,
    context: { operation: string; metric: string; value: number }
  ) {
    switch (action.type) {
      case 'log':
        const level = action.config.level || alert.severity
        logger[level as keyof typeof logger](`Alert action: ${alert.name}`, {
          action_type: action.type,
          alert_id: alert.id,
          ...context
        })
        break
        
      case 'metric':
        datadogMetrics.recordError(
          action.config.name || 'alert_triggered',
          context.operation,
          context.metric,
          {
            tags: {
              alert_name: alert.name,
              severity: alert.severity,
              metric: context.metric
            }
          }
        )
        break
        
      case 'notification':
        // In a real implementation, this would send to Slack, PagerDuty, etc.
        console.log(`Notification sent: ${alert.name}`, {
          channels: action.config.channels,
          alert_id: alert.id,
          ...context
        })
        break
        
      case 'webhook':
        // In a real implementation, this would call a webhook
        console.log(`Webhook triggered: ${alert.name}`, {
          webhook_url: action.config.url,
          alert_id: alert.id,
          ...context
        })
        break
        
      case 'auto_scale':
        // In a real implementation, this would trigger auto-scaling
        console.log(`Auto-scaling triggered: ${alert.name}`, {
          scale_action: action.config.action,
          alert_id: alert.id,
          ...context
        })
        break
    }
  }

  /**
   * Run periodic checks for trend-based alerts
   */
  private runPeriodicChecks() {
    const trendAlerts = Array.from(this.alerts.values())
      .filter(alert => alert.enabled && alert.type === 'trend')
    
    trendAlerts.forEach(alert => {
      this.evaluateTrendAlert(alert)
    })
  }

  /**
   * Evaluate trend-based alerts
   */
  private evaluateTrendAlert(alert: SmartAlert) {
    // Implementation for trend analysis would go here
    // This is a simplified version
    console.log(`Evaluating trend alert: ${alert.name}`, {
      alert_id: alert.id,
      operation: alert.operation
    })
  }

  /**
   * Create a new smart alert
   */
  createAlert(alertConfig: Omit<SmartAlert, 'id' | 'createdAt' | 'triggerCount'>): string {
    const alert: SmartAlert = {
      ...alertConfig,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      triggerCount: 0
    }
    
    this.alerts.set(alert.id, alert)
    
    console.log(`Smart alert created: ${alert.name}`, {
      alert_id: alert.id,
      operation: alert.operation,
      type: alert.type,
      severity: alert.severity
    })
    
    return alert.id
  }

  /**
   * Update an existing alert
   */
  updateAlert(alertId: string, updates: Partial<SmartAlert>): boolean {
    const alert = this.alerts.get(alertId)
    if (!alert) return false
    
    const updatedAlert = { ...alert, ...updates }
    this.alerts.set(alertId, updatedAlert)
    
    console.log(`Smart alert updated: ${alert.name}`, {
      alert_id: alertId,
      updates: Object.keys(updates)
    })
    
    return true
  }

  /**
   * Delete an alert
   */
  deleteAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId)
    if (!alert) return false
    
    this.alerts.delete(alertId)
    
    console.log(`Smart alert deleted: ${alert.name}`, {
      alert_id: alertId
    })
    
    return true
  }

  /**
   * Get all alerts
   */
  getAlerts(): SmartAlert[] {
    return Array.from(this.alerts.values())
  }

  /**
   * Get alert by ID
   */
  getAlert(alertId: string): SmartAlert | null {
    return this.alerts.get(alertId) || null
  }

  /**
   * Get alerting health status
   */
  getHealthStatus(): {
    total_alerts: number
    enabled_alerts: number
    triggered_alerts_24h: number
    most_triggered_alerts: Array<{
      name: string
      trigger_count: number
    }>
    anomaly_detection_status: {
      total_configs: number
      enabled_configs: number
    }
  } {
    const allAlerts = Array.from(this.alerts.values())
    const enabledAlerts = allAlerts.filter(a => a.enabled)
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const triggeredAlerts24h = allAlerts.filter(a => 
      a.lastTriggered && a.lastTriggered > oneDayAgo
    ).length
    
    const mostTriggered = allAlerts
      .sort((a, b) => b.triggerCount - a.triggerCount)
      .slice(0, 5)
      .map(a => ({
        name: a.name,
        trigger_count: a.triggerCount
      }))
    
    const anomalyConfigs = Array.from(this.anomalyConfigs.values())
    
    return {
      total_alerts: allAlerts.length,
      enabled_alerts: enabledAlerts.length,
      triggered_alerts_24h: triggeredAlerts24h,
      most_triggered_alerts: mostTriggered,
      anomaly_detection_status: {
        total_configs: anomalyConfigs.length,
        enabled_configs: anomalyConfigs.filter(c => c.enabled).length
      }
    }
  }
}

// Export singleton instance
export const enhancedAlerting = new EnhancedAlertingService()

// Export types
export type { SmartAlert, AlertCondition, AlertAction, AnomalyDetectionConfig }