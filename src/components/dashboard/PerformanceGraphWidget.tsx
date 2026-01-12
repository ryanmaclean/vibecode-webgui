/**
 * Performance Graph Widget Component
 * Displays real-time performance metrics with line chart visualization
 *
 * Enhanced Monitoring Dashboards feature (AGENT 97)
 */

'use client'

import { useEffect, useState } from 'react'
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

interface PerformanceDataPoint {
  timestamp: string
  latency: number
  requests: number
}

interface PerformanceMetrics {
  timeRange: string
  timestamp: string
  metrics: {
    requests: number
    avgLatency: number
    errorRate: number
    p95Latency: number
    p99Latency: number
  }
  dataPoints: PerformanceDataPoint[]
}

interface PerformanceGraphWidgetProps {
  timeRange?: '1h' | '6h' | '24h' | '7d'
  refreshInterval?: number
  className?: string
}

export function PerformanceGraphWidget({
  timeRange = '1h',
  refreshInterval = 60000,
  className = ''
}: PerformanceGraphWidgetProps) {
  const [data, setData] = useState<PerformanceMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/dashboard/performance?range=${timeRange}`)

        if (!res.ok) {
          throw new Error(`API returned ${res.status}: ${res.statusText}`)
        }

        const json = await res.json()
        setData(json)
        setLastUpdate(new Date())
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch performance data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [timeRange, refreshInterval])

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
          <h3 className="font-semibold">Error Loading Performance Data</h3>
        </div>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  if (!data) {
    return null
  }

  // Format data points for chart
  const chartData = data.dataPoints.map(point => ({
    time: new Date(point.timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    }),
    latency: point.latency,
    requests: point.requests
  }))

  return (
    <div className={`bg-white rounded-lg shadow border ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Performance Trends</h3>
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            {timeRange}
          </div>
        </div>

        {/* Metrics Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">Average</div>
            <div className="text-lg font-semibold text-gray-900">
              {data.metrics.avgLatency}ms
            </div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">P95 Latency</div>
            <div className="text-lg font-semibold text-gray-900">
              {data.metrics.p95Latency}ms
            </div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">Max (P99)</div>
            <div className="text-lg font-semibold text-gray-900">
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
                dataKey="latency"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                name="Response Time (ms)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Additional Metrics */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500 mb-1">Total Requests</div>
              <div className="font-semibold text-gray-900">
                {data.metrics.requests.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Error Rate</div>
              <div className="font-semibold text-gray-900">
                {data.metrics.errorRate.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>

        {lastUpdate && (
          <div className="mt-4 text-xs text-gray-500 text-right">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  )
}
