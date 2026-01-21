/**
 * ConversationHistory Component
 *
 * Sidebar for searching, filtering, and managing past agent conversations
 * with one-click resume and Markdown export.
 *
 * Features:
 * - Search and filter past conversations
 * - One-click resume conversation
 * - Export to Markdown
 * - Conversation metadata (date, agent, message count)
 * - Delete and archive conversations
 * - Folder organization by agent type
 *
 * @module components/ai/ConversationHistory
 */

'use client'

import React, { useState, useMemo, useCallback, useEffect, memo } from 'react'
import {
  Search,
  Filter,
  Download,
  Trash,
  MoreVertical,
  Clock,
  MessageSquare,
  Calendar,
  FolderOpen,
  ChevronRight,
  ChevronDown
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { AgentType } from '@/types/agent-api'
import { AIErrorBoundary } from '@/components/error/ErrorBoundary'

// ============================================================================
// Type Definitions
// ============================================================================

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

interface Conversation {
  id: string
  agentId: string
  agentType: AgentType
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
  messageCount: number
  status: 'active' | 'archived' | 'completed'
  tags?: string[]
}

interface ConversationHistoryProps {
  /** List of conversations */
  conversations: Conversation[]
  /** Callback when conversation is selected */
  onConversationSelect: (conversationId: string) => void
  /** Callback when conversation is deleted */
  onConversationDelete?: (conversationId: string) => void
  /** Callback when conversation is exported */
  onConversationExport?: (conversationId: string) => void
  /** Currently selected conversation ID */
  selectedConversationId?: string
  /** Custom className */
  className?: string
  /** Enable search functionality */
  enableSearch?: boolean
  /** Enable folder organization */
  enableFolders?: boolean
}

interface ConversationGroup {
  id: string
  name: string
  conversations: Conversation[]
  isExpanded: boolean
}

type SortOption = 'recent' | 'oldest' | 'most-messages' | 'alphabetical'
type FilterOption = 'all' | 'active' | 'archived' | 'completed'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

/**
 * Export conversation to Markdown
 */
function exportToMarkdown(conversation: Conversation): string {
  const lines: string[] = []

  lines.push(`# ${conversation.title}`)
  lines.push('')
  lines.push(`**Agent:** ${conversation.agentType}`)
  lines.push(`**Created:** ${conversation.createdAt.toLocaleString()}`)
  lines.push(`**Messages:** ${conversation.messageCount}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  conversation.messages.forEach((message, index) => {
    const role = message.role === 'user' ? 'You' : message.role === 'assistant' ? 'Assistant' : 'System'
    const timestamp = message.timestamp.toLocaleTimeString()

    lines.push(`## ${role} (${timestamp})`)
    lines.push('')
    lines.push(message.content)
    lines.push('')

    if (index < conversation.messages.length - 1) {
      lines.push('---')
      lines.push('')
    }
  })

  return lines.join('\n')
}

/**
 * Download Markdown file
 */
function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Group conversations by agent type
 */
function groupConversationsByAgent(conversations: Conversation[]): ConversationGroup[] {
  const groups = new Map<AgentType, Conversation[]>()

  conversations.forEach(conv => {
    const existing = groups.get(conv.agentType) || []
    groups.set(conv.agentType, [...existing, conv])
  })

  return Array.from(groups.entries()).map(([agentType, convs]) => ({
    id: agentType,
    name: agentType.charAt(0).toUpperCase() + agentType.slice(1),
    conversations: convs,
    isExpanded: true
  }))
}

// ============================================================================
// Conversation Item Component
// ============================================================================

interface ConversationItemProps {
  conversation: Conversation
  isSelected: boolean
  onSelect: () => void
  onDelete?: () => void
  onExport?: () => void
}

const ConversationItem = memo(function ConversationItem({
  conversation,
  isSelected,
  onSelect,
  onDelete,
  onExport
}: ConversationItemProps) {
  const [showMenu, setShowMenu] = useState(false)

  const handleExport = useCallback(() => {
    const markdown = exportToMarkdown(conversation)
    const filename = `${conversation.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${conversation.id}.md`
    downloadMarkdown(markdown, filename)
    onExport?.()
    setShowMenu(false)
  }, [conversation, onExport])

  // Memoize keydown handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect()
    }
  }, [onSelect])

  // Memoize menu toggle handler
  const handleMenuToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(prev => !prev)
  }, [])

  return (
    <div
      className={cn(
        "group relative p-3 rounded-lg cursor-pointer transition-colors",
        "hover:bg-accent",
        isSelected && "bg-accent"
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`Select conversation: ${conversation.title}`}
      aria-current={isSelected ? 'true' : undefined}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-medium text-sm line-clamp-2 flex-1">
          {conversation.title}
        </h4>

        {/* Actions Menu */}
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleMenuToggle}
            aria-label="Conversation actions"
          >
            <MoreVertical className="h-3 w-3" aria-hidden="true" />
          </Button>

          {showMenu && (
            <div
              className="absolute right-0 top-full mt-1 w-32 bg-popover border rounded-md shadow-lg z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="w-full px-3 py-2 text-xs text-left hover:bg-accent flex items-center gap-2"
                onClick={handleExport}
              >
                <Download className="h-3 w-3" aria-hidden="true" />
                Export MD
              </button>
              {onDelete && (
                <button
                  className="w-full px-3 py-2 text-xs text-left hover:bg-accent flex items-center gap-2 text-red-500"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                    setShowMenu(false)
                  }}
                >
                  <Trash className="h-3 w-3" aria-hidden="true" />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {formatRelativeTime(conversation.updatedAt)}
        </span>
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" aria-hidden="true" />
          {conversation.messageCount}
        </span>
      </div>

      {/* Tags */}
      {conversation.tags && conversation.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {conversation.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
})

// ============================================================================
// Conversation Group Component
// ============================================================================

interface ConversationGroupItemProps {
  group: ConversationGroup
  selectedConversationId?: string
  onToggle: () => void
  onConversationSelect: (conversationId: string) => void
  onConversationDelete?: (conversationId: string) => void
  onConversationExport?: (conversationId: string) => void
}

const ConversationGroupItem = memo(function ConversationGroupItem({
  group,
  selectedConversationId,
  onToggle,
  onConversationSelect,
  onConversationDelete,
  onConversationExport
}: ConversationGroupItemProps) {
  return (
    <div className="mb-3">
      <button
        className="w-full flex items-center gap-2 px-2 py-1 text-sm font-medium hover:bg-accent rounded-md"
        onClick={onToggle}
        aria-expanded={group.isExpanded}
        aria-label={`${group.isExpanded ? 'Collapse' : 'Expand'} ${group.name} conversations`}
      >
        {group.isExpanded ? (
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        )}
        <FolderOpen className="h-4 w-4" aria-hidden="true" />
        <span>{group.name}</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          {group.conversations.length}
        </Badge>
      </button>

      {group.isExpanded && (
        <div className="mt-1 space-y-1 pl-6">
          {group.conversations.map(conv => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isSelected={conv.id === selectedConversationId}
              onSelect={() => onConversationSelect(conv.id)}
              onDelete={() => onConversationDelete?.(conv.id)}
              onExport={() => onConversationExport?.(conv.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
})

// ============================================================================
// Main Component
// ============================================================================

const ConversationHistoryContent = memo(function ConversationHistoryContent({
  conversations,
  onConversationSelect,
  onConversationDelete,
  onConversationExport,
  selectedConversationId,
  className,
  enableSearch = true,
  enableFolders = true
}: ConversationHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('recent')
  const [filterBy, setFilterBy] = useState<FilterOption>('all')
  const [groups, setGroups] = useState<ConversationGroup[]>([])

  // Filter conversations
  const filteredConversations = useMemo(() => {
    let result = conversations

    // Apply status filter
    if (filterBy !== 'all') {
      result = result.filter(conv => conv.status === filterBy)
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(conv =>
        conv.title.toLowerCase().includes(query) ||
        conv.messages.some(msg => msg.content.toLowerCase().includes(query)) ||
        conv.tags?.some(tag => tag.toLowerCase().includes(query))
      )
    }

    return result
  }, [conversations, searchQuery, filterBy])

  // Sort conversations
  const sortedConversations = useMemo(() => {
    const result = [...filteredConversations]

    switch (sortBy) {
      case 'recent':
        return result.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      case 'oldest':
        return result.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
      case 'most-messages':
        return result.sort((a, b) => b.messageCount - a.messageCount)
      case 'alphabetical':
        return result.sort((a, b) => a.title.localeCompare(b.title))
      default:
        return result
    }
  }, [filteredConversations, sortBy])

  // Group conversations
  useEffect(() => {
    if (enableFolders) {
      setGroups(groupConversationsByAgent(sortedConversations))
    }
  }, [sortedConversations, enableFolders])

  const handleToggleGroup = useCallback((groupId: string) => {
    setGroups(prev =>
      prev.map(group =>
        group.id === groupId ? { ...group, isExpanded: !group.isExpanded } : group
      )
    )
  }, [])

  // Memoize search change handler
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }, [])

  // Memoize sort change handler
  const handleSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value as SortOption)
  }, [])

  // Memoize filter change handler
  const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterBy(e.target.value as FilterOption)
  }, [])

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-lg">Conversation History</CardTitle>

        {/* Search Bar */}
        {enableSearch && (
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Search conversations"
            />
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 mt-3">
          <select
            value={sortBy}
            onChange={handleSortChange}
            className="flex-1 px-2 py-1 text-xs rounded-md border border-input bg-background"
            aria-label="Sort conversations"
          >
            <option value="recent">Recent</option>
            <option value="oldest">Oldest</option>
            <option value="most-messages">Most Messages</option>
            <option value="alphabetical">A-Z</option>
          </select>

          <select
            value={filterBy}
            onChange={handleFilterChange}
            className="flex-1 px-2 py-1 text-xs rounded-md border border-input bg-background"
            aria-label="Filter conversations"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0" style={{ minHeight: 0 }}>
        <ScrollArea className="h-full px-3 py-3">
          {sortedConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-3" aria-hidden="true" />
              <h3 className="font-medium mb-1">No conversations</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'Try a different search term' : 'Start a conversation with an agent'}
              </p>
            </div>
          ) : enableFolders ? (
            <div role="list" aria-label="Conversation groups">
              {groups.map(group => (
                <ConversationGroupItem
                  key={group.id}
                  group={group}
                  selectedConversationId={selectedConversationId}
                  onToggle={() => handleToggleGroup(group.id)}
                  onConversationSelect={onConversationSelect}
                  onConversationDelete={onConversationDelete}
                  onConversationExport={onConversationExport}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-1" role="list" aria-label="Conversations">
              {sortedConversations.map(conv => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isSelected={conv.id === selectedConversationId}
                  onSelect={() => onConversationSelect(conv.id)}
                  onDelete={() => onConversationDelete?.(conv.id)}
                  onExport={() => onConversationExport?.(conv.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
})

/**
 * ConversationHistory with Error Boundary
 * Wraps the component with AI-specific error handling
 */
export function ConversationHistory(props: ConversationHistoryProps) {
  return (
    <AIErrorBoundary
      componentName="ConversationHistory"
      onError={(error, errorInfo) => {
        console.error('ConversationHistory error:', error, errorInfo)
      }}
    >
      <ConversationHistoryContent {...props} />
    </AIErrorBoundary>
  )
}
