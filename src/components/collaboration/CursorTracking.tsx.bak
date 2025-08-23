/**
 * Cursor Tracking and Selection Sharing Component
 *
 * Advanced real-time cursor position tracking and selection sharing
 * with smooth animations and collaborative editing features
 *
 * Staff Engineer Implementation - Enterprise-grade cursor collaboration
 */

'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { useCollaboration } from '../../hooks/useCollaboration'

export interface CursorPosition {
  line: number
  column: number
  offset: number
}

export interface SelectionRange {
  start: CursorPosition
  end: CursorPosition
  direction: 'forward' | 'backward'
}

export interface UserCursor {
  userId: string
  userName: string
  userColor: string
  position: CursorPosition
  selection?: SelectionRange
  isVisible: boolean
  lastUpdate: number
  metadata?: {
    isActive: boolean
    isTyping: boolean
    viewportVisible: boolean
  }
}

export interface CursorTrackingProps {
  editorView: EditorView | null
  sessionId: string
  currentUserId: string
  showCursorLabels?: boolean
  showSelections?: boolean
  cursorBlinkInterval?: number
  cursorFadeTimeout?: number
  className?: string
  onCursorClick?: (cursor: UserCursor) => void
}

const CURSOR_FADE_TIMEOUT = 5000 // 5 seconds
const CURSOR_BLINK_INTERVAL = 1000 // 1 second
const POSITION_UPDATE_THROTTLE = 100 // 100ms

export default function CursorTracking({
  editorView,
  sessionId,
  currentUserId,
  showCursorLabels = true,
  showSelections = true,
  cursorBlinkInterval = CURSOR_BLINK_INTERVAL,
  cursorFadeTimeout = CURSOR_FADE_TIMEOUT,
  className = '',
  onCursorClick
}: CursorTrackingProps) {
  const { collaborationManager, awareness } = useCollaboration()
  const [cursors, setCursors] = useState<Map<string, UserCursor>>(new Map())
  const [editorRect, setEditorRect] = useState<DOMRect | null>(null)
  const lastUpdateRef = useRef<number>(0)
  const updateTimeoutRef = useRef<NodeJS.Timeout>()

  /**
   * Convert editor position to screen coordinates
   */
  const getScreenPosition = useCallback((position: CursorPosition): { x: number; y: number } | null => {
    if (!editorView || !editorRect) return null

    try {
      const pos = editorView.state.doc.line(position.line + 1).from + position.column
      const coords = editorView.coordsAtPos(pos)

      if (!coords) return null

      return {
        x: coords.left - editorRect.left,
        y: coords.top - editorRect.top
      }
    } catch (error) {
      console.warn('Failed to get screen position:', error)
      return null
    }
  }, [editorView, editorRect])

  /**
   * Convert screen coordinates to editor position
   */
  const getEditorPosition = useCallback((x: number, y: number): CursorPosition | null => {
    if (!editorView || !editorRect) return null

    try {
      const pos = editorView.posAtCoords({
        x: x + editorRect.left,
        y: y + editorRect.top
      })

      if (pos === null) return null

      const line = editorView.state.doc.lineAt(pos)
      const column = pos - line.from

      return {
        line: line.number - 1, // Convert to 0-based
        column,
        offset: pos
      }
    } catch (error) {
      console.warn('Failed to get editor position:', error)
      return null
    }
  }, [editorView, editorRect])

  /**
   * Update editor measurements
   */
  const updateEditorRect = useCallback(() => {
    if (!editorView) return

    const dom = editorView.dom
    const rect = dom.getBoundingClientRect()
    setEditorRect(rect)
  }, [editorView])

  /**
   * Get current cursor position and selection
   */
  const getCurrentPosition = useCallback((): { position: CursorPosition; selection?: SelectionRange } | null => {
    if (!editorView) return null

    try {
      const state = editorView.state
      const selection = state.selection.main

      // Main cursor position
      const mainLine = state.doc.lineAt(selection.head)
      const position: CursorPosition = {
        line: mainLine.number - 1,
        column: selection.head - mainLine.from,
        offset: selection.head
      }

      // Selection range (if any)
      let selectionRange: SelectionRange | undefined
      if (!selection.empty) {
        const startLine = state.doc.lineAt(selection.from)
        const endLine = state.doc.lineAt(selection.to)

        selectionRange = {
          start: {
            line: startLine.number - 1,
            column: selection.from - startLine.from,
            offset: selection.from
          },
          end: {
            line: endLine.number - 1,
            column: selection.to - endLine.from,
            offset: selection.to
          },
          direction: selection.head === selection.to ? 'forward' : 'backward'
        }
      }

      return { position, selection: selectionRange }
    } catch (error) {
      console.warn('Failed to get current position:', error)
      return null
    }
  }, [editorView])

  /**
   * Throttled position update
   */
  const updatePosition = useCallback(() => {
    const now = Date.now()
    if (now - lastUpdateRef.current < POSITION_UPDATE_THROTTLE) return

    lastUpdateRef.current = now

    const current = getCurrentPosition()
    if (!current || !awareness) return

    // Update awareness with cursor position
    awareness.setLocalStateField('cursor', {
      userId: currentUserId,
      position: current.position,
      selection: current.selection,
      timestamp: now,
      isActive: true,
      isTyping: false // Will be set to true on actual typing
    })

    // Clear typing indicator after delay
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }

    updateTimeoutRef.current = setTimeout(() => {
      const currentState = awareness.getLocalState()
      if (currentState?.cursor) {
        awareness.setLocalStateField('cursor', {
          ...currentState.cursor,
          isTyping: false
        })
      }
    }, 1000)
  }, [getCurrentPosition, awareness, currentUserId])

  /**
   * Handle typing events
   */
  const handleTyping = useCallback(() => {
    if (!awareness) return

    const current = getCurrentPosition()
    if (!current) return

    awareness.setLocalStateField('cursor', {
      userId: currentUserId,
      position: current.position,
      selection: current.selection,
      timestamp: Date.now(),
      isActive: true,
      isTyping: true
    })
  }, [awareness, currentUserId, getCurrentPosition])

  /**
   * Handle awareness updates
   */
  useEffect(() => {
    if (!awareness) return

    const handleAwarenessUpdate = () => {
      const states = awareness.getStates()
      const newCursors = new Map<string, UserCursor>()

      states.forEach((state, clientId) => {
        if (state.cursor && state.cursor.userId !== currentUserId) {
          const user = state.user || {}
          const cursor: UserCursor = {
            userId: state.cursor.userId,
            userName: user.name || `User ${state.cursor.userId.slice(0, 8)}`,
            userColor: user.color || '#4ECDC4',
            position: state.cursor.position,
            selection: state.cursor.selection,
            isVisible: Date.now() - state.cursor.timestamp < cursorFadeTimeout,
            lastUpdate: state.cursor.timestamp,
            metadata: {
              isActive: state.cursor.isActive || false,
              isTyping: state.cursor.isTyping || false,
              viewportVisible: true // TODO: Check if cursor is in viewport
            }
          }
          newCursors.set(state.cursor.userId, cursor)
        }
      })

      setCursors(newCursors)
    }

    awareness.on('update', handleAwarenessUpdate)
    handleAwarenessUpdate() // Initial load

    return () => {
      awareness.off('update', handleAwarenessUpdate)
    }
  }, [awareness, currentUserId, cursorFadeTimeout])

  /**
   * Set up editor event listeners
   */
  useEffect(() => {
    if (!editorView) return

    // Update editor rect on resize
    const resizeObserver = new ResizeObserver(updateEditorRect)
    resizeObserver.observe(editorView.dom)
    updateEditorRect() // Initial measurement

    // Listen for cursor/selection changes
    const updateHandler = EditorView.updateListener.of((update) => {
      if (update.selectionSet || update.docChanged) {
        updatePosition()
      }

      if (update.docChanged) {
        handleTyping()
      }
    })

    const view = EditorView.theme({}, { priority: 'low' })
    editorView.dispatch({
      effects: [
        EditorView.appendConfig.of([updateHandler, view])
      ]
    })

    return () => {
      resizeObserver.disconnect()
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [editorView, updatePosition, handleTyping, updateEditorRect])

  /**
   * Render cursor element
   */
  const renderCursor = useCallback((cursor: UserCursor) => {
    const screenPos = getScreenPosition(cursor.position)
    if (!screenPos) return null

    return (
      <motion.div
        key={cursor.userId}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: cursor.isVisible ? 1 : 0,
          scale: 1,
          x: screenPos.x,
          y: screenPos.y
        }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="absolute pointer-events-none z-50"
        style={{ transform: 'translate(0, 0)' }} // Reset transform for motion
      >
        {/* Cursor line */}
        <motion.div
          animate={{
            opacity: cursor.metadata?.isTyping ? [1, 0.3, 1] : 1
          }}
          transition={{
            duration: cursor.metadata?.isTyping ? 0.5 : 0,
            repeat: cursor.metadata?.isTyping ? Infinity : 0
          }}
          className="w-0.5 h-5 rounded-sm"
          style={{ backgroundColor: cursor.userColor }}
        />

        {/* Cursor label */}
        {showCursorLabels && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-0 left-2 whitespace-nowrap"
          >
            <div
              className="px-2 py-1 rounded text-white text-xs font-medium shadow-lg flex items-center gap-1"
              style={{ backgroundColor: cursor.userColor }}
            >
              {cursor.userName}
              {cursor.metadata?.isTyping && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="w-1 h-1 bg-white rounded-full"
                />
              )}
            </div>
            {/* Arrow */}
            <div
              className="w-0 h-0 border-l-2 border-r-2 border-t-4 border-transparent"
              style={{ borderTopColor: cursor.userColor }}
            />
          </motion.div>
        )}
      </motion.div>
    )
  }, [getScreenPosition, showCursorLabels])

  /**
   * Render selection overlay
   */
  const renderSelection = useCallback((cursor: UserCursor) => {
    if (!cursor.selection || !showSelections) return null

    const startPos = getScreenPosition(cursor.selection.start)
    const endPos = getScreenPosition(cursor.selection.end)

    if (!startPos || !endPos) return null

    // Simple single-line selection for now
    // TODO: Handle multi-line selections
    const isMultiLine = cursor.selection.start.line !== cursor.selection.end.line

    if (isMultiLine) {
      // For multi-line selections, we'd need to render multiple rectangles
      return null
    }

    const left = Math.min(startPos.x, endPos.x)
    const right = Math.max(startPos.x, endPos.x)
    const width = right - left
    const height = 20 // Approximate line height

    return (
      <motion.div
        key={`${cursor.userId}-selection`}
        initial={{ opacity: 0 }}
        animate={{
          opacity: 0.3,
          x: left,
          y: startPos.y
        }}
        exit={{ opacity: 0 }}
        className="absolute pointer-events-none z-40 rounded-sm"
        style={{
          backgroundColor: cursor.userColor,
          width: width + 'px',
          height: height + 'px',
          transform: 'translate(0, 0)' // Reset transform for motion
        }}
      />
    )
  }, [getScreenPosition, showSelections])

  /**
   * Get visible cursors
   */
  const visibleCursors = useMemo(() => {
    return Array.from(cursors.values()).filter(cursor =>
      cursor.isVisible && cursor.metadata?.viewportVisible
    )
  }, [cursors])

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}>
      <AnimatePresence>
        {/* Render selections first (behind cursors) */}
        {visibleCursors.map(cursor => renderSelection(cursor))}

        {/* Render cursors */}
        {visibleCursors.map(cursor => renderCursor(cursor))}
      </AnimatePresence>
    </div>
  )
}
