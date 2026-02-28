/**
 * WorkspaceProvider Component
 * Provides workspace context and manages codebase indexing lifecycle
 *
 * Features:
 * - Automatic codebase indexing on project open
 * - File watcher integration for incremental updates
 * - Indexing status tracking and progress updates
 * - Lifecycle management (start/stop indexing)
 */

'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useCodebaseIndexing, type IndexingStatus, type UseCodebaseIndexingReturn } from '@/hooks/useCodebaseIndexing';

// Types
export interface Workspace {
  id: number;
  name: string;
  project_id?: number;
  project_path?: string;
  userId: number;
  createdAt?: string;
  updatedAt?: string;
}

interface WorkspaceContextValue {
  // Workspace state
  workspace: Workspace | null;
  isLoading: boolean;
  error?: string;

  // Indexing state and actions (from useCodebaseIndexing)
  indexingStatus: IndexingStatus | null;
  isIndexing: boolean;
  isFullyIndexed: boolean;
  needsIndexing: boolean;
  progressPercentage: number;

  // Actions
  setWorkspace: (workspace: Workspace | null) => void;
  startIndexing: () => Promise<void>;
  pauseIndexing: () => void;
  reindexFile: (filePath: string) => Promise<void>;
  clearIndex: () => Promise<void>;
  refreshIndexStatus: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export interface WorkspaceProviderProps {
  children: ReactNode;
  initialWorkspace?: Workspace | null;
}

/**
 * WorkspaceProvider
 * Manages workspace state and codebase indexing lifecycle
 */
export function WorkspaceProvider({ children, initialWorkspace = null }: WorkspaceProviderProps) {
  const [workspace, setWorkspace] = useState<Workspace | null>(initialWorkspace);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [indexingEnabled, setIndexingEnabled] = useState(false);

  // Enable indexing when we have all required workspace data
  useEffect(() => {
    const shouldEnableIndexing = !!(
      workspace?.project_id &&
      workspace?.id &&
      workspace?.project_path
    );

    setIndexingEnabled(shouldEnableIndexing);

    if (shouldEnableIndexing) {
      console.log('[WorkspaceProvider] Indexing enabled for workspace:', {
        workspaceId: workspace.id,
        projectId: workspace.project_id,
        projectPath: workspace.project_path,
      });
    }
  }, [workspace]);

  // Use codebase indexing hook
  const {
    status: indexingStatus,
    isIndexing,
    isFullyIndexed,
    needsIndexing,
    progressPercentage,
    startIndexing: startIndexingInternal,
    pauseIndexing,
    reindexFile: reindexFileInternal,
    clearIndex: clearIndexInternal,
    refreshStatus,
  } = useCodebaseIndexing({
    projectId: workspace?.project_id,
    workspaceId: workspace?.id,
    projectPath: workspace?.project_path,
    autoIndex: true, // Auto-trigger indexing if not indexed
    enabled: indexingEnabled,
    refreshInterval: 0, // Only poll when actively indexing
    onIndexingStart: () => {
      console.log('[WorkspaceProvider] Indexing started');
    },
    onIndexingComplete: (result) => {
      console.log('[WorkspaceProvider] Indexing complete:', {
        totalFiles: result.totalFiles,
        successCount: result.successCount,
        failureCount: result.failureCount,
      });
    },
    onIndexingProgress: (status) => {
      console.log('[WorkspaceProvider] Indexing progress:', {
        progress: status.progress,
        indexedFiles: status.indexedFiles,
        totalFiles: status.totalFiles,
      });
    },
    onError: (errorMessage) => {
      console.error('[WorkspaceProvider] Indexing error:', errorMessage);
      setError(errorMessage);
    },
  });

  // Wrapped actions with error handling
  const startIndexing = useCallback(async (): Promise<void> => {
    try {
      setError(undefined);
      await startIndexingInternal();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start indexing';
      setError(message);
      console.error('[WorkspaceProvider] Error starting indexing:', err);
    }
  }, [startIndexingInternal]);

  const reindexFile = useCallback(async (filePath: string): Promise<void> => {
    try {
      setError(undefined);
      await reindexFileInternal(filePath);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to re-index file';
      setError(message);
      console.error('[WorkspaceProvider] Error re-indexing file:', err);
    }
  }, [reindexFileInternal]);

  const clearIndex = useCallback(async (): Promise<void> => {
    try {
      setError(undefined);
      await clearIndexInternal();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clear index';
      setError(message);
      console.error('[WorkspaceProvider] Error clearing index:', err);
    }
  }, [clearIndexInternal]);

  const refreshIndexStatus = useCallback(async (): Promise<void> => {
    try {
      await refreshStatus();
    } catch (err) {
      console.error('[WorkspaceProvider] Error refreshing index status:', err);
    }
  }, [refreshStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[WorkspaceProvider] Cleaning up workspace');
      // File watcher cleanup is handled by useCodebaseIndexing hook
    };
  }, []);

  // Context value
  const value = useMemo<WorkspaceContextValue>(
    () => ({
      // Workspace state
      workspace,
      isLoading,
      error,

      // Indexing state
      indexingStatus,
      isIndexing,
      isFullyIndexed,
      needsIndexing,
      progressPercentage,

      // Actions
      setWorkspace,
      startIndexing,
      pauseIndexing,
      reindexFile,
      clearIndex,
      refreshIndexStatus,
    }),
    [
      workspace,
      isLoading,
      error,
      indexingStatus,
      isIndexing,
      isFullyIndexed,
      needsIndexing,
      progressPercentage,
      startIndexing,
      pauseIndexing,
      reindexFile,
      clearIndex,
      refreshIndexStatus,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

/**
 * Hook to access workspace context
 * Must be used within a WorkspaceProvider
 */
export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}

/**
 * Usage Example:
 *
 * // Wrap your workspace page with the provider:
 * <WorkspaceProvider initialWorkspace={workspace}>
 *   <WorkspacePage />
 * </WorkspaceProvider>
 *
 * // Access workspace and indexing state in child components:
 * const {
 *   workspace,
 *   indexingStatus,
 *   isIndexing,
 *   isFullyIndexed,
 *   startIndexing,
 *   reindexFile,
 * } = useWorkspace();
 */
