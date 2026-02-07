'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'

interface EnhancedTerminalProps {
  onCommand?: (command: string) => void
  className?: string
}

const THEME = {
  background: '#1f2937',
  foreground: '#e5e7eb',
  cursor: '#10b981',
  green: '#10b981',
  red: '#ef4444',
  yellow: '#f59e0b',
  blue: '#3b82f6',
  magenta: '#8b5cf6',
  cyan: '#06b6d4',
  white: '#f9fafb',
  black: '#111827',
}

export function EnhancedTerminal({ onCommand, className }: EnhancedTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [currentInput, setCurrentInput] = useState('')
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])

  const generateAISuggestions = useCallback(async (input: string) => {
    if (input.length < 2) {
      setAiSuggestions([])
      return
    }

    const commonCommands = [
      'ls -la',
      'cd ..',
      'git status',
      'git log --oneline',
      'npm install',
      'npm run dev',
      'docker ps',
      'cat package.json',
    ]

    const filtered = commonCommands.filter((cmd) =>
      cmd.toLowerCase().startsWith(input.toLowerCase())
    )
    setAiSuggestions(filtered.slice(0, 3))
  }, [])

  useEffect(() => {
    if (!terminalRef.current) return

    const terminal = new Terminal({
      theme: THEME,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      cursorBlink: true,
      cursorStyle: 'block',
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(terminalRef.current)
    fitAddon.fit()

    xtermRef.current = terminal
    fitAddonRef.current = fitAddon

    terminal.writeln('Welcome to VibeCode Enhanced Terminal')
    terminal.write('$ ')

    return () => {
      terminal.dispose()
    }
  }, [])

  return (
    <div className={className}>
      <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

export default EnhancedTerminal
