'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Database,
  Activity,
  TriangleAlert,
  CheckCircle,
  XCircle,
  Server,
  Zap
} from 'lucide-react';
// import { logger } from '@/lib/logger';
interface PoolStatus {
  pools: Array<{
    key: string;
    activeConnections: number;
    totalConnections: number;
    pendingConnections: number;
    availableConnections: number;
    lastUsed: string;
    statistics: {
      totalQueries: number;
      averageQueryTime: number;
      errors: number;
    };
  }>;
  totalPools: number;
  healthStatus: 'healthy' | 'warning' | 'critical';
}

interface PoolAlert {
  poolKey: string;
  severity: 'warning' | 'critical';
  message: string;
  activeConnections: number;
  totalConnections: number;
  utilizationPercent: number;
  availableConnections: number;
  timestamp: string;
}

interface DatabaseHealth {
  status: 'ok' | 'error';
  message: string;
  latency: number;
  timestamp: string;
  details: {
    db_name: string;
    user_name: string;
    version: string;
    start_time: string;
  };
  poolStatus: PoolStatus;
  pgvectorStatus: {
    installed: boolean;
    version: string | null;
  };
  embeddingsStats: {
    total_embeddings: number;
    avg_content_size?: number;
    latest_embedding?: string;
    error?: string;
  };
  dbStats: {
    active_connections: number;
    transactions_committed: number;
    transactions_rolled_back: number;
    blocks_read: number;
    blocks_hit: number;
    rows_returned: number;
    rows_fetched: number;
    rows_inserted: number;
    rows_updated: number;
    rows_deleted: number;
  };
  metrics?: {
    totalQueries: number;
    totalQueriesPerSecond: number;
    avgQueryTime: number;
    p95QueryTime: number;
    p99QueryTime: number;
    errorRate: number;
    slowQueries: number;
    queriesByType: Record<string, number>;
    queriesByTable: Record<string, number>;
  };
}

export default function DatabaseHealthDashboard(): React.JSX.Element {
  const t = useTranslations('monitoring')
  const [health, setHealth] = useState<DatabaseHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [poolAlerts, setPoolAlerts] = useState<PoolAlert[]>([]);
  const [_alertsLoading, setAlertsLoading] = useState(false);

  const fetchHealth = async (): Promise<void> => {
    try {
      const response = await fetch('/api/health/db?verbose=true&metrics=true');
      if (!response.ok) throw new Error('Failed to fetch database health');
      const data = await response.json();
      setHealth(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const fetchPoolAlerts = async (): Promise<void> => {
    try {
      setAlertsLoading(true);
      const response = await fetch('/api/monitoring/pool-alerts');
      if (!response.ok) {
        if (response.status === 401) {
          console.warn('Not authenticated for pool alerts');
          return;
        }
        throw new Error('Failed to fetch pool alerts');
      }
      const data = await response.json();
      setPoolAlerts(data.alerts || []);
    } catch (err) {
      console.error('Error fetching pool alerts:', err);
      // Don't set error state for alerts, just log it
    } finally {
      setAlertsLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async (): Promise<void> => {
      setLoading(true);
      await Promise.all([fetchHealth(), fetchPoolAlerts()]);
      setLoading(false);
    };

    loadData();

    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchHealth();
        fetchPoolAlerts();
      }, 10000); // Refresh every 10 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const formatNumber = (value: number | undefined): string => {
    if (value === undefined) return 'N/A';
    return value.toLocaleString();
  };

  const formatLatency = (value: number): string => `${value.toFixed(0)}ms`;
  const formatBytes = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const _getHealthColor = (status: string): string => {
    switch (status) {
      case 'ok':
      case 'healthy':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'error':
      case 'critical':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getHealthIcon = (status: string): React.JSX.Element => {
    switch (status) {
      case 'ok':
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <TriangleAlert className="h-5 w-5 text-yellow-500" />;
      case 'error':
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Database className="h-5 w-5 text-gray-500" />;
    }
  };

  const getCacheHitRate = (): number => {
    if (!health?.dbStats) return 0;
    const { blocks_read, blocks_hit } = health.dbStats;
    const total = blocks_read + blocks_hit;
    return total > 0 ? (blocks_hit / total) * 100 : 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>{t('database.loadingMetrics')}</p>
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
              <TriangleAlert size={20} />
              <span>{t('database.errorLoading')}: {error}</span>
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
          <h1 className="text-3xl font-bold">{t('database.title')}</h1>
          <p className="text-gray-600 mt-1">{t('database.subtitle')}</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            {getHealthIcon(health?.status || 'unknown')}
            <span className="text-sm font-medium">{health?.details.db_name || 'Unknown'}</span>
          </div>
          <Badge variant="outline">
            {t('database.lastUpdated')}: {health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : t('database.unknown')}
          </Badge>
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {t('database.autoRefresh')}: {autoRefresh ? t('database.on') : t('database.off')}
          </Button>
        </div>
      </div>

      {/* Pool Alerts Section */}
      {poolAlerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-red-600 flex items-center">
            <TriangleAlert className="h-5 w-5 mr-2" />
            {t('database.activePoolAlerts', { count: poolAlerts.length })}
          </h2>
          <div className="grid gap-4">
            {poolAlerts.map((alert, index) => (
              <Card 
                key={index} 
                className={`border-l-4 ${alert.severity === 'critical' ? 'border-l-red-500 bg-red-50' : 'border-l-yellow-500 bg-yellow-50'}`}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {alert.severity === 'critical' ? (
                          <XCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <TriangleAlert className="h-5 w-5 text-yellow-500" />
                        )}
                        <Badge 
                          variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}
                          className="uppercase text-xs font-semibold"
                        >
                          {alert.severity}
                        </Badge>
                        <span className="text-sm font-medium">{alert.poolKey}</span>
                      </div>
                      <p className="text-sm text-gray-700 mb-3">{alert.message}</p>
                      <div className="grid grid-cols-4 gap-4 text-xs">
                        <div>
                          <div className="text-gray-500">{t('database.utilization')}</div>
                          <div className="font-semibold text-lg">{alert.utilizationPercent}%</div>
                        </div>
                        <div>
                          <div className="text-gray-500">{t('database.active')}</div>
                          <div className="font-semibold">{alert.activeConnections}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">{t('database.available')}</div>
                          <div className="font-semibold">{alert.availableConnections}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">{t('database.total')}</div>
                          <div className="font-semibold">{alert.totalConnections}</div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500 ml-4">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('database.connectionStatus')}</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{health?.status || 'Unknown'}</div>
            <p className="text-xs text-muted-foreground">
              {t('database.latency')}: {health?.latency ? formatLatency(health.latency) : 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('database.activeConnections')}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(health?.dbStats.active_connections)}</div>
            <p className="text-xs text-muted-foreground">
              {t('database.poolStatus')}: {health?.poolStatus.healthStatus || t('database.unknown')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('database.cacheHitRate')}</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getCacheHitRate().toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {getCacheHitRate() > 90 ? (
                <span className="text-green-600">{t('database.excellent')}</span>
              ) : getCacheHitRate() > 70 ? (
                <span className="text-yellow-600">{t('database.good')}</span>
              ) : (
                <span className="text-red-600">{t('database.needsAttention')}</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('database.vectorEmbeddings')}</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(health?.embeddingsStats.total_embeddings)}</div>
            <p className="text-xs text-muted-foreground">
              pgvector: {health?.pgvectorStatus.installed ?
                `v${health.pgvectorStatus.version}` : t('database.notInstalled')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="connections" className="space-y-4">
        <TabsList>
          <TabsTrigger value="connections">{t('database.tabConnectionPools')}</TabsTrigger>
          <TabsTrigger value="performance">{t('database.tabPerformance')}</TabsTrigger>
          <TabsTrigger value="system">{t('database.tabSystemInfo')}</TabsTrigger>
          <TabsTrigger value="embeddings">{t('database.tabVectorData')}</TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('database.connectionPoolStatus')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {health?.poolStatus.pools?.map((pool, index) => {
                  const utilizationPercent = (pool.activeConnections / pool.totalConnections) * 100;
                  const getBadgeVariant = (): "destructive" | "secondary" | "default" => {
                    if (utilizationPercent >= 90) return "destructive";
                    if (utilizationPercent >= 80) return "secondary";
                    return "default";
                  };
                  const getAlertIcon = (): React.JSX.Element | null => {
                    if (utilizationPercent >= 90) return <TriangleAlert className="h-4 w-4 text-red-500 ml-1" />;
                    if (utilizationPercent >= 80) return <TriangleAlert className="h-4 w-4 text-yellow-500 ml-1" />;
                    return null;
                  };
                  
                  return (
                    <div key={index} className={`border rounded-lg p-4 ${utilizationPercent >= 90 ? 'border-red-200 bg-red-50' : utilizationPercent >= 80 ? 'border-yellow-200 bg-yellow-50' : ''}`}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold flex items-center">
                          {pool.key}
                          {getAlertIcon()}
                        </h3>
                        <div className="flex items-center space-x-2">
                          <Badge variant={getBadgeVariant()}>
                            {pool.activeConnections}/{pool.totalConnections}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {utilizationPercent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">{t('database.active')}</div>
                        <div className="font-medium">{pool.activeConnections}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">{t('database.available')}</div>
                        <div className="font-medium">{pool.availableConnections}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">{t('database.pending')}</div>
                        <div className="font-medium">{pool.pendingConnections}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">{t('database.totalQueries')}</div>
                        <div className="font-medium">{formatNumber(pool.statistics.totalQueries)}</div>
                      </div>
                    </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {t('database.lastUsed')}: {new Date(pool.lastUsed).toLocaleTimeString()}
                      </div>
                    </div>
                  );
                })}
                {(!health?.poolStatus.pools || health.poolStatus.pools.length === 0) && (
                  <p className="text-center text-muted-foreground py-4">{t('database.noConnectionPools')}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('database.queryPerformance')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t('database.totalQueries')}</span>
                    <span className="font-medium">{formatNumber(health?.metrics?.totalQueries)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t('database.queriesPerSecond')}</span>
                    <span className="font-medium">{health?.metrics?.totalQueriesPerSecond?.toFixed(2) || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t('database.avgQueryTime')}</span>
                    <span className="font-medium">{health?.metrics?.avgQueryTime ? formatLatency(health.metrics.avgQueryTime) : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t('database.p95QueryTime')}</span>
                    <span className="font-medium">{health?.metrics?.p95QueryTime ? formatLatency(health.metrics.p95QueryTime) : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t('database.errorRate')}</span>
                    <span className="font-medium">{health?.metrics?.errorRate ? `${(health.metrics.errorRate * 100).toFixed(2)}%` : 'N/A'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('database.databaseStatistics')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t('database.committedTransactions')}</span>
                    <span className="font-medium">{formatNumber(health?.dbStats.transactions_committed)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t('database.rolledBackTransactions')}</span>
                    <span className="font-medium">{formatNumber(health?.dbStats.transactions_rolled_back)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t('database.rowsReturned')}</span>
                    <span className="font-medium">{formatNumber(health?.dbStats.rows_returned)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t('database.rowsInserted')}</span>
                    <span className="font-medium">{formatNumber(health?.dbStats.rows_inserted)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t('database.rowsUpdated')}</span>
                    <span className="font-medium">{formatNumber(health?.dbStats.rows_updated)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('database.systemInformation')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-muted-foreground">{t('database.databaseName')}</div>
                    <div className="font-medium">{health?.details.db_name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">{t('database.user')}</div>
                    <div className="font-medium">{health?.details.user_name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">{t('database.serverStartTime')}</div>
                    <div className="font-medium">
                      {health?.details.start_time ?
                        new Date(health.details.start_time).toLocaleString() : 'N/A'}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">{t('database.version')}</div>
                  <div className="font-medium text-xs">{health?.details.version}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="embeddings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('database.vectorEmbeddingsStatus')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  {health?.pgvectorStatus.installed ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span className="font-medium">
                    pgvector Extension: {health?.pgvectorStatus.installed ? t('database.installed') : t('database.notInstalled')}
                  </span>
                  {health?.pgvectorStatus.version && (
                    <Badge variant="outline">v{health.pgvectorStatus.version}</Badge>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">{t('database.totalEmbeddings')}</div>
                    <div className="text-2xl font-bold">
                      {formatNumber(health?.embeddingsStats.total_embeddings)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">{t('database.avgContentSize')}</div>
                    <div className="text-2xl font-bold">
                      {health?.embeddingsStats.avg_content_size ?
                        formatBytes(health.embeddingsStats.avg_content_size) : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">{t('database.latestEmbedding')}</div>
                    <div className="text-sm font-medium">
                      {health?.embeddingsStats.latest_embedding ?
                        new Date(health.embeddingsStats.latest_embedding).toLocaleString() : 'N/A'}
                    </div>
                  </div>
                </div>

                {health?.embeddingsStats.error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <TriangleAlert className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium text-red-800">{t('database.embeddingsError')}</span>
                    </div>
                    <p className="text-sm text-red-700 mt-1">{health.embeddingsStats.error}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 pt-4">
        <p>{t('database.footerRefreshNote')}</p>
        <p>{t('database.footerPoolNote')}</p>
      </div>
    </div>
  );
}