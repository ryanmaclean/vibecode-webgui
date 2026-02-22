/**
 * Context Viewer Component
 *
 * Displays active context items being sent to AI models, including:
 * - Current context window state
 * - Token usage and utilization
 * - List of included items with metadata
 * - Excluded items and why they were excluded
 * - Item priorities and relevance scores
 * - Context strategy information
 *
 * @module components/ai/ContextViewer
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  FileText,
  Code,
  MessageSquare,
  Book,
  Sparkles,
  TrendingUp,
  Clock,
  Zap,
  BarChart3,
  XCircle,
  Info,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type {
  ContextWindow,
  ContextItem,
  ContextItemType,
  ContextPriority,
  ContextStrategy,
} from '@/types/context';

// ============================================================================
// Types
// ============================================================================

interface ContextViewerProps {
  /** Custom CSS class name */
  className?: string;
  /** Session or workspace ID to fetch context for */
  sessionId?: string;
  /** Whether to auto-refresh context data */
  autoRefresh?: boolean;
  /** Refresh interval in milliseconds (default: 5000) */
  refreshInterval?: number;
  /** Compact mode for smaller displays */
  compact?: boolean;
  /** Show excluded items section */
  showExcluded?: boolean;
  /** Callback when item is clicked */
  onItemClick?: (item: ContextItem) => void;
}

interface ContextApiResponse {
  success: boolean;
  data: {
    window: ContextWindow;
    statistics: {
      totalItems: number;
      includedItems: number;
      excludedItems: number;
      totalTokens: number;
      utilizationPercent: number;
    };
  };
  timestamp: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}

function formatTimestamp(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

function getItemTypeIcon(type: ContextItemType): React.ReactNode {
  const icons: Record<ContextItemType, React.ReactNode> = {
    file: <FileText className="h-4 w-4" />,
    code_snippet: <Code className="h-4 w-4" />,
    documentation: <Book className="h-4 w-4" />,
    conversation: <MessageSquare className="h-4 w-4" />,
    system_prompt: <Sparkles className="h-4 w-4" />,
    user_message: <MessageSquare className="h-4 w-4" />,
    assistant_message: <MessageSquare className="h-4 w-4" />,
    tool_result: <Zap className="h-4 w-4" />,
    rag_result: <Book className="h-4 w-4" />,
    web_search: <TrendingUp className="h-4 w-4" />,
    custom: <Info className="h-4 w-4" />,
  };
  return icons[type] || <Info className="h-4 w-4" />;
}

function getItemTypeLabel(type: ContextItemType): string {
  const labels: Record<ContextItemType, string> = {
    file: 'File',
    code_snippet: 'Code Snippet',
    documentation: 'Documentation',
    conversation: 'Conversation',
    system_prompt: 'System Prompt',
    user_message: 'User Message',
    assistant_message: 'AI Response',
    tool_result: 'Tool Result',
    rag_result: 'RAG Result',
    web_search: 'Web Search',
    custom: 'Custom',
  };
  return labels[type] || type;
}

function getPriorityInfo(priority: ContextPriority): { color: string; label: string } {
  const info: Record<ContextPriority, { color: string; label: string }> = {
    [1]: { color: 'bg-red-100 text-red-700 border-red-300', label: 'Critical' },
    [2]: { color: 'bg-orange-100 text-orange-700 border-orange-300', label: 'High' },
    [3]: { color: 'bg-yellow-100 text-yellow-700 border-yellow-300', label: 'Medium' },
    [4]: { color: 'bg-blue-100 text-blue-700 border-blue-300', label: 'Low' },
    [5]: { color: 'bg-gray-100 text-gray-700 border-gray-300', label: 'Optional' },
  };
  return info[priority] || { color: 'bg-gray-100 text-gray-700', label: 'Unknown' };
}

function getStrategyInfo(strategy: ContextStrategy): { color: string; label: string; description: string } {
  const info: Record<ContextStrategy, { color: string; label: string; description: string }> = {
    recent_files: {
      color: 'bg-blue-100 text-blue-700',
      label: 'Recent Files',
      description: 'Prioritizes recently opened/modified files',
    },
    related_files: {
      color: 'bg-green-100 text-green-700',
      label: 'Related Files',
      description: 'Includes imports and dependencies',
    },
    semantic: {
      color: 'bg-purple-100 text-purple-700',
      label: 'Semantic',
      description: 'Uses embeddings for relevance',
    },
    hybrid: {
      color: 'bg-indigo-100 text-indigo-700',
      label: 'Hybrid',
      description: 'Combines multiple strategies',
    },
    conversation: {
      color: 'bg-pink-100 text-pink-700',
      label: 'Conversation',
      description: 'Prioritizes conversation history',
    },
    targeted: {
      color: 'bg-teal-100 text-teal-700',
      label: 'Targeted',
      description: 'Focuses on specific patterns',
    },
  };
  return info[strategy] || { color: 'bg-gray-100 text-gray-700', label: strategy, description: '' };
}

function getUtilizationColor(percent: number): string {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 75) return 'bg-yellow-500';
  if (percent >= 50) return 'bg-blue-500';
  return 'bg-green-500';
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ContextItemCardProps {
  item: ContextItem;
  onClick?: () => void;
  compact?: boolean;
}

const ContextItemCard: React.FC<ContextItemCardProps> = ({ item, onClick, compact = false }) => {
  const [expanded, setExpanded] = useState(false);
  const priorityInfo = getPriorityInfo(item.priority);

  const truncateContent = (content: string, maxLength: number = 200): string => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
      <CardContent className="p-4">
        <div className="space-y-2">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {getItemTypeIcon(item.type)}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {item.metadata.source || item.metadata.symbol || getItemTypeLabel(item.type)}
                </p>
                {item.metadata.language && (
                  <p className="text-xs text-muted-foreground">{item.metadata.language}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={priorityInfo.color}>
                {priorityInfo.label}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
              >
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {formatTokens(item.tokenCount)} tokens
            </span>
            {item.relevanceScore > 0 && (
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {(item.relevanceScore * 100).toFixed(0)}% relevant
              </span>
            )}
            {item.metadata.lastModified && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTimestamp(item.metadata.lastModified)}
              </span>
            )}
          </div>

          {/* Content Preview */}
          {!compact && (
            <div className="mt-2">
              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap">
                {expanded ? item.content : truncateContent(item.content)}
              </pre>
            </div>
          )}

          {/* Scores */}
          {expanded && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Relevance: </span>
                <span className="font-medium">{(item.relevanceScore * 100).toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">Recency: </span>
                <span className="font-medium">{(item.recencyScore * 100).toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">Combined: </span>
                <span className="font-medium">{(item.combinedScore * 100).toFixed(1)}%</span>
              </div>
              {item.isRequired && (
                <div>
                  <Badge variant="outline" className="bg-green-100 text-green-700">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Required
                  </Badge>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  description?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, description, variant = 'default' }) => {
  const variantStyles = {
    default: 'bg-card',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    danger: 'bg-red-50 border-red-200',
  };

  return (
    <Card className={variantStyles[variant]}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="p-3 bg-muted rounded-full">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export function ContextViewer({
  className = '',
  sessionId,
  autoRefresh = false,
  refreshInterval = 5000,
  compact = false,
  showExcluded = true,
  onItemClick,
}: ContextViewerProps) {
  const [contextData, setContextData] = useState<ContextApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch context data
  const fetchContextData = useCallback(async () => {
    try {
      setError(null);
      const url = sessionId
        ? `/api/ai/context/current?sessionId=${sessionId}`
        : '/api/ai/context/current';

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch context: ${response.statusText}`);
      }

      const data = await response.json();
      setContextData(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load context');
      console.error('Context fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Initial load
  useEffect(() => {
    fetchContextData();
  }, [fetchContextData]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchContextData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchContextData]);

  // Computed values
  const stats = useMemo(() => {
    if (!contextData) return null;

    const { window, statistics } = contextData.data;
    return {
      totalTokens: statistics.totalTokens,
      availableTokens: window.availableTokens,
      utilization: statistics.utilizationPercent,
      includedCount: statistics.includedItems,
      excludedCount: statistics.excludedItems,
      totalCount: statistics.totalItems,
    };
  }, [contextData]);

  const strategyInfo = useMemo(() => {
    if (!contextData) return null;
    return getStrategyInfo(contextData.data.window.strategy);
  }, [contextData]);

  // Handlers
  const handleRefresh = () => {
    setIsLoading(true);
    fetchContextData();
  };

  const handleItemClick = (item: ContextItem) => {
    onItemClick?.(item);
  };

  // Render loading state
  if (isLoading && !contextData) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Context Viewer
          </CardTitle>
          <CardDescription>Loading context data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render error state
  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Context Viewer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="text-sm text-muted-foreground text-center">{error}</p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!contextData || !stats) {
    return null;
  }

  const { window } = contextData.data;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Context Viewer
            </CardTitle>
            <CardDescription>
              Active context items for your AI conversation
              {lastUpdated && ` • Updated ${formatTimestamp(lastUpdated)}`}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<FileText className="h-4 w-4" />}
            label="Included Items"
            value={stats.includedCount.toString()}
            description={`of ${stats.totalCount} total`}
            variant="success"
          />
          <StatCard
            icon={<Zap className="h-4 w-4" />}
            label="Token Usage"
            value={formatTokens(stats.totalTokens)}
            description={`${formatTokens(stats.availableTokens)} available`}
          />
          <StatCard
            icon={<BarChart3 className="h-4 w-4" />}
            label="Utilization"
            value={`${stats.utilization.toFixed(1)}%`}
            variant={stats.utilization >= 90 ? 'danger' : stats.utilization >= 75 ? 'warning' : 'default'}
          />
          <StatCard
            icon={<XCircle className="h-4 w-4" />}
            label="Excluded"
            value={stats.excludedCount.toString()}
            description="items removed"
            variant={stats.excludedCount > 0 ? 'warning' : 'default'}
          />
        </div>

        {/* Utilization Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Context Window Utilization</span>
            <span className="font-medium">{stats.totalTokens.toLocaleString()} / {window.modelConfig.maxContextTokens.toLocaleString()} tokens</span>
          </div>
          <Progress
            value={stats.utilization}
            className="h-3"
          />
        </div>

        {/* Strategy Info */}
        {strategyInfo && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Badge className={strategyInfo.color}>
              {strategyInfo.label}
            </Badge>
            <span className="text-sm text-muted-foreground">{strategyInfo.description}</span>
          </div>
        )}

        <Separator />

        {/* Context Items Tabs */}
        <Tabs defaultValue="included" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="included" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Included ({stats.includedCount})
            </TabsTrigger>
            {showExcluded && (
              <TabsTrigger value="excluded" className="flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Excluded ({stats.excludedCount})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="included" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {window.items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <EyeOff className="h-12 w-12 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No items in context</p>
                  </div>
                ) : (
                  window.items.map((item) => (
                    <ContextItemCard
                      key={item.id}
                      item={item}
                      onClick={() => handleItemClick(item)}
                      compact={compact}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {showExcluded && (
            <TabsContent value="excluded" className="mt-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {window.excludedItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <CheckCircle className="h-12 w-12 text-green-500 mb-2" />
                      <p className="text-sm text-muted-foreground">All items included</p>
                    </div>
                  ) : (
                    window.excludedItems.map((item) => (
                      <ContextItemCard
                        key={item.id}
                        item={item}
                        onClick={() => handleItemClick(item)}
                        compact={compact}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default ContextViewer;
