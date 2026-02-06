'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Activity,
  Clock,
  Zap,
  AlertTriangle,
  RefreshCw,
  Server,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Cpu,
  HardDrive,
  Wifi,
  MemoryStick,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

type TimeRange = '1h' | '6h' | '24h' | '7d'
type TrendDirection = 'up' | 'down' | 'stable'

interface EndpointMetric {
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  avgLatency: number
  p95: number
  p99: number
  requestsPerMin: number
  errorRate: number
  trend: TrendDirection
  trendDelta: number
}

interface VMResource {
  label: string
  value: string
  subValue?: string
  percentage: number
  icon: React.ReactNode
  color: string
}

// ── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_ENDPOINTS: EndpointMetric[] = [
  {
    endpoint: '/api/health/services',
    method: 'GET',
    avgLatency: 12,
    p95: 28,
    p99: 45,
    requestsPerMin: 120,
    errorRate: 0.0,
    trend: 'stable',
    trendDelta: 0.3,
  },
  {
    endpoint: '/api/ai/chat',
    method: 'POST',
    avgLatency: 245,
    p95: 890,
    p99: 1240,
    requestsPerMin: 34,
    errorRate: 0.8,
    trend: 'up',
    trendDelta: 12.4,
  },
  {
    endpoint: '/api/vm/instances',
    method: 'GET',
    avgLatency: 35,
    p95: 78,
    p99: 120,
    requestsPerMin: 45,
    errorRate: 0.0,
    trend: 'down',
    trendDelta: -5.2,
  },
  {
    endpoint: '/api/ai/models',
    method: 'GET',
    avgLatency: 18,
    p95: 42,
    p99: 68,
    requestsPerMin: 28,
    errorRate: 0.0,
    trend: 'stable',
    trendDelta: -0.1,
  },
  {
    endpoint: '/api/auth/session',
    method: 'GET',
    avgLatency: 8,
    p95: 15,
    p99: 22,
    requestsPerMin: 200,
    errorRate: 0.02,
    trend: 'down',
    trendDelta: -1.8,
  },
  {
    endpoint: '/api/vm/snapshots',
    method: 'POST',
    avgLatency: 1850,
    p95: 3200,
    p99: 4500,
    requestsPerMin: 2,
    errorRate: 1.5,
    trend: 'up',
    trendDelta: 8.6,
  },
  {
    endpoint: '/api/ai/costs',
    method: 'GET',
    avgLatency: 52,
    p95: 110,
    p99: 180,
    requestsPerMin: 15,
    errorRate: 0.0,
    trend: 'stable',
    trendDelta: 0.5,
  },
  {
    endpoint: '/api/containers',
    method: 'GET',
    avgLatency: 42,
    p95: 95,
    p99: 145,
    requestsPerMin: 22,
    errorRate: 0.3,
    trend: 'down',
    trendDelta: -3.1,
  },
  {
    endpoint: '/api/settings',
    method: 'PUT',
    avgLatency: 28,
    p95: 55,
    p99: 82,
    requestsPerMin: 5,
    errorRate: 0.0,
    trend: 'stable',
    trendDelta: 0.0,
  },
  {
    endpoint: '/api/monitoring/pool-alerts',
    method: 'GET',
    avgLatency: 15,
    p95: 32,
    p99: 50,
    requestsPerMin: 60,
    errorRate: 0.05,
    trend: 'down',
    trendDelta: -2.0,
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

function latencyColor(ms: number): string {
  if (ms < 50) return 'text-green-600 dark:text-green-400'
  if (ms < 200) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function errorRateColor(rate: number): string {
  if (rate === 0) return 'text-green-600 dark:text-green-400'
  if (rate < 1) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function methodBadge(method: string): string {
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
    default:
      return `${base} bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400`
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function PerformanceMetricsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('1h')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())
  const [sortBy, setSortBy] = useState<'avgLatency' | 'p95' | 'requestsPerMin' | 'errorRate'>('avgLatency')
  const [sortDesc, setSortDesc] = useState(true)

  const refreshData = useCallback(() => {
    setLastRefreshed(new Date())
  }, [])

  // Auto-refresh every 30s when enabled
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(refreshData, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshData])

  // Sorted endpoints
  const sortedEndpoints = [...MOCK_ENDPOINTS].sort((a, b) => {
    const aVal = a[sortBy]
    const bVal = b[sortBy]
    return sortDesc ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number)
  })

  // Computed summary metrics
  const avgLatency = Math.round(
    MOCK_ENDPOINTS.reduce((sum, e) => sum + e.avgLatency, 0) / MOCK_ENDPOINTS.length
  )
  const p95Latency = Math.round(
    MOCK_ENDPOINTS.reduce((sum, e) => sum + e.p95, 0) / MOCK_ENDPOINTS.length
  )
  const totalErrorRate =
    MOCK_ENDPOINTS.reduce((sum, e) => sum + e.errorRate * e.requestsPerMin, 0) /
    MOCK_ENDPOINTS.reduce((sum, e) => sum + e.requestsPerMin, 0)

  const vmResources: VMResource[] = [
    {
      label: 'CPU Usage',
      value: '34%',
      subValue: '2 / 4 cores active',
      percentage: 34,
      icon: <Cpu className="h-5 w-5" />,
      color: 'blue',
    },
    {
      label: 'Memory Usage',
      value: '2.1 GB / 4.0 GB',
      subValue: '52.5% utilized',
      percentage: 52.5,
      icon: <MemoryStick className="h-5 w-5" />,
      color: 'purple',
    },
    {
      label: 'Disk I/O',
      value: 'R: 12.4 MB/s',
      subValue: 'W: 5.8 MB/s',
      percentage: 28,
      icon: <HardDrive className="h-5 w-5" />,
      color: 'orange',
    },
    {
      label: 'Network',
      value: 'In: 45.2 Mbps',
      subValue: 'Out: 12.8 Mbps',
      percentage: 38,
      icon: <Wifi className="h-5 w-5" />,
      color: 'green',
    },
  ]

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDesc(!sortDesc)
    } else {
      setSortBy(column)
      setSortDesc(true)
    }
  }

  const timeRanges: { key: TimeRange; label: string }[] = [
    { key: '1h', label: 'Last 1h' },
    { key: '6h', label: 'Last 6h' },
    { key: '24h', label: 'Last 24h' },
    { key: '7d', label: 'Last 7d' },
  ]

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
        <span className="text-gray-900 dark:text-gray-100 font-medium">Performance Metrics</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Activity className="h-7 w-7" />
            Performance Metrics
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            API endpoint and VM resource performance monitoring
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-refresh indicator */}
          <div className="flex items-center gap-2">
            {autoRefresh && (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Auto-refresh
              </span>
            )}
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Updated {lastRefreshed.toLocaleTimeString()}
            </span>
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh (30s)'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
              autoRefresh
                ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30'
                : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
            }`}
          >
            <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'On' : 'Off'}
          </button>
          <button
            onClick={refreshData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        <span className="text-sm text-gray-600 dark:text-gray-400 mr-1">Time range:</span>
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

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          label="Avg API Latency"
          value={formatLatency(avgLatency)}
          icon={<Zap className="h-5 w-5 text-blue-500" />}
          trend="down"
          trendValue="-3.2%"
          trendLabel="vs prev period"
        />
        <MetricCard
          label="P95 Latency"
          value={formatLatency(p95Latency)}
          icon={<Activity className="h-5 w-5 text-purple-500" />}
          trend="up"
          trendValue="+5.1%"
          trendLabel="vs prev period"
        />
        <MetricCard
          label="VM Boot Time"
          value="24.3s"
          icon={<Server className="h-5 w-5 text-indigo-500" />}
          trend="down"
          trendValue="-1.2s"
          trendLabel="vs prev period"
        />
        <MetricCard
          label="Error Rate"
          value={`${totalErrorRate.toFixed(2)}%`}
          icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
          trend="down"
          trendValue="-0.05%"
          trendLabel="vs prev period"
        />
      </div>

      {/* API Endpoint Performance Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            API Endpoint Performance
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {MOCK_ENDPOINTS.length} endpoints tracked &middot; Click column headers to sort
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Endpoint
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Method
                </th>
                <th
                  className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={() => handleSort('avgLatency')}
                >
                  Avg Latency {sortBy === 'avgLatency' && (sortDesc ? '\u2193' : '\u2191')}
                </th>
                <th
                  className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={() => handleSort('p95')}
                >
                  P95 {sortBy === 'p95' && (sortDesc ? '\u2193' : '\u2191')}
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  P99
                </th>
                <th
                  className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={() => handleSort('requestsPerMin')}
                >
                  Req/min {sortBy === 'requestsPerMin' && (sortDesc ? '\u2193' : '\u2191')}
                </th>
                <th
                  className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={() => handleSort('errorRate')}
                >
                  Error Rate {sortBy === 'errorRate' && (sortDesc ? '\u2193' : '\u2191')}
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sortedEndpoints.map((ep) => (
                <tr
                  key={`${ep.method}-${ep.endpoint}`}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-900 dark:text-gray-100">
                    {ep.endpoint}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={methodBadge(ep.method)}>{ep.method}</span>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-medium ${latencyColor(ep.avgLatency)}`}>
                    {formatLatency(ep.avgLatency)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-medium ${latencyColor(ep.p95)}`}>
                    {formatLatency(ep.p95)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-medium ${latencyColor(ep.p99)}`}>
                    {formatLatency(ep.p99)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                    {ep.requestsPerMin}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-medium ${errorRateColor(ep.errorRate)}`}>
                    {ep.errorRate.toFixed(2)}%
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <TrendIndicator direction={ep.trend} delta={ep.trendDelta} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* VM Performance Section */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
          <Server className="h-5 w-5 text-indigo-500" />
          VM Resource Performance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {vmResources.map((resource) => (
            <VMResourceCard key={resource.label} resource={resource} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  icon,
  trend,
  trendValue,
  trendLabel,
}: {
  label: string
  value: string
  icon: React.ReactNode
  trend: 'up' | 'down'
  trendValue: string
  trendLabel: string
}) {
  // For latency/error metrics, "down" is good; for throughput, "up" is good
  const isPositive = trend === 'down'

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
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )}
          {trendValue}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{trendLabel}</p>
    </div>
  )
}

function TrendIndicator({ direction, delta }: { direction: TrendDirection; delta: number }) {
  if (direction === 'stable') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        <span className="h-1 w-3 bg-gray-300 dark:bg-gray-600 rounded" />
        {Math.abs(delta).toFixed(1)}%
      </span>
    )
  }

  // For latency, "up" trend is bad (red), "down" trend is good (green)
  const isNegative = direction === 'up'

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        isNegative
          ? 'text-red-600 dark:text-red-400'
          : 'text-green-600 dark:text-green-400'
      }`}
    >
      {direction === 'up' ? (
        <TrendingUp className="h-3.5 w-3.5" />
      ) : (
        <TrendingDown className="h-3.5 w-3.5" />
      )}
      {Math.abs(delta).toFixed(1)}%
    </span>
  )
}

function VMResourceCard({ resource }: { resource: VMResource }) {
  const colorMap: Record<string, { bar: string; bg: string; icon: string }> = {
    blue: {
      bar: 'bg-blue-500',
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      icon: 'text-blue-500',
    },
    purple: {
      bar: 'bg-purple-500',
      bg: 'bg-purple-100 dark:bg-purple-900/30',
      icon: 'text-purple-500',
    },
    orange: {
      bar: 'bg-orange-500',
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      icon: 'text-orange-500',
    },
    green: {
      bar: 'bg-green-500',
      bg: 'bg-green-100 dark:bg-green-900/30',
      icon: 'text-green-500',
    },
  }

  const colors = colorMap[resource.color] || colorMap.blue

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className={colors.icon}>{resource.icon}</span>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {resource.label}
        </h3>
      </div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{resource.value}</p>
      {resource.subValue && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{resource.subValue}</p>
      )}
      {/* Progress bar */}
      <div className="mt-3 w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
        <div
          className={`${colors.bar} h-2 rounded-full transition-all`}
          style={{ width: `${Math.min(resource.percentage, 100)}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-right">
        {resource.percentage}%
      </p>
    </div>
  )
}
