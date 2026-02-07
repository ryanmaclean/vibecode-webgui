'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  FileText,
  Search,
  Filter,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

type LogLevel = 'error' | 'warn' | 'info' | 'debug'
type LogSource = 'API' | 'WebSocket' | 'Health' | 'AI' | 'VM' | 'Auth' | 'Scheduler'

interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  source: LogSource
  message: string
  details?: string
}

// ── Mock Data ──────────────────────────────────────────────────────────────

const now = Date.now()

const MOCK_LOGS: LogEntry[] = [
  {
    id: 'log-001',
    timestamp: new Date(now - 8 * 1000).toISOString(),
    level: 'error',
    source: 'API',
    message: 'Request to /api/ai/chat failed: ECONNREFUSED',
    details: 'Error: connect ECONNREFUSED 127.0.0.1:11434\n    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1605:16)\n    at TCPConnectWrap.callbackTrampoline (node:internal/async_hooks:128:17)\n\nRequest ID: req_a8f3c21e\nDuration: 3012ms\nRetries: 3/3 exhausted',
  },
  {
    id: 'log-002',
    timestamp: new Date(now - 15 * 1000).toISOString(),
    level: 'warn',
    source: 'Health',
    message: "Service 'valkey' response time 2850ms exceeds threshold (1000ms)",
    details: 'Health check endpoint: valkey://localhost:6379/ping\nExpected response: <1000ms\nActual response: 2850ms\nConsecutive slow responses: 3\nCircuit breaker status: HALF_OPEN',
  },
  {
    id: 'log-003',
    timestamp: new Date(now - 22 * 1000).toISOString(),
    level: 'info',
    source: 'VM',
    message: 'Instance vm-001 boot completed in 24.3s',
    details: 'VM ID: vm-001\nProfile: alpine-dev\nCPU: 4 cores\nMemory: 4096 MB\nDisk: 20 GB\nBoot stages:\n  - Image load: 2.1s\n  - Kernel init: 8.4s\n  - Service startup: 13.8s',
  },
  {
    id: 'log-004',
    timestamp: new Date(now - 30 * 1000).toISOString(),
    level: 'debug',
    source: 'Auth',
    message: 'Session token refreshed for user admin',
    details: 'User: admin\nSession ID: sess_f4a91bc2\nToken type: JWT\nExpires in: 3600s\nRefresh reason: Token approaching expiry (< 300s remaining)',
  },
  {
    id: 'log-005',
    timestamp: new Date(now - 45 * 1000).toISOString(),
    level: 'info',
    source: 'AI',
    message: 'Model claude-3.5-sonnet selected, estimated cost: $0.003',
    details: 'Provider: OpenRouter\nModel: claude-3.5-sonnet\nInput tokens: 1240\nEstimated output: ~800 tokens\nCost breakdown:\n  - Input: $0.0018 (1240 * $1.50/1M)\n  - Output: $0.0012 (est. 800 * $1.50/1M)',
  },
  {
    id: 'log-006',
    timestamp: new Date(now - 52 * 1000).toISOString(),
    level: 'error',
    source: 'WebSocket',
    message: 'Connection dropped: client ws_9f2e unexpectedly closed',
    details: 'WebSocket ID: ws_9f2e\nClient IP: 192.168.64.1\nConnected duration: 847s\nClose code: 1006 (Abnormal Closure)\nLast message: 42s ago\nPending messages in queue: 3',
  },
  {
    id: 'log-007',
    timestamp: new Date(now - 68 * 1000).toISOString(),
    level: 'info',
    source: 'Scheduler',
    message: 'Cron job "health-check-sweep" completed successfully (12 services checked)',
    details: 'Job: health-check-sweep\nSchedule: */30 * * * * (every 30s)\nDuration: 1.8s\nResults:\n  - Healthy: 10\n  - Degraded: 1 (valkey)\n  - Down: 1 (ollama)\nNext run: 30s',
  },
  {
    id: 'log-008',
    timestamp: new Date(now - 75 * 1000).toISOString(),
    level: 'warn',
    source: 'AI',
    message: 'Rate limit approaching: 82/100 requests in current window',
    details: 'Provider: OpenRouter\nRate limit: 100 req/min\nCurrent usage: 82 req/min\nWindow resets in: 18s\nRecommendation: Consider request queuing or model fallback',
  },
  {
    id: 'log-009',
    timestamp: new Date(now - 90 * 1000).toISOString(),
    level: 'info',
    source: 'API',
    message: 'GET /api/health/services responded 200 in 12ms',
  },
  {
    id: 'log-010',
    timestamp: new Date(now - 102 * 1000).toISOString(),
    level: 'debug',
    source: 'VM',
    message: 'Snapshot vm-001-snap-003 created, size: 1.2 GB',
    details: 'VM: vm-001\nSnapshot ID: vm-001-snap-003\nType: incremental\nBase snapshot: vm-001-snap-002\nDelta size: 245 MB\nTotal size: 1.2 GB\nCompression: zstd (ratio: 2.4x)',
  },
  {
    id: 'log-011',
    timestamp: new Date(now - 120 * 1000).toISOString(),
    level: 'error',
    source: 'Health',
    message: "Service 'ollama' health check failed: connection refused",
    details: 'Endpoint: http://localhost:11434/api/tags\nError: ECONNREFUSED\nConsecutive failures: 5\nCircuit breaker: OPEN\nLast healthy: 12m ago\nRecovery action: Auto-restart scheduled in 30s',
  },
  {
    id: 'log-012',
    timestamp: new Date(now - 135 * 1000).toISOString(),
    level: 'info',
    source: 'Auth',
    message: 'User admin logged in successfully via credentials',
    details: 'User: admin\nMethod: credentials\nIP: 192.168.64.1\nUser-Agent: Mozilla/5.0 (Macintosh; Apple Silicon)\nSession created: sess_f4a91bc2',
  },
  {
    id: 'log-013',
    timestamp: new Date(now - 148 * 1000).toISOString(),
    level: 'warn',
    source: 'Scheduler',
    message: 'Job "cost-aggregation" took 4.2s, exceeding 3s timeout warning',
    details: 'Job: cost-aggregation\nSchedule: 0 */5 * * * * (every 5 min)\nDuration: 4.2s\nWarning threshold: 3s\nHard timeout: 10s\nRecords processed: 2,847\nRecommendation: Consider batching or index optimization',
  },
  {
    id: 'log-014',
    timestamp: new Date(now - 160 * 1000).toISOString(),
    level: 'info',
    source: 'WebSocket',
    message: 'Client ws_d41a connected from 192.168.64.1 (total: 3 active)',
  },
  {
    id: 'log-015',
    timestamp: new Date(now - 175 * 1000).toISOString(),
    level: 'debug',
    source: 'API',
    message: 'Rate limiter: /api/ai/chat endpoint at 34/60 requests per minute',
    details: 'Endpoint: /api/ai/chat\nWindow: 60s\nCurrent: 34 requests\nLimit: 60 requests\nRemaining: 26\nClient IP: 192.168.64.1',
  },
  {
    id: 'log-016',
    timestamp: new Date(now - 190 * 1000).toISOString(),
    level: 'info',
    source: 'AI',
    message: 'Chat completion finished: 1,847 tokens in 2.3s (803 tok/s)',
    details: 'Model: claude-3.5-sonnet\nInput tokens: 1,240\nOutput tokens: 607\nTotal: 1,847\nLatency: 2.3s\nThroughput: 803 tok/s\nActual cost: $0.0028\nConversation: conv_88a1f3',
  },
  {
    id: 'log-017',
    timestamp: new Date(now - 210 * 1000).toISOString(),
    level: 'error',
    source: 'API',
    message: 'POST /api/vm/snapshots returned 500: disk space insufficient',
    details: 'Error: InsufficientDiskSpace\nRequired: 2.4 GB\nAvailable: 1.1 GB\nDisk: /dev/vda1\nVM: vm-002\n\nStack trace:\n  at SnapshotService.create (src/lib/vm/snapshots.ts:142)\n  at POST /api/vm/snapshots (src/app/api/vm/snapshots/route.ts:28)',
  },
  {
    id: 'log-018',
    timestamp: new Date(now - 225 * 1000).toISOString(),
    level: 'warn',
    source: 'VM',
    message: 'Instance vm-002 memory usage at 89% (3.6 GB / 4.0 GB)',
    details: 'VM: vm-002\nProfile: alpine-docker\nMemory allocated: 4096 MB\nMemory used: 3686 MB (89.0%)\nSwap used: 128 MB\nTop processes:\n  - dockerd: 1.2 GB\n  - postgres: 890 MB\n  - node: 456 MB',
  },
  {
    id: 'log-019',
    timestamp: new Date(now - 240 * 1000).toISOString(),
    level: 'info',
    source: 'Health',
    message: 'All 12 services healthy, avg response time: 45ms',
  },
  {
    id: 'log-020',
    timestamp: new Date(now - 258 * 1000).toISOString(),
    level: 'debug',
    source: 'WebSocket',
    message: 'Heartbeat sent to 3 connected clients, all acknowledged',
    details: 'Connected clients: ws_d41a, ws_9f2e, ws_b71c\nHeartbeat interval: 30s\nAll clients responded within 200ms\nNext heartbeat: 30s',
  },
  {
    id: 'log-021',
    timestamp: new Date(now - 275 * 1000).toISOString(),
    level: 'info',
    source: 'Scheduler',
    message: 'Job "log-rotation" completed: 3 files rotated, 45 MB freed',
  },
  {
    id: 'log-022',
    timestamp: new Date(now - 290 * 1000).toISOString(),
    level: 'warn',
    source: 'Auth',
    message: 'Failed login attempt for user "root" from 10.0.0.15 (attempt 3/5)',
    details: 'User: root\nIP: 10.0.0.15\nMethod: credentials\nConsecutive failures: 3\nLockout threshold: 5\nLockout duration: 15m\nUser-Agent: curl/8.1.0',
  },
  {
    id: 'log-023',
    timestamp: new Date(now - 310 * 1000).toISOString(),
    level: 'error',
    source: 'AI',
    message: 'OpenRouter API returned 429: rate limit exceeded, retry in 12s',
    details: 'Provider: OpenRouter\nEndpoint: /api/v1/chat/completions\nHTTP status: 429\nRetry-After: 12s\nModel: gpt-4-turbo\nQueued requests: 2\nFallback: claude-3-haiku (pending)',
  },
  {
    id: 'log-024',
    timestamp: new Date(now - 330 * 1000).toISOString(),
    level: 'info',
    source: 'API',
    message: 'PUT /api/settings responded 200 in 28ms (settings updated)',
  },
  {
    id: 'log-025',
    timestamp: new Date(now - 345 * 1000).toISOString(),
    level: 'debug',
    source: 'Health',
    message: 'Circuit breaker for postgres transitioned: CLOSED -> CLOSED (success)',
    details: 'Service: postgres\nPrevious state: CLOSED\nNew state: CLOSED\nSuccess count: 48\nFailure count: 0\nSuccess rate: 100%\nThreshold: 50% failures in 60s window',
  },
  {
    id: 'log-026',
    timestamp: new Date(now - 360 * 1000).toISOString(),
    level: 'info',
    source: 'VM',
    message: 'Port forwarding established: host:2222 -> vm-001:22 (SSH)',
  },
  {
    id: 'log-027',
    timestamp: new Date(now - 380 * 1000).toISOString(),
    level: 'warn',
    source: 'API',
    message: 'Slow query detected: GET /api/ai/costs took 1.8s (threshold: 500ms)',
    details: 'Endpoint: GET /api/ai/costs\nDuration: 1.8s\nThreshold: 500ms\nQuery: SELECT * FROM cost_records WHERE created_at > ...\nRows returned: 12,847\nRecommendation: Add pagination or date range filter',
  },
  {
    id: 'log-028',
    timestamp: new Date(now - 400 * 1000).toISOString(),
    level: 'info',
    source: 'AI',
    message: 'Model fallback: gpt-4-turbo -> claude-3-haiku (rate limited)',
  },
  {
    id: 'log-029',
    timestamp: new Date(now - 420 * 1000).toISOString(),
    level: 'debug',
    source: 'Scheduler',
    message: 'Next scheduled jobs: health-check-sweep (12s), cost-aggregation (4m 12s)',
  },
  {
    id: 'log-030',
    timestamp: new Date(now - 440 * 1000).toISOString(),
    level: 'error',
    source: 'WebSocket',
    message: 'Failed to broadcast health update: 1 of 3 clients unreachable',
    details: 'Broadcast type: health-update\nTotal clients: 3\nSuccessful: 2 (ws_d41a, ws_b71c)\nFailed: 1 (ws_9f2e)\nError: Connection reset by peer\nAction: Client ws_9f2e marked for cleanup',
  },
  {
    id: 'log-031',
    timestamp: new Date(now - 460 * 1000).toISOString(),
    level: 'info',
    source: 'Auth',
    message: 'API key validated for service account "ci-runner"',
  },
  {
    id: 'log-032',
    timestamp: new Date(now - 480 * 1000).toISOString(),
    level: 'warn',
    source: 'Health',
    message: "Service 'docker' response time elevated: 890ms (threshold: 500ms)",
  },
  {
    id: 'log-033',
    timestamp: new Date(now - 500 * 1000).toISOString(),
    level: 'info',
    source: 'VM',
    message: 'Instance vm-001 resource usage: CPU 34%, Memory 52%, Disk 28%',
  },
  {
    id: 'log-034',
    timestamp: new Date(now - 520 * 1000).toISOString(),
    level: 'debug',
    source: 'AI',
    message: 'Token usage cache hit for conversation conv_88a1f3 (saved 1 API call)',
  },
  {
    id: 'log-035',
    timestamp: new Date(now - 540 * 1000).toISOString(),
    level: 'error',
    source: 'Scheduler',
    message: 'Job "backup-rotate" failed: permission denied on /var/backups',
    details: 'Job: backup-rotate\nSchedule: 0 0 * * * (daily)\nError: EACCES: permission denied, unlink /var/backups/vm-001-20240115.tar.gz\nUser: vibecode\nRequired: root\nAction: Job marked as failed, admin notification sent',
  },
]

// ── Constants ──────────────────────────────────────────────────────────────

const LOG_SOURCES: LogSource[] = ['API', 'WebSocket', 'Health', 'AI', 'VM', 'Auth', 'Scheduler']
const PAGE_SIZE = 15

// ── Helpers ────────────────────────────────────────────────────────────────

function levelIcon(level: LogLevel) {
  switch (level) {
    case 'error':
      return <AlertCircle className="h-3.5 w-3.5" />
    case 'warn':
      return <AlertTriangle className="h-3.5 w-3.5" />
    case 'info':
      return <Info className="h-3.5 w-3.5" />
    case 'debug':
      return <Bug className="h-3.5 w-3.5" />
  }
}

function levelBadgeClass(level: LogLevel): string {
  const base = 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold uppercase'
  switch (level) {
    case 'error':
      return `${base} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400`
    case 'warn':
      return `${base} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400`
    case 'info':
      return `${base} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400`
    case 'debug':
      return `${base} bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400`
  }
}

function sourceTagClass(source: LogSource): string {
  const base = 'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium'
  switch (source) {
    case 'API':
      return `${base} bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400`
    case 'WebSocket':
      return `${base} bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400`
    case 'Health':
      return `${base} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400`
    case 'AI':
      return `${base} bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400`
    case 'VM':
      return `${base} bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400`
    case 'Auth':
      return `${base} bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400`
    case 'Scheduler':
      return `${base} bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400`
  }
}

function formatLogTimestamp(iso: string): string {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

function formatFullTimestamp(iso: string): string {
  return new Date(iso).toLocaleString()
}

// ── Component ──────────────────────────────────────────────────────────────

type LevelFilter = 'all' | LogLevel

export default function MonitoringLogsPage() {
  const [logs] = useState<LogEntry[]>(MOCK_LOGS)
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all')
  const [sourceFilter, setSourceFilter] = useState<LogSource | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set())
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const refreshData = useCallback(() => {
    setLastRefreshed(new Date())
  }, [])

  // Auto-refresh every 5s when enabled
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(refreshData, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshData])

  // Filtered and searched logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (levelFilter !== 'all' && log.level !== levelFilter) return false
      if (sourceFilter !== 'all' && log.source !== sourceFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          log.message.toLowerCase().includes(q) ||
          log.source.toLowerCase().includes(q) ||
          (log.details?.toLowerCase().includes(q) ?? false)
        )
      }
      return true
    })
  }, [logs, levelFilter, sourceFilter, searchQuery])

  // Level counts (on full log set)
  const levelCounts = useMemo(() => {
    const counts = { all: logs.length, error: 0, warn: 0, info: 0, debug: 0 }
    for (const log of logs) {
      counts[log.level]++
    }
    return counts
  }, [logs])

  // Visible (paginated) logs
  const visibleLogs = filteredLogs.slice(0, visibleCount)
  const hasMore = visibleCount < filteredLogs.length

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [levelFilter, sourceFilter, searchQuery])

  const toggleEntry = useCallback((id: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleExport = useCallback(() => {
    const data = filteredLogs.map((log) => ({
      timestamp: log.timestamp,
      level: log.level,
      source: log.source,
      message: log.message,
      details: log.details ?? null,
    }))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `application-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [filteredLogs])

  // ── Level filter tabs ──────────────────────────────────────────────────

  const levelTabs: { key: LevelFilter; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: '' },
    { key: 'error', label: 'Error', color: 'text-red-600 dark:text-red-400' },
    { key: 'warn', label: 'Warning', color: 'text-yellow-600 dark:text-yellow-400' },
    { key: 'info', label: 'Info', color: 'text-blue-600 dark:text-blue-400' },
    { key: 'debug', label: 'Debug', color: 'text-gray-500 dark:text-gray-400' },
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
        <span className="text-gray-900 dark:text-gray-100 font-medium">Application Logs</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FileText className="h-7 w-7" />
            Application Logs
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Centralized log viewer for all application services
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-refresh indicator */}
          <div className="flex items-center gap-2">
            {autoRefresh && (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Live
              </span>
            )}
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {lastRefreshed.toLocaleTimeString()}
            </span>
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh (5s)'}
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
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Level Filter Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="flex space-x-8">
          {levelTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setLevelFilter(tab.key)}
              className={`py-2 px-1 border-b-2 text-sm font-medium transition-colors ${
                levelFilter === tab.key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              <span className={levelFilter === tab.key ? '' : tab.color}>
                {tab.label}
              </span>
              <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded-full">
                {levelCounts[tab.key]}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Search and Source Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search log messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
          />
        </div>
        {/* Source Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as LogSource | 'all')}
            className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
          >
            <option value="all">All Sources</option>
            {LOG_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results count */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        Showing {visibleLogs.length} of {filteredLogs.length} log entries
        {(levelFilter !== 'all' || sourceFilter !== 'all' || searchQuery) && (
          <button
            onClick={() => {
              setLevelFilter('all')
              setSourceFilter('all')
              setSearchQuery('')
            }}
            className="ml-2 text-blue-600 dark:text-blue-400 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Log Entries */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        {visibleLogs.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No log entries matching the current filters.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {visibleLogs.map((log) => {
              const isExpanded = expandedEntries.has(log.id)
              return (
                <div key={log.id} className="group">
                  <button
                    onClick={() => log.details ? toggleEntry(log.id) : undefined}
                    className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors ${
                      log.details
                        ? 'hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer'
                        : 'cursor-default'
                    } ${isExpanded ? 'bg-gray-50 dark:bg-gray-800/50' : ''}`}
                  >
                    {/* Expand icon */}
                    <span className="flex-shrink-0 mt-0.5 text-gray-400 dark:text-gray-500">
                      {log.details ? (
                        isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <span className="inline-block w-3.5" />
                      )}
                    </span>

                    {/* Timestamp */}
                    <span className="flex-shrink-0 font-mono text-xs text-gray-400 dark:text-gray-500 mt-0.5 w-24">
                      {formatLogTimestamp(log.timestamp)}
                    </span>

                    {/* Level badge */}
                    <span className={`flex-shrink-0 ${levelBadgeClass(log.level)}`}>
                      {levelIcon(log.level)}
                      {log.level === 'warn' ? 'WARN' : log.level.toUpperCase()}
                    </span>

                    {/* Source tag */}
                    <span className={`flex-shrink-0 ${sourceTagClass(log.source)}`}>
                      {log.source}
                    </span>

                    {/* Message */}
                    <span className="font-mono text-xs text-gray-800 dark:text-gray-200 break-all min-w-0">
                      {log.message}
                    </span>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && log.details && (
                    <div className="px-4 pb-3 pt-0 ml-[3.25rem]">
                      <div className="bg-gray-900 dark:bg-black rounded-md p-3 overflow-x-auto">
                        <pre className="font-mono text-xs text-green-400 dark:text-green-300 whitespace-pre-wrap">
                          {log.details}
                        </pre>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                        {formatFullTimestamp(log.timestamp)}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 text-center">
            <button
              onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              <ChevronDown className="h-4 w-4" />
              Load More ({filteredLogs.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
