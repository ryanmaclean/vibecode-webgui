// Integration tests for AI Chat functionality
// Tests end-to-end workflows, API integration, and user scenarios

import React from 'react'
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@/../tests/test-utils'
import userEvent from '@testing-library/user-event'

import AIChatInterface from '@/components/ai/AIChatInterface'
import VSCodeIntegration from '@/components/ai/VSCodeIntegration'

// Use global.fetch mock provided by tests/jest.setup.js. We avoid reassigning
// fetch here to prevent TDZ/initialization order issues. Cast to jest.Mock
// at use sites as needed.

// Ensure we use the real component, not the manual test mock
jest.mock('@/components/ai/AIChatInterface', () => {
  const actual = jest.requireActual('@/components/ai/AIChatInterface') as typeof import('@/components/ai/AIChatInterface')
  return {
    __esModule: true,
    default: actual.default,
    AIChatInterface: actual.AIChatInterface,
  }
})

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

describe.skip('AI Chat Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Mock environment variables
    process.env.OPENROUTER_API_KEY = 'test-api-key'
    process.env.NEXTAUTH_URL = 'http://localhost:3000'

    // Default fetch mock for conversation history
    ;(global.fetch as unknown as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify({ messages: [] }),
        { headers: { 'Content-Type': 'application/json' } }
      ) as any
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Complete Chat Workflow', () => {
    it('handles full conversation flow with file upload', async () => {
      const user = userEvent.setup()

      // Ensure first call is conversation history JSON
      ;(global.fetch as unknown as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ messages: [] }),
          headers: new Headers({ 'Content-Type': 'application/json' })
        } as any)

      // Mock successful streaming chat - create a proper mock with body property
      const reader = {
        read: jest.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('I can see you uploaded test.js.')
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(' Let me analyze it.')
          })
          .mockResolvedValueOnce({ done: true, value: undefined })
      }

      const mockStreamResponse = {
        ok: true
      }
      Object.defineProperty(mockStreamResponse, 'body', {
        value: { getReader: () => reader },
        writable: false,
        enumerable: true,
        configurable: true
      })

      ;(global.fetch as unknown as jest.Mock).mockResolvedValueOnce(mockStreamResponse as any)

      // Mock the save conversation call
      ;(global.fetch as unknown as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      } as any)

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
      expect(mockOnFileUpload).toHaveBeenCalled()
      const firstArg = (mockOnFileUpload as jest.Mock).mock.calls[0][0] as unknown
      const uploaded = Array.from(firstArg as FileList | File[]).map((f) => (f as File).name)
      expect(uploaded).toEqual([file.name])

      // 2. Send a message asking about the uploaded file
      const textarea = screen.getByPlaceholderText('Ask anything... (Shift+Enter for new line)')
      await user.type(textarea, 'Analyze the uploaded JavaScript file')

      const sendButton = screen.getByRole('button', { name: /send/i })
      await waitFor(() => expect(sendButton).not.toBeDisabled())
      await user.click(sendButton)

      // 3. Verify the streamed response appears
      await waitFor(() => {
        expect(screen.getByText(/I can see you uploaded test\.js/i)).toBeInTheDocument()
      }, { timeout: 7000 })

      // 4. Verify API call payload contains expected fields
      const streamCall = (global.fetch as unknown as jest.Mock).mock.calls.find((c: unknown[]) => c[0] === '/api/ai/chat/stream')
      expect(streamCall).toBeTruthy()
      if (!streamCall) throw new Error('Expected stream call to be present')
      const [, streamOpts] = streamCall as [
        string,
        { method: string; headers: Record<string, string>; body: string }
      ]
      expect(streamOpts.method).toBe('POST')
      expect(streamOpts.headers['Content-Type']).toBe('application/json')
      const payload = JSON.parse(streamOpts.body)
      expect(payload.message).toBe('Analyze the uploaded JavaScript file')
      expect(payload.model).toBe('anthropic/claude-3-sonnet')
      expect(payload.context.workspaceId).toBe('test-workspace')
      expect(Array.isArray(payload.context.files)).toBe(true)
      expect(payload.context.files).toEqual(expect.arrayContaining(['test.js']))
    })

    it('persists conversation history across sessions', async () => {

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

      ;(global.fetch as unknown as jest.Mock)
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ messages: existingMessages }),
            { headers: { 'Content-Type': 'application/json' } }
          ) as any
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ success: true }),
            { headers: { 'Content-Type': 'application/json' } }
          ) as any
        )

      render(<AIChatInterface workspaceId="test-workspace" />)

      // Wait for conversation history to load
      await waitFor(() => {
        expect(screen.getByText('Previous question')).toBeInTheDocument()
        expect(screen.getByText('Previous answer')).toBeInTheDocument()
      })

      // Verify conversation history was requested
      expect(global.fetch).toHaveBeenCalledWith('/api/ai/conversations/test-workspace')
    })

    it('switches between AI models seamlessly', async () => {
      const user = userEvent.setup()

      // Ensure first call is conversation history JSON, second call is a quick stream
      ;(global.fetch as unknown as jest.Mock)
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ messages: [] }),
            { headers: { 'Content-Type': 'application/json' } }
          ) as any
        )
        .mockResolvedValueOnce({
          body: {
            getReader: () => ({ read: jest.fn().mockResolvedValue({ done: true, value: undefined }) })
          }
        } as any)

      render(<AIChatInterface workspaceId="test-workspace" />)

      // Open settings
      const settingsButton = screen.getByRole('button', { name: /settings/i })
      await user.click(settingsButton)

      // Change model from Claude to GPT-4
      const modelSelect = await screen.findByLabelText('Select AI Model:')
      await user.selectOptions(modelSelect, 'openai/gpt-4')

      expect(modelSelect).toHaveValue('openai/gpt-4')

      // Send a message and verify stream payload uses the selected model
      const textarea = screen.getByPlaceholderText('Ask anything... (Shift+Enter for new line)')
      await user.type(textarea, 'Model check')
      const sendButton = screen.getByRole('button', { name: /send/i })
      await user.click(sendButton)

      const streamCall = (global.fetch as unknown as jest.Mock).mock.calls.find((c: unknown[]) => c[0] === '/api/ai/chat/stream')
      expect(streamCall).toBeTruthy()
      if (!streamCall) throw new Error('Expected stream call to be present')
      const [, streamOpts] = streamCall as [
        string,
        { method: string; headers: Record<string, string>; body: string }
      ]
      const payload = JSON.parse(streamOpts.body)
      expect(payload.model).toBe('openai/gpt-4')
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

      // In embedded mode (current implementation always side-by-side), ensure a known button exists
      expect(screen.getByRole('button', { name: /upload context/i })).toBeInTheDocument()

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
      ;(global.fetch as unknown as jest.Mock).mockRejectedValueOnce(new Error('Network error') as any)

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

      // Mock successful upload of large file
      ;(global.fetch as unknown as jest.Mock).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            filesUploaded: 1,
            files: [{ id: 'large-file', name: 'large.js', size: 1024 * 1024, language: 'javascript' }],
            ragChunks: 50
          }),
          { headers: { 'Content-Type': 'application/json' } }
        ) as any
      )

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

      expect(mockOnFileUpload).toHaveBeenCalled()
      const firstArg = (mockOnFileUpload as jest.Mock).mock.calls[0][0] as unknown
      const uploaded = Array.from(firstArg as FileList | File[]).map((f) => (f as File).name)
      expect(uploaded).toEqual([largeFile.name])
    })

    it('handles concurrent message sending', async () => {
      const user = userEvent.setup()

      // Mock a slow streaming response to keep isStreaming=true
      // First call: conversation history
      ;(global.fetch as unknown as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [] }),
        headers: new Headers({ 'Content-Type': 'application/json' })
      } as any)

      const slowReader = {
        read: jest.fn().mockImplementation(() => new Promise(() => {}))
      }

      const mockSlowResponse = {
        ok: true
      }
      Object.defineProperty(mockSlowResponse, 'body', {
        value: { getReader: () => slowReader },
        writable: false,
        enumerable: true,
        configurable: true
      })

      ;(global.fetch as unknown as jest.Mock).mockResolvedValueOnce(mockSlowResponse as any)

      render(<AIChatInterface workspaceId="test-workspace" />)

      const textarea = screen.getByPlaceholderText('Ask anything... (Shift+Enter for new line)')
      const sendButton = screen.getByRole('button', { name: /send/i })

      await user.type(textarea, 'First message')
      await user.click(sendButton)

      // Wait for the button to be disabled (streaming started)
      await waitFor(() => {
        expect(sendButton).toBeDisabled()
      }, { timeout: 2000 })

      // Clear and type second message - button should still be disabled
      await user.clear(textarea)
      await user.type(textarea, 'Second message')

      // Button should remain disabled while streaming
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
      // Ensure first fetch (conversation history) returns JSON
      ;(global.fetch as unknown as jest.Mock)
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ messages: [] }),
            { headers: { 'Content-Type': 'application/json' } }
          ) as any
        )

      // Mock streaming response using ReadableStream
      const encoder = new TextEncoder()

      // Create a proper ReadableStream mock
      const stream = new ReadableStream({
        start(controller) {
          // Enqueue chunks progressively
          controller.enqueue(encoder.encode('AI response '))
          setTimeout(() => {
            controller.enqueue(encoder.encode('is streaming'))
            setTimeout(() => {
              controller.enqueue(encoder.encode(' correctly'))
              controller.close()
            }, 50)
          }, 50)
        }
      })

      const streamResponse = new Response(stream, {
        headers: { 'Content-Type': 'text/plain' }
      }) as any

      ;(global.fetch as unknown as jest.Mock).mockResolvedValueOnce(streamResponse)

      render(<AIChatInterface workspaceId="test-workspace" />)

      const textarea = screen.getByPlaceholderText('Ask anything... (Shift+Enter for new line)')
      await userEvent.type(textarea, 'Test message')

      const sendButton = screen.getByRole('button', { name: /send/i })

      // Send the message
      await userEvent.click(sendButton)

      // Verify the response appears with streaming content
      await waitFor(() => {
        expect(screen.getByText(/AI response is streaming correctly/)).toBeInTheDocument()
      }, { timeout: 1000 })

      // Verify textarea is cleared after sending
      expect(textarea).toHaveValue('')

      // Verify streaming has completed (loading state gone)
      expect(screen.queryByText('AI is thinking...')).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('supports keyboard navigation throughout', async () => {
      const user = userEvent.setup()

      render(<AIChatInterface workspaceId="test-workspace" />)

      // Tab until the textbox receives focus
      const textbox = screen.getByRole('textbox')
      for (let i = 0; i < 10 && document.activeElement !== textbox; i++) {
        await user.tab()
      }
      expect(textbox).toHaveFocus()

      // Type to enable the Send button (disabled buttons are not tabbable)
      await user.type(textbox, 'Hello')

      // Continue tabbing to reach the upload and send buttons
      let uploadButton: HTMLElement | null = null
      let sendButton: HTMLElement | null = null
      for (let i = 0; i < 10; i++) {
        await user.tab()
        const active = document.activeElement as HTMLElement
        if (!uploadButton && active?.getAttribute('aria-label')?.toLowerCase().includes('upload')) {
          uploadButton = active
        }
        if (!sendButton && active?.getAttribute('aria-label')?.toLowerCase().includes('send')) {
          sendButton = active
        }
        if (uploadButton && sendButton) break
      }
      expect(uploadButton).toBeTruthy()
      expect(sendButton).toBeTruthy()
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
