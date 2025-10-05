/**
 * Keyboard Shortcuts Component
 * Help modal displaying all available keyboard shortcuts
 * WCAG 2.1 AA compliant
 */

'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Command, Keyboard } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ShortcutCategory {
  name: string;
  shortcuts: Shortcut[];
}

export interface Shortcut {
  keys: string[];
  description: string;
  context?: string;
}

export interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: ShortcutCategory[];
  className?: string;
}

const defaultShortcuts: ShortcutCategory[] = [
  {
    name: 'Global',
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Open agent selector' },
      { keys: ['⌘', '1'], description: 'Switch to Agent 1' },
      { keys: ['⌘', '2'], description: 'Switch to Agent 2' },
      { keys: ['⌘', '3'], description: 'Switch to Agent 3' },
      { keys: ['⌘', '4'], description: 'Switch to Agent 4' },
      { keys: ['⌘', '5'], description: 'Switch to Agent 5' },
      { keys: ['⌘', '6'], description: 'Switch to Agent 6' },
      { keys: ['⌘', '/'], description: 'Show keyboard shortcuts' },
      { keys: ['⌘', 'F'], description: 'Search conversations' },
      { keys: ['Esc'], description: 'Close modal/dropdown' },
    ],
  },
  {
    name: 'Conversation',
    shortcuts: [
      { keys: ['⌘', '↵'], description: 'Send message', context: 'Input focused' },
      { keys: ['Shift', '↵'], description: 'New line in input', context: 'Input focused' },
      { keys: ['↑'], description: 'Edit last message', context: 'Input empty' },
      { keys: ['⌘', 'R'], description: 'Reply to message', context: 'Message focused' },
      { keys: ['⌘', 'C'], description: 'Copy code block', context: 'Code block focused' },
      { keys: ['Space'], description: 'Collapse/expand replies', context: 'Message focused' },
    ],
  },
  {
    name: 'Navigation',
    shortcuts: [
      { keys: ['Tab'], description: 'Next element' },
      { keys: ['Shift', 'Tab'], description: 'Previous element' },
      { keys: ['↑', '↓'], description: 'Navigate agents', context: 'Dropdown open' },
      { keys: ['Home'], description: 'First agent', context: 'Dropdown open' },
      { keys: ['End'], description: 'Last agent', context: 'Dropdown open' },
      { keys: ['↵'], description: 'Select agent', context: 'Dropdown open' },
    ],
  },
  {
    name: 'Desktop Only',
    shortcuts: [
      { keys: ['⌘', 'N'], description: 'Add agent panel' },
      { keys: ['⌘', 'W'], description: 'Close agent panel' },
      { keys: ['⌘', '←'], description: 'Previous panel' },
      { keys: ['⌘', '→'], description: 'Next panel' },
      { keys: ['⌘', ']'], description: 'Increase panel width' },
      { keys: ['⌘', '['], description: 'Decrease panel width' },
    ],
  },
];

/**
 * Key badge component
 */
function KeyBadge({ keyName }: { keyName: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center',
        'min-w-[28px] h-7 px-2',
        'rounded border border-neutral-300 dark:border-neutral-600',
        'bg-neutral-100 dark:bg-neutral-800',
        'text-xs font-mono font-semibold',
        'shadow-sm'
      )}
    >
      {keyName}
    </kbd>
  );
}

/**
 * Shortcut row component
 */
function ShortcutRow({ shortcut }: { shortcut: Shortcut }) {
  return (
    <div
      className="flex items-start justify-between gap-4 py-2"
      role="row"
    >
      <div className="flex-1">
        <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {shortcut.description}
        </div>
        {shortcut.context && (
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {shortcut.context}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {shortcut.keys.map((key, index) => (
          <React.Fragment key={index}>
            <KeyBadge keyName={key} />
            {index < shortcut.keys.length - 1 && (
              <span className="text-xs text-neutral-400 mx-1">+</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/**
 * Main KeyboardShortcuts component
 */
export function KeyboardShortcuts({
  isOpen,
  onClose,
  shortcuts = defaultShortcuts,
  className,
}: KeyboardShortcutsProps) {
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

  // Trap focus within modal
  React.useEffect(() => {
    if (!isOpen) return;

    const modal = document.getElementById('keyboard-shortcuts-modal');
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
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-[1300]"
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            id="keyboard-shortcuts-modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={cn(
              'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
              'w-full max-w-3xl max-h-[80vh]',
              'bg-white dark:bg-neutral-900',
              'rounded-xl shadow-2xl',
              'overflow-hidden',
              'z-[1400]',
              className
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                  <Keyboard size={20} className="text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h2
                    id="shortcuts-title"
                    className="text-lg font-semibold text-neutral-900 dark:text-neutral-100"
                  >
                    Keyboard Shortcuts
                  </h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Quick navigation and actions
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className={cn(
                  'p-2 rounded-lg',
                  'hover:bg-neutral-100 dark:hover:bg-neutral-800',
                  'focus:outline-none focus:ring-2 focus:ring-primary-500',
                  'transition-colors',
                  'min-w-[44px] min-h-[44px]'
                )}
                aria-label="Close keyboard shortcuts"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(80vh-80px)] p-6">
              <div className="space-y-8">
                {shortcuts.map((category, categoryIndex) => (
                  <section
                    key={categoryIndex}
                    className="space-y-3"
                    role="region"
                    aria-labelledby={`category-${categoryIndex}`}
                  >
                    <h3
                      id={`category-${categoryIndex}`}
                      className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider"
                    >
                      {category.name}
                    </h3>
                    <div
                      className="divide-y divide-neutral-100 dark:divide-neutral-800"
                      role="table"
                    >
                      {category.shortcuts.map((shortcut, shortcutIndex) => (
                        <ShortcutRow
                          key={shortcutIndex}
                          shortcut={shortcut}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              {/* Platform note */}
              <div className="mt-8 p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  <span className="font-semibold">Note:</span> On Windows/Linux, use{' '}
                  <KeyBadge keyName="Ctrl" /> instead of <KeyBadge keyName="⌘" /> (Command).
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">
              <div className="flex items-center justify-between">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Press <KeyBadge keyName="?" /> anytime to view shortcuts
                </p>
                <button
                  onClick={onClose}
                  className={cn(
                    'px-4 py-2 rounded-lg',
                    'bg-primary-500 text-white',
                    'hover:bg-primary-600',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                    'transition-colors',
                    'text-sm font-medium',
                    'min-h-[44px]'
                  )}
                >
                  Got it
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Hook to manage keyboard shortcuts modal
 */
export function useKeyboardShortcuts() {
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + /
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setIsOpen(true);
      }
      // ? key (Shift + /)
      else if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(!isOpen),
  };
}

/**
 * Keyboard shortcuts button trigger
 */
export function KeyboardShortcutsButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg',
        'text-sm text-neutral-600 dark:text-neutral-400',
        'hover:bg-neutral-100 dark:hover:bg-neutral-800',
        'focus:outline-none focus:ring-2 focus:ring-primary-500',
        'transition-colors',
        'min-h-[44px]',
        className
      )}
      aria-label="Show keyboard shortcuts"
      title="Keyboard shortcuts (⌘/)"
    >
      <Keyboard size={16} />
      <span className="hidden sm:inline">Shortcuts</span>
      <div className="hidden md:flex items-center gap-1 ml-1">
        <KeyBadge keyName="⌘" />
        <KeyBadge keyName="/" />
      </div>
    </button>
  );
}
