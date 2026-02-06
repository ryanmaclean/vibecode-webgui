/**
 * Auto-Update Type Definitions for VibeCode Desktop
 *
 * Comprehensive types for the application auto-update system:
 * - Update channels (stable, beta, nightly)
 * - Update information and metadata
 * - Update state management
 * - Progress tracking
 * - Configuration options
 *
 * @module types/auto-update
 */

// ============================================================================
// Update Channel Types
// ============================================================================

/**
 * Available update channels
 * - stable: Production-ready releases
 * - beta: Pre-release versions for testing
 * - nightly: Daily builds with latest features (unstable)
 */
export type UpdateChannel = 'stable' | 'beta' | 'nightly';

/**
 * Platform identifiers for updates
 */
export type UpdatePlatform = 'darwin-arm64' | 'darwin-x64' | 'linux-x64' | 'linux-arm64' | 'win32-x64';

/**
 * Package format for the update
 */
export type UpdatePackageFormat = 'dmg' | 'pkg' | 'AppImage' | 'deb' | 'rpm' | 'msi' | 'exe' | 'tar.gz';

// ============================================================================
// Update Information Types
// ============================================================================

/**
 * Asset information for a specific platform
 */
export interface UpdateAsset {
  /** Platform identifier */
  platform: UpdatePlatform;
  /** Package format */
  format: UpdatePackageFormat;
  /** Download URL */
  downloadUrl: string;
  /** File size in bytes */
  size: number;
  /** SHA-256 checksum for verification */
  checksum: string;
  /** Signature for code signing verification */
  signature?: string;
}

/**
 * Release notes section
 */
export interface ReleaseNotesSection {
  /** Section title (e.g., "Features", "Bug Fixes") */
  title: string;
  /** List of items in this section */
  items: string[];
}

/**
 * Complete release notes
 */
export interface ReleaseNotes {
  /** Brief summary of the release */
  summary: string;
  /** Detailed sections */
  sections: ReleaseNotesSection[];
  /** Raw markdown content */
  markdown: string;
  /** Breaking changes warnings */
  breakingChanges?: string[];
  /** Known issues */
  knownIssues?: string[];
}

/**
 * Information about an available update
 */
export interface UpdateInfo {
  /** Version string (semver) */
  version: string;
  /** Release date ISO string */
  releaseDate: string;
  /** Update channel this release belongs to */
  channel: UpdateChannel;
  /** Release notes */
  releaseNotes: ReleaseNotes;
  /** Available assets for different platforms */
  assets: UpdateAsset[];
  /** Whether this is a mandatory/critical update */
  mandatory: boolean;
  /** Minimum version required to apply this update */
  minVersion?: string;
  /** GitHub release URL */
  releaseUrl: string;
  /** Whether the update requires a restart */
  requiresRestart: boolean;
}

/**
 * Simplified update info for UI display
 */
export interface UpdateInfoSummary {
  /** Version string */
  version: string;
  /** Release date */
  releaseDate: string;
  /** Channel */
  channel: UpdateChannel;
  /** Brief summary */
  summary: string;
  /** Whether update is mandatory */
  mandatory: boolean;
  /** Download size for current platform */
  downloadSize: number;
}

// ============================================================================
// Update State Types
// ============================================================================

/**
 * Possible states of the update process
 */
export type UpdateState =
  | 'idle'        // No update activity
  | 'checking'    // Checking for updates
  | 'available'   // Update available, not yet downloading
  | 'downloading' // Currently downloading
  | 'verifying'   // Verifying checksum/signature
  | 'ready'       // Downloaded and verified, ready to install
  | 'installing'  // Currently installing
  | 'error';      // Error occurred

/**
 * Error types that can occur during updates
 */
export type UpdateErrorType =
  | 'network'           // Network connectivity issues
  | 'checksum'          // Checksum verification failed
  | 'signature'         // Signature verification failed
  | 'disk_space'        // Insufficient disk space
  | 'permission'        // Permission denied
  | 'corrupted'         // Downloaded file corrupted
  | 'version_mismatch'  // Version compatibility issue
  | 'rate_limited'      // API rate limited
  | 'server_error'      // Update server error
  | 'unknown';          // Unknown error

/**
 * Error information for update failures
 */
export interface UpdateError {
  /** Error type */
  type: UpdateErrorType;
  /** Human-readable error message */
  message: string;
  /** Technical details */
  details?: string;
  /** Whether the error is recoverable */
  recoverable: boolean;
  /** Suggested action for the user */
  suggestion?: string;
  /** Timestamp when the error occurred */
  timestamp: string;
  /** Retry count */
  retryCount: number;
}

// ============================================================================
// Progress Types
// ============================================================================

/**
 * Download progress information
 */
export interface UpdateProgress {
  /** Bytes downloaded so far */
  bytesDownloaded: number;
  /** Total bytes to download */
  totalBytes: number;
  /** Download percentage (0-100) */
  percent: number;
  /** Current download speed in bytes/second */
  speedBytesPerSecond: number;
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining: number;
  /** Whether download is paused */
  isPaused: boolean;
}

/**
 * Installation progress information
 */
export interface InstallProgress {
  /** Current installation step */
  step: 'preparing' | 'extracting' | 'installing' | 'cleanup' | 'finalizing';
  /** Step description */
  description: string;
  /** Step progress percentage (0-100) */
  percent: number;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Update configuration options
 */
export interface UpdateConfig {
  /** Selected update channel */
  channel: UpdateChannel;
  /** Check interval in milliseconds (default: 1 hour) */
  checkInterval: number;
  /** Automatically download updates when available */
  autoDownload: boolean;
  /** Automatically install updates when downloaded (requires autoDownload) */
  autoInstall: boolean;
  /** Install updates on quit */
  installOnQuit: boolean;
  /** Show notification when update is available */
  showNotification: boolean;
  /** Check for updates on startup */
  checkOnStartup: boolean;
  /** Allow pre-release versions (beta/nightly) */
  allowPrerelease: boolean;
  /** Skip specific versions */
  skippedVersions: string[];
  /** Custom update server URL (for enterprise) */
  customServerUrl?: string;
  /** Proxy settings for update checks */
  proxyUrl?: string;
}

/**
 * Default update configuration
 */
export const DEFAULT_UPDATE_CONFIG: UpdateConfig = {
  channel: 'stable',
  checkInterval: 3600000, // 1 hour
  autoDownload: true,
  autoInstall: false,
  installOnQuit: true,
  showNotification: true,
  checkOnStartup: true,
  allowPrerelease: false,
  skippedVersions: [],
  customServerUrl: undefined,
  proxyUrl: undefined,
};

// ============================================================================
// Event Types
// ============================================================================

/**
 * Update event types
 */
export type UpdateEventType =
  | 'checking'
  | 'update-available'
  | 'update-not-available'
  | 'download-started'
  | 'download-progress'
  | 'download-paused'
  | 'download-resumed'
  | 'download-completed'
  | 'download-cancelled'
  | 'verification-started'
  | 'verification-completed'
  | 'install-started'
  | 'install-progress'
  | 'install-completed'
  | 'error';

/**
 * Base update event
 */
export interface UpdateEventBase {
  /** Event type */
  type: UpdateEventType;
  /** Event timestamp */
  timestamp: string;
}

/**
 * Update available event
 */
export interface UpdateAvailableEvent extends UpdateEventBase {
  type: 'update-available';
  /** Update information */
  info: UpdateInfo;
}

/**
 * Download progress event
 */
export interface DownloadProgressEvent extends UpdateEventBase {
  type: 'download-progress';
  /** Progress information */
  progress: UpdateProgress;
}

/**
 * Install progress event
 */
export interface InstallProgressEvent extends UpdateEventBase {
  type: 'install-progress';
  /** Progress information */
  progress: InstallProgress;
}

/**
 * Error event
 */
export interface UpdateErrorEvent extends UpdateEventBase {
  type: 'error';
  /** Error information */
  error: UpdateError;
}

/**
 * Union of all update events
 */
export type UpdateEvent =
  | UpdateEventBase
  | UpdateAvailableEvent
  | DownloadProgressEvent
  | InstallProgressEvent
  | UpdateErrorEvent;

/**
 * Update event listener callback
 */
export type UpdateEventListener = (event: UpdateEvent) => void;

// ============================================================================
// Manager State Types
// ============================================================================

/**
 * Complete update manager state
 */
export interface UpdateManagerState {
  /** Current update state */
  state: UpdateState;
  /** Current update info (if available) */
  updateInfo: UpdateInfo | null;
  /** Download progress (if downloading) */
  downloadProgress: UpdateProgress | null;
  /** Install progress (if installing) */
  installProgress: InstallProgress | null;
  /** Last error (if any) */
  error: UpdateError | null;
  /** Last check timestamp */
  lastCheckTime: string | null;
  /** Next scheduled check timestamp */
  nextCheckTime: string | null;
  /** Current configuration */
  config: UpdateConfig;
  /** Path to downloaded update file */
  downloadedFilePath: string | null;
  /** Current app version */
  currentVersion: string;
  /** Current platform */
  platform: UpdatePlatform;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * GitHub release asset from API
 */
export interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
  download_count: number;
}

/**
 * GitHub release from API
 */
export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  html_url: string;
  assets: GitHubReleaseAsset[];
}

/**
 * Update check API response
 */
export interface UpdateCheckResponse {
  /** Whether an update is available */
  available: boolean;
  /** Update information (if available) */
  update: UpdateInfoSummary | null;
  /** Current version */
  currentVersion: string;
  /** Last check time */
  checkedAt: string;
}

/**
 * Update status API response
 */
export interface UpdateStatusResponse {
  /** Current state */
  state: UpdateState;
  /** Update info summary */
  update: UpdateInfoSummary | null;
  /** Download progress (if applicable) */
  progress: UpdateProgress | null;
  /** Error (if applicable) */
  error: UpdateError | null;
  /** Last check time */
  lastCheckTime: string | null;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Version comparison result
 */
export type VersionCompareResult = -1 | 0 | 1;

/**
 * Cache entry for update checks
 */
export interface UpdateCheckCache {
  /** Cached response */
  response: UpdateCheckResponse;
  /** Cache timestamp */
  cachedAt: string;
  /** Cache TTL in milliseconds */
  ttlMs: number;
  /** Whether still valid */
  isValid: boolean;
}
