export enum AlertSeverity {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info'
}

export enum AlertType {
  POOL_UTILIZATION = 'pool_utilization',
  ACQUIRE_FAILURES = 'acquire_failures',
  VALIDATION_FAILURES = 'validation_failures',
  CONNECTION_TIMEOUT = 'connection_timeout',
  IDLE_CONNECTIONS = 'idle_connections'
}

export interface ThresholdConfig {
  enabled: boolean
  warningThreshold: number
  criticalThreshold: number
}

export interface AlertConfig {
  poolUtilization: ThresholdConfig
  acquireFailures: ThresholdConfig
  validationFailures: ThresholdConfig
  idleConnections: ThresholdConfig
}

export interface Alert {
  id: string
  type: AlertType
  severity: AlertSeverity
  message: string
  timestamp: Date
  acknowledged: boolean
  details?: Record<string, unknown>
}

export interface AddAlertInput {
  severity: AlertSeverity
  type: AlertType
  message: string
  details?: Record<string, unknown>
  id?: string
  timestamp?: Date
  acknowledged?: boolean
}

type AlertListener = (alert: Alert) => void

const DEFAULT_CONFIG: AlertConfig = {
  poolUtilization: { enabled: true, warningThreshold: 70, criticalThreshold: 90 },
  acquireFailures: { enabled: true, warningThreshold: 5, criticalThreshold: 15 },
  validationFailures: { enabled: true, warningThreshold: 3, criticalThreshold: 8 },
  idleConnections: { enabled: false, warningThreshold: 80, criticalThreshold: 95 }
}

const HISTORY_LIMIT = 200
const MONITOR_INTERVAL_MS = 15000

const createId = (): string => {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `alert_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export class ConnectionPoolAlertService {
  private static instance: ConnectionPoolAlertService
  private readonly listeners = new Set<AlertListener>()
  private activeAlerts: Alert[] = []
  private alertHistory: Alert[] = []
  private monitoring = false
  private monitorTimer: NodeJS.Timeout | null = null
  private config: AlertConfig = {
    poolUtilization: { ...DEFAULT_CONFIG.poolUtilization },
    acquireFailures: { ...DEFAULT_CONFIG.acquireFailures },
    validationFailures: { ...DEFAULT_CONFIG.validationFailures },
    idleConnections: { ...DEFAULT_CONFIG.idleConnections }
  }

  private constructor() {}

  static getInstance(): ConnectionPoolAlertService {
    if (!ConnectionPoolAlertService.instance) {
      ConnectionPoolAlertService.instance = new ConnectionPoolAlertService()
    }
    return ConnectionPoolAlertService.instance
  }

  startMonitoring(): void {
    if (this.monitoring) return
    this.monitoring = true
    this.monitorTimer = setInterval(() => this.simulateMetricsSweep(), MONITOR_INTERVAL_MS)
  }

  stopMonitoring(): void {
    if (!this.monitoring) return
    this.monitoring = false
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer)
      this.monitorTimer = null
    }
  }

  isMonitoring(): boolean {
    return this.monitoring
  }

  addAlert(input: AddAlertInput): Alert {
    const alert: Alert = {
      id: input.id ?? createId(),
      severity: input.severity,
      type: input.type,
      message: input.message,
      timestamp: input.timestamp ?? new Date(),
      acknowledged: input.acknowledged ?? false,
      details: input.details
    }

    this.activeAlerts = this.upsertAlert(this.activeAlerts, alert)
    this.alertHistory = this.upsertAlert(this.alertHistory, alert).slice(0, HISTORY_LIMIT)
    this.notifyListeners(alert)
    return alert
  }

  getActiveAlerts(): Alert[] {
    return this.activeAlerts.map(alert => ({ ...alert }))
  }

  getAlertHistory(): Alert[] {
    return this.alertHistory.map(alert => ({ ...alert }))
  }

  addAlertListener(listener: AlertListener): void {
    this.listeners.add(listener)
  }

  removeAlertListener(listener: AlertListener): void {
    this.listeners.delete(listener)
  }

  acknowledgeAlert(alertId: string): boolean {
    let updated = false
    this.activeAlerts = this.activeAlerts.map(alert => {
      if (alert.id === alertId && !alert.acknowledged) {
        updated = true
        return { ...alert, acknowledged: true }
      }
      return alert
    })

    if (updated) {
      this.alertHistory = this.alertHistory.map(alert =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      )
    }

    return updated
  }

  clearAlert(alertId: string): boolean {
    const exists = this.activeAlerts.some(alert => alert.id === alertId)
    if (!exists) return false

    const removed = this.activeAlerts.find(alert => alert.id === alertId)
    this.activeAlerts = this.activeAlerts.filter(alert => alert.id !== alertId)

    if (removed) {
      this.alertHistory = this.upsertAlert(this.alertHistory, {
        ...removed,
        acknowledged: true
      }).slice(0, HISTORY_LIMIT)
    }

    return true
  }

  updateConfig(config: AlertConfig): void {
    this.config = {
      poolUtilization: { ...this.config.poolUtilization, ...config.poolUtilization },
      acquireFailures: { ...this.config.acquireFailures, ...config.acquireFailures },
      validationFailures: { ...this.config.validationFailures, ...config.validationFailures },
      idleConnections: { ...this.config.idleConnections, ...config.idleConnections }
    }
  }

  getPoolUtilizationConfig(): ThresholdConfig {
    return { ...this.config.poolUtilization }
  }

  getAcquireFailuresConfig(): ThresholdConfig {
    return { ...this.config.acquireFailures }
  }

  getValidationFailuresConfig(): ThresholdConfig {
    return { ...this.config.validationFailures }
  }

  getIdleConnectionsConfig(): ThresholdConfig {
    return { ...this.config.idleConnections }
  }

  private notifyListeners(alert: Alert) {
    for (const listener of this.listeners) {
      try {
        listener({ ...alert })
      } catch {
        // Listener errors are swallowed to avoid cascading failures
      }
    }
  }

  private upsertAlert(collection: Alert[], alert: Alert): Alert[] {
    const existingIndex = collection.findIndex(item => item.id === alert.id)
    if (existingIndex >= 0) {
      const clone = [...collection]
      clone[existingIndex] = alert
      return clone.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    }
    return [alert, ...collection].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  private simulateMetricsSweep(): void {
    if (!this.monitoring) return

    const now = new Date()

    // Simulate pool utilization
    if (this.config.poolUtilization.enabled) {
      const utilization = 60 + Math.random() * 50
      if (utilization >= this.config.poolUtilization.criticalThreshold) {
        this.addAlert({
          severity: AlertSeverity.CRITICAL,
          type: AlertType.POOL_UTILIZATION,
          message: 'Connection pool utilization critical',
          details: { currentUtilization: Number(utilization.toFixed(1)) },
          timestamp: now
        })
      } else if (utilization >= this.config.poolUtilization.warningThreshold) {
        this.addAlert({
          severity: AlertSeverity.WARNING,
          type: AlertType.POOL_UTILIZATION,
          message: 'Connection pool utilization high',
          details: { currentUtilization: Number(utilization.toFixed(1)) },
          timestamp: now
        })
      }
    }

    if (this.config.acquireFailures.enabled) {
      const failures = Math.floor(Math.random() * 10)
      if (failures >= this.config.acquireFailures.criticalThreshold) {
        this.addAlert({
          severity: AlertSeverity.CRITICAL,
          type: AlertType.ACQUIRE_FAILURES,
          message: 'High rate of connection acquire failures',
          details: { recentFailures: failures },
          timestamp: now
        })
      } else if (failures >= this.config.acquireFailures.warningThreshold) {
        this.addAlert({
          severity: AlertSeverity.WARNING,
          type: AlertType.ACQUIRE_FAILURES,
          message: 'Elevated connection acquire failures detected',
          details: { recentFailures: failures },
          timestamp: now
        })
      }
    }

    if (this.config.validationFailures.enabled) {
      const validations = Math.floor(Math.random() * 6)
      if (validations >= this.config.validationFailures.criticalThreshold) {
        this.addAlert({
          severity: AlertSeverity.CRITICAL,
          type: AlertType.VALIDATION_FAILURES,
          message: 'Connection validation failures exceeding limit',
          details: { recentFailures: validations },
          timestamp: now
        })
      } else if (validations >= this.config.validationFailures.warningThreshold) {
        this.addAlert({
          severity: AlertSeverity.WARNING,
          type: AlertType.VALIDATION_FAILURES,
          message: 'Connection validation issues detected',
          details: { recentFailures: validations },
          timestamp: now
        })
      }
    }

    if (this.config.idleConnections.enabled) {
      const idlePercent = 60 + Math.random() * 50
      if (idlePercent >= this.config.idleConnections.criticalThreshold) {
        this.addAlert({
          severity: AlertSeverity.WARNING,
          type: AlertType.IDLE_CONNECTIONS,
          message: 'High percentage of idle connections',
          details: { idlePercentage: Number(idlePercent.toFixed(1)) },
          timestamp: now
        })
      }
    }
  }
}

export default ConnectionPoolAlertService
