/**
 * LLM Operations Dashboard Page
 * Provides comprehensive monitoring for LLM usage, costs, and performance
 */

'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { DemoBanner } from '@/components/ui/DemoBanner'
import {
  Brain,
  DollarSign,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronRight,
  Activity,
  BarChart3,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface LLMMetrics {
  totalRequests: number
  totalTokens: number
  totalCost: number
  avgLatency: number
  successRate: number
  errorRate: number
}

interface ProviderStats {
  name: string
  requests: number
  tokens: number
  cost: number
  avgLatency: number
  errorRate: number
  status: 'healthy' | 'degraded' | 'down'
}

interface ModelUsage {
  model: string
  provider: string
  requests: number
  tokens: number
  cost: number
  avgLatency: number
}

interface RecentRequest {
  id: string
  timestamp: string
  model: string
  provider: string
  tokens: number
  latency: number
  cost: number
  status: 'success' | 'error'
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`
  }
  return tokens.toString()
}

function formatLatency(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`
  }
  return `${ms}ms`
}

function latencyColor(ms: number): string {
  if (ms < 1000) return 'text-green-600 dark:text-green-400'
  if (ms < 2000) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function errorRateColor(rate: number): string {
  if (rate < 1) return 'text-green-600 dark:text-green-400'
  if (rate < 3) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function statusBadge(status: 'healthy' | 'degraded' | 'down'): string {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium'
  switch (status) {
    case 'healthy':
      return `${base} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400`
    case 'degraded':
      return `${base} bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400`
    case 'down':
      return `${base} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400`
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function LLMOpsPage(): React.JSX.Element {
  const t = useTranslations('monitoring')
  const [activeTab, setActiveTab] = useState('overview')

  // State for real data
  const [metrics, setMetrics] = useState<LLMMetrics | null>(null)
  const [providers, setProviders] = useState<ProviderStats[]>([])
  const [models, setModels] = useState<ModelUsage[]>([])
  const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch data on mount
  useEffect(() => {
    let isInitialLoad = true

    async function fetchData(): Promise<void> {
      try {
        if (isInitialLoad) {
          setLoading(true)
        }

        // Fetch from actual API endpoints
        const [opsRes, costsRes, tokensRes] = await Promise.all([
          fetch('/api/monitoring/llm-ops'),
          fetch('/api/monitoring/llm-costs'),
          fetch('/api/monitoring/llm-tokens')
        ])

        if (!opsRes.ok || !costsRes.ok || !tokensRes.ok) {
          throw new Error('Failed to fetch one or more LLM monitoring endpoints')
        }

        const opsData = await opsRes.json()
        const costsData = await costsRes.json()
        const tokensData = await tokensRes.json()

        // Process and set state - map API data to component format
        setMetrics({
          totalRequests: opsData.requests?.total || 0,
          totalTokens: opsData.tokens?.total || 0,
          totalCost: opsData.costs?.total || 0,
          avgLatency: opsData.performance?.average_latency_ms || 0,
          successRate: opsData.requests?.success_rate || 0,
          errorRate: ((opsData.errors?.total || 0) / (opsData.requests?.total || 1)) * 100
        })

        setProviders(
          (costsData.providers || []).map((provider: Record<string, unknown>) => {
            const providerStatus = String(provider.status || 'healthy')
            return {
              name: String(provider.name || provider.provider || 'Unknown'),
              requests: Number(provider.requestCount || provider.requests || 0),
              tokens: Number(provider.tokenCount || provider.tokens || 0),
              cost: Number(provider.totalCost || provider.cost || 0),
              avgLatency: Number(provider.avgLatency || provider.average_latency_ms || 0),
              errorRate: Number(provider.errorRate || provider.error_rate || 0),
              status: (providerStatus === 'degraded' || providerStatus === 'down' ? providerStatus : 'healthy') as ProviderStats['status'],
            }
          })
        )

        setModels(
          (tokensData.models || []).map((model: Record<string, unknown>) => ({
            model: String(model.name || model.model || 'Unknown'),
            provider: String(model.provider || 'Unknown'),
            requests: Number(model.requestCount || model.requests || 0),
            tokens: Number(model.totalTokens || model.tokens || 0),
            cost: Number(model.totalCost || model.cost || 0),
            avgLatency: Number(model.avgLatency || model.average_latency_ms || 0)
          }))
        )

        setRecentRequests(
          (opsData.recentRequests || []).map((request: Record<string, unknown>, idx: number) => ({
            id: String(request.id || `req-${idx + 1}`),
            timestamp: String(request.timestamp || new Date().toISOString()),
            model: String(request.model || 'Unknown'),
            provider: String(request.provider || 'Unknown'),
            tokens: Number(request.tokens || 0),
            latency: Number(request.latency || request.latency_ms || 0),
            cost: Number(request.cost || 0),
            status: request.status === 'error' ? 'error' : 'success'
          }))
        )

        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data')
      } finally {
        setLoading(false)
        isInitialLoad = false
      }
    }

    fetchData()

    // Refresh every 60 seconds
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('llmOps.loadingData')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400">{t('llmOps.error')}: {error}</p>
        </div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600 dark:text-gray-400">{t('llmOps.noData')}</p>
      </div>
    )
  }

  const renderOverviewTab = (): React.JSX.Element => (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div data-testid="llm-requests-card" className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-2">
            <Zap className="h-5 w-5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {metrics.totalRequests.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">{t('llmOps.totalRequests')}</div>
        </div>

        <div data-testid="llm-tokens-card" className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-2">
            <Brain className="h-5 w-5 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatTokens(metrics.totalTokens)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">{t('llmOps.tokensConsumed')}</div>
        </div>

        <div data-testid="llm-cost-card" className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-5 w-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatCost(metrics.totalCost)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">{t('llmOps.totalCost30Days')}</div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">{t('llmOps.performanceMetrics')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className={`text-2xl font-bold ${latencyColor(metrics.avgLatency)}`}>
              {formatLatency(metrics.avgLatency)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('llmOps.avgLatency')}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {metrics.successRate}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('llmOps.successRate')}</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${errorRateColor(metrics.errorRate)}`}>
              {metrics.errorRate}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('llmOps.errorRate')}</div>
          </div>
        </div>
      </div>

      {/* Provider Stats */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            {t('llmOps.providerStatistics')}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('llmOps.provider')}
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('llmOps.requests')}
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('llmOps.tokens')}
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('llmOps.cost')}
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('llmOps.avgLatency')}
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('llmOps.errorRate')}
                </th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('llmOps.status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {providers.map((provider) => (
                <tr
                  key={provider.name}
                  data-testid={`provider-${provider.name.toLowerCase()}`}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                    {provider.name}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                    {provider.requests.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                    {formatTokens(provider.tokens)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-gray-900 dark:text-gray-100">
                    {formatCost(provider.cost)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-medium ${latencyColor(provider.avgLatency)}`}>
                    {formatLatency(provider.avgLatency)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-medium ${errorRateColor(provider.errorRate)}`}>
                    {provider.errorRate.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={statusBadge(provider.status)}>
                      {provider.status === 'healthy' && <CheckCircle className="h-3 w-3" />}
                      {provider.status === 'degraded' && <Activity className="h-3 w-3" />}
                      {provider.status === 'down' && <AlertTriangle className="h-3 w-3" />}
                      {provider.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderModelsTab = (): React.JSX.Element => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-500" />
            {t('llmOps.modelUsageStatistics')}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {t('llmOps.modelsActive30Days', { count: models.length })}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('llmOps.model')}
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('llmOps.provider')}
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('llmOps.requests')}
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('llmOps.tokens')}
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('llmOps.cost')}
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('llmOps.avgLatency')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {models.map((model) => (
                <tr
                  key={`${model.provider}-${model.model}`}
                  data-testid={`model-${model.model.replace(/\//g, '-')}`}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-900 dark:text-gray-100">
                    {model.model}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                    {model.provider}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                    {model.requests.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                    {formatTokens(model.tokens)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-gray-900 dark:text-gray-100">
                    {formatCost(model.cost)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-medium ${latencyColor(model.avgLatency)}`}>
                    {formatLatency(model.avgLatency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderRequestsTab = (): React.JSX.Element => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{t('llmOps.recentRequests')}</h3>
            <div className="flex gap-2">
              <select
                data-testid="request-status-filter"
                disabled
                title="Request filters will be enabled when backend request history is available"
                className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="">{t('llmOps.allStatus')}</option>
                <option value="success">{t('llmOps.statusSuccess')}</option>
                <option value="error">{t('llmOps.statusError')}</option>
              </select>
              <select
                data-testid="request-provider-filter"
                disabled
                title="Request filters will be enabled when backend request history is available"
                className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="">{t('llmOps.allProviders')}</option>
                <option value="OpenAI">OpenAI</option>
                <option value="Anthropic">Anthropic</option>
                <option value="OpenRouter">OpenRouter</option>
              </select>
            </div>
          </div>
        </div>
        <div data-testid="requests-container" className="divide-y divide-gray-100 dark:divide-gray-800">
          {recentRequests.map((request) => (
            <div
              key={request.id}
              data-testid={`request-${request.id}`}
              className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
                      {request.id}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {request.timestamp}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-sm">
                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                      {request.model}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      via {request.provider}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-right">
                    <div className="text-gray-900 dark:text-gray-100">
                      {formatTokens(request.tokens)} tokens
                    </div>
                    <div className={latencyColor(request.latency)}>
                      {formatLatency(request.latency)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-900 dark:text-gray-100 font-medium">
                      {formatCost(request.cost)}
                    </div>
                  </div>
                  <div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      request.status === 'success'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {request.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderCostsTab = (): React.JSX.Element => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div data-testid="cost-today-card" className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-2">
            <Clock className="h-5 w-5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatCost(41.20)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">{t('llmOps.today')}</div>
        </div>

        <div data-testid="cost-week-card" className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatCost(289.45)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">{t('llmOps.thisWeek')}</div>
        </div>

        <div data-testid="cost-month-card" className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-5 w-5 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatCost(metrics.totalCost)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">{t('llmOps.thisMonth')}</div>
        </div>

        <div data-testid="cost-projected-card" className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-2">
            <BarChart3 className="h-5 w-5 text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatCost(1850.00)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">{t('llmOps.projected30Days')}</div>
        </div>
      </div>

      {/* Cost by Provider */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">{t('llmOps.costBreakdownByProvider')}</h3>
        <div className="space-y-3">
          {providers.map((provider) => {
            const percentageValue = metrics.totalCost > 0 ? (provider.cost / metrics.totalCost) * 100 : 0
            const percentage = percentageValue.toFixed(1)
            return (
              <div key={provider.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700 dark:text-gray-300">{provider.name}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {formatCost(provider.cost)} ({percentage}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full"
                    style={{ width: `${percentageValue}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <DemoBanner />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
        <Link
          href="/monitoring"
          className="hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
        >
          {t('breadcrumbMonitoring')}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-900 dark:text-gray-100 font-medium">{t('llmOps.breadcrumb')}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Brain className="h-7 w-7" />
            {t('llmOps.title')}
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            {t('llmOps.subtitle')}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-6">
        <nav className="flex space-x-8 border-b border-gray-200 dark:border-gray-800">
          {['overview', 'models', 'requests', 'costs'].map((tab) => (
            <button
              key={tab}
              data-testid={`tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
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
        {activeTab === 'models' && renderModelsTab()}
        {activeTab === 'requests' && renderRequestsTab()}
        {activeTab === 'costs' && renderCostsTab()}
      </div>
    </div>
  )
}
