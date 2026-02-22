/**
 * AI Loading State Component
 * Comprehensive loading state for AI operations with cancel/regenerate controls
 *
 * Accessibility Features:
 * - ARIA attributes (role="status", aria-label, aria-live, aria-busy)
 * - Screen reader announcements for state changes
 * - Keyboard accessible interactive elements
 * - Semantic HTML structure
 * - High contrast support for visibility
 * - Reduced motion support (respects prefers-reduced-motion)
 *
 * @example
 * ```tsx
 * <AILoadingState
 *   metadata={{
 *     tokenCount: 150,
 *     tokensPerSecond: 25,
 *     elapsedMs: 6000,
 *     isComplete: false
 *   }}
 *   onCancel={() => console.log('Cancel clicked')}
 *   onRegenerate={() => console.log('Regenerate clicked')}
 *   showProgress
 * />
 * ```
 */

import React from 'react'
import { X, RefreshCw, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TokenCounter } from './TokenCounter'
import { StreamingProgress } from './StreamingProgress'
import type { StreamMetadata } from '@/lib/ai/stream-utils'

export interface AILoadingStateProps {
  /**
   * Stream metadata containing progress information
   */
  metadata: StreamMetadata | null | undefined

  /**
   * Whether to show token counter
   * @default true
   */
  showTokens?: boolean

  /**
   * Whether to show progress/timing information
   * @default true
   */
  showProgress?: boolean

  /**
   * Whether to show content preview (skeleton lines)
   * @default true
   */
  showPreview?: boolean

  /**
   * Number of skeleton lines to show in preview
   * @default 3
   */
  previewLines?: number

  /**
   * Callback when cancel button is clicked
   */
  onCancel?: () => void

  /**
   * Callback when regenerate button is clicked
   */
  onRegenerate?: () => void

  /**
   * Whether cancel button is disabled
   * @default false
   */
  cancelDisabled?: boolean

  /**
   * Whether regenerate button is disabled
   * @default false
   */
  regenerateDisabled?: boolean

  /**
   * Custom loading message
   * @default "AI is generating a response..."
   */
  loadingMessage?: string

  /**
   * Custom completion message
   * @default "Response complete"
   */
  completionMessage?: string

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
   * @default "AI loading state"
   */
  'aria-label'?: string
}

/**
 * AILoadingState Component
 * Displays comprehensive loading state for AI operations with controls
 */
export function AILoadingState({
  metadata,
  showTokens = true,
  showProgress = true,
  showPreview = true,
  previewLines = 3,
  onCancel,
  onRegenerate,
  cancelDisabled = false,
  regenerateDisabled = false,
  loadingMessage = 'AI is generating a response...',
  completionMessage = 'Response complete',
  animated = true,
  className,
  'aria-label': ariaLabel = 'AI loading state',
}: AILoadingStateProps) {
  const isComplete = metadata?.isComplete ?? false
  const isStreaming = !isComplete && metadata !== null && metadata !== undefined

  // Screen reader announcement
  const srAnnouncement = (() => {
    if (isComplete) {
      return `${completionMessage}. ${metadata?.tokenCount || 0} tokens generated.`
    }
    if (isStreaming) {
      return `${loadingMessage} ${metadata?.tokenCount || 0} tokens so far.`
    }
    return 'Initializing AI operation...'
  })()

  return (
    <Card
      role="status"
      aria-label={ariaLabel}
      aria-live="polite"
      aria-busy={isStreaming ? 'true' : 'false'}
      className={cn(
        'transition-all duration-200',
        // Subtle border color change based on state
        isStreaming && 'border-primary/30',
        isComplete && 'border-green-500/30',
        className
      )}
    >
      <CardContent className="p-4 space-y-4">
        {/* Screen reader announcement */}
        <span className="sr-only">{srAnnouncement}</span>

        {/* Header with status message */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            {/* Loading spinner icon */}
            {isStreaming && (
              <Loader2
                className={cn(
                  'h-4 w-4 text-primary',
                  animated && 'animate-spin motion-reduce:animate-none'
                )}
                aria-hidden="true"
              />
            )}

            {/* Completion checkmark */}
            {isComplete && (
              <span
                className="text-green-600 dark:text-green-400 text-lg"
                aria-hidden="true"
              >
                ✓
              </span>
            )}

            {/* Status message */}
            <p
              className={cn(
                'text-sm font-medium',
                isComplete && 'text-muted-foreground'
              )}
              aria-hidden="true"
            >
              {isComplete ? completionMessage : loadingMessage}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Cancel button (shown during streaming) */}
            {isStreaming && onCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                disabled={cancelDisabled}
                aria-label="Cancel AI operation"
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" aria-hidden="true" />
                Cancel
              </Button>
            )}

            {/* Regenerate button (shown after completion) */}
            {isComplete && onRegenerate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRegenerate}
                disabled={regenerateDisabled}
                aria-label="Regenerate AI response"
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-4 w-4 mr-1" aria-hidden="true" />
                Regenerate
              </Button>
            )}
          </div>
        </div>

        {/* Progress indicators */}
        <div className="space-y-3">
          {/* Token counter */}
          {showTokens && (
            <TokenCounter
              metadata={metadata}
              showRate={isStreaming}
              animated={animated}
              aria-label="Token count progress"
            />
          )}

          {/* Streaming progress */}
          {showProgress && (
            <StreamingProgress
              metadata={metadata}
              showProgressBar={isStreaming}
              showElapsed={true}
              showEstimated={isStreaming}
              animated={animated}
              aria-label="Streaming time progress"
            />
          )}
        </div>

        {/* Content preview skeleton */}
        {showPreview && isStreaming && (
          <div
            className="space-y-2 pt-2 border-t border-border"
            role="presentation"
            aria-hidden="true"
          >
            {Array.from({ length: previewLines }).map((_, i) => (
              <Skeleton
                key={i}
                className={cn(
                  'h-3',
                  // Last line is typically shorter
                  i === previewLines - 1 ? 'w-3/4' : 'w-full'
                )}
                noAnimation={!animated}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Compact variant of AILoadingState for inline display
 * Shows minimal information with action buttons
 */
export function AILoadingStateCompact({
  metadata,
  onCancel,
  onRegenerate,
  className,
  ...props
}: Omit<
  AILoadingStateProps,
  'showTokens' | 'showProgress' | 'showPreview'
>) {
  const isComplete = metadata?.isComplete ?? false
  const isStreaming = !isComplete && metadata !== null && metadata !== undefined

  return (
    <div
      role="status"
      aria-label="AI loading state (compact)"
      aria-busy={isStreaming ? 'true' : 'false'}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border border-border bg-card',
        className
      )}
    >
      {/* Status indicator */}
      <div className="flex-shrink-0">
        {isStreaming && (
          <Loader2
            className="h-4 w-4 text-primary animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        )}
        {isComplete && (
          <span
            className="text-green-600 dark:text-green-400"
            aria-hidden="true"
          >
            ✓
          </span>
        )}
      </div>

      {/* Token count */}
      <TokenCounter
        metadata={metadata}
        showRate={false}
        animated={false}
        className="flex-1"
      />

      {/* Action button */}
      {isStreaming && onCancel && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          aria-label="Cancel"
          className="h-7 w-7 p-0"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </Button>
      )}
      {isComplete && onRegenerate && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRegenerate}
          aria-label="Regenerate"
          className="h-7 w-7 p-0"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}

/**
 * Detailed variant of AILoadingState with full information
 * Shows all available metadata and controls
 */
export function AILoadingStateDetailed({
  metadata,
  className,
  ...props
}: AILoadingStateProps) {
  return (
    <AILoadingState
      metadata={metadata}
      showTokens={true}
      showProgress={true}
      showPreview={true}
      previewLines={5}
      className={cn('shadow-sm', className)}
      {...props}
    />
  )
}

/**
 * Minimal variant without card wrapper, suitable for inline use
 */
export function AILoadingStateMinimal({
  metadata,
  onCancel,
  onRegenerate,
  animated = true,
  className,
}: Pick<
  AILoadingStateProps,
  'metadata' | 'onCancel' | 'onRegenerate' | 'animated' | 'className'
>) {
  const isComplete = metadata?.isComplete ?? false
  const isStreaming = !isComplete && metadata !== null && metadata !== undefined

  return (
    <div
      role="status"
      aria-label="AI loading state"
      aria-busy={isStreaming ? 'true' : 'false'}
      className={cn('flex items-center gap-3 text-sm', className)}
    >
      {/* Loading indicator */}
      {isStreaming && (
        <Loader2
          className={cn(
            'h-3 w-3 text-muted-foreground',
            animated && 'animate-spin motion-reduce:animate-none'
          )}
          aria-hidden="true"
        />
      )}

      {/* Token count */}
      <TokenCounter
        metadata={metadata}
        showRate={false}
        animated={false}
        className="text-xs"
      />

      {/* Buttons */}
      {isStreaming && onCancel && (
        <button
          onClick={onCancel}
          aria-label="Cancel"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
      {isComplete && onRegenerate && (
        <button
          onClick={onRegenerate}
          aria-label="Regenerate"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
