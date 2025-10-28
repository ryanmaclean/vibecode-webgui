/**
 * Form Skeleton Component
 * Loading state for forms with various field types
 * WCAG 2.1 AA Compliant
 */

import { Skeleton } from '@/components/ui/skeleton'

interface FormSkeletonProps {
  /**
   * Number of form fields to display
   */
  fields?: number
  /**
   * Show form header (title and description)
   */
  showHeader?: boolean
  /**
   * Show action buttons at bottom
   */
  showActions?: boolean
}

export function FormSkeleton({
  fields = 5,
  showHeader = true,
  showActions = true,
}: FormSkeletonProps) {
  return (
    <div
      className="space-y-6 p-6 bg-white rounded-lg shadow"
      role="status"
      aria-label="Loading form"
      aria-busy="true"
    >
      {/* Form Header */}
      {showHeader && (
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" aria-label="Loading form title" />
          <Skeleton className="h-4 w-full max-w-md" aria-label="Loading form description" />
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-5">
        {Array.from({ length: fields }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton
              className="h-4 w-32"
              aria-label={`Loading field label ${index + 1}`}
            />
            {/* Vary field types for realism */}
            {index % 4 === 3 ? (
              <Skeleton
                className="h-24 w-full"
                aria-label={`Loading textarea field ${index + 1}`}
              />
            ) : index % 4 === 2 ? (
              <Skeleton
                className="h-10 w-48"
                aria-label={`Loading select field ${index + 1}`}
              />
            ) : (
              <Skeleton
                className="h-10 w-full"
                aria-label={`Loading input field ${index + 1}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      {showActions && (
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Skeleton className="h-10 w-24" aria-label="Loading cancel button" />
          <Skeleton className="h-10 w-32" aria-label="Loading submit button" />
        </div>
      )}
    </div>
  )
}

/**
 * Compact form skeleton for inline or sidebar forms
 */
export function CompactFormSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <div
      className="space-y-4 p-4 bg-white rounded-lg"
      role="status"
      aria-label="Loading form"
      aria-busy="true"
    >
      <div className="space-y-3">
        {Array.from({ length: fields }).map((_, index) => (
          <div key={index} className="space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-9 w-full" aria-label="Loading submit button" />
    </div>
  )
}

/**
 * Multi-step form skeleton with progress indicator
 */
export function MultiStepFormSkeleton({ steps = 3 }: { steps?: number }) {
  return (
    <div
      className="space-y-8 p-6 bg-white rounded-lg shadow"
      role="status"
      aria-label="Loading multi-step form"
      aria-busy="true"
    >
      {/* Progress Indicator */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          {Array.from({ length: steps }).map((_, index) => (
            <div key={index} className="flex items-center">
              <Skeleton
                className="h-10 w-10 rounded-full"
                aria-label={`Loading step ${index + 1} indicator`}
              />
              {index < steps - 1 && (
                <Skeleton className="h-0.5 w-20 mx-2" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between">
          {Array.from({ length: steps }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-3 w-20"
              aria-label={`Loading step ${index + 1} label`}
            />
          ))}
        </div>
      </div>

      {/* Form Content */}
      <div className="space-y-5">
        <Skeleton className="h-6 w-56" aria-label="Loading step title" />
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4 border-t border-gray-200">
        <Skeleton className="h-10 w-24" aria-label="Loading back button" />
        <Skeleton className="h-10 w-28" aria-label="Loading next button" />
      </div>
    </div>
  )
}
