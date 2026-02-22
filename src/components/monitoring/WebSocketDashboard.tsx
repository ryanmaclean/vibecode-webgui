/**
 * WebSocket Monitoring Dashboard Component
 * Real-time visualization of WebSocket connection health and metrics
 */

'use client'

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Wifi, Activity, TrendingUp, Clock, Zap, Send, Download } from 'lucide-react'

interface WebSocketMetrics {
  connection_id: string
  connection_name: string
  status: 'connected' | 'connecting' | 'disconnected' | 'reconnecting'
  uptime_seconds: number
  messages_sent: number
  messages_received: number
  messages_queued: number
  bytes_sent: number
  bytes_received: number
  average_latency_ms: number
  last_ping_ms: number
  error_count: number
  reconnection_attempts: number
  last_activity_timestamp: string
  timestamp: string
  health_status: 'healthy' | 'warning' | 'critical'
}

interface Alert {
  id: string
  connection_name: string
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
  connection_name?: string
  message: string
  action: string
}

interface DashboardData {
  overview: {
    total_connections: number
    active_connections: number
    disconnected_connections: number
    healthy_connections: number
    warning_connections: number
    critical_connections: number
    total_messages_sent: number
    total_messages_received: number
    average_latency_ms: number
    total_errors: number
    active_alerts: number
    critical_alerts: number
    warning_alerts: number
    timestamp: string
  }
  connections: (WebSocketMetrics & { alerts: Alert[] })[]
  alerts: {
    active: Alert[]
    critical: Alert[]
    warning: Alert[]
  }
  performance_metrics: Array<{
    connection_name: string
    current_latency_ms: number
    average_latency_24h: number
    peak_latency_24h: number
    message_throughput: number
    error_rate_percent: number
    stability_score: number
    recommended_action?: string
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

const getConnectionStatusColor = (status: string) => {
  switch (status) {
    case 'connected': return 'text-green-600'
    case 'connecting': return 'text-blue-600'
    case 'reconnecting': return 'text-yellow-600'
    case 'disconnected': return 'text-red-600'
    default: return 'text-gray-600'
  }
}

const getLatencyColor = (latency: number) => {
  if (latency >= 500) return 'text-red-600'
  if (latency >= 200) return 'text-yellow-600'
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

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

const formatUptime = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

// Memoized WebSocket Connection Card component to prevent unnecessary re-renders
const ConnectionCard = memo(function ConnectionCard({ connection }: { connection: WebSocketMetrics & { alerts: Alert[] } }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${getHealthStatusColor(connection.health_status)}`} />
            {connection.connection_name}
          </CardTitle>
          <Badge variant={connection.status === 'connected' ? 'secondary' : 'destructive'}>
            {connection.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <p className={`font-semibold ${getConnectionStatusColor(connection.status)}`}>
              {connection.status.toUpperCase()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Uptime</p>
            <p className="font-semibold">
              {formatUptime(connection.uptime_seconds)}
            </p>
          </div>
        </div>

        {/* Message Metrics */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-gray-600">Sent</p>
            <p className="font-medium">{connection.messages_sent}</p>
          </div>
          <div>
            <p className="text-gray-600">Received</p>
            <p className="font-medium">{connection.messages_received}</p>
          </div>
          <div>
            <p className="text-gray-600">Queued</p>
            <p className={`font-medium ${connection.messages_queued > 10 ? 'text-yellow-600' : ''}`}>
              {connection.messages_queued}
            </p>
          </div>
        </div>

        {/* Data Transfer */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center">
            <Send className="h-3 w-3 mr-1 text-gray-500" />
            <span className="text-gray-600">Sent:</span>
            <span className="ml-1 font-medium">{formatBytes(connection.bytes_sent)}</span>
          </div>
          <div className="flex items-center">
            <Download className="h-3 w-3 mr-1 text-gray-500" />
            <span className="text-gray-600">Received:</span>
            <span className="ml-1 font-medium">{formatBytes(connection.bytes_received)}</span>
          </div>
        </div>

        {/* Latency */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center">
            <Clock className="h-4 w-4 mr-1 text-gray-500" />
            <span className="text-gray-600">Latency:</span>
            <span className={`ml-1 font-medium ${getLatencyColor(connection.average_latency_ms)}`}>
              {connection.average_latency_ms}ms avg
            </span>
          </div>
          <div className="flex items-center">
            <Zap className="h-4 w-4 mr-1 text-gray-500" />
            <span className="text-gray-600">Ping:</span>
            <span className={`ml-1 font-medium ${getLatencyColor(connection.last_ping_ms)}`}>
              {connection.last_ping_ms}ms
            </span>
          </div>
        </div>

        {/* Errors and Reconnections */}
        {(connection.error_count > 0 || connection.reconnection_attempts > 0) && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-600">Errors</p>
              <p className={`font-medium ${connection.error_count > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {connection.error_count}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Reconnects</p>
              <p className={`font-medium ${connection.reconnection_attempts > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                {connection.reconnection_attempts}
              </p>
            </div>
          </div>
        )}

        {/* Connection Alerts */}
        {connection.alerts.length > 0 && (
          <div className="mt-3 space-y-1">
            {connection.alerts.map((alert) => (
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
            <span className="font-medium">{alert.connection_name}</span>
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
            {rec.connection_name && <span className="text-sm font-medium">{rec.connection_name}</span>}
          </div>
          <p className="text-sm mb-1">{rec.message}</p>
          <p className="text-xs text-gray-600">Action: {rec.action}</p>
        </div>
      </div>
    </div>
  )
})

function WebSocketDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Memoized fetch function to prevent recreation
  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await fetch('/api/monitoring/websocket/dashboard?history=true')

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
        <span className="ml-2">Loading WebSocket dashboard...</span>
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
        <Wifi className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No WebSocket data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">WebSocket Monitor</h2>
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
                <p className="text-sm text-gray-600">Active Connections</p>
                <p className="text-2xl font-bold">{data.overview.active_connections}</p>
                <p className="text-xs text-gray-500">of {data.overview.total_connections} total</p>
              </div>
              <Wifi className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Average Latency</p>
                <p className={`text-2xl font-bold ${getLatencyColor(data.overview.average_latency_ms)}`}>
                  {data.overview.average_latency_ms}ms
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
                <p className="text-sm text-gray-600">Messages</p>
                <p className="text-2xl font-bold">{data.overview.total_messages_sent + data.overview.total_messages_received}</p>
                <p className="text-xs text-gray-500">
                  {data.overview.total_messages_sent} sent, {data.overview.total_messages_received} recv
                </p>
              </div>
              <Send className="h-8 w-8 text-purple-500" />
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

      {/* Connection Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {data.connections.map((connection) => (
          <ConnectionCard key={connection.connection_id} connection={connection} />
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

export default memo(WebSocketDashboard)
