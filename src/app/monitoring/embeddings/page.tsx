'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, DollarSign, Zap, AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { logger } from '@/lib/logger';
interface EmbeddingMetrics {
  timestamp: string;
  service: string;
  status: string;
  metrics: {
    requestCount: number;
    totalTokens: number;
    totalCost: number;
    avgLatency: number;
    errorCount: number;
    lastReset: string;
    requestsPerMinute: number[];
    errorRates: number[];
  };
  recentCalls: Array<{
    timestamp: string;
    duration: number;
    success: boolean;
    tokens: number;
    cost: number;
    errorType?: string;
  }>;
}

interface UsageReport {
  summary: EmbeddingMetrics['metrics'];
  hourlyBreakdown: Array<{
    hour: string;
    requests: number;
    tokens: number;
    cost: number;
    errors: number;
    avgLatency: number;
  }>;
  errorBreakdown: Record<string, number>;
  recommendations: string[];
}

export default function EmbeddingMonitoringDashboard() {
  const [metrics, setMetrics] = useState<EmbeddingMetrics | null>(null);
  const [usageReport, setUsageReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/monitoring/embeddings');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const fetchUsageReport = async () => {
    try {
      const response = await fetch('/api/monitoring/embeddings?detailed=true');
      if (!response.ok) throw new Error('Failed to fetch usage report');
      const data = await response.json();
      setUsageReport(data);
    } catch (err) {
      logger.error('Error fetching usage report:', err);
    }
  };

  const resetMetrics = async () => {
    try {
      const response = await fetch('/api/monitoring/embeddings/metrics', {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to reset metrics');
      await fetchMetrics();
      await fetchUsageReport();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset metrics');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchMetrics();
      await fetchUsageReport();
      setLoading(false);
    };

    loadData();

    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchMetrics();
        fetchUsageReport();
      }, 30000); // Refresh every 30 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const formatCurrency = (value: number) => `$${value.toFixed(6)}`;
  const formatNumber = (value: number) => value.toLocaleString();
  const formatLatency = (value: number) => `${value.toFixed(0)}ms`;

  const getErrorRate = () => {
    if (!metrics?.metrics) return 0;
    const { requestCount, errorCount } = metrics.metrics;
    return requestCount > 0 ? (errorCount / requestCount) * 100 : 0;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading embedding metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertTriangle size={20} />
              <span>Error loading metrics: {error}</span>
            </div>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Azure Embedding Service Monitoring</h1>
          <p className="text-gray-600 mt-1">Real-time metrics and usage analytics</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${getStatusColor(metrics?.status || 'unknown')}`}></div>
            <span className="text-sm font-medium">{metrics?.service || 'Unknown'}</span>
          </div>
          <Badge variant="outline">
            Last Updated: {metrics?.timestamp ? new Date(metrics.timestamp).toLocaleTimeString() : 'Unknown'}
          </Badge>
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            Auto Refresh: {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button variant="outline" size="sm" onClick={resetMetrics}>
            Reset Metrics
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics?.metrics.requestCount || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Errors: {metrics?.metrics.errorCount || 0} ({getErrorRate().toFixed(1)}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics?.metrics.totalTokens || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Cost: {formatCurrency(metrics?.metrics.totalCost || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics?.metrics.totalCost || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Since: {metrics?.metrics.lastReset ? new Date(metrics.metrics.lastReset).toLocaleDateString() : 'Unknown'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLatency(metrics?.metrics.avgLatency || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.metrics.avgLatency && metrics.metrics.avgLatency > 2000 ? 
                <span className="text-red-600">High latency detected</span> : 
                <span className="text-green-600">Performance normal</span>
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="recent" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recent">Recent Calls</TabsTrigger>
          <TabsTrigger value="hourly">Hourly Breakdown</TabsTrigger>
          <TabsTrigger value="errors">Error Analysis</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent API Calls</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metrics?.recentCalls?.slice(0, 10).map((call, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <Badge variant={call.success ? "default" : "destructive"}>
                        {call.success ? "Success" : "Error"}
                      </Badge>
                      <span className="text-sm text-gray-600">
                        {new Date(call.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <span>{formatLatency(call.duration)}</span>
                      <span>{formatNumber(call.tokens)} tokens</span>
                      <span>{formatCurrency(call.cost)}</span>
                      {call.errorType && <Badge variant="outline">{call.errorType}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hourly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Hourly Usage Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {usageReport?.hourlyBreakdown?.map((hour, index) => (
                  <div key={index} className="grid grid-cols-6 gap-4 p-3 border rounded-lg text-sm">
                    <div className="font-medium">
                      {new Date(hour.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div>{hour.requests} requests</div>
                    <div>{formatNumber(hour.tokens)} tokens</div>
                    <div>{formatCurrency(hour.cost)}</div>
                    <div>{hour.errors} errors</div>
                    <div>{formatLatency(hour.avgLatency)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Error Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {usageReport?.errorBreakdown && Object.entries(usageReport.errorBreakdown).map(([errorType, count]) => (
                  <div key={errorType} className="flex items-center justify-between p-3 border rounded-lg">
                    <Badge variant="destructive">{errorType}</Badge>
                    <span className="font-semibold">{count} occurrences</span>
                  </div>
                ))}
                {(!usageReport?.errorBreakdown || Object.keys(usageReport.errorBreakdown).length === 0) && (
                  <p className="text-green-600 text-center py-4">No errors in the last 24 hours! 🎉</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>Performance Recommendations</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {usageReport?.recommendations?.map((recommendation, index) => (
                  <div key={index} className="p-3 border rounded-lg">
                    <p className="text-sm">{recommendation}</p>
                  </div>
                ))}
                {(!usageReport?.recommendations || usageReport.recommendations.length === 0) && (
                  <p className="text-green-600 text-center py-4">
                    All systems performing optimally! No recommendations at this time.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 pt-4">
        <p>Metrics are automatically sent to Datadog for comprehensive monitoring and alerting.</p>
        <p>Dashboard refreshes every 30 seconds when auto-refresh is enabled.</p>
      </div>
    </div>
  );
}