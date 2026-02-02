import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConsoleMode } from './ConsoleMode';

interface ConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

export function ConsoleModal({ isOpen, onClose, workspaceId }: ConsoleModalProps) {
  // Handle Escape key to close modal
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // Prevent body scroll when modal is open and add keyboard listener
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="console-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 flex h-full w-full items-center justify-center p-2 sm:p-4">
        <div className="relative h-full sm:h-[90vh] w-full max-w-full sm:max-w-6xl overflow-hidden rounded-none sm:rounded-lg bg-gray-900 shadow-2xl">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-3 sm:px-4 py-3">
              <h2 id="console-modal-title" className="text-sm font-medium text-gray-300 truncate">
                Terminal - Workspace: {workspaceId}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-10 w-10 sm:h-8 sm:w-8 flex-shrink-0 text-gray-400 hover:bg-gray-800 hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                aria-label="Close terminal"
              >
                <X className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="flex-1">
              <ConsoleMode workspaceId={workspaceId} onClose={onClose} />
            </div>
            <div className="border-t border-gray-800 bg-gray-900 px-3 sm:px-4 py-2 text-xs text-gray-500">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-0">
                <span className="hidden sm:inline">Goose is pre-installed. Use &apos;goose -h&apos; for help.</span>
                <span className="sm:hidden">Press Esc to close</span>
                <div className="flex space-x-4">
                  <span>Ctrl+C to interrupt</span>
                  <span className="hidden sm:inline">Ctrl+D to exit</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
