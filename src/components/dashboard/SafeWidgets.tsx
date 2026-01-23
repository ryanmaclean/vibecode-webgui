/**
 * Safe Dashboard Widgets
 *
 * Pre-wrapped dashboard widgets with error boundaries for fault isolation.
 * Use these components to ensure one widget failing doesn't crash the whole dashboard.
 *
 * @example
 * import { SafePerformanceGraphWidget, SafeSystemHealthWidget, SafeAIUsageWidget } from '@/components/dashboard'
 *
 * function Dashboard() {
 *   return (
 *     <div className="grid grid-cols-3 gap-4">
 *       <SafeSystemHealthWidget />
 *       <SafePerformanceGraphWidget />
 *       <SafeAIUsageWidget />
 *     </div>
 *   )
 * }
 */

'use client'

import { ErrorInfo } from 'react'
import { PerformanceGraphWidget } from './PerformanceGraphWidget'
import { SystemHealthWidget } from './SystemHealthWidget'
import { AIUsageWidget } from './AIUsageWidget'
import { withDashboardErrorBoundary } from './DashboardErrorBoundary'
import { trackError } from '@/lib/monitoring/error-tracking'

// ============================================================================
// Error Handler Factory
// ============================================================================

/**
 * Creates a widget-specific error handler that logs to the monitoring system
 */
function createWidgetErrorHandler(widgetName: string) {
  return (error: Error, errorInfo: ErrorInfo) => {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${widgetName}] Error:`, error.message)
      console.error(`[${widgetName}] Component Stack:`, errorInfo.componentStack)
    }

    // Track error for monitoring
    trackError(error, {
      component: widgetName,
      widget_type: widgetName.toLowerCase().replace('widget', ''),
      error_info: errorInfo.componentStack
    })
  }
}

// ============================================================================
// Safe Performance Graph Widget
// ============================================================================

/**
 * Performance Graph Widget wrapped with error boundary
 * Shows performance trends with graceful degradation on error
 */
export const SafePerformanceGraphWidget = withDashboardErrorBoundary(
  PerformanceGraphWidget,
  {
    widgetType: 'performance',
    widgetTitle: 'Performance Trends',
    enableAutoRetry: true,
    maxRetries: 2,
    onError: createWidgetErrorHandler('PerformanceGraphWidget')
  }
)

// ============================================================================
// Safe System Health Widget
// ============================================================================

/**
 * System Health Widget wrapped with error boundary
 * Shows system health status with graceful degradation on error
 */
export const SafeSystemHealthWidget = withDashboardErrorBoundary(
  SystemHealthWidget,
  {
    widgetType: 'health',
    widgetTitle: 'System Health',
    enableAutoRetry: true,
    maxRetries: 2,
    onError: createWidgetErrorHandler('SystemHealthWidget')
  }
)

// ============================================================================
// Safe AI Usage Widget
// ============================================================================

/**
 * AI Usage Widget wrapped with error boundary
 * Shows AI usage and costs with graceful degradation on error
 */
export const SafeAIUsageWidget = withDashboardErrorBoundary(
  AIUsageWidget,
  {
    widgetType: 'usage',
    widgetTitle: 'AI Usage & Costs',
    enableAutoRetry: true,
    maxRetries: 2,
    onError: createWidgetErrorHandler('AIUsageWidget')
  }
)
