/**
 * Alerts Dashboard Component
 * Displays and manages alerts from connection pool monitoring
 */

'use client'

import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import ConnectionPoolAlertService, {
  Alert,
  AlertSeverity,
  AlertType,
  AlertConfig
} from '@/lib/db/connection-pool-alerts'

interface AlertsProps {
  maxAlerts?: number
  showControls?: boolean
}

// Memoized AlertIcon component
const AlertIcon = memo(({ severity }: { severity: AlertSeverity }) => {
  const iconContent = useMemo(() => {
    const iconPath = severity === AlertSeverity.CRITICAL || severity === AlertSeverity.WARNING
      ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      : "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"

    const colorClass = severity === AlertSeverity.CRITICAL
      ? "text-red-500"
      : severity === AlertSeverity.WARNING
      ? "text-yellow-500"
      : "text-blue-500"

    return { iconPath, colorClass }
  }, [severity])

  return (
    <div className="flex-shrink-0">
      <svg className={`h-6 w-6 ${iconContent.colorClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconContent.iconPath} />
      </svg>
    </div>
  )
})
AlertIcon.displayName = 'AlertIcon'

// Memoized AlertItem component
const AlertItem = memo(({
  alert,
  onAcknowledge,
  onClear
}: {
  alert: Alert
  onAcknowledge: (id: string) => void
  onClear: (id: string) => void
}) => {
  const alertClass = useMemo(() => {
    switch (alert.severity) {
      case AlertSeverity.CRITICAL:
        return 'bg-red-50 border-red-300'
      case AlertSeverity.WARNING:
        return 'bg-yellow-50 border-yellow-300'
      default:
        return 'bg-blue-50 border-blue-300'
    }
  }, [alert.severity])

  const alertTypeText = useMemo(() => {
    switch (alert.type) {
      case AlertType.POOL_UTILIZATION:
        return 'Pool Utilization'
      case AlertType.ACQUIRE_FAILURES:
        return 'Acquire Failures'
      case AlertType.VALIDATION_FAILURES:
        return 'Validation Failures'
      case AlertType.CONNECTION_TIMEOUT:
        return 'Connection Timeout'
      case AlertType.IDLE_CONNECTIONS:
        return 'Idle Connections'
      default:
        return 'Unknown'
    }
  }, [alert.type])

  const handleAcknowledge = useCallback(() => {
    onAcknowledge(alert.id)
  }, [alert.id, onAcknowledge])

  const handleClear = useCallback(() => {
    onClear(alert.id)
  }, [alert.id, onClear])

  return (
    <div
      className={`p-4 rounded-lg border ${alertClass} ${
        alert.acknowledged ? 'opacity-60' : ''
      }`}
    >
      <div className="flex">
        <AlertIcon severity={alert.severity} />

        <div className="ml-3 flex-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {alertTypeText}
                {alert.acknowledged && ' (Acknowledged)'}
              </p>
              <p className="mt-1 text-sm text-gray-700">{alert.message}</p>
            </div>

            <div className="ml-4 flex-shrink-0 flex">
              {!alert.acknowledged && (
                <button
                  type="button"
                  className="bg-white text-sm text-indigo-600 hover:text-indigo-500 font-medium"
                  onClick={handleAcknowledge}
                >
                  Acknowledge
                </button>
              )}
              <button
                type="button"
                className="ml-3 bg-white text-sm text-red-600 hover:text-red-500 font-medium"
                onClick={handleClear}
              >
                Dismiss
              </button>
            </div>
          </div>

          <div className="mt-2 text-xs text-gray-500">
            {new Date(alert.timestamp).toLocaleString()}
          </div>

          {alert.details && (
            <div className="mt-2 text-xs text-gray-700">
              <details>
                <summary className="cursor-pointer">Details</summary>
                <pre className="mt-1 bg-gray-100 p-2 rounded overflow-auto max-h-32">
                  {JSON.stringify(alert.details, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
AlertItem.displayName = 'AlertItem'

function ConnectionPoolAlerts({ maxAlerts = 10, showControls = true }: AlertsProps) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [activeAlertService, setActiveAlertService] = useState<boolean>(false)
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null)
  const [showConfig, setShowConfig] = useState(false)

  useEffect(() => {
    // Initialize the alert service
    const alertService = ConnectionPoolAlertService.getInstance()

    // Get the current configuration
    const config = {
      poolUtilization: alertService.getPoolUtilizationConfig(),
      acquireFailures: alertService.getAcquireFailuresConfig(),
      validationFailures: alertService.getValidationFailuresConfig(),
      idleConnections: alertService.getIdleConnectionsConfig()
    }
    setAlertConfig(config)

    // Set up alert listener
    const handleAlert = (alert: Alert) => {
      setAlerts(prev => {
        // Add the new alert at the beginning
        const newAlerts = [alert, ...prev]
        // Keep only the last maxAlerts
        return newAlerts.slice(0, maxAlerts)
      })
    }

    alertService.addAlertListener(handleAlert)

    // Check if the service is already monitoring
    setActiveAlertService(alertService.isMonitoring())

    // Load existing alerts
    setAlerts(alertService.getActiveAlerts().slice(0, maxAlerts))

    return () => {
      // Cleanup - remove listener
      alertService.removeAlertListener(handleAlert)
    }
  }, [maxAlerts])

  const toggleAlertService = useCallback(() => {
    const alertService = ConnectionPoolAlertService.getInstance()

    if (activeAlertService) {
      alertService.stopMonitoring()
    } else {
      alertService.startMonitoring()
    }

    setActiveAlertService(!activeAlertService)
  }, [activeAlertService])

  const acknowledgeAlert = useCallback((alertId: string) => {
    const alertService = ConnectionPoolAlertService.getInstance()
    alertService.acknowledgeAlert(alertId)

    // Update the alerts list
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      )
    )
  }, [])

  const clearAlert = useCallback((alertId: string) => {
    const alertService = ConnectionPoolAlertService.getInstance()
    alertService.clearAlert(alertId)

    // Remove the alert from the list
    setAlerts(prev => prev.filter(alert => alert.id !== alertId))
  }, [])

  const updateConfig = useCallback((newConfig: AlertConfig) => {
    const alertService = ConnectionPoolAlertService.getInstance()
    alertService.updateConfig(newConfig)
    setAlertConfig(newConfig)
  }, [])

  const renderConfigSection = useMemo(() => {
    if (!alertConfig || !showConfig) return null

    return (
      <div className="mt-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Alert Configuration</h3>

        <div className="space-y-4">
          {/* Pool Utilization Configuration */}
          <div className="border-b border-gray-200 pb-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-md font-medium text-gray-700">Pool Utilization Alerts</h4>
              <div className="flex items-center">
                <span className="mr-2 text-sm text-gray-500">Enabled</span>
                <input
                  type="checkbox"
                  checked={alertConfig.poolUtilization.enabled}
                  onChange={(e) => {
                    updateConfig({
                      ...alertConfig,
                      poolUtilization: {
                        ...alertConfig.poolUtilization,
                        enabled: e.target.checked
                      }
                    })
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="poolUtilizationWarning" className="block text-sm text-gray-600">
                  Warning Threshold (%)
                </label>
                <input
                  id="poolUtilizationWarning"
                  type="number"
                  min="0"
                  max="100"
                  value={alertConfig.poolUtilization.warningThreshold}
                  onChange={(e) => {
                    updateConfig({
                      ...alertConfig,
                      poolUtilization: {
                        ...alertConfig.poolUtilization,
                        warningThreshold: Number(e.target.value)
                      }
                    })
                  }}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-sm"
                  disabled={!alertConfig.poolUtilization.enabled}
                />
              </div>

              <div>
                <label htmlFor="poolUtilizationCritical" className="block text-sm text-gray-600">
                  Critical Threshold (%)
                </label>
                <input
                  id="poolUtilizationCritical"
                  type="number"
                  min="0"
                  max="100"
                  value={alertConfig.poolUtilization.criticalThreshold}
                  onChange={(e) => {
                    updateConfig({
                      ...alertConfig,
                      poolUtilization: {
                        ...alertConfig.poolUtilization,
                        criticalThreshold: Number(e.target.value)
                      }
                    })
                  }}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-sm"
                  disabled={!alertConfig.poolUtilization.enabled}
                />
              </div>
            </div>
          </div>

          {/* Acquire Failures Configuration */}
          <div className="border-b border-gray-200 pb-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-md font-medium text-gray-700">Acquire Failures Alerts</h4>
              <div className="flex items-center">
                <span className="mr-2 text-sm text-gray-500">Enabled</span>
                <input
                  type="checkbox"
                  checked={alertConfig.acquireFailures.enabled}
                  onChange={(e) => {
                    updateConfig({
                      ...alertConfig,
                      acquireFailures: {
                        ...alertConfig.acquireFailures,
                        enabled: e.target.checked
                      }
                    })
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="acquireFailuresWarning" className="block text-sm text-gray-600">
                  Warning Threshold (%)
                </label>
                <input
                  id="acquireFailuresWarning"
                  type="number"
                  min="0"
                  max="100"
                  value={alertConfig.acquireFailures.warningThreshold}
                  onChange={(e) => {
                    updateConfig({
                      ...alertConfig,
                      acquireFailures: {
                        ...alertConfig.acquireFailures,
                        warningThreshold: Number(e.target.value)
                      }
                    })
                  }}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-sm"
                  disabled={!alertConfig.acquireFailures.enabled}
                />
              </div>

              <div>
                <label htmlFor="acquireFailuresCritical" className="block text-sm text-gray-600">
                  Critical Threshold (%)
                </label>
                <input
                  id="acquireFailuresCritical"
                  type="number"
                  min="0"
                  max="100"
                  value={alertConfig.acquireFailures.criticalThreshold}
                  onChange={(e) => {
                    updateConfig({
                      ...alertConfig,
                      acquireFailures: {
                        ...alertConfig.acquireFailures,
                        criticalThreshold: Number(e.target.value)
                      }
                    })
                  }}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-sm"
                  disabled={!alertConfig.acquireFailures.enabled}
                />
              </div>
            </div>
          </div>

          {/* Validation Failures Configuration */}
          <div className="border-b border-gray-200 pb-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-md font-medium text-gray-700">Validation Failures Alerts</h4>
              <div className="flex items-center">
                <span className="mr-2 text-sm text-gray-500">Enabled</span>
                <input
                  type="checkbox"
                  checked={alertConfig.validationFailures.enabled}
                  onChange={(e) => {
                    updateConfig({
                      ...alertConfig,
                      validationFailures: {
                        ...alertConfig.validationFailures,
                        enabled: e.target.checked
                      }
                    })
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="validationFailuresWarning" className="block text-sm text-gray-600">
                  Warning Threshold (%)
                </label>
                <input
                  id="validationFailuresWarning"
                  type="number"
                  min="0"
                  max="100"
                  value={alertConfig.validationFailures.warningThreshold}
                  onChange={(e) => {
                    updateConfig({
                      ...alertConfig,
                      validationFailures: {
                        ...alertConfig.validationFailures,
                        warningThreshold: Number(e.target.value)
                      }
                    })
                  }}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-sm"
                  disabled={!alertConfig.validationFailures.enabled}
                />
              </div>

              <div>
                <label htmlFor="validationFailuresCritical" className="block text-sm text-gray-600">
                  Critical Threshold (%)
                </label>
                <input
                  id="validationFailuresCritical"
                  type="number"
                  min="0"
                  max="100"
                  value={alertConfig.validationFailures.criticalThreshold}
                  onChange={(e) => {
                    updateConfig({
                      ...alertConfig,
                      validationFailures: {
                        ...alertConfig.validationFailures,
                        criticalThreshold: Number(e.target.value)
                      }
                    })
                  }}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-sm"
                  disabled={!alertConfig.validationFailures.enabled}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }, [alertConfig, showConfig, updateConfig])

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Connection Pool Alerts</h2>
        {showControls && (
          <div className="flex space-x-3">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="px-3 py-1 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              {showConfig ? 'Hide Config' : 'Show Config'}
            </button>
            <button
              onClick={toggleAlertService}
              className={`px-3 py-1 text-sm font-medium rounded-md ${
                activeAlertService
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {activeAlertService ? 'Stop Monitoring' : 'Start Monitoring'}
            </button>
          </div>
        )}
      </div>

      {renderConfigSection}

      <div className="mt-4">
        {alerts.length === 0 ? (
          <div className="text-center py-6 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No alerts to display</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map(alert => (
              <AlertItem
                key={alert.id}
                alert={alert}
                onAcknowledge={acknowledgeAlert}
                onClear={clearAlert}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(ConnectionPoolAlerts)
