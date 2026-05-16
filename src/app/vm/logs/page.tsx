'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { FileText, Download, Trash2, Search, Filter, Loader2, RefreshCw } from 'lucide-react'

type ServiceTab = 'ssh' | 'postgresql' | 'valkey' | 'openvscode' | 'docker'
type LogLevel = 'info' | 'warning' | 'error' | 'debug'
type LogLevelFilter = LogLevel | 'all'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  service?: ServiceTab
}

interface ServiceStatus {
  name: string
  status: 'healthy' | 'unhealthy' | 'unknown'
}

const SERVICE_TABS: { key: ServiceTab; label: string }[] = [
  { key: 'ssh', label: 'SSH' },
  { key: 'postgresql', label: 'PostgreSQL' },
  { key: 'valkey', label: 'Valkey' },
  { key: 'openvscode', label: 'OpenVSCode' },
  { key: 'docker', label: 'Docker' },
]

const LEVEL_COLORS: Record<LogLevel, string> = {
  info: 'text-green-400',
  warning: 'text-yellow-400',
  error: 'text-red-400',
  debug: 'text-gray-500',
}

const LEVEL_LABELS: Record<LogLevel, string> = {
  info: 'INFO',
  warning: 'WARN',
  error: 'ERROR',
  debug: 'DEBUG',
}

export default function VMLogsPage() {
  const [activeTab, setActiveTab] = useState<ServiceTab>('ssh')
  const [logs, setLogs] = useState<Record<ServiceTab, LogEntry[]>>({
    ssh: [],
    postgresql: [],
    valkey: [],
    openvscode: [],
    docker: [],
  })
  const [serviceStatuses, setServiceStatuses] = useState<Record<string, ServiceStatus>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState<LogLevelFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)

  // Fetch logs from the API for all services
  const fetchLogs = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true)
      }
      setError(null)

      const res = await fetch('/api/vm/logs?limit=500')
      if (!res.ok) {
        if (res.status === 401) {
          setError('Unauthorized. Please sign in to view logs.')
          return
        }
        throw new Error(`Failed to fetch logs (HTTP ${res.status})`)
      }

      const data = await res.json()
      const fetched: LogEntry[] = data.logs ?? []

      // Bucket logs by service
      const buckets: Record<ServiceTab, LogEntry[]> = {
        ssh: [],
        postgresql: [],
        valkey: [],
        openvscode: [],
        docker: [],
      }

      for (const entry of fetched) {
        const svc = entry.service as ServiceTab | undefined
        if (svc && svc in buckets) {
          buckets[svc].push(entry)
        }
      }

      setLogs(buckets)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs')
    } finally {
      if (isInitial) {
        setLoading(false)
      }
    }
  }, [])

  // Fetch service health statuses
  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const res = await fetch('/api/health/services')
        if (res.ok || res.status === 207 || res.status === 503) {
          const data = await res.json()
          const statuses: Record<string, ServiceStatus> = {}
          if (data.services) {
            for (const svc of data.services) {
              statuses[svc.name] = { name: svc.name, status: svc.status }
            }
          }
          setServiceStatuses(statuses)
        }
      } catch {
        // Health fetch is best-effort
      }
    }
    fetchStatuses()
    const interval = setInterval(fetchStatuses, 15000)
    return () => clearInterval(interval)
  }, [])

  // Initial log fetch
  useEffect(() => {
    fetchLogs(true)
  }, [fetchLogs])

  // Auto-refresh logs by polling the API every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLogs(false)
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchLogs])

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScrollRef.current && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs, activeTab, searchQuery, levelFilter])

  const handleScroll = useCallback(() => {
    if (!logContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 40
  }, [])

  const handleClear = useCallback(() => {
    setLogs((prev) => ({ ...prev, [activeTab]: [] }))
  }, [activeTab])

  const handleDownload = useCallback(() => {
    const entries = logs[activeTab]
    const text = entries
      .map((e) => `[${e.timestamp}] [${LEVEL_LABELS[e.level]}] ${e.message}`)
      .join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeTab}-logs-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [activeTab, logs])

  const filteredLogs = logs[activeTab].filter((entry) => {
    if (levelFilter !== 'all' && entry.level !== levelFilter) return false
    if (searchQuery && !entry.message.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const getStatusIndicator = (service: ServiceTab) => {
    const status = serviceStatuses[service]
    if (!status) return 'bg-gray-400'
    switch (status.status) {
      case 'healthy':
        return 'bg-green-500'
      case 'unhealthy':
        return 'bg-red-500'
      default:
        return 'bg-gray-400'
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Service Logs</h1>
        <p className="mt-1 text-sm text-gray-600">
          View and search logs from all VM services
        </p>
      </div>

      {/* Service Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px overflow-x-auto">
            {SERVICE_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${getStatusIndicator(tab.key)}`} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 border-b border-gray-200">
          {/* Search */}
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Level Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as LogLevelFilter)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              <option value="all">All Levels</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-gray-400">
              {filteredLogs.length} entries
            </span>
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title="Clear logs"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title="Download logs"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
          </div>
        </div>

        {/* Log Output */}
        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="bg-gray-900 rounded-b-lg p-4 h-[500px] overflow-y-auto font-mono text-sm leading-relaxed"
        >
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
                <p>Loading logs...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-red-400">
              <div className="text-center">
                <p className="mb-3">{error}</p>
                <button
                  onClick={() => fetchLogs(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </button>
              </div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>
                  {searchQuery || levelFilter !== 'all'
                    ? 'No log entries matching filters'
                    : 'No log entries available'}
                </p>
              </div>
            </div>
          ) : (
            filteredLogs.map((entry, idx) => (
              <div key={idx} className="flex gap-2 py-0.5 hover:bg-gray-800/50">
                <span className="text-gray-500 select-none shrink-0">{entry.timestamp}</span>
                <span className={`shrink-0 w-14 text-right ${LEVEL_COLORS[entry.level]}`}>
                  [{LEVEL_LABELS[entry.level]}]
                </span>
                <span className="text-green-400 break-all">{entry.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
