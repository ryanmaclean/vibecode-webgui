/**
 * Vim-Style Keyboard Navigation Bindings
 * Provides vim keybinding configuration and utilities for power users
 */

/**
 * Vim navigation modes
 */
export type VimMode = 'normal' | 'insert'

/**
 * Vim key binding action types
 */
export type VimAction =
  | 'scroll-down'
  | 'scroll-up'
  | 'scroll-page-down'
  | 'scroll-page-up'
  | 'scroll-to-top'
  | 'scroll-to-bottom'
  | 'focus-next'
  | 'focus-previous'
  | 'navigate-forward'
  | 'navigate-back'
  | 'toggle-command-palette'
  | 'escape'

/**
 * Vim key binding configuration
 */
export interface VimBinding {
  key: string
  action: VimAction
  description: string
  mode?: VimMode
  requiresModifier?: boolean
}

/**
 * Scroll behavior configuration
 */
export interface ScrollConfig {
  smoothScroll: boolean
  scrollAmount: number
  pageScrollMultiplier: number
}

/**
 * Default scroll configuration
 */
export const DEFAULT_SCROLL_CONFIG: ScrollConfig = {
  smoothScroll: true,
  scrollAmount: 60,
  pageScrollMultiplier: 0.8,
}

/**
 * Core vim navigation bindings
 */
export const VIM_BINDINGS: VimBinding[] = [
  // Vertical navigation
  {
    key: 'j',
    action: 'scroll-down',
    description: 'Scroll down',
    mode: 'normal',
  },
  {
    key: 'k',
    action: 'scroll-up',
    description: 'Scroll up',
    mode: 'normal',
  },

  // Page navigation
  {
    key: 'd',
    action: 'scroll-page-down',
    description: 'Scroll page down',
    mode: 'normal',
    requiresModifier: true, // Ctrl+d
  },
  {
    key: 'u',
    action: 'scroll-page-up',
    description: 'Scroll page up',
    mode: 'normal',
    requiresModifier: true, // Ctrl+u
  },

  // Jump to top/bottom
  {
    key: 'g',
    action: 'scroll-to-top',
    description: 'Scroll to top',
    mode: 'normal',
  },
  {
    key: 'G',
    action: 'scroll-to-bottom',
    description: 'Scroll to bottom',
    mode: 'normal',
  },

  // Tab/focus navigation
  {
    key: 'Tab',
    action: 'focus-next',
    description: 'Focus next element',
  },
  {
    key: 'Tab',
    action: 'focus-previous',
    description: 'Focus previous element',
    requiresModifier: true, // Shift+Tab
  },

  // History navigation
  {
    key: 'h',
    action: 'navigate-back',
    description: 'Navigate back in history',
    mode: 'normal',
    requiresModifier: true, // Ctrl+h or Cmd+h
  },
  {
    key: 'l',
    action: 'navigate-forward',
    description: 'Navigate forward in history',
    mode: 'normal',
    requiresModifier: true, // Ctrl+l or Cmd+l
  },

  // Command palette
  {
    key: ':',
    action: 'toggle-command-palette',
    description: 'Open command palette',
    mode: 'normal',
  },

  // Escape
  {
    key: 'Escape',
    action: 'escape',
    description: 'Close modal/dropdown or exit insert mode',
  },
]

/**
 * Check if an element is an input field where vim shortcuts should be disabled
 */
export function isInputElement(element: HTMLElement | EventTarget | null): boolean {
  if (!element || !(element instanceof HTMLElement)) {
    return false
  }

  const tagName = element.tagName.toLowerCase()
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    element.isContentEditable
  )
}

/**
 * Check if vim mode is enabled
 * Reads from localStorage
 */
export function isVimModeEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    const stored = localStorage.getItem('vim-mode-enabled')
    return stored === 'true'
  } catch {
    return false
  }
}

/**
 * Enable or disable vim mode
 * Persists to localStorage
 */
export function setVimModeEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.setItem('vim-mode-enabled', String(enabled))
  } catch (error) {
    console.error('Failed to save vim mode preference:', error)
  }
}

/**
 * Get scroll configuration
 * Can be extended to read from user preferences
 */
export function getScrollConfig(): ScrollConfig {
  // Future: read from localStorage or user settings
  return DEFAULT_SCROLL_CONFIG
}

/**
 * Execute scroll action
 */
export function executeScrollAction(
  action: VimAction,
  config: ScrollConfig = DEFAULT_SCROLL_CONFIG
): void {
  const scrollOptions: ScrollToOptions = {
    behavior: config.smoothScroll ? 'smooth' : 'auto',
  }

  switch (action) {
    case 'scroll-down':
      window.scrollBy({
        top: config.scrollAmount,
        ...scrollOptions,
      })
      break

    case 'scroll-up':
      window.scrollBy({
        top: -config.scrollAmount,
        ...scrollOptions,
      })
      break

    case 'scroll-page-down':
      window.scrollBy({
        top: window.innerHeight * config.pageScrollMultiplier,
        ...scrollOptions,
      })
      break

    case 'scroll-page-up':
      window.scrollBy({
        top: -window.innerHeight * config.pageScrollMultiplier,
        ...scrollOptions,
      })
      break

    case 'scroll-to-top':
      window.scrollTo({
        top: 0,
        ...scrollOptions,
      })
      break

    case 'scroll-to-bottom':
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        ...scrollOptions,
      })
      break

    default:
      // Non-scroll actions are handled elsewhere
      break
  }
}

/**
 * Find vim binding for a key event
 */
export function findVimBinding(
  event: KeyboardEvent,
  mode: VimMode = 'normal'
): VimBinding | undefined {
  const { key, ctrlKey, metaKey, shiftKey } = event
  const hasModifier = ctrlKey || metaKey

  return VIM_BINDINGS.find((binding) => {
    // Check key match
    if (binding.key !== key) {
      return false
    }

    // Check mode (if specified)
    if (binding.mode && binding.mode !== mode) {
      return false
    }

    // Check modifier requirement
    if (binding.requiresModifier && !hasModifier) {
      return false
    }

    // For Shift+Tab, need to check shift key specifically
    if (binding.key === 'Tab' && binding.action === 'focus-previous') {
      return shiftKey
    }

    // For regular Tab, should not have shift
    if (binding.key === 'Tab' && binding.action === 'focus-next') {
      return !shiftKey
    }

    return true
  })
}

/**
 * Get vim bindings grouped by category for display
 */
export interface VimBindingCategory {
  name: string
  bindings: VimBinding[]
}

export function getVimBindingCategories(): VimBindingCategory[] {
  return [
    {
      name: 'Scrolling',
      bindings: VIM_BINDINGS.filter((b) =>
        ['scroll-down', 'scroll-up', 'scroll-page-down', 'scroll-page-up', 'scroll-to-top', 'scroll-to-bottom'].includes(b.action)
      ),
    },
    {
      name: 'Navigation',
      bindings: VIM_BINDINGS.filter((b) =>
        ['focus-next', 'focus-previous', 'navigate-back', 'navigate-forward'].includes(b.action)
      ),
    },
    {
      name: 'Commands',
      bindings: VIM_BINDINGS.filter((b) =>
        ['toggle-command-palette', 'escape'].includes(b.action)
      ),
    },
  ]
}

/**
 * Format vim binding key for display
 */
export function formatVimKey(binding: VimBinding): string {
  const parts: string[] = []

  if (binding.requiresModifier) {
    // Add Ctrl/Cmd modifier
    parts.push('⌘')
  }

  if (binding.key === 'Tab' && binding.action === 'focus-previous') {
    parts.push('⇧')
  }

  // Add the key itself
  const keyDisplay = binding.key === 'Tab' ? '⇥' : binding.key
  parts.push(keyDisplay)

  return parts.join('')
}
