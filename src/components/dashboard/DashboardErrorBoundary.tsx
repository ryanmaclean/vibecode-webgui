/**
 * Dashboard Error Boundary Component
 * Specialized error boundary for dashboard widgets with graceful degradation
 *
 * Features:
 * - Widget-specific fallback UI
 * - Stale data display with warning
 * - Retry functionality
 * - Error logging to monitoring system
 */

'use client'

import React, { Component, ErrorInfo, ReactNode, memo, useMemo } from 'react'
import { trackError } from '@/lib/monitoring/error-tracking'

// ============================================================================
// Types
// ============================================================================

export type WidgetType = 'performance' | 'health' | 'usage' | 'generic'

export interface DashboardErrorBoundaryProps {
  children: ReactNode
  /** Type of widget for specialized fallback UI */
  widgetType?: WidgetType
  /** Widget title for error display */
  widgetTitle?: string
  /** Optional stale data to display when error occurs */
  staleData?: unknown
  /** Callback when error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  /** Custom class name for the container */
  className?: string
  /** Enable automatic retry with exponential backoff */
  enableAutoRetry?: boolean
  /** Maximum auto retry attempts */
  maxRetries?: number
  /** Retry delay in milliseconds */
  retryDelay?: number
}

export interface DashboardErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  retryCount: number
  isRetrying: boolean
}

// ============================================================================
// Widget Type Configurations
// ============================================================================

const widgetConfig: Record<WidgetType, {
  icon: React.FC<{ className?: string }>
  defaultTitle: string
  color: string
  bgColor: string
  borderColor: string
  buttonColor: string
  placeholderMetrics: { label: string; value: string }[]
}> = {
  performance: {
    icon: PerformanceIcon,
    defaultTitle: 'Performance Trends',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    buttonColor: 'bg-blue-600 hover:bg-blue-700',
    placeholderMetrics: [
      { label: 'Average', value: '-- ms' },
      { label: 'P95 Latency', value: '-- ms' },
      { label: 'Max (P99)', value: '-- ms' }
    ]
  },
  health: {
    icon: HealthIcon,
    defaultTitle: 'System Health',
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    buttonColor: 'bg-green-600 hover:bg-green-700',
    placeholderMetrics: [
      { label: 'Database', value: 'Unknown' },
      { label: 'Cache', value: 'Unknown' },
      { label: 'AI Services', value: 'Unknown' }
    ]
  },
  usage: {
    icon: UsageIcon,
    defaultTitle: 'AI Usage & Costs',
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
    buttonColor: 'bg-purple-600 hover:bg-purple-700',
    placeholderMetrics: [
      { label: 'Total Requests', value: '-- ' },
      { label: 'Total Tokens', value: '-- K' },
      { label: 'Estimated Cost', value: '$--' }
    ]
  },
  generic: {
    icon: GenericIcon,
    defaultTitle: 'Widget',
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-50 dark:bg-gray-900/20',
    borderColor: 'border-gray-200 dark:border-gray-700',
    buttonColor: 'bg-gray-600 hover:bg-gray-700',
    placeholderMetrics: [
      { label: 'Status', value: 'Unavailable' }
    ]
  }
}

// ============================================================================
// Icons
// ============================================================================

function PerformanceIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function HealthIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

function UsageIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}

function GenericIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  )
}

function WarningIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  )
}

function RefreshIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

// ============================================================================
// Widget Fallback UI Component
// ============================================================================

interface WidgetFallbackProps {
  widgetType: WidgetType
  widgetTitle?: string
  error: Error | null
  staleData?: unknown
  onRetry: () => void
  retryCount: number
  isRetrying: boolean
  className?: string
}

const WidgetFallback = memo(function WidgetFallback({
  widgetType,
  widgetTitle,
  error,
  staleData,
  onRetry,
  retryCount,
  isRetrying,
  className = ''
}: WidgetFallbackProps) {
  const config = widgetConfig[widgetType]
  const title = widgetTitle || config.defaultTitle
  const Icon = config.icon

  // Show stale data with warning if available
  if (staleData) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow border ${className}`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${config.color}`} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200">
                <WarningIcon className="h-3 w-3 mr-1" />
                Stale Data
              </span>
              <button
                onClick={onRetry}
                disabled={isRetrying}
                className={`inline-flex items-center px-2 py-1 text-xs font-medium text-white rounded ${config.buttonColor} disabled:opacity-50 transition-colors`}
                aria-label="Retry loading widget"
              >
                <RefreshIcon className={`h-3 w-3 mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
                {isRetrying ? 'Retrying...' : 'Retry'}
              </button>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Showing cached data. Live updates unavailable.
            </p>
          </div>

          {/* Render stale data placeholder - in real implementation, this would render the actual stale data */}
          <div className="text-gray-500 dark:text-gray-400 text-sm">
            Last known data displayed below
          </div>
        </div>
      </div>
    )
  }

  // Show placeholder metrics when no stale data
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow border ${config.borderColor} ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${config.color}`} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          </div>
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200">
            Error
          </span>
        </div>

        <div className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4 mb-4`}>
          <div className="flex items-start gap-3">
            <WarningIcon className={`h-5 w-5 ${config.color} flex-shrink-0 mt-0.5`} />
            <div>
              <p className={`text-sm font-medium ${config.color}`}>
                Unable to load widget data
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {error?.message || 'An unexpected error occurred'}
              </p>
            </div>
          </div>
        </div>

        {/* Placeholder metrics */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {config.placeholderMetrics.map((metric) => (
            <div key={metric.label} className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{metric.label}</div>
              <div className="text-lg font-semibold text-gray-400 dark:text-gray-500">{metric.value}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {retryCount > 0 ? `Retry attempts: ${retryCount}` : 'Click retry to reload'}
          </span>
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className={`inline-flex items-center px-3 py-1.5 text-sm font-medium text-white rounded-md ${config.buttonColor} disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors`}
            aria-label="Retry loading widget"
          >
            <RefreshIcon className={`h-4 w-4 mr-1.5 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : 'Retry'}
          </button>
        </div>

        {process.env.NODE_ENV === 'development' && error && (
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
              Error Details (Development Only)
            </summary>
            <pre className="mt-2 text-xs text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 p-3 rounded overflow-auto max-h-32">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
})

// ============================================================================
// Dashboard Error Boundary Class Component
// ============================================================================

/**
 * Specialized Error Boundary for Dashboard Widgets
 *
 * Provides graceful degradation with:
 * - Widget-specific placeholder UI
 * - Stale data display when available
 * - Retry functionality with visual feedback
 * - Error logging to monitoring system
 */
export class DashboardErrorBoundary extends Component<DashboardErrorBoundaryProps, DashboardErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null

  constructor(props: DashboardErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRetrying: false
    }
  }

  static getDerivedStateFromError(error: Error): Partial<DashboardErrorBoundaryState> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Update state with error info
    this.setState({ errorInfo })

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(
        `DashboardErrorBoundary caught error in ${this.props.widgetTitle || this.props.widgetType || 'widget'}:`,
        error,
        errorInfo
      )
    }

    // Log to monitoring system
    try {
      trackError(error, {
        component: 'DashboardErrorBoundary',
        widget_type: this.props.widgetType,
        widget_title: this.props.widgetTitle,
        error_info: errorInfo.componentStack,
        retry_count: this.state.retryCount
      })
    } catch (trackingError) {
      console.error('Failed to track dashboard error:', trackingError)
    }

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Handle auto-retry if enabled
    const { enableAutoRetry, maxRetries = 3, retryDelay = 2000 } = this.props
    if (enableAutoRetry && this.state.retryCount < maxRetries) {
      const delay = Math.min(retryDelay * Math.pow(2, this.state.retryCount), 30000)
      this.retryTimeoutId = setTimeout(() => {
        this.handleRetry()
      }, delay)
    }
  }

  componentWillUnmount(): void {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }
  }

  handleRetry = (): void => {
    this.setState({ isRetrying: true })

    // Small delay for visual feedback
    setTimeout(() => {
      this.setState((prevState) => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
        isRetrying: false
      }))
    }, 300)
  }

  render(): ReactNode {
    const {
      children,
      widgetType = 'generic',
      widgetTitle,
      staleData,
      className = ''
    } = this.props
    const { hasError, error, retryCount, isRetrying } = this.state

    if (hasError) {
      return (
        <WidgetFallback
          widgetType={widgetType}
          widgetTitle={widgetTitle}
          error={error}
          staleData={staleData}
          onRetry={this.handleRetry}
          retryCount={retryCount}
          isRetrying={isRetrying}
          className={className}
        />
      )
    }

    return children
  }
}

// ============================================================================
// Higher-Order Component for Dashboard Widgets
// ============================================================================

export interface WithDashboardErrorBoundaryOptions {
  widgetType?: WidgetType
  widgetTitle?: string
  enableAutoRetry?: boolean
  maxRetries?: number
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

/**
 * HOC to wrap any widget component with dashboard error boundary
 */
export function withDashboardErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: WithDashboardErrorBoundaryOptions = {}
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Widget'
  const widgetTitle = options.widgetTitle || displayName

  const WithDashboardErrorBoundary = (props: P & { className?: string }) => (
    <DashboardErrorBoundary
      widgetType={options.widgetType || 'generic'}
      widgetTitle={widgetTitle}
      enableAutoRetry={options.enableAutoRetry}
      maxRetries={options.maxRetries}
      onError={options.onError}
      className={props.className}
    >
      <WrappedComponent {...props} />
    </DashboardErrorBoundary>
  )

  WithDashboardErrorBoundary.displayName = `withDashboardErrorBoundary(${displayName})`

  return WithDashboardErrorBoundary
}

// ============================================================================
// Export default
// ============================================================================

export default DashboardErrorBoundary
