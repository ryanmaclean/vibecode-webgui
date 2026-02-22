/**
 * Token Counter Component
 * Displays real-time token count and rate during AI streaming operations
 *
 * Accessibility Features:
 * - ARIA attributes (role="status", aria-label, aria-live)
 * - Screen reader announcements for token updates
 * - Semantic HTML structure
 * - High contrast support for visibility
 * - Reduced motion support (respects prefers-reduced-motion)
 *
 * @example
 * ```tsx
 * <TokenCounter
 *   metadata={{
 *     tokenCount: 150,
 *     tokensPerSecond: 25,
 *     isComplete: false
 *   }}
 *   showRate
 * />
 * ```
 */

import React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { StreamMetadata } from '@/lib/ai/stream-utils'
import { formatTokenRate } from '@/lib/ai/stream-utils'

export interface TokenCounterProps {
  /**
   * Stream metadata containing token count and rate information
   */
  metadata: StreamMetadata | null | undefined

  /**
   * Whether to show the tokens per second rate
   * @default true
   */
  showRate?: boolean

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
   * @default "Token counter"
   */
  'aria-label'?: string

  /**
   * Politeness level for screen reader announcements
   * @default "polite"
   */
  'aria-live'?: 'polite' | 'assertive' | 'off'
}

/**
 * TokenCounter Component
 * Displays real-time token progress during AI operations
 */
export function TokenCounter({
  metadata,
  showRate = true,
  animated = true,
  className,
  'aria-label': ariaLabel = 'Token counter',
  'aria-live': ariaLive = 'polite',
}: TokenCounterProps) {
  // Handle null/undefined metadata
  if (!metadata) {
    return (
      <div
        role="status"
        aria-label="Token counter loading"
        aria-busy="true"
        className={cn(
          'flex items-center gap-2 text-sm text-muted-foreground',
          className
        )}
      >
        <Badge variant="secondary" className="opacity-50">
          0 tokens
        </Badge>
      </div>
    )
  }

  const { tokenCount, tokensPerSecond, isComplete } = metadata
  const isStreaming = !isComplete && tokensPerSecond > 0

  // Construct screen reader announcement
  const srAnnouncement = showRate && tokensPerSecond > 0
    ? `${tokenCount} tokens at ${formatTokenRate(tokensPerSecond)}`
    : `${tokenCount} tokens`

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      aria-live={ariaLive}
      aria-busy={isStreaming ? 'true' : 'false'}
      className={cn(
        'flex items-center gap-2 text-sm',
        className
      )}
    >
      {/* Token count badge */}
      <Badge
        variant={isComplete ? 'secondary' : 'default'}
        className={cn(
          'transition-colors duration-200',
          // Pulse animation during streaming (with reduced motion support)
          isStreaming && animated && 'animate-pulse motion-reduce:animate-none',
          // Subtle glow effect when streaming
          isStreaming && 'ring-1 ring-primary/20',
          // Ensure good contrast
          'font-mono'
        )}
      >
        <span className="sr-only">{srAnnouncement}</span>
        <span aria-hidden="true">
          {tokenCount.toLocaleString()} {tokenCount === 1 ? 'token' : 'tokens'}
        </span>
      </Badge>

      {/* Token rate (optional) */}
      {showRate && tokensPerSecond > 0 && (
        <span
          className={cn(
            'text-muted-foreground transition-opacity duration-200',
            isComplete && 'opacity-50'
          )}
          aria-hidden="true"
        >
          {formatTokenRate(tokensPerSecond)}
        </span>
      )}

      {/* Completion indicator */}
      {isComplete && (
        <span
          className="text-muted-foreground text-xs"
          aria-hidden="true"
        >
          ✓
        </span>
      )}
    </div>
  )
}

/**
 * Compact variant of TokenCounter for inline display
 * Shows only token count without rate information
 */
export function TokenCounterCompact({
  metadata,
  className,
  ...props
}: Omit<TokenCounterProps, 'showRate' | 'animated'>) {
  return (
    <TokenCounter
      metadata={metadata}
      showRate={false}
      animated={false}
      className={cn('text-xs', className)}
      {...props}
    />
  )
}

/**
 * Detailed variant of TokenCounter with additional information
 * Shows token count, rate, and elapsed time
 */
export function TokenCounterDetailed({
  metadata,
  className,
  ...props
}: TokenCounterProps) {
  if (!metadata) {
    return <TokenCounter metadata={metadata} className={className} {...props} />
  }

  const { tokenCount, tokensPerSecond, elapsedMs, isComplete } = metadata
  const seconds = Math.round(elapsedMs / 1000)

  return (
    <div
      role="status"
      aria-label={`Token counter: ${tokenCount} tokens in ${seconds} seconds`}
      className={cn(
        'flex flex-col gap-1 text-sm',
        className
      )}
    >
      <TokenCounter
        metadata={metadata}
        showRate
        className="justify-start"
        {...props}
      />

      {elapsedMs > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {seconds === 0 ? '< 1s' : `${seconds}s`}
          </span>
          {!isComplete && tokensPerSecond > 0 && (
            <span className="opacity-60">•</span>
          )}
        </div>
      )}
    </div>
  )
}
