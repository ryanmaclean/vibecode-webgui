/**
 * Command Palette Provider
 * Manages global state for the command palette component
 */

'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode, ElementType } from 'react'

export interface Command {
  id: string
  label: string
  category: string
  keywords?: string[]
  icon?: ElementType
  shortcut?: string
  action: () => void | Promise<void>
}

export interface CommandPaletteContextType {
  isOpen: boolean
  commands: Command[]
  openCommandPalette: () => void
  closeCommandPalette: () => void
  toggleCommandPalette: () => void
  registerCommand: (command: Command) => void
  registerCommands: (commands: Command[]) => void
  unregisterCommand: (commandId: string) => void
  clearCommands: () => void
}

const CommandPaletteContext = createContext<CommandPaletteContextType | undefined>(undefined)

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [commands, setCommands] = useState<Command[]>([])

  const openCommandPalette = useCallback(() => {
    setIsOpen(true)
  }, [])

  const closeCommandPalette = useCallback(() => {
    setIsOpen(false)
  }, [])

  const toggleCommandPalette = useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  const registerCommand = useCallback((command: Command) => {
    setCommands(prev => {
      // Remove existing command with same ID if it exists
      const filtered = prev.filter(cmd => cmd.id !== command.id)
      return [...filtered, command]
    })
  }, [])

  const registerCommands = useCallback((newCommands: Command[]) => {
    setCommands(prev => {
      // Get IDs of new commands
      const newIds = new Set(newCommands.map(cmd => cmd.id))
      // Remove existing commands with same IDs
      const filtered = prev.filter(cmd => !newIds.has(cmd.id))
      return [...filtered, ...newCommands]
    })
  }, [])

  const unregisterCommand = useCallback((commandId: string) => {
    setCommands(prev => prev.filter(cmd => cmd.id !== commandId))
  }, [])

  const clearCommands = useCallback(() => {
    setCommands([])
  }, [])

  return (
    <CommandPaletteContext.Provider
      value={{
        isOpen,
        commands,
        openCommandPalette,
        closeCommandPalette,
        toggleCommandPalette,
        registerCommand,
        registerCommands,
        unregisterCommand,
        clearCommands,
      }}
    >
      {children}
    </CommandPaletteContext.Provider>
  )
}

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext)
  if (context === undefined) {
    throw new Error('useCommandPalette must be used within a CommandPaletteProvider')
  }
  return context
}
