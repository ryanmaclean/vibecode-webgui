'use client'

import React, { useState, useEffect, useCallback } from 'react'
import ConnectionPoolAlertService, {
  Alert,
  AlertSeverity,
  AlertType,
  ThresholdConfig,
} from '@/lib/db/connection-pool-alerts'

interface ConnectionPoolAlertsProps {
  showControls?: boolean
  className?: string
}

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  [AlertType.POOL_UTILIZATION]: 'Pool Utilization',
  [AlertType.ACQUIRE_FAILURES]: 'Acquire Failures',
  [AlertType.VALIDATION_FAILURES]: 'Validation Failures',
  [AlertType.CONNECTION_TIMEOUT]: 'Connection Timeout',
  [AlertType.IDLE_CONNECTIONS]: 'Idle Connections',
}

export default function ConnectionPoolAlerts({
  showControls = false,
  className,
}: ConnectionPoolAlertsProps) {
  const service = ConnectionPoolAlertService.getInstance()
  const [alerts, setAlerts] = useState<Alert[]>(service.getActiveAlerts())
  const [monitoring, setMonitoring] = useState(service.isMonitoring())
  const [showConfig, setShowConfig] = useState(false)

  const [poolUtilizationWarning, setPoolUtilizationWarning] = useState(
    service.getPoolUtilizationConfig().warningThreshold
  )
  const [poolUtilizationCritical, setPoolUtilizationCritical] = useState(
    service.getPoolUtilizationConfig().criticalThreshold
  )

  const refreshAlerts = useCallback(() => {
    setAlerts([...service.getActiveAlerts()])
    setMonitoring(service.isMonitoring())
  }, [service])

  useEffect(() => {
    const listener = () => refreshAlerts()
    service.addAlertListener(listener)
    const interval = setInterval(refreshAlerts, 1000)
    return () => {
      service.removeAlertListener(listener)
      clearInterval(interval)
    }
  }, [service, refreshAlerts])

  const handleStartMonitoring = () => {
    service.startMonitoring()
    setMonitoring(true)
  }

  const handleStopMonitoring = () => {
    service.stopMonitoring()
    setMonitoring(false)
  }

  const handleAcknowledge = (alertId: string) => {
    service.acknowledgeAlert(alertId)
    refreshAlerts()
  }

  const handleDismiss = (alertId: string) => {
    service.clearAlert(alertId)
    refreshAlerts()
  }

  const handleThresholdChange = () => {
    service.updateConfig({
      poolUtilization: {
        ...service.getPoolUtilizationConfig(),
        warningThreshold: poolUtilizationWarning,
        criticalThreshold: poolUtilizationCritical,
      },
      acquireFailures: service.getAcquireFailuresConfig(),
      validationFailures: service.getValidationFailuresConfig(),
      idleConnections: service.getIdleConnectionsConfig(),
    })
  }

  useEffect(() => {
    handleThresholdChange()
  }, [poolUtilizationWarning, poolUtilizationCritical])

  return (
    <div className={className}>
      {showControls && (
        <div className="mb-4 flex gap-2">
          {!monitoring ? (
            <button
              onClick={handleStartMonitoring}
              className="rounded bg-green-600 px-3 py-1 text-sm text-white"
            >
              Start Monitoring
            </button>
          ) : (
            <button
              onClick={handleStopMonitoring}
              className="rounded bg-red-600 px-3 py-1 text-sm text-white"
            >
              Stop Monitoring
            </button>
          )}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="rounded bg-gray-600 px-3 py-1 text-sm text-white"
          >
            {showConfig ? 'Hide Config' : 'Show Config'}
          </button>
        </div>
      )}

      {showConfig && (
        <div className="mb-4 rounded border p-3">
          <h4 className="mb-2 text-sm font-medium">Pool Utilization</h4>
          <div className="flex gap-4">
            <label className="text-sm">
              <span id="poolUtilizationWarningLabel">Warning Threshold (%)</span>
              <input
                id="poolUtilizationWarning"
                aria-label="Warning Threshold (%)"
                type="number"
                value={poolUtilizationWarning}
                onChange={(e) =>
                  setPoolUtilizationWarning(Number(e.target.value))
                }
                className="ml-2 w-16 rounded border px-1"
              />
            </label>
            <label className="text-sm">
              <span id="poolUtilizationCriticalLabel">Critical Threshold (%)</span>
              <input
                id="poolUtilizationCritical"
                aria-label="Critical Threshold (%)"
                type="number"
                value={poolUtilizationCritical}
                onChange={(e) =>
                  setPoolUtilizationCritical(Number(e.target.value))
                }
                className="ml-2 w-16 rounded border px-1"
              />
            </label>
          </div>
        </div>
      )}

      {alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No alerts to display</p>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded border p-3 ${
                alert.severity === AlertSeverity.CRITICAL
                  ? 'border-red-500 bg-red-50'
                  : alert.severity === AlertSeverity.WARNING
                  ? 'border-yellow-500 bg-yellow-50'
                  : 'border-blue-500 bg-blue-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-sm font-medium">
                    {ALERT_TYPE_LABELS[alert.type] || alert.type}
                  </span>
                  {alert.acknowledged && (
                    <span className="ml-2 text-xs text-gray-500">
                      (Acknowledged)
                    </span>
                  )}
                  <p className="text-sm">{alert.message}</p>
                </div>
                <div className="flex gap-1">
                  {!alert.acknowledged && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="rounded bg-blue-500 px-2 py-0.5 text-xs text-white"
                    >
                      Acknowledge
                    </button>
                  )}
                  <button
                    onClick={() => handleDismiss(alert.id)}
                    className="rounded bg-gray-400 px-2 py-0.5 text-xs text-white"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
