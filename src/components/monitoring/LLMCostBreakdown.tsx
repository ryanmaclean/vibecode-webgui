/**
 * LLM Cost Breakdown Component
 * Displays detailed cost analytics for LLM operations including per-model, per-provider, and token-based cost breakdowns
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
  Cell,
  AreaChart,
  Area
} from 'recharts'

interface TokenCost {
  inputTokens: number
  outputTokens: number
  inputCost: number
  outputCost: number
  totalCost: number
}

interface ModelCostMetrics {
  name: string
  totalCost: number
  requestCount: number
  costPerRequest: number
  tokenCost: TokenCost
  costTrend: number // percentage change from previous period
}

interface ProviderCostMetrics {
  name: string
  totalCost: number
  costPercentage: number
  models: string[]
  requestCount: number
}

interface TimeSeriesCostPoint {
  timestamp: string
  totalCost: number
  inputCost: number
  outputCost: number
  requestCount: number
}

interface CostBudgetAlert {
  severity: 'info' | 'warning' | 'critical'
  message: string
  threshold: number
  current: number
}

interface LLMCostData {
  timestamp: string
  timeRange: string
  totalCost: number
  totalInputCost: number
  totalOutputCost: number
  totalRequests: number
  avgCostPerRequest: number
  models: ModelCostMetrics[]
  providers: ProviderCostMetrics[]
  timeSeries: TimeSeriesCostPoint[]
  budgetAlerts: CostBudgetAlert[]
  projectedMonthlyCost: number
  budgetUtilization: number
}

interface LLMCostBreakdownProps {
  refreshInterval?: number
  className?: string
}

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899']

const SEVERITY_COLORS = {
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  critical: 'bg-red-100 text-red-800 border-red-200'
}

const SEVERITY_ICONS = {
  info: (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
  ),
  warning: (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  ),
  critical: (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
  )
}

// Memoized model cost item component
interface ModelCostItemProps {
  model: ModelCostMetrics
}

const ModelCostItem = memo(function ModelCostItem({ model }: ModelCostItemProps) {
  const trendColor = model.costTrend > 0 ? 'text-red-600' : model.costTrend < 0 ? 'text-green-600' : 'text-gray-600'
  const trendIcon = model.costTrend > 0 ? '↑' : model.costTrend < 0 ? '↓' : '→'

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex-1">
        <div className="font-medium text-gray-900">{model.name}</div>
        <div className="text-xs text-gray-500 mt-1">
          {model.requestCount.toLocaleString()} requests • ${model.costPerRequest.toFixed(4)} per request
        </div>
      </div>
      <div className="flex gap-4 text-right">
        <div>
          <div className="text-xs text-gray-500">Input Cost</div>
          <div className="text-sm font-semibold text-gray-900">
            ${model.tokenCost.inputCost.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Output Cost</div>
          <div className="text-sm font-semibold text-gray-900">
            ${model.tokenCost.outputCost.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Total Cost</div>
          <div className="text-lg font-bold text-gray-900">
            ${model.totalCost.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Trend</div>
          <div className={`text-sm font-semibold ${trendColor}`}>
            {trendIcon} {Math.abs(model.costTrend).toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  )
})

// Memoized provider cost item component
interface ProviderCostItemProps {
  provider: ProviderCostMetrics
  colorIndex: number
}

const ProviderCostItem = memo(function ProviderCostItem({ provider, colorIndex }: ProviderCostItemProps) {
  const dotStyle = useMemo(() => ({
    backgroundColor: COLORS[colorIndex % COLORS.length]
  }), [colorIndex])

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center flex-1">
        <div className="w-3 h-3 rounded-full mr-3" style={dotStyle}></div>
        <div>
          <div className="font-medium text-gray-900 capitalize">{provider.name}</div>
          <div className="text-xs text-gray-500">
            {provider.models.length} {provider.models.length === 1 ? 'model' : 'models'} • {provider.requestCount.toLocaleString()} requests
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-bold text-gray-900">${provider.totalCost.toFixed(2)}</div>
        <div className="text-xs text-gray-500">{provider.costPercentage.toFixed(1)}% of total</div>
      </div>
    </div>
  )
})

// Memoized budget alert component
interface BudgetAlertItemProps {
  alert: CostBudgetAlert
}

const BudgetAlertItem = memo(function BudgetAlertItem({ alert }: BudgetAlertItemProps) {
  const alertClass = SEVERITY_COLORS[alert.severity]
  const alertIcon = SEVERITY_ICONS[alert.severity]

  return (
    <div className={`flex items-start p-3 rounded-lg border ${alertClass}`}>
      <div className="mr-2 mt-0.5">{alertIcon}</div>
      <div className="flex-1">
        <div className="text-sm font-medium">{alert.message}</div>
        <div className="text-xs mt-1 opacity-75">
          Current: ${alert.current.toFixed(2)} / Threshold: ${alert.threshold.toFixed(2)}
        </div>
      </div>
    </div>
  )
})

// Memoized cost summary card component
interface CostSummaryCardProps {
  label: string
  value: string
  subtext?: string
  colorClass: string
}

const CostSummaryCard = memo(function CostSummaryCard({ label, value, subtext, colorClass }: CostSummaryCardProps) {
  return (
    <div className={`text-center p-3 rounded-lg ${colorClass}`}>
      <div className="text-xs mb-1 opacity-75">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {subtext && <div className="text-xs mt-1 opacity-75">{subtext}</div>}
    </div>
  )
})

function LLMCostBreakdownInner({
  refreshInterval = 60000,
  className = ''
}: LLMCostBreakdownProps) {
  const [data, setData] = useState<LLMCostData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Memoized fetch function to prevent recreation on every render
  const fetchCostData = useCallback(async () => {
    try {
      const res = await fetch('/api/monitoring/llm-costs')

      if (!res.ok) {
        throw new Error(`API returned ${res.status}: ${res.statusText}`)
      }

      const json = await res.json()
      setData(json)
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch LLM cost data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCostData()
    const interval = setInterval(fetchCostData, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchCostData, refreshInterval])

  // All hooks must be called before any early returns (React Rules of Hooks)
  // Memoize chart data transformations to prevent recalculation on every render
  const costTimeSeriesData = useMemo(() => {
    if (!data) return []
    return data.timeSeries.map(point => ({
      time: new Date(point.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      total: point.totalCost,
      input: point.inputCost,
      output: point.outputCost
    }))
  }, [data])

  const modelCostChartData = useMemo(() => {
    if (!data) return []
    return data.models.slice(0, 8).map(model => ({
      name: model.name.replace(/^(gpt-|claude-|llama-)/, ''),
      cost: model.totalCost,
      inputCost: model.tokenCost.inputCost,
      outputCost: model.tokenCost.outputCost
    }))
  }, [data])

  const providerPieData = useMemo(() => {
    if (!data) return []
    return data.providers.map(provider => ({
      name: provider.name,
      value: provider.totalCost,
      percentage: provider.costPercentage
    }))
  }, [data])

  // Memoize tooltip formatter to prevent recreation on every render
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltipFormatter = useCallback((value: any) => {
    if (typeof value === 'number') return `$${value.toFixed(2)}`
    return String(value)
  }, [])

  // Memoize tooltip style object to prevent object recreation
  const tooltipStyle = useMemo(() => ({
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid #ccc',
    borderRadius: '4px'
  }), [])

  // Memoize budget utilization color
  const budgetUtilizationColor = useMemo(() => {
    if (!data) return 'bg-gray-200'
    if (data.budgetUtilization >= 90) return 'bg-red-500'
    if (data.budgetUtilization >= 75) return 'bg-yellow-500'
    return 'bg-green-500'
  }, [data])

  // Early returns after all hooks have been called
  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 border ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
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
          <h3 className="font-semibold">Error Loading Cost Data</h3>
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
          <h3 className="text-lg font-semibold text-gray-900">LLM Cost Breakdown</h3>
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
            {data.timeRange}
          </div>
        </div>

        {/* Budget Alerts */}
        {data.budgetAlerts.length > 0 && (
          <div className="mb-6 space-y-2">
            {data.budgetAlerts.map((alert, index) => (
              <BudgetAlertItem key={index} alert={alert} />
            ))}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <CostSummaryCard
            label="Total Cost"
            value={`$${data.totalCost.toFixed(2)}`}
            colorClass="bg-gradient-to-br from-purple-50 to-purple-100 text-purple-900"
          />
          <CostSummaryCard
            label="Avg Cost/Request"
            value={`$${data.avgCostPerRequest.toFixed(4)}`}
            subtext={`${data.totalRequests.toLocaleString()} requests`}
            colorClass="bg-gradient-to-br from-blue-50 to-blue-100 text-blue-900"
          />
          <CostSummaryCard
            label="Projected Monthly"
            value={`$${data.projectedMonthlyCost.toFixed(2)}`}
            colorClass="bg-gradient-to-br from-orange-50 to-orange-100 text-orange-900"
          />
          <CostSummaryCard
            label="Budget Utilization"
            value={`${data.budgetUtilization.toFixed(1)}%`}
            colorClass={data.budgetUtilization >= 90 ? "bg-gradient-to-br from-red-50 to-red-100 text-red-900" : data.budgetUtilization >= 75 ? "bg-gradient-to-br from-yellow-50 to-yellow-100 text-yellow-900" : "bg-gradient-to-br from-green-50 to-green-100 text-green-900"}
          />
        </div>

        {/* Budget Utilization Bar */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-700">Budget Status</h4>
            <span className="text-sm text-gray-600">{data.budgetUtilization.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${budgetUtilizationColor}`}
              style={{ width: `${Math.min(data.budgetUtilization, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Token Cost Breakdown */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Token Cost Distribution</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">Input Tokens</div>
              <div className="text-lg font-semibold text-gray-900">${data.totalInputCost.toFixed(2)}</div>
              <div className="text-xs text-gray-600 mt-1">
                {data.totalCost > 0 ? ((data.totalInputCost / data.totalCost) * 100).toFixed(1) : '0.0'}% of total
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Output Tokens</div>
              <div className="text-lg font-semibold text-gray-900">${data.totalOutputCost.toFixed(2)}</div>
              <div className="text-xs text-gray-600 mt-1">
                {data.totalCost > 0 ? ((data.totalOutputCost / data.totalCost) * 100).toFixed(1) : '0.0'}% of total
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Total</div>
              <div className="text-lg font-semibold text-gray-900">${data.totalCost.toFixed(2)}</div>
              <div className="text-xs text-gray-600 mt-1">
                {data.totalRequests.toLocaleString()} requests
              </div>
            </div>
          </div>
        </div>

        {/* Cost Over Time Chart */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Cost Trend</h4>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={costTimeSeriesData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="colorInput" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
                  </linearGradient>
                  <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
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
                  label={{ value: 'Cost ($)', angle: -90, position: 'insideLeft' }}
                  tickFormatter={(value) => `$${value.toFixed(2)}`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={tooltipFormatter}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="input"
                  stackId="1"
                  stroke="#3b82f6"
                  fill="url(#colorInput)"
                  name="Input Cost"
                />
                <Area
                  type="monotone"
                  dataKey="output"
                  stackId="1"
                  stroke="#10b981"
                  fill="url(#colorOutput)"
                  name="Output Cost"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Model Cost Breakdown Chart */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Cost by Model</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modelCostChartData}>
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
                  label={{ value: 'Cost ($)', angle: -90, position: 'insideLeft' }}
                  tickFormatter={(value) => `$${value.toFixed(2)}`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={tooltipFormatter}
                />
                <Legend />
                <Bar dataKey="inputCost" stackId="a" fill="#3b82f6" name="Input Cost" />
                <Bar dataKey="outputCost" stackId="a" fill="#10b981" name="Output Cost" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Provider Cost Distribution */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Cost by Provider</h4>
          <div className="flex items-center gap-6">
            <div className="w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={providerPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={(entry) => `${((entry.percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {providerPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={tooltipFormatter}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-3">
              {data.providers.map((provider, index) => (
                <ProviderCostItem
                  key={provider.name}
                  provider={provider}
                  colorIndex={index}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Model Cost Details */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Model Cost Details</h4>
          <div className="space-y-3">
            {data.models.map((model) => (
              <ModelCostItem key={model.name} model={model} />
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
export const LLMCostBreakdown = memo(LLMCostBreakdownInner)
