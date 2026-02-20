/**
 * LLM Error Rate Widget Component
 * Displays real-time error rate metrics and trends for LLM operations
 *
 * Enhanced Monitoring Dashboards feature (AGENT 97)
 */

'use client'

import { useEffect, useState, useCallback, useMemo, memo } from 'react'

interface ErrorMetrics {
  total: number
  rate: number
  change24h: number
}

interface ErrorsByType {
  timeout: number
  rateLimit: number
  apiError: number
  validation: number
  other: number
}

interface TimeSeriesPoint {
  timestamp: string
  errorCount: number
  errorRate: number
  requestCount: number
}

interface ErrorRateData {
  timestamp: string
  timeRange: string
  currentErrorRate: number
  errorMetrics: ErrorMetrics
  errorsByType: ErrorsByType
  timeSeries: TimeSeriesPoint[]
  healthStatus: 'healthy' | 'warning' | 'critical'
  threshold: {
    warning: number
    critical: number
  }
}

interface LLMErrorRateWidgetProps {
  refreshInterval?: number // milliseconds, default 30000 (30s)
  className?: string
}

// Memoized error icon component
const ErrorIcon = memo(function ErrorIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
})

// Memoized chart icon component
const ChartIcon = memo(function ChartIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
})

// Memoized error type item component
interface ErrorTypeItemProps {
  label: string
  count: number
  total: number
  color: string
}

const ErrorTypeItem = memo(function ErrorTypeItem({ label, count, total, color }: ErrorTypeItemProps) {
  const percentage = total > 0 ? (count / total * 100).toFixed(1) : '0.0'

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <div className="flex items-center">
        <div className={`h-2 w-2 rounded-full mr-2 ${color}`}></div>
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-gray-900">{count}</div>
        <div className="text-xs text-gray-500">{percentage}%</div>
      </div>
    </div>
  )
})

// Memoized mini chart component
interface MiniChartProps {
  data: TimeSeriesPoint[]
}

const MiniChart = memo(function MiniChart({ data }: MiniChartProps) {
  const points = useMemo(() => {
    if (data.length === 0) return ''

    const maxRate = Math.max(...data.map(d => d.errorRate), 1)
    const width = 100
    const height = 40

    return data.map((point, idx) => {
      const x = (idx / (data.length - 1)) * width
      const y = height - (point.errorRate / maxRate) * height
      return `${x},${y}`
    }).join(' ')
  }, [data])

  if (data.length === 0) {
    return <div className="text-xs text-gray-400">No data</div>
  }

  return (
    <svg viewBox="0 0 100 40" className="w-full h-10" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke="#ef4444"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
})

function LLMErrorRateWidgetInner({
  refreshInterval = 30000,
  className = ''
}: LLMErrorRateWidgetProps) {
  const [data, setData] = useState<ErrorRateData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Memoized fetch function to prevent recreation on every render
  const fetchErrorRate = useCallback(async () => {
    try {
      const res = await fetch('/api/monitoring/llm-error-rate')

      if (!res.ok) {
        throw new Error(`API returned ${res.status}: ${res.statusText}`)
      }

      const responseData = await res.json()
      setData(responseData)
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch error rate data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initial fetch
    fetchErrorRate()

    // Set up periodic refresh
    const interval = setInterval(fetchErrorRate, refreshInterval)

    return () => clearInterval(interval)
  }, [fetchErrorRate, refreshInterval])

  // Memoize status badge styling
  const statusBadge = useMemo(() => {
    if (!data) return { class: 'bg-gray-100 text-gray-800', label: 'Loading', dotColor: 'bg-gray-500' }

    if (data.healthStatus === 'healthy') {
      return { class: 'bg-green-100 text-green-800', label: 'Healthy', dotColor: 'bg-green-500' }
    } else if (data.healthStatus === 'warning') {
      return { class: 'bg-yellow-100 text-yellow-800', label: 'Warning', dotColor: 'bg-yellow-500' }
    } else {
      return { class: 'bg-red-100 text-red-800', label: 'Critical', dotColor: 'bg-red-500' }
    }
  }, [data])

  // Memoize error rate display color
  const errorRateColor = useMemo(() => {
    if (!data) return 'text-gray-900'

    if (data.currentErrorRate >= data.threshold.critical) {
      return 'text-red-600'
    } else if (data.currentErrorRate >= data.threshold.warning) {
      return 'text-yellow-600'
    }
    return 'text-green-600'
  }, [data])

  // Memoize change indicator
  const changeIndicator = useMemo(() => {
    if (!data) return null

    const change = data.errorMetrics.change24h
    const isIncrease = change > 0
    const color = isIncrease ? 'text-red-600' : 'text-green-600'
    const icon = isIncrease ? '↑' : '↓'

    return (
      <span className={`text-xs ${color} font-medium`}>
        {icon} {Math.abs(change).toFixed(1)}% vs 24h ago
      </span>
    )
  }, [data])

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 border ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
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
          <h3 className="font-semibold">Error Loading Error Rate Data</h3>
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
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg mr-3">
              <ErrorIcon />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">LLM Error Rate</h3>
              <p className="text-xs text-gray-500">{data.timeRange}</p>
            </div>
          </div>
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusBadge.class}`}>
            <div className={`h-2 w-2 rounded-full mr-2 ${statusBadge.dotColor}`}></div>
            {statusBadge.label}
          </div>
        </div>

        {/* Current Error Rate Display */}
        <div className="mb-6 p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-sm text-gray-600 mb-1">Current Error Rate</div>
              <div className={`text-4xl font-bold ${errorRateColor}`}>
                {data.currentErrorRate.toFixed(2)}%
              </div>
              <div className="mt-2">
                {changeIndicator}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600 mb-1">Total Errors</div>
              <div className="text-2xl font-semibold text-gray-900">
                {data.errorMetrics.total.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Error Trend Mini Chart */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center text-sm font-medium text-gray-700">
              <ChartIcon />
              <span className="ml-1">Error Rate Trend</span>
            </div>
            <div className="text-xs text-gray-500">
              Last {data.timeSeries.length} data points
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <MiniChart data={data.timeSeries} />
          </div>
        </div>

        {/* Errors by Type */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Errors by Type</h4>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <ErrorTypeItem
              label="Rate Limit"
              count={data.errorsByType.rateLimit}
              total={data.errorMetrics.total}
              color="bg-orange-500"
            />
            <ErrorTypeItem
              label="Timeout"
              count={data.errorsByType.timeout}
              total={data.errorMetrics.total}
              color="bg-red-500"
            />
            <ErrorTypeItem
              label="API Error"
              count={data.errorsByType.apiError}
              total={data.errorMetrics.total}
              color="bg-purple-500"
            />
            <ErrorTypeItem
              label="Validation"
              count={data.errorsByType.validation}
              total={data.errorMetrics.total}
              color="bg-yellow-500"
            />
            <ErrorTypeItem
              label="Other"
              count={data.errorsByType.other}
              total={data.errorMetrics.total}
              color="bg-gray-500"
            />
          </div>
        </div>

        {/* Thresholds */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-xs text-blue-800 font-medium mb-2">Alert Thresholds</div>
          <div className="flex gap-4 text-xs">
            <div className="flex items-center">
              <div className="h-2 w-2 rounded-full bg-yellow-500 mr-1"></div>
              <span className="text-gray-700">Warning: {data.threshold.warning}%</span>
            </div>
            <div className="flex items-center">
              <div className="h-2 w-2 rounded-full bg-red-500 mr-1"></div>
              <span className="text-gray-700">Critical: {data.threshold.critical}%</span>
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

// Export the memoized widget component
export const LLMErrorRateWidget = memo(LLMErrorRateWidgetInner)
