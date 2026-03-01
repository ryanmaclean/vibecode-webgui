/**
 * Model Usage History Component
 *
 * Displays AI model usage tracking over time:
 * - Usage trends and patterns
 * - Model preference breakdown
 * - Token consumption statistics
 * - Time-series visualizations
 *
 * @module components/ai/ModelUsageHistory
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Activity,
  Clock,
  TrendingUp,
  RefreshCw,
  BarChart3,
  Zap,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import {
  UsageHistory,
  UsageDataPoint,
  SessionUsage,
  TimePeriod,
  ModelUsageBreakdown,
  CostEvent,
  UsageStats,
} from '@/types/cost-estimation';
import { getCostTracker, CostTracker } from '@/lib/ai/cost/cost-tracker';

// ============================================================================
// Types
// ============================================================================

interface ModelUsageHistoryProps {
  /** Custom CSS class name */
  className?: string;
  /** Custom cost tracker instance */
  costTracker?: CostTracker;
  /** Refresh interval in milliseconds (0 to disable) */
  refreshInterval?: number;
  /** Compact mode for smaller displays */
  compact?: boolean;
  /** Show all-time statistics */
  showAllTime?: boolean;
}

interface DashboardData {
  history: UsageHistory;
  session: SessionUsage;
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}

function formatTimestamp(timestamp: string, period: TimePeriod): string {
  const date = new Date(timestamp);
  switch (period) {
    case 'hourly':
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    case 'daily':
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    case 'weekly':
      return `Week ${Math.ceil(date.getDate() / 7)}`;
    case 'monthly':
      return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
    default:
      return date.toLocaleDateString();
  }
}

function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(6)}`;
  if (cost < 1) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface UsageChartProps {
  data: UsageDataPoint[];
  period: TimePeriod;
  metric: 'tokens' | 'requests';
}

function UsageChart({ data, period, metric }: UsageChartProps) {
  const chartData = useMemo(() => {
    return data.map((point) => ({
      timestamp: formatTimestamp(point.timestamp, period),
      tokens: point.tokens,
      requests: point.requests,
    }));
  }, [data, period]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No usage data for this period</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="timestamp"
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
        />
        <YAxis
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          tickFormatter={(value) =>
            metric === 'tokens' ? formatTokens(value) : value.toString()
          }
        />
        <Tooltip
          formatter={(value: number) =>
            metric === 'tokens' ? formatTokens(value) : value.toString()
          }
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
        />
        <Area
          type="monotone"
          dataKey={metric}
          stroke="#3B82F6"
          fillOpacity={1}
          fill="url(#colorTokens)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  description?: string;
  icon: React.ReactNode;
  testId?: string;
}

function StatCard({ title, value, description, icon, testId }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p data-testid={testId} className="text-2xl font-bold">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ModelUsageHistory({
  className = '',
  costTracker,
  refreshInterval = 30000,
  compact = false,
  showAllTime = true,
}: ModelUsageHistoryProps) {
  // ============================================================================
  // State Management
  // ============================================================================

  const tracker = useMemo(() => costTracker || getCostTracker(), [costTracker]);
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('daily');
  const [selectedMetric, setSelectedMetric] = useState<'tokens' | 'requests'>('tokens');
  const [lastUpdate, setLastUpdate] = useState<string>(new Date().toISOString());

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const history = tracker.getUsageHistory();
      const session = history.currentSession;

      setData({
        history,
        session,
      });
      setLastUpdate(new Date().toISOString());
    } catch (error) {
      console.error('Failed to load usage history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tracker]);

  // ============================================================================
  // Effects
  // ============================================================================

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = tracker.subscribe((event: CostEvent) => {
      if (event.type === 'usage_recorded') {
        loadData();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [tracker, loadData]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(() => {
        loadData();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
    return undefined;
  }, [refreshInterval, loadData]);

  // ============================================================================
  // Computed Values
  // ============================================================================

  const currentPeriodData = useMemo(() => {
    if (!data) return [];
    return data.history[selectedPeriod] || [];
  }, [data, selectedPeriod]);

  const totalTokensUsed = useMemo(() => {
    if (!data) return 0;
    return data.session.totalTokens || 0;
  }, [data]);

  const totalRequests = useMemo(() => {
    if (!data) return 0;
    return data.session.requests || 0;
  }, [data]);

  const averageTokensPerRequest = useMemo(() => {
    if (!data || totalRequests === 0) return 0;
    return Math.round(totalTokensUsed / totalRequests);
  }, [data, totalTokensUsed, totalRequests]);

  const mostUsedModel = useMemo(() => {
    if (!data || !data.session.byModel) return 'N/A';
    const models = Object.entries(data.session.byModel) as [string, UsageStats][];
    if (models.length === 0) return 'N/A';

    const sorted = models.sort((a, b) => b[1].requests - a[1].requests);
    return sorted[0]?.[1]?.modelId || 'N/A';
  }, [data]);

  const modelBreakdown = useMemo(() => {
    if (!data || !data.session.byModel) return [];

    const breakdown: ModelUsageBreakdown[] = (Object.values(data.session.byModel) as UsageStats[]).map((model) => ({
      modelId: model.modelId,
      displayName: model.modelId,
      promptTokens: model.promptTokens,
      completionTokens: model.completionTokens,
      totalCost: model.totalCost,
      requests: model.requests,
      percentage: totalRequests > 0 ? (model.requests / totalRequests) * 100 : 0,
    }));

    return breakdown.sort((a, b) => b.requests - a.requests);
  }, [data, totalRequests]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleRefresh = useCallback(() => {
    loadData();
  }, [loadData]);

  const handlePeriodChange = useCallback((value: string) => {
    setSelectedPeriod(value as TimePeriod);
  }, []);

  const handleMetricChange = useCallback((value: string) => {
    setSelectedMetric(value as 'tokens' | 'requests');
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  if (isLoading && !data) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Card>
          <CardContent className="p-12 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading usage history...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Card>
          <CardContent className="p-12 text-center">
            <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">No Usage Data</p>
            <p className="text-sm text-muted-foreground">
              Start using AI models to see usage statistics
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div data-testid="model-usage-history" className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Model Usage History
              </CardTitle>
              <CardDescription>
                Track AI model usage, token consumption, and patterns over time
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Tokens"
          value={formatTokens(totalTokensUsed)}
          description="Current session"
          icon={<Zap className="h-6 w-6 text-primary" />}
          testId="total-tokens"
        />
        <StatCard
          title="Total Requests"
          value={totalRequests.toString()}
          description="API calls made"
          icon={<Activity className="h-6 w-6 text-primary" />}
          testId="total-requests"
        />
        <StatCard
          title="Avg Tokens/Request"
          value={formatTokens(averageTokensPerRequest)}
          description="Average per call"
          icon={<TrendingUp className="h-6 w-6 text-primary" />}
          testId="avg-tokens"
        />
        <StatCard
          title="Most Used Model"
          value={mostUsedModel}
          description="Top choice"
          icon={<BarChart3 className="h-6 w-6 text-primary" />}
          testId="most-used-model"
        />
      </div>

      {/* Usage Trends Chart */}
      {currentPeriodData.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Usage Trends
                </CardTitle>
                <CardDescription>
                  {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} usage patterns over time
                </CardDescription>
              </div>
              <Select value={selectedMetric} onValueChange={handleMetricChange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tokens">Tokens</SelectItem>
                  <SelectItem value="requests">Requests</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <UsageChart
              data={currentPeriodData}
              period={selectedPeriod}
              metric={selectedMetric}
            />
          </CardContent>
        </Card>
      )}

      {/* Model Breakdown */}
      {modelBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Model Usage Breakdown</CardTitle>
            <CardDescription>
              Usage distribution across different AI models
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {modelBreakdown.map((model: ModelUsageBreakdown) => (
                <div key={model.modelId} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{model.displayName}</span>
                    <span className="text-muted-foreground">
                      {model.requests} requests ({model.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Tokens: {formatTokens(model.promptTokens + model.completionTokens)}</span>
                    <span>Cost: {formatCost(model.totalCost)}</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all"
                      style={{ width: `${model.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All-Time Stats */}
      {showAllTime && data.history.allTime && (
        <Card>
          <CardHeader>
            <CardTitle>All-Time Statistics</CardTitle>
            <CardDescription>
              Lifetime usage metrics since {new Date(data.history.allTime.firstUsageDate || Date.now()).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Total Tokens</p>
                <p className="text-2xl font-bold">{formatTokens(data.history.allTime.totalTokens)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{data.history.allTime.totalRequests.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold">{formatCost(data.history.allTime.totalCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period Data Summary */}
      {currentPeriodData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} Usage
            </CardTitle>
            <CardDescription>
              {currentPeriodData.length} data points
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {currentPeriodData.slice(-5).reverse().map((dataPoint: UsageDataPoint, index: number) => (
                <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {formatTimestamp(dataPoint.timestamp, selectedPeriod)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dataPoint.requests} requests
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm font-medium">
                      {formatTokens(dataPoint.tokens)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCost(dataPoint.cost)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Update Info */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Last updated: {new Date(lastUpdate).toLocaleString()}</span>
        <Badge variant="outline" className="text-xs">
          {currentPeriodData.length} {selectedPeriod} data points
        </Badge>
      </div>
    </div>
  );
}
