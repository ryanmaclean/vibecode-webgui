/**
 * AI Usage Monitoring Dashboard Component
 * Real-time visualization of AI API usage, costs, and performance metrics
 */

'use client'

import React, { useState, useEffect, useCallback, memo } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Brain, Activity, TrendingUp, Clock, DollarSign } from 'lucide-react'
import { MetricsChart } from './MetricsChart'
import { LatencyHistogram } from './LatencyHistogram'
import { CostBreakdown } from './CostBreakdown'

interface ModelMetrics {
  model_name: string
  total_requests: number
  successful_requests: number
  failed_requests: number
  total_tokens: number
  input_tokens: number
  output_tokens: number
  average_response_time_ms: number
  total_cost: number
  cost_per_1k_tokens: number
  error_rate_percent: number
  requests_per_minute: number
  peak_rpm: number
  timestamp: string
  health_status: 'healthy' | 'warning' | 'critical'
}

interface Alert {
  id: string
  model_name?: string
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
  model_name?: string
  message: string
  action: string
}

interface DashboardData {
  overview: {
    total_requests: number
    total_tokens: number
    total_cost: number
    average_response_time_ms: number
    active_models: number
    error_rate_percent: number
    requests_per_minute: number
    cost_trend_24h: 'increasing' | 'stable' | 'decreasing'
    active_alerts: number
    critical_alerts: number
    warning_alerts: number
    timestamp: string
  }
  models: (ModelMetrics & { alerts: Alert[] })[]
  alerts: {
    active: Alert[]
    critical: Alert[]
    warning: Alert[]
  }
  usage_analytics: Array<{
    model_name: string
    requests_24h: number
    tokens_24h: number
    cost_24h: number
    average_response_time_24h: number
    error_rate_24h: number
    peak_rpm_24h: number
    cost_efficiency_score: number
    usage_trend: 'increasing' | 'stable' | 'decreasing'
  }>
  recommendations: Recommendation[]
  timestamp: string
}

// Memoized helper functions to avoid recreating on each render
const getHealthStatusColor = (status: string): string => {
  switch (status) {
    case 'healthy': return 'bg-green-500'
    case 'warning': return 'bg-yellow-500'
    case 'critical': return 'bg-red-500'
    default: return 'bg-gray-500'
  }
}

const getErrorRateColor = (errorRate: number): string => {
  if (errorRate >= 10) return 'text-red-600'
  if (errorRate >= 5) return 'text-yellow-600'
  return 'text-green-600'
}

const getCostTrendColor = (trend: string): string => {
  switch (trend) {
    case 'increasing': return 'text-red-600'
    case 'decreasing': return 'text-green-600'
    case 'stable': return 'text-blue-600'
    default: return 'text-gray-600'
  }
}

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'high': return 'border-red-500 bg-red-50'
    case 'medium': return 'border-yellow-500 bg-yellow-50'
    case 'low': return 'border-blue-500 bg-blue-50'
    default: return 'border-gray-500 bg-gray-50'
  }
}

const formatCost = (cost: number): string => {
  return `$${cost.toFixed(4)}`
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

// Memoized Model Card component to prevent unnecessary re-renders
const ModelCard = memo(function ModelCard({ model }: { model: ModelMetrics & { alerts: Alert[] } }) {
  const t = useTranslations('monitoring')
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${getHealthStatusColor(model.health_status)}`} />
            {model.model_name}
          </CardTitle>
          <Badge variant={model.health_status === 'healthy' ? 'secondary' : 'destructive'}>
            {model.health_status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Request Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">{t('aiUsage.totalRequests')}</p>
            <p className="font-semibold">{formatNumber(model.total_requests)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">{t('aiUsage.errorRate')}</p>
            <p className={`font-semibold ${getErrorRateColor(model.error_rate_percent)}`}>
              {model.error_rate_percent.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Token Usage */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-gray-600">{t('aiUsage.totalTokens')}</p>
            <p className="font-medium">{formatNumber(model.total_tokens)}</p>
          </div>
          <div>
            <p className="text-gray-600">{t('aiUsage.inputTokens')}</p>
            <p className="font-medium">{formatNumber(model.input_tokens)}</p>
          </div>
          <div>
            <p className="text-gray-600">{t('aiUsage.outputTokens')}</p>
            <p className="font-medium">{formatNumber(model.output_tokens)}</p>
          </div>
        </div>

        {/* Cost Metrics */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div>
            <p className="text-sm text-gray-600">{t('aiUsage.totalCost')}</p>
            <p className="font-semibold text-blue-600">{formatCost(model.total_cost)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">{t('aiUsage.costPer1kTokens')}</p>
            <p className="font-semibold text-blue-600">{formatCost(model.cost_per_1k_tokens)}</p>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center text-sm">
            <Clock className="h-4 w-4 mr-1 text-gray-500" />
            <span className="text-gray-600">{t('aiUsage.avgResponse')}:</span>
            <span className={`ml-1 font-medium ${model.average_response_time_ms > 2000 ? 'text-red-600' : 'text-green-600'}`}>
              {model.average_response_time_ms}ms
            </span>
          </div>
          <div className="flex items-center text-sm">
            <Activity className="h-4 w-4 mr-1 text-gray-500" />
            <span className="text-gray-600">{t('aiUsage.rpm')}:</span>
            <span className="ml-1 font-medium">{model.requests_per_minute.toFixed(1)}</span>
          </div>
        </div>

        {/* Model Alerts */}
        {model.alerts.length > 0 && (
          <div className="mt-3 space-y-1">
            {model.alerts.map((alert) => (
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
            {alert.model_name && <span className="font-medium">{alert.model_name}</span>}
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
  const t = useTranslations('monitoring')
  return (
    <div className={`p-3 rounded-lg border ${getPriorityColor(rec.priority)}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline">{rec.priority.toUpperCase()}</Badge>
            <Badge variant="secondary">{rec.type}</Badge>
            {rec.model_name && <span className="text-sm font-medium">{rec.model_name}</span>}
          </div>
          <p className="text-sm mb-1">{rec.message}</p>
          <p className="text-xs text-gray-600">{t('aiUsage.action')}: {rec.action}</p>
        </div>
      </div>
    </div>
  )
})

function AIUsageDashboard(): React.JSX.Element {
  const t = useTranslations('monitoring')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Memoized fetch function to prevent recreation
  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await fetch('/api/monitoring/ai-usage/dashboard?history=true')

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
        <span className="ml-2">{t('aiUsage.loadingDashboard')}</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">{t('aiUsage.errorLoading')}: {error}</span>
        </div>
        <button
          onClick={fetchDashboardData}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          {t('aiUsage.retry')}
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">{t('aiUsage.noData')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{t('aiUsage.title')}</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={handleAutoRefreshChange}
              className="mr-2"
            />
            {t('aiUsage.autoRefresh30s')}
          </label>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {t('aiUsage.refreshNow')}
          </button>
        </div>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('aiUsage.totalRequests')}</p>
                <p className="text-2xl font-bold">{formatNumber(data.overview.total_requests)}</p>
              </div>
              <Brain className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('aiUsage.totalCost')}</p>
                <p className="text-2xl font-bold text-blue-600">{formatCost(data.overview.total_cost)}</p>
                <p className={`text-xs ${getCostTrendColor(data.overview.cost_trend_24h)}`}>
                  {t('aiUsage.trend24h')}: {data.overview.cost_trend_24h}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('aiUsage.totalTokens')}</p>
                <p className="text-2xl font-bold">{formatNumber(data.overview.total_tokens)}</p>
                <p className="text-xs text-gray-500">{t('aiUsage.acrossAllModels')}</p>
              </div>
              <Activity className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('aiUsage.activeAlerts')}</p>
                <p className={`text-2xl font-bold ${data.overview.active_alerts > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {data.overview.active_alerts}
                </p>
                <p className="text-xs text-gray-500">
                  {t('aiUsage.criticalWarningCount', { critical: data.overview.critical_alerts, warning: data.overview.warning_alerts })}
                </p>
              </div>
              <AlertCircle className={`h-8 w-8 ${data.overview.active_alerts > 0 ? 'text-red-500' : 'text-gray-400'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('aiUsage.avgResponseTime')}</p>
                <p className={`text-xl font-bold ${data.overview.average_response_time_ms > 2000 ? 'text-red-600' : 'text-green-600'}`}>
                  {data.overview.average_response_time_ms}ms
                </p>
              </div>
              <Clock className="h-6 w-6 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('aiUsage.errorRate')}</p>
                <p className={`text-xl font-bold ${getErrorRateColor(data.overview.error_rate_percent)}`}>
                  {data.overview.error_rate_percent.toFixed(2)}%
                </p>
              </div>
              <AlertCircle className="h-6 w-6 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('aiUsage.requestsPerMinute')}</p>
                <p className="text-xl font-bold">{data.overview.requests_per_minute.toFixed(1)}</p>
              </div>
              <TrendingUp className="h-6 w-6 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Visualizations */}
      <MetricsChart period="24h" refreshInterval={30000} />

      <LatencyHistogram period="24h" refreshInterval={30000} />

      <CostBreakdown period="24h" refreshInterval={30000} />

      {/* Active Alerts */}
      {data.alerts.active.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-red-500" />
              {t('aiUsage.activeAlertsCount', { count: data.alerts.active.length })}
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

      {/* Model Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {data.models.map((model) => (
          <ModelCard key={model.model_name} model={model} />
        ))}
      </div>

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-blue-500" />
              {t('aiUsage.recommendationsCount', { count: data.recommendations.length })}
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
        {t('aiUsage.lastUpdated')}: {new Date(data.timestamp).toLocaleString()}
      </div>
    </div>
  )
}

export default memo(AIUsageDashboard)
