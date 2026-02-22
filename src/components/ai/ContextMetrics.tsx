/**
 * AI Context Metrics Dashboard Component
 *
 * Displays comprehensive context window metrics including:
 * - Token utilization and capacity
 * - Relevance score distributions
 * - Priority and type distributions
 * - Context quality trends
 * - Performance metrics
 *
 * @module components/ai/ContextMetrics
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Gauge,
  Target,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Download,
  BarChart3,
  PieChart,
  Clock,
  Layers,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import {
  AggregatedContextMetrics,
  ContextQualitySnapshot,
  ContextEvent,
  RelevanceStats,
  PriorityDistribution,
  TypeDistribution,
} from '@/lib/ai/context/context-metrics';

// ============================================================================
// Types
// ============================================================================

interface ContextMetricsProps {
  /** Custom CSS class name */
  className?: string;
  /** Session ID to fetch metrics for */
  sessionId?: string;
  /** Refresh interval in milliseconds (0 to disable) */
  refreshInterval?: number;
  /** Compact mode for smaller displays */
  compact?: boolean;
}

interface MetricsDashboardData {
  aggregated: AggregatedContextMetrics | null;
  snapshot: ContextQualitySnapshot | null;
  events: ContextEvent[];
  snapshots: ContextQualitySnapshot[];
}

// ============================================================================
// Chart Colors
// ============================================================================

const CHART_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
];

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high: '#F59E0B',
  medium: '#3B82F6',
  low: '#10B981',
  optional: '#6B7280',
};

const TYPE_COLORS: Record<string, string> = {
  systemPrompt: '#8B5CF6',
  userMessage: '#3B82F6',
  assistantMessage: '#10B981',
  file: '#F59E0B',
  ragResult: '#EC4899',
  conversation: '#06B6D4',
  toolResult: '#84CC16',
};

// ============================================================================
// Utility Functions
// ============================================================================

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(0);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function getUtilizationColor(percent: number): string {
  if (percent < 30) return 'text-yellow-500';
  if (percent < 80) return 'text-green-500';
  if (percent < 95) return 'text-orange-500';
  return 'text-red-500';
}

function getUtilizationVariant(
  percent: number
): 'default' | 'success' | 'warning' | 'danger' {
  if (percent < 30) return 'warning';
  if (percent < 80) return 'success';
  if (percent < 95) return 'warning';
  return 'danger';
}

// ============================================================================
// Sub-Components
// ============================================================================

interface StatCardProps {
  title: string;
  value: string;
  description?: string;
  icon: React.ReactNode;
  trend?: number;
  trendLabel?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

function StatCard({
  title,
  value,
  description,
  icon,
  trend,
  trendLabel,
  variant = 'default',
}: StatCardProps) {
  const variantStyles = {
    default: 'bg-card',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    danger: 'bg-red-50 border-red-200',
  };

  return (
    <Card className={variantStyles[variant]}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          <div className="p-3 bg-muted rounded-full">{icon}</div>
        </div>
        {trend !== undefined && (
          <div className="mt-3 flex items-center space-x-1">
            {trend >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span
              className={`text-sm ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}
            >
              {Math.abs(trend).toFixed(1)}%
            </span>
            {trendLabel && (
              <span className="text-xs text-muted-foreground">{trendLabel}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ContextMetrics({
  className,
  sessionId = 'default',
  refreshInterval = 5000,
  compact = false,
}: ContextMetricsProps) {
  const [data, setData] = useState<MetricsDashboardData>({
    aggregated: null,
    snapshot: null,
    events: [],
    snapshots: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'1h' | '24h' | '7d' | 'all'>(
    '24h'
  );
  const [autoRefresh, setAutoRefresh] = useState(true);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ sessionId });

      const [aggregatedRes, snapshotRes, eventsRes, snapshotsRes] = await Promise.all([
        fetch(`/api/ai/context/metrics?${params}`),
        fetch(`/api/ai/context/metrics?${params}&action=latest`),
        fetch(`/api/ai/context/metrics?${params}&action=events&limit=100`),
        fetch(`/api/ai/context/metrics?${params}&action=snapshots&limit=50`),
      ]);

      const [aggregated, snapshot, events, snapshots] = await Promise.all([
        aggregatedRes.ok ? aggregatedRes.json() : null,
        snapshotRes.ok ? snapshotRes.json() : null,
        eventsRes.ok ? eventsRes.json() : null,
        snapshotsRes.ok ? snapshotsRes.json() : null,
      ]);

      setData({
        aggregated: aggregated?.data || null,
        snapshot: snapshot?.data || null,
        events: events?.data || [],
        snapshots: snapshots?.data || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Auto-refresh
  useEffect(() => {
    fetchMetrics();

    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(fetchMetrics, refreshInterval);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [fetchMetrics, autoRefresh, refreshInterval]);

  // ============================================================================
  // Chart Data Preparation
  // ============================================================================

  const utilizationHistory = useMemo(() => {
    return data.snapshots
      .slice(-20)
      .map((snapshot, index) => ({
        index: index + 1,
        utilization: snapshot.utilizationPercent,
        tokens: snapshot.totalTokens,
        timestamp: new Date(snapshot.timestamp).toLocaleTimeString(),
      }));
  }, [data.snapshots]);

  const priorityData = useMemo(() => {
    if (!data.snapshot) return [];

    const dist = data.snapshot.priorityDistribution;
    return [
      { name: 'Critical', value: dist.critical, color: PRIORITY_COLORS.critical },
      { name: 'High', value: dist.high, color: PRIORITY_COLORS.high },
      { name: 'Medium', value: dist.medium, color: PRIORITY_COLORS.medium },
      { name: 'Low', value: dist.low, color: PRIORITY_COLORS.low },
      { name: 'Optional', value: dist.optional, color: PRIORITY_COLORS.optional },
    ].filter((item) => item.value > 0);
  }, [data.snapshot]);

  const typeData = useMemo(() => {
    if (!data.snapshot) return [];

    const dist = data.snapshot.typeDistribution;
    return [
      { name: 'System', value: dist.systemPrompt, color: TYPE_COLORS.systemPrompt },
      { name: 'User', value: dist.userMessage, color: TYPE_COLORS.userMessage },
      {
        name: 'Assistant',
        value: dist.assistantMessage,
        color: TYPE_COLORS.assistantMessage,
      },
      { name: 'File', value: dist.file, color: TYPE_COLORS.file },
      { name: 'RAG', value: dist.ragResult, color: TYPE_COLORS.ragResult },
      {
        name: 'Conversation',
        value: dist.conversation,
        color: TYPE_COLORS.conversation,
      },
      { name: 'Tool', value: dist.toolResult, color: TYPE_COLORS.toolResult },
    ].filter((item) => item.value > 0);
  }, [data.snapshot]);

  const relevanceHistogram = useMemo(() => {
    if (!data.snapshots.length) return [];

    // Create histogram bins for relevance scores
    const bins = [
      { range: '0-0.2', count: 0 },
      { range: '0.2-0.4', count: 0 },
      { range: '0.4-0.6', count: 0 },
      { range: '0.6-0.8', count: 0 },
      { range: '0.8-1.0', count: 0 },
    ];

    const latestSnapshot = data.snapshots[data.snapshots.length - 1];
    if (!latestSnapshot) return bins;

    // This is simplified - in reality you'd need to get individual relevance scores
    const avgScore = latestSnapshot.averageRelevanceScore;
    const binIndex = Math.min(Math.floor(avgScore / 0.2), 4);
    bins[binIndex].count = latestSnapshot.itemsIncluded;

    return bins;
  }, [data.snapshots]);

  // ============================================================================
  // Render
  // ============================================================================

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 text-red-500">
            <AlertCircle className="h-5 w-5" />
            <span>Error loading metrics: {error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { aggregated, snapshot } = data;

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Context Metrics</h2>
          <p className="text-sm text-muted-foreground">
            Context window quality and utilization metrics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`}
            />
            {autoRefresh ? 'Auto-refresh On' : 'Auto-refresh Off'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchMetrics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {loading && !snapshot ? (
        <Card>
          <CardContent className="p-12">
            <div className="flex items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Context Utilization"
              value={formatPercent(snapshot?.utilizationPercent || 0)}
              description={`${formatNumber(snapshot?.totalTokens || 0)} / ${formatNumber(snapshot?.availableTokens || 0)} tokens`}
              icon={<Gauge className="h-6 w-6" />}
              variant={getUtilizationVariant(snapshot?.utilizationPercent || 0)}
            />
            <StatCard
              title="Avg Relevance Score"
              value={(snapshot?.averageRelevanceScore || 0).toFixed(3)}
              description={`${snapshot?.itemsIncluded || 0} items included`}
              icon={<Target className="h-6 w-6" />}
              variant={
                (snapshot?.averageRelevanceScore || 0) > 0.7 ? 'success' : 'warning'
              }
            />
            <StatCard
              title="Items Included"
              value={formatNumber(snapshot?.itemsIncluded || 0)}
              description={`${snapshot?.itemsExcluded || 0} excluded`}
              icon={<Layers className="h-6 w-6" />}
            />
            <StatCard
              title="Avg Build Time"
              value={formatDuration(aggregated?.averageBuildTimeMs || 0)}
              description={`${aggregated?.contextBuilds || 0} builds`}
              icon={<Clock className="h-6 w-6" />}
              variant={
                (aggregated?.averageBuildTimeMs || 0) < 1000 ? 'success' : 'warning'
              }
            />
          </div>

          {/* Current Context Status */}
          {snapshot && (
            <Card>
              <CardHeader>
                <CardTitle>Current Context Window</CardTitle>
                <CardDescription>
                  Strategy: {snapshot.strategy} | Model: {snapshot.model}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Token Utilization</span>
                    <span
                      className={`text-sm font-bold ${getUtilizationColor(snapshot.utilizationPercent)}`}
                    >
                      {formatPercent(snapshot.utilizationPercent)}
                    </span>
                  </div>
                  <Progress value={snapshot.utilizationPercent} className="h-2" />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Tokens:</span>
                    <span className="ml-2 font-medium">
                      {formatNumber(snapshot.totalTokens)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Available:</span>
                    <span className="ml-2 font-medium">
                      {formatNumber(snapshot.availableTokens)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Exclusion Rate:</span>
                    <span className="ml-2 font-medium">
                      {formatPercent(snapshot.exclusionRate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Build Time:</span>
                    <span className="ml-2 font-medium">
                      {formatDuration(snapshot.buildDurationMs || 0)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Charts */}
          <Tabs defaultValue="utilization" className="space-y-4">
            <TabsList>
              <TabsTrigger value="utilization">Utilization</TabsTrigger>
              <TabsTrigger value="priority">Priority</TabsTrigger>
              <TabsTrigger value="types">Types</TabsTrigger>
              <TabsTrigger value="relevance">Relevance</TabsTrigger>
            </TabsList>

            {/* Utilization History */}
            <TabsContent value="utilization">
              <Card>
                <CardHeader>
                  <CardTitle>Utilization History</CardTitle>
                  <CardDescription>
                    Context window utilization over recent builds
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={utilizationHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" />
                      <YAxis />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="utilization"
                        stroke="#3B82F6"
                        fill="#3B82F6"
                        fillOpacity={0.2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Priority Distribution */}
            <TabsContent value="priority">
              <Card>
                <CardHeader>
                  <CardTitle>Priority Distribution</CardTitle>
                  <CardDescription>
                    Breakdown of context items by priority level
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Pie
                        data={priorityData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        {priorityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Type Distribution */}
            <TabsContent value="types">
              <Card>
                <CardHeader>
                  <CardTitle>Item Type Distribution</CardTitle>
                  <CardDescription>
                    Breakdown of context items by type
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={typeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value">
                        {typeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Relevance Scores */}
            <TabsContent value="relevance">
              <Card>
                <CardHeader>
                  <CardTitle>Relevance Score Distribution</CardTitle>
                  <CardDescription>
                    Distribution of item relevance scores
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {snapshot && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Min:</span>
                          <span className="ml-2 font-medium">
                            {snapshot.relevanceStats.min.toFixed(3)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Max:</span>
                          <span className="ml-2 font-medium">
                            {snapshot.relevanceStats.max.toFixed(3)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Mean:</span>
                          <span className="ml-2 font-medium">
                            {snapshot.relevanceStats.mean.toFixed(3)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Median:</span>
                          <span className="ml-2 font-medium">
                            {snapshot.relevanceStats.median.toFixed(3)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">P95:</span>
                          <span className="ml-2 font-medium">
                            {snapshot.relevanceStats.p95.toFixed(3)}
                          </span>
                        </div>
                      </div>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={relevanceHistogram}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="range" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" fill="#3B82F6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Aggregated Metrics */}
          {aggregated && (
            <Card>
              <CardHeader>
                <CardTitle>Session Statistics</CardTitle>
                <CardDescription>
                  Aggregated metrics for session {sessionId}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Events:</span>
                    <span className="ml-2 font-medium">{aggregated.totalEvents}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Context Builds:</span>
                    <span className="ml-2 font-medium">{aggregated.contextBuilds}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Avg Tokens:</span>
                    <span className="ml-2 font-medium">
                      {formatNumber(aggregated.averageTokens)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Avg Exclusion:</span>
                    <span className="ml-2 font-medium">
                      {formatPercent(aggregated.averageExclusionRate)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default ContextMetrics;
