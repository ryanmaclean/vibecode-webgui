/**
 * AuditTrailViewer Component
 *
 * Displays a comprehensive audit trail of all workflow actions,
 * changes, and events with detailed history tracking.
 *
 * Features:
 * - Chronological action history display
 * - Filtering by action type, user, and date range
 * - Search functionality for quick access
 * - Rollback capability for reversible actions
 * - Action details with before/after states
 * - User attribution and timestamps
 * - Accessibility compliant (WCAG 2.1 AA)
 *
 * @module components/workflow/AuditTrailViewer
 */

'use client'

import React, { useState, useMemo } from 'react'
import {
  History,
  Search,
  Filter,
  User,
  Clock,
  FileEdit,
  GitBranch,
  PlayCircle,
  PauseCircle,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ============================================================================
// Type Definitions
// ============================================================================

export type ActionType =
  | 'workflow_created'
  | 'workflow_updated'
  | 'workflow_deleted'
  | 'workflow_executed'
  | 'workflow_paused'
  | 'workflow_resumed'
  | 'node_added'
  | 'node_updated'
  | 'node_deleted'
  | 'approval_granted'
  | 'approval_denied'
  | 'rollback_executed'

export type ActionStatus = 'success' | 'failed' | 'pending' | 'warning'

export interface AuditAction {
  /** Unique identifier for the action */
  id: string
  /** Type of action performed */
  type: ActionType
  /** Status of the action */
  status: ActionStatus
  /** User who performed the action */
  user: {
    id: string
    name: string
    email?: string
  }
  /** When the action occurred */
  timestamp: Date
  /** Human-readable description */
  description: string
  /** Workflow ID if applicable */
  workflowId?: string
  /** Workflow name if applicable */
  workflowName?: string
  /** Changes made (before/after states) */
  changes?: {
    before?: Record<string, unknown>
    after?: Record<string, unknown>
  }
  /** Additional metadata */
  metadata?: Record<string, unknown>
  /** Whether this action can be rolled back */
  canRollback?: boolean
}

export interface AuditTrailViewerProps {
  /** List of audit actions to display */
  actions: AuditAction[]
  /** Callback when rollback is requested */
  onRollback?: (actionId: string) => Promise<void>
  /** Whether rollback functionality is enabled */
  enableRollback?: boolean
  /** Custom className */
  className?: string
}

// ============================================================================
// Action Type Configuration
// ============================================================================

const actionTypeConfig: Record<ActionType, {
  icon: React.ElementType
  color: string
  label: string
}> = {
  workflow_created: {
    icon: GitBranch,
    color: 'text-green-500',
    label: 'Workflow Created'
  },
  workflow_updated: {
    icon: FileEdit,
    color: 'text-blue-500',
    label: 'Workflow Updated'
  },
  workflow_deleted: {
    icon: Trash2,
    color: 'text-red-500',
    label: 'Workflow Deleted'
  },
  workflow_executed: {
    icon: PlayCircle,
    color: 'text-purple-500',
    label: 'Workflow Executed'
  },
  workflow_paused: {
    icon: PauseCircle,
    color: 'text-yellow-500',
    label: 'Workflow Paused'
  },
  workflow_resumed: {
    icon: PlayCircle,
    color: 'text-green-500',
    label: 'Workflow Resumed'
  },
  node_added: {
    icon: GitBranch,
    color: 'text-blue-500',
    label: 'Node Added'
  },
  node_updated: {
    icon: FileEdit,
    color: 'text-blue-500',
    label: 'Node Updated'
  },
  node_deleted: {
    icon: Trash2,
    color: 'text-red-500',
    label: 'Node Deleted'
  },
  approval_granted: {
    icon: CheckCircle,
    color: 'text-green-500',
    label: 'Approval Granted'
  },
  approval_denied: {
    icon: XCircle,
    color: 'text-red-500',
    label: 'Approval Denied'
  },
  rollback_executed: {
    icon: RefreshCw,
    color: 'text-orange-500',
    label: 'Rollback Executed'
  }
}

const statusConfig: Record<ActionStatus, {
  icon: React.ElementType
  color: string
}> = {
  success: {
    icon: CheckCircle,
    color: 'bg-green-500/10 text-green-500 border-green-500/20'
  },
  failed: {
    icon: XCircle,
    color: 'bg-red-500/10 text-red-500 border-red-500/20'
  },
  pending: {
    icon: Clock,
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20'
  },
  warning: {
    icon: AlertCircle,
    color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
  }
}

// ============================================================================
// Action Item Component
// ============================================================================

interface ActionItemProps {
  action: AuditAction
  onRollback?: (actionId: string) => Promise<void>
  enableRollback?: boolean
}

function ActionItem({ action, onRollback, enableRollback }: ActionItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isRollingBack, setIsRollingBack] = useState(false)

  const typeConfig = actionTypeConfig[action.type]
  const statusConf = statusConfig[action.status]
  const TypeIcon = typeConfig.icon
  const StatusIcon = statusConf.icon

  const hasChanges = action.changes && (action.changes.before || action.changes.after)

  const handleRollback = async () => {
    if (!onRollback) return

    setIsRollingBack(true)
    try {
      await onRollback(action.id)
    } catch (error) {
      console.error('Rollback failed:', error)
    } finally {
      setIsRollingBack(false)
    }
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn("mt-0.5", typeConfig.color)}>
          <TypeIcon className="h-5 w-5" aria-hidden="true" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-sm">{typeConfig.label}</h4>
                <Badge
                  variant="outline"
                  className={cn("flex items-center gap-1 border text-xs", statusConf.color)}
                >
                  <StatusIcon className="h-3 w-3" aria-hidden="true" />
                  {action.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{action.description}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {hasChanges && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              )}
              {enableRollback && action.canRollback && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRollback}
                  disabled={isRollingBack}
                  aria-label="Rollback this action"
                >
                  <RefreshCw
                    className={cn("h-3 w-3 mr-1", isRollingBack && "animate-spin")}
                    aria-hidden="true"
                  />
                  Rollback
                </Button>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" aria-hidden="true" />
              <span>{action.user.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              <time dateTime={new Date(action.timestamp).toISOString()}>
                {formatDate(action.timestamp)}
              </time>
            </div>
            {action.workflowName && (
              <div className="flex items-center gap-1">
                <GitBranch className="h-3 w-3" aria-hidden="true" />
                <span>{action.workflowName}</span>
              </div>
            )}
          </div>

          {/* Expanded Details */}
          {isExpanded && hasChanges && (
            <div className="mt-4 pt-4 border-t space-y-3">
              {action.changes?.before && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Info className="h-3 w-3" aria-hidden="true" />
                    Before
                  </div>
                  <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                    {JSON.stringify(action.changes.before, null, 2)}
                  </pre>
                </div>
              )}
              {action.changes?.after && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Info className="h-3 w-3" aria-hidden="true" />
                    After
                  </div>
                  <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                    {JSON.stringify(action.changes.after, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function AuditTrailViewer({
  actions,
  onRollback,
  enableRollback = false,
  className
}: AuditTrailViewerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<ActionType | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<ActionStatus | 'all'>('all')

  // Filter and search actions
  const filteredActions = useMemo(() => {
    return actions.filter(action => {
      // Type filter
      if (filterType !== 'all' && action.type !== filterType) {
        return false
      }

      // Status filter
      if (filterStatus !== 'all' && action.status !== filterStatus) {
        return false
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          action.description.toLowerCase().includes(query) ||
          action.user.name.toLowerCase().includes(query) ||
          action.workflowName?.toLowerCase().includes(query) ||
          actionTypeConfig[action.type].label.toLowerCase().includes(query)
        )
      }

      return true
    })
  }, [actions, searchQuery, filterType, filterStatus])

  // Group actions by date
  const groupedActions = useMemo(() => {
    const groups: Record<string, AuditAction[]> = {}

    filteredActions.forEach(action => {
      const date = new Date(action.timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(action)
    })

    return groups
  }, [filteredActions])

  const sortedDates = Object.keys(groupedActions).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime()
  })

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" aria-hidden="true" />
                Audit Trail
              </CardTitle>
              <CardDescription>
                Complete history of all workflow actions and changes
              </CardDescription>
            </div>
            <Badge variant="secondary">
              {filteredActions.length} {filteredActions.length === 1 ? 'action' : 'actions'}
            </Badge>
          </div>
        </CardHeader>

        {/* Filters */}
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Search actions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                aria-label="Search audit trail"
              />
            </div>

            {/* Type Filter */}
            <Select value={filterType} onValueChange={(value) => setFilterType(value as ActionType | 'all')}>
              <SelectTrigger aria-label="Filter by action type">
                <Filter className="h-4 w-4 mr-2" aria-hidden="true" />
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(actionTypeConfig).map(([type, config]) => (
                  <SelectItem key={type} value={type}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as ActionStatus | 'all')}>
              <SelectTrigger aria-label="Filter by status">
                <Filter className="h-4 w-4 mr-2" aria-hidden="true" />
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Action History */}
      <Card>
        <CardContent className="p-6">
          <ScrollArea className="h-[600px] pr-4">
            {filteredActions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <History className="h-12 w-12 text-muted-foreground/50 mb-4" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery || filterType !== 'all' || filterStatus !== 'all'
                    ? 'No actions match your filters'
                    : 'No audit trail actions available'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {sortedDates.map(date => (
                  <div key={date}>
                    <div className="sticky top-0 bg-background pb-2 mb-3">
                      <h3 className="text-sm font-semibold text-muted-foreground">
                        {date}
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {groupedActions[date].map(action => (
                        <ActionItem
                          key={action.id}
                          action={action}
                          onRollback={onRollback}
                          enableRollback={enableRollback}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
