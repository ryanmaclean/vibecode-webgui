/**
 * AI SDK React Hooks - Simple implementation
 * This file provides a minimal implementation of the AI SDK React hooks
 * to make the code compile without external dependencies
 */

import { useState, useCallback } from 'react';
import { logger } from '@/lib/logger';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface UseChatOptions {
  api: string;
  initialMessages?: Message[];
  body?: Record<string, any>;
}

interface UseChatResult {
  messages: Message[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  error: Error | null;
}

export function useChat(options: UseChatOptions): UseChatResult {
  const { api, initialMessages = [], body = {} } = options;
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      // Add user message to the list
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: input,
      };
      setMessages((msgs) => [...msgs, userMessage]);
      setInput('');
      setIsLoading(true);
      setError(null);

      try {
        // Make API request to the AI endpoint
        const response = await fetch(api, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            ...body,
          }),
        });

        if (!response.ok) {
          throw new Error(`API responded with status ${response.status}`);
        }

        const data = await response.json();
        const assistantMessage: Message = {
          id: Date.now().toString() + '-assistant',
          role: 'assistant',
          content: data.content || data.message || 'I processed your request.',
        };

        setMessages((msgs) => [...msgs, assistantMessage]);
      } catch (err) {
        logger.error('Error calling AI API:', err);
        setError(err instanceof Error ? err : new Error('Failed to communicate with AI service'));
      } finally {
        setIsLoading(false);
      }
    },
    [api, body, input, isLoading, messages]
  );

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
  };
}