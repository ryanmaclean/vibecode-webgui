/**
 * Ollama Models Hook for VibeCode WebGUI
 * Manages local AI model fetching, installation, and deletion
 */

import { useState, useEffect, useCallback } from 'react';

export interface OllamaModelInfo {
  name: string;
  model: string;
  size: number;
  sizeFormatted: string;
  family: string;
  format: string;
  parameterSize: string;
  quantization: string;
  modified: string;
  estimatedSpeed: number;
}

export interface OllamaModelsResponse {
  available: boolean;
  models: OllamaModelInfo[];
  totalModels?: number;
  totalSize?: number;
  totalSizeFormatted?: string;
  message?: string;
  error?: string;
}

export interface RecommendedModels {
  coding: string[];
  general: string[];
  lightweight: string[];
  creative: string[];
}

export interface UseOllamaModelsReturn {
  models: OllamaModelInfo[];
  isLoading: boolean;
  isAvailable: boolean;
  error: string | null;
  totalModels: number;
  totalSize: number;
  totalSizeFormatted: string;
  fetchModels: () => Promise<void>;
  pullModel: (modelName: string, onProgress?: (progress: string) => void) => Promise<boolean>;
  deleteModel: (modelName: string) => Promise<boolean>;
  getModelInfo: (modelName: string) => Promise<any>;
  checkHealth: () => Promise<boolean>;
  getRecommended: () => Promise<RecommendedModels | null>;
}

export function useOllamaModels(): UseOllamaModelsReturn {
  const [models, setModels] = useState<OllamaModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalModels, setTotalModels] = useState(0);
  const [totalSize, setTotalSize] = useState(0);
  const [totalSizeFormatted, setTotalSizeFormatted] = useState('0 B');

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ollama/models');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: OllamaModelsResponse = await response.json();

      setIsAvailable(data.available);
      setModels(data.models || []);
      setTotalModels(data.totalModels || 0);
      setTotalSize(data.totalSize || 0);
      setTotalSizeFormatted(data.totalSizeFormatted || '0 B');

      if (!data.available && data.message) {
        setError(data.message);
      }
    } catch (err) {
      console.error('Failed to fetch Ollama models:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsAvailable(false);
      setModels([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const pullModel = useCallback(async (
    modelName: string,
    onProgress?: (progress: string) => void
  ): Promise<boolean> => {
    try {
      const response = await fetch('/api/ollama/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'pull',
          model: modelName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to pull model');
      }

      const data = await response.json();

      if (data.success) {
        // Refresh the models list after successful pull
        await fetchModels();
        return true;
      }

      return false;
    } catch (err) {
      console.error('Failed to pull Ollama model:', err);
      setError(err instanceof Error ? err.message : 'Failed to pull model');
      return false;
    }
  }, [fetchModels]);

  const deleteModel = useCallback(async (modelName: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/ollama/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete',
          model: modelName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete model');
      }

      const data = await response.json();

      if (data.success) {
        // Refresh the models list after successful deletion
        await fetchModels();
        return true;
      }

      return false;
    } catch (err) {
      console.error('Failed to delete Ollama model:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete model');
      return false;
    }
  }, [fetchModels]);

  const getModelInfo = useCallback(async (modelName: string): Promise<any> => {
    try {
      const response = await fetch('/api/ollama/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'info',
          model: modelName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get model info');
      }

      const data = await response.json();
      return data.info;
    } catch (err) {
      console.error('Failed to get Ollama model info:', err);
      throw err;
    }
  }, []);

  const checkHealth = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/ollama/models?action=health');

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.status === 'available';
    } catch (err) {
      console.error('Ollama health check failed:', err);
      return false;
    }
  }, []);

  const getRecommended = useCallback(async (): Promise<RecommendedModels | null> => {
    try {
      const response = await fetch('/api/ollama/models?action=recommended');

      if (!response.ok) {
        throw new Error('Failed to get recommended models');
      }

      const data = await response.json();
      return data.recommended || null;
    } catch (err) {
      console.error('Failed to get recommended models:', err);
      return null;
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return {
    models,
    isLoading,
    isAvailable,
    error,
    totalModels,
    totalSize,
    totalSizeFormatted,
    fetchModels,
    pullModel,
    deleteModel,
    getModelInfo,
    checkHealth,
    getRecommended,
  };
}

export default useOllamaModels;
