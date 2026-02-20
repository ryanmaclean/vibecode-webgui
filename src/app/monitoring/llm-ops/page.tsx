/**
 * LLM Operations Dashboard Page
 * Provides comprehensive monitoring for LLM usage, costs, and performance
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
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

// ── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_METRICS: LLMMetrics = {
  totalRequests: 45280,
  totalTokens: 12458900,
  totalCost: 1247.35,
  avgLatency: 1850,
  successRate: 98.7,
  errorRate: 1.3,
}

const MOCK_PROVIDERS: ProviderStats[] = [
  {
    name: 'OpenRouter',
    requests: 28450,
    tokens: 7890000,
    cost: 789.50,
    avgLatency: 1650,
    errorRate: 0.8,
    status: 'healthy',
  },
  {
    name: 'OpenAI',
    requests: 12340,
    tokens: 3240000,
    cost: 324.80,
    avgLatency: 1980,
    errorRate: 1.2,
    status: 'healthy',
  },
  {
    name: 'Anthropic',
    requests: 4490,
    tokens: 1328900,
    cost: 133.05,
    avgLatency: 2100,
    errorRate: 0.5,
    status: 'healthy',
  },
]

const MOCK_MODELS: ModelUsage[] = [
  {
    model: 'gpt-4-turbo',
    provider: 'OpenAI',
    requests: 8230,
    tokens: 2156000,
    cost: 215.60,
    avgLatency: 2150,
  },
  {
    model: 'claude-3-sonnet',
    provider: 'Anthropic',
    requests: 4490,
    tokens: 1328900,
    cost: 133.05,
    avgLatency: 2100,
  },
  {
    model: 'gpt-3.5-turbo',
    provider: 'OpenAI',
    requests: 4110,
    tokens: 1084000,
    cost: 54.20,
    avgLatency: 950,
  },
  {
    model: 'anthropic/claude-3-haiku',
    provider: 'OpenRouter',
    requests: 18200,
    tokens: 4890000,
    cost: 489.00,
    avgLatency: 1450,
  },
  {
    model: 'openai/gpt-4o',
    provider: 'OpenRouter',
    requests: 10250,
    tokens: 3000000,
    cost: 300.50,
    avgLatency: 1850,
  },
]

const MOCK_RECENT_REQUESTS: RecentRequest[] = [
  {
    id: 'req-001',
    timestamp: '2024-01-15 10:32:15',
    model: 'gpt-4-turbo',
    provider: 'OpenAI',
    tokens: 2450,
    latency: 2100,
    cost: 0.49,
    status: 'success',
  },
  {
    id: 'req-002',
    timestamp: '2024-01-15 10:31:58',
    model: 'claude-3-sonnet',
    provider: 'Anthropic',
    tokens: 3200,
    latency: 1980,
    cost: 0.64,
    status: 'success',
  },
  {
    id: 'req-003',
    timestamp: '2024-01-15 10:31:42',
    model: 'gpt-3.5-turbo',
    provider: 'OpenAI',
    tokens: 890,
    latency: 850,
    cost: 0.04,
    status: 'success',
  },
  {
    id: 'req-004',
    timestamp: '2024-01-15 10:31:20',
    model: 'openai/gpt-4o',
    provider: 'OpenRouter',
    tokens: 1850,
    latency: 1950,
    cost: 0.37,
    status: 'success',
  },
  {
    id: 'req-005',
    timestamp: '2024-01-15 10:30:55',
    model: 'anthropic/claude-3-haiku',
    provider: 'OpenRouter',
    tokens: 1240,
    latency: 1350,
    cost: 0.25,
    status: 'error',
  },
]

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

export default function LLMOpsPage() {
  const [activeTab, setActiveTab] = useState('overview')

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div data-testid="llm-requests-card" className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-2">
            <Zap className="h-5 w-5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {MOCK_METRICS.totalRequests.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Requests</div>
        </div>

        <div data-testid="llm-tokens-card" className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-2">
            <Brain className="h-5 w-5 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatTokens(MOCK_METRICS.totalTokens)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Tokens Consumed</div>
        </div>

        <div data-testid="llm-cost-card" className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-5 w-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatCost(MOCK_METRICS.totalCost)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Cost (30 days)</div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Performance Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className={`text-2xl font-bold ${latencyColor(MOCK_METRICS.avgLatency)}`}>
              {formatLatency(MOCK_METRICS.avgLatency)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Avg Latency</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {MOCK_METRICS.successRate}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Success Rate</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${errorRateColor(MOCK_METRICS.errorRate)}`}>
              {MOCK_METRICS.errorRate}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Error Rate</div>
          </div>
        </div>
      </div>

      {/* Provider Stats */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            Provider Statistics
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Provider
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Requests
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tokens
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Cost
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Avg Latency
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Error Rate
                </th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {MOCK_PROVIDERS.map((provider) => (
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

  const renderModelsTab = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-500" />
            Model Usage Statistics
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {MOCK_MODELS.length} models active in the last 30 days
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Model
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Provider
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Requests
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tokens
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Cost
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Avg Latency
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {MOCK_MODELS.map((model) => (
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

  const renderRequestsTab = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Recent LLM Requests</h3>
            <div className="flex gap-2">
              <select
                data-testid="request-status-filter"
                className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="">All Status</option>
                <option value="success">Success</option>
                <option value="error">Error</option>
              </select>
              <select
                data-testid="request-provider-filter"
                className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="">All Providers</option>
                <option value="OpenAI">OpenAI</option>
                <option value="Anthropic">Anthropic</option>
                <option value="OpenRouter">OpenRouter</option>
              </select>
            </div>
          </div>
        </div>
        <div data-testid="requests-container" className="divide-y divide-gray-100 dark:divide-gray-800">
          {MOCK_RECENT_REQUESTS.map((request) => (
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

  const renderCostsTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div data-testid="cost-today-card" className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-2">
            <Clock className="h-5 w-5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatCost(41.20)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Today</div>
        </div>

        <div data-testid="cost-week-card" className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatCost(289.45)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">This Week</div>
        </div>

        <div data-testid="cost-month-card" className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-5 w-5 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatCost(MOCK_METRICS.totalCost)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">This Month</div>
        </div>

        <div data-testid="cost-projected-card" className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-2">
            <BarChart3 className="h-5 w-5 text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatCost(1850.00)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Projected (30d)</div>
        </div>
      </div>

      {/* Cost by Provider */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Cost Breakdown by Provider</h3>
        <div className="space-y-3">
          {MOCK_PROVIDERS.map((provider) => {
            const percentage = ((provider.cost / MOCK_METRICS.totalCost) * 100).toFixed(1)
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
                    style={{ width: `${percentage}%` }}
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
          Monitoring
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-900 dark:text-gray-100 font-medium">LLM Operations</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Brain className="h-7 w-7" />
            LLM Operations
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Monitor LLM usage, costs, and performance across all providers
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
