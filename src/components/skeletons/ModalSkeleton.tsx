/**
 * Modal/Dialog Skeleton Component
 * Loading state for modal dialogs and popup content
 * WCAG 2.1 AA Compliant with focus management
 */

import { Skeleton } from '@/components/ui/skeleton'

interface ModalSkeletonProps {
  /**
   * Modal size variant
   */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /**
   * Show header section
   */
  showHeader?: boolean
  /**
   * Show footer with actions
   */
  showFooter?: boolean
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
}

export function ModalSkeleton({
  size = 'md',
  showHeader = true,
  showFooter = true,
}: ModalSkeletonProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Loading dialog"
      aria-busy="true"
    >
      <div
        className={`w-full ${sizeClasses[size]} bg-white rounded-lg shadow-xl`}
        role="status"
      >
        {/* Modal Header */}
        {showHeader && (
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <Skeleton className="h-6 w-48" aria-label="Loading modal title" />
            <Skeleton
              className="h-6 w-6 rounded"
              aria-label="Loading close button"
            />
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          <Skeleton className="h-4 w-full" aria-label="Loading content" />
          <Skeleton className="h-4 w-full" aria-label="Loading content" />
          <Skeleton className="h-4 w-3/4" aria-label="Loading content" />

          <div className="pt-2 space-y-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" aria-label="Loading field label" />
              <Skeleton className="h-10 w-full" aria-label="Loading input field" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" aria-label="Loading field label" />
              <Skeleton className="h-10 w-full" aria-label="Loading input field" />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        {showFooter && (
          <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <Skeleton className="h-10 w-24" aria-label="Loading cancel button" />
            <Skeleton className="h-10 w-32" aria-label="Loading action button" />
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Confirmation dialog skeleton
 */
export function ConfirmDialogSkeleton() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="alertdialog"
      aria-modal="true"
      aria-label="Loading confirmation dialog"
      aria-busy="true"
    >
      <div
        className="w-full max-w-sm bg-white rounded-lg shadow-xl"
        role="status"
      >
        {/* Icon and Content */}
        <div className="p-6 space-y-4">
          <div className="flex flex-col items-center space-y-3">
            <Skeleton
              className="h-12 w-12 rounded-full"
              aria-label="Loading icon"
            />
            <Skeleton
              className="h-6 w-48"
              aria-label="Loading confirmation title"
            />
          </div>

          <div className="space-y-2 text-center">
            <Skeleton
              className="h-4 w-full mx-auto"
              aria-label="Loading confirmation message"
            />
            <Skeleton
              className="h-4 w-3/4 mx-auto"
              aria-label="Loading confirmation message"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 p-6 pt-0">
          <Skeleton className="h-10 flex-1" aria-label="Loading cancel button" />
          <Skeleton className="h-10 flex-1" aria-label="Loading confirm button" />
        </div>
      </div>
    </div>
  )
}

/**
 * Slide-over panel skeleton (for side drawers)
 */
export function SlideOverSkeleton({ side = 'right' }: { side?: 'left' | 'right' }) {
  const positionClass = side === 'left' ? 'left-0' : 'right-0'

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Loading panel"
      aria-busy="true"
    >
      <div
        className={`absolute top-0 ${positionClass} h-full w-full max-w-md bg-white shadow-xl`}
        role="status"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <Skeleton className="h-6 w-40" aria-label="Loading panel title" />
          <Skeleton
            className="h-6 w-6 rounded"
            aria-label="Loading close button"
          />
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto h-[calc(100%-140px)]">
          {/* Section 1 */}
          <div className="space-y-3">
            <Skeleton className="h-5 w-32" aria-label="Loading section title" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>

          {/* Section 2 */}
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" aria-label="Loading section title" />
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3 */}
          <div className="space-y-3">
            <Skeleton className="h-5 w-36" aria-label="Loading section title" />
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-3">
            <Skeleton className="h-10 flex-1" aria-label="Loading action button" />
          </div>
        </div>
      </div>
    </div>
  )
}
