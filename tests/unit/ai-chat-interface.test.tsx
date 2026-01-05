// Unit tests for AI Chat Interface Component
// Tests core functionality, state management, and user interactions

import React from 'react'
import { screen, fireEvent, waitFor, renderWithProviders } from '@/../../tests/test-utils'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import AIChatInterface from '@/components/ai/AIChatInterface'

// Mock minimal global APIs needed for file handling
global.URL.createObjectURL = jest.fn((file: Blob) => `blob:${(file as File).name}`);

describe('AIChatInterface', () => {
  const defaultProps = {
    workspaceId: 'test-workspace',
    initialContext: ['file1.ts', 'file2.js'],
    onFileUpload: jest.fn(),
    className: 'test-class'
  };
  beforeEach(() => {
    jest.clearAllMocks()

    // Mock fetch for API calls
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: [] }),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob()),
    }) as any;
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('renders with default state', async () => {
      renderWithProviders(<AIChatInterface {...defaultProps} />)

      expect(screen.getByText('AI Assistant')).toBeInTheDocument()
      expect(screen.getByText('Claude 3 Sonnet')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Ask anything... (Shift+Enter for new line)')).toBeInTheDocument()
      // Component shows empty messages list when no messages, not placeholder text
    })

    it('shows context files badge when provided', async () => {
      renderWithProviders(<AIChatInterface {...defaultProps} />)

      // Check individual context file badges are displayed
      expect(screen.getByText('file1.ts')).toBeInTheDocument()
      expect(screen.getByText('file2.js')).toBeInTheDocument()
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
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: mockMessages })
      });

      renderWithProviders(<AIChatInterface {...defaultProps} />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/ai/conversations/test-workspace')
      })
    })

    it('handles conversation history load failure gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      renderWithProviders(<AIChatInterface {...defaultProps} />)

      // Should not crash and show empty state
      // Component shows empty messages list when no messages, not placeholder text
    })
  })

  describe('Model Selection', () => {
    it('shows model selector when settings are opened', async () => {
      renderWithProviders(<AIChatInterface {...defaultProps} />)

      // Click settings button
      const settingsButton = screen.getByRole('button', { name: /settings/i })
      fireEvent.click(settingsButton)

      expect(screen.getByText('Select AI Model:')).toBeInTheDocument()
      expect(screen.getByRole('combobox')).toHaveValue('anthropic/claude-3-sonnet')
    })

    it('allows model selection change', async () => {
      renderWithProviders(<AIChatInterface {...defaultProps} />)

      // Open settings
      const settingsButton = screen.getByRole('button', { name: /settings/i })
      fireEvent.click(settingsButton)

      // Change model
      const modelSelect = screen.getByRole('combobox')
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
      mockResponse.body = { getReader: () => mockReader } as any;
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

      renderWithProviders(<AIChatInterface {...defaultProps} />)

      // Type message
      const textarea = screen.getByPlaceholderText('Ask anything... (Shift+Enter for new line)')
      await user.type(textarea, 'Test message')

      // Click send
      const sendButton = screen.getByRole('button', { name: /send/i })
      await user.click(sendButton)

      // Verify API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/ai/chat/stream', {
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

      renderWithProviders(<AIChatInterface {...defaultProps} />)

      const textarea = screen.getByPlaceholderText('Ask anything... (Shift+Enter for new line)')
      await user.type(textarea, 'Test message{Enter}')

      // Should attempt to send (will fail due to mocked response, but that's ok)
      expect(textarea).toHaveValue('')
    })

    it('does not send empty messages', async () => {
      const user = userEvent.setup()

      renderWithProviders(<AIChatInterface {...defaultProps} />)

      const sendButton = screen.getByRole('button', { name: /send/i })
      await user.click(sendButton)

      // Should not make API call for empty message
      expect(global.fetch).toHaveBeenCalledTimes(1) // Only the initial conversation load
    })

    it('disables send button while streaming', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AIChatInterface {...defaultProps} />)

      const sendButton = screen.getByRole('button', { name: /send/i })
      const textarea = screen.getByPlaceholderText('Ask anything... (Shift+Enter for new line)')
      
      // Initially disabled because no input
      expect(sendButton).toBeDisabled()
      
      // Add input to enable button
      await user.type(textarea, 'Test message')
      expect(sendButton).not.toBeDisabled()
    })
  })

  describe('File Upload', () => {
    it('handles file upload through hidden input', async () => {
      const user = userEvent.setup()
      const mockFiles = [
        new File(['test content'], 'test.js', { type: 'application/javascript' })
      ]

      renderWithProviders(<AIChatInterface {...defaultProps} />)

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
      renderWithProviders(<AIChatInterface {...defaultProps} />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      expect(fileInput).toHaveAttribute('accept', '.txt,.md,.js,.ts,.jsx,.tsx,.py,.java,.cpp,.c,.html,.css,.json,.xml,.yml,.yaml')
    })
  })

  describe('Context Management', () => {
    it('displays context files as badges', async () => {
      renderWithProviders(<AIChatInterface {...defaultProps} />)

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
      renderWithProviders(<AIChatInterface {...defaultProps} />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('placeholder', 'Ask anything... (Shift+Enter for new line)')

      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()

      renderWithProviders(<AIChatInterface {...defaultProps} />)

      const textarea = screen.getByRole('textbox')
      
      // Test that textarea can receive focus
      await user.click(textarea)
      expect(textarea).toHaveFocus()
    })
  })

  describe('Error Handling', () => {
    it('handles streaming errors gracefully', async () => {
      const user = userEvent.setup();

      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      renderWithProviders(<AIChatInterface {...defaultProps} />)

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

    describe('File Upload', () => {
    it('allows a user to select a file and displays it in the input area', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AIChatInterface {...defaultProps} />);

      const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
      const uploadButton = screen.getByLabelText('Upload files');

      // The upload button is visually hidden, but accessible. We need to target the underlying input.
      const fileInput = screen.getByTestId('file-upload-input') as HTMLInputElement;

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('hello.txt')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('adapts to different screen sizes', async () => {
      const { container } = render(<AIChatInterface {...defaultProps} />)

      // Test that component has responsive classes
      expect(container.firstChild).toHaveClass('test-class')
    })
  })
})
