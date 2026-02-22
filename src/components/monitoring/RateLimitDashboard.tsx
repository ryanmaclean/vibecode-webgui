/**
 * Rate Limit Monitoring Dashboard Component
 * Real-time visualization of API rate limiting health and metrics
 */

'use client'

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Shield, Activity, TrendingUp, Clock, Zap } from 'lucide-react'

interface RateLimitMetrics {
  endpoint: string
  current_requests: number
  limit: number
  window_seconds: number
  utilization_percent: number
  requests_blocked: number
  requests_allowed: number
  average_response_time_ms: number
  peak_requests: number
  reset_time: string
  timestamp: string
  health_status: 'healthy' | 'warning' | 'critical'
}

interface Alert {
  id: string
  endpoint: string
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
  endpoint?: string
  message: string
  action: string
}

interface DashboardData {
  overview: {
    total_endpoints: number
    system_utilization_percent: number
    total_requests: number
    total_blocked: number
    healthy_endpoints: number
    warning_endpoints: number
    critical_endpoints: number
    active_alerts: number
    critical_alerts: number
    warning_alerts: number
    timestamp: string
  }
  endpoints: (RateLimitMetrics & { alerts: Alert[] })[]
  alerts: {
    active: Alert[]
    critical: Alert[]
    warning: Alert[]
  }
  capacity_planning: Array<{
    endpoint: string
    current_utilization: number
    peak_utilization_24h: number
    average_utilization_24h: number
    recommended_limit: number
    growth_trend: 'increasing' | 'stable' | 'decreasing'
    capacity_headroom: number
    projected_exhaustion_time?: string
  }>
  recommendations: Recommendation[]
  timestamp: string
}

// Memoized helper functions to avoid recreating on each render
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

// Memoized Endpoint Card component to prevent unnecessary re-renders
const EndpointCard = memo(function EndpointCard({ endpoint }: { endpoint: RateLimitMetrics & { alerts: Alert[] } }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${getHealthStatusColor(endpoint.health_status)}`} />
            {endpoint.endpoint}
          </CardTitle>
          <Badge variant={endpoint.health_status === 'healthy' ? 'secondary' : 'destructive'}>
            {endpoint.health_status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rate Limit Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Current/Limit</p>
            <p className="font-semibold">
              {endpoint.current_requests}/{endpoint.limit}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Utilization</p>
            <p className={`font-semibold ${getUtilizationColor(endpoint.utilization_percent)}`}>
              {endpoint.utilization_percent}%
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              endpoint.utilization_percent >= 85 ? 'bg-red-500' :
              endpoint.utilization_percent >= 70 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(endpoint.utilization_percent, 100)}%` }}
          />
        </div>

        {/* Additional Metrics */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-gray-600">Allowed</p>
            <p className="font-medium">{endpoint.requests_allowed}</p>
          </div>
          <div>
            <p className="text-gray-600">Blocked</p>
            <p className="font-medium text-red-600">{endpoint.requests_blocked}</p>
          </div>
          <div>
            <p className="text-gray-600">Peak</p>
            <p className="font-medium">{endpoint.peak_requests}</p>
          </div>
        </div>

        {/* Window and Response Time */}
        <div className="flex justify-between text-sm">
          <div className="flex items-center">
            <Clock className="h-4 w-4 mr-1 text-gray-500" />
            <span className="text-gray-600">Window:</span>
            <span className="ml-1 font-medium">{endpoint.window_seconds}s</span>
          </div>
          {endpoint.average_response_time_ms > 0 && (
            <div className="flex items-center">
              <Zap className="h-4 w-4 mr-1 text-gray-500" />
              <span className="text-gray-600">Avg:</span>
              <span className={`ml-1 font-medium ${endpoint.average_response_time_ms > 1000 ? 'text-red-600' : 'text-green-600'}`}>
                {endpoint.average_response_time_ms}ms
              </span>
            </div>
          )}
        </div>

        {/* Reset Time */}
        {endpoint.reset_time && (
          <div className="text-sm text-gray-600">
            Resets: {new Date(endpoint.reset_time).toLocaleTimeString()}
          </div>
        )}

        {/* Endpoint Alerts */}
        {endpoint.alerts.length > 0 && (
          <div className="mt-3 space-y-1">
            {endpoint.alerts.map((alert) => (
              <div key={alert.id} className="text-sm text-red-600 flex items-center">
                <AlertCircle className="h-3 w-3 mr-1" />
                {alert.message}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
})

// Memoized Alert Item component
const AlertItem = memo(function AlertItem({ alert }: { alert: Alert }) {
  return (
    <div
      className={`p-3 rounded-lg border-l-4 ${alert.severity === 'critical' ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50'}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
              {alert.severity.toUpperCase()}
            </Badge>
            <span className="font-medium">{alert.endpoint}</span>
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
  )
})

// Memoized Recommendation Item component
const RecommendationItem = memo(function RecommendationItem({ rec }: { rec: Recommendation }) {
  return (
    <div className={`p-3 rounded-lg border ${getPriorityColor(rec.priority)}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline">{rec.priority.toUpperCase()}</Badge>
            <Badge variant="secondary">{rec.type}</Badge>
            {rec.endpoint && <span className="text-sm font-medium">{rec.endpoint}</span>}
          </div>
          <p className="text-sm mb-1">{rec.message}</p>
          <p className="text-xs text-gray-600">Action: {rec.action}</p>
        </div>
      </div>
    </div>
  )
})

function RateLimitDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Memoized fetch function to prevent recreation
  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await fetch('/api/monitoring/rate-limit/dashboard?history=true')

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const dashboardData = await response.json()
      setData(dashboardData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-refresh effect with proper dependency
  useEffect(() => {
    fetchDashboardData()

    if (autoRefresh) {
      const interval = setInterval(fetchDashboardData, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
    // No cleanup needed if autoRefresh is false
    return undefined
  }, [autoRefresh, fetchDashboardData])

  // Memoize auto-refresh handler
  const handleAutoRefreshChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAutoRefresh(e.target.checked)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading rate limit dashboard...</span>
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
        <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No rate limit data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Rate Limit Monitor</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={handleAutoRefreshChange}
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
                <p className="text-sm text-gray-600">Total Endpoints</p>
                <p className="text-2xl font-bold">{data.overview.total_endpoints}</p>
              </div>
              <Shield className="h-8 w-8 text-blue-500" />
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
                <p className="text-sm text-gray-600">Total Requests</p>
                <p className="text-2xl font-bold">{data.overview.total_requests}</p>
                <p className="text-xs text-gray-500">{data.overview.total_blocked} blocked</p>
              </div>
              <Zap className="h-8 w-8 text-purple-500" />
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
                <AlertItem key={alert.id} alert={alert} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Endpoint Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {data.endpoints.map((endpoint) => (
          <EndpointCard key={endpoint.endpoint} endpoint={endpoint} />
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
                <RecommendationItem key={index} rec={rec} />
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

export default memo(RateLimitDashboard)
