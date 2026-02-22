/**
 * Container Metrics Chart Component
 * Displays real-time time-series visualization of container resource metrics
 *
 * Container Resource Monitoring feature
 */

'use client'

import { useEffect, useState, useCallback, useMemo, memo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

export type MetricType = 'cpu' | 'memory' | 'network' | 'storage'

interface ContainerMetricsChartProps {
  containerName: string
  metric: MetricType
  timeRange?: '1h' | '6h' | '24h' | '7d'
  refreshInterval?: number
  className?: string
}

interface MetricDataPoint {
  timestamp: string
  value: number
}

interface MetricsData {
  container: string
  metric: string
  datapoints: MetricDataPoint[]
  unit: string
}

// Metric display configuration
const METRIC_CONFIG = {
  cpu: {
    title: 'CPU Usage',
    color: '#3b82f6',
    unit: '%',
    yAxisLabel: 'CPU Usage (%)'
  },
  memory: {
    title: 'Memory Usage',
    color: '#8b5cf6',
    unit: 'MB',
    yAxisLabel: 'Memory (MB)'
  },
  network: {
    title: 'Network I/O',
    color: '#10b981',
    unit: 'MB/s',
    yAxisLabel: 'Network (MB/s)'
  },
  storage: {
    title: 'Storage Usage',
    color: '#f59e0b',
    unit: 'GB',
    yAxisLabel: 'Storage (GB)'
  }
} as const

// Memoized CustomTooltip component
const CustomTooltip = memo(function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null

  const time = new Date(label).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  })

  return (
    <div className="bg-white p-3 border rounded shadow-lg">
      <p className="text-sm font-medium mb-2">{time}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 text-sm">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">{entry.value.toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
})

function ContainerMetricsChartInner({
  containerName,
  metric,
  timeRange = '1h',
  refreshInterval = 30000,
  className = ''
}: ContainerMetricsChartProps) {
  const [data, setData] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Get metric configuration
  const config = METRIC_CONFIG[metric]

  // Memoized fetch function
  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        container: containerName,
        metric,
        duration: timeRange
      })

      const res = await fetch(`/api/monitoring/containers/history?${params}`)

      if (!res.ok) {
        throw new Error(`API returned ${res.status}: ${res.statusText}`)
      }

      const json = await res.json()
      setData(json)
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics data')
    } finally {
      setLoading(false)
    }
  }, [containerName, metric, timeRange])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchData, refreshInterval])

  // Memoize chart data transformation
  const chartData = useMemo(() => {
    if (!data) return []
    return data.datapoints.map(point => ({
      time: point.timestamp,
      value: point.value,
      formattedTime: new Date(point.timestamp).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      })
    }))
  }, [data])

  // Memoize current value
  const currentValue = useMemo(() => {
    if (!chartData.length) return null
    return chartData[chartData.length - 1].value
  }, [chartData])

  // Memoize tick formatter callback
  const tickFormatter = useCallback((value: string) => {
    const date = new Date(value)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })
  }, [])

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">{config.title}</CardTitle>
          <CardDescription>{containerName}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={`${className} border-red-300`}>
        <CardHeader>
          <CardTitle className="text-base text-red-700">{config.title}</CardTitle>
          <CardDescription>{containerName}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-red-700">
            <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return null
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{config.title}</CardTitle>
            <CardDescription>{containerName}</CardDescription>
          </div>
          {currentValue !== null && (
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">Current</div>
              <div className="text-lg font-semibold text-gray-900">
                {currentValue.toFixed(2)} {data.unit}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 12 }}
                tickFormatter={tickFormatter}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                label={{ value: config.yAxisLabel, angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="value"
                name={config.title}
                stroke={config.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {lastUpdate && (
          <div className="mt-4 text-xs text-gray-500 text-right">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export const ContainerMetricsChart = memo(ContainerMetricsChartInner)
