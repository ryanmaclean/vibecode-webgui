/**
 * Metrics Chart Component
 *
 * Visualizes experiment metrics over time using Recharts.
 * Supports line charts, bar charts, and funnel charts.
 */

'use client'

import { memo, useMemo, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts'

interface MetricsChartProps {
  title: string
  description?: string
  data: Array<Record<string, any>>
  type?: 'line' | 'bar' | 'area'
  xKey: string
  yKeys: Array<{
    key: string
    label: string
    color: string
  }>
  showConfidenceInterval?: boolean
}

// Memoized date formatter to avoid recreation
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(date)
}

// Memoized CustomTooltip component
const CustomTooltip = memo(function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null

  return (
    <div className="bg-white p-3 border rounded shadow-lg">
      <p className="text-sm font-medium mb-2">
        {typeof label === 'string' && label.includes('-') ? formatDate(label) : label}
      </p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 text-sm">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">{entry.value.toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
})

function MetricsChartInner({
  title,
  description,
  data,
  type = 'line',
  xKey,
  yKeys,
  showConfidenceInterval = false
}: MetricsChartProps) {
  // Memoize the tick formatter callback
  const tickFormatter = useCallback((value: string | number) =>
    typeof value === 'string' && value.includes('-')
      ? formatDate(value)
      : String(value)
  , [])

  // Memoize the chart rendering to prevent recalculation
  const chartElement = useMemo(() => {
    const commonProps = {
      data,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    }

    switch (type) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 12 }}
              tickFormatter={tickFormatter}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {yKeys.map(({ key, label, color }) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={label}
                stroke={color}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        )

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 12 }}
              tickFormatter={tickFormatter}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {yKeys.map(({ key, label, color }) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                name={label}
                stroke={color}
                fill={color}
                fillOpacity={0.3}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        )

      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 12 }}
              tickFormatter={tickFormatter}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {yKeys.map(({ key, label, color }) => (
              <Bar key={key} dataKey={key} name={label} fill={color} />
            ))}
          </BarChart>
        )

      default:
        return null
    }
  }, [data, type, xKey, yKeys, tickFormatter])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          {chartElement}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export const MetricsChart = memo(MetricsChartInner)

/**
 * Funnel Chart Component
 *
 * Displays conversion funnel visualization
 */
interface FunnelChartProps {
  title: string
  description?: string
  data: Array<{
    stage: string
    control: number
    treatment: number
  }>
}

// Memoized FunnelStage component to avoid re-rendering unchanged stages
const FunnelStage = memo(function FunnelStage({
  stage,
  index,
  prevControl
}: {
  stage: { stage: string; control: number; treatment: number }
  index: number
  prevControl: number | null
}) {
  const maxValue = Math.max(stage.control, stage.treatment)
  const controlWidth = (stage.control / maxValue) * 100
  const treatmentWidth = (stage.treatment / maxValue) * 100
  const dropoff = index > 0 && prevControl !== null
    ? ((prevControl - stage.control) / prevControl) * 100
    : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{stage.stage}</span>
        {index > 0 && (
          <span className="text-xs text-muted-foreground">
            {dropoff.toFixed(1)}% dropoff
          </span>
        )}
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-20 text-xs text-muted-foreground">Control</div>
          <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
            <div
              className="bg-blue-500 h-full flex items-center justify-end pr-2 text-xs text-white font-medium"
              style={{ width: `${controlWidth}%` }}
            >
              {controlWidth > 20 && stage.control.toLocaleString()}
            </div>
          </div>
          {controlWidth <= 20 && (
            <div className="text-xs text-muted-foreground">
              {stage.control.toLocaleString()}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-20 text-xs text-muted-foreground">Treatment</div>
          <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
            <div
              className="bg-green-500 h-full flex items-center justify-end pr-2 text-xs text-white font-medium"
              style={{ width: `${treatmentWidth}%` }}
            >
              {treatmentWidth > 20 && stage.treatment.toLocaleString()}
            </div>
          </div>
          {treatmentWidth <= 20 && (
            <div className="text-xs text-muted-foreground">
              {stage.treatment.toLocaleString()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

function FunnelChartInner({ title, description, data }: FunnelChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((stage, index) => (
            <FunnelStage
              key={stage.stage}
              stage={stage}
              index={index}
              prevControl={index > 0 ? data[index - 1].control : null}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export const FunnelChart = memo(FunnelChartInner)
