/**
 * Cost Breakdown Component
 * Displays AI API cost breakdown by model and provider
 * Includes time period filters and cost trend analysis
 */

'use client'

import { useEffect, useState, useCallback, useMemo, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { DollarSign, TrendingUp, TrendingDown, Download } from 'lucide-react'

interface ModelCostData {
  model: string
  totalCost: number
  requestCount: number
  tokenCount: number
  avgCostPerRequest: number
  avgCostPerToken: number
  costPercentage: number
}

interface ProviderCostData {
  provider: string
  totalCost: number
  requestCount: number
  costPercentage: number
}

interface CostTrend {
  period: string
  cost: number
  change: number
  changePercent: number
}

interface CostData {
  timestamp: string
  period: string
  startDate: string
  endDate: string
  summary: {
    totalCost: number
    totalRequests: number
    totalTokens: number
    avgCostPerRequest: number
    avgCostPerToken: number
    costTrend: 'increasing' | 'stable' | 'decreasing'
    costChange: number
    costChangePercent: number
  }
  byModel: ModelCostData[]
  byProvider: ProviderCostData[]
  trend: CostTrend[]
}

interface CostBreakdownProps {
  period?: '1h' | '6h' | '12h' | '24h' | '7d' | '30d'
  refreshInterval?: number
  className?: string
}

// Color palette for charts
const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // yellow
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
]

// Memoized cost summary metric component
interface CostSummaryProps {
  label: string
  value: string
  subtext?: string
  colorClass: string
  icon?: React.ReactNode
}

const CostSummary = memo(function CostSummary({
  label,
  value,
  subtext,
  colorClass,
  icon
}: CostSummaryProps) {
  return (
    <div className={`p-4 rounded-lg ${colorClass}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-gray-600">{label}</div>
        {icon && <div className="text-gray-500">{icon}</div>}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {subtext && <div className="text-xs text-gray-500 mt-1">{subtext}</div>}
    </div>
  )
})

// Memoized custom pie chart tooltip
const PieTooltip = memo(function PieTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null

  const data = payload[0].payload
  return (
    <div className="bg-white p-3 border rounded-lg shadow-lg">
      <p className="text-sm font-semibold mb-2">{data.name || data.model || data.provider}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Cost:</span>
          <span className="font-medium">${data.totalCost?.toFixed(4) || data.cost?.toFixed(4)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Percentage:</span>
          <span className="font-medium">{data.costPercentage?.toFixed(1)}%</span>
        </div>
        {data.requestCount && (
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-gray-600">Requests:</span>
            <span className="font-medium">{data.requestCount.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  )
})

// Memoized custom bar chart tooltip
const BarTooltip = memo(function BarTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null

  return (
    <div className="bg-white p-3 border rounded-lg shadow-lg">
      <p className="text-sm font-semibold mb-2">{payload[0].payload.model}</p>
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: payload[0].color }}
          />
          <span className="text-gray-600">Total Cost:</span>
          <span className="font-medium">${payload[0].value.toFixed(4)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Requests:</span>
          <span className="font-medium">{payload[0].payload.requestCount.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Avg/Request:</span>
          <span className="font-medium">${payload[0].payload.avgCostPerRequest.toFixed(6)}</span>
        </div>
      </div>
    </div>
  )
})

// Memoized model row component for table
interface ModelRowProps {
  model: string
  totalCost: number
  requestCount: number
  avgCostPerRequest: number
  costPercentage: number
}

const ModelRow = memo(function ModelRow({
  model,
  totalCost,
  requestCount,
  avgCostPerRequest,
  costPercentage
}: ModelRowProps) {
  return (
    <tr className="border-b last:border-b-0 hover:bg-gray-50 transition-colors">
      <td className="py-2 px-3 text-sm font-medium text-gray-900">{model}</td>
      <td className="py-2 px-3 text-sm text-gray-600 text-right">
        ${totalCost.toFixed(4)}
      </td>
      <td className="py-2 px-3 text-sm text-gray-600 text-right">
        {requestCount.toLocaleString()}
      </td>
      <td className="py-2 px-3 text-sm text-gray-600 text-right">
        ${avgCostPerRequest.toFixed(6)}
      </td>
      <td className="py-2 px-3 text-sm text-gray-600 text-right">
        <Badge variant="secondary">{costPercentage.toFixed(1)}%</Badge>
      </td>
    </tr>
  )
})

function CostBreakdownInner({
  period = '24h',
  refreshInterval = 60000,
  className = ''
}: CostBreakdownProps) {
  const [data, setData] = useState<CostData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState(period)

  // Memoized fetch function
  const fetchCostData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ period: selectedPeriod })
      const res = await fetch(`/api/monitoring/ai-metrics?${params.toString()}`)

      if (!res.ok) {
        throw new Error(`API returned ${res.status}: ${res.statusText}`)
      }

      const json = await res.json()
      setData(json)
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cost data')
    } finally {
      setLoading(false)
    }
  }, [selectedPeriod])

  useEffect(() => {
    fetchCostData()
    const interval = setInterval(fetchCostData, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchCostData, refreshInterval])

  // Memoize pie chart data for model breakdown
  const modelPieData = useMemo(() => {
    if (!data?.byModel) return []
    return data.byModel.map((item, index) => ({
      name: item.model,
      value: item.totalCost,
      totalCost: item.totalCost,
      costPercentage: item.costPercentage,
      requestCount: item.requestCount,
      fill: CHART_COLORS[index % CHART_COLORS.length]
    }))
  }, [data])

  // Memoize pie chart data for provider breakdown
  const providerPieData = useMemo(() => {
    if (!data?.byProvider) return []
    return data.byProvider.map((item, index) => ({
      name: item.provider,
      value: item.totalCost,
      totalCost: item.totalCost,
      costPercentage: item.costPercentage,
      requestCount: item.requestCount,
      fill: CHART_COLORS[index % CHART_COLORS.length]
    }))
  }, [data])

  // Memoize bar chart data
  const barChartData = useMemo(() => {
    if (!data?.byModel) return []
    return data.byModel.map(item => ({
      model: item.model,
      totalCost: item.totalCost,
      requestCount: item.requestCount,
      avgCostPerRequest: item.avgCostPerRequest
    }))
  }, [data])

  // Memoize cost formatter
  const formatCost = useCallback((value: number) => {
    return `$${value.toFixed(4)}`
  }, [])

  // Memoize period change handler
  const handlePeriodChange = useCallback((newPeriod: string) => {
    setSelectedPeriod(newPeriod as typeof period)
    setLoading(true)
  }, [])

  // Memoize export handler
  const handleExport = useCallback(() => {
    const params = new URLSearchParams({
      format: 'csv',
      period: selectedPeriod
    })
    const url = `/api/monitoring/ai-metrics/export?${params.toString()}`

    // Create a temporary anchor element to trigger download
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-cost-report-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [selectedPeriod])

  // Memoize tooltip style
  const tooltipStyle = useMemo(() => ({
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid #e5e7eb',
    borderRadius: '8px'
  }), [])

  // Get trend icon
  const getTrendIcon = () => {
    if (!data?.summary) return null
    const trend = data.summary.costTrend
    if (trend === 'increasing') {
      return <TrendingUp className="h-4 w-4 text-red-500" />
    } else if (trend === 'decreasing') {
      return <TrendingDown className="h-4 w-4 text-green-500" />
    }
    return null
  }

  // Get trend color
  const getTrendColor = () => {
    if (!data?.summary) return 'text-gray-600'
    const trend = data.summary.costTrend
    if (trend === 'increasing') return 'text-red-600'
    if (trend === 'decreasing') return 'text-green-600'
    return 'text-blue-600'
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Cost Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="h-24 bg-gray-200 rounded"></div>
              <div className="h-24 bg-gray-200 rounded"></div>
              <div className="h-24 bg-gray-200 rounded"></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={`${className} border-red-300`}>
        <CardHeader>
          <CardTitle className="text-red-700">Cost Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-red-700">
            <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-semibold">Error Loading Cost Data</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={fetchCostData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </CardContent>
      </Card>
    )
  }

  if (!data?.summary) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Cost Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <DollarSign className="mx-auto h-12 w-12 mb-3" />
            <p className="text-sm">No cost data available for the selected period</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Cost Breakdown</CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={selectedPeriod}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="px-3 py-1 rounded-md text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1h">Last Hour</option>
              <option value="6h">Last 6 Hours</option>
              <option value="12h">Last 12 Hours</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
            <Button
              onClick={handleExport}
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CostSummary
            label="Total Cost"
            value={formatCost(data.summary.totalCost)}
            subtext={`${data.summary.totalRequests.toLocaleString()} requests`}
            colorClass="bg-gradient-to-br from-blue-50 to-blue-100 text-blue-900"
            icon={<DollarSign className="h-5 w-5" />}
          />
          <CostSummary
            label="Avg Cost/Request"
            value={formatCost(data.summary.avgCostPerRequest)}
            subtext={`${data.summary.totalTokens.toLocaleString()} total tokens`}
            colorClass="bg-gradient-to-br from-green-50 to-green-100 text-green-900"
          />
          <CostSummary
            label="Cost Trend"
            value={data.summary.costChangePercent >= 0 ? `+${data.summary.costChangePercent.toFixed(1)}%` : `${data.summary.costChangePercent.toFixed(1)}%`}
            subtext={`${data.summary.costTrend} compared to previous period`}
            colorClass={`bg-gradient-to-br ${
              data.summary.costTrend === 'increasing'
                ? 'from-red-50 to-red-100 text-red-900'
                : data.summary.costTrend === 'decreasing'
                ? 'from-green-50 to-green-100 text-green-900'
                : 'from-gray-50 to-gray-100 text-gray-900'
            }`}
            icon={getTrendIcon()}
          />
        </div>

        {/* Pie Charts: Cost by Model and Provider */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cost by Model Pie Chart */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Cost Distribution by Model</h4>
            {modelPieData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={modelPieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry: any) =>
                        entry.costPercentage > 5 ? `${entry.name} (${entry.costPercentage.toFixed(1)}%)` : ''
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {modelPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} content={<PieTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
                No model cost data available
              </div>
            )}
          </div>

          {/* Cost by Provider Pie Chart */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Cost Distribution by Provider</h4>
            {providerPieData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={providerPieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry: any) =>
                        entry.costPercentage > 5 ? `${entry.name} (${entry.costPercentage.toFixed(1)}%)` : ''
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {providerPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} content={<PieTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
                No provider cost data available
              </div>
            )}
          </div>
        </div>

        {/* Bar Chart: Cost Comparison by Model */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Cost Comparison by Model</h4>
          {barChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="model"
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    label={{ value: 'Cost ($)', angle: -90, position: 'insideLeft' }}
                    tickFormatter={(value) => `$${value.toFixed(3)}`}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    content={<BarTooltip />}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="totalCost"
                    name="Total Cost"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
              No model comparison data available
            </div>
          )}
        </div>

        {/* Detailed Model Breakdown Table */}
        {data.byModel && data.byModel.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Detailed Breakdown by Model</h4>
            <div className="overflow-hidden border rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Model
                    </th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Total Cost
                    </th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Requests
                    </th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Avg/Request
                    </th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      % of Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.byModel.map((modelData) => (
                    <ModelRow
                      key={modelData.model}
                      model={modelData.model}
                      totalCost={modelData.totalCost}
                      requestCount={modelData.requestCount}
                      avgCostPerRequest={modelData.avgCostPerRequest}
                      costPercentage={modelData.costPercentage}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {lastUpdate && (
          <div className="text-xs text-gray-500 text-right">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export const CostBreakdown = memo(CostBreakdownInner)
