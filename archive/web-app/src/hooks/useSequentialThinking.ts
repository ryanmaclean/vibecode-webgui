import { useState } from 'react';

export interface SequentialThought {
  type: 'thought' | 'text';
  text: string;
}

export interface SequentialThinkingResponse {
  content: SequentialThought[];
  fallback?: boolean;
  error?: string;
}

export interface SequentialThinkingOptions {
  prompt: string;
  numSteps?: number;
}

/**
 * Hook for using the Sequential Thinking API
 * Allows breaking down complex problems into structured thinking steps
 */
export const useSequentialThinking = () => {
  const [thoughts, setThoughts] = useState<SequentialThought[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);

  const think = async ({ prompt, numSteps = 5 }: SequentialThinkingOptions) => {
    setIsLoading(true);
    setError(null);
    setIsFallback(false);
    
    try {
      const response = await fetch('/api/ai/sequential-thinking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, numSteps }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to process thinking request');
      }

      const data: SequentialThinkingResponse = await response.json();
      
      setThoughts(data.content || []);
      setIsFallback(!!data.fallback);
      
      if (data.error) {
        setError(data.error);
      }
      
      return data.content;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      setThoughts([]);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setThoughts([]);
    setError(null);
    setIsLoading(false);
    setIsFallback(false);
  };

  return {
    think,
    reset,
    thoughts,
    isLoading,
    error,
    isFallback,
  };
};

export default useSequentialThinking;