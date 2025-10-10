import React, { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface ConnectionPoolMetrics {
  size: number;
  inUse: number;
  maxSize: number;
  available: number;
}

interface QueryMetrics {
  totalQueries: number;
  totalQueriesPerSecond: number;
  avgQueryTime: number;
  p95QueryTime: number;
  p99QueryTime: number;
  errorRate: number;
  slowQueries: number;
  queriesByType: Record<string, any>;
  queriesByTable: Record<string, any>;
}

interface DatabaseMetricsResponse {
  status: 'ok' | 'error';
  message: string;
  latency: string;
  timestamp: string;
  database: {
    name: string;
    user: string;
    version: string;
    uptime: string;
  };
  pgvector: {
    installed: boolean;
    version: string | null;
  };
  poolStatus: ConnectionPoolMetrics;
  embeddings?: {
    total_embeddings: number;
    avg_content_size?: number;
    latest_embedding?: string;
    error?: string;
  };
  stats?: {
    active_connections: number;
    transactions_committed: number;
    transactions_rolled_back: number;
    rows_returned: number;
    rows_fetched: number;
    rows_inserted: number;
    rows_updated: number;
    rows_deleted: number;
  };
  metrics?: QueryMetrics;
}

interface DatabaseConnectionMetricsProps {
  refreshInterval?: number;
  showDetailedMetrics?: boolean;
}

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat().format(num);
};

const formatPercent = (num: number): string => {
  return (num * 100).toFixed(2) + '%';
};

// Memoized PoolMetric Card component
const PoolMetricCard = memo(({ metrics }: { metrics: ConnectionPoolMetrics }) => {
  const utilizationPercent = useMemo(
    () => ((metrics.inUse / metrics.maxSize) * 100).toFixed(0),
    [metrics.inUse, metrics.maxSize]
  );

  return (
    <div className="bg-blue-50 p-4 rounded-lg">
      <h3 className="text-sm font-medium text-blue-800 mb-2">Connection Pool</h3>
      <div className="flex justify-between">
        <div>
          <div className="text-2xl font-semibold text-blue-600">
            {metrics.inUse}/{metrics.size}
          </div>
          <div className="text-xs text-blue-500">In Use / Total</div>
        </div>
        <div>
          <div className="text-2xl font-semibold text-blue-600">
            {metrics.available}
          </div>
          <div className="text-xs text-blue-500">Available</div>
        </div>
      </div>
      <div className="mt-2 h-2 bg-blue-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded-full"
          style={{ width: `${utilizationPercent}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-blue-600 text-right">
        {utilizationPercent}% Used
      </div>
    </div>
  );
});
PoolMetricCard.displayName = 'PoolMetricCard';

// Memoized QueryPerformance Card component
const QueryPerformanceCard = memo(({ metrics }: { metrics: QueryMetrics }) => (
  <div className="bg-indigo-50 p-4 rounded-lg">
    <h3 className="text-sm font-medium text-indigo-800 mb-2">Query Performance</h3>
    <div className="text-2xl font-semibold text-indigo-600">
      {metrics.avgQueryTime.toFixed(2)}ms
    </div>
    <div className="text-xs text-indigo-500">Average Query Time</div>
    <div className="mt-2 text-sm">
      <div className="flex justify-between">
        <span className="text-indigo-600">p95:</span>
        <span className="font-medium">{metrics.p95QueryTime.toFixed(2)}ms</span>
      </div>
      <div className="flex justify-between">
        <span className="text-indigo-600">p99:</span>
        <span className="font-medium">{metrics.p99QueryTime.toFixed(2)}ms</span>
      </div>
    </div>
  </div>
));
QueryPerformanceCard.displayName = 'QueryPerformanceCard';

// Memoized QueryVolume Card component
const QueryVolumeCard = memo(({ metrics }: { metrics: QueryMetrics }) => (
  <div className="bg-purple-50 p-4 rounded-lg">
    <h3 className="text-sm font-medium text-purple-800 mb-2">Query Volume</h3>
    <div className="text-2xl font-semibold text-purple-600">
      {metrics.totalQueriesPerSecond.toFixed(2)}
    </div>
    <div className="text-xs text-purple-500">Queries Per Second</div>
    <div className="mt-2 text-sm">
      <div className="flex justify-between">
        <span className="text-purple-600">Total:</span>
        <span className="font-medium">{formatNumber(metrics.totalQueries)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-purple-600">Slow Queries:</span>
        <span className="font-medium">{metrics.slowQueries}</span>
      </div>
    </div>
  </div>
));
QueryVolumeCard.displayName = 'QueryVolumeCard';

// Memoized ErrorRate Card component
const ErrorRateCard = memo(({ metrics }: { metrics: QueryMetrics }) => (
  <div className="bg-red-50 p-4 rounded-lg">
    <h3 className="text-sm font-medium text-red-800 mb-2">Error Rate</h3>
    <div className="text-2xl font-semibold text-red-600">
      {formatPercent(metrics.errorRate)}
    </div>
    <div className="text-xs text-red-500">Query Error Rate</div>
    <div className="mt-2 h-2 bg-red-200 rounded-full overflow-hidden">
      <div
        className="h-full bg-red-600 rounded-full"
        style={{ width: `${metrics.errorRate * 100}%` }}
      />
    </div>
    <div className="mt-1 text-xs text-red-600 text-right">
      Target: &lt;0.1%
    </div>
  </div>
));
ErrorRateCard.displayName = 'ErrorRateCard';

const DatabaseConnectionMetrics: React.FC<DatabaseConnectionMetricsProps> = memo(({
  refreshInterval = 10000,
  showDetailedMetrics = false
}) => {
  const [metrics, setMetrics] = useState<DatabaseMetricsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [historicalPoolData, setHistoricalPoolData] = useState<Array<{
    time: string;
    inUse: number;
    available: number;
    size: number;
  }>>([]);
  const [historicalQueryData, setHistoricalQueryData] = useState<Array<{
    time: string;
    qps: number;
    avgTime: number;
    p95Time: number;
  }>>([]);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/health/database/metrics?verbose=true&metrics=true');

      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.status} ${response.statusText}`);
      }

      const data: DatabaseMetricsResponse = await response.json();
      setMetrics(data);

      // Update historical pool data
      setHistoricalPoolData(prev => {
        const newData = [...prev, {
          time: new Date().toLocaleTimeString(),
          inUse: data.poolStatus.inUse,
          available: data.poolStatus.available,
          size: data.poolStatus.size
        }];

        // Keep only the last 20 data points
        if (newData.length > 20) {
          return newData.slice(newData.length - 20);
        }
        return newData;
      });

      // Update historical query data if metrics are available
      if (data.metrics) {
        setHistoricalQueryData(prev => {
          const newData = [...prev, {
            time: new Date().toLocaleTimeString(),
            qps: data.metrics?.totalQueriesPerSecond || 0,
            avgTime: data.metrics?.avgQueryTime || 0,
            p95Time: data.metrics?.p95QueryTime || 0
          }];

          // Keep only the last 20 data points
          if (newData.length > 20) {
            return newData.slice(newData.length - 20);
          }
          return newData;
        });
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch metrics immediately
    fetchMetrics();

    // Set up interval for refreshing
    const intervalId = setInterval(fetchMetrics, refreshInterval);

    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [fetchMetrics, refreshInterval]);

  // Prepare query metrics by type data
  const queryTypeData = useMemo(() => {
    if (!metrics?.metrics) return [];
    return Object.entries(metrics.metrics.queriesByType).map(([type, data]) => ({
      name: type,
      count: data.count,
      avgTime: data.avgTime.toFixed(2)
    }));
  }, [metrics?.metrics]);

  if (loading && !metrics) {
    return <div className="flex justify-center items-center h-40">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
    </div>;
  }

  if (error) {
    return <div className="p-4 border-l-4 border-red-500 bg-red-50 rounded-md shadow-sm">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">Failed to fetch database metrics</h3>
          <div className="mt-2 text-sm text-red-700">
            <p>{error}</p>
          </div>
        </div>
      </div>
    </div>;
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="bg-white shadow-md rounded-lg p-6 space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-xl font-semibold text-gray-800">Database Connection Metrics</h2>
        <div className="flex justify-between items-center mt-2">
          <div className="text-sm text-gray-500">
            Last updated: {new Date(metrics.timestamp).toLocaleString()}
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            metrics.status === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {metrics.status.toUpperCase()} - {metrics.latency}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <PoolMetricCard metrics={metrics.poolStatus} />

        {metrics.metrics && (
          <>
            <QueryPerformanceCard metrics={metrics.metrics} />
            <QueryVolumeCard metrics={metrics.metrics} />
            <ErrorRateCard metrics={metrics.metrics} />
          </>
        )}
      </div>

      {/* Historical Connection Pool Chart */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-800 mb-4">Connection Pool Usage Over Time</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={historicalPoolData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="inUse" stackId="1" stroke="#3B82F6" fill="#93C5FD" name="In Use" />
              <Area type="monotone" dataKey="available" stackId="1" stroke="#6366F1" fill="#A5B4FC" name="Available" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Historical Query Performance Chart */}
      {metrics.metrics && (
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Query Performance Over Time</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={historicalQueryData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                <Tooltip />
                <Legend />
                <Area yAxisId="right" type="monotone" dataKey="qps" stroke="#82ca9d" fill="#d1e7dd" name="Queries/sec" />
                <Area yAxisId="left" type="monotone" dataKey="avgTime" stroke="#8884d8" fill="#c4b5fd" name="Avg Time (ms)" />
                <Area yAxisId="left" type="monotone" dataKey="p95Time" stroke="#6366F1" fill="#a5b4fc" name="p95 Time (ms)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Query Type Breakdown */}
      {metrics.metrics && queryTypeData.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Query Type Breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={queryTypeData}
                margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" />
                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="count" fill="#8884d8" name="Query Count" />
                <Bar yAxisId="right" dataKey="avgTime" fill="#82ca9d" name="Avg Time (ms)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* pgvector Info */}
      {metrics.pgvector && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-md font-medium text-gray-800 mb-2">pgvector Extension</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-gray-600">Status:</span>
              <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                metrics.pgvector.installed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {metrics.pgvector.installed ? 'Installed' : 'Not Installed'}
              </span>
            </div>
            {metrics.pgvector.installed && (
              <div>
                <span className="text-gray-600">Version:</span>
                <span className="ml-2 font-medium">{metrics.pgvector.version || 'Unknown'}</span>
              </div>
            )}
          </div>

          {metrics.embeddings && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Embeddings</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-gray-600">Total:</span>
                  <span className="ml-2 font-medium">{formatNumber(metrics.embeddings.total_embeddings)}</span>
                </div>
                {metrics.embeddings.avg_content_size && (
                  <div>
                    <span className="text-gray-600">Avg Size:</span>
                    <span className="ml-2 font-medium">{formatNumber(Math.round(metrics.embeddings.avg_content_size))} bytes</span>
                  </div>
                )}
                {metrics.embeddings.latest_embedding && (
                  <div>
                    <span className="text-gray-600">Latest:</span>
                    <span className="ml-2 font-medium">{new Date(metrics.embeddings.latest_embedding).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Database Details */}
      {showDetailedMetrics && metrics.database && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-md font-medium text-gray-800 mb-2">Database Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-gray-600">Name:</span>
              <span className="ml-2 font-medium">{metrics.database.name}</span>
            </div>
            <div>
              <span className="text-gray-600">User:</span>
              <span className="ml-2 font-medium">{metrics.database.user}</span>
            </div>
            <div>
              <span className="text-gray-600">Version:</span>
              <span className="ml-2 font-medium">{metrics.database.version?.split(',')[0]}</span>
            </div>
            <div>
              <span className="text-gray-600">Uptime:</span>
              <span className="ml-2 font-medium">{new Date(metrics.database.uptime).toLocaleString()}</span>
            </div>
          </div>

          {/* Database Stats */}
          {metrics.stats && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Database Statistics</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="text-gray-600">Active Connections:</span>
                  <span className="ml-2 font-medium">{metrics.stats.active_connections}</span>
                </div>
                <div>
                  <span className="text-gray-600">Commits:</span>
                  <span className="ml-2 font-medium">{formatNumber(metrics.stats.transactions_committed)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Rollbacks:</span>
                  <span className="ml-2 font-medium">{formatNumber(metrics.stats.transactions_rolled_back)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Rows Returned:</span>
                  <span className="ml-2 font-medium">{formatNumber(metrics.stats.rows_returned)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Rows Fetched:</span>
                  <span className="ml-2 font-medium">{formatNumber(metrics.stats.rows_fetched)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Rows Inserted:</span>
                  <span className="ml-2 font-medium">{formatNumber(metrics.stats.rows_inserted)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Rows Updated:</span>
                  <span className="ml-2 font-medium">{formatNumber(metrics.stats.rows_updated)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Rows Deleted:</span>
                  <span className="ml-2 font-medium">{formatNumber(metrics.stats.rows_deleted)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
DatabaseConnectionMetrics.displayName = 'DatabaseConnectionMetrics';

export { DatabaseConnectionMetrics };
export default DatabaseConnectionMetrics;
