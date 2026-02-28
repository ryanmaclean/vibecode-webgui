'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { webSocketMonitor, WebSocketAlert } from '@/lib/monitoring/websocket-monitor'

interface WebSocketAlertsProps {
  showControls?: boolean
  className?: string
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  connection_limit: 'Connection Limit',
  high_utilization: 'High Utilization',
  high_latency: 'High Latency',
  connection_failures: 'Connection Failures',
  pending_backlog: 'Pending Backlog',
}

export default function WebSocketAlerts({
  showControls = false,
  className,
}: WebSocketAlertsProps) {
  const [alerts, setAlerts] = useState<WebSocketAlert[]>(webSocketMonitor.getActiveAlerts())
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set())
  const [showConfig, setShowConfig] = useState(false)

  const refreshAlerts = useCallback(() => {
    setAlerts([...webSocketMonitor.getActiveAlerts()])
  }, [])

  useEffect(() => {
    const handleAlertCreated = () => refreshAlerts()
    const handleAlertResolved = () => refreshAlerts()

    webSocketMonitor.on('alertCreated', handleAlertCreated)
    webSocketMonitor.on('alertResolved', handleAlertResolved)

    const interval = setInterval(refreshAlerts, 1000)

    return () => {
      webSocketMonitor.off('alertCreated', handleAlertCreated)
      webSocketMonitor.off('alertResolved', handleAlertResolved)
      clearInterval(interval)
    }
  }, [refreshAlerts])

  const handleAcknowledge = (alertId: string) => {
    setAcknowledgedAlerts(prev => new Set(prev).add(alertId))
  }

  const handleDismiss = (alertId: string) => {
    setAcknowledgedAlerts(prev => {
      const newSet = new Set(prev)
      newSet.delete(alertId)
      return newSet
    })
    refreshAlerts()
  }

  return (
    <div className={className}>
      {showControls && (
        <div className="mb-4 flex gap-2">
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
          <h4 className="mb-2 text-sm font-medium">WebSocket Alert Configuration</h4>
          <p className="text-xs text-muted-foreground">
            Alerts are automatically generated based on predefined thresholds for utilization,
            latency, failure rate, and pending requests.
          </p>
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
                alert.severity === 'critical'
                  ? 'border-red-500 bg-red-50'
                  : 'border-yellow-500 bg-yellow-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-sm font-medium">
                    {ALERT_TYPE_LABELS[alert.alert_type] || alert.alert_type}
                  </span>
                  {acknowledgedAlerts.has(alert.id) && (
                    <span className="ml-2 text-xs text-gray-500">
                      (Acknowledged)
                    </span>
                  )}
                  <p className="text-sm">{alert.message}</p>
                  <p className="mt-1 text-xs text-gray-600">
                    Pool: {alert.pool_name} | Threshold: {alert.threshold} | Current: {Math.round(alert.current_value)}
                  </p>
                </div>
                <div className="flex gap-1">
                  {!acknowledgedAlerts.has(alert.id) && (
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
