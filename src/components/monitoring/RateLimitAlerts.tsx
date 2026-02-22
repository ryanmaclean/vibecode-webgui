'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { rateLimitMonitor, RateLimitAlert } from '@/lib/monitoring/rate-limit-monitor'

interface RateLimitAlertsProps {
  showControls?: boolean
  className?: string
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  'limit_exceeded': 'Limit Exceeded',
  'high_utilization': 'High Utilization',
  'burst_detected': 'Burst Detected',
  'client_throttled': 'Client Throttled',
}

const SEVERITY_COLORS = {
  critical: {
    border: 'border-red-500',
    bg: 'bg-red-50',
  },
  warning: {
    border: 'border-yellow-500',
    bg: 'bg-yellow-50',
  },
}

export default function RateLimitAlerts({
  showControls = false,
  className,
}: RateLimitAlertsProps) {
  const [alerts, setAlerts] = useState<RateLimitAlert[]>(rateLimitMonitor.getActiveAlerts())
  const [monitoring, setMonitoring] = useState(true)
  const [showConfig, setShowConfig] = useState(false)

  const [utilizationWarning, setUtilizationWarning] = useState(70)
  const [utilizationCritical, setUtilizationCritical] = useState(85)

  const refreshAlerts = useCallback(() => {
    setAlerts([...rateLimitMonitor.getActiveAlerts()])
  }, [])

  useEffect(() => {
    const listener = () => refreshAlerts()
    rateLimitMonitor.on('alertCreated', listener)
    rateLimitMonitor.on('alertResolved', listener)
    const interval = setInterval(refreshAlerts, 1000)
    return () => {
      rateLimitMonitor.off('alertCreated', listener)
      rateLimitMonitor.off('alertResolved', listener)
      clearInterval(interval)
    }
  }, [refreshAlerts])

  const handleStartMonitoring = () => {
    setMonitoring(true)
  }

  const handleStopMonitoring = () => {
    rateLimitMonitor.stopMonitoring()
    setMonitoring(false)
  }

  const handleAcknowledge = (alertId: string) => {
    const updatedAlerts = alerts.map(alert =>
      alert.id === alertId ? { ...alert, resolved: true } : alert
    )
    setAlerts(updatedAlerts)
  }

  const handleDismiss = (alertId: string) => {
    const updatedAlerts = alerts.filter(alert => alert.id !== alertId)
    setAlerts(updatedAlerts)
  }

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
          <h4 className="mb-2 text-sm font-medium">Rate Limit Utilization</h4>
          <div className="flex gap-4">
            <label className="text-sm">
              <span id="utilizationWarningLabel">Warning Threshold (%)</span>
              <input
                id="utilizationWarning"
                aria-label="Warning Threshold (%)"
                type="number"
                value={utilizationWarning}
                onChange={(e) =>
                  setUtilizationWarning(Number(e.target.value))
                }
                className="ml-2 w-16 rounded border px-1"
              />
            </label>
            <label className="text-sm">
              <span id="utilizationCriticalLabel">Critical Threshold (%)</span>
              <input
                id="utilizationCritical"
                aria-label="Critical Threshold (%)"
                type="number"
                value={utilizationCritical}
                onChange={(e) =>
                  setUtilizationCritical(Number(e.target.value))
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
                SEVERITY_COLORS[alert.severity]?.border || 'border-blue-500'
              } ${
                SEVERITY_COLORS[alert.severity]?.bg || 'bg-blue-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-sm font-medium">
                    {ALERT_TYPE_LABELS[alert.alert_type] || alert.alert_type}
                  </span>
                  {alert.resolved && (
                    <span className="ml-2 text-xs text-gray-500">
                      (Acknowledged)
                    </span>
                  )}
                  <p className="text-sm">{alert.message}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Limiter: {alert.limiter_name} | Threshold: {alert.threshold} | Current: {alert.current_value}
                  </p>
                </div>
                <div className="flex gap-1">
                  {!alert.resolved && (
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
