/**
 * Comprehensive test suite for ChatInterface component
 * Tests rendering, interactions, API integration, streaming, and error handling
 */

import React from 'react';
import {
  screen,
  waitFor,
  renderWithProviders,
  fireEvent,
} from '@/../tests/test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ChatInterface, { ChatMessage } from '@/components/ai/ChatInterface';
import * as aiClient from '@/lib/ai-client';

// Mock the ai-client module
jest.mock('@/lib/ai-client', () => ({
  chatStreamRequest: jest.fn(),
  chatRequest: jest.fn(),
  checkHealth: jest.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }),
  };
})();

// Setup global localStorage mock
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('ChatInterface Component', () => {
  const mockOnMessageSent = jest.fn();
  const mockOnError = jest.fn();
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear localStorage before each test
    localStorageMock.clear();
    // Suppress console.error during tests to avoid noise from intentional errors
    console.error = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    console.error = originalConsoleError;
  });

  describe('Component Rendering', () => {
    it('renders with default state', () => {
      renderWithProviders(<ChatInterface />);

      expect(screen.getByTestId('chat-interface')).toBeInTheDocument();
      expect(screen.getByText('AI Chat')).toBeInTheDocument();
      expect(screen.getByTestId('model-badge')).toBeInTheDocument();
      expect(screen.getByTestId('message-input')).toBeInTheDocument();
      expect(screen.getByTestId('send-button')).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      renderWithProviders(<ChatInterface className="custom-class" />);

      const chatInterface = screen.getByTestId('chat-interface');
      expect(chatInterface).toHaveClass('custom-class');
    });

    it('displays empty state when no messages', () => {
      renderWithProviders(<ChatInterface />);

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No messages yet. Start a conversation!')).toBeInTheDocument();
    });

    it('displays model badge with default model', () => {
      renderWithProviders(<ChatInterface />);

      expect(screen.getByTestId('model-badge')).toHaveTextContent('Claude 3.5 Sonnet');
    });

    it('displays model badge with custom default model', () => {
      renderWithProviders(<ChatInterface defaultModel="openai/gpt-4" />);

      expect(screen.getByTestId('model-badge')).toHaveTextContent('GPT-4');
    });

    it('renders with initial messages', () => {
      const initialMessages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Hi there!',
          timestamp: new Date(),
        },
      ];

      renderWithProviders(<ChatInterface initialMessages={initialMessages} />);

      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('Hi there!')).toBeInTheDocument();
    });
  });

  describe('Model Selection', () => {
    it('displays model selector', () => {
      renderWithProviders(<ChatInterface />);

      expect(screen.getByTestId('model-selector')).toBeInTheDocument();
      expect(screen.getByLabelText('Model')).toBeInTheDocument();
    });

    it('allows changing the selected model', async () => {
      renderWithProviders(<ChatInterface />);

      // Click on the Select trigger to open the dropdown
      const selector = screen.getByTestId('model-selector');
      fireEvent.click(selector);

      // Wait for the dropdown options to appear and click the desired option
      const gpt4Option = await screen.findByRole('option', { name: 'GPT-4' });
      fireEvent.click(gpt4Option);

      // Verify the model badge shows the selected model
      await waitFor(() => {
        expect(screen.getByTestId('model-badge')).toHaveTextContent('GPT-4');
      });
    });

    it('disables model selector while loading', async () => {
      const user = userEvent.setup();
      let resolveStream: () => void;
      const streamPromise = new Promise<void>((resolve) => {
        resolveStream = resolve;
      });

      const mockStream = (async function* () {
        yield 'Starting...';
        await streamPromise;
        yield 'Done';
      })();

      (aiClient.chatStreamRequest as jest.Mock).mockReturnValue(mockStream);

      renderWithProviders(<ChatInterface />);

      const input = screen.getByTestId('message-input');
      await user.type(input, 'Hello');

      const sendButton = screen.getByTestId('send-button');
      await user.click(sendButton);

      await waitFor(() => {
        const selector = screen.getByTestId('model-selector');
        expect(selector).toBeDisabled();
      });

      resolveStream!();
    });

    it('displays all available models in selector', async () => {
      renderWithProviders(<ChatInterface />);

      // Click on the Select trigger to open the dropdown
      const selector = screen.getByTestId('model-selector');
      fireEvent.click(selector);

      // Verify all expected models are present in the dropdown
      expect(await screen.findByRole('option', { name: 'Claude 3.5 Sonnet' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'GPT-4' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'GPT-4 Turbo' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'GPT-3.5 Turbo' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Claude 3 Opus' })).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('allows typing in message input', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ChatInterface />);

      const input = screen.getByTestId('message-input');
      await user.type(input, 'Hello world');

      expect(input).toHaveValue('Hello world');
    });

    it('clears input after sending message', async () => {
      const user = userEvent.setup();
      const mockStream = (async function* () {
        yield 'Response';
      })();

      (aiClient.chatStreamRequest as jest.Mock).mockReturnValue(mockStream);

      renderWithProviders(<ChatInterface />);

      const input = screen.getByTestId('message-input');
      await user.type(input, 'Test message');

      const sendButton = screen.getByTestId('send-button');
      await user.click(sendButton);

      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });

    it('disables send button when input is empty', () => {
      renderWithProviders(<ChatInterface />);

      const sendButton = screen.getByTestId('send-button');
      expect(sendButton).toBeDisabled();
    });

    it('enables send button when input has text', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ChatInterface />);

      const input = screen.getByTestId('message-input');
      await user.type(input, 'Test');

      const sendButton = screen.getByTestId('send-button');
      expect(sendButton).not.toBeDisabled();
    });

    it('disables send button while loading', async () => {
      const user = userEvent.setup();
      const mockStream = (async function* () {
        yield 'Response';
      })();

      (aiClient.chatStreamRequest as jest.Mock).mockReturnValue(mockStream);

      renderWithProviders(<ChatInterface />);

      const input = screen.getByTestId('message-input');
      await user.type(input, 'Test');

      const sendButton = screen.getByTestId('send-button');
      await user.click(sendButton);

      expect(sendButton).toBeDisabled();
    });

    it('sends message on Enter key', async () => {
      const user = userEvent.setup();
      const mockStream = (async function* () {
        yield 'Response';
      })();

      (aiClient.chatStreamRequest as jest.Mock).mockReturnValue(mockStream);

      renderWithProviders(<ChatInterface />);

      const input = screen.getByTestId('message-input');
      await user.type(input, 'Test message{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Test message')).toBeInTheDocument();
      });
    });

    it('does not send message on Shift+Enter', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ChatInterface />);

      const input = screen.getByTestId('message-input');
      await user.type(input, 'Line 1{Shift>}{Enter}{/Shift}Line 2');

      expect(aiClient.chatStreamRequest).not.toHaveBeenCalled();
    });

    it('trims whitespace from messages', async () => {
      const user = userEvent.setup();
      const mockStream = (async function* () {
        yield 'Response';
      })();

      (aiClient.chatStreamRequest as jest.Mock).mockReturnValue(mockStream);

      renderWithProviders(<ChatInterface onMessageSent={mockOnMessageSent} />);

      const input = screen.getByTestId('message-input');
      await user.type(input, '   Test message   ');

      const sendButton = screen.getByTestId('send-button');
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockOnMessageSent).toHaveBeenCalledWith(
          expect.objectContaining({
            content: 'Test message',
          })
        );
      });
    });
  });

  describe('Message Display', () => {
    it('displays user messages on the right', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'User message',
          timestamp: new Date(),
        },
      ];

      renderWithProviders(<ChatInterface initialMessages={messages} />);

      const messageElement = screen.getByTestId('message-user');
      expect(messageElement).toHaveClass('justify-end');
    });

    it('displays assistant messages on the left', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Assistant message',
          timestamp: new Date(),
        },
      ];

      renderWithProviders(<ChatInterface initialMessages={messages} />);

      const messageElement = screen.getByTestId('message-assistant');
      expect(messageElement).toHaveClass('justify-start');
    });

    it('displays message timestamps', () => {
      const timestamp = new Date('2025-01-12T10:30:00');
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Test',
          timestamp,
        },
      ];

      renderWithProviders(<ChatInterface initialMessages={messages} />);

      expect(screen.getByText(timestamp.toLocaleTimeString())).toBeInTheDocument();
    });

    it('displays model name in assistant messages', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Response',
          timestamp: new Date(),
          model: 'openai/gpt-4',
        },
      ];

      renderWithProviders(<ChatInterface initialMessages={messages} defaultModel="openai/gpt-3.5-turbo" />);

      // Check that the message shows the model name (not just the badge)
      const messageElement = screen.getByTestId('message-assistant');
      expect(messageElement).toHaveTextContent('(GPT-4)');
    });

    it('preserves whitespace in message content', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Line 1\nLine 2\n  Indented',
          timestamp: new Date(),
        },
      ];

      renderWithProviders(<ChatInterface initialMessages={messages} />);

      const messageContent = screen.getByText(/Line 1/);
      expect(messageContent).toHaveClass('whitespace-pre-wrap');
    });
  });

  describe('API Integration - Streaming', () => {
    it('calls chatStreamRequest with correct parameters', async () => {
      const user = userEvent.setup();
      const mockStream = (async function* () {
        yield 'Response';
      })();

      (aiClient.chatStreamRequest as jest.Mock).mockReturnValue(mockStream);

      renderWithProviders(<ChatInterface defaultModel="openai/gpt-4" />);

      const input = screen.getByTestId('message-input');
      await user.type(input, 'Test question');

      const sendButton = screen.getByTestId('send-button');
      await user.click(sendButton);

      await waitFor(() => {
        expect(aiClient.chatStreamRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([
              expect.objectContaining({
                role: 'user',
                content: 'Test question',
              }),
            ]),
            model: 'openai/gpt-4',
            stream: true,
          })
        );
      });
    });

    it('displays streaming indicator during response', async () => {
      const user = userEvent.setup();
      let resolveStream: () => void;
      const streamPromise = new Promise<void>((resolve) => {
        resolveStream = resolve;
      });

      const mockStream = (async function* () {
        yield 'Starting...';
        await streamPromise;
        yield 'Done';
      })();

      (aiClient.chatStreamRequest as jest.Mock).mockReturnValue(mockStream);

      renderWithProviders(<ChatInterface />);

      const input = screen.getByTestId('message-input');
      await user.type(input, 'Test');

      const sendButton = screen.getByTestId('send-button');
      await user.click(sendButton);

      await waitFor(() => {
        expect(screen.getByTestId('streaming-indicator')).toBeInTheDocument();
      });

      resolveStream!();
    });

    it('updates message content as chunks arrive', async () => {
      const user = userEvent.setup();
      const mockStream = (async function* () {
        yield 'Hello ';
        yield 'world ';
        yield '!';
      })();

      (aiClient.chatStreamRequest as jest.Mock).mockReturnValue(mockStream);

      renderWithProviders(<ChatInterface />);

      const input = screen.getByTestId('message-input');
      await user.type(input, 'Test');

      const sendButton = screen.getByTestId('send-button');
      await user.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Hello world !')).toBeInTheDocument();
      });
    });

    it('hides streaming indicator when response completes', async () => {
      const user = userEvent.setup();
      const mockStream = (async function* () {
        yield 'Response';
      })();

      (aiClient.chatStreamRequest as jest.Mock).mockReturnValue(mockStream);

      renderWithProviders(<ChatInterface />);

      const input = screen.getByTestId('message-input');
      await user.type(input, 'Test');

      const sendButton = screen.getByTestId('send-button');
      await user.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Response')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.queryByTestId('streaming-indicator')).not.toBeInTheDocument();
      });
    });

    it('includes conversation history in API calls', async () => {
      const user = userEvent.setup();
      const mockStream = (async function* () {
        yield 'Response 2';
      })();

      (aiClient.chatStreamRequest as jest.Mock).mockReturnValue(mockStream);

      const initialMessages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'First message',
          timestamp: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'First response',
          timestamp: new Date(),
        },
      ];

      renderWithProviders(<ChatInterface initialMessages={initialMessages} />);

      const input = screen.getByTestId('message-input');
      await user.type(input, 'Second message');

      const sendButton = screen.getByTestId('send-button');
      await user.click(sendButton);

      await waitFor(() => {
        expect(aiClient.chatStreamRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([
              expect.objectContaining({ content: 'First message' }),
              expect.objectContaining({ content: 'First response' }),
              expect.objectContaining({ content: 'Second message' }),
            ]),
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when API call fails', async () => {
      const user = userEvent.setup();

      // Mock an async generator that throws
      const mockStream = (async function* () {
        throw new Error('Network error');
      })();

      (aiClient.chatStreamRequest as jest.Mock).mockReturnValue(mockStream);

      renderWithProviders(<ChatInterface />);

      const input = screen.getByTestId('message-input');
      await user.type(input, 'Test');

      const sendButton = screen.getByTestId('send-button');
      await user.click(sendButton);

      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('calls onError callback when error occurs', async () => {
      const user = userEvent.setup();
      const error = new Error('API error');

      const mockStream = (async function* () {
        throw error;
      })();

      (aiClient.chatStreamRequest as jest.Mock).mockReturnValue(mockStream);

      renderWithProviders(<ChatInterface onError={mockOnError} />);

      const input = screen.getByTestId('message-input');
      await user.type(input, 'Test');

      const sendButton = screen.getByTestId('send-button');
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(error);
      }, { timeout: 3000 });
    });

    it('removes placeholder message on error', async () => {
      const user = userEvent.setup();

      const mockStream = (async function* () {
        throw new Error('Network error');
      })();

      (aiClient.chatStreamRequest as jest.Mock).mockReturnValue(mockStream);

      renderWithProviders(<ChatInterface />);

      const input = screen.getByTestId('message-input');
      await user.type(input, 'Test');

      const sendButton = screen.getByTestId('send-button');
      await user.click(sendButton);

      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Should have user message and error message, but not empty assistant message
      const userMessages = screen.getAllByTestId('message-user');
      const assistantMessages = screen.getAllByTestId('message-assistant');
      expect(userMessages).toHaveLength(1);
      expect(assistantMessages).toHaveLength(1);
    });

    it('displays error message in chat', async () => {
      const user = userEvent.setup();

      const mockStream = (async function* () {
        throw new Error('Custom error');
      })();

      (aiClient.chatStreamRequest as jest.Mock).mockReturnValue(mockStream);

      renderWithProviders(<ChatInterface />);

      const input = screen.getByTestId('message-input');
      await user.type(input, 'Test');

      const sendButton = screen.getByTestId('send-button');
      await user.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText(/Error: Custom error/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('re-enables UI after error', async () => {
      const user = userEvent.setup();

      const mockStream = (async function* () {
        throw new Error('Network error');
      })();

      (aiClient.chatStreamRequest as jest.Mock).mockReturnValue(mockStream);

      renderWithProviders(<ChatInterface />);

      const input = screen.getByTestId('message-input');
      await user.type(input, 'Test');

      const sendButton = screen.getByTestId('send-button');
      await user.click(sendButton);

      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Should be able to type again
      await waitFor(() => {
        expect(input).not.toBeDisabled();
        expect(screen.getByTestId('model-selector')).not.toBeDisabled();
      });
    });

    it('clears error message on successful send', async () => {
      const user = userEvent.setup();

      // First call fails
      const mockStreamError = (async function* () {
        throw new Error('First error');
      })();

      (aiClient.chatStreamRequest as jest.Mock).mockReturnValueOnce(mockStreamError);

      renderWithProviders(<ChatInterface />);

      const input = screen.getByTestId('message-input');
      await user.type(input, 'Test 1');

      let sendButton = screen.getByTestId('send-button');
      await user.click(sendButton);

      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Second call succeeds
      const mockStream = (async function* () {
        yield 'Success';
      })();
      (aiClient.chatStreamRequest as jest.Mock).mockReturnValue(mockStream);

      await user.type(input, 'Test 2');
      sendButton = screen.getByTestId('send-button');
      await user.click(sendButton);

      await waitFor(() => {
        expect(screen.queryByTestId('error-alert')).not.toBeInTheDocument();
      });
    });
  });

  describe('Message History Management', () => {
    it('clears messages when clear button is clicked', async () => {
      const user = userEvent.setup();
      const initialMessages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Test message',
          timestamp: new Date(),
        },
      ];

      renderWithProviders(<ChatInterface initialMessages={initialMessages} />);

      expect(screen.getByText('Test message')).toBeInTheDocument();

      const clearButton = screen.getByTestId('clear-button');
      await user.click(clearButton);

      expect(screen.queryByText('Test message')).not.toBeInTheDocument();
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    it('disables clear button when no messages', () => {
      renderWithProviders(<ChatInterface />);

      const clearButton = screen.getByTestId('clear-button');
      expect(clearButton).toBeDisabled();
    });

    it('enables clear button when messages exist', () => {
      const initialMessages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Test',
          timestamp: new Date(),
        },
      ];

      renderWithProviders(<ChatInterface initialMessages={initialMessages} />);

      const clearButton = screen.getByTestId('clear-button');
      expect(clearButton).not.toBeDisabled();
    });

    it('clears error state when clearing messages', async () => {
      const user = userEvent.setup();

      const mockStream = (async function* () {
        throw new Error('Network error');
      })();

      (aiClient.chatStreamRequest as jest.Mock).mockReturnValue(mockStream);

      renderWithProviders(<ChatInterface />);

      const input = screen.getByTestId('message-input');
      await user.type(input, 'Test');

      const sendButton = screen.getByTestId('send-button');
      await user.click(sendButton);

      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      }, { timeout: 3000 });

      const clearButton = screen.getByTestId('clear-button');
      await user.click(clearButton);

      expect(screen.queryByTestId('error-alert')).not.toBeInTheDocument();
    });
  });

  describe('Callbacks', () => {
    it('calls onMessageSent callback when message is sent', async () => {
      const user = userEvent.setup();
      const mockStream = (async function* () {
        yield 'Response';
      })();

      (aiClient.chatStreamRequest as jest.Mock).mockReturnValue(mockStream);

      renderWithProviders(<ChatInterface onMessageSent={mockOnMessageSent} />);

      const input = screen.getByTestId('message-input');
      await user.type(input, 'Test message');

      const sendButton = screen.getByTestId('send-button');
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockOnMessageSent).toHaveBeenCalledWith(
          expect.objectContaining({
            role: 'user',
            content: 'Test message',
          })
        );
      });
    });

    it('includes message metadata in callback', async () => {
      const user = userEvent.setup();
      const mockStream = (async function* () {
        yield 'Response';
      })();

      (aiClient.chatStreamRequest as jest.Mock).mockReturnValue(mockStream);

      renderWithProviders(<ChatInterface onMessageSent={mockOnMessageSent} />);

      const input = screen.getByTestId('message-input');
      await user.type(input, 'Test');

      const sendButton = screen.getByTestId('send-button');
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockOnMessageSent).toHaveBeenCalledWith(
          expect.objectContaining({
            id: expect.any(String),
            role: 'user',
            content: 'Test',
            timestamp: expect.any(Date),
          })
        );
      });
    });
  });

  describe('Loading States', () => {
    it('shows loading text on send button while processing', async () => {
      const user = userEvent.setup();
      let resolveStream: () => void;
      const streamPromise = new Promise<void>((resolve) => {
        resolveStream = resolve;
      });

      const mockStream = (async function* () {
        yield 'Start';
        await streamPromise;
        yield 'Done';
      })();

      (aiClient.chatStreamRequest as jest.Mock).mockReturnValue(mockStream);

      renderWithProviders(<ChatInterface />);

      const input = screen.getByTestId('message-input');
      await user.type(input, 'Test');

      const sendButton = screen.getByTestId('send-button');
      await user.click(sendButton);

      await waitFor(() => {
        expect(sendButton).toHaveTextContent('Sending...');
      });

      resolveStream!();
    });

    it('disables input while loading', async () => {
      const user = userEvent.setup();
      let resolveStream: () => void;
      const streamPromise = new Promise<void>((resolve) => {
        resolveStream = resolve;
      });

      const mockStream = (async function* () {
        yield 'Starting...';
        await streamPromise;
        yield 'Done';
      })();

      (aiClient.chatStreamRequest as jest.Mock).mockReturnValue(mockStream);

      renderWithProviders(<ChatInterface />);

      const input = screen.getByTestId('message-input');
      await user.type(input, 'Test');

      const sendButton = screen.getByTestId('send-button');
      await user.click(sendButton);

      await waitFor(() => {
        expect(input).toBeDisabled();
      });

      resolveStream!();
    });

    it('prevents multiple simultaneous requests', async () => {
      const user = userEvent.setup();
      let resolveStream: () => void;
      const streamPromise = new Promise<void>((resolve) => {
        resolveStream = resolve;
      });

      const mockStream = (async function* () {
        yield 'Starting...';
        await streamPromise;
        yield 'Done';
      })();

      (aiClient.chatStreamRequest as jest.Mock).mockReturnValue(mockStream);

      renderWithProviders(<ChatInterface />);

      const input = screen.getByTestId('message-input');
      await user.type(input, 'Test 1');

      const sendButton = screen.getByTestId('send-button');
      await user.click(sendButton);

      // Wait for the first request to start
      await waitFor(() => {
        expect(aiClient.chatStreamRequest).toHaveBeenCalledTimes(1);
      });

      // Try to send another message immediately (should be prevented)
      await user.type(input, 'Test 2');
      const sendButtonAfter = screen.getByTestId('send-button');
      expect(sendButtonAfter).toBeDisabled();

      resolveStream!();
    });
  });

  describe('Accessibility', () => {
    it('has proper labels for form controls', () => {
      renderWithProviders(<ChatInterface />);

      expect(screen.getByLabelText('Model')).toBeInTheDocument();
      expect(screen.getByTestId('message-input')).toHaveAttribute('placeholder');
    });

    it('focuses input on mount', () => {
      renderWithProviders(<ChatInterface />);

      const input = screen.getByTestId('message-input');
      expect(input).toHaveFocus();
    });
  });
});
