/**
 * Guardrail Monitor Component
 *
 * Real-time display of guardrail status with auto-refresh.
 * Shows current values, thresholds, and proximity indicators.
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Guardrail, GuardrailResult } from '@/lib/experiments/guardrails'

interface GuardrailMonitorProps {
  experimentKey: string
  guardrails: Guardrail[]
  autoRefreshMs?: number
  onViolation?: (result: GuardrailResult) => void
}

interface GuardrailStatus extends Guardrail {
  status: 'passing' | 'warning' | 'violated'
  currentValue?: number
  percentToThreshold: number
  lastChecked?: Date
}

export function GuardrailMonitor({
  experimentKey,
  guardrails,
  autoRefreshMs = 60000,
  onViolation
}: GuardrailMonitorProps) {
  const [guardrailStatuses, setGuardrailStatuses] = useState<GuardrailStatus[]>([])
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [isLoading, setIsLoading] = useState(false)

  // Fetch guardrail status
  const fetchGuardrailStatus = async () => {
    setIsLoading(true)

    try {
      const response = await fetch(`/api/experiments/${experimentKey}/guardrails/check`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to check guardrails')
      }

      const result: GuardrailResult = await response.json()

      // Map guardrails to status
      const statuses: GuardrailStatus[] = guardrails.map((guardrail) => {
        const violation = [...result.violations, ...result.warnings].find(
          v => v.guardrail.metricName === guardrail.metricName
        )

        let status: 'passing' | 'warning' | 'violated' = 'passing'
        if (violation) {
          status = violation.severity === 'critical' ? 'violated' : 'warning'
        }

        return {
          ...guardrail,
          status,
          currentValue: violation?.currentValue,
          percentToThreshold: violation?.percentageDifference || 0,
          lastChecked: new Date()
        }
      })

      setGuardrailStatuses(statuses)
      setLastUpdate(new Date())

      // Call violation callback if needed
      if (onViolation && !result.passed) {
        onViolation(result)
      }

    } catch (error) {
      console.error('Failed to fetch guardrail status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-refresh effect
  useEffect(() => {
    fetchGuardrailStatus()

    const interval = setInterval(fetchGuardrailStatus, autoRefreshMs)

    return () => clearInterval(interval)
  }, [experimentKey, autoRefreshMs])

  // Calculate time since last check
  const timeSinceLastCheck = () => {
    const seconds = Math.floor((Date.now() - lastUpdate.getTime()) / 1000)

    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    return `${Math.floor(seconds / 3600)}h ago`
  }

  // Render status icon
  const StatusIcon = ({ status }: { status: GuardrailStatus['status'] }) => {
    switch (status) {
      case 'passing':
        return <span className="text-green-600 text-lg">✓</span>
      case 'warning':
        return <span className="text-orange-600 text-lg">⚠️</span>
      case 'violated':
        return <span className="text-red-600 text-lg">✗</span>
    }
  }

  // Render progress bar showing proximity to threshold
  const ProximityBar = ({ status }: { status: GuardrailStatus }) => {
    if (status.currentValue === undefined) return null

    const proximity = Math.min(Math.abs(status.percentToThreshold), 100)
    const barColor =
      status.status === 'violated' ? 'bg-red-500' :
      status.status === 'warning' ? 'bg-orange-500' :
      'bg-green-500'

    return (
      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
        <div
          className={`${barColor} h-2 rounded-full transition-all duration-300`}
          style={{ width: `${proximity}%` }}
        />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Guardrail Monitor</CardTitle>
            <CardDescription>
              Real-time guardrail status for {experimentKey}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {timeSinceLastCheck()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchGuardrailStatus}
              disabled={isLoading}
            >
              {isLoading ? 'Checking...' : 'Refresh'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {guardrailStatuses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No guardrails to monitor</p>
          </div>
        ) : (
          <div className="space-y-3">
            {guardrailStatuses.map((status, index) => (
              <div
                key={index}
                className={`p-4 border rounded-lg ${
                  status.status === 'violated' ? 'border-red-300 bg-red-50' :
                  status.status === 'warning' ? 'border-orange-300 bg-orange-50' :
                  'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={status.status} />
                    <div>
                      <div className="font-medium text-sm">
                        {status.metricName.replace(/_/g, ' ')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Threshold: {status.operator} {status.threshold}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      variant={
                        status.status === 'violated' ? 'destructive' :
                        status.status === 'warning' ? 'default' :
                        'outline'
                      }
                      className={
                        status.status === 'passing' ? 'bg-green-50 text-green-700 border-green-200' : ''
                      }
                    >
                      {status.status.toUpperCase()}
                    </Badge>
                    {status.severity && (
                      <Badge
                        variant={status.severity === 'critical' ? 'destructive' : 'default'}
                        className="text-xs"
                      >
                        {status.severity}
                      </Badge>
                    )}
                  </div>
                </div>

                {status.currentValue !== undefined && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Current Value:</span>
                      <span className={`font-medium ${
                        status.status === 'violated' ? 'text-red-600' :
                        status.status === 'warning' ? 'text-orange-600' :
                        'text-green-600'
                      }`}>
                        {status.currentValue.toFixed(4)}
                      </span>
                    </div>
                    {status.percentToThreshold !== 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Difference:</span>
                        <span className={`font-medium ${
                          status.status === 'violated' ? 'text-red-600' :
                          status.status === 'warning' ? 'text-orange-600' :
                          ''
                        }`}>
                          {status.percentToThreshold > 0 ? '+' : ''}
                          {status.percentToThreshold.toFixed(1)}%
                        </span>
                      </div>
                    )}
                    <ProximityBar status={status} />
                  </div>
                )}

                {status.description && (
                  <div className="mt-2 text-xs text-muted-foreground italic">
                    {status.description}
                  </div>
                )}

                {status.lastChecked && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Last checked: {status.lastChecked.toLocaleTimeString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Auto-refresh: {(autoRefreshMs / 1000).toFixed(0)}s</span>
            <span>
              {guardrailStatuses.filter(s => s.status === 'passing').length} / {guardrailStatuses.length} passing
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
