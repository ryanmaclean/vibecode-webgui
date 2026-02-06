'use client';

/**
 * Update Notifier Component
 *
 * Displays update notifications and manages the update UI flow:
 * - Shows notification when update is available
 * - Displays release notes
 * - Progress bar during download
 * - Install Now and Later buttons
 * - What's New expandable section
 *
 * @module components/updates/UpdateNotifier
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

import {
  UpdateChannel,
  UpdateInfo,
  UpdateState,
  UpdateProgress,
  UpdateError,
  UpdateEvent,
  UpdateManagerState,
  InstallProgress,
} from '@/types/auto-update';

// ============================================================================
// Icons (inline SVG for no external dependencies)
// ============================================================================

const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const CheckCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const AlertCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const SparklesIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </svg>
);

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format seconds to human-readable time
 */
function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

/**
 * Format date to relative time
 */
function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}

/**
 * Get channel badge color
 */
function getChannelColor(channel: UpdateChannel): string {
  switch (channel) {
    case 'stable':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'beta':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'nightly':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
}

// ============================================================================
// Props Types
// ============================================================================

export interface UpdateNotifierProps {
  /** Current update manager state */
  state: UpdateManagerState;
  /** Callback to check for updates */
  onCheckForUpdates?: () => void;
  /** Callback to download update */
  onDownload?: () => void;
  /** Callback to install update */
  onInstall?: () => void;
  /** Callback to skip this version */
  onSkipVersion?: (version: string) => void;
  /** Callback to dismiss the notification */
  onDismiss?: () => void;
  /** Callback to cancel download */
  onCancelDownload?: () => void;
  /** Callback to retry after error */
  onRetry?: () => void;
  /** Whether to show as a floating notification */
  floating?: boolean;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Channel Badge
 */
const ChannelBadge: React.FC<{ channel: UpdateChannel }> = React.memo(({ channel }) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
      getChannelColor(channel)
    )}
  >
    {channel}
  </span>
));
ChannelBadge.displayName = 'ChannelBadge';

/**
 * Release Notes Section
 */
interface ReleaseNotesSectionProps {
  updateInfo: UpdateInfo;
  isExpanded: boolean;
  onToggle: () => void;
}

const ReleaseNotesSection: React.FC<ReleaseNotesSectionProps> = React.memo(
  ({ updateInfo, isExpanded, onToggle }) => {
    const { releaseNotes } = updateInfo;

    return (
      <div className="mt-4">
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-between rounded-md p-2 text-sm font-medium hover:bg-muted transition-colors"
          aria-expanded={isExpanded}
        >
          <span className="flex items-center gap-2">
            <SparklesIcon className="h-4 w-4" />
            What&apos;s New
          </span>
          <ChevronDownIcon
            className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')}
          />
        </button>

        {isExpanded && (
          <div className="mt-2 space-y-3 rounded-md bg-muted/50 p-3 text-sm">
            {releaseNotes.summary && (
              <p className="text-muted-foreground">{releaseNotes.summary}</p>
            )}

            {releaseNotes.sections.map((section, index) => (
              <div key={index}>
                <h4 className="font-medium text-foreground">{section.title}</h4>
                <ul className="mt-1 list-inside list-disc space-y-1 text-muted-foreground">
                  {section.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}

            {releaseNotes.breakingChanges && releaseNotes.breakingChanges.length > 0 && (
              <div className="rounded-md bg-destructive/10 p-2">
                <h4 className="font-medium text-destructive">Breaking Changes</h4>
                <ul className="mt-1 list-inside list-disc space-y-1 text-destructive/80">
                  {releaseNotes.breakingChanges.map((change, index) => (
                    <li key={index}>{change}</li>
                  ))}
                </ul>
              </div>
            )}

            {releaseNotes.knownIssues && releaseNotes.knownIssues.length > 0 && (
              <div className="rounded-md bg-yellow-500/10 p-2">
                <h4 className="font-medium text-yellow-600 dark:text-yellow-400">Known Issues</h4>
                <ul className="mt-1 list-inside list-disc space-y-1 text-yellow-600/80 dark:text-yellow-400/80">
                  {releaseNotes.knownIssues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);
ReleaseNotesSection.displayName = 'ReleaseNotesSection';

/**
 * Download Progress Section
 */
interface DownloadProgressSectionProps {
  progress: UpdateProgress;
  onCancel?: () => void;
}

const DownloadProgressSection: React.FC<DownloadProgressSectionProps> = React.memo(
  ({ progress, onCancel }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Downloading... {progress.percent}%
        </span>
        <span className="text-muted-foreground">
          {formatBytes(progress.bytesDownloaded)} / {formatBytes(progress.totalBytes)}
        </span>
      </div>

      <Progress value={progress.percent} className="h-2" />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatBytes(progress.speedBytesPerSecond)}/s</span>
        <span>
          {progress.estimatedTimeRemaining > 0
            ? `${formatTime(progress.estimatedTimeRemaining)} remaining`
            : 'Calculating...'}
        </span>
      </div>

      {onCancel && (
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="mt-2"
        >
          Cancel
        </Button>
      )}
    </div>
  )
);
DownloadProgressSection.displayName = 'DownloadProgressSection';

/**
 * Install Progress Section
 */
interface InstallProgressSectionProps {
  progress: InstallProgress;
}

const InstallProgressSection: React.FC<InstallProgressSectionProps> = React.memo(
  ({ progress }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{progress.description}</span>
        <span className="text-muted-foreground">{progress.percent}%</span>
      </div>

      <Progress value={progress.percent} className="h-2" />

      <p className="text-xs text-muted-foreground">
        Please do not close the application during installation.
      </p>
    </div>
  )
);
InstallProgressSection.displayName = 'InstallProgressSection';

/**
 * Error Section
 */
interface ErrorSectionProps {
  error: UpdateError;
  onRetry?: () => void;
  onDismiss?: () => void;
}

const ErrorSection: React.FC<ErrorSectionProps> = React.memo(
  ({ error, onRetry, onDismiss }) => (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-md bg-destructive/10 p-3">
        <AlertCircleIcon className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-destructive">{error.message}</p>
          {error.suggestion && (
            <p className="text-xs text-destructive/80">{error.suggestion}</p>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {error.recoverable && onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshIcon className="mr-2 h-4 w-4" />
            Retry
          </Button>
        )}
        {onDismiss && (
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        )}
      </div>
    </div>
  )
);
ErrorSection.displayName = 'ErrorSection';

// ============================================================================
// Main Component
// ============================================================================

/**
 * Update Notifier Component
 *
 * Displays update notifications and manages the update UI flow.
 */
export const UpdateNotifier: React.FC<UpdateNotifierProps> = React.memo(
  ({
    state,
    onCheckForUpdates,
    onDownload,
    onInstall,
    onSkipVersion,
    onDismiss,
    onCancelDownload,
    onRetry,
    floating = false,
    className,
  }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    // Reset dismissed state when new update is available
    useEffect(() => {
      if (state.updateInfo) {
        setIsDismissed(false);
      }
    }, [state.updateInfo?.version]);

    // Handle dismiss
    const handleDismiss = useCallback(() => {
      setIsDismissed(true);
      onDismiss?.();
    }, [onDismiss]);

    // Handle skip version
    const handleSkipVersion = useCallback(() => {
      if (state.updateInfo) {
        onSkipVersion?.(state.updateInfo.version);
        handleDismiss();
      }
    }, [state.updateInfo, onSkipVersion, handleDismiss]);

    // Toggle release notes
    const toggleExpanded = useCallback(() => {
      setIsExpanded((prev) => !prev);
    }, []);

    // Get current platform asset size
    const downloadSize = useMemo(() => {
      if (!state.updateInfo) return 0;
      const asset = state.updateInfo.assets.find((a) => a.platform === state.platform);
      return asset?.size || 0;
    }, [state.updateInfo, state.platform]);

    // Don't render if dismissed or no relevant state
    if (isDismissed) {
      return null;
    }

    // Idle state - nothing to show
    if (state.state === 'idle' && !state.updateInfo) {
      return null;
    }

    // Checking state
    if (state.state === 'checking') {
      return (
        <Card className={cn('w-full max-w-md', floating && 'shadow-lg', className)}>
          <CardContent className="flex items-center gap-3 p-4">
            <RefreshIcon className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Checking for updates...</span>
          </CardContent>
        </Card>
      );
    }

    // Error state
    if (state.state === 'error' && state.error) {
      return (
        <Card className={cn('w-full max-w-md', floating && 'shadow-lg', className)}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircleIcon className="h-5 w-5 text-destructive" />
              Update Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ErrorSection
              error={state.error}
              onRetry={onRetry}
              onDismiss={handleDismiss}
            />
          </CardContent>
        </Card>
      );
    }

    // Downloading state
    if (state.state === 'downloading' && state.downloadProgress) {
      return (
        <Card className={cn('w-full max-w-md', floating && 'shadow-lg', className)}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <DownloadIcon className="h-5 w-5 text-primary" />
              Downloading Update
            </CardTitle>
            {state.updateInfo && (
              <CardDescription>
                Version {state.updateInfo.version}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <DownloadProgressSection
              progress={state.downloadProgress}
              onCancel={onCancelDownload}
            />
          </CardContent>
        </Card>
      );
    }

    // Verifying state
    if (state.state === 'verifying') {
      return (
        <Card className={cn('w-full max-w-md', floating && 'shadow-lg', className)}>
          <CardContent className="flex items-center gap-3 p-4">
            <RefreshIcon className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Verifying download...</span>
          </CardContent>
        </Card>
      );
    }

    // Installing state
    if (state.state === 'installing' && state.installProgress) {
      return (
        <Card className={cn('w-full max-w-md', floating && 'shadow-lg', className)}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <RefreshIcon className="h-5 w-5 animate-spin text-primary" />
              Installing Update
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InstallProgressSection progress={state.installProgress} />
          </CardContent>
        </Card>
      );
    }

    // Ready state - update downloaded, ready to install
    if (state.state === 'ready' && state.updateInfo) {
      return (
        <Card className={cn('w-full max-w-md', floating && 'shadow-lg', className)}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  Update Ready
                </CardTitle>
                <CardDescription className="mt-1">
                  Version {state.updateInfo.version} is ready to install
                </CardDescription>
              </div>
              <button
                onClick={handleDismiss}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Dismiss"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <ReleaseNotesSection
              updateInfo={state.updateInfo}
              isExpanded={isExpanded}
              onToggle={toggleExpanded}
            />
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button onClick={onInstall}>Install Now</Button>
            <Button variant="outline" onClick={handleDismiss}>
              Later
            </Button>
          </CardFooter>
        </Card>
      );
    }

    // Available state - update available, not yet downloaded
    if ((state.state === 'available' || state.updateInfo) && state.updateInfo) {
      return (
        <Card className={cn('w-full max-w-md', floating && 'shadow-lg', className)}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">Update Available</CardTitle>
                  <ChannelBadge channel={state.updateInfo.channel} />
                </div>
                <CardDescription>
                  Version {state.updateInfo.version} - Released{' '}
                  {formatRelativeDate(state.updateInfo.releaseDate)}
                </CardDescription>
              </div>
              <button
                onClick={handleDismiss}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Dismiss"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DownloadIcon className="h-4 w-4" />
              <span>Download size: {formatBytes(downloadSize)}</span>
            </div>

            {state.updateInfo.mandatory && (
              <div className="mt-2 rounded-md bg-yellow-500/10 p-2 text-sm text-yellow-600 dark:text-yellow-400">
                This is a required update with important changes.
              </div>
            )}

            <ReleaseNotesSection
              updateInfo={state.updateInfo}
              isExpanded={isExpanded}
              onToggle={toggleExpanded}
            />
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button onClick={onDownload}>
              <DownloadIcon className="mr-2 h-4 w-4" />
              Download
            </Button>
            {!state.updateInfo.mandatory && (
              <>
                <Button variant="outline" onClick={handleDismiss}>
                  Later
                </Button>
                <Button variant="ghost" size="sm" onClick={handleSkipVersion}>
                  Skip Version
                </Button>
              </>
            )}
          </CardFooter>
        </Card>
      );
    }

    return null;
  }
);
UpdateNotifier.displayName = 'UpdateNotifier';

// ============================================================================
// Hook for Update Manager
// ============================================================================

/**
 * Props for useUpdateNotifier hook
 */
export interface UseUpdateNotifierOptions {
  /** Whether to start checking on mount */
  checkOnMount?: boolean;
  /** Custom check interval in ms */
  checkInterval?: number;
}

/**
 * Hook result
 */
export interface UseUpdateNotifierResult {
  /** Current update manager state */
  state: UpdateManagerState;
  /** Check for updates */
  checkForUpdates: () => Promise<void>;
  /** Download the available update */
  downloadUpdate: () => Promise<void>;
  /** Install the downloaded update */
  installUpdate: () => Promise<void>;
  /** Skip the current version */
  skipVersion: (version: string) => void;
  /** Cancel current download */
  cancelDownload: () => void;
  /** Whether currently loading */
  isLoading: boolean;
}

/**
 * Hook to use the update notifier with update manager
 *
 * Note: In a real implementation, this would connect to the UpdateManager
 * singleton. This is a placeholder that demonstrates the expected interface.
 */
export function useUpdateNotifier(
  options: UseUpdateNotifierOptions = {}
): UseUpdateNotifierResult {
  const [state, setState] = useState<UpdateManagerState>({
    state: 'idle',
    updateInfo: null,
    downloadProgress: null,
    installProgress: null,
    error: null,
    lastCheckTime: null,
    nextCheckTime: null,
    config: {
      channel: 'stable',
      checkInterval: 3600000,
      autoDownload: true,
      autoInstall: false,
      installOnQuit: true,
      showNotification: true,
      checkOnStartup: true,
      allowPrerelease: false,
      skippedVersions: [],
    },
    downloadedFilePath: null,
    currentVersion: '1.0.0',
    platform: 'darwin-arm64',
  });

  const [isLoading, setIsLoading] = useState(false);

  const checkForUpdates = useCallback(async () => {
    setIsLoading(true);
    setState((prev) => ({ ...prev, state: 'checking' }));

    try {
      // In a real implementation, this would call the update manager
      const response = await fetch('/api/updates/check');
      const data = await response.json();

      if (data.available && data.update) {
        setState((prev) => ({
          ...prev,
          state: 'available',
          updateInfo: data.update,
          lastCheckTime: data.checkedAt,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          state: 'idle',
          lastCheckTime: data.checkedAt,
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        state: 'error',
        error: {
          type: 'network',
          message: 'Failed to check for updates',
          recoverable: true,
          timestamp: new Date().toISOString(),
          retryCount: 0,
        },
      }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const downloadUpdate = useCallback(async () => {
    setIsLoading(true);
    setState((prev) => ({
      ...prev,
      state: 'downloading',
      downloadProgress: {
        bytesDownloaded: 0,
        totalBytes: 100000000,
        percent: 0,
        speedBytesPerSecond: 0,
        estimatedTimeRemaining: 0,
        isPaused: false,
      },
    }));

    try {
      // In a real implementation, this would call the update manager
      const response = await fetch('/api/updates/download');
      const data = await response.json();

      setState((prev) => ({
        ...prev,
        state: 'ready',
        downloadProgress: null,
        downloadedFilePath: data.filePath,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        state: 'error',
        downloadProgress: null,
        error: {
          type: 'network',
          message: 'Failed to download update',
          recoverable: true,
          timestamp: new Date().toISOString(),
          retryCount: 0,
        },
      }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const installUpdate = useCallback(async () => {
    setIsLoading(true);
    setState((prev) => ({
      ...prev,
      state: 'installing',
      installProgress: {
        step: 'preparing',
        description: 'Preparing installation...',
        percent: 0,
      },
    }));

    try {
      // In a real implementation, this would call the update manager
      await fetch('/api/updates/install', { method: 'POST' });

      setState((prev) => ({
        ...prev,
        state: 'idle',
        installProgress: null,
        updateInfo: null,
        downloadedFilePath: null,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        state: 'error',
        installProgress: null,
        error: {
          type: 'unknown',
          message: 'Failed to install update',
          recoverable: true,
          timestamp: new Date().toISOString(),
          retryCount: 0,
        },
      }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const skipVersion = useCallback((version: string) => {
    setState((prev) => ({
      ...prev,
      state: 'idle',
      updateInfo: null,
      config: {
        ...prev.config,
        skippedVersions: [...prev.config.skippedVersions, version],
      },
    }));
  }, []);

  const cancelDownload = useCallback(() => {
    setState((prev) => ({
      ...prev,
      state: 'available',
      downloadProgress: null,
    }));
  }, []);

  // Check on mount if enabled
  useEffect(() => {
    if (options.checkOnMount) {
      checkForUpdates();
    }
  }, [options.checkOnMount, checkForUpdates]);

  return {
    state,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    skipVersion,
    cancelDownload,
    isLoading,
  };
}

export default UpdateNotifier;
