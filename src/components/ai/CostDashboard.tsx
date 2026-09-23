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
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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
  AlertType,
  AlertSeverity,
} from '@/types/cost-estimation';
import { getCostTracker, CostTracker, MODEL_PRICING } from '@/lib/ai/cost/cost-tracker';
import { CostSettingsPanel } from '@/components/ai/CostSettingsPanel';

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
  testId?: string;
}

function StatCard({ title, value, description, icon, trend, trendLabel, variant = 'default', testId }: StatCardProps): React.JSX.Element {
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
            <p data-testid={testId} className="text-2xl font-bold">{value}</p>
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

function AlertBanner({ alerts, onDismiss }: AlertBannerProps): React.JSX.Element | null {
  const t = useTranslations('ai');
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
                {t('costDashboard.alerts.current', { cost: formatCost(alert.current) })} / {t('costDashboard.alerts.threshold', { cost: formatCost(alert.threshold) })}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onDismiss(alert.id)}>
            {t('costDashboard.alerts.dismiss')}
          </Button>
        </div>
      ))}
    </div>
  );
}

interface ModelBreakdownChartProps {
  data: Record<string, { totalCost: number; requests: number }>;
}

function ModelBreakdownChart({ data }: ModelBreakdownChartProps): React.JSX.Element {
  const t = useTranslations('ai');
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
        <p>{t('costDashboard.models.noModelDataChart')}</p>
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={((value: number) => formatCost(value)) as any}
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

function UsageChart({ data, period, metric }: UsageChartProps): React.JSX.Element {
  const t = useTranslations('ai');
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
        <p>{t('costDashboard.noUsageData')}</p>
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={((value: number) =>
            metric === 'cost' ? formatCost(value) : formatTokens(value)
          ) as any}
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

function PredictionCard({ sessionCost, dailyData, settings }: PredictionCardProps): React.JSX.Element {
  const t = useTranslations('ai');
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
          <span>{t('costDashboard.overview.costPredictions')}</span>
        </CardTitle>
        <CardDescription>
          {t('costDashboard.overview.costPredictionsDesc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{t('costDashboard.overview.daily')}</p>
            <p className="text-xl font-bold">{formatCost(predictions.daily)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{t('costDashboard.overview.weekly')}</p>
            <p className="text-xl font-bold">{formatCost(predictions.weekly)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{t('costDashboard.overview.monthly')}</p>
            <p className="text-xl font-bold">{formatCost(predictions.monthly)}</p>
          </div>
        </div>

        {settings.monthlyBudget > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{t('costDashboard.overview.monthlyBudgetProgress')}</span>
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
                {t('costDashboard.overview.budgetWillExhaust', { days: predictions.daysUntilBudgetExhausted })}
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
}: CostDashboardProps): React.JSX.Element {
  const t = useTranslations('ai');
  const tracker = customTracker || getCostTracker();
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('daily');
  const [selectedMetric, setSelectedMetric] = useState<'cost' | 'tokens' | 'requests'>('cost');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Alert creation dialog state
  const [isCreateAlertOpen, setIsCreateAlertOpen] = useState(false);
  const [newAlertType, setNewAlertType] = useState<AlertType>('budget_threshold');
  const [newAlertThreshold, setNewAlertThreshold] = useState<string>('10.00');
  const [newAlertSeverity, setNewAlertSeverity] = useState<AlertSeverity>('warning');
  const [newAlertResetPeriod, setNewAlertResetPeriod] = useState<TimePeriod>('monthly');
  const [newAlertEnabled, setNewAlertEnabled] = useState(true);
  const [newAlertNotify, setNewAlertNotify] = useState(true);

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

  // Handle alert creation
  const handleCreateAlert = useCallback(() => {
    try {
      const threshold = parseFloat(newAlertThreshold);
      if (isNaN(threshold) || threshold <= 0) {
        return;
      }

      tracker.createAlert({
        type: newAlertType,
        threshold,
        enabled: newAlertEnabled,
        notifyOnTrigger: newAlertNotify,
        notificationChannels: newAlertNotify ? ['in_app'] : [],
        resetPeriod: newAlertResetPeriod,
      });

      // Reset form and close dialog
      setNewAlertType('budget_threshold');
      setNewAlertThreshold('10.00');
      setNewAlertSeverity('warning');
      setNewAlertResetPeriod('monthly');
      setNewAlertEnabled(true);
      setNewAlertNotify(true);
      setIsCreateAlertOpen(false);

      // Reload data to show new alert
      loadData();
    } catch (error) {
      console.error('Failed to create alert:', error);
    }
  }, [tracker, newAlertType, newAlertThreshold, newAlertSeverity, newAlertResetPeriod, newAlertEnabled, newAlertNotify, loadData]);

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
          <h2 className="text-2xl font-bold">{t('costDashboard.title')}</h2>
          <p className="text-muted-foreground">
            {t('costDashboard.description', { count: Object.keys(MODEL_PRICING).length })}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => loadData()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            {t('costDashboard.refresh')}
          </Button>
          <Select
            value="csv"
            onValueChange={(v) => handleExport(v as 'csv' | 'json')}
          >
            <SelectTrigger className="w-[140px]">
              <Download className="h-4 w-4 mr-1" />
              <SelectValue placeholder={t('costDashboard.export')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">{t('costDashboard.exportCsv')}</SelectItem>
              <SelectItem value="json">{t('costDashboard.exportJson')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Alert Banner */}
      <AlertBanner alerts={alerts} onDismiss={handleDismissAlert} />

      {/* Stats Grid */}
      <div className={`grid gap-4 ${compact ? 'grid-cols-2' : 'grid-cols-4'}`}>
        <StatCard
          title={t('costDashboard.stats.sessionCost')}
          value={formatCost(session.totalCost)}
          description={t('costDashboard.stats.sessionCostDesc', { count: session.requests })}
          icon={<DollarSign className="h-5 w-5" />}
          testId="session-cost"
        />
        <StatCard
          title={t('costDashboard.stats.todayCost')}
          value={formatCost(todayCost)}
          description={`${formatTokens(history.daily[history.daily.length - 1]?.tokens || session.totalTokens)} tokens`}
          icon={<Activity className="h-5 w-5" />}
          trend={dailyTrend}
          trendLabel={t('costDashboard.stats.vsYesterday')}
        />
        <StatCard
          title={t('costDashboard.stats.totalTokens')}
          value={formatTokens(session.totalTokens)}
          description={t('costDashboard.stats.totalTokensDesc')}
          icon={<Zap className="h-5 w-5" />}
        />
        <StatCard
          title={t('costDashboard.stats.allTimeCost')}
          value={formatCost(history.allTime.totalCost)}
          description={t('costDashboard.stats.allTimeCostDesc', { count: history.allTime.totalRequests })}
          icon={<Clock className="h-5 w-5" />}
        />
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-1" />
            {t('costDashboard.tabs.overview')}
          </TabsTrigger>
          <TabsTrigger value="models" data-testid="models-tab">
            <PieChart className="h-4 w-4 mr-1" />
            {t('costDashboard.tabs.byModel')}
          </TabsTrigger>
          <TabsTrigger value="alerts" data-testid="alerts-tab">
            <Bell className="h-4 w-4 mr-1" />
            {t('costDashboard.tabs.alerts')}
            {alerts.filter((a) => a.triggered).length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {alerts.filter((a) => a.triggered).length}
              </Badge>
            )}
          </TabsTrigger>
          {showSettings && (
            <TabsTrigger value="settings" data-testid="settings-tab">
              <Settings className="h-4 w-4 mr-1" />
              {t('costDashboard.tabs.settings')}
            </TabsTrigger>
          )}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('costDashboard.overview.usageOverTime')}</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Select
                      value={selectedPeriod}
                      onValueChange={(v) => setSelectedPeriod(v as TimePeriod)}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">{t('modelUsage.periodSelect.hourly')}</SelectItem>
                        <SelectItem value="daily">{t('modelUsage.periodSelect.daily')}</SelectItem>
                        <SelectItem value="weekly">{t('modelUsage.periodSelect.weekly')}</SelectItem>
                        <SelectItem value="monthly">{t('modelUsage.periodSelect.monthly')}</SelectItem>
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
                        <SelectItem value="cost">{t('costDashboard.metricSelect.cost')}</SelectItem>
                        <SelectItem value="tokens">{t('costDashboard.metricSelect.tokens')}</SelectItem>
                        <SelectItem value="requests">{t('costDashboard.metricSelect.requests')}</SelectItem>
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
                <CardTitle>{t('costDashboard.models.costByModel')}</CardTitle>
                <CardDescription>
                  {t('costDashboard.models.costByModelDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent data-testid="model-breakdown">
                <ModelBreakdownChart data={session.byModel} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('costDashboard.models.modelUsageDetails')}</CardTitle>
                <CardDescription>
                  {t('costDashboard.models.modelUsageDetailsDesc')}
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
                                {t('costDashboard.models.requestsLabel', { count: stats.requests })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatCost(stats.totalCost)}</p>
                            <p className="text-sm text-muted-foreground">
                              {t('costDashboard.models.tokensLabel', { tokens: formatTokens(stats.promptTokens + stats.completionTokens) })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  {Object.keys(session.byModel).length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      {t('costDashboard.models.noModelData')}
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('costDashboard.alerts.title')}</CardTitle>
                  <CardDescription>
                    {t('costDashboard.alerts.description')}
                  </CardDescription>
                </div>
                <Button onClick={() => setIsCreateAlertOpen(true)}>
                  <Bell className="h-4 w-4 mr-2" />
                  {t('costDashboard.alerts.createAlert')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">
                    {t('costDashboard.alerts.noAlerts')}
                  </p>
                  <Button onClick={() => setIsCreateAlertOpen(true)}>{t('costDashboard.alerts.createAlert')}</Button>
                </div>
              ) : (
                <div data-testid="alert-list" className="space-y-4">
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
                            {t('costDashboard.alerts.thresholdCurrent', { threshold: formatCost(alert.threshold), current: formatCost(alert.current) })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={alert.enabled ? 'default' : 'secondary'}>
                          {alert.enabled ? t('costDashboard.alerts.active') : t('costDashboard.alerts.disabled')}
                        </Badge>
                        {alert.triggered && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDismissAlert(alert.id)}
                          >
                            {t('costDashboard.alerts.acknowledge')}
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
            <CostSettingsPanel
              costTracker={tracker}
              onSettingsSaved={loadData}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Create Alert Dialog */}
      <Dialog open={isCreateAlertOpen} onOpenChange={setIsCreateAlertOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('costDashboard.createAlertDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('costDashboard.createAlertDialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="alert-type">{t('costDashboard.createAlertDialog.alertType')}</Label>
              <Select
                value={newAlertType}
                onValueChange={(v) => setNewAlertType(v as AlertType)}
              >
                <SelectTrigger data-testid="alert-type" id="alert-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="budget_threshold">{t('costDashboard.createAlertDialog.alertTypes.budget_threshold')}</SelectItem>
                  <SelectItem value="daily_limit">{t('costDashboard.createAlertDialog.alertTypes.daily_limit')}</SelectItem>
                  <SelectItem value="session_limit">{t('costDashboard.createAlertDialog.alertTypes.session_limit')}</SelectItem>
                  <SelectItem value="rate_spike">{t('costDashboard.createAlertDialog.alertTypes.rate_spike')}</SelectItem>
                  <SelectItem value="unusual_usage">{t('costDashboard.createAlertDialog.alertTypes.unusual_usage')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="alert-threshold">{t('costDashboard.createAlertDialog.threshold')}</Label>
              <Input
                data-testid="alert-threshold"
                id="alert-threshold"
                type="number"
                step="0.01"
                min="0"
                value={newAlertThreshold}
                onChange={(e) => setNewAlertThreshold(e.target.value)}
                placeholder="10.00"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="alert-severity">{t('costDashboard.createAlertDialog.severity')}</Label>
              <Select
                value={newAlertSeverity}
                onValueChange={(v) => setNewAlertSeverity(v as AlertSeverity)}
              >
                <SelectTrigger data-testid="alert-severity" id="alert-severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">{t('costDashboard.createAlertDialog.severities.info')}</SelectItem>
                  <SelectItem value="warning">{t('costDashboard.createAlertDialog.severities.warning')}</SelectItem>
                  <SelectItem value="critical">{t('costDashboard.createAlertDialog.severities.critical')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="alert-reset-period">{t('costDashboard.createAlertDialog.resetPeriod')}</Label>
              <Select
                value={newAlertResetPeriod}
                onValueChange={(v) => setNewAlertResetPeriod(v as TimePeriod)}
              >
                <SelectTrigger id="alert-reset-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">{t('modelUsage.periodSelect.hourly')}</SelectItem>
                  <SelectItem value="daily">{t('modelUsage.periodSelect.daily')}</SelectItem>
                  <SelectItem value="weekly">{t('modelUsage.periodSelect.weekly')}</SelectItem>
                  <SelectItem value="monthly">{t('modelUsage.periodSelect.monthly')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="alert-enabled"
                checked={newAlertEnabled}
                onCheckedChange={setNewAlertEnabled}
              />
              <Label htmlFor="alert-enabled" className="cursor-pointer">
                {t('costDashboard.createAlertDialog.enableImmediately')}
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="alert-notify"
                checked={newAlertNotify}
                onCheckedChange={setNewAlertNotify}
              />
              <Label htmlFor="alert-notify" className="cursor-pointer">
                {t('costDashboard.createAlertDialog.sendNotifications')}
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateAlertOpen(false)}>
              {t('costDashboard.createAlertDialog.cancel')}
            </Button>
            <Button onClick={handleCreateAlert}>{t('costDashboard.createAlertDialog.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <div className="text-xs text-muted-foreground text-center">
        {t('costDashboard.lastUpdated', { time: lastUpdated.toLocaleTimeString() })}
      </div>
    </div>
  );
}
