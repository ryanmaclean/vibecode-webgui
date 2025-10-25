/**
 * Connection Pool Monitoring Dashboard Component
 * Real-time visualization of database connection pool health and metrics
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Database, Activity, TrendingUp, Clock, Users } from 'lucide-react'

interface PoolMetrics {
  pool_name: string
  total_connections: number
  active_connections: number
  idle_connections: number
  waiting_count: number
  max_connections: number
  min_connections: number
  utilization_percent: number
  average_wait_time_ms: number
  peak_connections: number
  connections_created: number
  connections_destroyed: number
  timestamp: string
  health_status: 'healthy' | 'warning' | 'critical'
}

interface Alert {
  id: string
  pool_name: string
  alert_type: string
  severity: 'warning' | 'critical'
  message: string
  threshold: number
  current_value: number
  timestamp: string
  resolved: boolean
}

interface Recommendation {
  type: string
  priority: 'high' | 'medium' | 'low'
  pool_name?: string
  message: string
  action: string
}

interface DashboardData {
  overview: {
    total_pools: number
    system_utilization_percent: number
    total_connections: number
    total_max_connections: number
    healthy_pools: number
    warning_pools: number
    critical_pools: number
    active_alerts: number
    critical_alerts: number
    warning_alerts: number
    timestamp: string
  }
  pools: (PoolMetrics & { alerts: Alert[] })[]
  alerts: {
    active: Alert[]
    critical: Alert[]
    warning: Alert[]
  }
  capacity_planning: Array<{
    pool_name: string
    current_utilization: number
    peak_utilization_24h: number
    average_utilization_24h: number
    recommended_max_connections: number
    growth_trend: 'increasing' | 'stable' | 'decreasing'
    capacity_headroom: number
    projected_exhaustion_time?: string
  }>
  recommendations: Recommendation[]
  timestamp: string
}

export default function ConnectionPoolDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/monitoring/connection-pool/dashboard?history=true')
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const dashboardData = await response.json()
      setData(dashboardData)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  // Auto-refresh effect
  useEffect(() => {
    fetchDashboardData()

    if (autoRefresh) {
      const interval = setInterval(fetchDashboardData, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
    // No cleanup needed if autoRefresh is false
    return undefined
  }, [autoRefresh])

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500'
      case 'warning': return 'bg-yellow-500'
      case 'critical': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 85) return 'text-red-600'
    if (utilization >= 70) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-500 bg-red-50'
      case 'medium': return 'border-yellow-500 bg-yellow-50'
      case 'low': return 'border-blue-500 bg-blue-50'
      default: return 'border-gray-500 bg-gray-50'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading connection pool dashboard...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">Error loading dashboard: {error}</span>
        </div>
        <button
          onClick={fetchDashboardData}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No connection pool data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Connection Pool Monitor</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="mr-2"
            />
            Auto-refresh (30s)
          </label>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh Now
          </button>
        </div>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Pools</p>
                <p className="text-2xl font-bold">{data.overview.total_pools}</p>
              </div>
              <Database className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">System Utilization</p>
                <p className={`text-2xl font-bold ${getUtilizationColor(data.overview.system_utilization_percent)}`}>
                  {data.overview.system_utilization_percent}%
                </p>
              </div>
              <Activity className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Connections</p>
                <p className="text-2xl font-bold">{data.overview.total_connections}</p>
                <p className="text-xs text-gray-500">of {data.overview.total_max_connections} max</p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Alerts</p>
                <p className={`text-2xl font-bold ${data.overview.active_alerts > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {data.overview.active_alerts}
                </p>
                <p className="text-xs text-gray-500">
                  {data.overview.critical_alerts} critical, {data.overview.warning_alerts} warning
                </p>
              </div>
              <AlertCircle className={`h-8 w-8 ${data.overview.active_alerts > 0 ? 'text-red-500' : 'text-gray-400'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      {data.alerts.active.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-red-500" />
              Active Alerts ({data.alerts.active.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.alerts.active.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border-l-4 ${alert.severity === 'critical' ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50'}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                          {alert.severity.toUpperCase()}
                        </Badge>
                        <span className="font-medium">{alert.pool_name}</span>
                      </div>
                      <p className="text-sm mt-1">{alert.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Threshold: {alert.threshold} | Current: {alert.current_value}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pool Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {data.pools.map((pool) => (
          <Card key={pool.pool_name}>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-2 ${getHealthStatusColor(pool.health_status)}`} />
                  {pool.pool_name}
                </CardTitle>
                <Badge variant={pool.health_status === 'healthy' ? 'secondary' : 'destructive'}>
                  {pool.health_status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Connection Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Active/Total</p>
                  <p className="font-semibold">
                    {pool.active_connections}/{pool.total_connections}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Utilization</p>
                  <p className={`font-semibold ${getUtilizationColor(pool.utilization_percent)}`}>
                    {pool.utilization_percent}%
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    pool.utilization_percent >= 85 ? 'bg-red-500' : 
                    pool.utilization_percent >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(pool.utilization_percent, 100)}%` }}
                />
              </div>

              {/* Additional Metrics */}
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-gray-600">Idle</p>
                  <p className="font-medium">{pool.idle_connections}</p>
                </div>
                <div>
                  <p className="text-gray-600">Waiting</p>
                  <p className="font-medium">{pool.waiting_count}</p>
                </div>
                <div>
                  <p className="text-gray-600">Peak</p>
                  <p className="font-medium">{pool.peak_connections}</p>
                </div>
              </div>

              {/* Wait Time */}
              {pool.average_wait_time_ms > 0 && (
                <div className="flex items-center text-sm">
                  <Clock className="h-4 w-4 mr-1 text-gray-500" />
                  <span className="text-gray-600">Avg wait time:</span>
                  <span className={`ml-1 font-medium ${pool.average_wait_time_ms > 1000 ? 'text-red-600' : 'text-green-600'}`}>
                    {pool.average_wait_time_ms}ms
                  </span>
                </div>
              )}

              {/* Pool Alerts */}
              {pool.alerts.length > 0 && (
                <div className="mt-3 space-y-1">
                  {pool.alerts.map((alert) => (
                    <div key={alert.id} className="text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {alert.message}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-blue-500" />
              Recommendations ({data.recommendations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recommendations.map((rec, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${getPriorityColor(rec.priority)}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{rec.priority.toUpperCase()}</Badge>
                        <Badge variant="secondary">{rec.type}</Badge>
                        {rec.pool_name && <span className="text-sm font-medium">{rec.pool_name}</span>}
                      </div>
                      <p className="text-sm mb-1">{rec.message}</p>
                      <p className="text-xs text-gray-600">Action: {rec.action}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Updated */}
      <div className="text-center text-sm text-gray-500">
        Last updated: {new Date(data.timestamp).toLocaleString()}
      </div>
    </div>
  )
}