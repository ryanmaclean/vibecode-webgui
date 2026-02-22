/**
 * Keyboard Hint Component
 * Displays keyboard shortcuts as visual hints
 * WCAG 2.1 AA compliant
 */

'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const keyboardHintVariants = cva(
  'inline-flex items-center gap-1',
  {
    variants: {
      size: {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const keyBadgeVariants = cva(
  'inline-flex items-center justify-center rounded border font-mono font-semibold shadow-sm',
  {
    variants: {
      size: {
        sm: 'min-w-[24px] h-6 px-1.5 text-[10px]',
        md: 'min-w-[28px] h-7 px-2 text-xs',
        lg: 'min-w-[32px] h-8 px-2.5 text-sm',
      },
      variant: {
        default: 'border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100',
        muted: 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400',
        primary: 'border-primary-300 dark:border-primary-700 bg-primary-100 dark:bg-primary-900 text-primary-900 dark:text-primary-100',
      },
    },
    defaultVariants: {
      size: 'md',
      variant: 'default',
    },
  }
);

export interface KeyboardHintProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof keyboardHintVariants> {
  /**
   * Array of key names to display (e.g., ['⌘', 'K'] or ['Ctrl', 'Shift', 'P'])
   */
  keys: string[];
  /**
   * Separator between keys (default: '+')
   */
  separator?: string;
  /**
   * Variant for the key badges
   */
  variant?: 'default' | 'muted' | 'primary';
  /**
   * Whether to show the separator
   */
  showSeparator?: boolean;
}

/**
 * Individual key badge component
 */
const KeyBadge = React.memo<{
  keyName: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'muted' | 'primary';
}>(({ keyName, size = 'md', variant = 'default' }) => {
  return (
    <kbd
      className={cn(keyBadgeVariants({ size, variant }))}
      aria-label={`Key: ${keyName}`}
    >
      {keyName}
    </kbd>
  );
});
KeyBadge.displayName = 'KeyBadge';

/**
 * KeyboardHint component
 * Displays keyboard shortcuts as visual key badges with separators
 *
 * @example
 * ```tsx
 * <KeyboardHint keys={['⌘', 'K']} />
 * <KeyboardHint keys={['Ctrl', 'Shift', 'P']} size="sm" />
 * <KeyboardHint keys={['Enter']} variant="primary" />
 * ```
 */
const KeyboardHint = React.memo<KeyboardHintProps>(({
  keys,
  separator = '+',
  size = 'md',
  variant = 'default',
  showSeparator = true,
  className,
  ...props
}) => {
  if (!keys || keys.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(keyboardHintVariants({ size }), className)}
      role="img"
      aria-label={`Keyboard shortcut: ${keys.join(' ')}`}
      {...props}
    >
      {keys.map((key, index) => (
        <React.Fragment key={index}>
          <KeyBadge
            keyName={key}
            size={size ?? 'md'}
            variant={variant ?? 'default'}
          />
          {showSeparator && index < keys.length - 1 && (
            <span
              className="text-neutral-400 dark:text-neutral-500 mx-0.5 select-none"
              aria-hidden="true"
            >
              {separator}
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
});
KeyboardHint.displayName = 'KeyboardHint';

export { KeyboardHint, KeyBadge, keyboardHintVariants, keyBadgeVariants };
