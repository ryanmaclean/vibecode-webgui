'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { aiUsageMonitor, AIUsageAlert } from '@/lib/monitoring/ai-usage-monitor'

interface AIUsageAlertsProps {
  showControls?: boolean
  className?: string
}

const ALERT_TYPE_LABELS: Record<AIUsageAlert['alert_type'], string> = {
  high_token_usage: 'High Token Usage',
  high_error_rate: 'High Error Rate',
  rate_limit_approaching: 'Rate Limit Approaching',
  high_cost: 'High Cost',
  slow_response: 'Slow Response',
}

export default function AIUsageAlerts({
  showControls = false,
  className,
}: AIUsageAlertsProps) {
  const [alerts, setAlerts] = useState<AIUsageAlert[]>(aiUsageMonitor.getActiveAlerts())
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set())
  const [showConfig, setShowConfig] = useState(false)

  const refreshAlerts = useCallback(() => {
    setAlerts([...aiUsageMonitor.getActiveAlerts()])
  }, [])

  useEffect(() => {
    const handleAlertCreated = () => refreshAlerts()
    const handleAlertResolved = () => refreshAlerts()
    const handleMetricsUpdated = () => refreshAlerts()

    aiUsageMonitor.on('alertCreated', handleAlertCreated)
    aiUsageMonitor.on('alertResolved', handleAlertResolved)
    aiUsageMonitor.on('metricsUpdated', handleMetricsUpdated)

    const interval = setInterval(refreshAlerts, 1000)

    return () => {
      aiUsageMonitor.off('alertCreated', handleAlertCreated)
      aiUsageMonitor.off('alertResolved', handleAlertResolved)
      aiUsageMonitor.off('metricsUpdated', handleMetricsUpdated)
      clearInterval(interval)
    }
  }, [refreshAlerts])

  const handleAcknowledge = (alertId: string) => {
    setAcknowledgedAlerts((prev) => new Set(prev).add(alertId))
  }

  const handleDismiss = (alertId: string) => {
    setAcknowledgedAlerts((prev) => {
      const next = new Set(prev)
      next.delete(alertId)
      return next
    })
    setAlerts((prev) => prev.filter((alert) => alert.id !== alertId))
  }

  const visibleAlerts = alerts.filter((alert) => !alert.resolved)

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
          <h4 className="mb-2 text-sm font-medium">Alert Thresholds</h4>
          <div className="space-y-2 text-sm">
            <p>Token Usage: 50k/min (warning), 100k/min (critical)</p>
            <p>Error Rate: 5% (warning), 15% (critical)</p>
            <p>Rate Limit: 70% (warning), 85% (critical)</p>
            <p>Cost: $10/hr (warning), $50/hr (critical)</p>
            <p>Response Time: 5s (warning), 15s (critical)</p>
          </div>
        </div>
      )}

      {visibleAlerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No alerts to display</p>
      ) : (
        <div className="space-y-2">
          {visibleAlerts.map((alert) => (
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
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {ALERT_TYPE_LABELS[alert.alert_type] || alert.alert_type}
                    </span>
                    <span className="text-xs text-gray-600">
                      {alert.provider_name} / {alert.model_name}
                    </span>
                  </div>
                  {acknowledgedAlerts.has(alert.id) && (
                    <span className="ml-2 text-xs text-gray-500">
                      (Acknowledged)
                    </span>
                  )}
                  <p className="text-sm">{alert.message}</p>
                  <p className="text-xs text-gray-600">
                    Threshold: {alert.threshold} | Current: {alert.current_value.toFixed(2)}
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
