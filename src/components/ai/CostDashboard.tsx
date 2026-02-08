/**
 * AI Cost Dashboard Component
 *
 * Displays comprehensive cost tracking information including:
 * - Current session costs
 * - Daily/weekly/monthly usage views
 * - Cost breakdown by model
 * - Interactive charts
 * - Cost predictions based on usage patterns
 *
 * @module components/ai/CostDashboard
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
  AlertCircle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  Zap,
  Download,
  RefreshCw,
  Bell,
  Settings,
  PieChart,
  BarChart3,
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
  Area,
  AreaChart,
} from 'recharts';
import {
  UsageHistory,
  UsageDataPoint,
  SessionUsage,
  CostAlert,
  CostSettings,
  TimePeriod,
  ModelPricing,
} from '@/types/cost-estimation';
import { getCostTracker, CostTracker, MODEL_PRICING } from '@/lib/ai/cost/cost-tracker';

// ============================================================================
// Types
// ============================================================================

interface CostDashboardProps {
  /** Custom CSS class name */
  className?: string;
  /** Custom cost tracker instance */
  costTracker?: CostTracker;
  /** Refresh interval in milliseconds (0 to disable) */
  refreshInterval?: number;
  /** Show settings panel */
  showSettings?: boolean;
  /** Compact mode for smaller displays */
  compact?: boolean;
}

interface DashboardData {
  session: SessionUsage;
  history: UsageHistory;
  alerts: CostAlert[];
  settings: CostSettings;
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

function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(6)}`;
  if (cost < 1) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}

function getPercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
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

function StatCard({ title, value, description, icon, trend, trendLabel, variant = 'default' }: StatCardProps) {
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
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="p-3 bg-muted rounded-full">{icon}</div>
        </div>
        {trend !== undefined && (
          <div className="mt-3 flex items-center space-x-1">
            {trend >= 0 ? (
              <TrendingUp className="h-4 w-4 text-red-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-green-500" />
            )}
            <span className={`text-sm ${trend >= 0 ? 'text-red-500' : 'text-green-500'}`}>
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

interface AlertBannerProps {
  alerts: CostAlert[];
  onDismiss: (alertId: string) => void;
}

function AlertBanner({ alerts, onDismiss }: AlertBannerProps) {
  const triggeredAlerts = alerts.filter((a) => a.triggered && a.enabled);

  if (triggeredAlerts.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {triggeredAlerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-center justify-between p-4 rounded-lg ${
            alert.severity === 'critical'
              ? 'bg-red-100 border border-red-300'
              : alert.severity === 'warning'
              ? 'bg-yellow-100 border border-yellow-300'
              : 'bg-blue-100 border border-blue-300'
          }`}
        >
          <div className="flex items-center space-x-3">
            <AlertCircle
              className={`h-5 w-5 ${
                alert.severity === 'critical'
                  ? 'text-red-600'
                  : alert.severity === 'warning'
                  ? 'text-yellow-600'
                  : 'text-blue-600'
              }`}
            />
            <div>
              <p className="font-medium">{alert.message}</p>
              <p className="text-sm text-muted-foreground">
                Current: {formatCost(alert.current)} / Threshold: {formatCost(alert.threshold)}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onDismiss(alert.id)}>
            Dismiss
          </Button>
        </div>
      ))}
    </div>
  );
}

interface ModelBreakdownChartProps {
  data: Record<string, { totalCost: number; requests: number }>;
}

function ModelBreakdownChart({ data }: ModelBreakdownChartProps) {
  const chartData = useMemo(() => {
    return Object.entries(data)
      .map(([modelId, stats]) => {
        const pricing = MODEL_PRICING[modelId];
        return {
          name: pricing?.displayName || modelId,
          cost: stats.totalCost,
          requests: stats.requests,
          provider: pricing?.provider || 'unknown',
        };
      })
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 8);
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No model usage data yet</p>
      </div>
    );
  }

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
          dataKey="cost"
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
          formatter={(value: number) => formatCost(value)}
          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
        />
        <Legend />
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}

interface UsageChartProps {
  data: UsageDataPoint[];
  period: TimePeriod;
  metric: 'cost' | 'tokens' | 'requests';
}

function UsageChart({ data, period, metric }: UsageChartProps) {
  const chartData = useMemo(() => {
    return data.map((point) => ({
      timestamp: formatTimestamp(point.timestamp, period),
      cost: point.cost,
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
          <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
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
            metric === 'cost' ? formatCost(value) : formatTokens(value)
          }
        />
        <Tooltip
          formatter={(value: number) =>
            metric === 'cost' ? formatCost(value) : formatTokens(value)
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
          fill="url(#colorCost)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface PredictionCardProps {
  sessionCost: number;
  dailyData: UsageDataPoint[];
  settings: CostSettings;
}

function PredictionCard({ sessionCost, dailyData, settings }: PredictionCardProps) {
  const predictions = useMemo(() => {
    // Calculate average daily spending from last 7 days
    const recentDays = dailyData.slice(-7);
    const avgDailyCost =
      recentDays.length > 0
        ? recentDays.reduce((sum, d) => sum + d.cost, 0) / recentDays.length
        : sessionCost;

    // Project costs
    const projectedDaily = avgDailyCost;
    const projectedWeekly = avgDailyCost * 7;
    const projectedMonthly = avgDailyCost * 30;

    // Budget progress
    const budgetUsed =
      settings.monthlyBudget > 0
        ? (dailyData.reduce((sum, d) => sum + d.cost, 0) / settings.monthlyBudget) * 100
        : 0;

    return {
      daily: projectedDaily,
      weekly: projectedWeekly,
      monthly: projectedMonthly,
      budgetUsed,
      daysUntilBudgetExhausted:
        settings.monthlyBudget > 0 && avgDailyCost > 0
          ? Math.floor(settings.monthlyBudget / avgDailyCost)
          : null,
    };
  }, [sessionCost, dailyData, settings]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5" />
          <span>Cost Predictions</span>
        </CardTitle>
        <CardDescription>
          Based on your usage patterns over the last 7 days
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Daily</p>
            <p className="text-xl font-bold">{formatCost(predictions.daily)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Weekly</p>
            <p className="text-xl font-bold">{formatCost(predictions.weekly)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Monthly</p>
            <p className="text-xl font-bold">{formatCost(predictions.monthly)}</p>
          </div>
        </div>

        {settings.monthlyBudget > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Monthly Budget Progress</span>
              <span>{predictions.budgetUsed.toFixed(1)}%</span>
            </div>
            <Progress
              value={Math.min(predictions.budgetUsed, 100)}
              className={
                predictions.budgetUsed > 90
                  ? '[&>div]:bg-red-500'
                  : predictions.budgetUsed > 75
                  ? '[&>div]:bg-yellow-500'
                  : ''
              }
            />
            {predictions.daysUntilBudgetExhausted && (
              <p className="text-xs text-muted-foreground">
                At current rate, budget will be exhausted in{' '}
                {predictions.daysUntilBudgetExhausted} days
              </p>
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

export default function CostDashboard({
  className = '',
  costTracker: customTracker,
  refreshInterval = 30000,
  showSettings = true,
  compact = false,
}: CostDashboardProps) {
  const tracker = customTracker || getCostTracker();
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('daily');
  const [selectedMetric, setSelectedMetric] = useState<'cost' | 'tokens' | 'requests'>('cost');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Load dashboard data
  const loadData = useCallback(() => {
    try {
      const session = tracker.getCurrentSession();
      const history = tracker.getUsageHistory();
      const alerts = tracker.getAlerts();
      const settings = tracker.getSettings();

      setData({ session, history, alerts, settings });
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load cost dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tracker]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const interval = setInterval(loadData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, loadData]);

  // Subscribe to cost events
  useEffect(() => {
    const unsubscribe = tracker.subscribe((event) => {
      if (event.type === 'usage_recorded' || event.type === 'alert_triggered') {
        loadData();
      }
    });

    return unsubscribe;
  }, [tracker, loadData]);

  // Handle alert dismiss
  const handleDismissAlert = useCallback(
    (alertId: string) => {
      tracker.acknowledgeAlert(alertId);
      loadData();
    },
    [tracker, loadData]
  );

  // Handle data export
  const handleExport = useCallback(
    (format: 'csv' | 'json') => {
      const exportData =
        format === 'csv'
          ? tracker.exportAsCSV({ format, period: selectedPeriod, includeBreakdown: true, includeModels: true, includeProviders: true })
          : tracker.exportAsJSON({ format, period: selectedPeriod, includeBreakdown: true, includeModels: true, includeProviders: true });

      const blob = new Blob([exportData], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vibecode-costs-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [tracker, selectedPeriod]
  );

  if (isLoading || !data) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-muted rounded" />
            ))}
          </div>
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  const { session, history, alerts, settings } = data;
  const periodData = tracker.getAggregatedUsage(selectedPeriod);

  // Calculate stats
  const todayCost =
    history.daily.length > 0
      ? history.daily[history.daily.length - 1]?.cost || 0
      : session.totalCost;
  const yesterdayCost =
    history.daily.length > 1
      ? history.daily[history.daily.length - 2]?.cost || 0
      : 0;
  const dailyTrend = getPercentageChange(todayCost, yesterdayCost);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI Cost Dashboard</h2>
          <p className="text-muted-foreground">
            Track and manage your AI spending across {Object.keys(MODEL_PRICING).length}+ models
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => loadData()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Select
            value="csv"
            onValueChange={(v) => handleExport(v as 'csv' | 'json')}
          >
            <SelectTrigger className="w-[140px]">
              <Download className="h-4 w-4 mr-1" />
              <SelectValue placeholder="Export" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">Export CSV</SelectItem>
              <SelectItem value="json">Export JSON</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Alert Banner */}
      <AlertBanner alerts={alerts} onDismiss={handleDismissAlert} />

      {/* Stats Grid */}
      <div className={`grid gap-4 ${compact ? 'grid-cols-2' : 'grid-cols-4'}`}>
        <StatCard
          title="Session Cost"
          value={formatCost(session.totalCost)}
          description={`${session.requests} requests`}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          title="Today's Cost"
          value={formatCost(todayCost)}
          description={`${formatTokens(history.daily[history.daily.length - 1]?.tokens || session.totalTokens)} tokens`}
          icon={<Activity className="h-5 w-5" />}
          trend={dailyTrend}
          trendLabel="vs yesterday"
        />
        <StatCard
          title="Total Tokens"
          value={formatTokens(session.totalTokens)}
          description="This session"
          icon={<Zap className="h-5 w-5" />}
        />
        <StatCard
          title="All-Time Cost"
          value={formatCost(history.allTime.totalCost)}
          description={`${history.allTime.totalRequests} total requests`}
          icon={<Clock className="h-5 w-5" />}
        />
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-1" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="models">
            <PieChart className="h-4 w-4 mr-1" />
            By Model
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <Bell className="h-4 w-4 mr-1" />
            Alerts
            {alerts.filter((a) => a.triggered).length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {alerts.filter((a) => a.triggered).length}
              </Badge>
            )}
          </TabsTrigger>
          {showSettings && (
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-1" />
              Settings
            </TabsTrigger>
          )}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Usage Over Time</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Select
                      value={selectedPeriod}
                      onValueChange={(v) => setSelectedPeriod(v as TimePeriod)}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={selectedMetric}
                      onValueChange={(v) => setSelectedMetric(v as 'cost' | 'tokens' | 'requests')}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cost">Cost</SelectItem>
                        <SelectItem value="tokens">Tokens</SelectItem>
                        <SelectItem value="requests">Requests</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <UsageChart
                  data={periodData}
                  period={selectedPeriod}
                  metric={selectedMetric}
                />
              </CardContent>
            </Card>

            <PredictionCard
              sessionCost={session.totalCost}
              dailyData={history.daily}
              settings={settings}
            />
          </div>
        </TabsContent>

        {/* Models Tab */}
        <TabsContent value="models" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Cost by Model</CardTitle>
                <CardDescription>
                  Breakdown of spending across different AI models
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ModelBreakdownChart data={session.byModel} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Model Usage Details</CardTitle>
                <CardDescription>
                  Detailed statistics for each model used
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(session.byModel)
                    .sort(([, a], [, b]) => b.totalCost - a.totalCost)
                    .map(([modelId, stats]) => {
                      const pricing = MODEL_PRICING[modelId];
                      return (
                        <div
                          key={modelId}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{
                                backgroundColor:
                                  PROVIDER_COLORS[pricing?.provider || 'unknown'],
                              }}
                            />
                            <div>
                              <p className="font-medium">
                                {pricing?.displayName || modelId}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {stats.requests} requests
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatCost(stats.totalCost)}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatTokens(stats.promptTokens + stats.completionTokens)} tokens
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  {Object.keys(session.byModel).length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No model usage data in this session
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost Alerts</CardTitle>
              <CardDescription>
                Configure alerts to monitor your AI spending
              </CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">
                    No alerts configured. Set up alerts to monitor your spending.
                  </p>
                  <Button>Create Alert</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        alert.triggered
                          ? 'border-red-300 bg-red-50'
                          : 'border-border'
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        <div
                          className={`p-2 rounded-full ${
                            alert.triggered ? 'bg-red-200' : 'bg-muted'
                          }`}
                        >
                          <Bell
                            className={`h-4 w-4 ${
                              alert.triggered
                                ? 'text-red-600'
                                : 'text-muted-foreground'
                            }`}
                          />
                        </div>
                        <div>
                          <p className="font-medium">{alert.message}</p>
                          <p className="text-sm text-muted-foreground">
                            Threshold: {formatCost(alert.threshold)} | Current:{' '}
                            {formatCost(alert.current)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={alert.enabled ? 'default' : 'secondary'}>
                          {alert.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                        {alert.triggered && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDismissAlert(alert.id)}
                          >
                            Acknowledge
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        {showSettings && (
          <TabsContent value="settings" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Budget Settings</CardTitle>
                  <CardDescription>
                    Configure spending limits and budgets
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Monthly Budget</label>
                    <div className="flex items-center space-x-2">
                      <span className="text-muted-foreground">$</span>
                      <input
                        type="number"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={settings.monthlyBudget}
                        placeholder="0 (unlimited)"
                        readOnly
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Set to 0 for unlimited spending
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Daily Budget</label>
                    <div className="flex items-center space-x-2">
                      <span className="text-muted-foreground">$</span>
                      <input
                        type="number"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={settings.dailyBudget}
                        placeholder="0 (unlimited)"
                        readOnly
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Display Preferences</CardTitle>
                  <CardDescription>
                    Customize how costs are displayed
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Show estimates before send</p>
                      <p className="text-sm text-muted-foreground">
                        Display cost estimates before sending messages
                      </p>
                    </div>
                    <Badge variant={settings.showEstimatesBeforeSend ? 'default' : 'secondary'}>
                      {settings.showEstimatesBeforeSend ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Real-time cost tracking</p>
                      <p className="text-sm text-muted-foreground">
                        Show running cost total during sessions
                      </p>
                    </div>
                    <Badge variant={settings.showRealtimeCosts ? 'default' : 'secondary'}>
                      {settings.showRealtimeCosts ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Optimization suggestions</p>
                      <p className="text-sm text-muted-foreground">
                        Suggest cost-effective model alternatives
                      </p>
                    </div>
                    <Badge variant={settings.enableOptimizationSuggestions ? 'default' : 'secondary'}>
                      {settings.enableOptimizationSuggestions ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Footer */}
      <div className="text-xs text-muted-foreground text-center">
        Last updated: {lastUpdated.toLocaleTimeString()}
      </div>
    </div>
  );
}
