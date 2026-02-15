/**
 * ApprovalGate Component
 *
 * UI for reviewing and managing agent action approval requests.
 * Integrates with the HITL (Human-in-the-Loop) manager for workflow approval gates.
 *
 * Features:
 * - Display pending approval requests
 * - Approve/reject agent actions
 * - Priority-based filtering and sorting
 * - Real-time status updates
 * - Expiration tracking
 * - Escalation visualization
 * - Accessibility compliant (WCAG 2.1 AA)
 *
 * @module components/workflow/ApprovalGate
 */

'use client'

import React, { useState, useMemo } from 'react'
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  AlertTriangle,
  ArrowUpCircle,
  User,
  Users,
  FileCode,
  Rocket,
  Database,
  Shield,
  Globe,
  Settings,
  MessageSquare,
  TrendingUp,
  RefreshCw
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type {
  ApprovalRequest,
  ApprovalStatus,
  ApprovalType,
  Approval
} from '@/lib/workflow/hitl-manager'
// import { logger } from '@/lib/logger';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ApprovalGateProps {
  /** Approval requests to display */
  requests: ApprovalRequest[]
  /** Current user ID for approval authorization */
  currentUserId: string
  /** Callback when approval is submitted */
  onApprove?: (requestId: string, comment?: string) => Promise<void>
  /** Callback when rejection is submitted */
  onReject?: (requestId: string, comment?: string) => Promise<void>
  /** Callback when escalation is requested */
  onEscalate?: (requestId: string) => Promise<void>
  /** Callback to refresh requests */
  onRefresh?: () => Promise<void>
  /** Auto-refresh interval in ms */
  refreshInterval?: number
  /** Show only requests for current user */
  filterByUser?: boolean
  /** Custom className */
  className?: string
}

export interface ApprovalStats {
  total: number
  pending: number
  approved: number
  rejected: number
  escalated: number
  expired: number
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get icon for approval type
 */
function getApprovalTypeIcon(type: ApprovalType): React.ElementType {
  const iconMap: Record<ApprovalType, React.ElementType> = {
    code_change: FileCode,
    deployment: Rocket,
    data_access: Database,
    cost_threshold: TrendingUp,
    security_action: Shield,
    external_api: Globe,
    custom: Settings
  }
  return iconMap[type] || Settings
}

/**
 * Get priority color class
 */
function getPriorityColor(priority: string): string {
  const colorMap: Record<string, string> = {
    low: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    high: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    critical: 'bg-red-500/10 text-red-500 border-red-500/20'
  }
  return colorMap[priority] || colorMap.medium
}

/**
 * Get status color class
 */
function getStatusColor(status: ApprovalStatus): string {
  const colorMap: Record<ApprovalStatus, string> = {
    pending: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    approved: 'bg-green-500/10 text-green-500 border-green-500/20',
    rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
    escalated: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    expired: 'bg-gray-500/10 text-gray-500 border-gray-500/20'
  }
  return colorMap[status]
}

/**
 * Format time remaining
 */
function formatTimeRemaining(expiresAt: Date): string {
  const now = new Date()
  const diff = expiresAt.getTime() - now.getTime()

  if (diff <= 0) {
    return 'Expired'
  }

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days}d ${hours % 24}h`
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else {
    return `${minutes}m`
  }
}

/**
 * Calculate approval statistics
 */
function calculateStats(requests: ApprovalRequest[]): ApprovalStats {
  return {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
    escalated: requests.filter(r => r.status === 'escalated').length,
    expired: requests.filter(r => r.status === 'expired').length
  }
}

// ============================================================================
// Stats Overview Component
// ============================================================================

interface StatsOverviewProps {
  stats: ApprovalStats
}

function StatsOverview({ stats }: StatsOverviewProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total</CardTitle>
          <Settings className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending</CardTitle>
          <Clock className="h-4 w-4 text-blue-500" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-500">{stats.pending}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Approved</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-500">{stats.approved}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Rejected</CardTitle>
          <XCircle className="h-4 w-4 text-red-500" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-500">{stats.rejected}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Escalated</CardTitle>
          <ArrowUpCircle className="h-4 w-4 text-orange-500" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-500">{stats.escalated}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Expired</CardTitle>
          <AlertCircle className="h-4 w-4 text-gray-500" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-500">{stats.expired}</div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// Approval Request Card Component
// ============================================================================

interface ApprovalRequestCardProps {
  request: ApprovalRequest
  currentUserId: string
  onApprove: (requestId: string, comment?: string) => Promise<void>
  onReject: (requestId: string, comment?: string) => Promise<void>
  onEscalate?: (requestId: string) => Promise<void>
}

function ApprovalRequestCard({
  request,
  currentUserId,
  onApprove,
  onReject,
  onEscalate
}: ApprovalRequestCardProps) {
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const TypeIcon = getApprovalTypeIcon(request.type)
  const isAuthorized = request.requiredApprovers.includes(currentUserId)
  const isPending = request.status === 'pending' || request.status === 'escalated'
  const canApprove = isAuthorized && isPending
  const hasUserApproved = request.approvals.some(a => a.approverId === currentUserId)
  const timeRemaining = formatTimeRemaining(request.expiresAt)
  const isExpiringSoon = new Date(request.expiresAt).getTime() - Date.now() < 300000 // 5 minutes

  const handleApprove = async () => {
    if (!canApprove || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onApprove(request.id, comment || undefined)
      setComment('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!canApprove || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onReject(request.id, comment || undefined)
      setComment('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEscalate = async () => {
    if (!onEscalate || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onEscalate(request.id)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className={cn('transition-all', hasUserApproved && 'opacity-60')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className={cn(
              'p-2 rounded-lg border',
              getPriorityColor(request.priority)
            )}>
              <TypeIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base mb-1">{request.title}</CardTitle>
              <CardDescription className="text-sm">
                {request.description}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <Badge
              variant="outline"
              className={cn('border', getStatusColor(request.status))}
            >
              {request.status}
            </Badge>
            <Badge
              variant="outline"
              className={cn('border', getPriorityColor(request.priority))}
            >
              {request.priority}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Request Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground mb-1">Type</div>
            <div className="font-medium capitalize">
              {request.type.replace('_', ' ')}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Agent</div>
            <div className="font-medium">{request.agentId}</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Task</div>
            <div className="font-medium truncate">{request.taskId}</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">
              <Clock className="inline h-3 w-3 mr-1" aria-hidden="true" />
              Expires
            </div>
            <div className={cn(
              'font-medium',
              isExpiringSoon && 'text-orange-500'
            )}>
              {timeRemaining}
            </div>
          </div>
        </div>

        {/* Required Approvers */}
        <div>
          <div className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
            <Users className="h-3 w-3" aria-hidden="true" />
            Required Approvers ({request.approvals.length}/{request.requiredApprovers.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {request.requiredApprovers.map((approverId) => {
              const approval = request.approvals.find(a => a.approverId === approverId)
              return (
                <Badge
                  key={approverId}
                  variant="outline"
                  className={cn(
                    'flex items-center gap-1',
                    approval?.decision === 'approved' && 'border-green-500 text-green-500',
                    approval?.decision === 'rejected' && 'border-red-500 text-red-500'
                  )}
                >
                  <User className="h-3 w-3" aria-hidden="true" />
                  {approverId}
                  {approval?.decision === 'approved' && (
                    <CheckCircle className="h-3 w-3" aria-hidden="true" />
                  )}
                  {approval?.decision === 'rejected' && (
                    <XCircle className="h-3 w-3" aria-hidden="true" />
                  )}
                </Badge>
              )
            })}
          </div>
        </div>

        {/* Escalation Info */}
        {request.currentEscalationLevel > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <ArrowUpCircle className="h-4 w-4 text-orange-500" aria-hidden="true" />
            <span className="text-sm text-orange-500">
              Escalated to level {request.currentEscalationLevel}
            </span>
          </div>
        )}

        {/* Existing Approvals */}
        {request.approvals.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <MessageSquare className="h-3 w-3" aria-hidden="true" />
              Approvals
            </div>
            {request.approvals.map((approval, idx) => (
              <div
                key={idx}
                className="p-2 rounded-lg border bg-muted/50 text-sm"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{approval.approverId}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      approval.decision === 'approved' && 'border-green-500 text-green-500',
                      approval.decision === 'rejected' && 'border-red-500 text-red-500'
                    )}
                  >
                    {approval.decision}
                  </Badge>
                </div>
                {approval.comment && (
                  <div className="text-muted-foreground">{approval.comment}</div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  {approval.timestamp.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Area */}
        {canApprove && !hasUserApproved && (
          <div className="space-y-3 pt-2 border-t">
            <Textarea
              placeholder="Add a comment (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[80px]"
              disabled={isSubmitting}
              aria-label="Approval comment"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleApprove}
                disabled={isSubmitting}
                className="flex-1"
                variant="default"
                aria-label="Approve request"
              >
                <CheckCircle className="h-4 w-4 mr-2" aria-hidden="true" />
                Approve
              </Button>
              <Button
                onClick={handleReject}
                disabled={isSubmitting}
                variant="destructive"
                className="flex-1"
                aria-label="Reject request"
              >
                <XCircle className="h-4 w-4 mr-2" aria-hidden="true" />
                Reject
              </Button>
              {onEscalate && (
                <Button
                  onClick={handleEscalate}
                  disabled={isSubmitting}
                  variant="outline"
                  aria-label="Escalate request"
                >
                  <ArrowUpCircle className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        )}

        {!isAuthorized && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            You are not authorized to approve this request
          </div>
        )}

        {hasUserApproved && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-500">
            <CheckCircle className="h-4 w-4" aria-hidden="true" />
            You have already responded to this request
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Main ApprovalGate Component
// ============================================================================

export function ApprovalGate({
  requests,
  currentUserId,
  onApprove = async () => {},
  onReject = async () => {},
  onEscalate,
  onRefresh,
  refreshInterval = 30000,
  filterByUser = false,
  className
}: ApprovalGateProps) {
  const [activeTab, setActiveTab] = useState<ApprovalStatus | 'all'>('all')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filter requests
  const filteredRequests = useMemo(() => {
    let filtered = requests

    // Filter by user if requested
    if (filterByUser) {
      filtered = filtered.filter(r => r.requiredApprovers.includes(currentUserId))
    }

    // Filter by status tab
    if (activeTab !== 'all') {
      filtered = filtered.filter(r => r.status === activeTab)
    }

    // Sort by priority and creation date
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    filtered.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (priorityDiff !== 0) return priorityDiff
      return b.createdAt.getTime() - a.createdAt.getTime()
    })

    return filtered
  }, [requests, currentUserId, filterByUser, activeTab])

  // Calculate statistics
  const stats = useMemo(() => calculateStats(requests), [requests])

  // Handle refresh
  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return
    setIsRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setIsRefreshing(false)
    }
  }

  // Auto-refresh
  React.useEffect(() => {
    if (!onRefresh || refreshInterval <= 0) return

    const interval = setInterval(() => {
      handleRefresh()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [onRefresh, refreshInterval])

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Approval Gate</h2>
          <p className="text-muted-foreground">
            Review and manage agent action requests
          </p>
        </div>
        {onRefresh && (
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
            aria-label="Refresh requests"
          >
            <RefreshCw
              className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')}
              aria-hidden="true"
            />
            Refresh
          </Button>
        )}
      </div>

      {/* Statistics */}
      <StatsOverview stats={stats} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ApprovalStatus | 'all')}>
        <TabsList>
          <TabsTrigger value="all">
            All ({requests.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({stats.pending})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({stats.approved})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({stats.rejected})
          </TabsTrigger>
          <TabsTrigger value="escalated">
            Escalated ({stats.escalated})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredRequests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" aria-hidden="true" />
                <h3 className="text-lg font-semibold mb-2">No Requests</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  {activeTab === 'all'
                    ? 'There are no approval requests at this time.'
                    : `No ${activeTab} approval requests.`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4 pr-4">
                {filteredRequests.map((request) => (
                  <ApprovalRequestCard
                    key={request.id}
                    request={request}
                    currentUserId={currentUserId}
                    onApprove={onApprove}
                    onReject={onReject}
                    onEscalate={onEscalate}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ApprovalGate
