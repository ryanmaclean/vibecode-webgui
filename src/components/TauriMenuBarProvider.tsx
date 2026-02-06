'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useTauriMenuBar, VMStatus } from '@/hooks/useTauriMenuBar';

/**
 * Context for Tauri menu bar state and actions
 */
interface TauriMenuBarContextType {
  vmStatus: VMStatus;
  isLoading: boolean;
  error: string | null;
  startServices: () => Promise<void>;
  stopServices: () => Promise<void>;
  restartServices: () => Promise<void>;
  copyToClipboard: (text: string) => Promise<void>;
  getConnectionString: (service: string) => string | null;
}

const TauriMenuBarContext = createContext<TauriMenuBarContextType | null>(null);

/**
 * Hook to access Tauri menu bar state and actions from any component
 *
 * @example
 * ```tsx
 * function ServiceStatus() {
 *   const { vmStatus, startServices } = useTauriMenuBarContext();
 *   return (
 *     <div>
 *       <p>Status: {vmStatus.status}</p>
 *       <button onClick={startServices}>Start</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useTauriMenuBarContext() {
  const context = useContext(TauriMenuBarContext);
  if (!context) {
    // Return a safe default when not in provider (e.g., non-Tauri environment)
    return {
      vmStatus: {
        isRunning: false,
        status: 'Unknown',
        services: [],
      } as VMStatus,
      isLoading: false,
      error: null,
      startServices: async () => {},
      stopServices: async () => {},
      restartServices: async () => {},
      copyToClipboard: async () => {},
      getConnectionString: () => null,
    };
  }
  return context;
}

/**
 * Props for TauriMenuBarProvider
 */
interface TauriMenuBarProviderProps {
  children?: ReactNode;
}

/**
 * Client component that activates Tauri menu bar integration
 *
 * This component uses the useTauriMenuBar hook to listen for
 * system tray menu events and trigger Docker container management.
 *
 * It provides a context for accessing VM status and actions from
 * child components, while also providing the side effect of
 * activating menu bar event listeners.
 *
 * @example
 * ```tsx
 * // In your root layout
 * function App() {
 *   return (
 *     <TauriMenuBarProvider>
 *       <YourApp />
 *     </TauriMenuBarProvider>
 *   );
 * }
 *
 * // In a child component
 * function StatusDisplay() {
 *   const { vmStatus, startServices, stopServices } = useTauriMenuBarContext();
 *   return (
 *     <div>
 *       <p>VM Status: {vmStatus.status}</p>
 *       <p>IP: {vmStatus.ipAddress || 'N/A'}</p>
 *       <p>Services: {vmStatus.services.filter(s => s.isHealthy).length} healthy</p>
 *       {!vmStatus.isRunning ? (
 *         <button onClick={startServices}>Start VM</button>
 *       ) : (
 *         <button onClick={stopServices}>Stop VM</button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function TauriMenuBarProvider({ children }: TauriMenuBarProviderProps) {
  const menuBarState = useTauriMenuBar();

  return (
    <TauriMenuBarContext.Provider value={menuBarState}>
      {children}
    </TauriMenuBarContext.Provider>
  );
}
