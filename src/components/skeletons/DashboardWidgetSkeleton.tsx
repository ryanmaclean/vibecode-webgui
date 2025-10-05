/**
 * Dashboard Widget Skeleton
 * Loading state for dashboard cards and widgets
 * WCAG 2.1 AA Compliant
 */

import { Skeleton } from '@/components/ui/skeleton'

export function DashboardWidgetSkeleton() {
  return (
    <div
      className="bg-white overflow-hidden shadow rounded-lg"
      role="status"
      aria-label="Loading dashboard widget"
      aria-busy="true"
    >
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center">
          {/* Icon */}
          <div className="flex-shrink-0">
            <Skeleton className="h-12 w-12 rounded-md" aria-label="Loading widget icon" />
          </div>

          {/* Content */}
          <div className="ml-5 w-full">
            <Skeleton className="h-4 w-32 mb-2" aria-label="Loading widget label" />
            <Skeleton className="h-8 w-20" aria-label="Loading widget value" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Grid of dashboard widgets
 */
export function DashboardWidgetGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
      role="status"
      aria-label="Loading dashboard widgets"
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <DashboardWidgetSkeleton key={index} />
      ))}
    </div>
  )
}

/**
 * Chart widget skeleton
 */
export function ChartWidgetSkeleton() {
  return (
    <div
      className="bg-white overflow-hidden shadow rounded-lg p-6"
      role="status"
      aria-label="Loading chart"
      aria-busy="true"
    >
      {/* Header */}
      <div className="mb-4">
        <Skeleton className="h-6 w-48 mb-2" aria-label="Loading chart title" />
        <Skeleton className="h-4 w-full max-w-md" aria-label="Loading chart description" />
      </div>

      {/* Chart area */}
      <div className="space-y-3">
        <div className="flex items-end justify-between h-48">
          <Skeleton className="h-32 w-12" />
          <Skeleton className="h-40 w-12" />
          <Skeleton className="h-36 w-12" />
          <Skeleton className="h-44 w-12" />
          <Skeleton className="h-38 w-12" />
          <Skeleton className="h-42 w-12" />
          <Skeleton className="h-36 w-12" />
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 pt-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Table widget skeleton
 */
export function TableWidgetSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      className="bg-white shadow overflow-hidden sm:rounded-lg"
      role="status"
      aria-label="Loading table"
      aria-busy="true"
    >
      {/* Header */}
      <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
        <Skeleton className="h-6 w-40" aria-label="Loading table title" />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {Array.from({ length: 4 }).map((_, index) => (
                <th key={index} className="px-6 py-3">
                  <Skeleton className="h-4 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: 4 }).map((_, colIndex) => (
                  <td key={colIndex} className="px-6 py-4 whitespace-nowrap">
                    <Skeleton className="h-4 w-full" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * List widget skeleton
 */
export function ListWidgetSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div
      className="bg-white shadow overflow-hidden sm:rounded-lg"
      role="status"
      aria-label="Loading list"
      aria-busy="true"
    >
      <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
        <Skeleton className="h-6 w-48" aria-label="Loading list title" />
      </div>
      <ul className="divide-y divide-gray-200">
        {Array.from({ length: items }).map((_, index) => (
          <li key={index} className="px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center flex-1 space-x-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
