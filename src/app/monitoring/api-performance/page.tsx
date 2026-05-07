'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { DemoBanner } from '@/components/ui/DemoBanner'
import {
  Zap,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Loader2,
  RefreshCw,
  Inbox,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

type TimeRange = '1h' | '6h' | '24h' | '7d'
type SortColumn = 'endpoint' | 'avgLatency' | 'p50' | 'p95' | 'p99' | 'reqPerMin' | 'errorRate'
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

interface EndpointRow {
  endpoint: string
  method: HttpMethod
  avgLatency: number
  p50: number
  p95: number
  p99: number
  reqPerMin: number
  errorRate: number
}

interface ErrorEndpoint {
  endpoint: string
  method: HttpMethod
  count: number
  lastSeen: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

function latencyStatusColor(ms: number): string {
  if (ms < 100) return 'text-green-600 dark:text-green-400'
  if (ms <= 500) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function latencyStatusDot(ms: number): string {
  if (ms < 100) return 'bg-green-500'
  if (ms <= 500) return 'bg-yellow-500'
  return 'bg-red-500'
}

function errorRateColor(rate: number): string {
  if (rate === 0) return 'text-green-600 dark:text-green-400'
  if (rate < 1) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function methodBadge(method: HttpMethod): string {
  const base = 'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-medium'
  switch (method) {
    case 'GET':
      return `${base} bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400`
    case 'POST':
      return `${base} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400`
    case 'PUT':
      return `${base} bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400`
    case 'DELETE':
      return `${base} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400`
    case 'PATCH':
      return `${base} bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400`
    default:
      return `${base} bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400`
  }
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}

// ── Component ──────────────────────────────────────────────────────────────

export default function APIPerformancePage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [sortColumn, setSortColumn] = useState<SortColumn>('avgLatency')
  const [sortDesc, setSortDesc] = useState(true)

  const [endpoints, setEndpoints] = useState<EndpointRow[]>([])
  const [errors4xx, setErrors4xx] = useState<ErrorEndpoint[]>([])
  const [errors5xx, setErrors5xx] = useState<ErrorEndpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/monitoring/api-performance')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed (${res.status})`)
      }
      const data = await res.json()
      setEndpoints(data.endpoints ?? [])
      setErrors4xx(data.errors4xx ?? [])
      setErrors5xx(data.errors5xx ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API performance data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Summary computations (safe for empty arrays)
  const totalReqWeight = endpoints.reduce((sum, ep) => sum + ep.reqPerMin, 0)
  const totalRequests = endpoints.reduce((sum, ep) => sum + ep.reqPerMin * 60 * 24, 0)
  const avgResponseTime = totalReqWeight > 0
    ? Math.round(
        endpoints.reduce((sum, ep) => sum + ep.avgLatency * ep.reqPerMin, 0) / totalReqWeight
      )
    : 0
  const overallErrorRate = totalReqWeight > 0
    ? endpoints.reduce((sum, ep) => sum + ep.errorRate * ep.reqPerMin, 0) / totalReqWeight
    : 0
  const throughput = totalReqWeight

  const total4xx = errors4xx.reduce((sum, e) => sum + e.count, 0)
  const total5xx = errors5xx.reduce((sum, e) => sum + e.count, 0)

  // Sorting
  const sortedEndpoints = useMemo(() => {
    return [...endpoints].sort((a, b) => {
      let aVal: number | string
      let bVal: number | string
      switch (sortColumn) {
        case 'endpoint':
          aVal = a.endpoint
          bVal = b.endpoint
          return sortDesc
            ? bVal.localeCompare(aVal)
            : aVal.localeCompare(bVal)
        case 'avgLatency':
          aVal = a.avgLatency; bVal = b.avgLatency; break
        case 'p50':
          aVal = a.p50; bVal = b.p50; break
        case 'p95':
          aVal = a.p95; bVal = b.p95; break
        case 'p99':
          aVal = a.p99; bVal = b.p99; break
        case 'reqPerMin':
          aVal = a.reqPerMin; bVal = b.reqPerMin; break
        case 'errorRate':
          aVal = a.errorRate; bVal = b.errorRate; break
        default:
          return 0
      }
      return sortDesc ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number)
    })
  }, [endpoints, sortColumn, sortDesc])

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDesc(!sortDesc)
    } else {
      setSortColumn(column)
      setSortDesc(true)
    }
  }

  const timeRanges: { key: TimeRange; label: string }[] = [
    { key: '1h', label: '1h' },
    { key: '6h', label: '6h' },
    { key: '24h', label: '24h' },
    { key: '7d', label: '7d' },
  ]

  const sortIndicator = (col: SortColumn) => {
    if (sortColumn !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />
    return sortDesc
      ? <ArrowDown className="h-3 w-3 ml-1" />
      : <ArrowUp className="h-3 w-3 ml-1" />
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <DemoBanner />
        <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
          <Link
            href="/monitoring"
            className="hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            Monitoring
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-gray-900 dark:text-gray-100 font-medium">API Performance</span>
        </nav>
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-4" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading API performance data...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <DemoBanner />
        <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
          <Link
            href="/monitoring"
            className="hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            Monitoring
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-gray-900 dark:text-gray-100 font-medium">API Performance</span>
        </nav>
        <div className="flex flex-col items-center justify-center py-20">
          <AlertCircle className="h-8 w-8 text-red-500 mb-4" />
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
            Failed to load data
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <DemoBanner />
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
        <Link
          href="/monitoring"
          className="hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
        >
          Monitoring
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-900 dark:text-gray-100 font-medium">API Performance</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Zap className="h-7 w-7" />
            API Performance
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Endpoint latency, throughput, and error tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {timeRanges.map((range) => (
              <button
                key={range.key}
                onClick={() => setTimeRange(range.key)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  timeRange === range.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Requests / 24h"
          value={formatNumber(totalRequests)}
          icon={<Zap className="h-5 w-5 text-blue-500" />}
          trend="up"
          trendValue="+8.3%"
        />
        <SummaryCard
          label="Avg Response Time"
          value={`${avgResponseTime}ms`}
          icon={<Clock className="h-5 w-5 text-purple-500" />}
          trend="down"
          trendValue="-4.1%"
        />
        <SummaryCard
          label="Error Rate"
          value={`${overallErrorRate.toFixed(2)}%`}
          icon={<AlertCircle className="h-5 w-5 text-orange-500" />}
          trend="down"
          trendValue="-0.12%"
        />
        <SummaryCard
          label="Throughput"
          value={`${throughput} req/min`}
          icon={<TrendingUp className="h-5 w-5 text-green-500" />}
          trend="up"
          trendValue="+12.5%"
        />
      </div>

      {/* Endpoint Performance Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            Endpoint Performance
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {endpoints.length} endpoints tracked &middot; Click column headers to sort
          </p>
        </div>
        {endpoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
            <Inbox className="h-8 w-8 mb-2" />
            <p className="text-sm">No endpoint data available</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <SortableHeader label="Endpoint" column="endpoint" current={sortColumn} onSort={handleSort} indicator={sortIndicator('endpoint')} align="left" />
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Method
                  </th>
                  <SortableHeader label="Avg Latency" column="avgLatency" current={sortColumn} onSort={handleSort} indicator={sortIndicator('avgLatency')} />
                  <SortableHeader label="P50" column="p50" current={sortColumn} onSort={handleSort} indicator={sortIndicator('p50')} />
                  <SortableHeader label="P95" column="p95" current={sortColumn} onSort={handleSort} indicator={sortIndicator('p95')} />
                  <SortableHeader label="P99" column="p99" current={sortColumn} onSort={handleSort} indicator={sortIndicator('p99')} />
                  <SortableHeader label="Req/min" column="reqPerMin" current={sortColumn} onSort={handleSort} indicator={sortIndicator('reqPerMin')} />
                  <SortableHeader label="Error Rate" column="errorRate" current={sortColumn} onSort={handleSort} indicator={sortIndicator('errorRate')} />
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {sortedEndpoints.map((ep, idx) => (
                  <tr
                    key={`${ep.method}-${ep.endpoint}-${idx}`}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-900 dark:text-gray-100">
                      {ep.endpoint}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={methodBadge(ep.method)}>{ep.method}</span>
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium ${latencyStatusColor(ep.avgLatency)}`}>
                      {formatLatency(ep.avgLatency)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium ${latencyStatusColor(ep.p50)}`}>
                      {formatLatency(ep.p50)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium ${latencyStatusColor(ep.p95)}`}>
                      {formatLatency(ep.p95)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium ${latencyStatusColor(ep.p99)}`}>
                      {formatLatency(ep.p99)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                      {ep.reqPerMin}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium ${errorRateColor(ep.errorRate)}`}>
                      {ep.errorRate.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${latencyStatusDot(ep.avgLatency)}`} />
                        <span className={`text-xs font-medium ${latencyStatusColor(ep.avgLatency)}`}>
                          {ep.avgLatency < 100 ? 'Healthy' : ep.avgLatency <= 500 ? 'Degraded' : 'Slow'}
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Error Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 4xx Errors */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                Client Errors (4xx)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Top endpoints by 4xx error count
              </p>
            </div>
            <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{total4xx}</span>
          </div>
          {errors4xx.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
              <CheckCircle className="h-6 w-6 mb-1.5" />
              <p className="text-xs">No client errors</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {errors4xx.map((err) => (
                <div
                  key={`4xx-${err.endpoint}-${err.method}`}
                  className="px-4 py-2.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={methodBadge(err.method)}>{err.method}</span>
                    <span className="font-mono text-xs text-gray-900 dark:text-gray-100 truncate">
                      {err.endpoint}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-400 dark:text-gray-500">{err.lastSeen}</span>
                    <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                      {err.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5xx Errors */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                Server Errors (5xx)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Top endpoints by 5xx error count
              </p>
            </div>
            <span className="text-lg font-bold text-red-600 dark:text-red-400">{total5xx}</span>
          </div>
          {errors5xx.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
              <CheckCircle className="h-6 w-6 mb-1.5" />
              <p className="text-xs">No server errors</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {errors5xx.map((err) => (
                <div
                  key={`5xx-${err.endpoint}-${err.method}`}
                  className="px-4 py-2.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={methodBadge(err.method)}>{err.method}</span>
                    <span className="font-mono text-xs text-gray-900 dark:text-gray-100 truncate">
                      {err.endpoint}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-400 dark:text-gray-500">{err.lastSeen}</span>
                    <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                      {err.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon,
  trend,
  trendValue,
}: {
  label: string
  value: string
  icon: React.ReactNode
  trend: 'up' | 'down'
  trendValue: string
}) {
  const isPositive =
    (label.includes('Throughput') || label.includes('Requests'))
      ? trend === 'up'
      : trend === 'down'

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        {icon}
        <div
          className={`flex items-center gap-0.5 text-xs font-medium ${
            isPositive
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}
        >
          {trend === 'up' ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {trendValue}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}

function SortableHeader({
  label,
  column,
  current,
  onSort,
  indicator,
  align = 'right',
}: {
  label: string
  column: SortColumn
  current: SortColumn
  onSort: (col: SortColumn) => void
  indicator: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      className={`${align === 'left' ? 'text-left' : 'text-right'} px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none`}
      onClick={() => onSort(column)}
    >
      <span className="inline-flex items-center">
        {label}
        {indicator}
      </span>
    </th>
  )
}
