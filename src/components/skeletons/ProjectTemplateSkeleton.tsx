/**
 * Project Template Grid Skeleton
 * Loading state for project template cards in grid layout
 * WCAG 2.1 AA Compliant
 */

import { Skeleton } from '@/components/ui/skeleton'

interface ProjectTemplateSkeletonProps {
  /**
   * Number of skeleton cards to display
   */
  count?: number
}

export function ProjectTemplateSkeleton({ count = 6 }: ProjectTemplateSkeletonProps) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      role="status"
      aria-label="Loading project templates"
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="border rounded-lg p-6 space-y-4 bg-white shadow-sm transition-opacity duration-200 ease-in"
        >
          {/* Header with title and badge */}
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-3/4" aria-label="Loading template title" />
              <Skeleton className="h-4 w-full" aria-label="Loading template description" />
            </div>
            <Skeleton className="h-6 w-20 ml-2" aria-label="Loading difficulty badge" />
          </div>

          {/* Meta information */}
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-20" aria-label="Loading language" />
            <Skeleton className="h-4 w-24" aria-label="Loading framework" />
            <Skeleton className="h-4 w-16" aria-label="Loading time estimate" />
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-5 w-16" aria-label="Loading tag" />
            <Skeleton className="h-5 w-20" aria-label="Loading tag" />
            <Skeleton className="h-5 w-14" aria-label="Loading tag" />
          </div>

          {/* Action button */}
          <Skeleton className="h-10 w-full" aria-label="Loading action button" />
        </div>
      ))}
    </div>
  )
}

/**
 * Single template card skeleton for use in lists
 */
export function ProjectTemplateCardSkeleton() {
  return (
    <div className="border rounded-lg p-6 space-y-4 bg-white shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </div>
        <Skeleton className="h-6 w-20 ml-2" />
      </div>

      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-14" />
      </div>

      <Skeleton className="h-10 w-full" />
    </div>
  )
}
