/**
 * LLM Latency Chart Component
 * Displays real-time LLM latency metrics with line chart visualization
 *
 * LLM Operations Dashboard feature (Task 012)
 */

'use client'

import { useEffect, useState, useCallback, useMemo, memo } from 'react'
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

interface LatencyDataPoint {
  timestamp: string
  p50: number
  p95: number
  p99: number
  avg: number
}

interface LatencyMetrics {
  timeRange: string
  timestamp: string
  metrics: {
    avgLatency: number
    p50Latency: number
    p95Latency: number
    p99Latency: number
    minLatency: number
    maxLatency: number
  }
  dataPoints: LatencyDataPoint[]
}

interface LLMLatencyChartProps {
  timeRange?: '1h' | '6h' | '24h' | '7d'
  refreshInterval?: number
  className?: string
  modelId?: string
}

function LLMLatencyChartInner({
  timeRange = '1h',
  refreshInterval = 60000,
  className = '',
  modelId
}: LLMLatencyChartProps) {
  const [data, setData] = useState<LatencyMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Memoized fetch function
  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ timeframe: timeRange })
      if (modelId) {
        params.append('model', modelId)
      }

      const res = await fetch(`/api/monitoring/llm-latency?${params.toString()}`)

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
  }, [timeRange, modelId])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchData, refreshInterval])

  // Memoize chart data transformation - must be before early returns to follow React hooks rules
  const chartData = useMemo(() => {
    if (!data) return []
    return data.dataPoints.map(point => ({
      time: new Date(point.timestamp).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      }),
      avg: point.avg,
      p50: point.p50,
      p95: point.p95,
      p99: point.p99
    }))
  }, [data])

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 border ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 border border-red-300 ${className}`}>
        <div className="flex items-center text-red-700 mb-2">
          <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <h3 className="font-semibold">Error Loading Latency Data</h3>
        </div>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className={`bg-white rounded-lg shadow border ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">LLM Response Latency</h3>
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            {timeRange}
          </div>
        </div>

        {/* Metrics Summary */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">Average</div>
            <div className="text-lg font-semibold text-gray-900">
              {data.metrics.avgLatency}ms
            </div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">P50 (Median)</div>
            <div className="text-lg font-semibold text-blue-900">
              {data.metrics.p50Latency}ms
            </div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">P95 Latency</div>
            <div className="text-lg font-semibold text-orange-900">
              {data.metrics.p95Latency}ms
            </div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">P99 (Max)</div>
            <div className="text-lg font-semibold text-red-900">
              {data.metrics.p99Latency}ms
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="avg"
                stroke="#6b7280"
                strokeWidth={1.5}
                dot={false}
                name="Average"
              />
              <Line
                type="monotone"
                dataKey="p50"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="P50 (Median)"
              />
              <Line
                type="monotone"
                dataKey="p95"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ r: 2 }}
                name="P95"
              />
              <Line
                type="monotone"
                dataKey="p99"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                name="P99"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Additional Metrics */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500 mb-1">Min Latency</div>
              <div className="font-semibold text-gray-900">
                {data.metrics.minLatency}ms
              </div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Max Latency</div>
              <div className="font-semibold text-gray-900">
                {data.metrics.maxLatency}ms
              </div>
            </div>
          </div>
          {lastUpdate && (
            <div className="mt-3 text-xs text-gray-400">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const LLMLatencyChart = memo(LLMLatencyChartInner)
