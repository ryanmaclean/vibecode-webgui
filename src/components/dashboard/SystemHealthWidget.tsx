/**
 * System Health Widget Component
 * Displays real-time system health status for database, cache, and AI services
 *
 * Foundation for Enhanced Monitoring Dashboards feature (AGENT 92)
 */

'use client'

import { useEffect, useState, useCallback, useMemo, memo } from 'react'

interface HealthStatus {
  database: 'healthy' | 'warning' | 'error'
  cache: 'healthy' | 'warning' | 'error'
  ai: 'healthy' | 'warning' | 'error'
  overall: 'healthy' | 'warning' | 'error'
}

interface DashboardOverview {
  timestamp: string
  health: HealthStatus
  performance: {
    avgResponseTime: number
    requestsPerMinute: number
  }
  system: {
    uptime: number
    uptimeFormatted: string
    memory: {
      used: number
      total: number
      percentage: number
    }
  }
}

interface SystemHealthWidgetProps {
  refreshInterval?: number // milliseconds, default 30000 (30s)
  className?: string
}

// Memoized icon components to prevent re-renders
const DatabaseIcon = memo(function DatabaseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  )
})

const CacheIcon = memo(function CacheIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
})

const AIIcon = memo(function AIIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  )
})

function SystemHealthWidgetInner({
  refreshInterval = 30000,
  className = ''
}: SystemHealthWidgetProps) {
  const [data, setData] = useState<DashboardOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Memoized fetch function to prevent recreation on every render
  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/overview')

      if (!res.ok) {
        throw new Error(`API returned ${res.status}: ${res.statusText}`)
      }

      const responseData = await res.json()
      setData(responseData)
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initial fetch
    fetchHealth()

    // Set up periodic refresh
    const interval = setInterval(fetchHealth, refreshInterval)

    return () => clearInterval(interval)
  }, [fetchHealth, refreshInterval])

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 border ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
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
          <h3 className="font-semibold">Error Loading Health Status</h3>
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
          <h3 className="text-lg font-semibold text-gray-900">System Health</h3>
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            data.health.overall === 'healthy' ? 'bg-green-100 text-green-800' :
            data.health.overall === 'warning' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            <div className={`h-2 w-2 rounded-full mr-2 ${
              data.health.overall === 'healthy' ? 'bg-green-500' :
              data.health.overall === 'warning' ? 'bg-yellow-500' :
              'bg-red-500'
            }`}></div>
            {data.health.overall === 'healthy' ? 'All Systems Operational' :
             data.health.overall === 'warning' ? 'Degraded Performance' :
             'System Issues Detected'}
          </div>
        </div>

        <div className="space-y-3">
          <HealthItem
            label="Database"
            status={data.health.database}
            icon={<DatabaseIcon />}
          />
          <HealthItem
            label="Cache (Valkey)"
            status={data.health.cache}
            icon={<CacheIcon />}
          />
          <HealthItem
            label="AI Services"
            status={data.health.ai}
            icon={<AIIcon />}
          />
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500 mb-1">Uptime</div>
              <div className="font-semibold text-gray-900">{data.system.uptimeFormatted}</div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Memory Usage</div>
              <div className="font-semibold text-gray-900">{data.system.memory.percentage}%</div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Avg Response</div>
              <div className="font-semibold text-gray-900">{data.performance.avgResponseTime}ms</div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Requests/min</div>
              <div className="font-semibold text-gray-900">{data.performance.requestsPerMinute}</div>
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
export const SystemHealthWidget = memo(SystemHealthWidgetInner)

interface HealthItemProps {
  label: string
  status: 'healthy' | 'warning' | 'error'
  icon: React.ReactNode
}

// Memoized HealthItem to prevent unnecessary re-renders when parent updates
const HealthItem = memo(function HealthItem({ label, status, icon }: HealthItemProps) {
  // Memoize computed style classes based on status
  const { containerClass, iconContainerClass, textClass } = useMemo(() => {
    const isHealthy = status === 'healthy'
    const isWarning = status === 'warning'

    return {
      containerClass: `flex items-center justify-between p-3 rounded-lg border ${
        isHealthy ? 'bg-green-50 border-green-200' :
        isWarning ? 'bg-yellow-50 border-yellow-200' :
        'bg-red-50 border-red-200'
      }`,
      iconContainerClass: `p-2 rounded-lg mr-3 ${
        isHealthy ? 'bg-green-100 text-green-600' :
        isWarning ? 'bg-yellow-100 text-yellow-600' :
        'bg-red-100 text-red-600'
      }`,
      textClass: `text-sm font-semibold ${
        isHealthy ? 'text-green-700' :
        isWarning ? 'text-yellow-700' :
        'text-red-700'
      }`
    }
  }, [status])

  return (
    <div className={containerClass}>
      <div className="flex items-center">
        <div className={iconContainerClass}>
          {icon}
        </div>
        <span className="font-medium text-gray-900">{label}</span>
      </div>
      <div className="flex items-center">
        <span className={textClass}>
          {status === 'healthy' && (
            <span className="flex items-center">
              <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Healthy
            </span>
          )}
          {status === 'warning' && (
            <span className="flex items-center">
              <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Warning
            </span>
          )}
          {status === 'error' && (
            <span className="flex items-center">
              <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              Error
            </span>
          )}
        </span>
      </div>
    </div>
  )
})
