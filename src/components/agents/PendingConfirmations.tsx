/**
 * PendingConfirmations Component
 *
 * Displays a list/table of pending confirmation requests with filtering capabilities.
 * Clicking an item opens the ConfirmationDialog for approval/rejection.
 *
 * Features:
 * - Filterable list by risk level, agent ID, and action type
 * - Real-time updates via polling or EventEmitter
 * - Click-to-open dialog for approval workflow
 * - Empty state handling
 * - Responsive design
 * - Dark mode support
 * - WCAG 2.1 AA compliant accessibility
 *
 * @module components/agents/PendingConfirmations
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertTriangle,
  Clock,
  FileText,
  Filter,
  RefreshCcw,
  Shield,
  XCircle,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

import { ConfirmationDialog } from './ConfirmationDialog';
import type { ConfirmationRequest, ActionType } from '@/types/agent-confirmation';

// ============================================================================
// Types
// ============================================================================

export interface PendingConfirmationsProps {
  /** Initial list of pending confirmations */
  confirmations?: ConfirmationRequest[];
  /** Callback to fetch latest confirmations */
  onRefresh?: () => void | Promise<void>;
  /** Callback when user approves a confirmation */
  onApprove?: (requestId: string, comment?: string) => void | Promise<void>;
  /** Callback when user rejects a confirmation */
  onReject?: (requestId: string, comment?: string) => void | Promise<void>;
  /** Whether the component is in loading state */
  isLoading?: boolean;
  /** Auto-refresh interval in milliseconds (0 to disable) */
  autoRefreshInterval?: number;
  /** Custom className */
  className?: string;
}

type RiskLevel = 'low' | 'medium' | 'high' | 'all';

// ============================================================================
// Subcomponents
// ============================================================================

/**
 * Risk level badge with appropriate styling
 */
interface RiskBadgeProps {
  riskLevel: 'low' | 'medium' | 'high';
}

function RiskBadge({ riskLevel }: RiskBadgeProps) {
  return (
    <Badge
      variant={riskLevel === 'high' ? 'destructive' : 'secondary'}
      className={cn(
        'flex items-center gap-1',
        riskLevel === 'medium' && 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-400',
        riskLevel === 'low' && 'bg-green-100 text-green-900 dark:bg-green-900/20 dark:text-green-400'
      )}
    >
      <Shield className="h-3 w-3" aria-hidden="true" />
      <span className="capitalize">{riskLevel}</span>
    </Badge>
  );
}

/**
 * Action type badge with icon
 */
interface ActionTypeBadgeProps {
  actionType: string;
}

function ActionTypeBadge({ actionType }: ActionTypeBadgeProps) {
  const getActionIcon = () => {
    switch (actionType) {
      case 'file_delete':
        return <XCircle className="h-3 w-3" aria-hidden="true" />;
      case 'file_write':
      case 'file_edit':
      case 'code_replace':
        return <FileText className="h-3 w-3" aria-hidden="true" />;
      default:
        return <AlertTriangle className="h-3 w-3" aria-hidden="true" />;
    }
  };

  return (
    <Badge variant="outline" className="flex items-center gap-1">
      {getActionIcon()}
      <span className="capitalize">{actionType.replace(/_/g, ' ')}</span>
    </Badge>
  );
}

/**
 * Empty state when no confirmations are pending
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Shield className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No Pending Confirmations</h3>
      <p className="text-sm text-muted-foreground max-w-md">
        All agent actions have been reviewed. New confirmation requests will appear here
        when agents need approval for potentially destructive operations.
      </p>
    </div>
  );
}

/**
 * Single confirmation item row
 */
interface ConfirmationItemProps {
  confirmation: ConfirmationRequest;
  onClick: () => void;
}

function ConfirmationItem({ confirmation, onClick }: ConfirmationItemProps) {
  const { action, agent_id, created_at, risk_level } = confirmation;

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
      return date.toLocaleDateString();
    } catch {
      return timestamp;
    }
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-4 text-left border rounded-lg transition-all',
        'hover:border-primary hover:bg-accent/50',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        'active:scale-[0.99]'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left side: Action details */}
        <div className="flex-1 space-y-2 min-w-0">
          {/* Action type and risk level */}
          <div className="flex items-center gap-2 flex-wrap">
            <ActionTypeBadge actionType={action.action_type} />
            {risk_level && <RiskBadge riskLevel={risk_level} />}
          </div>

          {/* File path or explanation */}
          {action.file_path && (
            <p className="text-sm font-mono text-muted-foreground truncate" title={action.file_path}>
              {action.file_path}
            </p>
          )}

          {/* Explanation */}
          <p className="text-sm leading-relaxed line-clamp-2">{action.explanation}</p>

          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1" title={`Agent ID: ${agent_id}`}>
              <span className="font-mono truncate max-w-[120px]">{agent_id}</span>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {formatTimestamp(created_at)}
            </span>
          </div>
        </div>

        {/* Right side: Visual indicator */}
        <div className="flex-shrink-0">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              risk_level === 'high' && 'bg-destructive',
              risk_level === 'medium' && 'bg-yellow-500',
              risk_level === 'low' && 'bg-green-500',
              !risk_level && 'bg-muted-foreground'
            )}
            aria-label={risk_level ? `${risk_level} risk` : 'Pending'}
          />
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * PendingConfirmations component displays a filterable list of pending confirmation requests
 *
 * @example
 * ```tsx
 * <PendingConfirmations
 *   confirmations={pendingRequests}
 *   onRefresh={fetchConfirmations}
 *   onApprove={handleApprove}
 *   onReject={handleReject}
 *   autoRefreshInterval={5000}
 * />
 * ```
 */
export const PendingConfirmations = React.memo(
  React.forwardRef<HTMLDivElement, PendingConfirmationsProps>(
    (
      {
        className,
        confirmations = [],
        onRefresh,
        onApprove,
        onReject,
        isLoading = false,
        autoRefreshInterval = 0,
        ...props
      },
      ref
    ) => {
      const [riskFilter, setRiskFilter] = useState<RiskLevel>('all');
      const [actionTypeFilter, setActionTypeFilter] = useState<string>('all');
      const [agentFilter, setAgentFilter] = useState<string>('all');
      const [selectedConfirmation, setSelectedConfirmation] = useState<ConfirmationRequest | null>(null);
      const [isDialogOpen, setIsDialogOpen] = useState(false);
      const [isProcessing, setIsProcessing] = useState(false);

      // Auto-refresh if enabled
      useEffect(() => {
        if (autoRefreshInterval > 0 && onRefresh) {
          const intervalId = setInterval(() => {
            onRefresh();
          }, autoRefreshInterval);

          return () => clearInterval(intervalId);
        }
      }, [autoRefreshInterval, onRefresh]);

      // Extract unique values for filters
      const uniqueAgents = useMemo(() => {
        const agents = new Set(confirmations.map(c => c.agent_id));
        return Array.from(agents).sort();
      }, [confirmations]);

      const uniqueActionTypes = useMemo(() => {
        const types = new Set(confirmations.map(c => c.action.action_type));
        return Array.from(types).sort();
      }, [confirmations]);

      // Filter confirmations based on selected filters
      const filteredConfirmations = useMemo(() => {
        return confirmations.filter(confirmation => {
          if (riskFilter !== 'all' && confirmation.risk_level !== riskFilter) {
            return false;
          }

          if (actionTypeFilter !== 'all' && confirmation.action.action_type !== actionTypeFilter) {
            return false;
          }

          if (agentFilter !== 'all' && confirmation.agent_id !== agentFilter) {
            return false;
          }

          return true;
        });
      }, [confirmations, riskFilter, actionTypeFilter, agentFilter]);

      const handleRefresh = useCallback(async () => {
        if (onRefresh && !isLoading) {
          await onRefresh();
        }
      }, [onRefresh, isLoading]);

      const handleItemClick = useCallback((confirmation: ConfirmationRequest) => {
        setSelectedConfirmation(confirmation);
        setIsDialogOpen(true);
      }, []);

      const handleApprove = useCallback(
        async (requestId: string, comment?: string) => {
          if (!onApprove) return;

          setIsProcessing(true);
          try {
            await onApprove(requestId, comment);
            setIsDialogOpen(false);
            setSelectedConfirmation(null);
            // Refresh the list after approval
            if (onRefresh) {
              await onRefresh();
            }
          } finally {
            setIsProcessing(false);
          }
        },
        [onApprove, onRefresh]
      );

      const handleReject = useCallback(
        async (requestId: string, comment?: string) => {
          if (!onReject) return;

          setIsProcessing(true);
          try {
            await onReject(requestId, comment);
            setIsDialogOpen(false);
            setSelectedConfirmation(null);
            // Refresh the list after rejection
            if (onRefresh) {
              await onRefresh();
            }
          } finally {
            setIsProcessing(false);
          }
        },
        [onReject, onRefresh]
      );

      const handleDialogClose = useCallback((open: boolean) => {
        if (!open && !isProcessing) {
          setIsDialogOpen(false);
          setSelectedConfirmation(null);
        }
      }, [isProcessing]);

      const hasActiveFilters = riskFilter !== 'all' || actionTypeFilter !== 'all' || agentFilter !== 'all';

      return (
        <>
          <Card ref={ref} className={cn('w-full', className)} {...props}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" aria-hidden="true" />
                    Pending Confirmations
                  </CardTitle>
                  <CardDescription>
                    {filteredConfirmations.length > 0
                      ? `${filteredConfirmations.length} confirmation${filteredConfirmations.length === 1 ? '' : 's'} requiring review`
                      : 'No confirmations pending'}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={isLoading}
                  aria-label="Refresh confirmations"
                >
                  <RefreshCcw className={cn('h-4 w-4', isLoading && 'animate-spin')} aria-hidden="true" />
                </Button>
              </div>

              {/* Filters */}
              {confirmations.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap pt-4">
                  <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />

                  {/* Risk Level Filter */}
                  <Select value={riskFilter} onValueChange={(value) => setRiskFilter(value as RiskLevel)}>
                    <SelectTrigger className="w-[140px]" aria-label="Filter by risk level">
                      <SelectValue placeholder="Risk Level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Risk Levels</SelectItem>
                      <SelectItem value="high">High Risk</SelectItem>
                      <SelectItem value="medium">Medium Risk</SelectItem>
                      <SelectItem value="low">Low Risk</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Action Type Filter */}
                  <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
                    <SelectTrigger className="w-[160px]" aria-label="Filter by action type">
                      <SelectValue placeholder="Action Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Action Types</SelectItem>
                      {uniqueActionTypes.map(type => (
                        <SelectItem key={type} value={type}>
                          {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Agent Filter */}
                  {uniqueAgents.length > 1 && (
                    <Select value={agentFilter} onValueChange={setAgentFilter}>
                      <SelectTrigger className="w-[180px]" aria-label="Filter by agent">
                        <SelectValue placeholder="Agent" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Agents</SelectItem>
                        {uniqueAgents.map(agentId => (
                          <SelectItem key={agentId} value={agentId}>
                            <span className="font-mono text-sm truncate">{agentId}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {/* Clear filters */}
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRiskFilter('all');
                        setActionTypeFilter('all');
                        setAgentFilter('all');
                      }}
                      className="text-xs"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              )}
            </CardHeader>

            <CardContent>
              {/* Loading state */}
              {isLoading && confirmations.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCcw className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading confirmations...</span>
                </div>
              ) : filteredConfirmations.length === 0 ? (
                /* Empty state */
                hasActiveFilters ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Filter className="h-8 w-8 text-muted-foreground mb-4" aria-hidden="true" />
                    <h3 className="text-lg font-semibold mb-2">No Matching Confirmations</h3>
                    <p className="text-sm text-muted-foreground max-w-md mb-4">
                      No confirmations match the selected filters. Try adjusting your filter criteria.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRiskFilter('all');
                        setActionTypeFilter('all');
                        setAgentFilter('all');
                      }}
                    >
                      Clear Filters
                    </Button>
                  </div>
                ) : (
                  <EmptyState />
                )
              ) : (
                /* Confirmation list */
                <div className="space-y-3">
                  {filteredConfirmations.map(confirmation => (
                    <ConfirmationItem
                      key={confirmation.request_id}
                      confirmation={confirmation}
                      onClick={() => handleItemClick(confirmation)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Confirmation Dialog */}
          <ConfirmationDialog
            confirmation={selectedConfirmation}
            open={isDialogOpen}
            onOpenChange={handleDialogClose}
            onApprove={handleApprove}
            onReject={handleReject}
            isProcessing={isProcessing}
          />
        </>
      );
    }
  )
);

PendingConfirmations.displayName = 'PendingConfirmations';

// ============================================================================
// Exports
// ============================================================================

export type { RiskBadgeProps, ActionTypeBadgeProps, ConfirmationItemProps };
