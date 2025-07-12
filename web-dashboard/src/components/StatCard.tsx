import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'

interface StatCardProps {
  title: string
  value: number | string
  change?: string
  trend?: 'up' | 'down'
  subtitle?: string
  icon: LucideIcon
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red'
}

export function StatCard({ 
  title, 
  value, 
  change, 
  trend, 
  subtitle, 
  icon: Icon, 
  color = 'blue' 
}: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600'
  }

  const trendClasses = {
    up: 'text-green-600',
    down: 'text-red-600'
  }

  return (
    <div className="card p-6">
      <div className="flex items-center">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="ml-4 flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <div className="flex items-baseline">
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
            {change && (
              <div className={`ml-2 flex items-center text-sm ${trend ? trendClasses[trend] : 'text-gray-500'}`}>
                {trend && (
                  trend === 'up' ? 
                    <TrendingUp className="h-4 w-4 mr-1" /> : 
                    <TrendingDown className="h-4 w-4 mr-1" />
                )}
                {change}
              </div>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  )
}