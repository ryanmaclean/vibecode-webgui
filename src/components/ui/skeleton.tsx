/**
 * Base Skeleton Component
 * Provides loading state visual feedback with WCAG 2.1 AA compliance
 *
 * Accessibility Features:
 * - ARIA attributes (role="status", aria-busy, aria-label)
 * - Reduced motion support (respects prefers-reduced-motion)
 * - Screen reader announcements with aria-live
 * - Semantic HTML structure
 * - Proper contrast ratios for visibility
 *
 * @see https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions
 */

import { cn } from '@/lib/utils'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Optional loading label for screen readers
   * @default "Loading..."
   */
  'aria-label'?: string
  /**
   * Politeness level for screen reader announcements
   * @default "polite"
   */
  'aria-live'?: 'polite' | 'assertive' | 'off'
  /**
   * Disable animation (useful for testing or when animation is not desired)
   * @default false
   */
  noAnimation?: boolean
}

export function Skeleton({
  className,
  'aria-label': ariaLabel = 'Loading...',
  'aria-live': ariaLive = 'polite',
  noAnimation = false,
  ...props
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
      aria-live={ariaLive}
      className={cn(
        // Base styles
        'rounded-md bg-gray-200 dark:bg-gray-700',
        // Animation with reduced motion support
        !noAnimation && 'animate-pulse motion-reduce:animate-none',
        // Fallback for reduced motion - subtle opacity variation
        !noAnimation && 'motion-reduce:opacity-70',
        className
      )}
      {...props}
    />
  )
}

/**
 * Skeleton variant with smooth fade-in transition
 * Use when content will appear after loading completes
 */
export function SkeletonWithFade({
  className,
  'aria-label': ariaLabel = 'Loading...',
  'aria-live': ariaLive = 'polite',
  noAnimation = false,
  ...props
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
      aria-live={ariaLive}
      className={cn(
        // Base styles
        'rounded-md bg-gray-200 dark:bg-gray-700',
        // Animation with reduced motion support
        !noAnimation && 'animate-pulse motion-reduce:animate-none',
        // Smooth transition
        'transition-opacity duration-200 ease-in',
        // Fallback for reduced motion
        !noAnimation && 'motion-reduce:opacity-70',
        className
      )}
      {...props}
    />
  )
}

/**
 * Skeleton text line component
 * Pre-configured for text content loading states
 */
export function SkeletonText({
  className,
  lines = 1,
  'aria-label': ariaLabel = 'Loading text content...',
  ...props
}: SkeletonProps & { lines?: number }) {
  if (lines === 1) {
    return (
      <Skeleton
        className={cn('h-4 w-full', className)}
        aria-label={ariaLabel}
        {...props}
      />
    )
  }

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
      className="space-y-2"
    >
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4',
            // Last line is typically shorter
            i === lines - 1 ? 'w-4/5' : 'w-full',
            className
          )}
          aria-label={`Loading line ${i + 1} of ${lines}`}
        />
      ))}
    </div>
  )
}

/**
 * Skeleton card component
 * Pre-configured for card-based layouts
 */
export function SkeletonCard({
  className,
  'aria-label': ariaLabel = 'Loading card...',
  ...props
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
      className={cn(
        'rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4',
        className
      )}
      {...props}
    >
      {/* Card header */}
      <div className="space-y-2">
        <Skeleton className="h-6 w-3/4" aria-label="Loading title" />
        <Skeleton className="h-4 w-full" aria-label="Loading description" />
      </div>

      {/* Card content */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>

      {/* Card footer */}
      <div className="flex justify-between">
        <Skeleton className="h-4 w-24" aria-label="Loading metadata" />
        <Skeleton className="h-8 w-20" aria-label="Loading action button" />
      </div>
    </div>
  )
}
