/**
 * LLM Operations Metrics Component
 * Displays LLM operational metrics including latency, error rates, and performance
 *
 * Enhanced Monitoring Dashboards feature (AGENT 97)
 */

'use client'

import { useEffect, useState, useCallback, useMemo, memo } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts'

interface LatencyMetrics {
  p50: number
  p95: number
  p99: number
  avg: number
  max: number
}

interface ModelMetrics {
  name: string
  requests: number
  successRate: number
  errorRate: number
  latency: LatencyMetrics
  tokensPerSecond: number
  cost: number
}

interface TimeSeriesPoint {
  timestamp: string
  requests: number
  errors: number
  avgLatency: number
  tokens: number
}

interface LLMOpsData {
  timestamp: string
  timeRange: string
  totalRequests: number
  totalErrors: number
  successRate: number
  errorRate: number
  overallLatency: LatencyMetrics
  models: ModelMetrics[]
  timeSeries: TimeSeriesPoint[]
  alertsActive: number
  healthStatus: 'healthy' | 'degraded' | 'critical'
}

interface LLMOpsMetricsProps {
  refreshInterval?: number
  className?: string
}

const STATUS_COLORS = {
  healthy: 'bg-green-100 text-green-800',
  degraded: 'bg-yellow-100 text-yellow-800',
  critical: 'bg-red-100 text-red-800'
}

const STATUS_LABELS = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  critical: 'Critical'
}

// Memoized model metrics item component
interface ModelMetricsItemProps {
  model: ModelMetrics
}

const ModelMetricsItem = memo(function ModelMetricsItem({ model }: ModelMetricsItemProps) {
  const successRateColor = model.successRate >= 99 ? 'text-green-600' : model.successRate >= 95 ? 'text-yellow-600' : 'text-red-600'
  const latencyColor = model.latency.p95 < 1000 ? 'text-green-600' : model.latency.p95 < 2000 ? 'text-yellow-600' : 'text-red-600'

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex-1">
        <div className="font-medium text-gray-900">{model.name}</div>
        <div className="text-xs text-gray-500 mt-1">
          {model.requests.toLocaleString()} requests • ${model.cost.toFixed(2)} cost
        </div>
      </div>
      <div className="flex gap-4 text-right">
        <div>
          <div className="text-xs text-gray-500">Success Rate</div>
          <div className={`text-sm font-semibold ${successRateColor}`}>
            {model.successRate.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">P95 Latency</div>
          <div className={`text-sm font-semibold ${latencyColor}`}>
            {model.latency.p95}ms
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Tokens/sec</div>
          <div className="text-sm font-semibold text-gray-900">
            {model.tokensPerSecond.toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  )
})

// Memoized metric card component
interface MetricCardProps {
  label: string
  value: string | number
  subtext?: string
  colorClass: string
}

const MetricCard = memo(function MetricCard({ label, value, subtext, colorClass }: MetricCardProps) {
  return (
    <div className={`text-center p-3 rounded-lg ${colorClass}`}>
      <div className="text-xs mb-1 opacity-75">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {subtext && <div className="text-xs mt-1 opacity-75">{subtext}</div>}
    </div>
  )
})

function LLMOpsMetricsInner({
  refreshInterval = 60000,
  className = ''
}: LLMOpsMetricsProps) {
  const [data, setData] = useState<LLMOpsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Memoized fetch function to prevent recreation on every render
  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/monitoring/llm-ops')

      if (!res.ok) {
        throw new Error(`API returned ${res.status}: ${res.statusText}`)
      }

      const json = await res.json()
      setData(json)
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch LLM operations metrics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchMetrics, refreshInterval])

  // All hooks must be called before any early returns (React Rules of Hooks)
  // Memoize chart data transformations to prevent recalculation on every render
  const latencyChartData = useMemo(() => {
    if (!data) return []
    return data.timeSeries.map(point => ({
      time: new Date(point.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      latency: point.avgLatency,
      requests: point.requests
    }))
  }, [data])

  const errorRateChartData = useMemo(() => {
    if (!data) return []
    return data.timeSeries.map(point => ({
      time: new Date(point.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      errors: point.errors,
      errorRate: point.requests > 0 ? (point.errors / point.requests) * 100 : 0
    }))
  }, [data])

  const modelComparisonData = useMemo(() => {
    if (!data) return []
    return data.models.map(model => ({
      name: model.name.replace(/^(gpt-|claude-|llama-)/, ''),
      successRate: model.successRate,
      p95Latency: model.latency.p95,
      tokensPerSec: model.tokensPerSecond
    }))
  }, [data])

  // Memoize tooltip formatter to prevent recreation on every render
  const tooltipFormatter = useCallback((value: string | number | (string | number)[]) => {
    if (typeof value === 'number') return value.toFixed(2)
    return String(value)
  }, [])

  // Memoize tooltip style object to prevent object recreation
  const tooltipStyle = useMemo(() => ({
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid #ccc',
    borderRadius: '4px'
  }), [])

  // Memoize status badge class
  const statusBadgeClass = useMemo(() => {
    if (!data) return STATUS_COLORS.healthy
    return STATUS_COLORS[data.healthStatus]
  }, [data])

  // Early returns after all hooks have been called
  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 border ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-48 bg-gray-200 rounded"></div>
          </div>
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
          <h3 className="font-semibold">Error Loading LLM Metrics</h3>
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
          <h3 className="text-lg font-semibold text-gray-900">LLM Operations</h3>
          <div className="flex items-center gap-2">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusBadgeClass}`}>
              {STATUS_LABELS[data.healthStatus]}
            </div>
            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
              {data.timeRange}
            </div>
          </div>
        </div>

        {/* Alerts Banner */}
        {data.alertsActive > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center">
            <svg className="h-5 w-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium text-yellow-800">
              {data.alertsActive} active {data.alertsActive === 1 ? 'alert' : 'alerts'}
            </span>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <MetricCard
            label="Total Requests"
            value={data.totalRequests.toLocaleString()}
            colorClass="bg-gradient-to-br from-blue-50 to-blue-100 text-blue-900"
          />
          <MetricCard
            label="Success Rate"
            value={`${data.successRate.toFixed(2)}%`}
            colorClass={data.successRate >= 99 ? "bg-gradient-to-br from-green-50 to-green-100 text-green-900" : "bg-gradient-to-br from-yellow-50 to-yellow-100 text-yellow-900"}
          />
          <MetricCard
            label="Error Rate"
            value={`${data.errorRate.toFixed(2)}%`}
            subtext={`${data.totalErrors} errors`}
            colorClass={data.errorRate < 1 ? "bg-gradient-to-br from-green-50 to-green-100 text-green-900" : "bg-gradient-to-br from-red-50 to-red-100 text-red-900"}
          />
          <MetricCard
            label="P95 Latency"
            value={`${data.overallLatency.p95}ms`}
            subtext={`avg: ${data.overallLatency.avg}ms`}
            colorClass={data.overallLatency.p95 < 1000 ? "bg-gradient-to-br from-green-50 to-green-100 text-green-900" : "bg-gradient-to-br from-orange-50 to-orange-100 text-orange-900"}
          />
        </div>

        {/* Latency Percentiles */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Latency Distribution</h4>
          <div className="grid grid-cols-5 gap-3">
            <div>
              <div className="text-xs text-gray-500">P50</div>
              <div className="text-lg font-semibold text-gray-900">{data.overallLatency.p50}ms</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">P95</div>
              <div className="text-lg font-semibold text-gray-900">{data.overallLatency.p95}ms</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">P99</div>
              <div className="text-lg font-semibold text-gray-900">{data.overallLatency.p99}ms</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Average</div>
              <div className="text-lg font-semibold text-gray-900">{data.overallLatency.avg}ms</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Max</div>
              <div className="text-lg font-semibold text-gray-900">{data.overallLatency.max}ms</div>
            </div>
          </div>
        </div>

        {/* Latency Over Time Chart */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Latency Trend</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={latencyChartData}>
                <defs>
                  <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 11 }} label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={tooltipFormatter}
                />
                <Area
                  type="monotone"
                  dataKey="latency"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorLatency)"
                  name="Avg Latency (ms)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Error Rate Over Time Chart */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Error Rate Trend</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={errorRateChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Errors', angle: -90, position: 'insideLeft' }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Error Rate %', angle: 90, position: 'insideRight' }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={tooltipFormatter}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="errors"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="Error Count"
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="errorRate"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Error Rate %"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Model Performance Comparison */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Model Performance Comparison</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modelComparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Success Rate %', angle: -90, position: 'insideLeft' }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  label={{ value: 'P95 Latency (ms)', angle: 90, position: 'insideRight' }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={tooltipFormatter}
                />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="successRate"
                  fill="#10b981"
                  name="Success Rate %"
                />
                <Bar
                  yAxisId="right"
                  dataKey="p95Latency"
                  fill="#3b82f6"
                  name="P95 Latency (ms)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Model Breakdown */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Model Metrics</h4>
          <div className="grid gap-3">
            {data.models.map((model) => (
              <ModelMetricsItem key={model.name} model={model} />
            ))}
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

// Export the memoized component
export const LLMOpsMetrics = memo(LLMOpsMetricsInner)
