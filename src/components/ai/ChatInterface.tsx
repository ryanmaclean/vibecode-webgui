'use client';

/**
 * ChatInterface - Foundation component for AI chat functionality
 * Provides message display, input handling, streaming support, and model selection
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { chatStreamRequest, ChatMessage as APIChatMessage } from '@/lib/ai-client';
import {
  saveSession,
  loadSession,
  generateSessionId,
  getCurrentSessionId,
  setCurrentSessionId,
  clearCurrentSessionId,
} from '@/lib/session-manager';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  model?: string;
}

export interface ChatInterfaceProps {
  className?: string;
  onMessageSent?: (message: ChatMessage) => void;
  onError?: (error: Error) => void;
  initialMessages?: ChatMessage[];
  defaultModel?: string;
}

const AVAILABLE_MODELS = [
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'openai/gpt-4', name: 'GPT-4' },
  { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo' },
  { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
  { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus' },
  { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet' },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku' },
  { id: 'ai/smollm2:360M-Q4_K_M', name: 'SmolLM2 360M' },
];

export function ChatInterface({
  className = '',
  onMessageSent,
  onError,
  initialMessages = [],
  defaultModel = 'anthropic/claude-3.5-sonnet',
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize session on mount - load existing or create new
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      return;
    }

    // If initialMessages provided, use those and don't load from storage
    if (initialMessages.length > 0) {
      const newSessionId = generateSessionId();
      setSessionId(newSessionId);
      setCurrentSessionId(newSessionId);
      saveSession(newSessionId, initialMessages);
      return;
    }

    // Try to load current session
    const currentSessionId = getCurrentSessionId();
    if (currentSessionId) {
      const loadedSession = loadSession(currentSessionId);
      if (loadedSession) {
        setSessionId(currentSessionId);
        setMessages(loadedSession.messages);
        return;
      }
    }

    // Create new session if none exists
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    setCurrentSessionId(newSessionId);
  }, []); // Empty dependency array - only run once on mount

  // Save session whenever messages change
  useEffect(() => {
    if (sessionId && messages.length > 0) {
      saveSession(sessionId, messages);
    }
  }, [messages, sessionId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError(null);
    setIsLoading(true);
    setIsStreaming(true);

    onMessageSent?.(userMessage);

    // Create assistant message placeholder
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      model: selectedModel,
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      // Convert to API format
      const apiMessages: APIChatMessage[] = [...messages, userMessage].map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      let accumulatedContent = '';

      // Stream the response - wrap in try-catch to handle streaming errors
      try {
        const stream = chatStreamRequest({
          messages: apiMessages,
          model: selectedModel,
          stream: true,
        });

        for await (const chunk of stream) {
          accumulatedContent += chunk;

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: accumulatedContent }
                : msg
            )
          );
        }
      } catch (streamError) {
        // Rethrow to be caught by outer catch
        throw streamError;
      }

      setIsStreaming(false);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error.message);
      onError?.(error);

      // Remove the placeholder message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessageId));

      // Add error message
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error.message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsStreaming(false);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, selectedModel, onMessageSent, onError]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  const handleClearMessages = useCallback(() => {
    setMessages([]);
    setError(null);

    // Create a new session when clearing
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    setCurrentSessionId(newSessionId);
  }, []);

  return (
    <div
      className={`flex flex-col h-full bg-white dark:bg-gray-900 ${className}`}
      data-testid="chat-interface"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">AI Chat</h2>
          <Badge variant="outline" data-testid="model-badge">
            {AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.name}
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearMessages}
          disabled={messages.length === 0}
          data-testid="clear-button"
        >
          Clear
        </Button>
      </div>

      {/* Model Selector */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <label htmlFor="model-select" className="block text-sm font-medium mb-2">
          Model
        </label>
        <Select
          id="model-select"
          value={selectedModel}
          onChange={(e) => setSelectedModel((e.target as HTMLSelectElement).value)}
          disabled={isLoading || isStreaming}
          data-testid="model-selector"
        >
          {AVAILABLE_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </Select>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4">
          <Alert variant="destructive" data-testid="error-alert">
            <p className="text-sm">{error}</p>
          </Alert>
        </div>
      )}

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" data-testid="messages-area">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400">
              <p data-testid="empty-state">No messages yet. Start a conversation!</p>
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
              data-testid={`message-${message.role}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                }`}
              >
                <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                <div className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString()}
                  {message.model && message.role === 'assistant' && (
                    <span className="ml-2">
                      ({AVAILABLE_MODELS.find((m) => m.id === message.model)?.name})
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isStreaming && (
            <div className="flex justify-start" data-testid="streaming-indicator">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
                    style={{ animationDelay: '0.1s' }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                  ></div>
                </div>
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Shift+Enter for new line)"
            disabled={isLoading || isStreaming}
            className="min-h-[60px] max-h-[200px] resize-none"
            data-testid="message-input"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
            className="self-end"
            data-testid="send-button"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ChatInterface;
