/**
 * AuditLogViewer Component
 *
 * Displays comprehensive audit logs for agent actions with filtering,
 * search, and detailed view capabilities.
 *
 * Features:
 * - Chronological audit log display with timestamps
 * - Filtering by action type, severity, and outcome
 * - Search functionality for quick access
 * - User attribution and action details
 * - Expandable entries for metadata viewing
 * - Accessibility compliant (WCAG 2.1 AA)
 * - Dark mode support
 *
 * @module components/agents/AuditLogViewer
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
  FileText,
  Search,
  Filter,
  User,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  ChevronDown,
  ChevronRight,
  Shield,
  Activity,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import type {
  AuditLogEntry,
  AuditAction,
  AuditSeverity,
  AuditOutcome,
  AuditCategory,
} from '@/lib/audit/types';

// ============================================================================
// Types
// ============================================================================

export interface AuditLogViewerProps {
  /** List of audit log entries to display */
  logs: AuditLogEntry[];
  /** Whether to show loading state */
  loading?: boolean;
  /** Custom className */
  className?: string;
  /** Callback when more logs are requested (pagination) */
  onLoadMore?: () => void;
  /** Whether there are more logs to load */
  hasMore?: boolean;
}

// ============================================================================
// Severity Configuration
// ============================================================================

const severityConfig: Record<AuditSeverity, {
  icon: React.ElementType;
  color: string;
  label: string;
}> = {
  info: {
    icon: Info,
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    label: 'Info',
  },
  warning: {
    icon: AlertCircle,
    color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    label: 'Warning',
  },
  critical: {
    icon: AlertCircle,
    color: 'bg-red-500/10 text-red-500 border-red-500/20',
    label: 'Critical',
  },
};

const outcomeConfig: Record<AuditOutcome, {
  icon: React.ElementType;
  color: string;
}> = {
  success: {
    icon: CheckCircle,
    color: 'text-green-500',
  },
  failure: {
    icon: XCircle,
    color: 'text-red-500',
  },
  error: {
    icon: AlertCircle,
    color: 'text-orange-500',
  },
};

// ============================================================================
// Subcomponents
// ============================================================================

/**
 * Individual audit log entry item
 */
interface AuditLogItemProps {
  log: AuditLogEntry;
}

function AuditLogItem({ log }: AuditLogItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const severityConf = severityConfig[log.severity];
  const outcomeConf = outcomeConfig[log.outcome];
  const SeverityIcon = severityConf.icon;
  const OutcomeIcon = outcomeConf.icon;

  const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

  const formatTimestamp = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatAction = (action: string) => {
    return action.split('.').map((part, index) =>
      index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
    ).join(' ');
  };

  return (
    <div
      data-testid="audit-log-entry"
      className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* Outcome Icon */}
        <div className={cn('mt-0.5', outcomeConf.color)}>
          <OutcomeIcon className="h-5 w-5" aria-hidden="true" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h4 className="font-medium text-sm">{formatAction(log.action)}</h4>
                <Badge
                  variant="outline"
                  className={cn('flex items-center gap-1 border text-xs', severityConf.color)}
                >
                  <SeverityIcon className="h-3 w-3" aria-hidden="true" />
                  {severityConf.label}
                </Badge>
                <Badge variant="secondary" className="text-xs capitalize">
                  {log.category}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground break-words">{log.resource}</p>
            </div>

            {/* Expand Button */}
            {hasMetadata && (
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
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              <time dateTime={new Date(log.timestamp).toISOString()}>
                {formatTimestamp(log.timestamp)}
              </time>
            </div>
            {log.userId && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" aria-hidden="true" />
                <span>User {log.userId}</span>
              </div>
            )}
            {log.ipAddress && (
              <div className="flex items-center gap-1">
                <Activity className="h-3 w-3" aria-hidden="true" />
                <span className="font-mono">{log.ipAddress}</span>
              </div>
            )}
            {log.sessionId && (
              <div className="flex items-center gap-1">
                <Shield className="h-3 w-3" aria-hidden="true" />
                <span className="font-mono truncate" title={log.sessionId}>
                  {log.sessionId.substring(0, 8)}...
                </span>
              </div>
            )}
          </div>

          {/* Expanded Details */}
          {isExpanded && hasMetadata && (
            <div className="mt-4 pt-4 border-t">
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" aria-hidden="true" />
                  Additional Details
                </div>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * AuditLogViewer component for displaying agent audit logs
 *
 * Provides a comprehensive view of all agent-related audit events with
 * filtering, search, and detailed information display.
 *
 * @example
 * ```tsx
 * <AuditLogViewer
 *   logs={auditLogs}
 *   loading={isLoading}
 *   onLoadMore={handleLoadMore}
 *   hasMore={hasMoreLogs}
 * />
 * ```
 */
export const AuditLogViewer = React.memo(
  React.forwardRef<HTMLDivElement, AuditLogViewerProps>(
    (
      {
        className,
        logs,
        loading = false,
        onLoadMore,
        hasMore = false,
        ...props
      },
      ref
    ) => {
      const [searchQuery, setSearchQuery] = useState('');
      const [filterSeverity, setFilterSeverity] = useState<AuditSeverity | 'all'>('all');
      const [filterOutcome, setFilterOutcome] = useState<AuditOutcome | 'all'>('all');
      const [filterCategory, setFilterCategory] = useState<AuditCategory | 'all'>('all');

      // Filter and search logs
      const filteredLogs = useMemo(() => {
        return logs.filter((log) => {
          // Severity filter
          if (filterSeverity !== 'all' && log.severity !== filterSeverity) {
            return false;
          }

          // Outcome filter
          if (filterOutcome !== 'all' && log.outcome !== filterOutcome) {
            return false;
          }

          // Category filter
          if (filterCategory !== 'all' && log.category !== filterCategory) {
            return false;
          }

          // Search filter
          if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
              log.action.toLowerCase().includes(query) ||
              log.resource.toLowerCase().includes(query) ||
              log.ipAddress?.toLowerCase().includes(query) ||
              log.sessionId?.toLowerCase().includes(query) ||
              JSON.stringify(log.metadata || {}).toLowerCase().includes(query)
            );
          }

          return true;
        });
      }, [logs, searchQuery, filterSeverity, filterOutcome, filterCategory]);

      // Group logs by date
      const groupedLogs = useMemo(() => {
        const groups: Record<string, AuditLogEntry[]> = {};

        filteredLogs.forEach((log) => {
          const date = new Date(log.timestamp).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

          if (!groups[date]) {
            groups[date] = [];
          }
          groups[date].push(log);
        });

        return groups;
      }, [filteredLogs]);

      const sortedDates = Object.keys(groupedLogs).sort((a, b) => {
        return new Date(b).getTime() - new Date(a).getTime();
      });

      return (
        <div
          ref={ref}
          data-testid="audit-log-viewer"
          className={cn('space-y-4', className)}
          {...props}
        >
          {/* Header */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                    Agent Audit Log
                  </CardTitle>
                  <CardDescription>
                    Complete history of all agent actions and events
                  </CardDescription>
                </div>
                <Badge variant="secondary">
                  {filteredLogs.length} {filteredLogs.length === 1 ? 'entry' : 'entries'}
                </Badge>
              </div>
            </CardHeader>

            {/* Filters */}
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Search */}
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    aria-label="Search audit logs"
                  />
                </div>

                {/* Severity Filter */}
                <Select
                  value={filterSeverity}
                  onValueChange={(value) => setFilterSeverity(value as AuditSeverity | 'all')}
                >
                  <SelectTrigger aria-label="Filter by severity">
                    <Filter className="h-4 w-4 mr-2" aria-hidden="true" />
                    <SelectValue placeholder="All Severities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>

                {/* Outcome Filter */}
                <Select
                  value={filterOutcome}
                  onValueChange={(value) => setFilterOutcome(value as AuditOutcome | 'all')}
                >
                  <SelectTrigger aria-label="Filter by outcome">
                    <Filter className="h-4 w-4 mr-2" aria-hidden="true" />
                    <SelectValue placeholder="All Outcomes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Outcomes</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="failure">Failure</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>

                {/* Category Filter */}
                <Select
                  value={filterCategory}
                  onValueChange={(value) => setFilterCategory(value as AuditCategory | 'all')}
                >
                  <SelectTrigger aria-label="Filter by category">
                    <Filter className="h-4 w-4 mr-2" aria-hidden="true" />
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="auth">Authentication</SelectItem>
                    <SelectItem value="data_access">Data Access</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="ai_operations">AI Operations</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Log Entries */}
          <Card>
            <CardContent className="p-6">
              <ScrollArea className="h-[600px] pr-4">
                {loading ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <Activity className="h-12 w-12 text-muted-foreground/50 mb-4 animate-pulse" aria-hidden="true" />
                    <p className="text-sm text-muted-foreground">Loading audit logs...</p>
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" aria-hidden="true" />
                    <p className="text-sm text-muted-foreground">
                      {searchQuery || filterSeverity !== 'all' || filterOutcome !== 'all' || filterCategory !== 'all'
                        ? 'No audit logs match your filters'
                        : 'No audit logs available'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {sortedDates.map((date) => (
                      <div key={date}>
                        <div className="sticky top-0 bg-background pb-2 mb-3">
                          <h3 className="text-sm font-semibold text-muted-foreground">
                            {date}
                          </h3>
                        </div>
                        <div className="space-y-3">
                          {groupedLogs[date].map((log) => (
                            <AuditLogItem key={log.id} log={log} />
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Load More Button */}
                    {hasMore && onLoadMore && (
                      <div className="flex justify-center pt-4">
                        <Separator className="mb-4" />
                        <Button
                          variant="outline"
                          onClick={onLoadMore}
                          disabled={loading}
                          className="w-full"
                        >
                          {loading ? 'Loading...' : 'Load More'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      );
    }
  )
);

AuditLogViewer.displayName = 'AuditLogViewer';

// ============================================================================
// Exports
// ============================================================================

export type { AuditLogItemProps };
