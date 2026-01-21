/**
 * Tauri Integration Module
 *
 * This module provides a type-safe interface to Tauri backend commands.
 * It handles the conditional loading of Tauri based on the environment
 * (Tauri desktop app vs web browser).
 */

// Type definitions for Tauri commands
export interface TauriCommands {
  greet: (name: string) => Promise<string>;
  checkDocker: () => Promise<boolean>;
  getDockerVersion: () => Promise<string>;
  startLimaVm: () => Promise<string>;
  stopLimaVm: () => Promise<string>;
  statusLimaVm: () => Promise<string>;
  // ML commands
  mlIsAvailable: () => Promise<boolean>;
  mlGetDeviceInfo: () => Promise<any>;
  mlGetCapabilities: () => Promise<any>;
  mlInit: () => Promise<string>;
}

/**
 * Check if we're running in a Tauri environment
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Safely invoke a Tauri command
 * Falls back to web implementation if not in Tauri environment
 */
async function invokeTauri<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (isTauri()) {
    // @ts-expect-error - Tauri types are injected at runtime
    const { invoke } = window.__TAURI__.core;
    // @ts-expect-error - invoke returns unknown which we cast to T
    return invoke<T>(command, args) as T;
  }

  // Fallback for web environment
  throw new Error(`Tauri command '${command}' not available in web environment`);
}

/**
 * Tauri Commands API
 *
 * Usage:
 * ```typescript
 * import { tauriCommands } from '@/lib/tauri';
 *
 * const result = await tauriCommands.greet('World');
 * console.log(result); // "Hello, World! Welcome to VibeCode."
 * ```
 */
export const tauriCommands: TauriCommands = {
  greet: (name: string) =>
    invokeTauri<string>('greet', { name }),

  checkDocker: () =>
    invokeTauri<boolean>('check_docker'),

  getDockerVersion: () =>
    invokeTauri<string>('get_docker_version'),

  startLimaVm: () =>
    invokeTauri<string>('start_lima_vm'),

  stopLimaVm: () =>
    invokeTauri<string>('stop_lima_vm'),

  statusLimaVm: () =>
    invokeTauri<string>('status_lima_vm'),

  // ML commands
  mlIsAvailable: () =>
    invokeTauri<boolean>('ml_is_available'),

  mlGetDeviceInfo: () =>
    invokeTauri<any>('ml_get_device_info'),

  mlGetCapabilities: () =>
    invokeTauri<any>('ml_get_capabilities'),

  mlInit: () =>
    invokeTauri<string>('ml_init'),
};

/**
 * Hook for React components to safely use Tauri commands
 */
export function useTauri() {
  return {
    isTauri: isTauri(),
    commands: tauriCommands,
  };
}
