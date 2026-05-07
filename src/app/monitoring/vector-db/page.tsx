'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { DemoBanner } from '@/components/ui/DemoBanner'
import {
  Database,
  Search,
  Activity,
  HardDrive,
  Layers,
  Clock,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  ArrowUpDown,
  AlertCircle,
  Loader2,
  Inbox,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

type IndexType = 'HNSW' | 'IVFFlat'
type CollectionStatus = 'healthy' | 'warning' | 'rebuilding'
type SortColumn = 'name' | 'vectorCount' | 'dimensions' | 'diskUsage'

interface Collection {
  name: string
  vectorCount: number
  dimensions: number
  indexType: IndexType
  diskUsageMB: number
  status: CollectionStatus
  lastUpdated: string
}

interface RecentQuery {
  id: string
  queryPreview: string
  collection: string
  similarityScore: number
  latencyMs: number
  resultsCount: number
  timestamp: string
}

interface IndexHealth {
  collection: string
  fragmentationPct: number
  lastRebuild: string
  suggestion: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatVectorCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return count.toString()
}

function formatDiskUsage(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb} MB`
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function statusBadge(status: CollectionStatus): string {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium'
  switch (status) {
    case 'healthy':
      return `${base} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400`
    case 'warning':
      return `${base} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400`
    case 'rebuilding':
      return `${base} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400`
  }
}

function indexTypeBadge(indexType: IndexType): string {
  const base = 'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-medium'
  switch (indexType) {
    case 'HNSW':
      return `${base} bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400`
    case 'IVFFlat':
      return `${base} bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400`
  }
}

function similarityColor(score: number): string {
  if (score >= 0.9) return 'text-green-600 dark:text-green-400'
  if (score >= 0.8) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function latencyColor(ms: number): string {
  if (ms < 10) return 'text-green-600 dark:text-green-400'
  if (ms < 20) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function fragmentationColor(pct: number): string {
  if (pct < 10) return 'text-green-600 dark:text-green-400'
  if (pct < 25) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function fragmentationBarColor(pct: number): string {
  if (pct < 10) return 'bg-green-500'
  if (pct < 25) return 'bg-yellow-500'
  return 'bg-red-500'
}

// ── Component ──────────────────────────────────────────────────────────────

export default function VectorDatabaseMonitorPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [queries, setQueries] = useState<RecentQuery[]>([])
  const [indexHealth, setIndexHealth] = useState<IndexHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortColumn>('vectorCount')
  const [sortDesc, setSortDesc] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/monitoring/vector-db')
      if (!res.ok) {
        throw new Error(`Failed to fetch vector DB data (${res.status})`)
      }
      const data = await res.json()
      setCollections(data.collections ?? [])
      setQueries(data.queries ?? [])
      setIndexHealth(data.indexHealth ?? [])
      setLastRefreshed(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch vector DB data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Computed summary metrics (safe for empty arrays)
  const totalVectors = collections.reduce((sum, c) => sum + c.vectorCount, 0)
  const totalDiskMB = collections.reduce((sum, c) => sum + c.diskUsageMB, 0)
  const avgLatency =
    queries.length > 0
      ? Math.round(queries.reduce((sum, q) => sum + q.latencyMs, 0) / queries.length)
      : 0
  const embeddingRate = 0 // no mock static rate — will be wired to real source

  // Sorted collections
  const sortedCollections = [...collections].sort((a, b) => {
    let aVal: string | number
    let bVal: string | number
    switch (sortBy) {
      case 'name':
        aVal = a.name
        bVal = b.name
        return sortDesc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal)
      case 'vectorCount':
        aVal = a.vectorCount
        bVal = b.vectorCount
        break
      case 'dimensions':
        aVal = a.dimensions
        bVal = b.dimensions
        break
      case 'diskUsage':
        aVal = a.diskUsageMB
        bVal = b.diskUsageMB
        break
    }
    return sortDesc ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number)
  })

  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortDesc(!sortDesc)
    } else {
      setSortBy(column)
      setSortDesc(true)
    }
  }

  const handleRefresh = () => {
    fetchData()
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading vector database data...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="text-sm text-gray-700 dark:text-gray-300">{error}</p>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
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
        <span className="text-gray-900 dark:text-gray-100 font-medium">Vector Database</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Database className="h-7 w-7" />
            Vector Database Monitor
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Collection health, query performance, and index optimization
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Updated {lastRefreshed.toLocaleTimeString()}
          </span>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Vectors"
          value={formatVectorCount(totalVectors)}
          subValue={`${collections.length} collections`}
          icon={<Layers className="h-5 w-5 text-blue-500" />}
        />
        <SummaryCard
          label="Index Size"
          value={formatDiskUsage(totalDiskMB)}
          subValue="across all collections"
          icon={<HardDrive className="h-5 w-5 text-purple-500" />}
        />
        <SummaryCard
          label="Avg Query Latency"
          value={`${avgLatency}ms`}
          subValue="last 100 queries"
          icon={<Activity className="h-5 w-5 text-green-500" />}
        />
        <SummaryCard
          label="Embedding Rate"
          value={`${embeddingRate}/min`}
          subValue="current throughput"
          icon={<Search className="h-5 w-5 text-orange-500" />}
        />
      </div>

      {/* Collections Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-500" />
            Collections
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {collections.length} collections &middot; Click column headers to sort
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <SortableHeader
                  label="Collection Name"
                  column="name"
                  currentSort={sortBy}
                  sortDesc={sortDesc}
                  onSort={handleSort}
                  align="left"
                />
                <SortableHeader
                  label="Vector Count"
                  column="vectorCount"
                  currentSort={sortBy}
                  sortDesc={sortDesc}
                  onSort={handleSort}
                  align="right"
                />
                <SortableHeader
                  label="Dimensions"
                  column="dimensions"
                  currentSort={sortBy}
                  sortDesc={sortDesc}
                  onSort={handleSort}
                  align="right"
                />
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Index Type
                </th>
                <SortableHeader
                  label="Disk Usage"
                  column="diskUsage"
                  currentSort={sortBy}
                  sortDesc={sortDesc}
                  onSort={handleSort}
                  align="right"
                />
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sortedCollections.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
                      <Inbox className="h-6 w-6" />
                      <p className="text-sm">No collections found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedCollections.map((col) => (
                  <tr
                    key={col.name}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-900 dark:text-gray-100">
                      {col.name}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                      {col.vectorCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                      {col.dimensions}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={indexTypeBadge(col.indexType)}>{col.indexType}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                      {formatDiskUsage(col.diskUsageMB)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={statusBadge(col.status)}>
                        {col.status === 'healthy' && <CheckCircle className="h-3 w-3" />}
                        {col.status === 'warning' && <AlertTriangle className="h-3 w-3" />}
                        {col.status === 'rebuilding' && <RefreshCw className="h-3 w-3 animate-spin" />}
                        {col.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Queries */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Search className="h-5 w-5 text-green-500" />
            Recent Queries
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Last {queries.length} similarity search queries
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Query Preview
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Collection
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Similarity
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Latency
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Results
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {queries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
                      <Inbox className="h-6 w-6" />
                      <p className="text-sm">No recent queries</p>
                    </div>
                  </td>
                </tr>
              ) : (
                queries.map((query) => (
                  <tr
                    key={query.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100 max-w-xs truncate">
                      {query.queryPreview}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-400">
                      {query.collection}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium ${similarityColor(query.similarityScore)}`}>
                      {query.similarityScore.toFixed(2)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium ${latencyColor(query.latencyMs)}`}>
                      {query.latencyMs}ms
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                      {query.resultsCount}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center justify-end gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(query.timestamp)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Index Health */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-500" />
            Index Health
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Fragmentation levels and optimization recommendations
          </p>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {indexHealth.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
                <Inbox className="h-6 w-6" />
                <p className="text-sm">No index health data available</p>
              </div>
            </div>
          ) : (
            indexHealth.map((health) => (
              <div key={health.collection} className="px-4 py-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                      {health.collection}
                    </span>
                    <span className={`text-sm font-semibold ${fragmentationColor(health.fragmentationPct)}`}>
                      {health.fragmentationPct.toFixed(1)}% fragmented
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last rebuild: {formatRelativeTime(health.lastRebuild)}
                  </span>
                </div>
                {/* Fragmentation bar */}
                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 mb-2">
                  <div
                    className={`${fragmentationBarColor(health.fragmentationPct)} h-2 rounded-full transition-all`}
                    style={{ width: `${Math.min(health.fragmentationPct, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                  {health.fragmentationPct >= 25 ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                  ) : health.fragmentationPct >= 10 ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />
                  ) : (
                    <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                  )}
                  {health.suggestion}
                </p>
              </div>
            ))
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
  subValue,
  icon,
}: {
  label: string
  value: string
  subValue: string
  icon: React.ReactNode
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subValue}</p>
    </div>
  )
}

function SortableHeader({
  label,
  column,
  currentSort,
  sortDesc,
  onSort,
  align,
}: {
  label: string
  column: SortColumn
  currentSort: SortColumn
  sortDesc: boolean
  onSort: (col: SortColumn) => void
  align: 'left' | 'right'
}) {
  const isActive = currentSort === column
  return (
    <th
      className={`text-${align} px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200`}
      onClick={() => onSort(column)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          <span>{sortDesc ? '\u2193' : '\u2191'}</span>
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </span>
    </th>
  )
}
