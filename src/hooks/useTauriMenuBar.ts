// useTauriMenuBar.ts
// React hook for Tauri menu bar event integration
// Listens for system tray menu events and triggers Docker container management

import { useEffect } from 'react';
// import { logger } from '@/lib/logger';
// Type definitions for Tauri APIs
// These will be available when running in Tauri context
declare global {
  interface Window {
    __TAURI__?: {
      event: {
        listen: (event: string, handler: (event: unknown) => void) => Promise<() => void>;
      };
      core: {
        invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
      };
    };
  }
}

/**
 * React hook that listens for Tauri system tray menu events
 * and executes corresponding Docker container management commands.
 *
 * Menu events handled:
 * - start-services: Starts all vibecode Docker containers
 * - stop-services: Stops all vibecode Docker containers
 * - restart-services: Restarts all vibecode Docker containers
 *
 * This hook should be used at the root level of your application
 * to ensure menu bar integration is active throughout the app lifecycle.
 *
 * @example
 * ```tsx
 * function App() {
 *   useTauriMenuBar(); // Activate menu bar listeners
 *   return <YourApp />;
 * }
 * ```
 */
export function useTauriMenuBar() {
  useEffect(() => {
    // Only run in Tauri context
    if (typeof window === 'undefined' || !window.__TAURI__) {
      console.info('useTauriMenuBar: Not running in Tauri context, skipping menu bar integration');
      return;
    }

    const { event, core } = window.__TAURI__;
    const { listen } = event;
    const { invoke } = core;

    let startUnlisten: (() => void) | null = null;
    let stopUnlisten: (() => void) | null = null;
    let restartUnlisten: (() => void) | null = null;

    // Listen for start-services event from menu bar
    const setupStartListener = async () => {
      try {
        const unlisten = await listen('start-services', async () => {
          console.info('Menu bar: Start services triggered');
          try {
            const result = await invoke('start_containers');
            console.info('Services started:', result);
          } catch (error) {
            console.error('Failed to start services:', error);
          }
        });
        startUnlisten = unlisten;
      } catch (error) {
        console.error('Failed to setup start-services listener:', error);
      }
    };

    // Listen for stop-services event
    const setupStopListener = async () => {
      try {
        const unlisten = await listen('stop-services', async () => {
          console.info('Menu bar: Stop services triggered');
          try {
            const result = await invoke('stop_containers');
            console.info('Services stopped:', result);
          } catch (error) {
            console.error('Failed to stop services:', error);
          }
        });
        stopUnlisten = unlisten;
      } catch (error) {
        console.error('Failed to setup stop-services listener:', error);
      }
    };

    // Listen for restart-services event
    const setupRestartListener = async () => {
      try {
        const unlisten = await listen('restart-services', async () => {
          console.info('Menu bar: Restart services triggered');
          try {
            // Stop containers first
            await invoke('stop_containers');
            console.info('Services stopped, waiting before restart...');

            // Wait 2 seconds before starting
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Start containers
            const result = await invoke('start_containers');
            console.info('Services restarted:', result);
          } catch (error) {
            console.error('Failed to restart services:', error);
          }
        });
        restartUnlisten = unlisten;
      } catch (error) {
        console.error('Failed to setup restart-services listener:', error);
      }
    };

    // Setup all listeners
    setupStartListener();
    setupStopListener();
    setupRestartListener();

    console.info('useTauriMenuBar: Menu bar event listeners initialized');

    // Cleanup listeners on unmount
    return () => {
      if (startUnlisten) startUnlisten();
      if (stopUnlisten) stopUnlisten();
      if (restartUnlisten) restartUnlisten();
      console.info('useTauriMenuBar: Menu bar event listeners cleaned up');
    };
  }, []);
}
