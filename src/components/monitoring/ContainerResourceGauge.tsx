/**
 * Container Resource Gauge Component
 * Displays current resource usage with gauge visualization
 *
 * Container Resource Monitoring feature
 */

'use client'

import { useEffect, useState, useCallback, memo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, Activity, MemoryStick, Network, HardDrive } from 'lucide-react'

export type ResourceType = 'cpu' | 'memory' | 'network' | 'storage'

interface ContainerResourceGaugeProps {
  containerName: string
  resourceType: ResourceType
  refreshInterval?: number
  className?: string
}

interface ResourceMetrics {
  container: string
  resource_type: ResourceType
  current_value: number
  max_value: number
  utilization_percent: number
  unit: string
  status: 'healthy' | 'warning' | 'critical'
  timestamp: string
}

// Resource display configuration
const RESOURCE_CONFIG = {
  cpu: {
    title: 'CPU Usage',
    icon: Activity,
    color: '#3b82f6',
    warningThreshold: 70,
    criticalThreshold: 85
  },
  memory: {
    title: 'Memory Usage',
    icon: MemoryStick,
    color: '#8b5cf6',
    warningThreshold: 75,
    criticalThreshold: 90
  },
  network: {
    title: 'Network I/O',
    icon: Network,
    color: '#10b981',
    warningThreshold: 70,
    criticalThreshold: 85
  },
  storage: {
    title: 'Storage Usage',
    icon: HardDrive,
    color: '#f59e0b',
    warningThreshold: 80,
    criticalThreshold: 90
  }
} as const

const getStatusColor = (status: string) => {
  switch (status) {
    case 'healthy': return 'text-green-600'
    case 'warning': return 'text-yellow-600'
    case 'critical': return 'text-red-600'
    default: return 'text-gray-600'
  }
}

const getProgressColor = (utilization: number, config: typeof RESOURCE_CONFIG[ResourceType]) => {
  if (utilization >= config.criticalThreshold) return 'bg-red-500'
  if (utilization >= config.warningThreshold) return 'bg-yellow-500'
  return 'bg-green-500'
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'healthy': return 'secondary'
    case 'warning': return 'default'
    case 'critical': return 'destructive'
    default: return 'outline'
  }
}

function ContainerResourceGaugeInner({
  containerName,
  resourceType,
  refreshInterval = 5000,
  className = ''
}: ContainerResourceGaugeProps) {
  const [metrics, setMetrics] = useState<ResourceMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const config = RESOURCE_CONFIG[resourceType]
  const IconComponent = config.icon

  const fetchMetrics = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        container: containerName,
        resource: resourceType
      })

      const res = await fetch(`/api/monitoring/containers/current?${params}`)

      if (!res.ok) {
        throw new Error(`API returned ${res.status}: ${res.statusText}`)
      }

      const data = await res.json()
      setMetrics(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch resource metrics')
    } finally {
      setLoading(false)
    }
  }, [containerName, resourceType])

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchMetrics, refreshInterval])

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            <IconComponent className="h-4 w-4 mr-2" />
            {config.title}
          </CardTitle>
          <CardDescription>{containerName}</CardDescription>
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
          <CardTitle className="text-base text-red-700 flex items-center">
            <IconComponent className="h-4 w-4 mr-2" />
            {config.title}
          </CardTitle>
          <CardDescription>{containerName}</CardDescription>
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

  if (!metrics) {
    return null
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-base flex items-center">
              <IconComponent className="h-4 w-4 mr-2" style={{ color: config.color }} />
              {config.title}
            </CardTitle>
            <CardDescription>{containerName}</CardDescription>
          </div>
          <Badge variant={getStatusBadge(metrics.status)}>
            {metrics.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Value Display */}
        <div className="text-center">
          <div className={`text-4xl font-bold ${getStatusColor(metrics.status)}`}>
            {metrics.current_value.toFixed(1)}
            <span className="text-lg ml-1">{metrics.unit}</span>
          </div>
          <div className="text-sm text-gray-500 mt-1">
            of {metrics.max_value} {metrics.unit} max
          </div>
        </div>

        {/* Progress Gauge */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Utilization</span>
            <span className={`font-semibold ${getStatusColor(metrics.status)}`}>
              {metrics.utilization_percent}%
            </span>
          </div>
          <div className="relative">
            <Progress value={metrics.utilization_percent} className="h-3" />
            <div
              className={`absolute inset-0 h-3 rounded-full transition-all ${getProgressColor(metrics.utilization_percent, config)}`}
              style={{ width: `${Math.min(metrics.utilization_percent, 100)}%` }}
            />
          </div>
        </div>

        {/* Threshold Indicators */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
          <div className="text-xs">
            <div className="flex items-center text-yellow-600">
              <div className="w-2 h-2 rounded-full bg-yellow-500 mr-1" />
              <span>Warning: {config.warningThreshold}%</span>
            </div>
          </div>
          <div className="text-xs">
            <div className="flex items-center text-red-600">
              <div className="w-2 h-2 rounded-full bg-red-500 mr-1" />
              <span>Critical: {config.criticalThreshold}%</span>
            </div>
          </div>
        </div>

        {/* Status Warning */}
        {metrics.status !== 'healthy' && (
          <div className={`flex items-start p-2 rounded ${
            metrics.status === 'critical' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
          }`}>
            <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
            <span className="text-xs">
              {metrics.status === 'critical'
                ? 'Critical resource usage detected. Consider scaling or optimizing.'
                : 'Resource usage is approaching limits. Monitor closely.'}
            </span>
          </div>
        )}

        {/* Last Updated */}
        <div className="text-xs text-gray-500 text-center">
          Last updated: {new Date(metrics.timestamp).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  )
}

export const ContainerResourceGauge = memo(ContainerResourceGaugeInner)
