/**
 * Command Palette Component
 * VS Code-style command palette for keyboard-first navigation
 * WCAG 2.1 AA compliant
 */

'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

/**
 * Main CommandPalette component
 */
export function CommandPalette({
  isOpen,
  onClose,
  className,
}: CommandPaletteProps) {
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus search input when opened
  React.useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Reset search query when closed
  React.useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Trap focus within modal
  React.useEffect(() => {
    if (!isOpen) return;

    const modal = document.getElementById('command-palette-modal');
    if (!modal) return;

    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    };

    modal.addEventListener('keydown', handleTabKey as EventListener);
    firstElement?.focus();

    return () => {
      modal.removeEventListener('keydown', handleTabKey as EventListener);
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal */}
          <div
            className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="command-palette-title"
            id="command-palette-modal"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'relative w-full max-w-2xl',
                'bg-white dark:bg-neutral-900',
                'rounded-lg shadow-2xl',
                'border border-neutral-200 dark:border-neutral-700',
                className
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header with search input */}
              <div className="border-b border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center gap-3 px-4 py-3">
                  <Search
                    className="w-5 h-5 text-neutral-400 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Type a command or search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={cn(
                      'flex-1 bg-transparent',
                      'text-neutral-900 dark:text-neutral-100',
                      'placeholder:text-neutral-500 dark:placeholder:text-neutral-400',
                      'focus:outline-none',
                      'text-base'
                    )}
                    aria-label="Search commands"
                    id="command-palette-title"
                  />
                  <button
                    onClick={onClose}
                    className={cn(
                      'p-1 rounded',
                      'text-neutral-500 hover:text-neutral-700',
                      'dark:text-neutral-400 dark:hover:text-neutral-200',
                      'hover:bg-neutral-100 dark:hover:bg-neutral-800',
                      'transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500'
                    )}
                    aria-label="Close command palette"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Results area (placeholder for now) */}
              <div
                className={cn(
                  'max-h-96 overflow-y-auto',
                  'p-2'
                )}
                role="listbox"
                aria-label="Command results"
              >
                {searchQuery ? (
                  <div className="p-8 text-center text-neutral-500 dark:text-neutral-400">
                    <p className="text-sm">
                      No commands found for &quot;{searchQuery}&quot;
                    </p>
                  </div>
                ) : (
                  <div className="p-8 text-center text-neutral-500 dark:text-neutral-400">
                    <p className="text-sm">
                      Type to search for commands...
                    </p>
                  </div>
                )}
              </div>

              {/* Footer with keyboard hints */}
              <div className="border-t border-neutral-200 dark:border-neutral-700 px-4 py-2">
                <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 rounded border border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-800 font-mono text-xs">
                        ↑↓
                      </kbd>
                      <span>Navigate</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 rounded border border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-800 font-mono text-xs">
                        ↵
                      </kbd>
                      <span>Select</span>
                    </span>
                  </div>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-800 font-mono text-xs">
                      Esc
                    </kbd>
                    <span>Close</span>
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
