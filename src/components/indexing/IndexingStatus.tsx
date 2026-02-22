/**
 * IndexingStatus Component
 * Displays real-time codebase indexing progress
 *
 * Features:
 * - Progress bar with percentage
 * - File count (indexed/total)
 * - Status indicators (indexing, completed, idle)
 * - Automatically updates via WorkspaceProvider
 */

'use client';

import * as React from 'react';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface IndexingStatusProps {
  className?: string;
  compact?: boolean;
}

/**
 * IndexingStatus Component
 * Shows current indexing progress and status
 */
export const IndexingStatus = React.memo<IndexingStatusProps>(({ className, compact = false }) => {
  const {
    indexingStatus,
    isIndexing,
    isFullyIndexed,
    progressPercentage,
  } = useWorkspace();

  // Don't render if no indexing status available
  if (!indexingStatus) {
    return null;
  }

  const { totalFiles, indexedFiles, totalChunks } = indexingStatus;

  // Determine status text and color
  const getStatusText = () => {
    if (isIndexing) {
      return 'Indexing...';
    }
    if (isFullyIndexed) {
      return 'Indexed';
    }
    return 'Ready';
  };

  const getStatusColor = () => {
    if (isIndexing) {
      return 'text-blue-600 dark:text-blue-400';
    }
    if (isFullyIndexed) {
      return 'text-green-600 dark:text-green-400';
    }
    return 'text-muted-foreground';
  };

  // Compact view for minimal UI footprint
  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 text-xs', className)}>
        <span className={cn('font-medium', getStatusColor())}>
          {getStatusText()}
        </span>
        {isIndexing && (
          <>
            <span className="text-muted-foreground">
              {indexedFiles}/{totalFiles}
            </span>
            <div className="w-16">
              <Progress value={progressPercentage} className="h-1" />
            </div>
          </>
        )}
      </div>
    );
  }

  // Full view with detailed information
  return (
    <div className={cn('space-y-2', className)}>
      {/* Status header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-medium', getStatusColor())}>
            {getStatusText()}
          </span>
          {isIndexing && (
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
            </div>
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          {indexedFiles} / {totalFiles} files
        </span>
      </div>

      {/* Progress bar */}
      {(isIndexing || !isFullyIndexed) && (
        <Progress value={progressPercentage} className="h-2" />
      )}

      {/* Additional info */}
      {isFullyIndexed && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{totalChunks.toLocaleString()} code chunks indexed</span>
          {indexingStatus.lastIndexedAt && (
            <span>
              Last indexed: {new Date(indexingStatus.lastIndexedAt).toLocaleString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

IndexingStatus.displayName = 'IndexingStatus';
