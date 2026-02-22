/**
 * Container Monitoring Dashboard Component
 * Main dashboard for real-time container resource monitoring
 *
 * Container Resource Monitoring feature
 */

'use client'

import { useEffect, useState, useCallback, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Container, Activity, RefreshCw } from 'lucide-react'
import { ContainerMetricsChart } from './ContainerMetricsChart'
import { ContainerResourceGauge } from './ContainerResourceGauge'
import { ContainerAlertsList } from './ContainerAlertsList'

interface ContainerInfo {
  id: string
  name: string
  status: 'running' | 'stopped' | 'paused'
  cpu_percent: number
  memory_percent: number
  created: string
  image: string
}

interface ContainerSummary {
  total_containers: number
  running_containers: number
  stopped_containers: number
  total_cpu_percent: number
  total_memory_percent: number
  timestamp: string
}

interface DashboardData {
  containers: ContainerInfo[]
  summary: ContainerSummary
  timestamp: string
}

// Memoized Container Card component
const ContainerCard = memo(function ContainerCard({ container }: { container: ContainerInfo }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500'
      case 'stopped': return 'bg-red-500'
      case 'paused': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running': return 'secondary'
      case 'stopped': return 'destructive'
      case 'paused': return 'default'
      default: return 'outline'
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center mb-1">
              <div className={`w-3 h-3 rounded-full mr-2 ${getStatusColor(container.status)}`} />
              <CardTitle className="text-base font-semibold">{container.name}</CardTitle>
            </div>
            <p className="text-xs text-gray-500 truncate">{container.image}</p>
          </div>
          <Badge variant={getStatusBadge(container.status) as any}>
            {container.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">CPU</p>
            <p className={`font-semibold ${container.cpu_percent > 80 ? 'text-red-600' : 'text-green-600'}`}>
              {container.cpu_percent.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Memory</p>
            <p className={`font-semibold ${container.memory_percent > 80 ? 'text-red-600' : 'text-green-600'}`}>
              {container.memory_percent.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="pt-2 border-t">
          <p className="text-xs text-gray-500">
            Created: {new Date(container.created).toLocaleDateString()}
          </p>
        </div>
      </CardContent>
    </Card>
  )
})

function ContainerMonitoringDashboardInner() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Memoized fetch function
  const fetchDashboardData = useCallback(async () => {
    try {
      const res = await fetch('/api/monitoring/containers')

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const dashboardData = await res.json()
      setData(dashboardData)
      setLastUpdate(new Date())
      setError(null)

      // Auto-select first running container if none selected
      if (!selectedContainer && dashboardData.containers?.length > 0) {
        const firstRunning = dashboardData.containers.find((c: ContainerInfo) => c.status === 'running')
        if (firstRunning) {
          setSelectedContainer(firstRunning.name)
        }
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch container data')
    } finally {
      setLoading(false)
    }
  }, [selectedContainer])

  // Auto-refresh effect
  useEffect(() => {
    fetchDashboardData()

    if (autoRefresh) {
      const interval = setInterval(fetchDashboardData, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
    return undefined
  }, [autoRefresh, fetchDashboardData])

  // Memoize handlers
  const handleAutoRefreshChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAutoRefresh(e.target.checked)
  }, [])

  const handleRefreshClick = useCallback(() => {
    setLoading(true)
    fetchDashboardData()
  }, [fetchDashboardData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading container monitoring dashboard...</span>
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
          onClick={handleRefreshClick}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data || !data.containers || data.containers.length === 0) {
    return (
      <div className="text-center py-12">
        <Container className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 text-lg font-medium">No containers found</p>
        <p className="text-gray-500 text-sm mt-1">Start a container to see monitoring data</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center">
          <Container className="h-6 w-6 mr-2 text-blue-600" />
          Container Resource Monitor
        </h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={handleAutoRefreshChange}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Auto-refresh (30s)</span>
          </label>
          <button
            onClick={handleRefreshClick}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
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
                <p className="text-sm text-gray-600">Total Containers</p>
                <p className="text-2xl font-bold">{data.summary.total_containers}</p>
              </div>
              <Container className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Running</p>
                <p className="text-2xl font-bold text-green-600">{data.summary.running_containers}</p>
              </div>
              <Activity className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total CPU Usage</p>
                <p className={`text-2xl font-bold ${data.summary.total_cpu_percent > 80 ? 'text-red-600' : 'text-green-600'}`}>
                  {data.summary.total_cpu_percent.toFixed(1)}%
                </p>
              </div>
              <Activity className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Memory Usage</p>
                <p className={`text-2xl font-bold ${data.summary.total_memory_percent > 80 ? 'text-red-600' : 'text-green-600'}`}>
                  {data.summary.total_memory_percent.toFixed(1)}%
                </p>
              </div>
              <Activity className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      <ContainerAlertsList refreshInterval={30000} />

      {/* Container Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Container Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {data.containers.filter(c => c.status === 'running').map((container) => (
              <button
                key={container.id}
                onClick={() => setSelectedContainer(container.name)}
                className={`px-4 py-2 rounded transition-colors ${
                  selectedContainer === container.name
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {container.name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Resource Gauges - Show for selected container */}
      {selectedContainer && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ContainerResourceGauge
            containerName={selectedContainer}
            resourceType="cpu"
            refreshInterval={5000}
          />
          <ContainerResourceGauge
            containerName={selectedContainer}
            resourceType="memory"
            refreshInterval={5000}
          />
          <ContainerResourceGauge
            containerName={selectedContainer}
            resourceType="network"
            refreshInterval={5000}
          />
          <ContainerResourceGauge
            containerName={selectedContainer}
            resourceType="storage"
            refreshInterval={5000}
          />
        </div>
      )}

      {/* Metrics Charts - Show for selected container */}
      {selectedContainer && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ContainerMetricsChart
            containerName={selectedContainer}
            metric="cpu"
            timeRange="1h"
            refreshInterval={30000}
          />
          <ContainerMetricsChart
            containerName={selectedContainer}
            metric="memory"
            timeRange="1h"
            refreshInterval={30000}
          />
          <ContainerMetricsChart
            containerName={selectedContainer}
            metric="network"
            timeRange="1h"
            refreshInterval={30000}
          />
          <ContainerMetricsChart
            containerName={selectedContainer}
            metric="storage"
            timeRange="1h"
            refreshInterval={30000}
          />
        </div>
      )}

      {/* Container List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Container className="h-5 w-5 mr-2" />
            All Containers ({data.containers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.containers.map((container) => (
              <ContainerCard key={container.id} container={container} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Last Updated */}
      {lastUpdate && (
        <div className="text-center text-sm text-gray-500">
          Last updated: {lastUpdate.toLocaleString()}
        </div>
      )}
    </div>
  )
}

export const ContainerMonitoringDashboard = memo(ContainerMonitoringDashboardInner)
export default ContainerMonitoringDashboard
