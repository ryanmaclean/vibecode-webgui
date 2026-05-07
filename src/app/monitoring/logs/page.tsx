'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { DemoBanner } from '@/components/ui/DemoBanner'
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

// ── Constants ─────────────────────────────────────────────────────────────

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
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all')
  const [sourceFilter, setSourceFilter] = useState<LogSource | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set())
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const fetchLogs = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/monitoring/logs')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Failed to fetch logs (${res.status})`)
      }
      const data = await res.json()
      setLogs(data.logs ?? [])
      setLastRefreshed(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch logs on mount
  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const refreshData = useCallback(() => {
    fetchLogs()
  }, [fetchLogs])

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
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="h-8 w-8 text-gray-400 dark:text-gray-500 mx-auto mb-3 animate-spin" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading log entries...
            </p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertCircle className="h-10 w-10 text-red-400 dark:text-red-500 mx-auto mb-3" />
            <p className="text-sm text-red-600 dark:text-red-400 mb-3">
              {error}
            </p>
            <button
              onClick={refreshData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : visibleLogs.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {logs.length === 0
                ? 'No log entries available.'
                : 'No log entries matching the current filters.'}
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
