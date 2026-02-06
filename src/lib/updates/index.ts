/**
 * Updates Module
 *
 * Exports all update-related functionality for the VibeCode desktop app.
 *
 * @module lib/updates
 */

// Export the update manager
export { UpdateManager, getUpdateManager } from './update-manager';

// Re-export types for convenience
export type {
  UpdateChannel,
  UpdatePlatform,
  UpdatePackageFormat,
  UpdateInfo,
  UpdateInfoSummary,
  UpdateAsset,
  UpdateState,
  UpdateError,
  UpdateErrorType,
  UpdateProgress,
  InstallProgress,
  UpdateConfig,
  UpdateEvent,
  UpdateEventType,
  UpdateEventListener,
  UpdateManagerState,
  GitHubRelease,
  GitHubReleaseAsset,
  UpdateCheckResponse,
  UpdateStatusResponse,
  UpdateCheckCache,
  ReleaseNotes,
  ReleaseNotesSection,
} from '@/types/auto-update';

// Export default config
export { DEFAULT_UPDATE_CONFIG } from '@/types/auto-update';
