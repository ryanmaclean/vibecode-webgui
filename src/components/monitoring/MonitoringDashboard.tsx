/**
 * Monitoring Dashboard Component for VibeCode WebGUI
 * Displays real-time metrics, logs, and system health information
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import dynamic from 'next/dynamic'
import { BarChart, LineChart, PieChart, XAxis, YAxis, Tooltip, Legend, Line, Bar, Pie, Cell, ResponsiveContainer } from 'recharts'

// Dynamically import the NetworkDiagnostics component with no SSR
const NetworkDiagnostics = dynamic(
  () => import('@/components/NetworkDiagnostics/NetworkDiagnostics').then(mod => mod.default),
  { ssr: false }
);

interface SystemMetrics {
  cpu: { usage: number; history: { time: string; usage: number }[] };
  memory: { usage: number; total: number; history: { time: string; usage: number }[] };
  disk: { usage: number; total: number };
  network: { in: number; out: number; history: { time: string; in: number; out: number }[] };
  activeUsers: number;
  activeWorkspaces: number;
  requests: { total: number; errorRate: number };
  latency: { avg: number; p95: number; history: { time: string; avg: number }[] };
  kubernetes: { pods: number; restarts: number };
  uptime: string;
}

interface HealthStatus {
  status: 'healthy' | 'warning' | 'error'
  details?: any
  error?: string
}

interface EnhancedMonitoringData {
  health: {
    database: HealthStatus
    redis: HealthStatus
    aiService: HealthStatus
    overall: 'healthy' | 'warning' | 'error'
  }
  system: {
    memory: {
      used: number
      total: number
      usage_percent: number
    }
    uptime: {
      human: string
    }
  }
  sessions: {
    active: number
    details: Array<{
      sessionId: string
      duration_minutes: number
      commands: number
      ai_usage: number
    }>
  }
  monitoring: {
    datadog_configured: boolean
    environment: string
  }
}

type TabType = 'overview' | 'metrics' | 'logs' | 'alerts' | 'security' | 'network' | 'health';

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
  const { data: session } = useSession();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [enhancedData, setEnhancedData] = useState<EnhancedMonitoringData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<TabType>('health');
  const [isLiveMode, setIsLiveMode] = useState(true)
  const [timeRange, setTimeRange] = useState('1h')
  const metricsInterval = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const [metricsRes, dashboardRes, logsRes, alertsRes] = await Promise.all([
          fetch(`/api/monitoring/metrics?range=${timeRange}`).catch(() => null),
          fetch(`/api/monitoring/dashboard?range=${timeRange}`),
          fetch(`/api/monitoring/logs?range=${timeRange}`).catch(() => null),
          fetch(`/api/monitoring/alerts?range=${timeRange}`).catch(() => null),
        ])

        // Enhanced dashboard data is required
        if (!dashboardRes.ok) {
          throw new Error('Failed to fetch enhanced monitoring data')
        }

        const dashboardData = await dashboardRes.json()
        setEnhancedData(dashboardData)

        // Legacy metrics (optional)
        if (metricsRes && metricsRes.ok) {
          const metricsData = await metricsRes.json()
          setMetrics(metricsData)
        }

        // Logs (optional)
        if (logsRes && logsRes.ok) {
          const logsData = await logsRes.json()
          setLogs(logsData)
        } else {
          // Mock logs for demo
          setLogs([
            { timestamp: new Date().toISOString(), level: 'info', message: 'System started successfully', source: 'vibecode-webgui' },
            { timestamp: new Date().toISOString(), level: 'warn', message: 'High memory usage detected', source: 'monitoring' }
          ])
        }

        // Alerts (optional)
        if (alertsRes && alertsRes.ok) {
          const alertsData = await alertsRes.json()
          setAlerts(alertsData)
        } else {
          // Mock alerts for demo
          setAlerts([
            { id: '1', severity: 'medium', title: 'High Memory Usage', description: 'Memory usage is above 80%', timestamp: new Date().toISOString(), resolved: false }
          ])
        }

        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()

    if (isLiveMode) {
      metricsInterval.current = setInterval(fetchData, 5000) // Refresh every 5 seconds
    } else {
      if (metricsInterval.current) {
        clearInterval(metricsInterval.current)
      }
    }

    return () => {
      if (metricsInterval.current) {
        clearInterval(metricsInterval.current)
      }
    }
  }, [isLiveMode, timeRange])

  const StatCard = ({ title, value, subtext }: { title: string; value: string | number; subtext?: string }) => (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {subtext && <p className="text-xs text-gray-500">{subtext}</p>}
    </div>
  );

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getSeverityColor = (severity: AlertItem['severity']) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
    }
  };

  if (!session) {
    return <div>Access Denied. Please sign in to view the monitoring dashboard.</div>;
  }

  if (isLoading && !metrics) {
    return <div>Loading monitoring data...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  const renderContent = () => {
    switch (selectedTab) {
      case 'overview':
        return metrics && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <StatCard title="CPU Usage" value={`${metrics.cpu.usage.toFixed(1)}%`} />
            <StatCard title="Memory Usage" value={`${metrics.memory.usage.toFixed(1)}%`} subtext={`${formatBytes(metrics.memory.usage * metrics.memory.total / 100)} / ${formatBytes(metrics.memory.total)}`} />
            <StatCard title="Disk Usage" value={`${metrics.disk.usage.toFixed(1)}%`} />
            <StatCard title="Active Users" value={metrics.activeUsers} />
            <StatCard title="Active Workspaces" value={metrics.activeWorkspaces} />
            <StatCard title="Total Requests" value={metrics.requests.total} />
            <StatCard title="Error Rate" value={`${metrics.requests.errorRate.toFixed(2)}%`} />
            <StatCard title="Avg Latency" value={`${metrics.latency.avg.toFixed(0)}ms`} />
            <StatCard title="P95 Latency" value={`${metrics.latency.p95.toFixed(0)}ms`} />
            <StatCard title="K8s Pods" value={metrics.kubernetes.pods} />
            <StatCard title="K8s Restarts" value={metrics.kubernetes.restarts} />
            <StatCard title="Uptime" value={metrics.uptime} />
          </div>
        );
      case 'metrics':
        return metrics && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <h4 className="font-medium mb-4">CPU & Memory Usage (%)</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics.cpu.history}>
                    <XAxis dataKey="time" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="usage" name="CPU" stroke="#8884d8" dot={false} />
                    <Line type="monotone" dataKey="memory" name="Memory" data={metrics.memory.history} stroke="#82ca9d" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h4 className="font-medium mb-4">Network I/O</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.network.history}>
                    <XAxis dataKey="time" fontSize={12} />
                    <YAxis fontSize={12} tickFormatter={formatBytes} />
                    <Tooltip formatter={(value: number) => formatBytes(value)} />
                    <Legend />
                    <Bar dataKey="in" name="Incoming" fill="#8884d8" />
                    <Bar dataKey="out" name="Outgoing" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h4 className="font-medium mb-4">API Latency (ms)</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics.latency.history}>
                    <XAxis dataKey="time" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="avg" name="Average" stroke="#8884d8" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h4 className="font-medium mb-4">Disk Usage</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={[{ name: 'Used', value: metrics.disk.usage }, { name: 'Free', value: 100 - metrics.disk.usage }]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      <Cell fill="#8884d8" />
                      <Cell fill="#eeeeee" />
                    </Pie>
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
        );
      case 'logs':
        return (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">System Logs</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="px-6 py-3 border-b border-gray-100 font-mono text-sm">
                  <div className="flex items-start space-x-3">
                    <span className="text-gray-500">{log.timestamp}</span>
                    <span className={`font-medium ${log.level === 'error' ? 'text-red-600' : log.level === 'warn' ? 'text-yellow-600' : 'text-gray-600'}`}>[{log.level.toUpperCase()}]</span>
                    <span className="text-blue-600">{log.source}</span>
                    <span className="flex-1">{log.message}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'alerts':
        return (
          <div className="bg-white rounded-lg shadow">
             <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">System Alerts</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {alerts.map(alert => (
                <div key={alert.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className={`w-3 h-3 rounded-full mr-3 ${getSeverityColor(alert.severity)}`}></span>
                      <h4 className="font-semibold">{alert.title}</h4>
                    </div>
                    <span className="text-xs text-gray-500">{alert.timestamp}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 ml-6">{alert.description}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case 'security':
        return <div className="text-center p-8 bg-white rounded-lg shadow">Security monitoring coming soon.</div>;
      case 'network':
        return <NetworkDiagnostics />;
      case 'health':
        return enhancedData && (
          <div className="space-y-6">
            {/* Overall Health Status */}
            <div className={`p-4 rounded-lg border-2 ${
              enhancedData.health.overall === 'healthy' ? 'bg-green-50 border-green-200' :
              enhancedData.health.overall === 'warning' ? 'bg-yellow-50 border-yellow-200' :
              'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center">
                <div className={`h-4 w-4 rounded-full mr-3 ${
                  enhancedData.health.overall === 'healthy' ? 'bg-green-500' :
                  enhancedData.health.overall === 'warning' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}></div>
                <span className={`text-lg font-semibold ${
                  enhancedData.health.overall === 'healthy' ? 'text-green-700' :
                  enhancedData.health.overall === 'warning' ? 'text-yellow-700' :
                  'text-red-700'
                }`}>
                  System Status: {enhancedData.health.overall.charAt(0).toUpperCase() + enhancedData.health.overall.slice(1)}
                </span>
              </div>
            </div>

            {/* Service Health Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6 border">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 1.79 4 4 4h8c0-2.21-1.79-4-4-4H4z" />
                      </svg>
                    </div>
                  </div>
                  <div className={`h-3 w-3 rounded-full ${
                    enhancedData.health.database.status === 'healthy' ? 'bg-green-500' :
                    enhancedData.health.database.status === 'warning' ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}></div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Database</h3>
                <p className={`text-sm ${
                  enhancedData.health.database.status === 'healthy' ? 'text-green-600' :
                  enhancedData.health.database.status === 'warning' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {enhancedData.health.database.status.charAt(0).toUpperCase() + enhancedData.health.database.status.slice(1)}
                </p>
                {enhancedData.health.database.details?.latency && (
                  <p className="text-xs text-gray-500 mt-1">Latency: {enhancedData.health.database.details.latency}</p>
                )}
                {enhancedData.health.database.error && (
                  <p className="text-xs text-red-600 mt-1">{enhancedData.health.database.error}</p>
                )}
              </div>

              <div className="bg-white rounded-lg shadow p-6 border">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                  <div className={`h-3 w-3 rounded-full ${
                    enhancedData.health.redis.status === 'healthy' ? 'bg-green-500' :
                    enhancedData.health.redis.status === 'warning' ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}></div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Redis</h3>
                <p className={`text-sm ${
                  enhancedData.health.redis.status === 'healthy' ? 'text-green-600' :
                  enhancedData.health.redis.status === 'warning' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {enhancedData.health.redis.status.charAt(0).toUpperCase() + enhancedData.health.redis.status.slice(1)}
                </p>
                {enhancedData.health.redis.details?.latency && (
                  <p className="text-xs text-gray-500 mt-1">Latency: {enhancedData.health.redis.details.latency}</p>
                )}
                {enhancedData.health.redis.error && (
                  <p className="text-xs text-red-600 mt-1">{enhancedData.health.redis.error}</p>
                )}
              </div>

              <div className="bg-white rounded-lg shadow p-6 border">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                  </div>
                  <div className={`h-3 w-3 rounded-full ${
                    enhancedData.health.aiService.status === 'healthy' ? 'bg-green-500' :
                    enhancedData.health.aiService.status === 'warning' ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}></div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">AI Service</h3>
                <p className={`text-sm ${
                  enhancedData.health.aiService.status === 'healthy' ? 'text-green-600' :
                  enhancedData.health.aiService.status === 'warning' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {enhancedData.health.aiService.status.charAt(0).toUpperCase() + enhancedData.health.aiService.status.slice(1)}
                </p>
                {enhancedData.health.aiService.details?.models_available && (
                  <p className="text-xs text-gray-500 mt-1">Models: {enhancedData.health.aiService.details.models_available}</p>
                )}
                {enhancedData.health.aiService.error && (
                  <p className="text-xs text-red-600 mt-1">{enhancedData.health.aiService.error}</p>
                )}
              </div>
            </div>

            {/* System Metrics and Sessions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6 border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">System Resources</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Memory Usage</span>
                      <span>{enhancedData.system.memory.usage_percent}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          enhancedData.system.memory.usage_percent > 80 ? 'bg-red-500' :
                          enhancedData.system.memory.usage_percent > 60 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${enhancedData.system.memory.usage_percent}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {enhancedData.system.memory.used}MB / {enhancedData.system.memory.total}MB
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Uptime</span>
                    <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{enhancedData.system.uptime.human}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Terminal Sessions</h3>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm">Active Sessions</span>
                    <span className="text-3xl font-bold text-blue-600">{enhancedData.sessions.active}</span>
                  </div>
                  {enhancedData.sessions.details.length > 0 && (
                    <div>
                      <div className="text-sm text-gray-600 mb-2">Recent Activity</div>
                      <div className="space-y-2">
                        {enhancedData.sessions.details.slice(0, 3).map((session, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs bg-gray-50 p-2 rounded">
                            <span className="font-mono">{session.sessionId}</span>
                            <div className="flex space-x-3 text-gray-600">
                              <span>{session.duration_minutes}m</span>
                              <span>{session.commands} cmds</span>
                              <span>{session.ai_usage} AI</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {enhancedData.sessions.details.length === 0 && (
                    <div className="text-sm text-gray-500 text-center py-4">
                      No active sessions
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Configuration Status */}
            <div className="bg-white rounded-lg shadow p-6 border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuration Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Environment</span>
                  <span className="text-sm font-mono bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {enhancedData.monitoring.environment}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Datadog Integration</span>
                  <span className={`text-sm px-2 py-1 rounded font-medium ${
                    enhancedData.monitoring.datadog_configured 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {enhancedData.monitoring.datadog_configured ? '✅ Configured' : '⚠️ Not Configured'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Monitoring Dashboard</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Live Mode:</span>
            <button onClick={() => setIsLiveMode(!isLiveMode)} className={`px-3 py-1 text-sm rounded-full ${isLiveMode ? 'bg-green-500 text-white' : 'bg-gray-300'}`}>
              {isLiveMode ? 'ON' : 'OFF'}
            </button>
          </div>
          <select value={timeRange} onChange={e => setTimeRange(e.target.value)} className="px-3 py-1 border rounded-md text-sm">
            <option value="1h">Last 1 Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
        </div>
      </div>

      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {(['health', 'overview', 'metrics', 'logs', 'alerts', 'security', 'network'] as TabType[]).map(tab => (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab)}
                className={`${selectedTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div>{renderContent()}</div>
    </div>
  );
}
