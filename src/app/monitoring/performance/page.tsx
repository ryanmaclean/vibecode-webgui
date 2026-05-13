'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { DemoBanner } from '@/components/ui/DemoBanner'
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
  Loader2,
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

interface PerformanceReportMetrics {
  cpuUsage: number
  loadAverage: {
    '1m': number
    '5m': number
    '15m': number
  }
  memory: {
    totalMB: number
    freeMB: number
    usedPercent: number
  }
  process: {
    heapUsedMB: number
    heapTotalMB: number
    rssMB: number
    externalMB: number
    uptimeSeconds: number
  }
}

interface PerformanceReport {
  timeframe: string
  timestamp: string
  status: string
  metrics: PerformanceReportMetrics
  recommendations: string[]
  critical_issues: string[]
  summary: {
    avg_api_response_time: number
  }
}

interface PerformanceHealthReport {
  healthy: boolean
  status: string
  issues: string[]
  recommendations: string[]
  timestamp: string
}

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

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb} MB`
}

// ── Component ──────────────────────────────────────────────────────────────

export default function PerformanceMetricsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('1h')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())
  const [sortBy, setSortBy] = useState<'avgLatency' | 'p95' | 'requestsPerMin' | 'errorRate'>('avgLatency')
  const [sortDesc, setSortDesc] = useState(true)

  const [report, setReport] = useState<PerformanceReport | null>(null)
  const [healthReport, setHealthReport] = useState<PerformanceHealthReport | null>(null)
  const [endpoints, setEndpoints] = useState<EndpointMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [reportRes, healthRes] = await Promise.all([
        fetch(`/api/monitoring/performance?action=report&timeframe=${timeRange}`),
        fetch('/api/monitoring/performance?action=health'),
      ])

      if (!reportRes.ok) {
        throw new Error(`Performance report request failed: ${reportRes.status} ${reportRes.statusText}`)
      }
      if (!healthRes.ok) {
        throw new Error(`Health check request failed: ${healthRes.status} ${healthRes.statusText}`)
      }

      const reportData: PerformanceReport = await reportRes.json()
      const healthData: PerformanceHealthReport = await healthRes.json()

      setReport(reportData)
      setHealthReport(healthData)

      // The API does not currently return per-endpoint metrics.
      // When the API is extended to include them, they can be set here.
      setEndpoints([])
      setLastRefreshed(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch performance data')
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  // Fetch on mount and when timeRange changes
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh every 30s when enabled
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchData])

  // Sorted endpoints
  const sortedEndpoints = [...endpoints].sort((a, b) => {
    const aVal = a[sortBy]
    const bVal = b[sortBy]
    return sortDesc ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number)
  })

  // Computed summary metrics from API data
  const avgLatency = report?.summary?.avg_api_response_time ?? 0
  const p95Latency = endpoints.length > 0
    ? Math.round(endpoints.reduce((sum, e) => sum + e.p95, 0) / endpoints.length)
    : 0
  const totalErrorRate = endpoints.length > 0
    ? endpoints.reduce((sum, e) => sum + e.errorRate * e.requestsPerMin, 0) /
      endpoints.reduce((sum, e) => sum + e.requestsPerMin, 0)
    : 0

  // Build VM resource cards from real API data
  const vmResources: VMResource[] = report
    ? [
        {
          label: 'CPU Usage',
          value: `${report.metrics.cpuUsage}%`,
          subValue: `Load avg: ${report.metrics.loadAverage['1m']} / ${report.metrics.loadAverage['5m']} / ${report.metrics.loadAverage['15m']}`,
          percentage: report.metrics.cpuUsage,
          icon: <Cpu className="h-5 w-5" />,
          color: 'blue',
        },
        {
          label: 'System Memory',
          value: `${formatMB(report.metrics.memory.totalMB - report.metrics.memory.freeMB)} / ${formatMB(report.metrics.memory.totalMB)}`,
          subValue: `${report.metrics.memory.usedPercent}% utilized`,
          percentage: report.metrics.memory.usedPercent,
          icon: <MemoryStick className="h-5 w-5" />,
          color: 'purple',
        },
        {
          label: 'Process Heap',
          value: `${formatMB(report.metrics.process.heapUsedMB)} / ${formatMB(report.metrics.process.heapTotalMB)}`,
          subValue: `RSS: ${formatMB(report.metrics.process.rssMB)}`,
          percentage: report.metrics.process.heapTotalMB > 0
            ? Math.round((report.metrics.process.heapUsedMB / report.metrics.process.heapTotalMB) * 100)
            : 0,
          icon: <HardDrive className="h-5 w-5" />,
          color: 'orange',
        },
        {
          label: 'Uptime',
          value: formatUptime(report.metrics.process.uptimeSeconds),
          subValue: `External mem: ${formatMB(report.metrics.process.externalMB)}`,
          percentage: Math.min(100, Math.round((report.metrics.process.uptimeSeconds / 86400) * 100)),
          icon: <Wifi className="h-5 w-5" />,
          color: 'green',
        },
      ]
    : []

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

  // ── Loading state ──
  if (loading && !report) {
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
          <span className="text-gray-900 dark:text-gray-100 font-medium">Performance Metrics</span>
        </nav>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading performance metrics...</p>
        </div>
      </div>
    )
  }

  // ── Error state ──
  if (error && !report) {
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
          <span className="text-gray-900 dark:text-gray-100 font-medium">Performance Metrics</span>
        </nav>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <p className="text-sm font-medium text-red-600 dark:text-red-400">Failed to load performance data</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md text-center">{error}</p>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
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
          {/* Inline error banner for background refresh failures */}
          {error && report && (
            <span className="text-xs text-red-500 dark:text-red-400">Refresh failed</span>
          )}
          {/* Loading indicator for background refreshes */}
          {loading && report && (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          )}
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
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Health status banner */}
      {healthReport && !healthReport.healthy && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              System health: {healthReport.status}
            </p>
            {healthReport.issues.length > 0 && (
              <ul className="mt-1 text-xs text-yellow-700 dark:text-yellow-300 list-disc list-inside">
                {healthReport.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

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
          trend="stable"
          trendValue="--"
          trendLabel={`${timeRange} window`}
        />
        <MetricCard
          label="P95 Latency"
          value={endpoints.length > 0 ? formatLatency(p95Latency) : '--'}
          icon={<Activity className="h-5 w-5 text-purple-500" />}
          trend="stable"
          trendValue="--"
          trendLabel={`${timeRange} window`}
        />
        <MetricCard
          label="Process Uptime"
          value={report ? formatUptime(report.metrics.process.uptimeSeconds) : '--'}
          icon={<Server className="h-5 w-5 text-indigo-500" />}
          trend="stable"
          trendValue="--"
          trendLabel="since last restart"
        />
        <MetricCard
          label="Error Rate"
          value={endpoints.length > 0 ? `${totalErrorRate.toFixed(2)}%` : '--'}
          icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
          trend="stable"
          trendValue="--"
          trendLabel={`${timeRange} window`}
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
            {endpoints.length} endpoints tracked &middot; Click column headers to sort
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
                  Avg Latency {sortBy === 'avgLatency' && (sortDesc ? '↓' : '↑')}
                </th>
                <th
                  className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={() => handleSort('p95')}
                >
                  P95 {sortBy === 'p95' && (sortDesc ? '↓' : '↑')}
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  P99
                </th>
                <th
                  className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={() => handleSort('requestsPerMin')}
                >
                  Req/min {sortBy === 'requestsPerMin' && (sortDesc ? '↓' : '↑')}
                </th>
                <th
                  className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={() => handleSort('errorRate')}
                >
                  Error Rate {sortBy === 'errorRate' && (sortDesc ? '↓' : '↑')}
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sortedEndpoints.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Activity className="h-8 w-8 text-gray-300 dark:text-gray-600" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No endpoint performance data available
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Endpoint-level metrics will appear here when the monitoring backend reports them.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedEndpoints.map((ep) => (
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
                ))
              )}
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
        {vmResources.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-8 text-center">
            <Server className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No resource data available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {vmResources.map((resource) => (
              <VMResourceCard key={resource.label} resource={resource} />
            ))}
          </div>
        )}
      </div>

      {/* Recommendations */}
      {report && report.recommendations.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">Recommendations</h3>
          <ul className="text-xs text-blue-700 dark:text-blue-300 list-disc list-inside space-y-1">
            {report.recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Critical issues */}
      {report && report.critical_issues.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">Critical Issues</h3>
          <ul className="text-xs text-red-700 dark:text-red-300 list-disc list-inside space-y-1">
            {report.critical_issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
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
  trend: 'up' | 'down' | 'stable'
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
            trend === 'stable'
              ? 'text-gray-500 dark:text-gray-400'
              : isPositive
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
          }`}
        >
          {trend === 'up' ? (
            <ArrowUp className="h-3 w-3" />
          ) : trend === 'down' ? (
            <ArrowDown className="h-3 w-3" />
          ) : null}
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

  const defaultColors = { bar: 'bg-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', icon: 'text-blue-500' }
  const colors = colorMap[resource.color] ?? defaultColors

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
