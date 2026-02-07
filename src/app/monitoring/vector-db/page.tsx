'use client'

import { useState } from 'react'
import Link from 'next/link'
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

// ── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_COLLECTIONS: Collection[] = [
  {
    name: 'code_embeddings',
    vectorCount: 524288,
    dimensions: 1536,
    indexType: 'HNSW',
    diskUsageMB: 1126,
    status: 'healthy',
    lastUpdated: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    name: 'doc_embeddings',
    vectorCount: 312450,
    dimensions: 1536,
    indexType: 'HNSW',
    diskUsageMB: 672,
    status: 'healthy',
    lastUpdated: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    name: 'chat_history',
    vectorCount: 198320,
    dimensions: 768,
    indexType: 'IVFFlat',
    diskUsageMB: 245,
    status: 'warning',
    lastUpdated: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
  {
    name: 'project_files',
    vectorCount: 89450,
    dimensions: 1536,
    indexType: 'HNSW',
    diskUsageMB: 198,
    status: 'healthy',
    lastUpdated: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    name: 'api_docs',
    vectorCount: 45120,
    dimensions: 1024,
    indexType: 'IVFFlat',
    diskUsageMB: 78,
    status: 'rebuilding',
    lastUpdated: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
  },
  {
    name: 'wiki_pages',
    vectorCount: 28672,
    dimensions: 768,
    indexType: 'HNSW',
    diskUsageMB: 52,
    status: 'healthy',
    lastUpdated: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
]

const MOCK_QUERIES: RecentQuery[] = [
  {
    id: 'q-001',
    queryPreview: 'How to implement authentication middleware...',
    collection: 'code_embeddings',
    similarityScore: 0.94,
    latencyMs: 8,
    resultsCount: 15,
    timestamp: new Date(Date.now() - 30 * 1000).toISOString(),
  },
  {
    id: 'q-002',
    queryPreview: 'Database connection pool configuration...',
    collection: 'doc_embeddings',
    similarityScore: 0.91,
    latencyMs: 11,
    resultsCount: 8,
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
  {
    id: 'q-003',
    queryPreview: 'Error handling patterns in TypeScript...',
    collection: 'code_embeddings',
    similarityScore: 0.88,
    latencyMs: 14,
    resultsCount: 22,
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  },
  {
    id: 'q-004',
    queryPreview: 'Docker container networking setup...',
    collection: 'doc_embeddings',
    similarityScore: 0.87,
    latencyMs: 9,
    resultsCount: 12,
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: 'q-005',
    queryPreview: 'Previous conversation about VM snapshots...',
    collection: 'chat_history',
    similarityScore: 0.96,
    latencyMs: 6,
    resultsCount: 5,
    timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  },
  {
    id: 'q-006',
    queryPreview: 'REST API rate limiting best practices...',
    collection: 'api_docs',
    similarityScore: 0.82,
    latencyMs: 18,
    resultsCount: 9,
    timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  {
    id: 'q-007',
    queryPreview: 'React component lifecycle management...',
    collection: 'code_embeddings',
    similarityScore: 0.90,
    latencyMs: 10,
    resultsCount: 18,
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: 'q-008',
    queryPreview: 'Kubernetes deployment strategies...',
    collection: 'wiki_pages',
    similarityScore: 0.79,
    latencyMs: 22,
    resultsCount: 6,
    timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  },
  {
    id: 'q-009',
    queryPreview: 'WebSocket reconnection handling...',
    collection: 'code_embeddings',
    similarityScore: 0.85,
    latencyMs: 13,
    resultsCount: 11,
    timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  },
  {
    id: 'q-010',
    queryPreview: 'PostgreSQL index optimization techniques...',
    collection: 'doc_embeddings',
    similarityScore: 0.93,
    latencyMs: 7,
    resultsCount: 14,
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
]

const MOCK_INDEX_HEALTH: IndexHealth[] = [
  {
    collection: 'code_embeddings',
    fragmentationPct: 8.2,
    lastRebuild: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    suggestion: 'Index is healthy. No action needed.',
  },
  {
    collection: 'doc_embeddings',
    fragmentationPct: 12.5,
    lastRebuild: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    suggestion: 'Consider scheduling a rebuild within the next 48 hours.',
  },
  {
    collection: 'chat_history',
    fragmentationPct: 34.8,
    lastRebuild: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    suggestion: 'High fragmentation detected. Rebuild recommended immediately to improve query performance.',
  },
  {
    collection: 'project_files',
    fragmentationPct: 5.1,
    lastRebuild: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    suggestion: 'Index is healthy. No action needed.',
  },
  {
    collection: 'api_docs',
    fragmentationPct: 0.0,
    lastRebuild: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    suggestion: 'Index rebuild in progress. Expected completion in ~3 minutes.',
  },
  {
    collection: 'wiki_pages',
    fragmentationPct: 18.3,
    lastRebuild: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    suggestion: 'Moderate fragmentation. Schedule a rebuild during low-traffic hours.',
  },
]

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
  const [sortBy, setSortBy] = useState<SortColumn>('vectorCount')
  const [sortDesc, setSortDesc] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())

  // Computed summary metrics
  const totalVectors = MOCK_COLLECTIONS.reduce((sum, c) => sum + c.vectorCount, 0)
  const totalDiskMB = MOCK_COLLECTIONS.reduce((sum, c) => sum + c.diskUsageMB, 0)
  const avgLatency = Math.round(
    MOCK_QUERIES.reduce((sum, q) => sum + q.latencyMs, 0) / MOCK_QUERIES.length
  )
  const embeddingRate = 450 // mock static rate

  // Sorted collections
  const sortedCollections = [...MOCK_COLLECTIONS].sort((a, b) => {
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
    setLastRefreshed(new Date())
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
          subValue={`${MOCK_COLLECTIONS.length} collections`}
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
            {MOCK_COLLECTIONS.length} collections &middot; Click column headers to sort
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
              {sortedCollections.map((col) => (
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
              ))}
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
            Last {MOCK_QUERIES.length} similarity search queries
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
              {MOCK_QUERIES.map((query) => (
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
              ))}
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
          {MOCK_INDEX_HEALTH.map((health) => (
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
          ))}
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
