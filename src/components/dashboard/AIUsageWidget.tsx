/**
 * AI Usage Widget Component
 * Displays AI model usage, costs, and performance metrics
 *
 * Enhanced Monitoring Dashboards feature (AGENT 97)
 */

'use client'

import { useEffect, useState, useCallback, useMemo, memo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'

interface ProviderUsage {
  requests: number
  tokens: {
    input: number
    output: number
    total: number
  }
  cost: number
  avgLatency: number
}

interface ModelUsage {
  name: string
  requests: number
  tokens: number
  avgLatency: number
  cost: number
}

interface AIUsageData {
  timestamp: string
  timeRange: string
  providers: Record<string, ProviderUsage>
  models: ModelUsage[]
  totalCost: number
  totalTokens: number
  totalRequests: number
  costByProvider: Array<{
    provider: string
    cost: number
    percentage: number
  }>
}

interface AIUsageWidgetProps {
  refreshInterval?: number
  className?: string
}

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444']

// Memoized provider item component to prevent re-renders when sibling items change
interface ProviderItemProps {
  name: string
  provider: ProviderUsage
}

const ProviderItem = memo(function ProviderItem({ name, provider }: ProviderItemProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center">
        <div className="w-3 h-3 rounded-full bg-blue-500 mr-3"></div>
        <div>
          <div className="font-medium text-gray-900 capitalize">{name}</div>
          <div className="text-xs text-gray-500">
            {provider.requests} requests • {provider.avgLatency}ms avg
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-semibold text-gray-900">${provider.cost.toFixed(2)}</div>
        <div className="text-xs text-gray-500">
          {(provider.tokens.total / 1000).toFixed(1)}K tokens
        </div>
      </div>
    </div>
  )
})

// Memoized cost distribution item component
interface CostItemProps {
  provider: string
  percentage: number
  colorIndex: number
}

const CostItem = memo(function CostItem({ provider, percentage, colorIndex }: CostItemProps) {
  // Memoize the style object to prevent recreation
  const dotStyle = useMemo(() => ({
    backgroundColor: COLORS[colorIndex % COLORS.length]
  }), [colorIndex])

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <div
          className="w-3 h-3 rounded-full mr-2"
          style={dotStyle}
        ></div>
        <span className="text-sm text-gray-700 capitalize">{provider}</span>
      </div>
      <span className="text-sm font-semibold text-gray-900">
        {percentage.toFixed(1)}%
      </span>
    </div>
  )
})

function AIUsageWidgetInner({
  refreshInterval = 60000,
  className = ''
}: AIUsageWidgetProps) {
  const [data, setData] = useState<AIUsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Memoized fetch function to prevent recreation on every render
  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/ai-usage')

      if (!res.ok) {
        throw new Error(`API returned ${res.status}: ${res.statusText}`)
      }

      const json = await res.json()
      setData(json)
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch AI usage data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsage()
    const interval = setInterval(fetchUsage, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchUsage, refreshInterval])

  // All hooks must be called before any early returns (React Rules of Hooks)
  // Memoize chart data transformations to prevent recalculation on every render
  const topModelsData = useMemo(() => {
    if (!data) return []
    return data.models.slice(0, 5).map(model => ({
      name: model.name.replace(/^(gpt-|claude-|llama-)/, ''),
      requests: model.requests,
      cost: model.cost
    }))
  }, [data])

  // Memoize pie chart data for cost breakdown (currently unused but available for future use)
  const pieData = useMemo(() => {
    if (!data) return []
    return data.costByProvider.map((item) => ({
      name: item.provider,
      value: item.cost,
      percentage: item.percentage
    }))
  }, [data])

  // Memoize tooltip formatter to prevent recreation on every render
  const tooltipFormatter = useCallback((value: number, name: string) => {
    if (name === 'cost') return `$${value.toFixed(2)}`
    return value
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
            <div className="h-32 bg-gray-200 rounded"></div>
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
          <h3 className="font-semibold">Error Loading AI Usage Data</h3>
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
          <h3 className="text-lg font-semibold text-gray-900">AI Usage & Costs</h3>
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
            {data.timeRange}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
            <div className="text-xs text-blue-600 mb-1">Total Requests</div>
            <div className="text-lg font-semibold text-blue-900">
              {data.totalRequests.toLocaleString()}
            </div>
          </div>
          <div className="text-center p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
            <div className="text-xs text-green-600 mb-1">Total Tokens</div>
            <div className="text-lg font-semibold text-green-900">
              {(data.totalTokens / 1000).toFixed(1)}K
            </div>
          </div>
          <div className="text-center p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
            <div className="text-xs text-purple-600 mb-1">Estimated Cost</div>
            <div className="text-lg font-semibold text-purple-900">
              ${data.totalCost.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Provider Breakdown */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Provider Usage</h4>
          <div className="grid gap-3">
            {Object.entries(data.providers).map(([name, provider]) => (
              <ProviderItem key={name} name={name} provider={provider} />
            ))}
          </div>
        </div>

        {/* Top Models Chart */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Top Models by Usage</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topModelsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={tooltipFormatter as any}
                />
                <Legend />
                <Bar dataKey="requests" fill="#3b82f6" name="Requests" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Cost Distribution</h4>
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              {data.costByProvider.map((item, index) => (
                <CostItem
                  key={item.provider}
                  provider={item.provider}
                  percentage={item.percentage}
                  colorIndex={index}
                />
              ))}
            </div>
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

// Export the memoized widget component
export const AIUsageWidget = memo(AIUsageWidgetInner)
