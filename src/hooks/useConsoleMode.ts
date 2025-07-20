import { useState, useCallback } from 'react';
import { api } from '@/lib/api';

export function useConsoleMode() {
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openConsole = useCallback(async (workspaceId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Verify workspace exists and user has access
      const workspace = await api.get(`/api/workspace/${workspaceId}`);
      if (!workspace) {
        throw new Error('Workspace not found');
      }
      
      // Initialize Goose in the workspace if not already done
      try {
        await api.post(`/api/workspace/${workspaceId}/init-goose`);
      } catch (err) {
        console.warn('Failed to initialize Goose, continuing without it', err);
      }
      
      setIsConsoleOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open console');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const closeConsole = useCallback(() => {
    setIsConsoleOpen(false);
    setError(null);
  }, []);

  return {
    isConsoleOpen,
    isLoading,
    error,
    openConsole,
    closeConsole,
  };
}
