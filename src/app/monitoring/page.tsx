/**
 * Main Monitoring Dashboard Page
 * Provides an overview of system monitoring metrics
 */

'use client'

import { useRouter } from 'next/navigation'
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts'

export default function MonitoringDashboard() {
  const router = useRouter()
  
  // Mock data for demonstration
  const systemMetrics = {
    cpuUsage: 42,
    memoryUsage: 68,
    diskUsage: 55,
    activeUsers: 37,
    requestsPerMinute: 120,
    activeConnections: 15,
    errorRate: 0.8,
    avgResponseTime: 230
  }
  
  const hourlyData = [
    { time: '10:00', cpu: 35, memory: 60, requests: 90, responseTime: 180 },
    { time: '11:00', cpu: 40, memory: 65, requests: 105, responseTime: 200 },
    { time: '12:00', cpu: 48, memory: 70, requests: 130, responseTime: 230 },
    { time: '13:00', cpu: 52, memory: 72, requests: 140, responseTime: 250 },
    { time: '14:00', cpu: 45, memory: 68, requests: 120, responseTime: 230 },
    { time: '15:00', cpu: 42, memory: 65, requests: 110, responseTime: 220 },
    { time: '16:00', cpu: 38, memory: 62, requests: 100, responseTime: 210 }
  ]
  
  const alerts = [
    { id: 1, level: 'warning', message: 'Database connection pool approaching capacity', time: '15 min ago' },
    { id: 2, level: 'error', message: 'API endpoint /api/vector-search response time exceeded SLA', time: '32 min ago' },
    { id: 3, level: 'info', message: 'System resources automatically scaled up', time: '1 hour ago' }
  ]
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Monitoring Dashboard</h1>
        <div className="flex space-x-2">
          <button 
            className="px-3 py-1 text-sm font-medium rounded-md bg-blue-100 text-blue-700"
            onClick={() => {}}
          >
            Last 24 Hours
          </button>
        </div>
      </div>
      
      {/* System Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatusCard
          title="CPU Usage"
          value={`${systemMetrics.cpuUsage}%`}
          status={systemMetrics.cpuUsage > 80 ? 'error' : systemMetrics.cpuUsage > 60 ? 'warning' : 'good'}
          onClick={() => router.push('/monitoring/system')}
        />
        <StatusCard
          title="Memory"
          value={`${systemMetrics.memoryUsage}%`}
          status={systemMetrics.memoryUsage > 80 ? 'error' : systemMetrics.memoryUsage > 60 ? 'warning' : 'good'}
          onClick={() => router.push('/monitoring/system')}
        />
        <StatusCard
          title="Requests/min"
          value={systemMetrics.requestsPerMinute.toString()}
          status="good"
          onClick={() => router.push('/monitoring/api-performance')}
        />
        <StatusCard
          title="Response Time"
          value={`${systemMetrics.avgResponseTime}ms`}
          status={systemMetrics.avgResponseTime > 300 ? 'error' : systemMetrics.avgResponseTime > 200 ? 'warning' : 'good'}
          onClick={() => router.push('/monitoring/api-performance')}
        />
      </div>
      
      {/* Database Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Database Performance</h2>
            <button 
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
              onClick={() => router.push('/monitoring/connection-pool')}
            >
              View Details →
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm font-medium text-gray-500">Active Connections</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{systemMetrics.activeConnections}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm font-medium text-gray-500">Connection Pool Utilization</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">75%</div>
            </div>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={hourlyData}
                margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="responseTime" stroke="#8884d8" name="Response Time (ms)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Vector Database Metrics */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Vector Database</h2>
            <button 
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
              onClick={() => router.push('/monitoring/vector-db')}
            >
              View Details →
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm font-medium text-gray-500">Vector Store Size</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">32.5 GB</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm font-medium text-gray-500">Vector Embeddings</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">1.2M</div>
            </div>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={hourlyData}
                margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="requests" fill="#8884d8" name="Vector Searches" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Recent Alerts */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">Recent Alerts</h2>
          <button 
            className="text-sm font-medium text-blue-600 hover:text-blue-500"
            onClick={() => router.push('/monitoring/alerts')}
          >
            View All Alerts →
          </button>
        </div>
        <div className="divide-y divide-gray-200">
          {alerts.map(alert => (
            <div key={alert.id} className="py-3 flex items-start">
              <div className={`mt-1 mr-3 flex-shrink-0 h-3 w-3 rounded-full ${
                alert.level === 'error' ? 'bg-red-500' : 
                alert.level === 'warning' ? 'bg-yellow-500' : 
                'bg-blue-500'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                <p className="text-xs text-gray-500">{alert.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickLinkCard
          title="Connection Pool Monitoring"
          description="Monitor database connection pools, performance metrics, and configuration"
          icon={
            <svg className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
          }
          onClick={() => router.push('/monitoring/connection-pool')}
        />
        <QuickLinkCard
          title="Datadog Integration"
          description="Configure and view metrics from Datadog integration"
          icon={
            <svg className="h-8 w-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
          onClick={() => router.push('/monitoring/datadog')}
        />
        <QuickLinkCard
          title="System Logs"
          description="View and search application logs"
          icon={
            <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          onClick={() => router.push('/monitoring/logs')}
        />
      </div>
    </div>
  )
}

interface StatusCardProps {
  title: string
  value: string
  status: 'good' | 'warning' | 'error'
  onClick: () => void
}

const StatusCard: React.FC<StatusCardProps> = ({ title, value, status, onClick }) => {
  return (
    <div 
      className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <div className={`h-2 w-2 rounded-full ${
          status === 'good' ? 'bg-green-500' : 
          status === 'warning' ? 'bg-yellow-500' : 
          'bg-red-500'
        }`} />
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  )
}

interface QuickLinkCardProps {
  title: string
  description: string
  icon: React.ReactNode
  onClick: () => void
}

const QuickLinkCard: React.FC<QuickLinkCardProps> = ({ title, description, icon, onClick }) => {
  return (
    <div 
      className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <div className="flex items-center">
        <div className="flex-shrink-0 mr-4">
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
    </div>
  )
}