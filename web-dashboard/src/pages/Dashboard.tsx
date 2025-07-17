import { useQuery } from '@tanstack/react-query'
import {
  Server,
  Bot,
  Users,
  Activity,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react'
import { aiApi, k8sApi, metricsApi } from '../services/api'
import { StatCard } from '../components/StatCard'
import { MetricsChart } from '../components/MetricsChart'
import { RecentActivity } from '../components/RecentActivity'
import { QuickActions } from '../components/QuickActions'

export function Dashboard() {
  const { data: clusterMetrics } = useQuery({
    queryKey: ['cluster-metrics'],
    queryFn: k8sApi.getClusterMetrics,
    refetchInterval: 30000
  })

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status'],
    queryFn: aiApi.getStatus,
    refetchInterval: 30000
  })

  const { data: models } = useQuery({
    queryKey: ['models'],
    queryFn: aiApi.getModels
  })

  const { data: workspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: k8sApi.getWorkspaces
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: k8sApi.getUsers
  })

  const { data: usageMetrics } = useQuery({
    queryKey: ['usage-metrics'],
    queryFn: () => metricsApi.getUsageMetrics(7)
  })

  const runningWorkspaces = workspaces?.filter(w => w.status === 'running').length || 0
  const activeUsers = users?.filter(u => u.status === 'active').length || 0
  const healthyModels = models?.models.filter(m => m.isHealthy !== false).length || 0
  const clusterHealth = clusterMetrics?.nodes.filter(n => n.status === 'Ready').length || 0

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-700">
          Overview of your VibeCode platform status and metrics.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Workspaces"
          value={runningWorkspaces}
          change="+2 from yesterday"
          trend="up"
          icon={Server}
          color="blue"
        />
        <StatCard
          title="AI Models"
          value={healthyModels}
          subtitle={`${models?.count || 0} total available`}
          icon={Bot}
          color="purple"
        />
        <StatCard
          title="Active Users"
          value={activeUsers}
          change="+1 from yesterday"
          trend="up"
          icon={Users}
          color="green"
        />
        <StatCard
          title="Cluster Nodes"
          value={clusterHealth}
          subtitle={`${clusterMetrics?.nodes.length || 0} total nodes`}
          icon={Activity}
          color="orange"
        />
      </div>

      {/* System status overview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">System Health</h3>
          <div className="space-y-3">
            {aiStatus && (
              <>
                <ServiceStatus
                  name="AI Gateway"
                  status={aiStatus.status === 'operational' ? 'healthy' : 'unhealthy'}
                  uptime={`${Math.floor(aiStatus.metrics.uptime / 3600)}h ${Math.floor((aiStatus.metrics.uptime % 3600) / 60)}m`}
                />
                <ServiceStatus
                  name="Redis"
                  status={aiStatus.services.redis === 'connected' ? 'healthy' : 'unhealthy'}
                />
                <ServiceStatus
                  name="OpenRouter"
                  status={aiStatus.services.openrouter === 'connected' ? 'healthy' : 'unhealthy'}
                />
                <ServiceStatus
                  name="Model Registry"
                  status={aiStatus.services.modelRegistry === 'loaded' ? 'healthy' : 'unhealthy'}
                  info={`${aiStatus.metrics.modelCount} models loaded`}
                />
              </>
            )}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Cluster Resources</h3>
          {clusterMetrics && (
            <div className="space-y-4">
              <ResourceBar
                label="CPU Usage"
                percentage={clusterMetrics.resources.cpuUsage}
                color="blue"
              />
              <ResourceBar
                label="Memory Usage"
                percentage={clusterMetrics.resources.memoryUsage}
                color="green"
              />
              <ResourceBar
                label="Storage Usage"
                percentage={clusterMetrics.resources.storageUsage}
                color="purple"
              />
            </div>
          )}
        </div>
      </div>

      {/* Usage metrics chart */}
      {usageMetrics && (
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">AI Usage Metrics (7 days)</h3>
          <MetricsChart data={usageMetrics.usage} />
        </div>
      )}

      {/* Quick actions and recent activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <QuickActions />
        <RecentActivity />
      </div>
    </div>
  )
}

function ServiceStatus({
  name,
  status,
  uptime,
  info
}: {
  name: string
  status: 'healthy' | 'unhealthy' | 'warning'
  uptime?: string
  info?: string
}) {
  const statusConfig = {
    healthy: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' },
    warning: { icon: AlertCircle, color: 'text-yellow-500', bg: 'bg-yellow-50' },
    unhealthy: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50' }
  }

  const { icon: Icon, color, bg } = statusConfig[status]

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-x-3">
        <div className={`p-1 rounded-full ${bg}`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{name}</p>
          {info && <p className="text-xs text-gray-500">{info}</p>}
        </div>
      </div>
      {uptime && (
        <div className="flex items-center gap-x-1 text-xs text-gray-500">
          <Clock className="h-3 w-3" />
          {uptime}
        </div>
      )}
    </div>
  )
}

function ResourceBar({
  label,
  percentage,
  color = 'blue'
}: {
  label: string
  percentage: number
  color?: 'blue' | 'green' | 'purple' | 'red'
}) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    red: 'bg-red-500'
  }

  return (
    <div>
      <div className="flex justify-between text-sm text-gray-700 mb-1">
        <span>{label}</span>
        <span>{percentage}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${colorClasses[color]}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  )
}
