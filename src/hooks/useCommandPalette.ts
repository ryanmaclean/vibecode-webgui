'use client'

import { useEffect, useCallback } from 'react'
import { useCommandPalette as useCommandPaletteContext } from '@/components/command-palette/CommandPaletteProvider'

/**
 * Command palette keyboard shortcuts hook.
 * Registers keydown listeners for Cmd+Shift+P and Cmd+K to open command palette,
 * and Escape to close it.
 */
export function useCommandPalette() {
  const { isOpen, openCommandPalette, closeCommandPalette, ...context } = useCommandPaletteContext()

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore shortcuts when typing in inputs / textareas / contenteditable
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      const mod = e.metaKey || e.ctrlKey

      // Cmd+Shift+P — open command palette
      if (mod && e.shiftKey && e.key === 'P') {
        e.preventDefault()
        openCommandPalette()
        return
      }

      // Cmd+K — open command palette
      if (mod && !e.shiftKey && e.key === 'k') {
        e.preventDefault()
        openCommandPalette()
        return
      }

      // Escape — close command palette (only if it's open)
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        closeCommandPalette()
        return
      }
    },
    [isOpen, openCommandPalette, closeCommandPalette]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return { isOpen, openCommandPalette, closeCommandPalette, ...context }
}
