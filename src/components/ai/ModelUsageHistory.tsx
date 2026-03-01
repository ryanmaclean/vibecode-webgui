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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Activity,
  Clock,
  TrendingUp,
  RefreshCw,
  BarChart3,
  Zap,
  PieChart,
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
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
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
import { getCostTracker, CostTracker, MODEL_PRICING } from '@/lib/ai/cost/cost-tracker';

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

/**
 * Internal dashboard data structure
 */
interface DashboardData {
  /** Complete usage history across all time periods */
  history: UsageHistory;
  /** Current session usage statistics */
  session: SessionUsage;
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

const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10A37F',
  anthropic: '#D4A373',
  google: '#4285F4',
  meta: '#0668E1',
  mistral: '#F97316',
  cohere: '#7C3AED',
  deepseek: '#06B6D4',
  alibaba: '#FF6A00',
  xai: '#1DA1F2',
  perplexity: '#3B82F6',
  unknown: '#6B7280',
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format token count for display with K/M suffixes
 * @param tokens - Number of tokens
 * @returns Formatted token string (e.g., "1.5K", "2.3M")
 */
function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}

/**
 * Format timestamp according to time period granularity
 * @param timestamp - ISO timestamp string
 * @param period - Time period for formatting context
 * @returns Formatted timestamp string
 */
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

/**
 * Format cost value for display with appropriate precision
 * @param cost - Cost value in USD
 * @returns Formatted cost string with dollar sign
 */
function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(6)}`;
  if (cost < 1) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Props for the usage trend chart component
 */
interface UsageChartProps {
  /** Array of usage data points to visualize */
  data: UsageDataPoint[];
  /** Time period for x-axis formatting */
  period: TimePeriod;
  /** Metric to display (tokens or request count) */
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

/**
 * Props for the token consumption breakdown chart
 */
interface TokenConsumptionChartProps {
  /** Array of usage data points with prompt/completion token breakdown */
  data: UsageDataPoint[];
  /** Time period for x-axis formatting */
  period: TimePeriod;
}

function TokenConsumptionChart({ data, period }: TokenConsumptionChartProps) {
  const chartData = useMemo(() => {
    return data.map((point) => ({
      timestamp: formatTimestamp(point.timestamp, period),
      prompt: point.promptTokens || 0,
      completion: point.completionTokens || 0,
      total: point.tokens,
    }));
  }, [data, period]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No token consumption data for this period</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="colorPrompt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#10B981" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="colorCompletion" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1} />
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
          tickFormatter={(value) => formatTokens(value)}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            formatTokens(value),
            name === 'prompt' ? 'Prompt Tokens' : 'Completion Tokens',
          ]}
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
        />
        <Legend />
        <Area
          type="monotone"
          dataKey="prompt"
          stackId="1"
          stroke="#10B981"
          fill="url(#colorPrompt)"
          name="Prompt"
        />
        <Area
          type="monotone"
          dataKey="completion"
          stackId="1"
          stroke="#3B82F6"
          fill="url(#colorCompletion)"
          name="Completion"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * Props for the statistics card component
 */
interface StatCardProps {
  /** Card title/label */
  title: string;
  /** Primary value to display */
  value: string;
  /** Optional description text */
  description?: string;
  /** Icon element to display */
  icon: React.ReactNode;
  /** Optional test ID for testing */
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

/**
 * Props for the model usage breakdown chart
 */
interface ModelBreakdownChartProps {
  /** Usage statistics keyed by model ID */
  data: Record<string, UsageStats>;
  /** Type of chart to display */
  chartType: 'pie' | 'bar';
}

function ModelBreakdownChart({ data, chartType }: ModelBreakdownChartProps) {
  const chartData = useMemo(() => {
    return Object.entries(data)
      .map(([modelId, stats]) => {
        const pricing = MODEL_PRICING[modelId];
        return {
          name: pricing?.displayName || modelId,
          modelId,
          requests: stats.requests,
          tokens: stats.promptTokens + stats.completionTokens,
          cost: stats.totalCost,
          provider: pricing?.provider || 'unknown',
        };
      })
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 8);
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No model usage data yet</p>
      </div>
    );
  }

  if (chartType === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <RechartsPieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="requests"
            nameKey="name"
            label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={PROVIDER_COLORS[entry.provider] || CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [
              `${value} requests`,
              name,
            ]}
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
          />
          <Legend />
        </RechartsPieChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          label={{ value: 'Requests', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip
          formatter={(value: number) => [`${value} requests`, 'Requests']}
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
        />
        <Bar dataKey="requests" radius={[8, 8, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={PROVIDER_COLORS[entry.provider] || CHART_COLORS[index % CHART_COLORS.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Available sort fields for the model usage table */
type SortField = 'model' | 'requests' | 'tokens' | 'promptTokens' | 'completionTokens' | 'cost';

/** Sort direction (ascending or descending) */
type SortDirection = 'asc' | 'desc';

/**
 * Props for the model usage table component
 */
interface ModelUsageTableProps {
  /** Array of model usage statistics to display */
  data: ModelUsageBreakdown[];
}

function ModelUsageTable({ data }: ModelUsageTableProps) {
  const [sortField, setSortField] = useState<SortField>('requests');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = useCallback((field: SortField) => {
    setSortDirection((prev) => {
      if (sortField === field) {
        return prev === 'asc' ? 'desc' : 'asc';
      }
      return 'desc';
    });
    setSortField(field);
  }, [sortField]);

  const sortedData = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortField) {
        case 'model':
          aValue = a.displayName;
          bValue = b.displayName;
          break;
        case 'requests':
          aValue = a.requests;
          bValue = b.requests;
          break;
        case 'tokens':
          aValue = a.promptTokens + a.completionTokens;
          bValue = b.promptTokens + b.completionTokens;
          break;
        case 'promptTokens':
          aValue = a.promptTokens;
          bValue = b.promptTokens;
          break;
        case 'completionTokens':
          aValue = a.completionTokens;
          bValue = b.completionTokens;
          break;
        case 'cost':
          aValue = a.totalCost;
          bValue = b.totalCost;
          break;
        default:
          aValue = a.requests;
          bValue = b.requests;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

    return sorted;
  }, [data, sortField, sortDirection]);

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-muted-foreground ml-1">⇅</span>;
    }
    return <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        <p>No model usage data yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th
              className="text-left py-3 px-2 font-medium cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('model')}
            >
              Model <SortIndicator field="model" />
            </th>
            <th
              className="text-right py-3 px-2 font-medium cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('requests')}
            >
              Requests <SortIndicator field="requests" />
            </th>
            <th
              className="text-right py-3 px-2 font-medium cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('promptTokens')}
            >
              Prompt <SortIndicator field="promptTokens" />
            </th>
            <th
              className="text-right py-3 px-2 font-medium cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('completionTokens')}
            >
              Completion <SortIndicator field="completionTokens" />
            </th>
            <th
              className="text-right py-3 px-2 font-medium cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('tokens')}
            >
              Total <SortIndicator field="tokens" />
            </th>
            <th
              className="text-right py-3 px-2 font-medium cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('cost')}
            >
              Cost <SortIndicator field="cost" />
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((model) => {
            const pricing = MODEL_PRICING[model.modelId];
            const provider = pricing?.provider || 'unknown';
            const totalTokens = model.promptTokens + model.completionTokens;

            return (
              <tr key={model.modelId} className="border-b hover:bg-muted/50">
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: PROVIDER_COLORS[provider] }}
                    />
                    <span className="font-medium">{model.displayName}</span>
                  </div>
                </td>
                <td className="text-right py-3 px-2">{model.requests}</td>
                <td className="text-right py-3 px-2 text-muted-foreground">
                  {formatTokens(model.promptTokens)}
                </td>
                <td className="text-right py-3 px-2 text-muted-foreground">
                  {formatTokens(model.completionTokens)}
                </td>
                <td className="text-right py-3 px-2 font-medium">
                  {formatTokens(totalTokens)}
                </td>
                <td className="text-right py-3 px-2 font-medium">
                  {formatCost(model.totalCost)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('daily');
  const [selectedMetric, setSelectedMetric] = useState<'tokens' | 'requests'>('tokens');
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');
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

  const totalPromptTokens = useMemo(() => {
    if (!data || !data.session.byModel) return 0;
    return Object.values(data.session.byModel).reduce(
      (sum: number, model: UsageStats) => sum + (model.promptTokens || 0),
      0
    );
  }, [data]);

  const totalCompletionTokens = useMemo(() => {
    if (!data || !data.session.byModel) return 0;
    return Object.values(data.session.byModel).reduce(
      (sum: number, model: UsageStats) => sum + (model.completionTokens || 0),
      0
    );
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

  const handleChartTypeToggle = useCallback(() => {
    setChartType((prev) => (prev === 'pie' ? 'bar' : 'pie'));
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Model Usage History
              </CardTitle>
              <CardDescription>
                Track AI model usage, token consumption, and patterns over time
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 gap-1">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
            <span className="sm:hidden">Stats</span>
          </TabsTrigger>
          <TabsTrigger value="trends" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Usage Trends</span>
            <span className="sm:hidden">Trends</span>
          </TabsTrigger>
          <TabsTrigger value="models" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Model Breakdown</span>
            <span className="sm:hidden">Models</span>
          </TabsTrigger>
          <TabsTrigger value="details" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Details</span>
            <span className="sm:hidden">More</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
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

          {/* Token Consumption Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">Prompt Tokens</p>
                    <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                      <Zap className="h-5 w-5 text-green-500" />
                    </div>
                  </div>
                  <p data-testid="prompt-tokens" className="text-2xl font-bold">
                    {formatTokens(totalPromptTokens)}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="rounded-full h-2 bg-green-500 transition-all"
                        style={{
                          width: `${totalTokensUsed > 0 ? (totalPromptTokens / totalTokensUsed) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {totalTokensUsed > 0 ? ((totalPromptTokens / totalTokensUsed) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">Completion Tokens</p>
                    <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <Zap className="h-5 w-5 text-blue-500" />
                    </div>
                  </div>
                  <p data-testid="completion-tokens" className="text-2xl font-bold">
                    {formatTokens(totalCompletionTokens)}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="rounded-full h-2 bg-blue-500 transition-all"
                        style={{
                          width: `${totalTokensUsed > 0 ? (totalCompletionTokens / totalTokensUsed) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {totalTokensUsed > 0 ? ((totalCompletionTokens / totalTokensUsed) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">Token Ratio</p>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <p data-testid="token-ratio" className="text-2xl font-bold">
                    {totalPromptTokens > 0
                      ? (totalCompletionTokens / totalPromptTokens).toFixed(2)
                      : '0.00'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Completion/Prompt ratio
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* All-Time Stats in Overview */}
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
        </TabsContent>

        {/* Usage Trends Tab */}
        <TabsContent value="trends" className="space-y-6 mt-6">
          {/* Token Consumption Chart */}
          {currentPeriodData.length > 0 ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        Token Consumption
                      </CardTitle>
                      <CardDescription>
                        Prompt vs completion token usage over time
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent data-testid="token-consumption-chart">
                  <TokenConsumptionChart
                    data={currentPeriodData}
                    period={selectedPeriod}
                  />
                </CardContent>
              </Card>

              {/* Usage Trends Chart */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">No Trend Data</p>
                <p className="text-sm text-muted-foreground">
                  No usage data available for the selected {selectedPeriod} period
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Model Breakdown Tab */}
        <TabsContent value="models" className="space-y-6 mt-6">
          {modelBreakdown.length > 0 ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Model Usage Breakdown</CardTitle>
                        <CardDescription>
                          Usage distribution across different AI models
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleChartTypeToggle}
                        data-testid="chart-type-toggle"
                      >
                        {chartType === 'pie' ? (
                          <BarChart3 className="h-4 w-4" />
                        ) : (
                          <PieChart className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent data-testid="model-breakdown-chart">
                    <ModelBreakdownChart data={data.session.byModel} chartType={chartType} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Model Usage Details</CardTitle>
                    <CardDescription>
                      Detailed statistics for each model used (click headers to sort)
                    </CardDescription>
                  </CardHeader>
                  <CardContent data-testid="model-usage-table">
                    <ModelUsageTable data={modelBreakdown} />
                  </CardContent>
                </Card>
              </div>

              {/* Top Models Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Models Summary</CardTitle>
                  <CardDescription>
                    Quick overview of most frequently used models
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    {modelBreakdown.slice(0, 3).map((model, index) => {
                      const pricing = MODEL_PRICING[model.modelId];
                      const provider = pricing?.provider || 'unknown';
                      const totalTokens = model.promptTokens + model.completionTokens;

                      return (
                        <Card key={model.modelId}>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: PROVIDER_COLORS[provider] }}
                              />
                              <p className="font-medium text-sm truncate">{model.displayName}</p>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Requests:</span>
                                <span className="font-medium">{model.requests}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Tokens:</span>
                                <span className="font-medium">{formatTokens(totalTokens)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Share:</span>
                                <Badge variant="secondary" className="text-xs">
                                  {model.percentage.toFixed(1)}%
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">No Model Data</p>
                <p className="text-sm text-muted-foreground">
                  No AI models have been used yet
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-6 mt-6">
          {/* Period Data Summary */}
          {currentPeriodData.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} Activity
                </CardTitle>
                <CardDescription>
                  Last 5 data points from {currentPeriodData.length} total
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {currentPeriodData.slice(-5).reverse().map((dataPoint: UsageDataPoint, index: number) => (
                    <div key={index} className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-muted/50 transition-colors border">
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
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">No Activity Data</p>
                <p className="text-sm text-muted-foreground">
                  No recent activity in the selected {selectedPeriod} period
                </p>
              </CardContent>
            </Card>
          )}

          {/* Session Info */}
          <Card>
            <CardHeader>
              <CardTitle>Session Information</CardTitle>
              <CardDescription>
                Current usage session details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Session Start:</span>
                    <span className="text-sm font-medium">
                      {data.session.sessionStart
                        ? new Date(data.session.sessionStart).toLocaleString()
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Last Updated:</span>
                    <span className="text-sm font-medium">
                      {new Date(lastUpdate).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Requests:</span>
                    <Badge variant="secondary">{totalRequests}</Badge>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Tokens:</span>
                    <Badge variant="secondary">{formatTokens(totalTokensUsed)}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Models Used:</span>
                    <Badge variant="secondary">{modelBreakdown.length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Data Points:</span>
                    <Badge variant="secondary">
                      {currentPeriodData.length} {selectedPeriod}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
