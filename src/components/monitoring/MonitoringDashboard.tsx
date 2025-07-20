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

type TabType = 'overview' | 'metrics' | 'logs' | 'alerts' | 'security' | 'network';

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
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<TabType>('overview');
  const [isLiveMode, setIsLiveMode] = useState(true)
  const [timeRange, setTimeRange] = useState('1h')
  const metricsInterval = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const [metricsRes, logsRes, alertsRes] = await Promise.all([
          fetch(`/api/monitoring/metrics?range=${timeRange}`),
          fetch(`/api/monitoring/logs?range=${timeRange}`),
          fetch(`/api/monitoring/alerts?range=${timeRange}`),
        ])

        if (!metricsRes.ok || !logsRes.ok || !alertsRes.ok) {
          throw new Error('Failed to fetch monitoring data')
        }

        const metricsData = await metricsRes.json()
        const logsData = await logsRes.json()
        const alertsData = await alertsRes.json()

        setMetrics(metricsData)
        setLogs(logsData)
        setAlerts(alertsData)
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
            {(['overview', 'metrics', 'logs', 'alerts', 'security', 'network'] as TabType[]).map(tab => (
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
