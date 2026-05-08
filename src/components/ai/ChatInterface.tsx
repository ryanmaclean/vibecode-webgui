'use client';

/**
 * ChatInterface - Foundation component for AI chat functionality
 * Provides message display, input handling, streaming support, and model selection
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { estimateTokens } from '@/lib/ai/context/token-counter';
import { getCostTracker } from '@/lib/ai/cost/cost-tracker';

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
  const t = useTranslations();
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

  // Cost confirmation dialog state
  const [showCostDialog, setShowCostDialog] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string>('');

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

  // Core message sending logic
  const sendMessageWithContent = useCallback(async (messageContent: string) => {
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageContent,
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

      // Record usage after successful response
      try {
        const costTracker = getCostTracker();

        // Estimate prompt tokens (all messages sent to API)
        const promptText = apiMessages.map(m => m.content).join('\n');
        const promptTokens = estimateTokens(promptText, selectedModel);

        // Estimate completion tokens (assistant's response)
        const completionTokens = estimateTokens(accumulatedContent, selectedModel);

        // Record usage
        costTracker.recordUsage(selectedModel, promptTokens, completionTokens);
      } catch (trackingError) {
        // Don't fail the request if tracking fails
        console.error('Failed to record usage:', trackingError);
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
  }, [isLoading, messages, selectedModel, onMessageSent, onError]);

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) {
      return;
    }

    const messageContent = input.trim();

    // Estimate token count
    const tokenCount = estimateTokens(messageContent, selectedModel);

    // Show confirmation dialog for expensive requests (>500 tokens)
    if (tokenCount > 500) {
      setPendingMessage(messageContent);
      setShowCostDialog(true);
      return;
    }

    // Send immediately for smaller messages
    await sendMessageWithContent(messageContent);
  }, [input, isLoading, selectedModel, sendMessageWithContent]);

  // Handle confirmed expensive message send
  const handleConfirmSend = useCallback(async () => {
    setShowCostDialog(false);
    await sendMessageWithContent(pendingMessage);
    setPendingMessage('');
  }, [pendingMessage, sendMessageWithContent]);

  // Handle canceled expensive message
  const handleCancelSend = useCallback(() => {
    setShowCostDialog(false);
    setPendingMessage('');
  }, []);

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
          <h2 className="text-lg font-semibold">{t('chat.heading')}</h2>
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
          {t('chat.clearButton')}
        </Button>
      </div>

      {/* Model Selector */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <ModelSelector
          data-testid="model-selector"
          selectedModelId={selectedModel}
          onModelSelect={handleModelSelect}
          models={availableModels}
          recentModelIds={recentModelIds}
          favoriteModelIds={favoriteModelIds}
          onFavoriteToggle={handleFavoriteToggle}
          placeholder={t('chat.modelPlaceholder')}
          label={t('chat.modelLabel')}
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
              <p data-testid="empty-state">{t('chat.emptyState')}</p>
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
              data-testid={message.role === 'user' ? 'user-message' : 'assistant-message'}
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
                <span className="text-sm">{t('chat.thinkingIndicator')}</span>
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
            placeholder={t('chat.inputPlaceholder')}
            disabled={isLoading || isStreaming}
            className="min-h-[60px] max-h-[200px] resize-none"
            data-testid="chat-input"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
            className="self-end"
            data-testid="send-button"
          >
            {isLoading ? t('chat.sendingButton') : t('chat.sendButton')}
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

      {/* Cost Confirmation Dialog */}
      <Dialog open={showCostDialog} onOpenChange={setShowCostDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('chat.costConfirmDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('chat.costConfirmDialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Model Information */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{t('chat.costConfirmDialog.modelLabel')}</span>
              <ModelDisplay
                data-testid="model-display"
                model={availableModels.find((m) => m.id === selectedModel)}
                compact
              />
            </div>

            {/* Cost Estimate */}
            {pendingMessage && (
              <div className="rounded-lg border p-4 bg-muted/50">
                <CostEstimator
                  message={pendingMessage}
                  selectedModel={selectedModel}
                  inline={false}
                  showComparison={false}
                  expandedByDefault={true}
                />
              </div>
            )}

            {/* Token Count Warning */}
            <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <svg
                className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  {t('chat.costConfirmDialog.highTokenWarningTitle')}
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  {t('chat.costConfirmDialog.highTokenWarningDescription').replace('{tokenCount}', String(estimateTokens(pendingMessage, selectedModel)))}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelSend}
              data-testid="cancel-send-button"
            >
              {t('chat.costConfirmDialog.cancelButton')}
            </Button>
            <Button
              onClick={handleConfirmSend}
              data-testid="confirm-send-button"
            >
              {t('chat.costConfirmDialog.confirmButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ChatInterface;
