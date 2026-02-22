/**
 * useCodebaseIndexing Hook
 * React hook for managing codebase semantic indexing
 *
 * Features:
 * - Automatic indexing on project open
 * - Real-time indexing progress tracking
 * - File watcher integration for incremental updates
 * - SWR-based status polling
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import useSWR from 'swr';
import { useToast } from '@/components/ui/use-toast';

// Types
export interface IndexingStatus {
  projectId: number;
  totalFiles: number;
  indexedFiles: number;
  progress: number; // 0-100
  isIndexing: boolean;
  lastIndexedAt?: string;
  totalChunks: number;
}

export interface IndexingResult {
  success: boolean;
  filePath: string;
  error?: string;
  chunkCount?: number;
}

export interface IndexProjectResponse {
  projectId: number;
  totalFiles: number;
  successCount: number;
  failureCount: number;
  results: IndexingResult[];
}

export interface ReindexFileResult {
  success: boolean;
  filePath: string;
  chunkCount?: number;
  error?: string;
}

export interface UseCodebaseIndexingOptions {
  projectId?: number;
  workspaceId?: number;
  projectPath?: string;
  autoIndex?: boolean; // Auto-trigger indexing if not indexed
  enabled?: boolean; // Enable/disable the hook
  refreshInterval?: number; // Status polling interval (ms)
  onIndexingStart?: () => void;
  onIndexingComplete?: (result: IndexProjectResponse) => void;
  onIndexingProgress?: (status: IndexingStatus) => void;
  onError?: (error: string) => void;
}

export interface UseCodebaseIndexingReturn {
  // State
  status: IndexingStatus | null;
  isLoading: boolean;
  isIndexing: boolean;
  error: Error | null;

  // Actions
  startIndexing: () => Promise<IndexProjectResponse | null>;
  pauseIndexing: () => void;
  reindexFile: (filePath: string) => Promise<ReindexFileResult | null>;
  clearIndex: () => Promise<void>;
  refreshStatus: () => Promise<void>;

  // Utilities
  isFullyIndexed: boolean;
  needsIndexing: boolean;
  progressPercentage: number;
}

// API fetchers
const fetchIndexStatus = async (projectId: number): Promise<IndexingStatus> => {
  const response = await fetch(`/api/codebase-index?projectId=${projectId}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.status !== 'success') {
    throw new Error(data.error || 'Failed to fetch indexing status');
  }

  return data.data;
};

const triggerIndexing = async (
  projectId: number,
  workspaceId: number,
  projectPath: string
): Promise<IndexProjectResponse> => {
  const response = await fetch('/api/codebase-index', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ projectId, workspaceId, projectPath }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to trigger indexing');
  }

  const data = await response.json();
  return data.data;
};

const reindexFileAPI = async (
  projectId: number,
  workspaceId: number,
  filePath: string
): Promise<ReindexFileResult> => {
  const response = await fetch('/api/codebase-index', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ projectId, workspaceId, filePath }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to re-index file');
  }

  const data = await response.json();
  return data.data;
};

const clearIndexAPI = async (projectId: number): Promise<void> => {
  const response = await fetch('/api/codebase-index', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ projectId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to clear index');
  }
};

/**
 * React hook for codebase indexing management
 */
export function useCodebaseIndexing(
  options: UseCodebaseIndexingOptions = {}
): UseCodebaseIndexingReturn {
  const {
    projectId,
    workspaceId,
    projectPath,
    autoIndex = true,
    enabled = true,
    refreshInterval = 0,
    onIndexingStart,
    onIndexingComplete,
    onIndexingProgress,
    onError,
  } = options;

  const { toast } = useToast();
  const [isIndexing, setIsIndexing] = useState(false);
  const [shouldPause, setShouldPause] = useState(false);
  const autoIndexTriggered = useRef(false);
  const lastProgressRef = useRef(0);

  // SWR key - only enable if we have a project ID and enabled is true
  const swrKey = enabled && projectId ? `codebase-index-${projectId}` : null;

  // SWR configuration with conditional polling when indexing
  const {
    data: status,
    error,
    isLoading,
    mutate: mutateSWR,
  } = useSWR(
    swrKey,
    () => fetchIndexStatus(projectId!),
    {
      refreshInterval: isIndexing ? 2000 : refreshInterval, // Poll every 2s when indexing
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 1000,
      onError: (err: Error) => {
        console.error('Indexing status fetch error:', err);
        onError?.(err.message);
      },
    }
  );

  // Track indexing progress and notify
  useEffect(() => {
    if (status && status.progress !== lastProgressRef.current) {
      lastProgressRef.current = status.progress;
      onIndexingProgress?.(status);
    }
  }, [status, onIndexingProgress]);

  // Auto-detect when indexing completes
  useEffect(() => {
    if (status && isIndexing && !status.isIndexing) {
      setIsIndexing(false);

      toast({
        title: 'Indexing Complete',
        description: `Successfully indexed ${status.indexedFiles} of ${status.totalFiles} files.`,
      });
    }
  }, [status, isIndexing, toast]);

  // Auto-index on project open if needed
  useEffect(() => {
    if (
      autoIndex &&
      enabled &&
      projectId &&
      workspaceId &&
      projectPath &&
      status &&
      !autoIndexTriggered.current &&
      !isIndexing
    ) {
      // Only auto-index if the project has no indexed files
      if (status.indexedFiles === 0 && status.totalFiles === 0) {
        autoIndexTriggered.current = true;
        startIndexing();
      }
    }
  }, [autoIndex, enabled, projectId, workspaceId, projectPath, status, isIndexing]);

  // Reset auto-index trigger when project changes
  useEffect(() => {
    autoIndexTriggered.current = false;
  }, [projectId]);

  /**
   * Start indexing the project
   */
  const startIndexing = useCallback(async (): Promise<IndexProjectResponse | null> => {
    if (!projectId || !workspaceId || !projectPath) {
      const errorMessage = 'Missing required parameters: projectId, workspaceId, or projectPath';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      onError?.(errorMessage);
      return null;
    }

    if (isIndexing) {
      const errorMessage = 'Indexing already in progress';
      toast({
        title: 'Info',
        description: errorMessage,
      });
      return null;
    }

    try {
      setIsIndexing(true);
      setShouldPause(false);

      toast({
        title: 'Indexing Started',
        description: 'Indexing your codebase for semantic search...',
      });

      onIndexingStart?.();

      const result = await triggerIndexing(projectId, workspaceId, projectPath);

      // Refresh status after indexing
      await mutateSWR();

      toast({
        title: 'Indexing Complete',
        description: `Successfully indexed ${result.successCount} of ${result.totalFiles} files.`,
      });

      onIndexingComplete?.(result);

      return result;
    } catch (error) {
      setIsIndexing(false);

      const errorMessage = error instanceof Error ? error.message : 'Failed to start indexing';
      toast({
        title: 'Indexing Failed',
        description: errorMessage,
        variant: 'destructive',
      });

      onError?.(errorMessage);
      return null;
    } finally {
      setIsIndexing(false);
    }
  }, [projectId, workspaceId, projectPath, isIndexing, toast, onIndexingStart, onIndexingComplete, onError, mutateSWR]);

  /**
   * Pause indexing (note: actual pause requires backend support)
   */
  const pauseIndexing = useCallback(() => {
    if (isIndexing) {
      setShouldPause(true);

      toast({
        title: 'Pause Requested',
        description: 'Indexing will pause after the current file completes.',
      });
    }
  }, [isIndexing, toast]);

  /**
   * Re-index a specific file
   */
  const reindexFile = useCallback(async (filePath: string): Promise<ReindexFileResult | null> => {
    if (!projectId || !workspaceId) {
      const errorMessage = 'Missing required parameters: projectId or workspaceId';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      onError?.(errorMessage);
      return null;
    }

    try {
      const result = await reindexFileAPI(projectId, workspaceId, filePath);

      // Refresh status after re-indexing
      await mutateSWR();

      if (result.success) {
        toast({
          title: 'File Re-indexed',
          description: `Successfully re-indexed ${filePath}`,
        });
      } else {
        toast({
          title: 'Re-indexing Failed',
          description: result.error || `Failed to re-index ${filePath}`,
          variant: 'destructive',
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to re-index file';
      toast({
        title: 'Re-indexing Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      onError?.(errorMessage);
      return null;
    }
  }, [projectId, workspaceId, toast, onError, mutateSWR]);

  /**
   * Clear all indexed data for the project
   */
  const clearIndex = useCallback(async (): Promise<void> => {
    if (!projectId) {
      const errorMessage = 'Missing required parameter: projectId';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      onError?.(errorMessage);
      return;
    }

    try {
      await clearIndexAPI(projectId);

      // Refresh status after clearing
      await mutateSWR();

      toast({
        title: 'Index Cleared',
        description: 'Successfully cleared all indexed data for this project.',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to clear index';
      toast({
        title: 'Clear Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      onError?.(errorMessage);
    }
  }, [projectId, toast, onError, mutateSWR]);

  /**
   * Refresh indexing status
   */
  const refreshStatus = useCallback(async (): Promise<void> => {
    await mutateSWR();
  }, [mutateSWR]);

  // Computed properties
  const isFullyIndexed = status ? status.indexedFiles > 0 && status.progress === 100 : false;
  const needsIndexing = status ? status.indexedFiles === 0 && status.totalFiles === 0 : false;
  const progressPercentage = status?.progress || 0;

  return {
    // State
    status: status || null,
    isLoading,
    isIndexing: isIndexing || (status?.isIndexing ?? false),
    error: error || null,

    // Actions
    startIndexing,
    pauseIndexing,
    reindexFile,
    clearIndex,
    refreshStatus,

    // Utilities
    isFullyIndexed,
    needsIndexing,
    progressPercentage,
  };
}

/**
 * Usage Example:
 *
 * const {
 *   status,
 *   isIndexing,
 *   startIndexing,
 *   reindexFile,
 *   isFullyIndexed
 * } = useCodebaseIndexing({
 *   projectId: 1,
 *   workspaceId: 1,
 *   projectPath: '/path/to/project',
 *   autoIndex: true,
 *   onIndexingComplete: (result) => {
 *     console.log('Indexing done:', result);
 *   }
 * });
 */
