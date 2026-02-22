/**
 * Global Command Palette Component
 * Renders the command palette at the app root level and registers all commands.
 * Ensures command palette is accessible from any page via Cmd+Shift+P or Cmd+K.
 */

'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CommandPalette } from './CommandPalette'
import { useCommandPalette } from '@/hooks/useCommandPalette'
import { getAllCommands } from './commands'

export function GlobalCommandPalette() {
  const { isOpen, closeCommandPalette, registerCommands } = useCommandPalette()
  const router = useRouter()

  // Create navigate function using Next.js router
  const navigate = useCallback(
    (path: string) => {
      router.push(path)
      closeCommandPalette()
    },
    [router, closeCommandPalette]
  )

  // Register all commands on mount and when navigate changes
  useEffect(() => {
    const commands = getAllCommands(navigate)
    registerCommands(commands)
  }, [navigate, registerCommands])

  return (
    <CommandPalette
      isOpen={isOpen}
      onClose={closeCommandPalette}
    />
  )
}
