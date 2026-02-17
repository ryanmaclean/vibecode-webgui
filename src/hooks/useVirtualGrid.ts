import { useRef, useState, useEffect, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { VirtualItem } from '@tanstack/react-virtual'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Configuration options for useVirtualGrid
 */
export interface UseVirtualGridOptions {
  /** Total number of items in the grid */
  count: number
  /** Estimated height of each row in pixels (default: 300) */
  estimateSize?: number
  /** Number of rows to render outside the visible window for smoother scrolling (default: 3) */
  overscan?: number
}

/**
 * Return value from useVirtualGrid
 */
export interface UseVirtualGridReturn {
  /** Ref to attach to the scroll container element */
  parentRef: React.RefObject<HTMLDivElement | null>
  /** Virtual row items to render (only visible rows + overscan) */
  virtualRows: VirtualItem[]
  /** Number of columns in the current responsive grid layout */
  columnCount: number
  /** Total height of all rows in pixels — use as height of inner spacer div */
  totalHeight: number
  /** Total number of rows (Math.ceil(count / columnCount)) */
  rowCount: number
  /** Callback ref to measure dynamic row sizes; attach to each rendered row element */
  measureRef: (index: number) => (el: Element | null) => void
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Computes responsive column count based on container width.
 *
 * Breakpoints mirror the AgentMarketplace grid:
 * - < 768px  → 1 column  (mobile)
 * - < 1024px → 2 columns (tablet, md)
 * - ≥ 1024px → 3 columns (desktop, lg)
 */
function getColumnCount(width: number): number {
  if (width < 768) return 1
  if (width < 1024) return 2
  return 3
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Virtualizes a responsive CSS grid so only visible rows are rendered in the DOM.
 *
 * Wraps @tanstack/react-virtual's useVirtualizer with responsive breakpoint
 * awareness for multi-column grid layouts (e.g. AgentMarketplace).
 *
 * Items are chunked into rows based on the current column count. A ResizeObserver
 * tracks container width and recalculates column/row count on resize.
 *
 * Usage:
 * ```tsx
 * const { parentRef, virtualRows, columnCount, totalHeight, measureRef } = useVirtualGrid({
 *   count: agents.length,
 *   estimateSize: 280,
 * })
 *
 * return (
 *   <div ref={parentRef} style={{ height: 600, overflow: 'auto' }}>
 *     <div style={{ height: totalHeight, position: 'relative' }}>
 *       {virtualRows.map((virtualRow) => {
 *         const startIndex = virtualRow.index * columnCount
 *         return (
 *           <div
 *             key={virtualRow.key}
 *             ref={measureRef(virtualRow.index)}
 *             style={{
 *               position: 'absolute',
 *               top: virtualRow.start,
 *               width: '100%',
 *               display: 'grid',
 *               gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
 *               gap: '1rem',
 *             }}
 *           >
 *             {Array.from({ length: columnCount }, (_, col) => {
 *               const itemIndex = startIndex + col
 *               if (itemIndex >= agents.length) return null
 *               return <AgentCard key={agents[itemIndex].id} agent={agents[itemIndex]} />
 *             })}
 *           </div>
 *         )
 *       })}
 *     </div>
 *   </div>
 * )
 * ```
 *
 * @param options - Configuration for the virtual grid
 * @returns parentRef, virtualRows, columnCount, totalHeight, rowCount, measureRef
 */
export function useVirtualGrid({
  count,
  estimateSize = 300,
  overscan = 3,
}: UseVirtualGridOptions): UseVirtualGridReturn {
  const parentRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  // Track container width with ResizeObserver so column count stays in sync
  // with the actual rendered width (handles SSR, window resize, sidebar toggles).
  useEffect(() => {
    const element = parentRef.current
    if (!element) return

    // Capture initial width immediately after mount
    setContainerWidth(element.getBoundingClientRect().width)

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setContainerWidth(entry.contentRect.width)
      }
    })

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [])

  // Default to 1 column until ResizeObserver reports a real width
  const columnCount = containerWidth > 0 ? getColumnCount(containerWidth) : 1
  const rowCount = count > 0 ? Math.ceil(count / columnCount) : 0

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  })

  const virtualRows = virtualizer.getVirtualItems()
  const totalHeight = virtualizer.getTotalSize()

  /**
   * Returns a callback ref that measures the rendered row at the given index.
   * Attach to each virtualRow's root DOM element to enable dynamic row sizing.
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
    virtualRows,
    columnCount,
    totalHeight,
    rowCount,
    measureRef,
  }
}
