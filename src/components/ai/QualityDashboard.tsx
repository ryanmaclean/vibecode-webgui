/**
 * AI Quality Metrics Dashboard Component
 *
 * Displays comprehensive quality tracking information including:
 * - Model quality metrics (acceptance rate, edit distance, similarity, ratings)
 * - Historical trends and degradation alerts
 * - Model comparison analytics
 * - Interactive charts for trend visualization
 *
 * @module components/ai/QualityDashboard
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  CheckCircle,
  Edit3,
  RefreshCw,
  Star,
  BarChart3,
  AlertTriangle,
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
  Area,
  AreaChart,
  Legend,
} from 'recharts';

// ============================================================================
// Types
// ============================================================================

interface QualityDashboardProps {
  /** Custom CSS class name */
  className?: string;
  /** Refresh interval in milliseconds (0 to disable) */
  refreshInterval?: number;
  /** Compact mode for smaller displays */
  compact?: boolean;
}

interface ModelMetrics {
  modelId: string;
  acceptanceRate: number;
  avgEditDistance: number;
  avgSimilarity: number;
  avgTimeToAccept: number;
  avgRating: number | null;
  totalSuggestions: number;
  acceptedSuggestions: number;
  rejectedSuggestions: number;
  trend: 'improving' | 'stable' | 'degrading';
  healthStatus: 'healthy' | 'warning' | 'critical';
}

interface Alert {
  id: string;
  modelId: string;
  alertType: string;
  severity: 'warning' | 'critical';
  message: string;
  threshold: number;
  currentValue: number;
  previousValue: number | null;
  detectedAt: string;
  resolved: boolean;
}

interface TrendDataPoint {
  timestamp: string;
  acceptanceRate: number;
  avgEditDistance: number;
  avgSimilarity: number;
  avgRating: number | null;
}

interface DashboardData {
  overall: {
    acceptanceRate: number;
    avgEditDistance: number;
    avgSimilarity: number;
    avgTimeToAccept: number;
    avgRating: number | null;
    totalSuggestions: number;
    activeAlerts: number;
  };
  models: ModelMetrics[];
  alerts: Alert[];
  recentActivity: Array<{
    modelId: string;
    period: string;
    acceptanceRate: number;
    suggestions: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  trends?: TrendDataPoint[];
}

// ============================================================================
// Chart Colors
// ============================================================================

const CHART_COLORS = {
  acceptanceRate: '#10B981',
  editDistance: '#F59E0B',
  similarity: '#3B82F6',
  rating: '#8B5CF6',
};

const HEALTH_STATUS_COLORS = {
  healthy: 'bg-green-500',
  warning: 'bg-yellow-500',
  critical: 'bg-red-500',
};

const ALERT_SEVERITY_COLORS = {
  warning: 'bg-yellow-100 border-yellow-300',
  critical: 'bg-red-100 border-red-300',
};

// ============================================================================
// Utility Functions
// ============================================================================

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(0);
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getHealthStatusColor(status: string): string {
  return HEALTH_STATUS_COLORS[status as keyof typeof HEALTH_STATUS_COLORS] || 'bg-gray-500';
}

function getTrendIcon(trend: string) {
  switch (trend) {
    case 'improving':
    case 'up':
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case 'degrading':
    case 'down':
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    default:
      return <Activity className="h-4 w-4 text-blue-500" />;
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

function StatCard({ title, value, description, icon, trend, trendLabel, variant = 'default', testId }: StatCardProps) {
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
              <TrendingUp className={`h-4 w-4 ${trend > 0 ? 'text-green-500' : 'text-gray-500'}`} />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span className={`text-sm ${trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-gray-500'}`}>
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
  alerts: Alert[];
  onDismiss?: (alertId: string) => void;
}

function AlertBanner({ alerts, onDismiss }: AlertBannerProps) {
  const activeAlerts = alerts.filter((a) => !a.resolved);

  if (activeAlerts.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {activeAlerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-center justify-between p-4 rounded-lg ${
            ALERT_SEVERITY_COLORS[alert.severity]
          } border`}
        >
          <div className="flex items-center space-x-3">
            <AlertCircle
              className={`h-5 w-5 ${
                alert.severity === 'critical' ? 'text-red-600' : 'text-yellow-600'
              }`}
            />
            <div>
              <div className="flex items-center space-x-2">
                <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                  {alert.severity.toUpperCase()}
                </Badge>
                <span className="font-medium">{alert.modelId}</span>
                <span className="text-xs text-muted-foreground">{alert.alertType}</span>
              </div>
              <p className="text-sm mt-1">{alert.message}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Current: {alert.currentValue.toFixed(2)} | Threshold: {alert.threshold.toFixed(2)}
                {alert.previousValue && ` | Previous: ${alert.previousValue.toFixed(2)}`}
              </p>
            </div>
          </div>
          {onDismiss && (
            <Button variant="ghost" size="sm" onClick={() => onDismiss(alert.id)}>
              Dismiss
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

interface ModelCardProps {
  model: ModelMetrics;
}

function ModelCard({ model }: ModelCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${getHealthStatusColor(model.healthStatus)}`} />
            {model.modelId}
          </CardTitle>
          <Badge variant={model.healthStatus === 'healthy' ? 'secondary' : 'destructive'}>
            {model.healthStatus}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Acceptance Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Acceptance Rate</p>
            <p className="font-semibold text-green-600">{formatPercentage(model.acceptanceRate)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Suggestions</p>
            <p className="font-semibold">{formatNumber(model.totalSuggestions)}</p>
          </div>
        </div>

        {/* Quality Metrics */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-gray-600">Edit Distance</p>
            <p className="font-medium">{model.avgEditDistance.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-gray-600">Similarity</p>
            <p className="font-medium">{formatPercentage(model.avgSimilarity)}</p>
          </div>
          <div>
            <p className="text-gray-600">Rating</p>
            <p className="font-medium">{model.avgRating ? model.avgRating.toFixed(1) : 'N/A'}</p>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div className="flex items-center text-sm">
            <Clock className="h-4 w-4 mr-1 text-gray-500" />
            <span className="text-gray-600">Avg time:</span>
            <span className="ml-1 font-medium">{formatTime(model.avgTimeToAccept)}</span>
          </div>
          <div className="flex items-center text-sm">
            {getTrendIcon(model.trend)}
            <span className="ml-1 font-medium capitalize">{model.trend}</span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-sm">
            <span className="text-green-600">✓ {model.acceptedSuggestions}</span>
            <span className="text-gray-500 ml-2">accepted</span>
          </div>
          <div className="text-sm">
            <span className="text-red-600">✗ {model.rejectedSuggestions}</span>
            <span className="text-gray-500 ml-2">rejected</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface TrendChartProps {
  data: TrendDataPoint[];
  metric: 'acceptanceRate' | 'editDistance' | 'similarity' | 'rating';
}

function TrendChart({ data, metric }: TrendChartProps) {
  const chartData = useMemo(() => {
    return data.map((point) => ({
      timestamp: formatTimestamp(point.timestamp),
      value: metric === 'acceptanceRate'
        ? point.acceptanceRate * 100
        : metric === 'similarity'
        ? point.avgSimilarity * 100
        : metric === 'rating'
        ? point.avgRating || 0
        : point.avgEditDistance,
    }));
  }, [data, metric]);

  const metricLabels = {
    acceptanceRate: 'Acceptance Rate (%)',
    editDistance: 'Edit Distance',
    similarity: 'Similarity (%)',
    rating: 'Rating',
  };

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No trend data available</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id={`color${metric}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS[metric]} stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART_COLORS[metric]} stopOpacity={0} />
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
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
          formatter={(value: number) => [value.toFixed(2), metricLabels[metric]]}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={CHART_COLORS[metric]}
          fillOpacity={1}
          fill={`url(#color${metric})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function QualityDashboard({
  className = '',
  refreshInterval = 30000,
  compact = false,
}: QualityDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [selectedMetric, setSelectedMetric] = useState<'acceptanceRate' | 'editDistance' | 'similarity' | 'rating'>('acceptanceRate');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Load dashboard data
  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        period: selectedPeriod,
        includeAlerts: 'true',
        includeTrends: 'true',
      });

      if (selectedModel !== 'all') {
        params.set('modelIds', selectedModel);
      }

      const response = await fetch(`/api/monitoring/quality-dashboard?${params}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const dashboardData = await response.json();
      setData(dashboardData);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, [selectedPeriod, selectedModel]);

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

  if (isLoading) {
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

  if (error) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-red-700">Error loading dashboard: {error}</span>
          </div>
          <Button
            onClick={loadData}
            variant="outline"
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No quality data available</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI Quality Metrics Dashboard</h2>
          <p className="text-muted-foreground">
            Track AI suggestion quality, acceptance rates, and model performance
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={selectedPeriod} onValueChange={(v: string) => setSelectedPeriod(v as 'day' | 'week' | 'month')}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Models" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Models</SelectItem>
              {data.models.map((model: ModelMetrics) => (
                <SelectItem key={model.modelId} value={model.modelId}>
                  {model.modelId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alert Banner */}
      <AlertBanner alerts={data.alerts} />

      {/* Stats Grid */}
      <div className={`grid gap-4 ${compact ? 'grid-cols-2' : 'grid-cols-4'}`}>
        <StatCard
          title="Acceptance Rate"
          value={formatPercentage(data.overall.acceptanceRate)}
          description={`${formatNumber(data.overall.totalSuggestions)} suggestions`}
          icon={<CheckCircle className="h-5 w-5" />}
          testId="acceptance-rate"
          variant={data.overall.acceptanceRate >= 0.7 ? 'success' : data.overall.acceptanceRate >= 0.5 ? 'default' : 'warning'}
        />
        <StatCard
          title="Avg Edit Distance"
          value={data.overall.avgEditDistance.toFixed(1)}
          description="Characters changed"
          icon={<Edit3 className="h-5 w-5" />}
          testId="edit-distance"
          variant={data.overall.avgEditDistance <= 10 ? 'success' : data.overall.avgEditDistance <= 20 ? 'default' : 'warning'}
        />
        <StatCard
          title="Avg Similarity"
          value={formatPercentage(data.overall.avgSimilarity)}
          description="To original suggestion"
          icon={<Activity className="h-5 w-5" />}
          testId="similarity"
        />
        <StatCard
          title="Avg Time to Accept"
          value={formatTime(data.overall.avgTimeToAccept)}
          description={data.overall.avgRating ? `Rating: ${data.overall.avgRating.toFixed(1)}★` : undefined}
          icon={<Clock className="h-5 w-5" />}
          testId="time-to-accept"
        />
      </div>

      {/* Active Alerts Count */}
      {data.alerts.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <span className="font-medium">
                  {data.alerts.filter(a => !a.resolved).length} Active Quality Alerts
                </span>
              </div>
              <Badge variant="destructive">
                {data.alerts.filter((a: Alert) => a.severity === 'critical' && !a.resolved).length} Critical
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-1" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="models" data-testid="models-tab">
            <Activity className="h-4 w-4 mr-1" />
            By Model
          </TabsTrigger>
          <TabsTrigger value="trends" data-testid="trends-tab">
            <TrendingUp className="h-4 w-4 mr-1" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="alerts" data-testid="alerts-tab">
            <AlertCircle className="h-4 w-4 mr-1" />
            Alerts
            {data.alerts.filter((a: Alert) => !a.resolved).length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {data.alerts.filter((a: Alert) => !a.resolved).length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest model performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.recentActivity.map((activity: DashboardData['recentActivity'][0], index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getTrendIcon(activity.trend)}
                        <div>
                          <p className="font-medium">{activity.modelId}</p>
                          <p className="text-sm text-muted-foreground">{activity.period}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatPercentage(activity.acceptanceRate)}</p>
                        <p className="text-sm text-muted-foreground">{activity.suggestions} suggestions</p>
                      </div>
                    </div>
                  ))}
                  {data.recentActivity.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No recent activity</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Model Health Summary</CardTitle>
                <CardDescription>Status of all monitored models</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.models.map((model: ModelMetrics) => (
                    <div key={model.modelId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${getHealthStatusColor(model.healthStatus)}`} />
                        <div>
                          <p className="font-medium">{model.modelId}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatNumber(model.totalSuggestions)} suggestions
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={model.healthStatus === 'healthy' ? 'secondary' : 'destructive'}>
                          {model.healthStatus}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {data.models.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No models tracked yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Models Tab */}
        <TabsContent value="models" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data.models.map((model: ModelMetrics) => (
              <ModelCard key={model.modelId} model={model} />
            ))}
          </div>
          {data.models.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No model data available for the selected period</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Quality Trends Over Time</CardTitle>
                <Select value={selectedMetric} onValueChange={(v: string) => setSelectedMetric(v as 'acceptanceRate' | 'editDistance' | 'similarity' | 'rating')}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="acceptanceRate">Acceptance Rate</SelectItem>
                    <SelectItem value="editDistance">Edit Distance</SelectItem>
                    <SelectItem value="similarity">Similarity</SelectItem>
                    <SelectItem value="rating">Rating</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {data.trends && data.trends.length > 0 ? (
                <TrendChart data={data.trends} metric={selectedMetric} />
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <p>No trend data available for the selected period</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quality Degradation Alerts</CardTitle>
              <CardDescription>Monitor quality issues across all models</CardDescription>
            </CardHeader>
            <CardContent>
              {data.alerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-gray-600">No quality alerts. All models performing well!</p>
                </div>
              ) : (
                <div data-testid="alert-list" className="space-y-3">
                  {data.alerts.map((alert: Alert) => (
                    <div
                      key={alert.id}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        alert.resolved ? 'border-border opacity-60' : ALERT_SEVERITY_COLORS[alert.severity as keyof typeof ALERT_SEVERITY_COLORS]
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`p-2 rounded-full ${alert.resolved ? 'bg-gray-200' : alert.severity === 'critical' ? 'bg-red-200' : 'bg-yellow-200'}`}>
                          <AlertCircle className={`h-4 w-4 ${alert.resolved ? 'text-gray-500' : alert.severity === 'critical' ? 'text-red-600' : 'text-yellow-600'}`} />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={alert.resolved ? 'secondary' : alert.severity === 'critical' ? 'destructive' : 'default'}>
                              {alert.resolved ? 'RESOLVED' : alert.severity.toUpperCase()}
                            </Badge>
                            <span className="font-medium">{alert.modelId}</span>
                            <span className="text-xs text-muted-foreground">{alert.alertType}</span>
                          </div>
                          <p className="text-sm mt-1">{alert.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Detected: {formatTimestamp(alert.detectedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-medium">Current: {alert.currentValue.toFixed(2)}</p>
                        <p className="text-muted-foreground">Threshold: {alert.threshold.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="text-xs text-muted-foreground text-center">
        Last updated: {lastUpdated.toLocaleTimeString()}
      </div>
    </div>
  );
}
