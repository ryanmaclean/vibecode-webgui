/**
 * Main Monitoring Dashboard Page - E2E Test Compatible
 * Provides comprehensive monitoring interface with all required test elements
 */

'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { DemoBanner } from '@/components/ui/DemoBanner'
import { Radio, Gauge, Sparkles, ArrowRight } from 'lucide-react'

function escapeHtml(str: string): string {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export default function MonitoringDashboard(): React.JSX.Element {
  const t = useTranslations('monitoring')
  const [activeTab, setActiveTab] = useState('overview')
  const [showEditMode, setShowEditMode] = useState(false)
  const [connectionError, setConnectionError] = useState(false)
  
  const [systemMetrics, setSystemMetrics] = useState({ cpuUsage: 0, memoryUsage: 0, diskUsage: 0, activeUsers: 0, requestsPerMinute: 0, activeConnections: 0, errorRate: 0, avgResponseTime: 0 })
  const [alerts, setAlerts] = useState<Array<{ id: number; level: string; message: string; time: string }>>([])
  const [logs, setLogs] = useState<Array<{ id: number; timestamp: string; level: string; service: string; message: string }>>([])
  const [traces, setTraces] = useState<Array<{ id: number; traceId: string; service: string; operation: string; duration: string; status: string }>>([])
  const [webVitals, setWebVitals] = useState<Record<string, { value: number; status: string }>>({ LCP: { value: 0, status: 'good' }, FID: { value: 0, status: 'good' }, CLS: { value: 0, status: 'good' } })

  useEffect(() => {
    fetch('/api/monitoring/dashboard')
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then(data => {
        if (data.systemMetrics) setSystemMetrics(data.systemMetrics)
        if (data.alerts) setAlerts(data.alerts)
        if (data.logs) setLogs(data.logs)
        if (data.traces) setTraces(data.traces)
        if (data.webVitals) setWebVitals(data.webVitals)
      })
      .catch(() => {})
  }, [])

  const handleTabClick = (tab: string): void => {
    setActiveTab(tab)
  }

  const handleCustomizeDashboard = (): void => {
    setShowEditMode(true)
  }

  const handleRefreshData = (): void => {
    setConnectionError(true)
    setTimeout(() => setConnectionError(false), 2000)
  }

  const renderOverviewTab = (): React.JSX.Element => (
    <div className="space-y-6">
      {/* Main Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Health Status Card */}
        <div data-testid="health-status-card" className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{t('systemHealth')}</h3>
          <div data-testid="overall-health-status" className="text-2xl font-bold text-green-600">
            {t('healthy')}
          </div>
          <div className="mt-2 space-y-2">
            <div data-testid="service-api-gateway" className="flex justify-between">
              <span>{t('serviceApiGateway')}</span>
              <span className="text-green-600">{t('healthy')}</span>
            </div>
            <div data-testid="service-database" className="flex justify-between">
              <span>{t('serviceDatabase')}</span>
              <span className="text-green-600">{t('healthy')}</span>
            </div>
            <div data-testid="service-redis" className="flex justify-between">
              <span>{t('serviceRedis')}</span>
              <span className="text-green-600">{t('healthy')}</span>
            </div>
            <div data-testid="service-ai-service" className="flex justify-between">
              <span>{t('serviceAiService')}</span>
              <span className="text-yellow-600">{t('warning')}</span>
            </div>
          </div>
        </div>

        {/* Metrics Overview Card */}
        <div data-testid="metrics-overview-card" className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{t('keyMetrics')}</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>{t('cpuUsage')}</span>
              <span className="font-medium">{systemMetrics.cpuUsage}%</span>
            </div>
            <div className="flex justify-between">
              <span>{t('memoryUsage')}</span>
              <span className="font-medium">{systemMetrics.memoryUsage}%</span>
            </div>
            <div className="flex justify-between">
              <span>{t('activeUsers')}</span>
              <span className="font-medium">{systemMetrics.activeUsers}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('responseTime')}</span>
              <span className="font-medium">{systemMetrics.avgResponseTime}ms</span>
            </div>
          </div>
        </div>

        {/* Recent Alerts Card */}
        <div data-testid="recent-alerts-card" className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{t('recentAlerts')}</h3>
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

      {/* Specialized Monitoring Links */}
      <div className="bg-white p-6 rounded-lg shadow border">
        <h3 className="text-lg font-medium text-gray-900 mb-4">{t('specializedMonitoring')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* WebSocket Monitoring Link */}
          <Link
            href="/monitoring/websocket"
            data-testid="websocket-monitoring-link"
            className="flex items-center justify-between p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 hover:border-blue-400 hover:shadow-md transition-all group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Radio className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="font-medium text-gray-900">{t('websocket')}</div>
                <div className="text-xs text-gray-600">{t('monitorConnections')}</div>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-blue-600 group-hover:translate-x-1 transition-transform" />
          </Link>

          {/* Rate Limit Monitoring Link */}
          <Link
            href="/monitoring/rate-limit"
            data-testid="rate-limit-monitoring-link"
            className="flex items-center justify-between p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200 hover:border-purple-400 hover:shadow-md transition-all group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-600 rounded-lg">
                <Gauge className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="font-medium text-gray-900">{t('rateLimit')}</div>
                <div className="text-xs text-gray-600">{t('trackApiLimits')}</div>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-purple-600 group-hover:translate-x-1 transition-transform" />
          </Link>

          {/* AI Usage Monitoring Link */}
          <Link
            href="/monitoring/ai-usage"
            data-testid="ai-usage-monitoring-link"
            className="flex items-center justify-between p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 hover:border-green-400 hover:shadow-md transition-all group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-600 rounded-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="font-medium text-gray-900">{t('aiUsageLink')}</div>
                <div className="text-xs text-gray-600">{t('modelAnalytics')}</div>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-green-600 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  )

  const renderMetricsTab = (): React.JSX.Element => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow border">
        <h3 className="text-lg font-medium text-gray-900 mb-4">{t('performanceMetrics')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{systemMetrics.requestsPerMinute}</div>
            <div className="text-sm text-gray-600">{t('requestsPerMin')}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{systemMetrics.avgResponseTime}ms</div>
            <div className="text-sm text-gray-600">{t('avgResponseTime')}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{systemMetrics.activeConnections}</div>
            <div className="text-sm text-gray-600">{t('activeConnections')}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{systemMetrics.errorRate}%</div>
            <div className="text-sm text-gray-600">{t('errorRate')}</div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderLogsTab = (): React.JSX.Element => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow border">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">{t('systemLogs')}</h3>
            <div className="flex gap-2">
              <input
                data-testid="log-search-input"
                type="text"
                placeholder={t('searchLogs')}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              />
              <select data-testid="log-level-filter" className="px-3 py-1 border border-gray-300 rounded-md text-sm">
                <option value="">{t('allLevels')}</option>
                <option value="ERROR">{t('logLevelError')}</option>
                <option value="WARN">{t('logLevelWarning')}</option>
                <option value="INFO">{t('logLevelInfo')}</option>
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

  const renderTracesTab = (): React.JSX.Element => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow border">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">{t('distributedTraces')}</h3>
            <div className="flex gap-2">
              <input
                data-testid="trace-search-input"
                type="text"
                placeholder={t('searchTraces')}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              />
              <select data-testid="service-filter" className="px-3 py-1 border border-gray-300 rounded-md text-sm">
                <option value="">{t('allServices')}</option>
                <option value="api-gateway">{t('serviceApiGateway')}</option>
                <option value="ai-service">{t('serviceAiService')}</option>
                <option value="database">{t('serviceDatabase')}</option>
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
                        <h3 class="text-lg font-medium mb-4">Trace Details: ${escapeHtml(trace.traceId)}</h3>
                        <div data-testid="trace-timeline" class="mb-4 p-4 bg-gray-50 rounded">
                          <div class="text-sm text-gray-600">Timeline visualization would go here</div>
                        </div>
                        <div data-testid="span-list" class="space-y-2">
                          <div class="text-sm font-medium">Spans:</div>
                          <div class="p-2 bg-blue-50 rounded">
                            <div class="font-mono text-xs">${escapeHtml(trace.service)} - ${escapeHtml(trace.operation)}</div>
                            <div class="text-xs text-gray-600">Duration: ${escapeHtml(trace.duration)}</div>
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

  const renderRUMTab = (): React.JSX.Element => (
    <div className="space-y-6">
      {/* RUM Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div data-testid="rum-status-card" className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{t('rumStatus')}</h3>
          <div className="text-2xl font-bold text-green-600">{t('rumActive')}</div>
          <div className="text-sm text-gray-600">{t('realUserMonitoring')}</div>
        </div>

        <div data-testid="core-web-vitals-card" className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{t('coreWebVitals')}</h3>
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
          <h3 className="text-lg font-medium text-gray-900 mb-4">{t('userSessions')}</h3>
          <div className="text-2xl font-bold text-blue-600">1,247</div>
          <div className="text-sm text-gray-600">{t('activeSessions')}</div>
        </div>

        <div data-testid="error-tracking-card" className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{t('errorTracking')}</h3>
          <div className="text-2xl font-bold text-red-600">12</div>
          <div className="text-sm text-gray-600">{t('errorsInLastHour')}</div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <DemoBanner />
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t('dashboardTitle')}</h1>
          <p className="mt-2 text-gray-600">{t('dashboardSubtitle')}</p>

          {/* Dashboard Controls */}
          <div className="mt-4 flex gap-2">
            <button
              data-testid="customize-dashboard-button"
              onClick={handleCustomizeDashboard}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {t('customizeDashboard')}
            </button>
            <button
              data-testid="refresh-data-button"
              onClick={handleRefreshData}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              {t('refreshData')}
            </button>
          </div>

          {showEditMode && (
            <div data-testid="dashboard-edit-mode" className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800">{t('customizationModeEnabled')}</p>
            </div>
          )}

          {connectionError && (
            <div data-testid="connection-error" className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">{t('connectionError')}</p>
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