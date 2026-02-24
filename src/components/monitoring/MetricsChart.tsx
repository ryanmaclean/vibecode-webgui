/**
 * Metrics Chart Component
 * Displays token usage visualization over time with interactive charts
 * Shows time-series data for AI request metrics including tokens, costs, and request counts
 */

'use client'

import { useEffect, useState, useCallback, useMemo, useId, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface TimeSeriesDataPoint {
  timestamp: string
  requestCount: number
  tokenCount: number
  cost: number
  errors: number
}

interface MetricsData {
  timestamp: string
  period: string
  startDate: string
  endDate: string
  overview: {
    totalRequests: number
    totalInputTokens: number
    totalOutputTokens: number
    totalTokens: number
    totalCost: number
    errorCount: number
    errorRate: number
    avgCostPerRequest: number
    avgTokensPerRequest: number
  }
  timeSeries: TimeSeriesDataPoint[]
}

interface MetricsChartProps {
  period?: '1h' | '6h' | '12h' | '24h' | '7d' | '30d'
  refreshInterval?: number
  className?: string
}

// Memoized summary metric component
interface MetricSummaryProps {
  label: string
  value: string
  subtext?: string
  colorClass: string
}

const MetricSummary = memo(function MetricSummary({
  label,
  value,
  subtext,
  colorClass
}: MetricSummaryProps) {
  return (
    <div className={`p-4 rounded-lg ${colorClass}`}>
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {subtext && <div className="text-xs text-gray-500 mt-1">{subtext}</div>}
    </div>
  )
})

// Memoized custom tooltip component
const CustomTooltip = memo(function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null

  const time = new Date(label).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })

  return (
    <div className="bg-white p-3 border rounded-lg shadow-lg">
      <p className="text-sm font-semibold mb-2">{time}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-medium">{entry.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
})

function MetricsChartInner({
  period = '24h',
  refreshInterval = 60000,
  className = ''
}: MetricsChartProps) {
  const gradientIdPrefix = useId().replace(/:/g, '-')
  const tokenGradientId = `${gradientIdPrefix}-colorTokens`

  const [data, setData] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Memoized fetch function
  const fetchMetrics = useCallback(async () => {
    try {
      const params = new URLSearchParams({ period })
      const res = await fetch(`/api/monitoring/ai-metrics?${params.toString()}`)

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
  }, [period])

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchMetrics, refreshInterval])

  // Memoize chart data transformation
  const chartData = useMemo(() => {
    if (!data) return []
    return data.timeSeries.map(point => ({
      time: point.timestamp,
      formattedTime: new Date(point.timestamp).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      }),
      tokens: point.tokenCount,
      requests: point.requestCount,
      cost: point.cost * 1000, // Convert to cents for better visualization
      errors: point.errors
    }))
  }, [data])

  // Memoize tick formatter callback
  const timeTickFormatter = useCallback((value: string) => {
    const date = new Date(value)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })
  }, [])

  // Memoize tooltip formatters
  const tokenFormatter = useCallback((value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return value.toLocaleString()
  }, [])

  const costFormatter = useCallback((value: number) => {
    return `$${(value / 1000).toFixed(4)}`
  }, [])

  // Memoize tooltip style
  const tooltipStyle = useMemo(() => ({
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid #e5e7eb',
    borderRadius: '8px'
  }), [])

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Token Usage Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div className="h-20 bg-gray-200 rounded"></div>
                <div className="h-20 bg-gray-200 rounded"></div>
                <div className="h-20 bg-gray-200 rounded"></div>
              </div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={`${className} border-red-300`}>
        <CardHeader>
          <CardTitle className="text-red-700">Token Usage Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-red-700">
            <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-semibold">Error Loading Metrics</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={fetchMetrics}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
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
          <CardTitle>Token Usage Metrics</CardTitle>
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {period}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricSummary
            label="Total Tokens"
            value={tokenFormatter(data.overview.totalTokens)}
            subtext={`${data.overview.totalRequests.toLocaleString()} requests`}
            colorClass="bg-gradient-to-br from-blue-50 to-blue-100 text-blue-900"
          />
          <MetricSummary
            label="Total Cost"
            value={`$${data.overview.totalCost.toFixed(4)}`}
            subtext={`$${data.overview.avgCostPerRequest.toFixed(4)} avg/request`}
            colorClass="bg-gradient-to-br from-green-50 to-green-100 text-green-900"
          />
          <MetricSummary
            label="Error Rate"
            value={`${(data.overview.errorRate * 100).toFixed(2)}%`}
            subtext={`${data.overview.errorCount} errors`}
            colorClass={`bg-gradient-to-br ${
              data.overview.errorRate > 0.1
                ? 'from-red-50 to-red-100 text-red-900'
                : 'from-gray-50 to-gray-100 text-gray-900'
            }`}
          />
        </div>

        {/* Token Usage Over Time Chart */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Token Usage Over Time</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={tokenGradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11 }}
                  tickFormatter={timeTickFormatter}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Tokens', angle: -90, position: 'insideLeft' }}
                  tickFormatter={tokenFormatter}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  content={<CustomTooltip />}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="tokens"
                  name="Tokens"
                  stroke="#3b82f6"
                  fill={`url(#${tokenGradientId})`}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Request Count Chart */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Request Volume</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11 }}
                  tickFormatter={timeTickFormatter}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Requests', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  content={<CustomTooltip />}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="requests"
                  name="Requests"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {lastUpdate && (
          <div className="text-xs text-gray-500 text-right">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export const MetricsChart = memo(MetricsChartInner)
