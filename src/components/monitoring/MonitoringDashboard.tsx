/**
 * Monitoring Dashboard Component for VibeCode WebGUI
 * Displays real-time metrics, logs, and system health information
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { monitoring } from '@/lib/monitoring'

interface SystemMetrics {
  cpu: number
  memory: number
  diskUsage: number
  networkIO: { in: number; out: number }
  activeUsers: number
  activeWorkspaces: number
  totalSessions: number
  avgResponseTime: number
  errorRate: number
  uptime: number
}

interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error'
  message: string
  source: string
  metadata?: Record<string, any>
}

interface AlertItem {
  id: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  timestamp: string
  resolved: boolean
}

export default function MonitoringDashboard() {
  const { data: session } = useSession()
  const user = session?.user
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [selectedTab, setSelectedTab] = useState<'overview' | 'metrics' | 'logs' | 'alerts' | 'security'>('overview')
  const [isLiveMode, setIsLiveMode] = useState(true)
  const [timeRange, setTimeRange] = useState('1h')
  const metricsInterval = useRef<NodeJS.Timeout | null>(null)

  // Fetch real-time metrics
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/monitoring/metrics')
        if (response.ok) {
          const data = await response.json()
          setMetrics(data)

          // Track critical metrics
          if (data.errorRate > 5) {
            monitoring.logWarning('High error rate detected', { errorRate: data.errorRate })
          }
          if (data.avgResponseTime > 1000) {
            monitoring.logWarning('Slow response time detected', { avgResponseTime: data.avgResponseTime })
          }
        }
      } catch (error) {
        console.error('Failed to fetch metrics:', error)
        monitoring.logError('Metrics fetch failed', { error })
      }
    }

    const fetchLogs = async () => {
      try {
        const response = await fetch(`/api/monitoring/logs?timeRange=${timeRange}&limit=100`)
        if (response.ok) {
          const data = await response.json()
          setLogs(data.logs || [])
        }
      } catch (error) {
        console.error('Failed to fetch logs:', error)
      }
    }

    const fetchAlerts = async () => {
      try {
        const response = await fetch('/api/monitoring/alerts')
        if (response.ok) {
          const data = await response.json()
          setAlerts(data.alerts || [])
        }
      } catch (error) {
        console.error('Failed to fetch alerts:', error)
      }
    }

    // Initial fetch
    fetchMetrics()
    fetchLogs()
    fetchAlerts()

    // Set up real-time updates
    if (isLiveMode) {
      metricsInterval.current = setInterval(() => {
        fetchMetrics()
        fetchLogs()
        fetchAlerts()
      }, 30000) // Update every 30 seconds
    }

    return () => {
      if (metricsInterval.current) {
        clearInterval(metricsInterval.current)
      }
    }
  }, [isLiveMode, timeRange])

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDuration = (seconds: number): string => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }): string => {
    if (value <= thresholds.good) return 'text-green-600'
    if (value <= thresholds.warning) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getAlertColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'bg-red-100 border-red-500 text-red-800'
      case 'high': return 'bg-orange-100 border-orange-500 text-orange-800'
      case 'medium': return 'bg-yellow-100 border-yellow-500 text-yellow-800'
      case 'low': return 'bg-blue-100 border-blue-500 text-blue-800'
      default: return 'bg-gray-100 border-gray-500 text-gray-800'
    }
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Administrator privileges required to view monitoring dashboard.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">Monitoring Dashboard</h1>
              <div className={`h-2 w-2 rounded-full ${isLiveMode ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="text-sm text-gray-600">
                {isLiveMode ? 'Live' : 'Paused'}
              </span>
            </div>

            <div className="flex items-center space-x-4">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value="1h">Last Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>

              <button
                onClick={() => setIsLiveMode(!isLiveMode)}
                className={`px-3 py-1 rounded-md text-sm font-medium ${
                  isLiveMode
                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                {isLiveMode ? 'Pause' : 'Resume'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'metrics', label: 'Metrics' },
              { id: 'logs', label: 'Logs' },
              { id: 'alerts', label: `Alerts (${alerts.filter(a => !a.resolved).length})` },
              { id: 'security', label: 'Security' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  selectedTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics Grid */}
            {metrics && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg shadow">
                  <h3 className="text-sm font-medium text-gray-900">CPU Usage</h3>
                  <p className={`text-2xl font-bold ${getStatusColor(metrics.cpu, { good: 70, warning: 85 })}`} data-testid="cpu-metric">
                    {metrics.cpu.toFixed(1)}%
                  </p>
                </div>

                <div className="bg-white p-4 rounded-lg shadow">
                  <h3 className="text-sm font-medium text-gray-900">Memory Usage</h3>
                  <p className={`text-2xl font-bold ${getStatusColor(metrics.memory, { good: 80, warning: 90 })}`} data-testid="memory-metric">
                    {metrics.memory.toFixed(1)}%
                  </p>
                </div>

                <div className="bg-white p-4 rounded-lg shadow">
                  <h3 className="text-sm font-medium text-gray-900">Active Users</h3>
                  <p className="text-2xl font-bold text-blue-600" data-testid="users-metric">{metrics.activeUsers}</p>
                </div>

                <div className="bg-white p-4 rounded-lg shadow">
                  <h3 className="text-sm font-medium text-gray-900">Error Rate</h3>
                  <p className={`text-2xl font-bold ${getStatusColor(metrics.errorRate, { good: 1, warning: 5 })}`} data-testid="error-rate-metric">
                    {metrics.errorRate.toFixed(2)}%
                  </p>
                </div>
              </div>
            )}

            {/* Recent Alerts */}
            {alerts.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Recent Alerts</h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {alerts.slice(0, 5).map((alert) => (
                    <div key={alert.id} className={`px-6 py-3 border-l-4 ${getAlertColor(alert.severity)}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{alert.title}</p>
                          <p className="text-sm opacity-75">{alert.description}</p>
                        </div>
                        <span className="text-xs">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* System Information */}
            {metrics && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">System Status</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Uptime</span>
                      <span className="font-medium">{formatDuration(metrics.uptime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Active Workspaces</span>
                      <span className="font-medium">{metrics.activeWorkspaces}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Sessions</span>
                      <span className="font-medium">{metrics.totalSessions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Avg Response Time</span>
                      <span className="font-medium">{metrics.avgResponseTime}ms</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Network I/O</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Incoming</span>
                      <span className="font-medium">{formatBytes(metrics.networkIO.in)}/s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Outgoing</span>
                      <span className="font-medium">{formatBytes(metrics.networkIO.out)}/s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Disk Usage</span>
                      <span className="font-medium">{metrics.diskUsage.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedTab === 'logs' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">System Logs</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="px-6 py-3 border-b border-gray-100 font-mono text-sm">
                  <div className="flex items-start space-x-3">
                    <span className="text-gray-500">{log.timestamp}</span>
                    <span className={`font-medium ${
                      log.level === 'error' ? 'text-red-600' :
                      log.level === 'warn' ? 'text-yellow-600' :
                      'text-gray-600'
                    }`}>
                      [{log.level.toUpperCase()}]
                    </span>
                    <span className="text-blue-600">{log.source}</span>
                    <span className="flex-1">{log.message}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional tabs would be implemented here */}
      </div>
    </div>
  )
}
