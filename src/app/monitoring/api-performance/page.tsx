'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
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

// ── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_ENDPOINTS: EndpointRow[] = [
  { endpoint: '/api/health/services', method: 'GET', avgLatency: 12, p50: 8, p95: 28, p99: 45, reqPerMin: 120, errorRate: 0.0 },
  { endpoint: '/api/ai/chat', method: 'POST', avgLatency: 245, p50: 180, p95: 890, p99: 1240, reqPerMin: 34, errorRate: 0.82 },
  { endpoint: '/api/ai/models', method: 'GET', avgLatency: 18, p50: 14, p95: 42, p99: 68, reqPerMin: 28, errorRate: 0.0 },
  { endpoint: '/api/vm/instances', method: 'GET', avgLatency: 35, p50: 26, p95: 78, p99: 120, reqPerMin: 45, errorRate: 0.05 },
  { endpoint: '/api/containers', method: 'GET', avgLatency: 42, p50: 32, p95: 95, p99: 145, reqPerMin: 22, errorRate: 0.31 },
  { endpoint: '/api/auth/[...nextauth]', method: 'GET', avgLatency: 8, p50: 5, p95: 15, p99: 22, reqPerMin: 200, errorRate: 0.02 },
  { endpoint: '/api/monitoring/metrics', method: 'GET', avgLatency: 15, p50: 11, p95: 32, p99: 50, reqPerMin: 60, errorRate: 0.0 },
  { endpoint: '/api/ai/costs', method: 'GET', avgLatency: 52, p50: 38, p95: 110, p99: 180, reqPerMin: 15, errorRate: 0.0 },
  { endpoint: '/api/vm/snapshots', method: 'POST', avgLatency: 1850, p50: 1400, p95: 3200, p99: 4500, reqPerMin: 2, errorRate: 1.52 },
  { endpoint: '/api/files', method: 'GET', avgLatency: 28, p50: 20, p95: 65, p99: 98, reqPerMin: 38, errorRate: 0.08 },
  { endpoint: '/api/workspaces', method: 'GET', avgLatency: 22, p50: 16, p95: 48, p99: 72, reqPerMin: 18, errorRate: 0.0 },
  { endpoint: '/api/updates', method: 'GET', avgLatency: 95, p50: 72, p95: 220, p99: 380, reqPerMin: 8, errorRate: 0.25 },
  { endpoint: '/api/terminal/session', method: 'POST', avgLatency: 68, p50: 50, p95: 155, p99: 240, reqPerMin: 12, errorRate: 0.42 },
  { endpoint: '/api/ai/upload', method: 'POST', avgLatency: 320, p50: 240, p95: 780, p99: 1100, reqPerMin: 6, errorRate: 0.67 },
  { endpoint: '/api/docker/status', method: 'GET', avgLatency: 30, p50: 22, p95: 70, p99: 105, reqPerMin: 25, errorRate: 0.12 },
  { endpoint: '/api/ai/chat', method: 'DELETE', avgLatency: 14, p50: 10, p95: 30, p99: 48, reqPerMin: 4, errorRate: 0.0 },
]

const MOCK_ERROR_4XX: ErrorEndpoint[] = [
  { endpoint: '/api/auth/[...nextauth]', method: 'GET', count: 142, lastSeen: '2 min ago' },
  { endpoint: '/api/ai/chat', method: 'POST', count: 87, lastSeen: '5 min ago' },
  { endpoint: '/api/terminal/session', method: 'POST', count: 34, lastSeen: '12 min ago' },
  { endpoint: '/api/containers', method: 'GET', count: 28, lastSeen: '18 min ago' },
  { endpoint: '/api/ai/upload', method: 'POST', count: 19, lastSeen: '25 min ago' },
]

const MOCK_ERROR_5XX: ErrorEndpoint[] = [
  { endpoint: '/api/vm/snapshots', method: 'POST', count: 23, lastSeen: '8 min ago' },
  { endpoint: '/api/ai/chat', method: 'POST', count: 11, lastSeen: '14 min ago' },
  { endpoint: '/api/updates', method: 'GET', count: 7, lastSeen: '45 min ago' },
  { endpoint: '/api/ai/upload', method: 'POST', count: 4, lastSeen: '1h ago' },
]

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

  // Summary computations
  const totalRequests = MOCK_ENDPOINTS.reduce((sum, ep) => sum + ep.reqPerMin * 60 * 24, 0)
  const avgResponseTime = Math.round(
    MOCK_ENDPOINTS.reduce((sum, ep) => sum + ep.avgLatency * ep.reqPerMin, 0) /
    MOCK_ENDPOINTS.reduce((sum, ep) => sum + ep.reqPerMin, 0)
  )
  const overallErrorRate =
    MOCK_ENDPOINTS.reduce((sum, ep) => sum + ep.errorRate * ep.reqPerMin, 0) /
    MOCK_ENDPOINTS.reduce((sum, ep) => sum + ep.reqPerMin, 0)
  const throughput = MOCK_ENDPOINTS.reduce((sum, ep) => sum + ep.reqPerMin, 0)

  const total4xx = MOCK_ERROR_4XX.reduce((sum, e) => sum + e.count, 0)
  const total5xx = MOCK_ERROR_5XX.reduce((sum, e) => sum + e.count, 0)

  // Sorting
  const sortedEndpoints = useMemo(() => {
    return [...MOCK_ENDPOINTS].sort((a, b) => {
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
  }, [sortColumn, sortDesc])

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

  return (
    <div className="space-y-6">
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
            {MOCK_ENDPOINTS.length} endpoints tracked &middot; Click column headers to sort
          </p>
        </div>
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
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {MOCK_ERROR_4XX.map((err) => (
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
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {MOCK_ERROR_5XX.map((err) => (
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
