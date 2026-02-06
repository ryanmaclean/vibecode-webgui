'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { FileText, Download, Trash2, Search, Filter } from 'lucide-react'

type ServiceTab = 'ssh' | 'postgresql' | 'valkey' | 'openvscode' | 'docker'
type LogLevel = 'info' | 'warning' | 'error' | 'debug'
type LogLevelFilter = LogLevel | 'all'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
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

function randomTimestamp(): string {
  const now = new Date()
  now.setSeconds(now.getSeconds() - Math.floor(Math.random() * 5))
  return now.toISOString().replace('T', ' ').slice(0, 19)
}

const MOCK_LOG_TEMPLATES: Record<ServiceTab, { level: LogLevel; message: string }[]> = {
  ssh: [
    { level: 'info', message: 'Connection accepted from 192.168.64.1:52341' },
    { level: 'info', message: 'Pubkey auth succeeded for root from 192.168.64.1' },
    { level: 'info', message: 'Session opened for user root' },
    { level: 'debug', message: 'KEX algorithm: curve25519-sha256' },
    { level: 'info', message: 'Session closed for user root' },
    { level: 'warning', message: 'Authentication failed for user admin from 10.0.0.5' },
    { level: 'error', message: 'Max authentication attempts exceeded for root from 10.0.0.99' },
    { level: 'info', message: 'Dropbear SSH server listening on port 2222' },
    { level: 'debug', message: 'Idle timeout reached, sending keepalive' },
    { level: 'info', message: 'Child connection from 192.168.64.1:52890' },
  ],
  postgresql: [
    { level: 'info', message: 'database system is ready to accept connections' },
    { level: 'info', message: 'checkpoint starting: time' },
    { level: 'info', message: 'checkpoint complete: wrote 42 buffers (0.3%)' },
    { level: 'info', message: 'connection received: host=192.168.64.1 port=49832' },
    { level: 'info', message: 'connection authorized: user=postgres database=vibecode' },
    { level: 'warning', message: 'could not obtain lock on relation "migrations"' },
    { level: 'error', message: 'duplicate key value violates unique constraint "users_email_key"' },
    { level: 'info', message: 'autovacuum: VACUUM ANALYZE public.sessions' },
    { level: 'debug', message: 'query plan: Seq Scan on users (cost=0.00..35.50 rows=2550)' },
    { level: 'info', message: 'disconnection: session time: 0:05:23.847 user=postgres' },
  ],
  valkey: [
    { level: 'info', message: 'Server initialized, ready to accept connections on port 6379' },
    { level: 'info', message: 'DB 0: 127 keys (0 volatile) in 256 slots HT' },
    { level: 'info', message: 'Background saving started by pid 142' },
    { level: 'info', message: 'DB saved on disk (RDB snapshot)' },
    { level: 'info', message: 'Client connected: id=15 addr=192.168.64.1:51024' },
    { level: 'warning', message: 'Memory usage is above 75% of maxmemory (196mb/256mb)' },
    { level: 'debug', message: 'Accepted connection from 192.168.64.1:51024' },
    { level: 'info', message: 'Evicting key session:abc123 (LRU policy)' },
    { level: 'error', message: 'MISCONF write commands not allowed due to errors in RDB persistence' },
    { level: 'info', message: 'Slowlog: GET cache:models duration=12450us' },
  ],
  openvscode: [
    { level: 'info', message: 'Web UI available at http://0.0.0.0:3000' },
    { level: 'info', message: 'Extension host started (pid: 289)' },
    { level: 'info', message: 'Installing extension ms-python.python@2024.18.0' },
    { level: 'info', message: 'File watcher started for /workspace' },
    { level: 'info', message: 'Language server initialized: typescript-language-features' },
    { level: 'warning', message: 'Extension host process exited with code 0, restarting' },
    { level: 'debug', message: 'IPC message received: openFile /workspace/src/index.ts' },
    { level: 'info', message: 'Terminal process started (pid: 412, shell: /bin/bash)' },
    { level: 'error', message: 'Extension activation failed: ms-vscode.cpptools' },
    { level: 'info', message: 'Git repository detected at /workspace' },
  ],
  docker: [
    { level: 'info', message: 'Starting Docker Engine 24.0.7' },
    { level: 'info', message: 'API listen on [::]:2375' },
    { level: 'info', message: 'Container 8a3f2b1c started: nginx:alpine' },
    { level: 'info', message: 'Pulling image node:20-alpine from docker.io' },
    { level: 'info', message: 'Network bridge created: vibecode-net (172.18.0.0/16)' },
    { level: 'warning', message: 'Container 3e7d1a09 exceeded memory limit (512MB)' },
    { level: 'error', message: 'Failed to start container c4f8a2b: OCI runtime error' },
    { level: 'info', message: 'Volume vibecode-data mounted at /var/lib/data' },
    { level: 'debug', message: 'Health check passed for container 8a3f2b1c (200 OK)' },
    { level: 'info', message: 'Container 5b2a9f7e stopped: postgres:16-alpine (exit 0)' },
  ],
}

function generateInitialLogs(service: ServiceTab): LogEntry[] {
  const templates = MOCK_LOG_TEMPLATES[service]
  const entries: LogEntry[] = []
  const now = Date.now()
  for (let i = 0; i < 30; i++) {
    const template = templates[Math.floor(Math.random() * templates.length)]
    const time = new Date(now - (30 - i) * 2000)
    entries.push({
      timestamp: time.toISOString().replace('T', ' ').slice(0, 19),
      level: template.level,
      message: template.message,
    })
  }
  return entries
}

function generateNewLog(service: ServiceTab): LogEntry {
  const templates = MOCK_LOG_TEMPLATES[service]
  const template = templates[Math.floor(Math.random() * templates.length)]
  return {
    timestamp: randomTimestamp(),
    level: template.level,
    message: template.message,
  }
}

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
  const [logs, setLogs] = useState<Record<ServiceTab, LogEntry[]>>(() => ({
    ssh: generateInitialLogs('ssh'),
    postgresql: generateInitialLogs('postgresql'),
    valkey: generateInitialLogs('valkey'),
    openvscode: generateInitialLogs('openvscode'),
    docker: generateInitialLogs('docker'),
  }))
  const [serviceStatuses, setServiceStatuses] = useState<Record<string, ServiceStatus>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState<LogLevelFilter>('all')
  const logContainerRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)

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

  // Auto-refresh logs every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLogs((prev) => {
        const updated = { ...prev }
        for (const key of SERVICE_TABS.map((t) => t.key)) {
          const newEntries = []
          const count = Math.floor(Math.random() * 3) + 1
          for (let i = 0; i < count; i++) {
            newEntries.push(generateNewLog(key))
          }
          updated[key] = [...prev[key], ...newEntries].slice(-500)
        }
        return updated
      })
    }, 5000)
    return () => clearInterval(interval)
  }, [])

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
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No log entries{searchQuery || levelFilter !== 'all' ? ' matching filters' : ''}</p>
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
