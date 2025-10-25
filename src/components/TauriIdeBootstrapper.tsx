'use client';

import { useEffect, useRef } from 'react';
import { tauriCommands, isTauri } from '@/lib/tauri';

/**
 * Automatically bootstraps the Lima-based code-server IDE when running inside Tauri.
 *
 * On mount it:
 * 1. Starts the Lima VM (id "ide-lima").
 * 2. Waits briefly for the health checks to pass.
 * 3. Launches the system browser pointing at http://127.0.0.1:8080.
 *
 * On unmount it tries to stop the Lima VM to avoid orphaned guests.
 */
export function TauriIdeBootstrapper() {
  const startedRef = useRef(false);

  useEffect(() => {
    if (!isTauri() || startedRef.current) {
      return;
    }

    startedRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        await tauriCommands.startLimaVm();
        if (cancelled) return;
        // Give code-server a short window to boot before opening the browser.
        await new Promise((resolve) => setTimeout(resolve, 5000));
        if (cancelled) return;
        await tauriCommands.launchBrowser('http://127.0.0.1:8080');
      } catch (error) {
        console.error('Tauri IDE bootstrap failed', error);
      }
    })();

    return () => {
      cancelled = true;
      tauriCommands.stopLimaVm().catch(() => {
        /* ignore */
      });
    };
  }, []);

  return null;
}
