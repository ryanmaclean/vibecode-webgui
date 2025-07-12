import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts'
import { format } from 'date-fns'

interface MetricsData {
  date: string
  requests: number
  tokens: number
  cost: number
}

interface MetricsChartProps {
  data: MetricsData[]
  type?: 'line' | 'area'
  metrics?: ('requests' | 'tokens' | 'cost')[]
}

export function MetricsChart({ 
  data, 
  type = 'area', 
  metrics = ['requests', 'tokens', 'cost'] 
}: MetricsChartProps) {
  const chartData = data.map(item => ({
    ...item,
    formattedDate: format(new Date(item.date), 'MMM dd')
  }))

  const metricConfig = {
    requests: { color: '#3b82f6', name: 'Requests' },
    tokens: { color: '#10b981', name: 'Tokens (K)' },
    cost: { color: '#8b5cf6', name: 'Cost ($)' }
  }

  const formatTooltipValue = (value: number, name: string) => {
    if (name === 'Tokens (K)') {
      return [(value / 1000).toFixed(1) + 'K', name]
    }
    if (name === 'Cost ($)') {
      return ['$' + value.toFixed(2), name]
    }
    return [value.toLocaleString(), name]
  }

  const formatDataValue = (data: any, key: string) => {
    if (key === 'tokens') {
      return data.tokens / 1000 // Convert to thousands
    }
    return data[key]
  }

  if (type === 'area') {
    return (
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="formattedDate" 
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip 
              formatter={formatTooltipValue}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
            {metrics.map((metric) => (
              <Area
                key={metric}
                type="monotone"
                dataKey={(data) => formatDataValue(data, metric)}
                stroke={metricConfig[metric].color}
                fill={metricConfig[metric].color}
                fillOpacity={0.1}
                strokeWidth={2}
                name={metricConfig[metric].name}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="formattedDate" 
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip 
            formatter={formatTooltipValue}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
          {metrics.map((metric) => (
            <Line
              key={metric}
              type="monotone"
              dataKey={(data) => formatDataValue(data, metric)}
              stroke={metricConfig[metric].color}
              strokeWidth={2}
              dot={{ fill: metricConfig[metric].color, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
              name={metricConfig[metric].name}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}