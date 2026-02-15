'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { DemoBanner } from '@/components/ui/DemoBanner'
import {
  Activity,
  ChevronRight,
  RefreshCw,
  Filter,
  Search,
  Clock,
  Zap,
  Server,
  Database,
  Cloud,
  Globe,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  BarChart3,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

type TraceStatus = 'success' | 'error' | 'warning'
type ServiceType = 'frontend' | 'backend' | 'database' | 'cache' | 'external'

interface Span {
  id: string
  name: string
  service: string
  duration_ms: number
  start_offset_ms: number
  status: TraceStatus
  tags?: Record<string, string>
}

interface Trace {
  trace_id: string
  root_span: string
  service: string
  operation: string
  duration_ms: number
  span_count: number
  status: TraceStatus
  timestamp: string
  spans: Span[]
}

interface ServiceNode {
  id: string
  name: string
  type: ServiceType
  status: 'healthy' | 'degraded' | 'down'
  trace_count: number
  avg_latency_ms: number
  error_rate: number
}

interface ServiceEdge {
  from: string
  to: string
  type: string
  call_count: number
  avg_latency_ms: number
}

interface TracesAPIResponse {
  timestamp: string
  traces: Trace[]
  configuration: {
    enabled: boolean
    service_name: string
    service_version: string
    environment: string
  }
  services: Array<{
    name: string
    type: string
    status: string
  }>
  visualization: {
    service_map: {
      nodes: ServiceNode[]
      edges: ServiceEdge[]
    }
  }
}

// ── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_TRACES: Trace[] = [
  {
    trace_id: 'trace-abc-123-def-456',
    root_span: 'GET /api/chat',
    service: 'vibecode-webgui',
    operation: 'POST /api/chat',
    duration_ms: 1245,
    span_count: 8,
    status: 'success',
    timestamp: new Date(Date.now() - 15000).toISOString(),
    spans: [
      {
        id: 'span-1',
        name: 'POST /api/chat',
        service: 'vibecode-webgui',
        duration_ms: 1245,
        start_offset_ms: 0,
        status: 'success',
        tags: { 'http.method': 'POST', 'http.status_code': '200' },
      },
      {
        id: 'span-2',
        name: 'auth.validateToken',
        service: 'vibecode-webgui',
        duration_ms: 12,
        start_offset_ms: 2,
        status: 'success',
        tags: { 'auth.user_id': 'user-123' },
      },
      {
        id: 'span-3',
        name: 'cache.get',
        service: 'valkey',
        duration_ms: 3,
        start_offset_ms: 15,
        status: 'success',
        tags: { 'cache.hit': 'false' },
      },
      {
        id: 'span-4',
        name: 'POST /api/ai/chat',
        service: 'vibecode-agentapi',
        duration_ms: 1180,
        start_offset_ms: 20,
        status: 'success',
        tags: { 'ai.model': 'claude-3.5-sonnet', 'ai.tokens': '1847' },
      },
      {
        id: 'span-5',
        name: 'ai.completion',
        service: 'openrouter',
        duration_ms: 1150,
        start_offset_ms: 30,
        status: 'success',
        tags: { 'ai.provider': 'openrouter', 'ai.latency_ms': '1150' },
      },
      {
        id: 'span-6',
        name: 'INSERT conversation',
        service: 'postgresql',
        duration_ms: 8,
        start_offset_ms: 1200,
        status: 'success',
        tags: { 'db.statement': 'INSERT', 'db.table': 'conversations' },
      },
      {
        id: 'span-7',
        name: 'cache.set',
        service: 'valkey',
        duration_ms: 2,
        start_offset_ms: 1210,
        status: 'success',
        tags: { 'cache.key': 'conv:abc123', 'cache.ttl': '3600' },
      },
      {
        id: 'span-8',
        name: 'response.send',
        service: 'vibecode-webgui',
        duration_ms: 1,
        start_offset_ms: 1244,
        status: 'success',
        tags: { 'http.response_size': '2048' },
      },
    ],
  },
  {
    trace_id: 'trace-ghi-789-jkl-012',
    root_span: 'GET /api/workspaces',
    service: 'vibecode-webgui',
    operation: 'GET /api/workspaces',
    duration_ms: 45,
    span_count: 3,
    status: 'success',
    timestamp: new Date(Date.now() - 30000).toISOString(),
    spans: [
      {
        id: 'span-1',
        name: 'GET /api/workspaces',
        service: 'vibecode-webgui',
        duration_ms: 45,
        start_offset_ms: 0,
        status: 'success',
      },
      {
        id: 'span-2',
        name: 'cache.get',
        service: 'valkey',
        duration_ms: 2,
        start_offset_ms: 2,
        status: 'success',
        tags: { 'cache.hit': 'true' },
      },
      {
        id: 'span-3',
        name: 'response.send',
        service: 'vibecode-webgui',
        duration_ms: 1,
        start_offset_ms: 44,
        status: 'success',
      },
    ],
  },
  {
    trace_id: 'trace-mno-345-pqr-678',
    root_span: 'POST /api/embeddings',
    service: 'vibecode-webgui',
    operation: 'POST /api/embeddings',
    duration_ms: 3250,
    span_count: 5,
    status: 'error',
    timestamp: new Date(Date.now() - 45000).toISOString(),
    spans: [
      {
        id: 'span-1',
        name: 'POST /api/embeddings',
        service: 'vibecode-webgui',
        duration_ms: 3250,
        start_offset_ms: 0,
        status: 'error',
        tags: { 'http.status_code': '500' },
      },
      {
        id: 'span-2',
        name: 'azure.embeddings',
        service: 'azure-openai',
        duration_ms: 3200,
        start_offset_ms: 10,
        status: 'error',
        tags: { 'error.type': 'RateLimitError', 'error.message': 'Rate limit exceeded' },
      },
      {
        id: 'span-3',
        name: 'error.log',
        service: 'vibecode-webgui',
        duration_ms: 2,
        start_offset_ms: 3220,
        status: 'success',
      },
      {
        id: 'span-4',
        name: 'INSERT error_log',
        service: 'postgresql',
        duration_ms: 15,
        start_offset_ms: 3230,
        status: 'success',
      },
      {
        id: 'span-5',
        name: 'response.error',
        service: 'vibecode-webgui',
        duration_ms: 1,
        start_offset_ms: 3249,
        status: 'error',
      },
    ],
  },
  {
    trace_id: 'trace-stu-901-vwx-234',
    root_span: 'GET /health',
    service: 'vibecode-webgui',
    operation: 'GET /health',
    duration_ms: 892,
    span_count: 4,
    status: 'warning',
    timestamp: new Date(Date.now() - 60000).toISOString(),
    spans: [
      {
        id: 'span-1',
        name: 'GET /health',
        service: 'vibecode-webgui',
        duration_ms: 892,
        start_offset_ms: 0,
        status: 'warning',
      },
      {
        id: 'span-2',
        name: 'health.checkDatabase',
        service: 'postgresql',
        duration_ms: 850,
        start_offset_ms: 5,
        status: 'warning',
        tags: { 'warning': 'slow_response', 'threshold_ms': '100' },
      },
      {
        id: 'span-3',
        name: 'health.checkCache',
        service: 'valkey',
        duration_ms: 3,
        start_offset_ms: 860,
        status: 'success',
      },
      {
        id: 'span-4',
        name: 'response.send',
        service: 'vibecode-webgui',
        duration_ms: 1,
        start_offset_ms: 891,
        status: 'success',
      },
    ],
  },
]

const MOCK_SERVICE_NODES: ServiceNode[] = [
  {
    id: 'webgui',
    name: 'Web UI',
    type: 'frontend',
    status: 'healthy',
    trace_count: 1247,
    avg_latency_ms: 234,
    error_rate: 0.8,
  },
  {
    id: 'api',
    name: 'Next.js API',
    type: 'backend',
    status: 'healthy',
    trace_count: 1247,
    avg_latency_ms: 156,
    error_rate: 1.2,
  },
  {
    id: 'agentapi',
    name: 'Agent API',
    type: 'backend',
    status: 'healthy',
    trace_count: 456,
    avg_latency_ms: 890,
    error_rate: 0.5,
  },
  {
    id: 'database',
    name: 'PostgreSQL',
    type: 'database',
    status: 'degraded',
    trace_count: 892,
    avg_latency_ms: 45,
    error_rate: 0.1,
  },
  {
    id: 'cache',
    name: 'Valkey',
    type: 'cache',
    status: 'healthy',
    trace_count: 2341,
    avg_latency_ms: 3,
    error_rate: 0.0,
  },
  {
    id: 'ai',
    name: 'AI Service',
    type: 'external',
    status: 'healthy',
    trace_count: 234,
    avg_latency_ms: 1200,
    error_rate: 2.1,
  },
]

const MOCK_SERVICE_EDGES: ServiceEdge[] = [
  { from: 'webgui', to: 'api', type: 'http', call_count: 1247, avg_latency_ms: 156 },
  { from: 'api', to: 'database', type: 'sql', call_count: 892, avg_latency_ms: 45 },
  { from: 'api', to: 'cache', type: 'redis', call_count: 2341, avg_latency_ms: 3 },
  { from: 'api', to: 'agentapi', type: 'http', call_count: 456, avg_latency_ms: 890 },
  { from: 'agentapi', to: 'ai', type: 'http', call_count: 234, avg_latency_ms: 1200 },
  { from: 'agentapi', to: 'database', type: 'sql', call_count: 123, avg_latency_ms: 38 },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function statusColor(status: TraceStatus): string {
  switch (status) {
    case 'success':
      return 'text-green-600 dark:text-green-400'
    case 'error':
      return 'text-red-600 dark:text-red-400'
    case 'warning':
      return 'text-yellow-600 dark:text-yellow-400'
  }
}

function statusBadge(status: TraceStatus): string {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium'
  switch (status) {
    case 'success':
      return `${base} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400`
    case 'error':
      return `${base} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400`
    case 'warning':
      return `${base} bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400`
  }
}

function statusIcon(status: TraceStatus) {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-3 w-3" />
    case 'error':
      return <XCircle className="h-3 w-3" />
    case 'warning':
      return <AlertTriangle className="h-3 w-3" />
  }
}

function serviceStatusBadge(status: 'healthy' | 'degraded' | 'down'): string {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium'
  switch (status) {
    case 'healthy':
      return `${base} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400`
    case 'degraded':
      return `${base} bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400`
    case 'down':
      return `${base} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400`
  }
}

function serviceTypeIcon(type: ServiceType) {
  switch (type) {
    case 'frontend':
      return <Globe className="h-4 w-4" />
    case 'backend':
      return <Server className="h-4 w-4" />
    case 'database':
      return <Database className="h-4 w-4" />
    case 'cache':
      return <Zap className="h-4 w-4" />
    case 'external':
      return <Cloud className="h-4 w-4" />
  }
}

function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`
  if (ms < 1000) return `${ms.toFixed(1)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)

  if (diffSec < 60) return `${diffSec}s ago`
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  return d.toLocaleString()
}

function latencyColor(ms: number): string {
  if (ms < 100) return 'text-green-600 dark:text-green-400'
  if (ms < 500) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function errorRateColor(rate: number): string {
  if (rate < 1) return 'text-green-600 dark:text-green-400'
  if (rate < 5) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

// ── Component ──────────────────────────────────────────────────────────────

export default function TracesPage() {
  const [traces, setTraces] = useState<Trace[]>(MOCK_TRACES)
  const [serviceNodes] = useState<ServiceNode[]>(MOCK_SERVICE_NODES)
  const [serviceEdges] = useState<ServiceEdge[]>(MOCK_SERVICE_EDGES)
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null)
  const [serviceFilter, setServiceFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<TraceStatus | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())
  const [loading, setLoading] = useState(false)

  const refreshData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/monitoring/traces?timeframe=1h')
      if (response.ok) {
        const data: TracesAPIResponse = await response.json()
        setLastRefreshed(new Date())
      }
    } catch (error) {
      // In production, this would fetch real data
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(refreshData, 10000)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshData])

  const filteredTraces = useMemo(() => {
    return traces.filter((trace) => {
      if (serviceFilter !== 'all' && trace.service !== serviceFilter) return false
      if (statusFilter !== 'all' && trace.status !== statusFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          trace.trace_id.toLowerCase().includes(q) ||
          trace.operation.toLowerCase().includes(q) ||
          trace.service.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [traces, serviceFilter, statusFilter, searchQuery])

  const uniqueServices = useMemo(() => {
    const services = new Set(traces.map((t) => t.service))
    return Array.from(services).sort()
  }, [traces])

  const traceStats = useMemo(() => {
    const total = traces.length
    const success = traces.filter((t) => t.status === 'success').length
    const errors = traces.filter((t) => t.status === 'error').length
    const warnings = traces.filter((t) => t.status === 'warning').length
    const avgDuration =
      traces.reduce((sum, t) => sum + t.duration_ms, 0) / (total || 1)

    return { total, success, errors, warnings, avgDuration }
  }, [traces])

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
        <span className="text-gray-900 dark:text-gray-100 font-medium">
          Distributed Traces
        </span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Activity className="h-7 w-7" />
            Distributed Traces
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            OpenTelemetry trace visualization and service dependencies
          </p>
        </div>
        <div className="flex items-center gap-3">
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
            title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh (10s)'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
              autoRefresh
                ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30'
                : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
            }`}
          >
            <RefreshCw className={`h-4 w-4 ${autoRefresh || loading ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <StatCard
          label="Total Traces"
          value={traceStats.total.toString()}
          icon={<Activity className="h-5 w-5 text-blue-500" />}
        />
        <StatCard
          label="Success"
          value={traceStats.success.toString()}
          icon={<CheckCircle className="h-5 w-5 text-green-500" />}
          valueClass="text-green-600 dark:text-green-400"
        />
        <StatCard
          label="Errors"
          value={traceStats.errors.toString()}
          icon={<XCircle className="h-5 w-5 text-red-500" />}
          valueClass="text-red-600 dark:text-red-400"
        />
        <StatCard
          label="Warnings"
          value={traceStats.warnings.toString()}
          icon={<AlertTriangle className="h-5 w-5 text-yellow-500" />}
          valueClass="text-yellow-600 dark:text-yellow-400"
        />
        <StatCard
          label="Avg Duration"
          value={formatDuration(traceStats.avgDuration)}
          icon={<Clock className="h-5 w-5 text-purple-500" />}
        />
      </div>

      {/* Service Map */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            Service Map
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Service dependencies and communication patterns
          </p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {serviceNodes.map((node) => (
              <div
                key={node.id}
                className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  {serviceTypeIcon(node.type)}
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {node.name}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Status</span>
                    <span className={serviceStatusBadge(node.status)}>{node.status}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Traces</span>
                    <span className="text-gray-900 dark:text-gray-100">{node.trace_count}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Latency</span>
                    <span className={latencyColor(node.avg_latency_ms)}>
                      {formatDuration(node.avg_latency_ms)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Error Rate</span>
                    <span className={errorRateColor(node.error_rate)}>
                      {node.error_rate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Service Dependencies
            </h3>
            {serviceEdges.map((edge, idx) => {
              const fromNode = serviceNodes.find((n) => n.id === edge.from)
              const toNode = serviceNodes.find((n) => n.id === edge.to)
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/30 p-2 rounded"
                >
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {fromNode?.name}
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {toNode?.name}
                  </span>
                  <span className="text-gray-500">({edge.type})</span>
                  <span className="ml-auto">
                    {edge.call_count} calls, avg {formatDuration(edge.avg_latency_ms)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search traces by ID, operation, or service..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
          >
            <option value="all">All Services</option>
            {uniqueServices.map((service) => (
              <option key={service} value={service}>
                {service}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TraceStatus | 'all')}
            className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        Showing {filteredTraces.length} of {traces.length} traces
        {(serviceFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
          <button
            onClick={() => {
              setServiceFilter('all')
              setStatusFilter('all')
              setSearchQuery('')
            }}
            className="ml-2 text-blue-600 dark:text-blue-400 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Traces List */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Traces</h2>
        </div>
        {filteredTraces.length === 0 ? (
          <div className="p-8 text-center">
            <Activity className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No traces matching the current filters.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredTraces.map((trace) => (
              <div
                key={trace.trace_id}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                onClick={() => setSelectedTrace(trace)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-blue-600 dark:text-blue-400">
                        {trace.trace_id}
                      </span>
                      <span className={statusBadge(trace.status)}>
                        {statusIcon(trace.status)}
                        {trace.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                      {trace.operation}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Server className="h-3 w-3" />
                        {trace.service}
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        {trace.span_count} spans
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(trace.timestamp)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-lg font-semibold ${latencyColor(trace.duration_ms)}`}>
                      {formatDuration(trace.duration_ms)}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedTrace(trace)
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trace Details Modal */}
      {selectedTrace && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedTrace(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Trace Details
                  </h2>
                  <p className="font-mono text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {selectedTrace.trace_id}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTrace(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Trace Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">
                    Status
                  </p>
                  <span className={`mt-1 ${statusBadge(selectedTrace.status)}`}>
                    {statusIcon(selectedTrace.status)}
                    {selectedTrace.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">
                    Duration
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                    {formatDuration(selectedTrace.duration_ms)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">
                    Spans
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                    {selectedTrace.span_count}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">
                    Timestamp
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                    {formatTimestamp(selectedTrace.timestamp)}
                  </p>
                </div>
              </div>

              {/* Timeline Visualization */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Trace Timeline
                </h3>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-2">
                  {selectedTrace.spans.map((span) => {
                    const widthPercent = (span.duration_ms / selectedTrace.duration_ms) * 100
                    const offsetPercent =
                      (span.start_offset_ms / selectedTrace.duration_ms) * 100

                    return (
                      <div key={span.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-900 dark:text-gray-100 font-medium">
                            {span.name}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">
                            {formatDuration(span.duration_ms)}
                          </span>
                        </div>
                        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded relative">
                          <div
                            className={`absolute h-full rounded flex items-center px-2 ${
                              span.status === 'error'
                                ? 'bg-red-500'
                                : span.status === 'warning'
                                  ? 'bg-yellow-500'
                                  : 'bg-blue-500'
                            }`}
                            style={{
                              left: `${offsetPercent}%`,
                              width: `${Math.max(widthPercent, 2)}%`,
                            }}
                          >
                            <span className="text-xs text-white truncate">{span.service}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Span List */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Spans ({selectedTrace.spans.length})
                </h3>
                <div className="space-y-2">
                  {selectedTrace.spans.map((span) => (
                    <div
                      key={span.id}
                      className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={statusBadge(span.status)}>
                            {statusIcon(span.status)}
                          </span>
                          <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                            {span.name}
                          </span>
                        </div>
                        <span className={`text-sm font-semibold ${latencyColor(span.duration_ms)}`}>
                          {formatDuration(span.duration_ms)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>Service: {span.service}</span>
                        <span>•</span>
                        <span>Start: +{formatDuration(span.start_offset_ms)}</span>
                      </div>
                      {span.tags && Object.keys(span.tags).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {Object.entries(span.tags).map(([key, value]) => (
                            <span
                              key={key}
                              className="inline-flex items-center text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded"
                            >
                              <span className="font-medium">{key}:</span>
                              <span className="ml-1">{value}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  valueClass,
}: {
  label: string
  value: string
  icon: React.ReactNode
  valueClass?: string
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">{icon}</div>
      <p className={`text-2xl font-bold ${valueClass ?? 'text-gray-900 dark:text-gray-100'}`}>
        {value}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}
