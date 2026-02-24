/**
 * Latency Histogram Component
 * Displays response time distribution with histogram visualization
 * Shows latency breakdown by model with percentile metrics
 */

'use client'

import { useEffect, useState, useCallback, useMemo, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts'

interface LatencyHistogramBucket {
  range: string
  min: number
  max: number
  count: number
}

interface ModelLatencyStats {
  model: string
  requestCount: number
  avgLatency: number
  p95Latency: number
}

interface LatencyData {
  timestamp: string
  period: string
  latency: {
    avgLatency: number
    p50Latency: number
    p95Latency: number
    p99Latency: number
    minLatency: number
    maxLatency: number
    histogram: LatencyHistogramBucket[]
  }
  byModel: ModelLatencyStats[]
}

interface LatencyHistogramProps {
  period?: '1h' | '6h' | '12h' | '24h' | '7d' | '30d'
  refreshInterval?: number
  className?: string
}

// Memoized latency metric component
interface LatencyMetricProps {
  label: string
  value: string
  colorClass: string
}

const LatencyMetric = memo(function LatencyMetric({
  label,
  value,
  colorClass
}: LatencyMetricProps) {
  return (
    <div className={`p-3 rounded-lg ${colorClass}`}>
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  )
})

// Memoized custom tooltip component
const CustomTooltip = memo(function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null

  return (
    <div className="bg-white p-3 border rounded-lg shadow-lg">
      <p className="text-sm font-semibold mb-2">{payload[0].payload.range}</p>
      <div className="flex items-center gap-2 text-sm">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: payload[0].color }}
        />
        <span className="text-gray-600">Requests:</span>
        <span className="font-medium">{payload[0].value.toLocaleString()}</span>
      </div>
    </div>
  )
})

// Memoized model breakdown row component
interface ModelRowProps {
  model: string
  avgLatency: number
  p95Latency: number
  requestCount: number
}

const ModelRow = memo(function ModelRow({
  model,
  avgLatency,
  p95Latency,
  requestCount
}: ModelRowProps) {
  const formatLatency = (ms: number) => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
    return `${ms.toFixed(0)}ms`
  }

  return (
    <tr className="border-b last:border-b-0 hover:bg-gray-50 transition-colors">
      <td className="py-2 px-3 text-sm font-medium text-gray-900">{model}</td>
      <td className="py-2 px-3 text-sm text-gray-600 text-right">
        {requestCount.toLocaleString()}
      </td>
      <td className="py-2 px-3 text-sm text-gray-600 text-right">
        {formatLatency(avgLatency)}
      </td>
      <td className="py-2 px-3 text-sm text-gray-600 text-right">
        {formatLatency(p95Latency)}
      </td>
    </tr>
  )
})

function LatencyHistogramInner({
  period = '24h',
  refreshInterval = 60000,
  className = ''
}: LatencyHistogramProps) {
  const [data, setData] = useState<LatencyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Memoized fetch function
  const fetchLatencyData = useCallback(async () => {
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
      setError(err instanceof Error ? err.message : 'Failed to fetch latency data')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchLatencyData()
    const interval = setInterval(fetchLatencyData, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchLatencyData, refreshInterval])

  // Get color based on latency range (defined before use in histogramData)
  const getBarColor = useCallback((minLatency: number): string => {
    if (minLatency < 500) return '#10b981' // green - fast
    if (minLatency < 2000) return '#f59e0b' // yellow - moderate
    return '#ef4444' // red - slow
  }, [])

  // Memoize histogram chart data
  const histogramData = useMemo(() => {
    if (!data?.latency?.histogram) return []
    return data.latency.histogram.map(bucket => ({
      range: bucket.range,
      count: bucket.count,
      fill: getBarColor(bucket.min)
    }))
  }, [data, getBarColor])

  // Memoize latency formatter
  const formatLatency = useCallback((ms: number) => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
    return `${ms.toFixed(0)}ms`
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
          <CardTitle>Response Latency Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="h-16 bg-gray-200 rounded"></div>
              <div className="h-16 bg-gray-200 rounded"></div>
              <div className="h-16 bg-gray-200 rounded"></div>
              <div className="h-16 bg-gray-200 rounded"></div>
            </div>
            <div className="h-64 bg-gray-200 rounded mb-4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={`${className} border-red-300`}>
        <CardHeader>
          <CardTitle className="text-red-700">Response Latency Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-red-700">
            <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-semibold">Error Loading Latency Data</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={fetchLatencyData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </CardContent>
      </Card>
    )
  }

  if (!data?.latency) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Response Latency Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <svg className="mx-auto h-12 w-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-sm">No latency data available for the selected period</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Response Latency Distribution</CardTitle>
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            {period}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Percentile Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <LatencyMetric
            label="P50 (Median)"
            value={formatLatency(data.latency.p50Latency)}
            colorClass="bg-gradient-to-br from-green-50 to-green-100 text-green-900"
          />
          <LatencyMetric
            label="P95"
            value={formatLatency(data.latency.p95Latency)}
            colorClass="bg-gradient-to-br from-yellow-50 to-yellow-100 text-yellow-900"
          />
          <LatencyMetric
            label="P99"
            value={formatLatency(data.latency.p99Latency)}
            colorClass="bg-gradient-to-br from-orange-50 to-orange-100 text-orange-900"
          />
          <LatencyMetric
            label="Average"
            value={formatLatency(data.latency.avgLatency)}
            colorClass="bg-gradient-to-br from-blue-50 to-blue-100 text-blue-900"
          />
        </div>

        {/* Histogram Chart */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Latency Distribution</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="range"
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
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
                <Bar
                  dataKey="count"
                  name="Request Count"
                  radius={[4, 4, 0, 0]}
                >
                  {histogramData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Model Breakdown */}
        {data.byModel && data.byModel.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Latency by Model</h4>
            <div className="overflow-hidden border rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Model
                    </th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Requests
                    </th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Avg Latency
                    </th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      P95 Latency
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.byModel.map((modelStats) => (
                    <ModelRow
                      key={modelStats.model}
                      model={modelStats.model}
                      avgLatency={modelStats.avgLatency}
                      p95Latency={modelStats.p95Latency}
                      requestCount={modelStats.requestCount}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {lastUpdate && (
          <div className="text-xs text-gray-500 text-right">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export const LatencyHistogram = memo(LatencyHistogramInner)
