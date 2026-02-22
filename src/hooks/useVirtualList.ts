import { useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { VirtualItem } from '@tanstack/react-virtual'

/**
 * Configuration options for useVirtualList
 */
export interface UseVirtualListOptions {
  /** Total number of items in the list */
  count: number
  /** Estimated height of each item in pixels (default: 80) */
  estimateSize?: number
  /** Number of items to render outside the visible window for smoother scrolling (default: 5) */
  overscan?: number
}

/**
 * Return value from useVirtualList
 */
export interface UseVirtualListReturn {
  /** Ref to attach to the scroll container element */
  parentRef: React.RefObject<HTMLDivElement | null>
  /** Virtual items to render (only the visible ones + overscan) */
  virtualItems: VirtualItem[]
  /** Total height of all items in pixels — use as height of inner spacer div */
  totalHeight: number
  /** Callback ref to measure dynamic item sizes; attach to each rendered item */
  measureRef: (index: number) => (el: Element | null) => void
}

/**
 * Virtualizes a vertical list so only visible items are rendered in the DOM.
 *
 * Wraps @tanstack/react-virtual's useVirtualizer with sensible defaults for
 * fixed-height scroll container lists (e.g. CommitHistoryViewer).
 *
 * Usage:
 * ```tsx
 * const { parentRef, virtualItems, totalHeight, measureRef } = useVirtualList({
 *   count: commits.length,
 *   estimateSize: 88,
 * })
 *
 * return (
 *   <div ref={parentRef} style={{ height: 500, overflow: 'auto' }}>
 *     <div style={{ height: totalHeight, position: 'relative' }}>
 *       {virtualItems.map((virtualItem) => (
 *         <div
 *           key={virtualItem.key}
 *           ref={measureRef(virtualItem.index)}
 *           style={{ position: 'absolute', top: virtualItem.start, width: '100%' }}
 *         >
 *           {commits[virtualItem.index]}
 *         </div>
 *       ))}
 *     </div>
 *   </div>
 * )
 * ```
 *
 * @param options - Configuration for the virtual list
 * @returns parentRef, virtualItems, totalHeight, measureRef
 */
export function useVirtualList({
  count,
  estimateSize = 80,
  overscan = 5,
}: UseVirtualListOptions): UseVirtualListReturn {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  })

  const virtualItems = virtualizer.getVirtualItems()
  const totalHeight = virtualizer.getTotalSize()

  /**
   * Returns a callback ref that measures the rendered item at the given index.
   * Attach to each virtualItem's root DOM element to enable dynamic sizing.
   */
  const measureRef = useCallback(
    (index: number) => (el: Element | null) => {
      if (el) {
        virtualizer.measureElement(el)
      }
    },
    [virtualizer]
  )

  return {
    parentRef,
    virtualItems,
    totalHeight,
    measureRef,
  }
}
