import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  Database,
  HardDrive,
  Network,
  RefreshCw,
  Server,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  AlertCircle
} from 'lucide-react'
import { metricsApi } from '../services/api'
import { MetricsChart } from '../components/MetricsChart'
import { formatDistanceToNow } from 'date-fns'

export function Monitoring() {
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h')
  const [refreshInterval, setRefreshInterval] = useState(30000)

  const { data: systemMetrics, isLoading: loadingSystem } = useQuery({
    queryKey: ['monitoring', 'system'],
    queryFn: metricsApi.getSystemMetrics,
    refetchInterval: refreshInterval
  })

  const { data: alerts, isLoading: loadingAlerts } = useQuery({
    queryKey: ['monitoring', 'alerts'],
    queryFn: metricsApi.getAlerts,
    refetchInterval: refreshInterval
  })

  const { data: performance, isLoading: loadingPerformance } = useQuery({
    queryKey: ['monitoring', 'performance', timeRange],
    queryFn: () => metricsApi.getPerformanceMetrics(timeRange),
    refetchInterval: refreshInterval
  })

  const activeAlerts = alerts?.filter(alert => alert.status === 'firing') || []
  const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical')
  const warningAlerts = activeAlerts.filter(alert => alert.severity === 'warning')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Monitoring</h1>
          <p className="mt-2 text-sm text-gray-700">
            Real-time cluster health, performance metrics, and alerts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="input w-auto"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button className="btn-secondary">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Alerts Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Critical Alerts</p>
              <p className="text-2xl font-semibold text-gray-900">{criticalAlerts.length}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center">
            <AlertCircle className="h-8 w-8 text-yellow-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Warning Alerts</p>
              <p className="text-2xl font-semibold text-gray-900">{warningAlerts.length}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Services Up</p>
              <p className="text-2xl font-semibold text-gray-900">
                {systemMetrics?.services.filter(s => s.status === 'healthy').length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Uptime</p>
              <p className="text-2xl font-semibold text-gray-900">
                {systemMetrics?.uptime ? `${Math.floor(systemMetrics.uptime / 86400)}d` : '---'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Active Alerts</h3>
          <div className="space-y-3">
            {activeAlerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  alert.severity === 'critical'
                    ? 'border-red-200 bg-red-50'
                    : 'border-yellow-200 bg-yellow-50'
                }`}
              >
                <div className="flex items-center">
                  <AlertTriangle className={`h-5 w-5 mr-3 ${
                    alert.severity === 'critical' ? 'text-red-600' : 'text-yellow-600'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{alert.summary}</p>
                    <p className="text-xs text-gray-600">{alert.description}</p>
                  </div>
                </div>
                <div className="flex items-center text-xs text-gray-500">
                  <Clock className="h-3 w-3 mr-1" />
                  {formatDistanceToNow(new Date(alert.startsAt), { addSuffix: true })}
                </div>
              </div>
            ))}
            {activeAlerts.length > 5 && (
              <button className="w-full text-sm text-primary-600 hover:text-primary-700 py-2">
                View all {activeAlerts.length} alerts
              </button>
            )}
          </div>
        </div>
      )}

      {/* System Resources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Cluster Resources</h3>
          <div className="space-y-4">
            {loadingSystem ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-2 bg-gray-200 rounded"></div>
                </div>
              ))
            ) : (
              <>
                <ResourceBar
                  label="CPU Usage"
                  value={systemMetrics?.cpu.used || 0}
                  total={systemMetrics?.cpu.total || 100}
                  icon={Cpu}
                  color="blue"
                />
                <ResourceBar
                  label="Memory Usage"
                  value={systemMetrics?.memory.used || 0}
                  total={systemMetrics?.memory.total || 100}
                  icon={Database}
                  color="green"
                />
                <ResourceBar
                  label="Storage Usage"
                  value={systemMetrics?.storage.used || 0}
                  total={systemMetrics?.storage.total || 100}
                  icon={HardDrive}
                  color="purple"
                />
                <ResourceBar
                  label="Network I/O"
                  value={systemMetrics?.network.inbound || 0}
                  total={1000}
                  icon={Network}
                  color="orange"
                  unit="MB/s"
                />
              </>
            )}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Service Health</h3>
          <div className="space-y-3">
            {loadingSystem ? (
              [...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center justify-between animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                </div>
              ))
            ) : (
              systemMetrics?.services.map((service) => (
                <div key={service.name} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Server className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-900">{service.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${
                      service.status === 'healthy' ? 'badge-success' :
                      service.status === 'degraded' ? 'badge-warning' : 'badge-error'
                    }`}>
                      {service.status}
                    </span>
                    {service.responseTime && (
                      <span className="text-xs text-gray-500">{service.responseTime}ms</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Response Times</h3>
            <select className="input w-auto text-sm">
              <option>Average</option>
              <option>95th Percentile</option>
              <option>99th Percentile</option>
            </select>
          </div>
          {loadingPerformance ? (
            <div className="h-80 bg-gray-100 rounded animate-pulse"></div>
          ) : performance?.responseTime ? (
            <MetricsChart
              data={performance.responseTime}
              type="line"
              metrics={['requests']}
            />
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Error Rates</h3>
            <div className="text-sm text-gray-500">
              {timeRange === '1h' ? 'Last Hour' :
               timeRange === '24h' ? 'Last 24 Hours' :
               timeRange === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
            </div>
          </div>
          {loadingPerformance ? (
            <div className="h-80 bg-gray-100 rounded animate-pulse"></div>
          ) : performance?.errorRate ? (
            <MetricsChart
              data={performance.errorRate}
              type="area"
              metrics={['requests']}
            />
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Recent Events */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Recent Events</h3>
          <button className="text-sm text-primary-600 hover:text-primary-700">
            View all events
          </button>
        </div>
        <div className="space-y-3">
          {systemMetrics?.events?.slice(0, 8).map((event, index) => (
            <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div className="flex items-center">
                <EventIcon type={event.type} />
                <div className="ml-3">
                  <p className="text-sm text-gray-900">{event.message}</p>
                  <p className="text-xs text-gray-500">{event.source}</p>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
              </div>
            </div>
          )) || (
            <div className="text-center py-8 text-gray-500">
              No recent events
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ResourceBar({
  label,
  value,
  total,
  icon: Icon,
  color,
  unit = '%'
}: {
  label: string
  value: number
  total: number
  icon: any
  color: string
  unit?: string
}) {
  const percentage = Math.min((value / total) * 100, 100)
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <Icon className="h-4 w-4 text-gray-400 mr-2" />
          <span className="text-sm text-gray-900">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {unit === '%' ? `${percentage.toFixed(1)}%` : `${value.toFixed(1)} ${unit}`}
          </span>
          <TrendIcon value={percentage} />
        </div>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${colorClasses[color]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function TrendIcon({ value }: { value: number }) {
  if (value > 80) {
    return <TrendingUp className="h-3 w-3 text-red-500" />
  } else if (value > 60) {
    return <TrendingUp className="h-3 w-3 text-yellow-500" />
  } else if (value < 20) {
    return <TrendingDown className="h-3 w-3 text-green-500" />
  }
  return <Minus className="h-3 w-3 text-gray-400" />
}

function EventIcon({ type }: { type: string }) {
  const iconMap = {
    info: { icon: Eye, color: 'text-blue-500' },
    warning: { icon: AlertTriangle, color: 'text-yellow-500' },
    error: { icon: AlertCircle, color: 'text-red-500' },
    success: { icon: CheckCircle, color: 'text-green-500' }
  }

  const config = iconMap[type] || iconMap.info
  const IconComponent = config.icon

  return <IconComponent className={`h-4 w-4 ${config.color}`} />
}
