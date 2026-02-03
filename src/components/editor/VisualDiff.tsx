/**
 * Visual Diff Component - Side-by-side file comparison
 * 
 * Provides a Monaco-powered diff editor for comparing two versions of a file
 * with syntax highlighting and inline change indicators.
 * 
 * Features:
 * - Side-by-side comparison
 * - Inline change highlighting
 * - Syntax highlighting for multiple languages
 * - Theme support (light/dark)
 * - Read-only mode
 * 
 * @module components/editor/VisualDiff
 */

"use client";

import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { ComponentProps } from 'react';
import type { editor } from 'monaco-editor';

interface VisualDiffProps {
  /** Original content (left side) */
  original: string;
  /** Modified content (right side) */
  modified: string;
  /** Programming language for syntax highlighting */
  language?: string;
  /** Editor theme */
  theme?: 'vs-dark' | 'light' | 'hc-black';
  /** Height of the diff editor */
  height?: string | number;
  /** Width of the diff editor */
  width?: string | number;
  /** Enable read-only mode */
  readOnly?: boolean;
  /** Additional Monaco diff editor options */
  options?: editor.IStandaloneDiffEditorConstructionOptions;
  /** Custom className */
  className?: string;
  /** Callback when modified content changes (if not read-only) */
  onModifiedChange?: (value: string | undefined) => void;
}

// Loading skeleton component
function DiffEditorLoadingSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted/30 animate-pulse">
      <div className="flex flex-col items-center gap-3">
        <div className="h-12 w-12 rounded-lg bg-muted-foreground/20 animate-bounce"></div>
        <span className="text-sm text-muted-foreground">Loading Diff Editor...</span>
        <div className="flex gap-2">
          <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse"></div>
          <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:0.2s]"></div>
          <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:0.4s]"></div>
        </div>
      </div>
    </div>
  );
}

// Dynamically import Monaco DiffEditor with SSR disabled
const DiffEditorComponent = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.DiffEditor),
  {
    ssr: false,
    loading: () => <DiffEditorLoadingSkeleton />,
  }
);

/**
 * VisualDiff Component
 * 
 * Renders a side-by-side diff view for comparing two versions of code or text.
 * 
 * @example
 * ```tsx
 * <VisualDiff
 *   original="const x = 1;"
 *   modified="const x = 2;"
 *   language="javascript"
 *   height="500px"
 * />
 * ```
 */
export function VisualDiff({
  original,
  modified,
  language = 'plaintext',
  theme: themeProp,
  height = '100%',
  width = '100%',
  readOnly = true,
  options = {},
  className = '',
  onModifiedChange,
}: VisualDiffProps) {
  const { theme: systemTheme } = useTheme();
  
  // Determine theme to use
  const editorTheme = themeProp || (systemTheme === 'dark' ? 'vs-dark' : 'light');

  return (
    <div className={className} style={{ height, width }}>
      <DiffEditorComponent
        height={height}
        width={width}
        language={language}
        theme={editorTheme}
        original={original}
        modified={modified}
        options={{
          readOnly,
          renderSideBySide: true,
          enableSplitViewResizing: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          renderOverviewRuler: true,
          ...options,
        }}
        onMount={(editor, monaco) => {
          // Set up change listener if callback provided and not read-only
          if (onModifiedChange && !readOnly) {
            const modifiedEditor = editor.getModifiedEditor();
            modifiedEditor.onDidChangeModelContent(() => {
              const value = modifiedEditor.getValue();
              onModifiedChange(value);
            });
          }
        }}
      />
    </div>
  );
}

// Named export for the loading skeleton if needed elsewhere
export { DiffEditorLoadingSkeleton };

// Export type for external use
export type { VisualDiffProps };
