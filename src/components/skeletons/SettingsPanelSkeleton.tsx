/**
 * Settings Panel Skeleton
 * Loading state for settings forms and panels
 * WCAG 2.1 AA Compliant
 */

import { Skeleton } from '@/components/ui/skeleton'

export function SettingsPanelSkeleton() {
  return (
    <div
      className="space-y-6 p-6 bg-white rounded-lg shadow"
      role="status"
      aria-label="Loading settings"
      aria-busy="true"
    >
      {/* Section 1 */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" aria-label="Loading section title" />
        <div className="space-y-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" aria-label="Loading field label" />
            <Skeleton className="h-10 w-full" aria-label="Loading input field" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" aria-label="Loading field label" />
            <Skeleton className="h-10 w-full" aria-label="Loading input field" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" aria-label="Loading field label" />
            <Skeleton className="h-24 w-full" aria-label="Loading textarea field" />
          </div>
        </div>
      </div>

      {/* Section 2 */}
      <div className="space-y-4 pt-6 border-t">
        <Skeleton className="h-6 w-56" aria-label="Loading section title" />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1 flex-1">
              <Skeleton className="h-4 w-44" aria-label="Loading toggle label" />
              <Skeleton className="h-3 w-64" aria-label="Loading toggle description" />
            </div>
            <Skeleton className="h-6 w-12" aria-label="Loading toggle switch" />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1 flex-1">
              <Skeleton className="h-4 w-40" aria-label="Loading toggle label" />
              <Skeleton className="h-3 w-72" aria-label="Loading toggle description" />
            </div>
            <Skeleton className="h-6 w-12" aria-label="Loading toggle switch" />
          </div>
        </div>
      </div>

      {/* Section 3 */}
      <div className="space-y-4 pt-6 border-t">
        <Skeleton className="h-6 w-44" aria-label="Loading section title" />
        <div className="space-y-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" aria-label="Loading field label" />
            <Skeleton className="h-10 w-full" aria-label="Loading select field" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" aria-label="Loading field label" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-20" aria-label="Loading radio option" />
              <Skeleton className="h-10 w-20" aria-label="Loading radio option" />
              <Skeleton className="h-10 w-20" aria-label="Loading radio option" />
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-3 pt-6 border-t">
        <Skeleton className="h-10 w-24" aria-label="Loading cancel button" />
        <Skeleton className="h-10 w-32" aria-label="Loading save button" />
      </div>
    </div>
  )
}

/**
 * Compact settings skeleton for sidebars or smaller panels
 */
export function CompactSettingsSkeleton() {
  return (
    <div
      className="space-y-4 p-4 bg-white rounded-lg"
      role="status"
      aria-label="Loading settings"
      aria-busy="true"
    >
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="space-y-3 pt-4 border-t">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-5 w-10" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-10" />
        </div>
      </div>
      <Skeleton className="h-9 w-full mt-4" />
    </div>
  )
}
