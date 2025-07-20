import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithRetry, streamResponse } from '@/lib/utils/fetch';

export type GenerationStatus = 'idle' | 'initializing' | 'generating' | 'seeding' | 'installing' | 'finalizing' | 'completed' | 'error';

export interface ProgressData {
  status: GenerationStatus;
  message: string;
  progress?: number;
  workspaceId?: string;
  projectName?: string;
  codeServerUrl?: string;
  error?: string;
  details?: unknown;
  recoveryOptions?: Array<{ label: string; action: string }>;
}

export interface UseProjectGeneratorOptions {
  onProgress?: (data: ProgressData) => void;
  onComplete?: (data: { workspaceId: string; projectName: string }) => void;
  onError?: (error: Error) => void;
}

export function useProjectGenerator({ onProgress, onComplete, onError }: UseProjectGeneratorOptions = {}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<ProgressData>({
    status: 'idle',
    message: 'Ready to generate project',
    progress: 0,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const router = useRouter();

  const updateProgress = useCallback((data: Partial<ProgressData>) => {
    setProgress(prev => {
      const newProgress = {
        ...prev,
        ...data,
        progress: data.progress ?? prev.progress,
      };
      onProgress?.(newProgress);
      return newProgress;
    });
  }, [onProgress]);

  const generateProject = useCallback(async (prompt: string, options: {
    language?: string;
    framework?: string;
    features?: string[];
  } = {}) => {
    if (isGenerating) return;

    setIsGenerating(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    updateProgress({
      status: 'initializing',
      message: 'Starting project generation...',
      progress: 5,
    });

    try {
      const response = await fetchWithRetry('/api/ai/generate-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          ...options,
        }),
        signal: controller.signal,
        timeout: 300000, // 5 minute timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Process the streaming response
      for await (const chunk of streamResponse(response, (progress) => {
        updateProgress({
          progress: Math.min(progress, 95), // Cap at 95% until completion
        });
      })) {
        try {
          const data = JSON.parse(chunk) as ProgressData;
          updateProgress(data);

          // Handle completion
          if (data.status === 'completed' && data.workspaceId) {
            onComplete?.({
              workspaceId: data.workspaceId,
              projectName: data.projectName || 'New Project',
            });
          }
        } catch (e) {
          console.error('Error parsing progress update:', e);
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name !== 'AbortError') {
          console.error('Generation error:', error);
          updateProgress({
            status: 'error',
            message: error.message || 'Failed to generate project',
            error: error.message,
            recoveryOptions: [
              { label: 'Try Again', action: 'retry' },
              { label: 'Modify Prompt', action: 'modify' },
            ],
          });
          onError?.(error);
        }
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [isGenerating, updateProgress, onComplete, onError]);

  const cancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
      updateProgress({
        status: 'idle',
        message: 'Generation cancelled',
        progress: 0,
      });
    }
  }, [updateProgress]);

  // Auto-redirect when generation completes
  const handleComplete = useCallback(({ workspaceId }: { workspaceId: string }) => {
    setTimeout(() => {
      router.push(`/workspace/${workspaceId}`);
    }, 1000);
  }, [router]);

  return {
    isGenerating,
    progress,
    generateProject,
    cancelGeneration,
    updateProgress,
    handleComplete,
  };
}
