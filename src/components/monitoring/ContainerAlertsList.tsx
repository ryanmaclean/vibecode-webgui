/**
 * Container Alerts List Component
 * Displays active alerts for containers approaching resource limits
 *
 * Container Resource Monitoring feature
 */

'use client'

import { useEffect, useState, useCallback, memo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, AlertTriangle, Activity, MemoryStick } from 'lucide-react'

interface ContainerAlert {
  container: string
  severity: 'warning' | 'critical'
  metrics: {
    cpu?: {
      current: number
      threshold: number
    }
    memory?: {
      current: number
      threshold: number
    }
  }
}

interface ContainerAlertsListProps {
  refreshInterval?: number
  className?: string
}

const getSeverityConfig = (severity: 'warning' | 'critical') => {
  if (severity === 'critical') {
    return {
      color: 'text-red-700',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-300',
      badge: 'destructive' as const,
      icon: AlertCircle,
    }
  }
  return {
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-300',
    badge: 'default' as const,
    icon: AlertTriangle,
  }
}

function ContainerAlertsListInner({
  refreshInterval = 30000,
  className = ''
}: ContainerAlertsListProps) {
  const [alerts, setAlerts] = useState<ContainerAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/monitoring/containers')

      if (!res.ok) {
        throw new Error(`API returned ${res.status}: ${res.statusText}`)
      }

      const data = await res.json()
      setAlerts(data.alerts || [])
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch container alerts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
    const interval = setInterval(fetchAlerts, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchAlerts, refreshInterval])

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">Container Alerts</CardTitle>
          <CardDescription>Active resource warnings and critical alerts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={`${className} border-red-300`}>
        <CardHeader>
          <CardTitle className="text-base text-red-700">Container Alerts</CardTitle>
          <CardDescription>Active resource warnings and critical alerts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-red-700">
            <AlertCircle className="h-5 w-5 mr-2" />
            <p className="text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Container Alerts</CardTitle>
            <CardDescription>Active resource warnings and critical alerts</CardDescription>
          </div>
          {alerts.length > 0 && (
            <Badge variant="destructive">{alerts.length}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <div className="flex justify-center mb-2">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <p className="text-sm text-gray-600 font-medium">All containers healthy</p>
            <p className="text-xs text-gray-500 mt-1">No resource alerts at this time</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert, index) => {
              const config = getSeverityConfig(alert.severity)
              const IconComponent = config.icon

              return (
                <div
                  key={`${alert.container}-${index}`}
                  className={`rounded-lg border p-4 ${config.borderColor} ${config.bgColor}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center">
                      <IconComponent className={`h-5 w-5 mr-2 ${config.color}`} />
                      <div>
                        <h4 className={`text-sm font-semibold ${config.color}`}>
                          {alert.container}
                        </h4>
                        <Badge variant={config.badge} className="text-xs mt-1">
                          {alert.severity.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {alert.metrics.cpu && (
                      <div className="flex items-center text-sm">
                        <Activity className={`h-4 w-4 mr-2 ${config.color}`} />
                        <span className="text-gray-700 flex-1">
                          CPU Usage:
                          <span className={`ml-2 font-semibold ${config.color}`}>
                            {alert.metrics.cpu.current.toFixed(1)}%
                          </span>
                          <span className="text-gray-500 ml-1 text-xs">
                            (threshold: {alert.metrics.cpu.threshold}%)
                          </span>
                        </span>
                      </div>
                    )}

                    {alert.metrics.memory && (
                      <div className="flex items-center text-sm">
                        <MemoryStick className={`h-4 w-4 mr-2 ${config.color}`} />
                        <span className="text-gray-700 flex-1">
                          Memory Usage:
                          <span className={`ml-2 font-semibold ${config.color}`}>
                            {alert.metrics.memory.current.toFixed(1)}%
                          </span>
                          <span className="text-gray-500 ml-1 text-xs">
                            (threshold: {alert.metrics.memory.threshold}%)
                          </span>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className={`mt-3 pt-3 border-t ${config.borderColor}`}>
                    <p className={`text-xs ${config.color}`}>
                      {alert.severity === 'critical'
                        ? '⚠️ Immediate action required. Container resources critically constrained.'
                        : '⚡ Monitor closely. Container approaching resource limits.'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {lastUpdate && (
          <div className="mt-4 text-xs text-gray-500 text-center">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export const ContainerAlertsList = memo(ContainerAlertsListInner)
