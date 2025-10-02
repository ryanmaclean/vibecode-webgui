import * as React from "react"
import { cn } from "@/lib/utils"

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Accessibility label for screen readers
   */
  "aria-label"?: string
  /**
   * Whether to show a shimmer animation effect
   * @default true
   */
  shimmer?: boolean
}

/**
 * Skeleton component for loading states
 *
 * Provides visual feedback while content is loading with:
 * - Pulse animation for smooth loading indication
 * - Optional shimmer effect for enhanced visual feedback
 * - Theme-aware styling (light/dark mode support)
 * - Full accessibility support with ARIA attributes
 * - Customizable via className prop
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Skeleton className="h-4 w-full" />
 *
 * // Card skeleton
 * <Card>
 *   <CardHeader>
 *     <Skeleton className="h-6 w-2/3" />
 *     <Skeleton className="h-4 w-1/2" />
 *   </CardHeader>
 * </Card>
 *
 * // With shimmer effect
 * <Skeleton className="h-20 w-20 rounded-full" shimmer />
 *
 * // Custom accessibility label
 * <Skeleton className="h-4 w-full" aria-label="Loading user profile" />
 * ```
 */
const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({
    className,
    shimmer = true,
    "aria-label": ariaLabel = "Loading content",
    ...props
  }, ref) => {
    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={ariaLabel}
        className={cn(
          "relative overflow-hidden rounded-md bg-gray-200 dark:bg-gray-800",
          "animate-pulse",
          shimmer && [
            "before:absolute before:inset-0",
            "before:-translate-x-full before:animate-shimmer",
            "before:bg-gradient-to-r",
            "before:from-transparent before:via-gray-300/20 dark:before:via-gray-700/20 before:to-transparent",
          ],
          className
        )}
        {...props}
      >
        <span className="sr-only">{ariaLabel}</span>
      </div>
    )
  }
)
Skeleton.displayName = "Skeleton"

/**
 * Skeleton variants for common UI patterns
 */
export const SkeletonVariants = {
  /**
   * Text line skeleton
   */
  Text: ({ className, ...props }: SkeletonProps) => (
    <Skeleton className={cn("h-4 w-full", className)} {...props} />
  ),

  /**
   * Avatar/circular skeleton
   */
  Avatar: ({ className, ...props }: SkeletonProps) => (
    <Skeleton className={cn("h-12 w-12 rounded-full", className)} {...props} />
  ),

  /**
   * Button skeleton
   */
  Button: ({ className, ...props }: SkeletonProps) => (
    <Skeleton className={cn("h-10 w-24", className)} {...props} />
  ),

  /**
   * Card skeleton
   */
  Card: ({ className, ...props }: SkeletonProps) => (
    <div className={cn("space-y-3", className)}>
      <Skeleton className="h-24 w-full" {...props} />
      <Skeleton className="h-4 w-2/3" {...props} />
      <Skeleton className="h-4 w-1/2" {...props} />
    </div>
  ),
}

export { Skeleton }
