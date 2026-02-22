/**
 * Streaming Progress Component
 * Displays estimated completion time and progress for AI streaming operations
 *
 * Accessibility Features:
 * - ARIA attributes (role="status", aria-label, aria-live, aria-valuenow)
 * - Screen reader announcements for progress updates
 * - Semantic HTML structure
 * - High contrast support for visibility
 * - Reduced motion support (respects prefers-reduced-motion)
 *
 * @example
 * ```tsx
 * <StreamingProgress
 *   metadata={{
 *     tokenCount: 150,
 *     tokensPerSecond: 25,
 *     elapsedMs: 6000,
 *     estimatedCompletionMs: 4000,
 *     isComplete: false
 *   }}
 *   showProgressBar
 * />
 * ```
 */

import React from 'react'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import type { StreamMetadata } from '@/lib/ai/stream-utils'
import {
  formatElapsedTime,
  formatEstimatedCompletion,
} from '@/lib/ai/stream-utils'

export interface StreamingProgressProps {
  /**
   * Stream metadata containing timing and progress information
   */
  metadata: StreamMetadata | null | undefined

  /**
   * Whether to show a visual progress bar
   * @default false
   */
  showProgressBar?: boolean

  /**
   * Whether to show elapsed time
   * @default true
   */
  showElapsed?: boolean

  /**
   * Whether to show estimated completion time
   * @default true
   */
  showEstimated?: boolean

  /**
   * Whether to show visual animation during streaming
   * @default true
   */
  animated?: boolean

  /**
   * Additional CSS classes
   */
  className?: string

  /**
   * Custom aria-label for screen readers
   * @default "Streaming progress"
   */
  'aria-label'?: string

  /**
   * Politeness level for screen reader announcements
   * @default "polite"
   */
  'aria-live'?: 'polite' | 'assertive' | 'off'
}

/**
 * StreamingProgress Component
 * Displays progress and estimated completion time during AI operations
 */
export function StreamingProgress({
  metadata,
  showProgressBar = false,
  showElapsed = true,
  showEstimated = true,
  animated = true,
  className,
  'aria-label': ariaLabel = 'Streaming progress',
  'aria-live': ariaLive = 'polite',
}: StreamingProgressProps) {
  // Handle null/undefined metadata
  if (!metadata) {
    return (
      <div
        role="status"
        aria-label="Streaming progress loading"
        aria-busy="true"
        className={cn(
          'flex flex-col gap-2 text-sm text-muted-foreground',
          className
        )}
      >
        <div className="flex items-center justify-between">
          <span className="opacity-50">Initializing...</span>
        </div>
      </div>
    )
  }

  const { elapsedMs, estimatedCompletionMs, isComplete, tokenCount } = metadata
  const isStreaming = !isComplete

  // Calculate progress percentage if we have an estimate
  const progressPercentage =
    estimatedCompletionMs && estimatedCompletionMs > 0
      ? Math.min(
          100,
          Math.round(
            (elapsedMs / (elapsedMs + estimatedCompletionMs)) * 100
          )
        )
      : undefined

  // Construct screen reader announcement
  const srAnnouncement = (() => {
    const parts: string[] = []

    if (isComplete) {
      parts.push('Complete')
    } else {
      parts.push('In progress')
    }

    if (showElapsed) {
      parts.push(`Elapsed: ${formatElapsedTime(elapsedMs)}`)
    }

    if (showEstimated && estimatedCompletionMs) {
      parts.push(`Estimated: ${formatEstimatedCompletion(estimatedCompletionMs)}`)
    }

    if (progressPercentage !== undefined) {
      parts.push(`${progressPercentage}% complete`)
    }

    return parts.join(', ')
  })()

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      aria-live={ariaLive}
      aria-busy={isStreaming ? 'true' : 'false'}
      className={cn(
        'flex flex-col gap-2',
        className
      )}
    >
      {/* Screen reader announcement */}
      <span className="sr-only">{srAnnouncement}</span>

      {/* Progress bar */}
      {showProgressBar && progressPercentage !== undefined && (
        <Progress
          value={progressPercentage}
          aria-valuenow={progressPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progress: ${progressPercentage}%`}
          className={cn(
            'h-2 transition-opacity duration-200',
            isComplete && 'opacity-50',
            // Reduced motion support
            animated && 'motion-reduce:transition-none'
          )}
        />
      )}

      {/* Time information */}
      <div
        className={cn(
          'flex items-center justify-between text-sm',
          isComplete && 'text-muted-foreground'
        )}
        aria-hidden="true"
      >
        {/* Elapsed time */}
        {showElapsed && (
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-xs">Elapsed:</span>
            <span
              className={cn(
                'font-mono tabular-nums',
                isStreaming && animated && 'animate-pulse motion-reduce:animate-none'
              )}
            >
              {formatElapsedTime(elapsedMs)}
            </span>
          </div>
        )}

        {/* Estimated completion time */}
        {showEstimated && (
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-xs">
              {isComplete ? 'Completed' : 'Est. remaining:'}
            </span>
            <span
              className={cn(
                'font-mono tabular-nums',
                !isComplete && 'text-primary',
                isStreaming && animated && 'animate-pulse motion-reduce:animate-none'
              )}
            >
              {isComplete
                ? '—'
                : formatEstimatedCompletion(estimatedCompletionMs)}
            </span>
          </div>
        )}
      </div>

      {/* Completion indicator */}
      {isComplete && (
        <div
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
          aria-hidden="true"
        >
          <span className="text-green-600 dark:text-green-400">✓</span>
          <span>Stream complete</span>
        </div>
      )}
    </div>
  )
}

/**
 * Compact variant of StreamingProgress for inline display
 * Shows only estimated time without progress bar
 */
export function StreamingProgressCompact({
  metadata,
  className,
  ...props
}: Omit<StreamingProgressProps, 'showProgressBar' | 'showElapsed'>) {
  return (
    <StreamingProgress
      metadata={metadata}
      showProgressBar={false}
      showElapsed={false}
      showEstimated={true}
      className={cn('gap-1', className)}
      {...props}
    />
  )
}

/**
 * Detailed variant of StreamingProgress with full information
 * Shows progress bar, elapsed time, and estimated completion
 */
export function StreamingProgressDetailed({
  metadata,
  className,
  ...props
}: StreamingProgressProps) {
  if (!metadata) {
    return (
      <StreamingProgress
        metadata={metadata}
        className={className}
        {...props}
      />
    )
  }

  const { tokenCount, tokensPerSecond, isComplete } = metadata

  return (
    <div
      role="status"
      aria-label={`Detailed streaming progress: ${tokenCount} tokens processed`}
      className={cn('flex flex-col gap-3', className)}
    >
      {/* Main progress display */}
      <StreamingProgress
        metadata={metadata}
        showProgressBar={true}
        showElapsed={true}
        showEstimated={true}
        {...props}
      />

      {/* Additional statistics */}
      {!isComplete && tokensPerSecond > 0 && (
        <div
          className="flex items-center gap-2 text-xs text-muted-foreground border-t border-border pt-2"
          aria-hidden="true"
        >
          <span className="opacity-60">Processing rate:</span>
          <span className="font-mono">
            {Math.round(tokensPerSecond)} tokens/s
          </span>
        </div>
      )}
    </div>
  )
}
