import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConsoleMode } from './ConsoleMode';

interface ConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

export function ConsoleModal({ isOpen, onClose, workspaceId }: ConsoleModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full items-center justify-center p-4">
        <div className="relative h-[90vh] w-full max-w-6xl overflow-hidden rounded-lg bg-gray-900 shadow-2xl">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-3">
              <h2 className="text-sm font-medium text-gray-300">
                Terminal - Workspace: {workspaceId}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 text-gray-400 hover:bg-gray-800 hover:text-white"
                aria-label="Close terminal"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1">
              <ConsoleMode workspaceId={workspaceId} onClose={onClose} />
            </div>
            <div className="border-t border-gray-800 bg-gray-900 px-4 py-2 text-xs text-gray-500">
              <div className="flex items-center justify-between">
                <span>Goose is pre-installed. Use &apos;goose -h&apos; for help.</span>
                <div className="flex space-x-4">
                  <span>Ctrl+C to interrupt</span>
                  <span>Ctrl+D to exit</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
