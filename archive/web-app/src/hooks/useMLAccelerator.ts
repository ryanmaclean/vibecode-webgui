// src/hooks/useMLAccelerator.ts
// React hook for using CoreML/Apple Neural Engine

import { useState, useEffect } from 'react';
import { tauriCommands } from '@/lib/tauri';
import { isTauri } from '@/lib/tauri';

export interface MLDeviceInfo {
  metalAvailable: boolean;
  coreMLAvailable: boolean;
  neuralEngineAvailable: boolean;
  device?: string;
  [key: string]: any;
}

export interface MLCapabilities {
  available: boolean;
  platform: string;
  metal: boolean;
  coreML: boolean;
  device: MLDeviceInfo;
}

export function useMLAccelerator() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<MLDeviceInfo | null>(null);
  const [capabilities, setCapabilities] = useState<MLCapabilities | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if ML is available on mount
  useEffect(() => {
    if (!isTauri()) {
      setError('Not running in Tauri environment');
      return;
    }

    const checkAvailability = async () => {
      try {
        const available = await tauriCommands.mlIsAvailable();
        setIsAvailable(available);

        if (available) {
          // Get device info
          const info = await tauriCommands.mlGetDeviceInfo();
          setDeviceInfo(info);

          // Get capabilities
          const caps = await tauriCommands.mlGetCapabilities();
          setCapabilities(caps);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsAvailable(false);
      }
    };

    checkAvailability();
  }, []);

  const initialize = async () => {
    if (!isAvailable) {
      setError('ML acceleration not available');
      return;
    }

    try {
      const result = await tauriCommands.mlInit();
      setIsInitialized(true);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to initialize';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  return {
    isAvailable,
    deviceInfo,
    capabilities,
    isInitialized,
    error,
    initialize,
  };
}

