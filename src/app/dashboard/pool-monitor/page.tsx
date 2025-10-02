'use client';

import { useState, useEffect } from 'react';
import { AlertLevel } from '@/lib/db/connection-pool-monitor';
import { DashboardWidgetGridSkeleton, TableWidgetSkeleton, ListWidgetSkeleton } from '@/components/skeletons';

interface PoolStatus {
  size: number;
  available: number;
  inUse: number;
  maxSize: number;
  waitingClients: number;
  idleConnections: number;
}

interface Alert {
  id: string;
  poolName: string;
  timestamp: Date;
  type: string;
  level: AlertLevel;
  message: string;
  metrics: {
    utilization: number;
    waitingClients: number;
    activeConnections: number;
    maxConnections: number;
    errorRate?: number;
    avgAcquireTime?: number;
  };
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

interface Recommendation {
  id: string;
  poolName: string;
  timestamp: Date;
  type: string;
  message: string;
  currentValue: number;
  recommendedValue: number;
  confidence: number;
  implemented: boolean;
  implementedAt?: Date;
}

interface MonitoringData {
  timestamp: string;
  pools: {
    count: number;
    status: Record<string, PoolStatus>;
  };
  metrics: Record<string, any>;
  alerts: {
    count: number;
    critical: number;
    warning: number;
    info: number;
    items: Alert[];
  };
  recommendations: {
    count: number;
    items: Recommendation[];
  };
}

export default function PoolMonitorDashboard() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(10000); // 10 seconds
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/monitoring/pool?all_alerts=${showAllAlerts}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        
        // Convert date strings to Date objects
        if (result.alerts && result.alerts.items) {
          result.alerts.items = result.alerts.items.map((alert: any) => ({
            ...alert,
            timestamp: new Date(alert.timestamp),
            acknowledgedAt: alert.acknowledgedAt ? new Date(alert.acknowledgedAt) : undefined
          }));
        }
        
        if (result.recommendations && result.recommendations.items) {
          result.recommendations.items = result.recommendations.items.map((rec: any) => ({
            ...rec,
            timestamp: new Date(rec.timestamp),
            implementedAt: rec.implementedAt ? new Date(rec.implementedAt) : undefined
          }));
        }
        
        setData(result);
        setLastRefresh(new Date());
        setError(null);
      } catch (err) {
        console.error('Error fetching monitoring data:', err);
        setError(`Failed to fetch monitoring data: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    };
    
    // Fetch data immediately
    fetchData();
    
    // Set up refresh interval
    const intervalId = setInterval(fetchData, refreshInterval);
    
    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [showAllAlerts, refreshInterval]);

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/monitoring/pool?action=acknowledge&id=${alertId}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to acknowledge alert: ${response.status} ${response.statusText}`);
      }
      
      // Update the local state
      if (data) {
        setData({
          ...data,
          alerts: {
            ...data.alerts,
            items: data.alerts.items.map(alert => 
              alert.id === alertId 
                ? { ...alert, acknowledged: true, acknowledgedAt: new Date(), acknowledgedBy: 'dashboard-user' }
                : alert
            )
          }
        });
      }
    } catch (err) {
      console.error('Error acknowledging alert:', err);
      setError(`Failed to acknowledge alert: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const implementRecommendation = async (recommendationId: string) => {
    try {
      const response = await fetch(`/api/monitoring/pool?action=implement&id=${recommendationId}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to implement recommendation: ${response.status} ${response.statusText}`);
      }
      
      // Update the local state
      if (data) {
        setData({
          ...data,
          recommendations: {
            ...data.recommendations,
            items: data.recommendations.items.map(rec => 
              rec.id === recommendationId 
                ? { ...rec, implemented: true, implementedAt: new Date() }
                : rec
            )
          }
        });
      }
    } catch (err) {
      console.error('Error implementing recommendation:', err);
      setError(`Failed to implement recommendation: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-semibold text-gray-900">Connection Pool Monitor</h1>
            <div className="flex space-x-4 items-center">
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-9 w-20 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-9 w-32 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>

          {/* Summary Cards Skeleton */}
          <DashboardWidgetGridSkeleton count={4} />

          {/* Pool Status Skeleton */}
          <div className="mt-8">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Connection Pools</h2>
            <ListWidgetSkeleton items={3} />
          </div>

          {/* Alerts Skeleton */}
          <div className="mt-8">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Alerts</h2>
            <ListWidgetSkeleton items={4} />
          </div>

          {/* Recommendations Skeleton */}
          <div className="mt-8">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Recommendations</h2>
            <ListWidgetSkeleton items={2} />
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Connection Pool Monitor</h1>
          <div className="mt-4 p-4 rounded-md bg-white shadow">
            <div className="bg-red-50 border-l-4 border-red-500 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error loading monitoring data</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">Connection Pool Monitor</h1>
          <div className="flex space-x-4 items-center">
            <div className="text-sm text-gray-500">
              {lastRefresh && `Last updated: ${lastRefresh.toLocaleTimeString()}`}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Refresh
            </button>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="block w-auto pl-3 pr-10 py-1.5 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value={5000}>Refresh: 5s</option>
              <option value={10000}>Refresh: 10s</option>
              <option value={30000}>Refresh: 30s</option>
              <option value={60000}>Refresh: 1m</option>
              <option value={300000}>Refresh: 5m</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border-l-4 border-red-500 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {data && (
          <>
            {/* Summary Cards */}
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
                      <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="ml-5">
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Connection Pools
                      </dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900">
                        {data.pools.count}
                      </dd>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-red-500 rounded-md p-3">
                      <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="ml-5">
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Active Alerts
                      </dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900">
                        {data.alerts.count}
                      </dd>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 mr-2">
                      {data.alerts.critical} Critical
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 mr-2">
                      {data.alerts.warning} Warning
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {data.alerts.info} Info
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                      <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="ml-5">
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Recommendations
                      </dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900">
                        {data.recommendations.count}
                      </dd>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                      <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div className="ml-5">
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Average Utilization
                      </dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900">
                        {Object.values(data.pools.status).length > 0 
                          ? Math.round(
                              Object.values(data.pools.status).reduce(
                                (sum, status) => sum + ((status.inUse / (status.maxSize || 1)) * 100), 
                                0
                              ) / Object.values(data.pools.status).length
                            ) + '%'
                          : '0%'
                        }
                      </dd>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pool Status Section */}
            <div className="mt-8">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900">Connection Pools</h2>
              </div>
              <div className="mt-4 bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {Object.entries(data.pools.status).map(([poolName, status]) => {
                    const utilization = (status.inUse / (status.maxSize || 1)) * 100;
                    let utilizationColor = 'bg-green-500';
                    if (utilization > 85) {
                      utilizationColor = 'bg-red-500';
                    } else if (utilization > 70) {
                      utilizationColor = 'bg-yellow-500';
                    }

                    return (
                      <li key={poolName}>
                        <div className="px-4 py-4 sm:px-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <p className="text-md font-medium text-indigo-600 truncate">{poolName}</p>
                              {status.waitingClients > 0 && (
                                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                  {status.waitingClients} waiting
                                </span>
                              )}
                            </div>
                            <div className="ml-2 flex-shrink-0 flex">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {status.inUse} / {status.maxSize} connections
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 sm:flex sm:justify-between">
                            <div className="sm:flex">
                              <p className="flex items-center text-sm text-gray-500">
                                Available: {status.available}
                              </p>
                              <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                                Idle: {status.idleConnections}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2">
                            <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`absolute h-full ${utilizationColor} rounded-full`} 
                                style={{ width: `${utilization}%` }}
                              ></div>
                            </div>
                            <div className="mt-1 flex justify-between text-xs text-gray-500">
                              <span>Utilization: {Math.round(utilization)}%</span>
                              <span>{status.inUse} in use</span>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                  {Object.keys(data.pools.status).length === 0 && (
                    <li>
                      <div className="px-4 py-4 sm:px-6 text-center text-gray-500">
                        No connection pools found
                      </div>
                    </li>
                  )}
                </ul>
              </div>
            </div>

            {/* Alerts Section */}
            <div className="mt-8">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900">Alerts</h2>
                <div className="flex items-center">
                  <label htmlFor="showAllAlerts" className="mr-2 text-sm text-gray-500">
                    Show acknowledged
                  </label>
                  <div className="relative inline-block w-10 mr-2 align-middle select-none">
                    <input
                      type="checkbox"
                      id="showAllAlerts"
                      checked={showAllAlerts}
                      onChange={() => setShowAllAlerts(!showAllAlerts)}
                      className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                    />
                    <label
                      htmlFor="showAllAlerts"
                      className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${
                        showAllAlerts ? 'bg-indigo-500' : 'bg-gray-300'
                      }`}
                    ></label>
                  </div>
                </div>
              </div>
              <div className="mt-4 overflow-hidden sm:rounded-md">
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {data.alerts.items.map((alert) => {
                      let borderColor = 'border-blue-500';
                      let bgColor = 'bg-blue-50';
                      let textColor = 'text-blue-800';

                      if (alert.level === 'critical') {
                        borderColor = 'border-red-500';
                        bgColor = 'bg-red-50';
                        textColor = 'text-red-800';
                      } else if (alert.level === 'warning') {
                        borderColor = 'border-yellow-500';
                        bgColor = 'bg-yellow-50';
                        textColor = 'text-yellow-800';
                      }

                      return (
                        <li key={alert.id} className={`border-l-4 ${borderColor}`}>
                          <div className={`px-4 py-4 sm:px-6 ${alert.acknowledged ? 'opacity-50' : ''}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <p className={`text-md font-medium ${textColor} truncate`}>
                                  {alert.type.replace(/_/g, ' ')} - {alert.poolName}
                                </p>
                                <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor}`}>
                                  {alert.level}
                                </span>
                              </div>
                              <div className="ml-2 flex-shrink-0 flex">
                                {!alert.acknowledged ? (
                                  <button
                                    onClick={() => acknowledgeAlert(alert.id)}
                                    className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                  >
                                    Acknowledge
                                  </button>
                                ) : (
                                  <span className="text-xs text-gray-500">
                                    Acknowledged {alert.acknowledgedAt?.toLocaleTimeString()}
                                    {alert.acknowledgedBy ? ` by ${alert.acknowledgedBy}` : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="mt-2 text-sm text-gray-600">
                              <p>{alert.message}</p>
                            </div>
                            <div className="mt-2 sm:flex sm:justify-between">
                              <div className="sm:flex">
                                <p className="flex items-center text-xs text-gray-500">
                                  Utilization: {Math.round(alert.metrics.utilization)}%
                                </p>
                                <p className="mt-2 flex items-center text-xs text-gray-500 sm:mt-0 sm:ml-6">
                                  Connections: {alert.metrics.activeConnections} / {alert.metrics.maxConnections}
                                </p>
                                {alert.metrics.waitingClients > 0 && (
                                  <p className="mt-2 flex items-center text-xs text-gray-500 sm:mt-0 sm:ml-6">
                                    Waiting: {alert.metrics.waitingClients}
                                  </p>
                                )}
                              </div>
                              <p className="mt-2 flex items-center text-xs text-gray-500 sm:mt-0">
                                {new Date(alert.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                    {data.alerts.items.length === 0 && (
                      <li>
                        <div className="px-4 py-4 sm:px-6 text-center text-gray-500">
                          No alerts found
                        </div>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {/* Recommendations Section */}
            <div className="mt-8">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900">Recommendations</h2>
              </div>
              <div className="mt-4 overflow-hidden sm:rounded-md">
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {data.recommendations.items.map((recommendation) => (
                      <li key={recommendation.id} className="border-l-4 border-green-500">
                        <div className={`px-4 py-4 sm:px-6 ${recommendation.implemented ? 'opacity-50' : ''}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <p className="text-md font-medium text-green-600 truncate">
                                {recommendation.type.replace(/_/g, ' ')} - {recommendation.poolName}
                              </p>
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                {Math.round(recommendation.confidence * 100)}% confidence
                              </span>
                            </div>
                            <div className="ml-2 flex-shrink-0 flex">
                              {!recommendation.implemented ? (
                                <button
                                  onClick={() => implementRecommendation(recommendation.id)}
                                  className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                  Implement
                                </button>
                              ) : (
                                <span className="text-xs text-gray-500">
                                  Implemented {recommendation.implementedAt?.toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 text-sm text-gray-600">
                            <p>{recommendation.message}</p>
                          </div>
                          <div className="mt-2 sm:flex sm:justify-between">
                            <div className="sm:flex">
                              <p className="flex items-center text-xs text-gray-500">
                                Current: {recommendation.currentValue}
                              </p>
                              <p className="mt-2 flex items-center text-xs text-gray-500 sm:mt-0 sm:ml-6">
                                Recommended: {recommendation.recommendedValue}
                              </p>
                            </div>
                            <p className="mt-2 flex items-center text-xs text-gray-500 sm:mt-0">
                              {new Date(recommendation.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                    {data.recommendations.items.length === 0 && (
                      <li>
                        <div className="px-4 py-4 sm:px-6 text-center text-gray-500">
                          No recommendations found
                        </div>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .toggle-checkbox:checked {
          right: 0;
          border-color: #4f46e5;
        }
        .toggle-checkbox:checked + .toggle-label {
          background-color: #4f46e5;
        }
        .toggle-label {
          transition: background-color 0.2s ease;
        }
        .toggle-checkbox {
          right: 0;
          transition: all 0.2s ease;
          border-color: #d1d5db;
        }
      `}</style>
    </div>
  );
}