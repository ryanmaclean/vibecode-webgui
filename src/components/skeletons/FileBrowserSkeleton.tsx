/**
 * File Browser/Explorer Skeleton
 * Loading state for file tree navigation
 * WCAG 2.1 AA Compliant
 */

import { Skeleton } from '@/components/ui/skeleton'

export function FileBrowserSkeleton() {
  return (
    <div
      className="w-full h-full bg-white border-r border-gray-200 p-4 space-y-2"
      role="status"
      aria-label="Loading file browser"
      aria-busy="true"
    >
      {/* Search/Filter Bar */}
      <div className="mb-4">
        <Skeleton className="h-10 w-full" aria-label="Loading search bar" />
      </div>

      {/* Root folder */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 px-2 py-1">
          <Skeleton className="h-4 w-4" aria-label="Loading folder icon" />
          <Skeleton className="h-4 w-24" aria-label="Loading folder name" />
        </div>

        {/* Nested items - Level 1 */}
        <div className="ml-4 space-y-1">
          <div className="flex items-center gap-2 px-2 py-1">
            <Skeleton className="h-4 w-4" aria-label="Loading folder icon" />
            <Skeleton className="h-4 w-32" aria-label="Loading folder name" />
          </div>

          {/* Nested items - Level 2 */}
          <div className="ml-4 space-y-1">
            <div className="flex items-center gap-2 px-2 py-1">
              <Skeleton className="h-4 w-4" aria-label="Loading file icon" />
              <Skeleton className="h-4 w-28" aria-label="Loading file name" />
            </div>
            <div className="flex items-center gap-2 px-2 py-1">
              <Skeleton className="h-4 w-4" aria-label="Loading file icon" />
              <Skeleton className="h-4 w-36" aria-label="Loading file name" />
            </div>
            <div className="flex items-center gap-2 px-2 py-1">
              <Skeleton className="h-4 w-4" aria-label="Loading file icon" />
              <Skeleton className="h-4 w-24" aria-label="Loading file name" />
            </div>
          </div>

          <div className="flex items-center gap-2 px-2 py-1">
            <Skeleton className="h-4 w-4" aria-label="Loading folder icon" />
            <Skeleton className="h-4 w-28" aria-label="Loading folder name" />
          </div>
        </div>

        {/* More Level 1 items */}
        <div className="ml-4 space-y-1">
          <div className="flex items-center gap-2 px-2 py-1">
            <Skeleton className="h-4 w-4" aria-label="Loading folder icon" />
            <Skeleton className="h-4 w-20" aria-label="Loading folder name" />
          </div>
          <div className="flex items-center gap-2 px-2 py-1">
            <Skeleton className="h-4 w-4" aria-label="Loading file icon" />
            <Skeleton className="h-4 w-32" aria-label="Loading file name" />
          </div>
          <div className="flex items-center gap-2 px-2 py-1">
            <Skeleton className="h-4 w-4" aria-label="Loading file icon" />
            <Skeleton className="h-4 w-28" aria-label="Loading file name" />
          </div>
          <div className="flex items-center gap-2 px-2 py-1">
            <Skeleton className="h-4 w-4" aria-label="Loading file icon" />
            <Skeleton className="h-4 w-24" aria-label="Loading file name" />
          </div>
        </div>

        {/* Additional root level items */}
        <div className="ml-4 space-y-1">
          <div className="flex items-center gap-2 px-2 py-1">
            <Skeleton className="h-4 w-4" aria-label="Loading file icon" />
            <Skeleton className="h-4 w-36" aria-label="Loading file name" />
          </div>
          <div className="flex items-center gap-2 px-2 py-1">
            <Skeleton className="h-4 w-4" aria-label="Loading file icon" />
            <Skeleton className="h-4 w-28" aria-label="Loading file name" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Compact file list skeleton for smaller views
 */
export function FileListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="space-y-1"
      role="status"
      aria-label="Loading file list"
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-2 px-2 py-1.5">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 flex-1" style={{ width: `${Math.random() * 40 + 60}%` }} />
        </div>
      ))}
    </div>
  )
}
