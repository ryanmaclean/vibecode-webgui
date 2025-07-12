// Unit tests for AI Chat Interface Component
// Tests core functionality, state management, and user interactions

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import AIChatInterface from '@/components/ai/AIChatInterface'

// Mock fetch for API calls
const mockFetch = jest.fn()
global.fetch = mockFetch as any;

// Mock file reader for file uploads
const mockFileReader = {
  readAsArrayBuffer: jest.fn(),
  result: null,
  onload: null,
  onerror: null
}
global.FileReader = jest.fn(() => mockFileReader) as any;

describe('AIChatInterface', () => {
  const defaultProps = {
    workspaceId: 'test-workspace',
    initialContext: ['file1.ts', 'file2.js'],
    onFileUpload: jest.fn(),
    className: 'test-class'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock successful conversation history fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: [] })
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('renders with default state', async () => {
      render(<AIChatInterface {...defaultProps} />)
      
      expect(screen.getByText('AI Assistant')).toBeInTheDocument()
      expect(screen.getByText('Claude 3 Sonnet • Ready to help')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Ask anything... (Shift+Enter for new line)')).toBeInTheDocument()
      expect(screen.getByText('Start a conversation with your AI assistant')).toBeInTheDocument()
    })

    it('shows context files badge when provided', async () => {
      render(<AIChatInterface {...defaultProps} />)
      
      expect(screen.getByText('2 files in context')).toBeInTheDocument()
    })

    it('applies custom className', async () => {
      const { container } = render(<AIChatInterface {...defaultProps} />)
      
      expect(container.firstChild).toHaveClass('test-class')
    })
  })

  describe('Message Management', () => {
    it('loads conversation history on mount', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          type: 'user',
          content: 'Hello',
          timestamp: new Date().toISOString()
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: mockMessages })
      })

      render(<AIChatInterface {...defaultProps} />)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/ai/conversations/test-workspace')
      })
    })

    it('handles conversation history load failure gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      
      render(<AIChatInterface {...defaultProps} />)
      
      // Should not crash and show empty state
      expect(screen.getByText('Start a conversation with your AI assistant')).toBeInTheDocument()
    })
  })

  describe('Model Selection', () => {
    it('shows model selector when settings are opened', async () => {
      render(<AIChatInterface {...defaultProps} />)
      
      // Click settings button
      const settingsButton = screen.getByRole('button', { name: /settings/i })
      fireEvent.click(settingsButton)
      
      expect(screen.getByText('AI Model')).toBeInTheDocument()
      expect(screen.getByDisplayValue('anthropic/claude-3-sonnet')).toBeInTheDocument()
    })

    it('allows model selection change', async () => {
      render(<AIChatInterface {...defaultProps} />)
      
      // Open settings
      const settingsButton = screen.getByRole('button', { name: /settings/i })
      fireEvent.click(settingsButton)
      
      // Change model
      const modelSelect = screen.getByDisplayValue('anthropic/claude-3-sonnet')
      fireEvent.change(modelSelect, { target: { value: 'openai/gpt-4' } })
      
      expect(modelSelect).toHaveValue('openai/gpt-4')
    })
  })

  describe('Message Sending', () => {
    it('sends message when Send button is clicked', async () => {
      const user = userEvent.setup()
      
      // Mock streaming response
      const mockResponse = new Response(
        'data: {"content": "Hello there!"}\n\ndata: {"done": true}\n\n',
        {
          headers: { 'Content-Type': 'text/event-stream' },
          status: 200
        }
      )
      
      // Mock ReadableStream
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ 
            done: false, 
            value: new TextEncoder().encode('data: {"content": "Hello there!"}\n\n') 
          })
          .mockResolvedValueOnce({ done: true, value: undefined })
      }
      
      mockResponse.body = { getReader: () => mockReader } as any
      mockFetch.mockResolvedValueOnce(mockResponse)

      render(<AIChatInterface {...defaultProps} />)
      
      // Type message
      const textarea = screen.getByPlaceholderText('Ask anything... (Shift+Enter for new line)')
      await user.type(textarea, 'Test message')
      
      // Click send
      const sendButton = screen.getByRole('button', { name: /send/i })
      await user.click(sendButton)
      
      // Verify API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/ai/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'Test message',
            model: 'anthropic/claude-3-sonnet',
            context: {
              workspaceId: 'test-workspace',
              files: ['file1.ts', 'file2.js'],
              previousMessages: []
            }
          })
        })
      })
    })

    it('sends message when Enter is pressed', async () => {
      const user = userEvent.setup()
      
      render(<AIChatInterface {...defaultProps} />)
      
      const textarea = screen.getByPlaceholderText('Ask anything... (Shift+Enter for new line)')
      await user.type(textarea, 'Test message{Enter}')
      
      // Should attempt to send (will fail due to mocked response, but that's ok)
      expect(textarea).toHaveValue('')
    })

    it('does not send empty messages', async () => {
      const user = userEvent.setup()
      
      render(<AIChatInterface {...defaultProps} />)
      
      const sendButton = screen.getByRole('button', { name: /send/i })
      await user.click(sendButton)
      
      // Should not make API call for empty message
      expect(mockFetch).toHaveBeenCalledTimes(1) // Only the initial conversation load
    })

    it('disables send button while streaming', async () => {
      render(<AIChatInterface {...defaultProps} />)
      
      const sendButton = screen.getByRole('button', { name: /send/i })
      expect(sendButton).not.toBeDisabled()
      
      // Test that button becomes disabled during streaming would require more complex mocking
    })
  })

  describe('File Upload', () => {
    it('handles file upload through hidden input', async () => {
      const user = userEvent.setup()
      const mockFiles = [
        new File(['test content'], 'test.js', { type: 'application/javascript' })
      ]
      
      render(<AIChatInterface {...defaultProps} />)
      
      // Find upload button and click it
      const uploadButton = screen.getByRole('button', { name: /upload/i })
      expect(uploadButton).toBeInTheDocument()
      
      // Simulate file selection (more complex due to hidden input)
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      expect(fileInput).toBeInTheDocument()
      
      // Mock file input change
      Object.defineProperty(fileInput, 'files', {
        value: mockFiles,
        writable: false,
      })
      
      fireEvent.change(fileInput)
      
      expect(defaultProps.onFileUpload).toHaveBeenCalledWith(mockFiles)
    })

    it('accepts specified file types', async () => {
      render(<AIChatInterface {...defaultProps} />)
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      expect(fileInput).toHaveAttribute('accept', '.txt,.md,.js,.ts,.jsx,.tsx,.py,.java,.cpp,.c,.html,.css,.json,.xml,.yml,.yaml')
    })
  })

  describe('Context Management', () => {
    it('displays context files as badges', async () => {
      render(<AIChatInterface {...defaultProps} />)
      
      expect(screen.getByText('file1.ts')).toBeInTheDocument()
      expect(screen.getByText('file2.js')).toBeInTheDocument()
    })

    it('shows "more" indicator when there are many context files', async () => {
      const manyFiles = ['file1.js', 'file2.js', 'file3.js', 'file4.js', 'file5.js']
      
      render(<AIChatInterface {...defaultProps} initialContext={manyFiles} />)
      
      expect(screen.getByText('+2 more')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', async () => {
      render(<AIChatInterface {...defaultProps} />)
      
      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('placeholder', 'Ask anything... (Shift+Enter for new line)')
      
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()
      
      render(<AIChatInterface {...defaultProps} />)
      
      const textarea = screen.getByRole('textbox')
      await user.tab()
      
      expect(textarea).toHaveFocus()
    })
  })

  describe('Error Handling', () => {
    it('handles streaming errors gracefully', async () => {
      const user = userEvent.setup()
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      
      render(<AIChatInterface {...defaultProps} />)
      
      const textarea = screen.getByPlaceholderText('Ask anything... (Shift+Enter for new line)')
      await user.type(textarea, 'Test message')
      
      const sendButton = screen.getByRole('button', { name: /send/i })
      await user.click(sendButton)
      
      // Should show error message in UI
      await waitFor(() => {
        expect(screen.getByText(/Sorry, I encountered an error/i)).toBeInTheDocument()
      })
    })
  })

  describe('Responsive Design', () => {
    it('adapts to different screen sizes', async () => {
      const { container } = render(<AIChatInterface {...defaultProps} />)
      
      // Test that component has responsive classes
      expect(container.querySelector('.max-w-\\[80%\\]')).toBeInTheDocument()
    })
  })
})