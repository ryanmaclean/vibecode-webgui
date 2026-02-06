'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  MessageSquare,
  Search,
  Filter,
  Trash2,
  Archive,
  Clock,
  ExternalLink,
  ChevronDown,
  Hash,
  DollarSign,
} from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface Conversation {
  id: string
  title: string
  model: string
  modelProvider: 'anthropic' | 'openai' | 'google' | 'meta' | 'mistral' | 'deepseek'
  messageCount: number
  createdAt: Date
  updatedAt: Date
  estimatedCost: number
  archived: boolean
}

type SortOption = 'recent' | 'oldest' | 'messages' | 'cost'
type ModelFilter = 'all' | 'anthropic' | 'openai' | 'google' | 'meta' | 'mistral' | 'deepseek'
type DateFilter = 'all' | 'today' | 'week' | 'month' | 'older'

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-001',
    title: 'Help me refactor this React component to use hooks instead of class-based lifecycle methods',
    model: 'Claude 3.5 Sonnet',
    modelProvider: 'anthropic',
    messageCount: 24,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 45 * 60 * 1000),
    estimatedCost: 0.087,
    archived: false,
  },
  {
    id: 'conv-002',
    title: 'Write a Python script to parse CSV files and generate summary statistics with pandas',
    model: 'GPT-4o',
    modelProvider: 'openai',
    messageCount: 18,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    estimatedCost: 0.142,
    archived: false,
  },
  {
    id: 'conv-003',
    title: 'Explain the difference between TCP and UDP protocols with real-world examples',
    model: 'Gemini 1.5 Pro',
    modelProvider: 'google',
    messageCount: 8,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 22 * 60 * 60 * 1000),
    estimatedCost: 0.023,
    archived: false,
  },
  {
    id: 'conv-004',
    title: 'Debug this TypeScript error: Type X is not assignable to type Y in my Next.js app',
    model: 'Claude 3.5 Sonnet',
    modelProvider: 'anthropic',
    messageCount: 32,
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    estimatedCost: 0.156,
    archived: false,
  },
  {
    id: 'conv-005',
    title: 'Create a Docker Compose setup for a microservices architecture with Redis and PostgreSQL',
    model: 'GPT-4o',
    modelProvider: 'openai',
    messageCount: 15,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    estimatedCost: 0.098,
    archived: false,
  },
  {
    id: 'conv-006',
    title: 'Design a REST API schema for an e-commerce platform with authentication',
    model: 'Llama 3.1 70B',
    modelProvider: 'meta',
    messageCount: 21,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    estimatedCost: 0.004,
    archived: false,
  },
  {
    id: 'conv-007',
    title: 'Review my Terraform configuration for AWS ECS cluster deployment',
    model: 'Claude 3 Opus',
    modelProvider: 'anthropic',
    messageCount: 12,
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    estimatedCost: 0.312,
    archived: false,
  },
  {
    id: 'conv-008',
    title: 'Optimize this SQL query that takes over 30 seconds on a table with 10M rows',
    model: 'DeepSeek V3',
    modelProvider: 'deepseek',
    messageCount: 9,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    estimatedCost: 0.002,
    archived: false,
  },
  {
    id: 'conv-009',
    title: 'Write unit tests for my Express.js authentication middleware using Jest',
    model: 'Mistral Large',
    modelProvider: 'mistral',
    messageCount: 16,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    estimatedCost: 0.045,
    archived: false,
  },
  {
    id: 'conv-010',
    title: 'Implement a WebSocket server in Node.js for real-time chat functionality',
    model: 'GPT-4o Mini',
    modelProvider: 'openai',
    messageCount: 28,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
    estimatedCost: 0.018,
    archived: false,
  },
  {
    id: 'conv-011',
    title: 'Help me understand Kubernetes pod scheduling and resource limits',
    model: 'Gemini 1.5 Flash',
    modelProvider: 'google',
    messageCount: 6,
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    estimatedCost: 0.005,
    archived: true,
  },
  {
    id: 'conv-012',
    title: 'Build a CI/CD pipeline with GitHub Actions for a monorepo with multiple packages',
    model: 'Claude 3.5 Sonnet',
    modelProvider: 'anthropic',
    messageCount: 42,
    createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    estimatedCost: 0.203,
    archived: true,
  },
]

// ============================================================================
// Helpers
// ============================================================================

const MODEL_BADGE_COLORS: Record<string, string> = {
  anthropic: 'bg-orange-100 text-orange-800 border-orange-200',
  openai: 'bg-green-100 text-green-800 border-green-200',
  google: 'bg-blue-100 text-blue-800 border-blue-200',
  meta: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  mistral: 'bg-purple-100 text-purple-800 border-purple-200',
  deepseek: 'bg-cyan-100 text-cyan-800 border-cyan-200',
}

const PROVIDER_LABELS: Record<ModelFilter, string> = {
  all: 'All Models',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  meta: 'Meta',
  mistral: 'Mistral',
  deepseek: 'DeepSeek',
}

const DATE_LABELS: Record<DateFilter, string> = {
  all: 'All Time',
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  older: 'Older',
}

const SORT_LABELS: Record<SortOption, string> = {
  recent: 'Most Recent',
  oldest: 'Oldest First',
  messages: 'Most Messages',
  cost: 'Highest Cost',
}

function formatRelativeTime(date: Date): string {
  const now = Date.now()
  const diff = now - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isInDateRange(date: Date, filter: DateFilter): boolean {
  if (filter === 'all') return true
  const now = Date.now()
  const diff = now - date.getTime()
  const dayMs = 24 * 60 * 60 * 1000

  switch (filter) {
    case 'today':
      return diff < dayMs
    case 'week':
      return diff < 7 * dayMs
    case 'month':
      return diff < 30 * dayMs
    case 'older':
      return diff >= 30 * dayMs
    default:
      return true
  }
}

const ITEMS_PER_PAGE = 8

// ============================================================================
// Main Page Component
// ============================================================================

export default function AIConversationsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [modelFilter, setModelFilter] = useState<ModelFilter>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [sortOption, setSortOption] = useState<SortOption>('recent')
  const [showArchived, setShowArchived] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS)
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)
  const [showFilters, setShowFilters] = useState(false)

  // Filter and sort conversations
  const filteredConversations = useMemo(() => {
    let result = conversations.filter((c) => {
      // Archive filter
      if (!showArchived && c.archived) return false
      if (showArchived && !c.archived) return false

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        if (
          !c.title.toLowerCase().includes(q) &&
          !c.model.toLowerCase().includes(q)
        ) {
          return false
        }
      }

      // Model filter
      if (modelFilter !== 'all' && c.modelProvider !== modelFilter) return false

      // Date filter
      if (!isInDateRange(c.updatedAt, dateFilter)) return false

      return true
    })

    // Sort
    result.sort((a, b) => {
      switch (sortOption) {
        case 'recent':
          return b.updatedAt.getTime() - a.updatedAt.getTime()
        case 'oldest':
          return a.updatedAt.getTime() - b.updatedAt.getTime()
        case 'messages':
          return b.messageCount - a.messageCount
        case 'cost':
          return b.estimatedCost - a.estimatedCost
        default:
          return 0
      }
    })

    return result
  }, [conversations, searchQuery, modelFilter, dateFilter, sortOption, showArchived])

  const visibleConversations = filteredConversations.slice(0, visibleCount)
  const hasMore = visibleCount < filteredConversations.length

  const handleArchive = (id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, archived: !c.archived } : c))
    )
  }

  const handleDelete = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id))
  }

  const activeCount = conversations.filter((c) => !c.archived).length
  const archivedCount = conversations.filter((c) => c.archived).length

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <MessageSquare className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Conversation History</h1>
        </div>
        <p className="text-gray-600">
          Browse, search, and manage your past AI conversations
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Conversations</div>
          <div className="text-2xl font-semibold text-gray-900">{conversations.length}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Active</div>
          <div className="text-2xl font-semibold text-gray-900">{activeCount}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Archived</div>
          <div className="text-2xl font-semibold text-gray-900">{archivedCount}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Cost</div>
          <div className="text-2xl font-semibold text-gray-900">
            ${conversations.reduce((sum, c) => sum + c.estimatedCost, 0).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Tabs: Active / Archived */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => { setShowArchived(false); setVisibleCount(ITEMS_PER_PAGE) }}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            !showArchived
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Active ({activeCount})
        </button>
        <button
          onClick={() => { setShowArchived(true); setVisibleCount(ITEMS_PER_PAGE) }}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            showArchived
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Archived ({archivedCount})
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(ITEMS_PER_PAGE) }}
              placeholder="Search conversations by title or model..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showFilters
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters
            <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {/* Sort */}
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-gray-200">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Model Provider</label>
              <select
                value={modelFilter}
                onChange={(e) => { setModelFilter(e.target.value as ModelFilter); setVisibleCount(ITEMS_PER_PAGE) }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Date Range</label>
              <select
                value={dateFilter}
                onChange={(e) => { setDateFilter(e.target.value as DateFilter); setVisibleCount(ITEMS_PER_PAGE) }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {Object.entries(DATE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setModelFilter('all')
                  setDateFilter('all')
                  setSearchQuery('')
                  setVisibleCount(ITEMS_PER_PAGE)
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-500">
        Showing {visibleConversations.length} of {filteredConversations.length} conversation{filteredConversations.length !== 1 ? 's' : ''}
      </div>

      {/* Conversation List */}
      {filteredConversations.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <MessageSquare className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No conversations found</h3>
          <p className="text-gray-500 text-sm mb-4">
            {searchQuery || modelFilter !== 'all' || dateFilter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : showArchived
                ? 'No archived conversations yet.'
                : 'Start a new conversation to see it here.'}
          </p>
          {(searchQuery || modelFilter !== 'all' || dateFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('')
                setModelFilter('all')
                setDateFilter('all')
              }}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleConversations.map((conversation) => (
            <div
              key={conversation.id}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {conversation.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {/* Model Badge */}
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            MODEL_BADGE_COLORS[conversation.modelProvider] || 'bg-gray-100 text-gray-800 border-gray-200'
                          }`}
                        >
                          {conversation.model}
                        </span>

                        {/* Message Count */}
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <Hash className="h-3 w-3" />
                          {conversation.messageCount} messages
                        </span>

                        {/* Cost */}
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <DollarSign className="h-3 w-3" />
                          ${conversation.estimatedCost.toFixed(3)}
                        </span>

                        {/* Time */}
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(conversation.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Link
                    href={`/ai/chat?conversation=${conversation.id}`}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    title="Open conversation"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => handleArchive(conversation.id)}
                    className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                    title={conversation.archived ? 'Unarchive' : 'Archive'}
                  >
                    <Archive className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(conversation.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Delete conversation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load More */}
      {hasMore && (
        <div className="text-center pt-2">
          <button
            onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
            className="px-6 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors"
          >
            Load More ({filteredConversations.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  )
}
