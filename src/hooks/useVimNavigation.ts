'use client'

import { useEffect, useCallback } from 'react'
import {
  isVimModeEnabled,
  isInputElement,
  findVimBinding,
  executeScrollAction,
  getScrollConfig,
} from '@/lib/keyboard/vim-bindings'

/**
 * Vim-style navigation hook.
 * Registers keydown listeners for vim-style j/k scrolling and other vim bindings.
 * Only active when vim mode is enabled in settings.
 */
export function useVimNavigation() {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only process vim shortcuts when vim mode is enabled
    if (!isVimModeEnabled()) {
      return
    }

    // Ignore shortcuts when typing in inputs / textareas / contenteditable
    const target = e.target as HTMLElement
    if (isInputElement(target)) {
      return
    }

    // Find matching vim binding
    const binding = findVimBinding(e, 'normal')
    if (!binding) {
      return
    }

    // Handle scroll actions
    const scrollActions = [
      'scroll-down',
      'scroll-up',
      'scroll-page-down',
      'scroll-page-up',
      'scroll-to-top',
      'scroll-to-bottom',
    ]

    if (scrollActions.includes(binding.action)) {
      e.preventDefault()
      const config = getScrollConfig()
      executeScrollAction(binding.action, config)
    }

    // Other actions (navigation, command palette, etc.) are handled by other hooks
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
