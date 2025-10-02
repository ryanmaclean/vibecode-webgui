'use client';

import { useTauriMenuBar } from '@/hooks/useTauriMenuBar';

/**
 * Client component that activates Tauri menu bar integration
 *
 * This component uses the useTauriMenuBar hook to listen for
 * system tray menu events and trigger Docker container management.
 *
 * It renders nothing but provides the side effect of activating
 * menu bar event listeners.
 */
export function TauriMenuBarProvider() {
  useTauriMenuBar();
  return null;
}
