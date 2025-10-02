/**
 * Workspace Card Skeleton
 * Loading state for workspace cards
 * WCAG 2.1 AA Compliant
 */

import { Skeleton } from '@/components/ui/skeleton'

export function WorkspaceCardSkeleton() {
  return (
    <div
      className="bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-200"
      role="status"
      aria-label="Loading workspace"
      aria-busy="true"
    >
      <div className="p-6">
        {/* Header with title and actions */}
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-2/3" aria-label="Loading workspace name" />
          <div className="flex space-x-2">
            <Skeleton className="h-4 w-4" aria-label="Loading action button" />
            <Skeleton className="h-4 w-4" aria-label="Loading action button" />
          </div>
        </div>

        {/* Description */}
        <Skeleton className="h-4 w-full mb-4" aria-label="Loading description" />

        {/* Footer with metadata and action */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-32" aria-label="Loading creation date" />
          <Skeleton className="h-8 w-16" aria-label="Loading open button" />
        </div>
      </div>
    </div>
  )
}

/**
 * Grid of workspace cards
 */
export function WorkspaceCardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label="Loading workspaces"
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <WorkspaceCardSkeleton key={index} />
      ))}
    </div>
  )
}
