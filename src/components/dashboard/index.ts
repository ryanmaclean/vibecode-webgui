/**
 * Dashboard Components
 *
 * Centralized exports for all dashboard components and utilities.
 * Each widget is wrapped with error boundaries for fault isolation.
 */

// Error Boundary
export {
  DashboardErrorBoundary,
  withDashboardErrorBoundary,
  type DashboardErrorBoundaryProps,
  type WidgetType,
  type WithDashboardErrorBoundaryOptions
} from './DashboardErrorBoundary'

// Widgets
export { PerformanceGraphWidget } from './PerformanceGraphWidget'
export { SystemHealthWidget } from './SystemHealthWidget'
export { AIUsageWidget } from './AIUsageWidget'

// Wrapped widgets with error boundaries
export {
  SafePerformanceGraphWidget,
  SafeSystemHealthWidget,
  SafeAIUsageWidget
} from './SafeWidgets'
