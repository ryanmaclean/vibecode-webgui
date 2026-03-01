"use client";

import type { editor } from 'monaco-editor';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { useEffect } from 'react';
import { DiffControls, type ChangeStatistics } from './DiffControls';
import { configureMonacoWorkers } from '@/lib/monaco/monaco-worker-config';

// ============================================================================
// Types
// ============================================================================

export interface VisualDiffProps {
  /** Original code content (left side) */
  original: string;
  /** Modified code content (right side) */
  modified: string;
  /** Programming language */
  language: string;
  /** Optional onChange handler for modified content */
  onModifiedChange?: (value: string | undefined) => void;
  /** Additional Monaco diff editor options */
  options?: editor.IStandaloneDiffEditorConstructionOptions;
  /** Height of the diff editor */
  height?: string | number;
  /** Width of the diff editor */
  width?: string | number;
  /** Show diff controls for accept/reject actions */
  showControls?: boolean;
  /** Callback when accept button is clicked */
  onAccept?: () => void;
  /** Callback when reject button is clicked */
  onReject?: () => void;
  /** Statistics about the changes */
  statistics?: ChangeStatistics;
  /** Label for the control group */
  controlsLabel?: string;
  /** Whether controls are disabled */
  controlsDisabled?: boolean;
}

// ============================================================================
// Loading Skeleton
// ============================================================================

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

// ============================================================================
// Dynamic Import
// ============================================================================

// Dynamically import Monaco DiffEditor with SSR disabled
const DiffEditorComponent = dynamic(() => import('@monaco-editor/react').then((mod) => mod.DiffEditor), {
  ssr: false,
  loading: () => <DiffEditorLoadingSkeleton />,
});

// ============================================================================
// VisualDiff Component
// ============================================================================

export function VisualDiff({
  original,
  modified,
  language,
  onModifiedChange,
  options,
  height = '100%',
  width = '100%',
  showControls = false,
  onAccept,
  onReject,
  statistics,
  controlsLabel,
  controlsDisabled = false,
}: VisualDiffProps) {
  const { theme } = useTheme();

  // Configure Monaco workers before editor loads
  useEffect(() => {
    configureMonacoWorkers({
      debug: process.env.NODE_ENV === 'development',
    });
  }, []);

  // Calculate editor height when controls are shown
  const editorHeight = showControls && typeof height === 'string' && height === '100%'
    ? 'calc(100% - 200px)' // Reserve space for controls
    : height;

  return (
    <div className="flex flex-col h-full w-full gap-4">
      {/* Diff Controls - shown at the top if enabled */}
      {showControls && (
        <DiffControls
          statistics={statistics}
          onAccept={onAccept}
          onReject={onReject}
          disabled={controlsDisabled}
          level="hunk"
          label={controlsLabel}
        />
      )}

      {/* Diff Editor */}
      <div className={showControls ? 'flex-1' : 'h-full w-full'}>
        <DiffEditorComponent
          height={showControls ? '100%' : editorHeight}
          width={width}
          language={language}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          original={original}
          modified={modified}
          onMount={(editor) => {
            // Optional: Add any custom configuration on mount
            if (onModifiedChange) {
              const modifiedEditor = editor.getModifiedEditor();
              modifiedEditor.onDidChangeModelContent(() => {
                const value = modifiedEditor.getValue();
                onModifiedChange(value);
              });
            }
          }}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            readOnly: !onModifiedChange, // Make read-only if no change handler
            renderSideBySide: true,
            ...options,
          }}
        />
      </div>
    </div>
  );
}

// Named export for the loading skeleton if needed elsewhere
export { DiffEditorLoadingSkeleton };
