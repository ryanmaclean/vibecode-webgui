// useTauriMenuBar.ts
// React hook for Tauri menu bar event integration
// Listens for system tray menu events and triggers Docker container management
// Updated: 2026-02-06 - Enhanced with service health, quick actions, and status updates (ROMEO)

import { useEffect, useState, useCallback } from 'react';

// Type definitions for Tauri APIs
// These will be available when running in Tauri context
declare global {
  interface Window {
    __TAURI__?: {
      event: {
        listen: (event: string, handler: (event: TauriEvent) => void) => Promise<() => void>;
        emit: (event: string, payload?: unknown) => Promise<void>;
      };
      core: {
        invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
      };
    };
  }
}

interface TauriEvent {
  event: string;
  windowLabel: string;
  payload: unknown;
}

// Service health status interface
export interface ServiceHealth {
  name: string;
  port: number;
  isHealthy: boolean;
  latencyMs?: number;
  lastChecked?: Date;
}

// VM status interface
export interface VMStatus {
  isRunning: boolean;
  status: string;
  ipAddress?: string;
  services: ServiceHealth[];
  cpuPercent?: number;
  memoryUsedMB?: number;
  memoryTotalMB?: number;
}

/**
 * React hook that listens for Tauri system tray menu events
 * and executes corresponding Docker container management commands.
 *
 * Menu events handled:
 * - start-services: Starts all vibecode Docker containers
 * - stop-services: Stops all vibecode Docker containers
 * - restart-services: Restarts all vibecode Docker containers
 * - vm-status-update: Receives VM status updates from native side
 * - copy-connection-string: Copies connection string to clipboard
 * - open-ssh-terminal: Opens SSH terminal
 *
 * This hook should be used at the root level of your application
 * to ensure menu bar integration is active throughout the app lifecycle.
 *
 * @example
 * ```tsx
 * function App() {
 *   const { vmStatus, startServices, stopServices } = useTauriMenuBar();
 *   return <YourApp vmStatus={vmStatus} />;
 * }
 * ```
 */
export function useTauriMenuBar() {
  const [vmStatus, setVMStatus] = useState<VMStatus>({
    isRunning: false,
    status: 'Unknown',
    services: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start services action
  const startServices = useCallback(async () => {
    if (typeof window === 'undefined' || !window.__TAURI__) return;

    setIsLoading(true);
    setError(null);
    try {
      const result = await window.__TAURI__.core.invoke('start_containers');
      console.info('Services started:', result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Failed to start services:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Stop services action
  const stopServices = useCallback(async () => {
    if (typeof window === 'undefined' || !window.__TAURI__) return;

    setIsLoading(true);
    setError(null);
    try {
      const result = await window.__TAURI__.core.invoke('stop_containers');
      console.info('Services stopped:', result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Failed to stop services:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Restart services action
  const restartServices = useCallback(async () => {
    if (typeof window === 'undefined' || !window.__TAURI__) return;

    setIsLoading(true);
    setError(null);
    try {
      await window.__TAURI__.core.invoke('stop_containers');
      console.info('Services stopped, waiting before restart...');

      // Wait 2 seconds before starting
      await new Promise(resolve => setTimeout(resolve, 2000));

      const result = await window.__TAURI__.core.invoke('start_containers');
      console.info('Services restarted:', result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Failed to restart services:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Copy to clipboard utility
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      console.info('Copied to clipboard:', text);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }, []);

  // Get connection string for a service
  const getConnectionString = useCallback((service: string): string | null => {
    if (!vmStatus.ipAddress) return null;

    switch (service.toLowerCase()) {
      case 'postgresql':
      case 'postgres':
        return `postgresql://postgres@${vmStatus.ipAddress}:5432`;
      case 'valkey':
      case 'redis':
        return `redis://${vmStatus.ipAddress}:6379`;
      case 'ssh':
        return `ssh root@${vmStatus.ipAddress}`;
      case 'openvscode':
      case 'ide':
        return `http://${vmStatus.ipAddress}:8080`;
      default:
        return null;
    }
  }, [vmStatus.ipAddress]);

  useEffect(() => {
    // Only run in Tauri context
    if (typeof window === 'undefined' || !window.__TAURI__) {
      console.info('useTauriMenuBar: Not running in Tauri context, skipping menu bar integration');
      return;
    }

    const { event, core } = window.__TAURI__;
    const { listen } = event;
    const { invoke } = core;

    const unlistenFns: Array<() => void> = [];

    // Listen for start-services event from menu bar
    const setupStartListener = async () => {
      try {
        const unlisten = await listen('start-services', async () => {
          console.info('Menu bar: Start services triggered');
          await startServices();
        });
        unlistenFns.push(unlisten);
      } catch (err) {
        console.error('Failed to setup start-services listener:', err);
      }
    };

    // Listen for stop-services event
    const setupStopListener = async () => {
      try {
        const unlisten = await listen('stop-services', async () => {
          console.info('Menu bar: Stop services triggered');
          await stopServices();
        });
        unlistenFns.push(unlisten);
      } catch (err) {
        console.error('Failed to setup stop-services listener:', err);
      }
    };

    // Listen for restart-services event
    const setupRestartListener = async () => {
      try {
        const unlisten = await listen('restart-services', async () => {
          console.info('Menu bar: Restart services triggered');
          await restartServices();
        });
        unlistenFns.push(unlisten);
      } catch (err) {
        console.error('Failed to setup restart-services listener:', err);
      }
    };

    // Listen for VM status updates from native side
    const setupStatusListener = async () => {
      try {
        const unlisten = await listen('vm-status-update', (event: TauriEvent) => {
          const payload = event.payload as VMStatus;
          setVMStatus(payload);
        });
        unlistenFns.push(unlisten);
      } catch (err) {
        console.error('Failed to setup vm-status-update listener:', err);
      }
    };

    // Listen for copy connection string events
    const setupCopyListener = async () => {
      try {
        const unlisten = await listen('copy-connection-string', async (event: TauriEvent) => {
          const service = event.payload as string;
          const connectionString = getConnectionString(service);
          if (connectionString) {
            await copyToClipboard(connectionString);
          }
        });
        unlistenFns.push(unlisten);
      } catch (err) {
        console.error('Failed to setup copy-connection-string listener:', err);
      }
    };

    // Setup all listeners
    const setupListeners = async () => {
      await Promise.all([
        setupStartListener(),
        setupStopListener(),
        setupRestartListener(),
        setupStatusListener(),
        setupCopyListener(),
      ]);
      console.info('useTauriMenuBar: Menu bar event listeners initialized');
    };

    setupListeners();

    // Cleanup listeners on unmount
    return () => {
      unlistenFns.forEach(unlisten => unlisten());
      console.info('useTauriMenuBar: Menu bar event listeners cleaned up');
    };
  }, [startServices, stopServices, restartServices, getConnectionString, copyToClipboard]);

  return {
    vmStatus,
    isLoading,
    error,
    startServices,
    stopServices,
    restartServices,
    copyToClipboard,
    getConnectionString,
  };
}
