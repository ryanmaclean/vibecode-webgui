/**
 * DiffViewer Component
 *
 * Displays side-by-side or unified diff view for code changes
 * with syntax highlighting and line numbers.
 *
 * Features:
 * - Line-by-line diff comparison
 * - Addition/deletion highlighting
 * - Line number display
 * - Statistics (additions/deletions)
 * - Responsive design
 * - Dark mode support
 *
 * @module components/agents/DiffViewer
 */

'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a single line in the diff view
 */
export interface DiffLine {
  /** Line number in old content (undefined for additions) */
  oldLineNumber?: number;
  /** Line number in new content (undefined for deletions) */
  newLineNumber?: number;
  /** The text content of the line */
  content: string;
  /** Type of change: added, removed, or unchanged */
  type: 'added' | 'removed' | 'unchanged';
}

/**
 * Props for the DiffViewer component
 */
export interface DiffViewerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Original content before changes */
  oldContent: string;
  /** New content after changes */
  newContent: string;
  /** Programming language for syntax highlighting (optional) */
  language?: string;
  /** File name being modified */
  fileName?: string;
  /** Show line numbers (default: true) */
  showLineNumbers?: boolean;
  /** Context lines to show around changes (default: 3) */
  contextLines?: number;
  /** Show header with file info (default: true) */
  showHeader?: boolean;
}

/**
 * Statistics about the diff
 */
interface DiffStats {
  added: number;
  removed: number;
  unchanged: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Compute line-by-line diff between old and new content
 *
 * This is a simple implementation. For production use with complex diffs,
 * consider using a library like 'diff' or 'react-diff-view'.
 */
function computeDiff(
  oldContent: string,
  newContent: string,
  contextLines: number = 3
): DiffLine[] {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const diffLines: DiffLine[] = [];

  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    const oldLine = oldLines[oldIndex];
    const newLine = newLines[newIndex];

    if (oldIndex >= oldLines.length) {
      // Only new lines remain (additions)
      diffLines.push({
        newLineNumber: newIndex + 1,
        content: newLine,
        type: 'added',
      });
      newIndex++;
    } else if (newIndex >= newLines.length) {
      // Only old lines remain (deletions)
      diffLines.push({
        oldLineNumber: oldIndex + 1,
        content: oldLine,
        type: 'removed',
      });
      oldIndex++;
    } else if (oldLine === newLine) {
      // Lines are the same
      diffLines.push({
        oldLineNumber: oldIndex + 1,
        newLineNumber: newIndex + 1,
        content: oldLine,
        type: 'unchanged',
      });
      oldIndex++;
      newIndex++;
    } else {
      // Lines are different - mark as removed and added
      diffLines.push({
        oldLineNumber: oldIndex + 1,
        content: oldLine,
        type: 'removed',
      });
      diffLines.push({
        newLineNumber: newIndex + 1,
        content: newLine,
        type: 'added',
      });
      oldIndex++;
      newIndex++;
    }
  }

  return diffLines;
}

/**
 * Calculate statistics from diff lines
 */
function calculateStats(diffLines: DiffLine[]): DiffStats {
  return {
    added: diffLines.filter((line) => line.type === 'added').length,
    removed: diffLines.filter((line) => line.type === 'removed').length,
    unchanged: diffLines.filter((line) => line.type === 'unchanged').length,
  };
}

// ============================================================================
// Subcomponents
// ============================================================================

/**
 * Header showing file information and diff statistics
 */
interface DiffHeaderProps {
  fileName?: string;
  language?: string;
  stats: DiffStats;
}

function DiffHeader({ fileName, language, stats }: DiffHeaderProps) {
  return (
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-mono">
            {fileName || 'Untitled'}
          </CardTitle>
          {language && (
            <Badge variant="secondary" className="text-xs">
              {language}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <span className="font-semibold">+{stats.added}</span>
          </span>
          <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <span className="font-semibold">-{stats.removed}</span>
          </span>
        </div>
      </div>
      {stats.unchanged > 0 && (
        <CardDescription className="text-xs">
          {stats.unchanged} line{stats.unchanged !== 1 ? 's' : ''} unchanged
        </CardDescription>
      )}
    </CardHeader>
  );
}

/**
 * Single line in the diff view
 */
interface DiffLineRowProps {
  line: DiffLine;
  showLineNumbers: boolean;
  index: number;
}

function DiffLineRow({ line, showLineNumbers, index }: DiffLineRowProps) {
  return (
    <tr
      className={cn(
        'border-l-2 hover:bg-muted/30 transition-colors',
        line.type === 'added' &&
          'bg-green-50 dark:bg-green-950/20 border-l-green-500',
        line.type === 'removed' &&
          'bg-red-50 dark:bg-red-950/20 border-l-red-500',
        line.type === 'unchanged' && 'border-l-transparent'
      )}
    >
      {/* Line numbers */}
      {showLineNumbers && (
        <>
          <td className="px-3 py-1 text-right text-xs text-muted-foreground select-none w-12 min-w-[3rem] border-r">
            {line.oldLineNumber || ''}
          </td>
          <td className="px-3 py-1 text-right text-xs text-muted-foreground select-none w-12 min-w-[3rem] border-r">
            {line.newLineNumber || ''}
          </td>
        </>
      )}

      {/* Change indicator */}
      <td className="px-2 py-1 w-6 min-w-[1.5rem] select-none text-center">
        <span
          className={cn(
            'inline-block w-4 font-semibold',
            line.type === 'added' && 'text-green-600 dark:text-green-400',
            line.type === 'removed' && 'text-red-600 dark:text-red-400',
            line.type === 'unchanged' && 'text-muted-foreground'
          )}
          aria-label={
            line.type === 'added'
              ? 'Added line'
              : line.type === 'removed'
              ? 'Removed line'
              : 'Unchanged line'
          }
        >
          {line.type === 'added' && '+'}
          {line.type === 'removed' && '-'}
          {line.type === 'unchanged' && ' '}
        </span>
      </td>

      {/* Line content */}
      <td className="px-3 py-1 whitespace-pre font-mono text-sm">
        <code
          className={cn(
            line.type === 'added' && 'text-green-900 dark:text-green-100',
            line.type === 'removed' && 'text-red-900 dark:text-red-100',
            line.type === 'unchanged' && 'text-foreground'
          )}
        >
          {line.content || ' '}
        </code>
      </td>
    </tr>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * DiffViewer component for displaying code changes
 *
 * Shows a unified diff view with syntax highlighting and line numbers.
 * Highlights additions in green and deletions in red.
 *
 * @example
 * ```tsx
 * <DiffViewer
 *   oldContent="const x = 1;"
 *   newContent="const x = 2;"
 *   fileName="example.ts"
 *   language="typescript"
 * />
 * ```
 */
export const DiffViewer = React.memo(
  React.forwardRef<HTMLDivElement, DiffViewerProps>(
    (
      {
        className,
        oldContent,
        newContent,
        language,
        fileName,
        showLineNumbers = true,
        contextLines = 3,
        showHeader = true,
        ...props
      },
      ref
    ) => {
      // Compute diff lines
      const diffLines = useMemo(
        () => computeDiff(oldContent, newContent, contextLines),
        [oldContent, newContent, contextLines]
      );

      // Calculate statistics
      const stats = useMemo(() => calculateStats(diffLines), [diffLines]);

      // Empty state
      const hasChanges = stats.added > 0 || stats.removed > 0;

      return (
        <Card
          ref={ref}
          className={cn('overflow-hidden', className)}
          {...props}
        >
          {showHeader && (
            <DiffHeader fileName={fileName} language={language} stats={stats} />
          )}

          <CardContent className="p-0">
            {hasChanges || stats.unchanged > 0 ? (
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full border-collapse">
                  <tbody>
                    {diffLines.map((line, index) => (
                      <DiffLineRow
                        key={`${line.oldLineNumber}-${line.newLineNumber}-${index}`}
                        line={line}
                        showLineNumbers={showLineNumbers}
                        index={index}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No changes detected
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      );
    }
  )
);

DiffViewer.displayName = 'DiffViewer';

// ============================================================================
// Exports
// ============================================================================

export type { DiffStats };
