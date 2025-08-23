'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { ConsoleModal } from '@/components/console/ConsoleModal';

type ConsoleContextType = {
  openConsole: (workspaceId: string) => void;
  closeConsole: () => void;
};

const ConsoleContext = createContext<ConsoleContextType | undefined>(undefined);

export function ConsoleProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [, setIsLoading] = useState(false);
  const [, setError] = useState<string | null>(null);

  const openConsole = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);
      setWorkspaceId(id);
      setIsOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open console');
      console.error('Error opening console:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const closeConsole = useCallback(() => {
    setIsOpen(false);
    setWorkspaceId(null);
    setError(null);
  }, []);

  return (
    <ConsoleContext.Provider value={{ openConsole, closeConsole }}>
      {children}
      {workspaceId && (
        <ConsoleModal
          isOpen={isOpen}
          onClose={closeConsole}
          workspaceId={workspaceId}
        />
      )}
    </ConsoleContext.Provider>
  );
}

export function useConsole() {
  const context = useContext(ConsoleContext);
  if (context === undefined) {
    throw new Error('useConsole must be used within a ConsoleProvider');
  }
  return context;
}
