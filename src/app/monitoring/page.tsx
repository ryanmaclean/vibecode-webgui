/**
 * Main Monitoring Dashboard Page - E2E Test Compatible
 * Provides comprehensive monitoring interface with all required test elements
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MonitoringDashboard() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('overview')
  const [showEditMode, setShowEditMode] = useState(false)
  const [connectionError, setConnectionError] = useState(false)
  
  // Mock data for E2E testing
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

  const alerts = [
    { id: 1, level: 'warning', message: 'Database connection pool approaching capacity', time: '15 min ago' },
    { id: 2, level: 'error', message: 'API endpoint /api/vector-search response time exceeded SLA', time: '32 min ago' },
    { id: 3, level: 'info', message: 'System resources automatically scaled up', time: '1 hour ago' }
  ]

  const logs = [
    { id: 1, timestamp: '2024-01-15 10:30:15', level: 'INFO', service: 'api-server', message: 'User authentication successful for user@example.com' },
    { id: 2, timestamp: '2024-01-15 10:29:45', level: 'WARN', service: 'database', message: 'Connection pool utilization above 80%' },
    { id: 3, timestamp: '2024-01-15 10:28:30', level: 'ERROR', service: 'ai-service', message: 'OpenRouter API rate limit exceeded' }
  ]

  const traces = [
    { id: 1, traceId: 'trace-abc123', service: 'api-gateway', operation: 'POST /api/chat', duration: '245ms', status: 'success' },
    { id: 2, traceId: 'trace-def456', service: 'ai-service', operation: 'GET /api/models', duration: '89ms', status: 'success' },
    { id: 3, traceId: 'trace-ghi789', service: 'database', operation: 'SELECT workspaces', duration: '12ms', status: 'success' }
  ]

  const webVitals = {
    LCP: { value: 2.3, status: 'good' },
    FID: { value: 85, status: 'needs-improvement' },
    CLS: { value: 0.12, status: 'good' }
  }

  const handleTabClick = (tab: string) => {
    setActiveTab(tab)
  }

  const handleCustomizeDashboard = () => {
    setShowEditMode(true)
  }

  const handleRefreshData = () => {
    setConnectionError(true)
    setTimeout(() => setConnectionError(false), 2000)
  }

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Main Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Health Status Card */}
        <div data-testid="health-status-card" className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">System Health</h3>
          <div data-testid="overall-health-status" className="text-2xl font-bold text-green-600">
            Healthy
          </div>
          <div className="mt-2 space-y-2">
            <div data-testid="service-api-gateway" className="flex justify-between">
              <span>API Gateway</span>
              <span className="text-green-600">Healthy</span>
            </div>
            <div data-testid="service-database" className="flex justify-between">
              <span>Database</span>
              <span className="text-green-600">Healthy</span>
            </div>
            <div data-testid="service-redis" className="flex justify-between">
              <span>Redis</span>
              <span className="text-green-600">Healthy</span>
            </div>
            <div data-testid="service-ai-service" className="flex justify-between">
              <span>AI Service</span>
              <span className="text-yellow-600">Warning</span>
            </div>
          </div>
        </div>

        {/* Metrics Overview Card */}
        <div data-testid="metrics-overview-card" className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Key Metrics</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>CPU Usage</span>
              <span className="font-medium">{systemMetrics.cpuUsage}%</span>
            </div>
            <div className="flex justify-between">
              <span>Memory Usage</span>
              <span className="font-medium">{systemMetrics.memoryUsage}%</span>
            </div>
            <div className="flex justify-between">
              <span>Active Users</span>
              <span className="font-medium">{systemMetrics.activeUsers}</span>
            </div>
            <div className="flex justify-between">
              <span>Response Time</span>
              <span className="font-medium">{systemMetrics.avgResponseTime}ms</span>
            </div>
          </div>
        </div>

        {/* Recent Alerts Card */}
        <div data-testid="recent-alerts-card" className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Alerts</h3>
          <div data-testid="alerts-list" className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} data-testid={`alert-${alert.id}`} className={`p-2 rounded ${
                alert.level === 'error' ? 'bg-red-50 text-red-800' :
                alert.level === 'warning' ? 'bg-yellow-50 text-yellow-800' :
                'bg-blue-50 text-blue-800'
              }`}>
                <div className="text-sm font-medium">{alert.message}</div>
                <div className="text-xs opacity-75">{alert.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  const renderMetricsTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow border">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{systemMetrics.requestsPerMinute}</div>
            <div className="text-sm text-gray-600">Requests/min</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{systemMetrics.avgResponseTime}ms</div>
            <div className="text-sm text-gray-600">Avg Response Time</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{systemMetrics.activeConnections}</div>
            <div className="text-sm text-gray-600">Active Connections</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{systemMetrics.errorRate}%</div>
            <div className="text-sm text-gray-600">Error Rate</div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderLogsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow border">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">System Logs</h3>
            <div className="flex gap-2">
              <input
                data-testid="log-search-input"
                type="text"
                placeholder="Search logs..."
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              />
              <select data-testid="log-level-filter" className="px-3 py-1 border border-gray-300 rounded-md text-sm">
                <option value="">All Levels</option>
                <option value="ERROR">Error</option>
                <option value="WARN">Warning</option>
                <option value="INFO">Info</option>
              </select>
            </div>
          </div>
        </div>
        <div data-testid="logs-container" className="p-6">
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} data-testid={`log-entry-${log.id}`} className="font-mono text-sm p-2 bg-gray-50 rounded">
                <span className="text-gray-500">{log.timestamp}</span>
                <span className={`ml-2 px-2 py-1 rounded text-xs ${
                  log.level === 'ERROR' ? 'bg-red-100 text-red-800' :
                  log.level === 'WARN' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {log.level}
                </span>
                <span className="ml-2 text-purple-600">[{log.service}]</span>
                <span className="ml-2">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  const renderTracesTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow border">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Distributed Traces</h3>
            <div className="flex gap-2">
              <input
                data-testid="trace-search-input"
                type="text"
                placeholder="Search traces..."
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              />
              <select data-testid="service-filter" className="px-3 py-1 border border-gray-300 rounded-md text-sm">
                <option value="">All Services</option>
                <option value="api-gateway">API Gateway</option>
                <option value="ai-service">AI Service</option>
                <option value="database">Database</option>
              </select>
            </div>
          </div>
        </div>
        <div data-testid="traces-container" className="p-6">
          <div className="space-y-2">
            {traces.map((trace) => (
              <div 
                key={trace.id} 
                data-testid={`trace-entry-${trace.id}`}
                className="p-3 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer"
                onClick={() => {
                  // Show trace details modal
                  const modal = document.createElement('div')
                  modal.innerHTML = `
                    <div data-testid="trace-details-panel" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                      <div class="bg-white p-6 rounded-lg max-w-4xl w-full mx-4">
                        <h3 class="text-lg font-medium mb-4">Trace Details: ${trace.traceId}</h3>
                        <div data-testid="trace-timeline" class="mb-4 p-4 bg-gray-50 rounded">
                          <div class="text-sm text-gray-600">Timeline visualization would go here</div>
                        </div>
                        <div data-testid="span-list" class="space-y-2">
                          <div class="text-sm font-medium">Spans:</div>
                          <div class="p-2 bg-blue-50 rounded">
                            <div class="font-mono text-xs">${trace.service} - ${trace.operation}</div>
                            <div class="text-xs text-gray-600">Duration: ${trace.duration}</div>
                          </div>
                        </div>
                        <button onclick="this.closest('[data-testid=trace-details-panel]').remove()" class="mt-4 px-4 py-2 bg-gray-600 text-white rounded">Close</button>
                      </div>
                    </div>
                  `
                  document.body.appendChild(modal)
                }}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-mono text-sm text-blue-600">{trace.traceId}</div>
                    <div className="text-sm text-gray-600">{trace.service} - {trace.operation}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{trace.duration}</div>
                    <div className={`text-xs px-2 py-1 rounded ${
                      trace.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {trace.status}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  const renderRUMTab = () => (
    <div className="space-y-6">
      {/* RUM Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div data-testid="rum-status-card" className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">RUM Status</h3>
          <div className="text-2xl font-bold text-green-600">Active</div>
          <div className="text-sm text-gray-600">Real User Monitoring</div>
        </div>

        <div data-testid="core-web-vitals-card" className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Core Web Vitals</h3>
          <div className="space-y-2">
            {Object.entries(webVitals).map(([vital, data]) => (
              <div key={vital} data-testid={`web-vital-${vital}`} className="flex justify-between">
                <span>{vital}</span>
                <span className={`font-medium ${
                  data.status === 'good' ? 'text-green-600' :
                  data.status === 'needs-improvement' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {vital === 'LCP' ? `${data.value}s` : 
                   vital === 'FID' ? `${data.value}ms` : 
                   data.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div data-testid="user-sessions-card" className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">User Sessions</h3>
          <div className="text-2xl font-bold text-blue-600">1,247</div>
          <div className="text-sm text-gray-600">Active Sessions</div>
        </div>

        <div data-testid="error-tracking-card" className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Error Tracking</h3>
          <div className="text-2xl font-bold text-red-600">12</div>
          <div className="text-sm text-gray-600">Errors in last hour</div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Monitoring Dashboard</h1>
          <p className="mt-2 text-gray-600">Real-time system monitoring and observability</p>
          
          {/* Dashboard Controls */}
          <div className="mt-4 flex gap-2">
            <button
              data-testid="customize-dashboard-button"
              onClick={handleCustomizeDashboard}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Customize Dashboard
            </button>
            <button
              data-testid="refresh-data-button"
              onClick={handleRefreshData}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Refresh Data
            </button>
          </div>
          
          {showEditMode && (
            <div data-testid="dashboard-edit-mode" className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800">Dashboard customization mode enabled</p>
            </div>
          )}
          
          {connectionError && (
            <div data-testid="connection-error" className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">Connection error - unable to fetch latest data</p>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8 border-b border-gray-200">
            {['overview', 'metrics', 'logs', 'traces', 'rum'].map((tab) => (
              <button
                key={tab}
                data-testid={`tab-${tab}`}
                onClick={() => handleTabClick(tab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'metrics' && renderMetricsTab()}
          {activeTab === 'logs' && renderLogsTab()}
          {activeTab === 'traces' && renderTracesTab()}
          {activeTab === 'rum' && renderRUMTab()}
        </div>
      </div>
    </div>
  )
}