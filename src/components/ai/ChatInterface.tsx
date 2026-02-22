'use client';

/**
 * ChatInterface - Foundation component for AI chat functionality
 * Provides message display, input handling, streaming support, and model selection
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
import ModelSelector from '@/components/ai/ModelSelector';
import ModelDisplay from '@/components/ai/ModelDisplay';
import CostEstimator from '@/components/ai/CostEstimator';
import type { ModelProfile } from '@/types/model-comparison';
import { modelRegistry } from '@/lib/ai/models/model-registry';

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

  // Model selector state
  const [availableModels, setAvailableModels] = useState<ModelProfile[]>([]);
  const [favoriteModelIds, setFavoriteModelIds] = useState<string[]>([]);
  const [recentModelIds, setRecentModelIds] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load available models from registry
  useEffect(() => {
    const models = modelRegistry.getAllModels();
    setAvailableModels(models);
  }, []);

  // Load favorites from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('vibecode-favorite-models');
      if (saved) setFavoriteModelIds(JSON.parse(saved));
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Load recent models from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('vibecode-recent-models');
      if (saved) setRecentModelIds(JSON.parse(saved));
    } catch {
      // Ignore parse errors
    }
  }, []);

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

  // Handle model selection from ModelSelector
  const handleModelSelect = useCallback((model: ModelProfile) => {
    setSelectedModel(model.id);

    // Update recent models
    if (typeof window !== 'undefined') {
      setRecentModelIds((prev) => {
        const updated = [model.id, ...prev.filter((id) => id !== model.id)].slice(0, 10);
        try {
          localStorage.setItem('vibecode-recent-models', JSON.stringify(updated));
        } catch {
          // Ignore storage errors
        }
        return updated;
      });
    }
  }, []);

  // Handle favorite toggle
  const handleFavoriteToggle = useCallback((modelId: string) => {
    setFavoriteModelIds((prev) => {
      const updated = prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId];

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('vibecode-favorite-models', JSON.stringify(updated));
        } catch {
          // Ignore storage errors
        }
      }
      return updated;
    });
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
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">AI Chat</h2>
          <ModelDisplay
            model={availableModels.find((m) => m.id === selectedModel)}
            compact
          />
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
        <ModelSelector
          selectedModelId={selectedModel}
          onModelSelect={handleModelSelect}
          models={availableModels}
          recentModelIds={recentModelIds}
          favoriteModelIds={favoriteModelIds}
          onFavoriteToggle={handleFavoriteToggle}
          placeholder="Select a model..."
          label="Model"
          disabled={isLoading || isStreaming}
          showDetails
        />
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
                      ({availableModels.find((m) => m.id === message.model)?.name || message.model})
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
        {/* Cost Estimation Preview */}
        {input.trim() && (
          <CostEstimator
            message={input}
            selectedModel={selectedModel}
            inline={true}
            className="mt-2"
          />
        )}
      </div>
    </div>
  );
}

export default ChatInterface;
