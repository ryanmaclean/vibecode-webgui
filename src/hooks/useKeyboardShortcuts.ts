'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { ShortcutCategory } from '@/design-system/components/KeyboardShortcuts'

/**
 * Global keyboard shortcuts hook.
 * Registers keydown listeners for navigation and modal toggle.
 */
export function useKeyboardShortcuts() {
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const router = useRouter()

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

      // Cmd+/ — toggle shortcuts modal
      if (mod && e.key === '/') {
        e.preventDefault()
        setIsShortcutsOpen((prev) => !prev)
        return
      }

      // Cmd+T — VM dashboard
      if (mod && !e.shiftKey && e.key === 't') {
        e.preventDefault()
        router.push('/vm')
        return
      }

      // Cmd+O — Editor
      if (mod && !e.shiftKey && e.key === 'o') {
        e.preventDefault()
        router.push('/editor')
        return
      }

      // Cmd+Shift+S — Settings
      if (mod && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        router.push('/settings')
        return
      }

      // Cmd+Shift+H — Health
      if (mod && e.shiftKey && e.key === 'H') {
        e.preventDefault()
        router.push('/health')
        return
      }
    },
    [router]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return { isShortcutsOpen, setIsShortcutsOpen }
}

/**
 * Shortcut categories shown in the modal.
 */
export const shortcutCategories: ShortcutCategory[] = [
  {
    name: 'Global',
    shortcuts: [
      { keys: ['⌘', '/'], description: 'Toggle keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close modal / dropdown' },
      { keys: ['⌘', 'K'], description: 'Open command palette' },
      { keys: ['⌘', 'F'], description: 'Search' },
    ],
  },
  {
    name: 'Navigation',
    shortcuts: [
      { keys: ['⌘', 'T'], description: 'Go to VM dashboard' },
      { keys: ['⌘', 'O'], description: 'Open editor' },
      { keys: ['⌘', 'Shift', 'S'], description: 'Open settings' },
      { keys: ['⌘', 'Shift', 'H'], description: 'Open health monitor' },
    ],
  },
  {
    name: 'VM Management',
    shortcuts: [
      { keys: ['⌘', '↵'], description: 'Send command', context: 'Terminal focused' },
      { keys: ['⌘', 'Shift', 'C'], description: 'Copy terminal output', context: 'Terminal focused' },
      { keys: ['⌘', 'Shift', 'V'], description: 'Paste into terminal', context: 'Terminal focused' },
    ],
  },
  {
    name: 'AI Tools',
    shortcuts: [
      { keys: ['⌘', '↵'], description: 'Send message', context: 'Chat input focused' },
      { keys: ['Shift', '↵'], description: 'New line in input', context: 'Chat input focused' },
      { keys: ['↑'], description: 'Edit last message', context: 'Chat input empty' },
      { keys: ['⌘', 'Shift', 'M'], description: 'Switch model', context: 'Chat view' },
    ],
  },
]
