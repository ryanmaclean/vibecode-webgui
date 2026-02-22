/**
 * LLM Token Usage Chart Component
 * Displays token consumption metrics with stacked area chart visualization
 * Shows prompt tokens vs completion tokens over time, with per-model breakdown
 *
 * LLM Operations Dashboard feature (Task 012)
 */

'use client'

import { useEffect, useState, useCallback, useMemo, useId, memo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts'

interface TokenDataPoint {
  timestamp: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

interface ModelTokenMetrics {
  name: string
  totalTokens: number
  promptTokens: number
  completionTokens: number
  requestCount: number
  avgTokensPerRequest: number
  tokenDistribution: {
    promptPercentage: number
    completionPercentage: number
  }
}

interface TokenUsageData {
  timestamp: string
  timeRange: string
  totalTokens: number
  totalPromptTokens: number
  totalCompletionTokens: number
  totalRequests: number
  avgTokensPerRequest: number
  models: ModelTokenMetrics[]
  timeSeries: TokenDataPoint[]
  promptToCompletionRatio: number
}

interface LLMTokenUsageChartProps {
  timeRange?: '1h' | '6h' | '24h' | '7d'
  refreshInterval?: number
  className?: string
}

// Memoized model token item component
interface ModelTokenItemProps {
  model: ModelTokenMetrics
}

const ModelTokenItem = memo(function ModelTokenItem({ model }: ModelTokenItemProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex-1">
        <div className="font-medium text-gray-900">{model.name}</div>
        <div className="text-xs text-gray-500 mt-1">
          {model.requestCount.toLocaleString()} requests • {model.avgTokensPerRequest.toFixed(0)} tokens avg
        </div>
      </div>
      <div className="flex gap-4 text-right">
        <div>
          <div className="text-xs text-gray-500">Prompt</div>
          <div className="text-sm font-semibold text-blue-900">
            {(model.promptTokens / 1000).toFixed(1)}K
          </div>
          <div className="text-xs text-gray-500">
            {model.tokenDistribution.promptPercentage.toFixed(0)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Completion</div>
          <div className="text-sm font-semibold text-green-900">
            {(model.completionTokens / 1000).toFixed(1)}K
          </div>
          <div className="text-xs text-gray-500">
            {model.tokenDistribution.completionPercentage.toFixed(0)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Total</div>
          <div className="text-lg font-bold text-gray-900">
            {(model.totalTokens / 1000).toFixed(1)}K
          </div>
        </div>
      </div>
    </div>
  )
})

// Memoized summary card component
interface TokenSummaryCardProps {
  label: string
  value: string
  subtext?: string
  colorClass: string
}

const TokenSummaryCard = memo(function TokenSummaryCard({ label, value, subtext, colorClass }: TokenSummaryCardProps) {
  return (
    <div className={`text-center p-3 rounded-lg ${colorClass}`}>
      <div className="text-xs mb-1 opacity-75">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {subtext && <div className="text-xs mt-1 opacity-75">{subtext}</div>}
    </div>
  )
})

function LLMTokenUsageChartInner({
  timeRange = '1h',
  refreshInterval = 60000,
  className = ''
}: LLMTokenUsageChartProps) {
  const gradientIdPrefix = useId().replace(/:/g, '-')
  const promptGradientId = `${gradientIdPrefix}-colorPrompt`
  const completionGradientId = `${gradientIdPrefix}-colorCompletion`
  const [data, setData] = useState<TokenUsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Memoized fetch function to prevent recreation on every render
  const fetchTokenData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ timeframe: timeRange })
      const res = await fetch(`/api/monitoring/llm-tokens?${params.toString()}`)

      if (!res.ok) {
        throw new Error(`API returned ${res.status}: ${res.statusText}`)
      }

      const json = await res.json()
      setData(json)
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch token usage data')
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  useEffect(() => {
    fetchTokenData()
    const interval = setInterval(fetchTokenData, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchTokenData, refreshInterval])

  // All hooks must be called before any early returns (React Rules of Hooks)
  // Memoize chart data transformations to prevent recalculation on every render
  const timeSeriesChartData = useMemo(() => {
    if (!data) return []
    return data.timeSeries.map(point => ({
      time: new Date(point.timestamp).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      }),
      prompt: point.promptTokens,
      completion: point.completionTokens,
      total: point.totalTokens
    }))
  }, [data])

  const modelTokenChartData = useMemo(() => {
    if (!data) return []
    return data.models.slice(0, 8).map(model => ({
      name: model.name.replace(/^(gpt-|claude-|llama-)/, ''),
      prompt: model.promptTokens,
      completion: model.completionTokens,
      total: model.totalTokens
    }))
  }, [data])

  // Memoize tooltip formatter to prevent recreation on every render
  const tooltipFormatter = useCallback((value: string | number | (string | number)[]) => {
    if (typeof value === 'number') return `${(value / 1000).toFixed(2)}K`
    return String(value)
  }, [])

  // Memoize tooltip style object to prevent object recreation
  const tooltipStyle = useMemo(() => ({
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid #ccc',
    borderRadius: '4px'
  }), [])

  // Early returns after all hooks have been called
  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 border ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-48 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 border border-red-300 ${className}`}>
        <div className="flex items-center text-red-700 mb-2">
          <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <h3 className="font-semibold">Error Loading Token Usage Data</h3>
        </div>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className={`bg-white rounded-lg shadow border ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">LLM Token Usage</h3>
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            {timeRange}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <TokenSummaryCard
            label="Total Tokens"
            value={`${(data.totalTokens / 1000).toFixed(1)}K`}
            subtext={`${data.totalRequests.toLocaleString()} requests`}
            colorClass="bg-gradient-to-br from-purple-50 to-purple-100 text-purple-900"
          />
          <TokenSummaryCard
            label="Prompt Tokens"
            value={`${(data.totalPromptTokens / 1000).toFixed(1)}K`}
            subtext={data.totalTokens > 0 ? `${((data.totalPromptTokens / data.totalTokens) * 100).toFixed(0)}% of total` : '0% of total'}
            colorClass="bg-gradient-to-br from-blue-50 to-blue-100 text-blue-900"
          />
          <TokenSummaryCard
            label="Completion Tokens"
            value={`${(data.totalCompletionTokens / 1000).toFixed(1)}K`}
            subtext={data.totalTokens > 0 ? `${((data.totalCompletionTokens / data.totalTokens) * 100).toFixed(0)}% of total` : '0% of total'}
            colorClass="bg-gradient-to-br from-green-50 to-green-100 text-green-900"
          />
          <TokenSummaryCard
            label="Avg per Request"
            value={`${data.avgTokensPerRequest.toFixed(0)}`}
            subtext={`${data.promptToCompletionRatio.toFixed(2)}:1 ratio`}
            colorClass="bg-gradient-to-br from-orange-50 to-orange-100 text-orange-900"
          />
        </div>

        {/* Token Distribution Visualization */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Token Distribution</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">Prompt Tokens</div>
              <div className="text-lg font-semibold text-blue-900">
                {(data.totalPromptTokens / 1000).toFixed(1)}K
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {data.totalTokens > 0 ? ((data.totalPromptTokens / data.totalTokens) * 100).toFixed(1) : '0.0'}% of total
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Completion Tokens</div>
              <div className="text-lg font-semibold text-green-900">
                {(data.totalCompletionTokens / 1000).toFixed(1)}K
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {data.totalTokens > 0 ? ((data.totalCompletionTokens / data.totalTokens) * 100).toFixed(1) : '0.0'}% of total
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Total Tokens</div>
              <div className="text-lg font-semibold text-gray-900">
                {(data.totalTokens / 1000).toFixed(1)}K
              </div>
              <div className="text-xs text-gray-600 mt-1">
                P:C Ratio {data.promptToCompletionRatio.toFixed(2)}:1
              </div>
            </div>
          </div>
        </div>

        {/* Token Usage Over Time Chart */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Token Usage Over Time</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeriesChartData}>
                <defs>
                  <linearGradient id={promptGradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id={completionGradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Tokens', angle: -90, position: 'insideLeft' }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={tooltipFormatter}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="prompt"
                  stackId="1"
                  stroke="#3b82f6"
                  fill={`url(#${promptGradientId})`}
                  name="Prompt Tokens"
                />
                <Area
                  type="monotone"
                  dataKey="completion"
                  stackId="1"
                  stroke="#10b981"
                  fill={`url(#${completionGradientId})`}
                  name="Completion Tokens"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Token Usage by Model Chart */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Tokens by Model</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modelTokenChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Tokens', angle: -90, position: 'insideLeft' }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={tooltipFormatter}
                />
                <Legend />
                <Bar dataKey="prompt" stackId="a" fill="#3b82f6" name="Prompt Tokens" />
                <Bar dataKey="completion" stackId="a" fill="#10b981" name="Completion Tokens" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Model Token Details */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Model Token Details</h4>
          <div className="space-y-3">
            {data.models.map((model) => (
              <ModelTokenItem key={model.name} model={model} />
            ))}
          </div>
        </div>

        {lastUpdate && (
          <div className="mt-4 text-xs text-gray-500 text-right">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  )
}

// Export the memoized component
export const LLMTokenUsageChart = memo(LLMTokenUsageChartInner)
