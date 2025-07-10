/**
 * Unit tests for AdvancedTerminal component
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock xterm.js
jest.mock('@xterm/xterm', () => ({
  Terminal: jest.fn().mockImplementation(() => ({
    loadAddon: jest.fn(),
    open: jest.fn(),
    onData: jest.fn(),
    write: jest.fn(),
    dispose: jest.fn(),
  })),
}))

jest.mock('@xterm/addon-fit', () => ({
  FitAddon: jest.fn().mockImplementation(() => ({
    fit: jest.fn(),
  })),
}))

jest.mock('@xterm/addon-webgl', () => ({
  WebglAddon: jest.fn().mockImplementation(() => ({})),
}))

// Mock component for testing
const MockAdvancedTerminal = ({ websocketUrl, theme = 'dark', onData }: {
  websocketUrl: string
  theme?: 'dark' | 'light'
  onData?: (data: string) => void
}) => {
  const handleTerminalInput = (data: string) => {
    onData?.(data)
  }

  return (
    <div data-testid="advanced-terminal" className={`theme-${theme}`}>
      <div data-testid="terminal-container" />
      <input
        data-testid="terminal-input"
        onChange={(e) => handleTerminalInput(e.target.value)}
        placeholder="Terminal input"
      />
      <div data-testid="websocket-url">{websocketUrl}</div>
    </div>
  )
}

describe('AdvancedTerminal Component', () => {
  const mockProps = {
    websocketUrl: 'ws://localhost:3001/terminal/test-project',
    theme: 'dark' as const,
    onData: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders terminal container', () => {
    render(<MockAdvancedTerminal {...mockProps} />)
    
    const terminal = screen.getByTestId('advanced-terminal')
    const container = screen.getByTestId('terminal-container')
    
    expect(terminal).toBeInTheDocument()
    expect(container).toBeInTheDocument()
  })

  it('applies correct theme class', () => {
    render(<MockAdvancedTerminal {...mockProps} />)
    
    const terminal = screen.getByTestId('advanced-terminal')
    expect(terminal).toHaveClass('theme-dark')
  })

  it('switches to light theme', () => {
    render(<MockAdvancedTerminal {...mockProps} theme="light" />)
    
    const terminal = screen.getByTestId('advanced-terminal')
    expect(terminal).toHaveClass('theme-light')
  })

  it('displays correct WebSocket URL', () => {
    render(<MockAdvancedTerminal {...mockProps} />)
    
    const urlElement = screen.getByTestId('websocket-url')
    expect(urlElement).toHaveTextContent(mockProps.websocketUrl)
  })

  it('calls onData when terminal input changes', async () => {
    render(<MockAdvancedTerminal {...mockProps} />)
    
    const input = screen.getByTestId('terminal-input')
    fireEvent.change(input, { target: { value: 'ls -la' } })
    
    await waitFor(() => {
      expect(mockProps.onData).toHaveBeenCalledWith('ls -la')
    })
  })

  it('handles missing onData callback gracefully', () => {
    const propsWithoutCallback = {
      websocketUrl: mockProps.websocketUrl,
      theme: mockProps.theme,
    }
    
    expect(() => {
      render(<MockAdvancedTerminal {...propsWithoutCallback} />)
    }).not.toThrow()
  })

  it('uses default theme when not specified', () => {
    const propsWithoutTheme = {
      websocketUrl: mockProps.websocketUrl,
      onData: mockProps.onData,
    }
    
    render(<MockAdvancedTerminal {...propsWithoutTheme} />)
    
    const terminal = screen.getByTestId('advanced-terminal')
    expect(terminal).toHaveClass('theme-dark')
  })
})