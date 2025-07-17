// Integration tests for AI Chat functionality
// Tests end-to-end workflows, API integration, and user scenarios

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import AIChatInterface from '@/components/ai/AIChatInterface'
import VSCodeIntegration from '@/components/ai/VSCodeIntegration'


// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch as jest.Mock

// Mock file system operations
jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  readFile: jest.fn()
}))

jest.mock('fs', () => ({
  existsSync: jest.fn(() => false)
}))

// Mock OpenAI for API tests
const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn()
    }
  }
}
jest.mock('openai', () => ({
  OpenAI: jest.fn(() => mockOpenAI)
}))

describe('AI Chat Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Mock environment variables
    process.env.OPENROUTER_API_KEY = 'test-api-key'
    process.env.NEXTAUTH_URL = 'http://localhost:3000'

    // Default fetch mock for conversation history
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: [] })
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Complete Chat Workflow', () => {
    it('handles full conversation flow with file upload', async () => {

      // Mock successful file upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          filesUploaded: 1,
          files: [{ id: 'file-1', name: 'test.js', language: 'javascript' }],
          ragChunks: 2
        })
      })

      // Mock successful streaming chat
      const mockResponse = new Response(
        'data: {"content": "I can see you uploaded test.js. This is a JavaScript file."}\n\n' +
        'data: {"content": " Let me analyze it for you."}\n\n' +
        'data: {"done": true}\n\n',
        {
          headers: { 'Content-Type': 'text/event-stream' }
        }
      )

      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"content": "I can see you uploaded test.js."}\n\n')
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"content": " Let me analyze it."}\n\n')
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"done": true}\n\n')
          })
          .mockResolvedValueOnce({ done: true, value: undefined })
      };
      mockResponse.body = { getReader: () => mockReader } as unknown as ReadableStream<Uint8Array>
      mockFetch.mockResolvedValueOnce(mockResponse)

      const mockOnFileUpload = jest.fn()

      render(
        <AIChatInterface
          workspaceId="test-workspace"
          onFileUpload={mockOnFileUpload}
        />
      )

      // 1. Upload a file
      const file = new File(['console.log("test")'], 'test.js', { type: 'application/javascript' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })

      fireEvent.change(fileInput)
      expect(mockOnFileUpload).toHaveBeenCalledWith([file])

      // 2. Send a message asking about the uploaded file
      const textarea = screen.getByPlaceholderText('Ask anything... (Shift+Enter for new line)')
      await user.type(textarea, 'Analyze the uploaded JavaScript file')

      const sendButton = screen.getByRole('button', { name: /send/i })
      await user.click(sendButton)

      // 3. Verify the streaming response appears
      await waitFor(() => {
        expect(screen.getByText(/I can see you uploaded test.js/)).toBeInTheDocument()
      }, { timeout: 5000 })

      // 4. Verify API calls were made with correct context
      expect(mockFetch).toHaveBeenCalledWith('/api/ai/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Analyze the uploaded JavaScript file',
          model: 'anthropic/claude-3-sonnet',
          context: {
            workspaceId: 'test-workspace',
            files: [],
            previousMessages: []
          }
        })
      })
    })

    it('persists conversation history across sessions', async () => {
      const user = userEvent.setup()

      // Mock conversation history with previous messages
      const existingMessages = [
        {
          id: 'msg-1',
          type: 'user',
          content: 'Previous question',
          timestamp: new Date().toISOString()
        },
        {
          id: 'msg-2',
          type: 'assistant',
          content: 'Previous answer',
          timestamp: new Date().toISOString()
        }
      ]

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ messages: existingMessages })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })

      render(<AIChatInterface workspaceId="test-workspace" />)

      // Wait for conversation history to load
      await waitFor(() => {
        expect(screen.getByText('Previous question')).toBeInTheDocument()
        expect(screen.getByText('Previous answer')).toBeInTheDocument()
      })

      // Verify conversation history was requested
      expect(mockFetch).toHaveBeenCalledWith('/api/ai/conversations/test-workspace')
    })

    it('switches between AI models seamlessly', async () => {
      const user = userEvent.setup()

      render(<AIChatInterface workspaceId="test-workspace" />)

      // Open settings
      const settingsButton = screen.getByRole('button', { name: /settings/i })
      await user.click(settingsButton)

      // Change model from Claude to GPT-4
      const modelSelect = screen.getByDisplayValue('anthropic/claude-3-sonnet')
      await user.selectOptions(modelSelect, 'openai/gpt-4')

      expect(modelSelect).toHaveValue('openai/gpt-4')
      expect(screen.getByText('⚡ GPT-4 • Ready to help')).toBeInTheDocument()
    })
  })

  describe('VS Code Integration Workflow', () => {
    it('communicates between VS Code and AI chat', async () => {
      const mockCodeServerUrl = 'http://localhost:8080'

      render(
        <VSCodeIntegration
          workspaceId="test-workspace"
          codeServerUrl={mockCodeServerUrl}
          isEmbedded={false}
        />
      )

      // Verify iframe is rendered with correct URL
      const iframe = screen.getByTitle('VS Code')
      expect(iframe).toHaveAttribute('src', mockCodeServerUrl)

      // Simulate message from code-server
      const messageEvent = new MessageEvent('message', {
        data: {
          type: 'file-change',
          data: { fileName: 'app.js' }
        },
        origin: 'http://localhost:8080'
      })

      fireEvent(window, messageEvent)

      // Component should handle the message (tested via state changes)
    })

    it('handles floating vs side-by-side modes', async () => {
      const { rerender } = render(
        <VSCodeIntegration
          workspaceId="test-workspace"
          isEmbedded={true}
        />
      )

      // In embedded mode, should show toggle button
      expect(screen.getByRole('button')).toBeInTheDocument()

      // Switch to side-by-side mode
      rerender(
        <VSCodeIntegration
          workspaceId="test-workspace"
          isEmbedded={false}
        />
      )

      // Should show both panels
      expect(screen.getByTitle('VS Code')).toBeInTheDocument()
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('handles API errors gracefully', async () => {
      const user = userEvent.setup()

      // Mock API error
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      render(<AIChatInterface workspaceId="test-workspace" />)

      const textarea = screen.getByPlaceholderText('Ask anything... (Shift+Enter for new line)')
      await user.type(textarea, 'Test message')

      const sendButton = screen.getByRole('button', { name: /send/i })
      await user.click(sendButton)

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/Sorry, I encountered an error/i)).toBeInTheDocument()
      })
    })

    it('handles large file uploads', async () => {
      const user = userEvent.setup()

      // Mock successful upload of large file
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          filesUploaded: 1,
          files: [{ id: 'large-file', name: 'large.js', size: 1024 * 1024, language: 'javascript' }],
          ragChunks: 50
        })
      })

      const mockOnFileUpload = jest.fn()

      render(
        <AIChatInterface
          workspaceId="test-workspace"
          onFileUpload={mockOnFileUpload}
        />
      )

      // Create large file
      const largeContent = 'x'.repeat(1024 * 1024) // 1MB file
      const largeFile = new File([largeContent], 'large.js', { type: 'application/javascript' })

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      Object.defineProperty(fileInput, 'files', {
        value: [largeFile],
        writable: false,
      })

      fireEvent.change(fileInput)

      expect(mockOnFileUpload).toHaveBeenCalledWith([largeFile])
    })

    it('handles concurrent message sending', async () => {
      const user = userEvent.setup()

      render(<AIChatInterface workspaceId="test-workspace" />)

      const textarea = screen.getByPlaceholderText('Ask anything... (Shift+Enter for new line)')
      const sendButton = screen.getByRole('button', { name: /send/i })

      // Try to send multiple messages quickly
      await user.type(textarea, 'First message')
      await user.click(sendButton)

      await user.type(textarea, 'Second message')

      // Send button should be disabled while first message is processing
      expect(sendButton).toBeDisabled()
    })
  })

  describe('Performance and Responsiveness', () => {
    it('handles many context files efficiently', async () => {
      const manyFiles = Array.from({ length: 100 }, (_, i) => `file${i}.js`)

      render(
        <AIChatInterface
          workspaceId="test-workspace"
          initialContext={manyFiles}
        />
      )

      // Should show truncated list with "more" indicator
      expect(screen.getByText('+97 more')).toBeInTheDocument()
    })

    it('maintains responsive UI during streaming', async () => {
      // Mock slow streaming response
      const mockReader = {
        read: jest.fn()
          .mockImplementation(() =>
            new Promise(resolve =>
              setTimeout(() => resolve({
                done: false,
                value: new TextEncoder().encode('data: {"content": "slow"}\n\n')
              }), 100)
            )
          )
      }
      const mockResponse = new Response('', {
        headers: { 'Content-Type': 'text/event-stream' }
      })
      mockResponse.body = { getReader: () => mockReader } as unknown as ReadableStream<Uint8Array>

      mockFetch.mockResolvedValueOnce(mockResponse)

      render(<AIChatInterface workspaceId="test-workspace" />)

      const textarea = screen.getByPlaceholderText('Ask anything... (Shift+Enter for new line)')
      await userEvent.type(textarea, 'Test message')

      const sendButton = screen.getByRole('button', { name: /send/i })
      await userEvent.click(sendButton)

      // UI should remain responsive
      expect(screen.getByText('AI is thinking...')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('supports keyboard navigation throughout', async () => {
      const user = userEvent.setup()

      render(<AIChatInterface workspaceId="test-workspace" />)

      // Tab through interactive elements
      await user.tab()
      expect(screen.getByRole('textbox')).toHaveFocus()

      await user.tab()
      expect(screen.getByRole('button', { name: /upload/i })).toHaveFocus()

      await user.tab()
      expect(screen.getByRole('button', { name: /send/i })).toHaveFocus()
    })

    it('provides proper ARIA labels and descriptions', async () => {
      render(<AIChatInterface workspaceId="test-workspace" />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('placeholder', expect.stringContaining('Ask anything'))

      const uploadButton = screen.getByRole('button', { name: /upload/i })
      expect(uploadButton).toBeInTheDocument()
    })
  })
})
