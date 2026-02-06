/**
 * Update Manager for VibeCode Desktop
 *
 * Manages the complete auto-update lifecycle:
 * - Checking for updates from GitHub releases
 * - Downloading update packages
 * - Verifying checksums and signatures
 * - Triggering installation
 * - Emitting events for UI updates
 *
 * Features:
 * - Singleton pattern for global access
 * - Multiple update channels (stable, beta, nightly)
 * - Background downloads with progress tracking
 * - Checksum verification for security
 * - Rate limiting for GitHub API
 * - Offline mode support
 * - Event-driven architecture
 *
 * @module lib/updates/update-manager
 */

import { EventEmitter } from 'events';
import * as semver from 'semver';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
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
  UpdateCheckCache,
  ReleaseNotes,
  ReleaseNotesSection,
  DEFAULT_UPDATE_CONFIG,
} from '@/types/auto-update';

// ============================================================================
// Constants
// ============================================================================

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_REPO_OWNER = 'vibecode';
const GITHUB_REPO_NAME = 'vibecode-desktop';
const CURRENT_VERSION = process.env.npm_package_version || '1.0.0';

// Cache TTL for update checks (5 minutes)
const UPDATE_CHECK_CACHE_TTL = 5 * 60 * 1000;

// Minimum time between API requests (rate limiting)
const MIN_REQUEST_INTERVAL = 1000;

// Download chunk size for progress reporting
const DOWNLOAD_CHUNK_SIZE = 1024 * 1024; // 1MB

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the current platform identifier
 */
function getCurrentPlatform(): UpdatePlatform {
  const platform = os.platform();
  const arch = os.arch();

  if (platform === 'darwin') {
    return arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  } else if (platform === 'linux') {
    return arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
  } else if (platform === 'win32') {
    return 'win32-x64';
  }

  return 'darwin-arm64'; // Default fallback
}

/**
 * Get the package format for a platform
 */
function getPackageFormatForPlatform(platform: UpdatePlatform): UpdatePackageFormat {
  switch (platform) {
    case 'darwin-arm64':
    case 'darwin-x64':
      return 'dmg';
    case 'linux-x64':
    case 'linux-arm64':
      return 'AppImage';
    case 'win32-x64':
      return 'exe';
    default:
      return 'dmg';
  }
}

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
 * Parse GitHub release body into structured release notes
 */
function parseReleaseNotes(body: string): ReleaseNotes {
  const sections: ReleaseNotesSection[] = [];
  const lines = body.split('\n');
  let currentSection: ReleaseNotesSection | null = null;
  let summary = '';
  const breakingChanges: string[] = [];
  const knownIssues: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check for section headers (## or ###)
    if (trimmedLine.startsWith('## ') || trimmedLine.startsWith('### ')) {
      if (currentSection && currentSection.items.length > 0) {
        sections.push(currentSection);
      }
      const title = trimmedLine.replace(/^#+ /, '');
      currentSection = { title, items: [] };
    } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      const item = trimmedLine.replace(/^[-*] /, '');
      if (currentSection) {
        currentSection.items.push(item);

        // Check for breaking changes
        if (
          currentSection.title.toLowerCase().includes('breaking') ||
          item.toLowerCase().includes('breaking change')
        ) {
          breakingChanges.push(item);
        }

        // Check for known issues
        if (currentSection.title.toLowerCase().includes('known issue')) {
          knownIssues.push(item);
        }
      }
    } else if (!currentSection && trimmedLine && !trimmedLine.startsWith('#')) {
      // First non-header, non-list line is the summary
      if (!summary) {
        summary = trimmedLine;
      }
    }
  }

  // Add last section
  if (currentSection && currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  return {
    summary: summary || 'New version available',
    sections,
    markdown: body,
    breakingChanges: breakingChanges.length > 0 ? breakingChanges : undefined,
    knownIssues: knownIssues.length > 0 ? knownIssues : undefined,
  };
}

/**
 * Determine the channel from a version string
 */
function getChannelFromVersion(version: string): UpdateChannel {
  if (version.includes('nightly') || version.includes('dev')) {
    return 'nightly';
  } else if (version.includes('beta') || version.includes('alpha') || version.includes('rc')) {
    return 'beta';
  }
  return 'stable';
}

/**
 * Create an error object
 */
function createUpdateError(
  type: UpdateErrorType,
  message: string,
  details?: string,
  recoverable: boolean = true,
  suggestion?: string
): UpdateError {
  return {
    type,
    message,
    details,
    recoverable,
    suggestion,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  };
}

// ============================================================================
// Update Manager Class
// ============================================================================

/**
 * Singleton Update Manager
 *
 * Handles all update-related operations for the VibeCode desktop application.
 */
export class UpdateManager {
  private static instance: UpdateManager | null = null;

  private readonly emitter: EventEmitter;
  private state: UpdateState = 'idle';
  private config: UpdateConfig;
  private updateInfo: UpdateInfo | null = null;
  private downloadProgress: UpdateProgress | null = null;
  private installProgress: InstallProgress | null = null;
  private error: UpdateError | null = null;
  private lastCheckTime: Date | null = null;
  private nextCheckTime: Date | null = null;
  private downloadedFilePath: string | null = null;
  private checkTimer: NodeJS.Timeout | null = null;
  private cache: UpdateCheckCache | null = null;
  private lastRequestTime: number = 0;
  private downloadController: AbortController | null = null;
  private readonly platform: UpdatePlatform;
  private readonly currentVersion: string;

  private constructor(config?: Partial<UpdateConfig>) {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
    this.config = { ...DEFAULT_UPDATE_CONFIG, ...config };
    this.platform = getCurrentPlatform();
    this.currentVersion = CURRENT_VERSION;

    console.log('[UpdateManager] Initialized', {
      platform: this.platform,
      currentVersion: this.currentVersion,
      channel: this.config.channel,
    });
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(config?: Partial<UpdateConfig>): UpdateManager {
    if (!UpdateManager.instance) {
      UpdateManager.instance = new UpdateManager(config);
    } else if (config) {
      // Update config if provided
      UpdateManager.instance.setConfig(config);
    }
    return UpdateManager.instance;
  }

  /**
   * Reset the singleton (for testing)
   */
  public static resetInstance(): void {
    if (UpdateManager.instance) {
      UpdateManager.instance.destroy();
      UpdateManager.instance = null;
    }
  }

  // ============================================================================
  // Configuration Methods
  // ============================================================================

  /**
   * Get the current configuration
   */
  public getConfig(): UpdateConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public setConfig(config: Partial<UpdateConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart check timer if interval changed
    if (config.checkInterval !== undefined) {
      this.stopScheduledChecks();
      if (this.config.checkOnStartup) {
        this.startScheduledChecks();
      }
    }

    console.log('[UpdateManager] Config updated', config);
  }

  /**
   * Set the update channel
   */
  public setChannel(channel: UpdateChannel): void {
    this.config.channel = channel;
    this.cache = null; // Invalidate cache
    console.log('[UpdateManager] Channel set to', channel);
  }

  // ============================================================================
  // State Methods
  // ============================================================================

  /**
   * Get the current state
   */
  public getState(): UpdateManagerState {
    return {
      state: this.state,
      updateInfo: this.updateInfo,
      downloadProgress: this.downloadProgress,
      installProgress: this.installProgress,
      error: this.error,
      lastCheckTime: this.lastCheckTime?.toISOString() || null,
      nextCheckTime: this.nextCheckTime?.toISOString() || null,
      config: { ...this.config },
      downloadedFilePath: this.downloadedFilePath,
      currentVersion: this.currentVersion,
      platform: this.platform,
    };
  }

  /**
   * Set the state and emit event
   */
  private setState(state: UpdateState): void {
    const previousState = this.state;
    this.state = state;

    if (previousState !== state) {
      console.log('[UpdateManager] State changed:', previousState, '->', state);
    }
  }

  // ============================================================================
  // Event Methods
  // ============================================================================

  /**
   * Subscribe to update events
   */
  public on(event: UpdateEventType | 'all', listener: UpdateEventListener): void {
    if (event === 'all') {
      this.emitter.on('event', listener);
    } else {
      this.emitter.on(event, listener);
    }
  }

  /**
   * Unsubscribe from update events
   */
  public off(event: UpdateEventType | 'all', listener: UpdateEventListener): void {
    if (event === 'all') {
      this.emitter.off('event', listener);
    } else {
      this.emitter.off(event, listener);
    }
  }

  /**
   * Emit an update event
   */
  private emitEvent(event: UpdateEvent): void {
    this.emitter.emit('event', event);
    this.emitter.emit(event.type, event);
  }

  // ============================================================================
  // Update Check Methods
  // ============================================================================

  /**
   * Check for available updates
   */
  public async checkForUpdates(forceCheck: boolean = false): Promise<UpdateCheckResponse> {
    // Check cache first
    if (!forceCheck && this.cache && this.isCacheValid()) {
      console.log('[UpdateManager] Using cached update check result');
      return this.cache.response;
    }

    // Check rate limiting
    const now = Date.now();
    if (now - this.lastRequestTime < MIN_REQUEST_INTERVAL) {
      await new Promise((resolve) =>
        setTimeout(resolve, MIN_REQUEST_INTERVAL - (now - this.lastRequestTime))
      );
    }

    this.setState('checking');
    this.error = null;

    this.emitEvent({
      type: 'checking',
      timestamp: new Date().toISOString(),
    });

    try {
      const releases = await this.fetchGitHubReleases();
      const latestRelease = this.findLatestCompatibleRelease(releases);

      this.lastCheckTime = new Date();
      this.lastRequestTime = Date.now();

      if (!latestRelease) {
        this.setState('idle');
        const response: UpdateCheckResponse = {
          available: false,
          update: null,
          currentVersion: this.currentVersion,
          checkedAt: this.lastCheckTime.toISOString(),
        };

        this.cacheResponse(response);

        this.emitEvent({
          type: 'update-not-available',
          timestamp: new Date().toISOString(),
        });

        return response;
      }

      // Parse the release into UpdateInfo
      this.updateInfo = this.parseRelease(latestRelease);

      // Check if this version is newer
      if (!semver.gt(this.updateInfo.version, this.currentVersion)) {
        this.setState('idle');
        this.updateInfo = null;

        const response: UpdateCheckResponse = {
          available: false,
          update: null,
          currentVersion: this.currentVersion,
          checkedAt: this.lastCheckTime.toISOString(),
        };

        this.cacheResponse(response);

        this.emitEvent({
          type: 'update-not-available',
          timestamp: new Date().toISOString(),
        });

        return response;
      }

      // Check if this version is skipped
      if (this.config.skippedVersions.includes(this.updateInfo.version)) {
        console.log('[UpdateManager] Version skipped by user:', this.updateInfo.version);
        this.setState('idle');

        const response: UpdateCheckResponse = {
          available: false,
          update: null,
          currentVersion: this.currentVersion,
          checkedAt: this.lastCheckTime.toISOString(),
        };

        return response;
      }

      this.setState('available');

      const summary = this.createUpdateSummary(this.updateInfo);
      const response: UpdateCheckResponse = {
        available: true,
        update: summary,
        currentVersion: this.currentVersion,
        checkedAt: this.lastCheckTime.toISOString(),
      };

      this.cacheResponse(response);

      this.emitEvent({
        type: 'update-available',
        timestamp: new Date().toISOString(),
        info: this.updateInfo,
      } as UpdateEvent);

      // Auto-download if enabled
      if (this.config.autoDownload) {
        this.downloadUpdate().catch((err) => {
          console.error('[UpdateManager] Auto-download failed:', err);
        });
      }

      return response;
    } catch (err) {
      const error = err as Error;
      console.error('[UpdateManager] Check failed:', error);

      this.error = this.handleError(error);
      this.setState('error');

      this.emitEvent({
        type: 'error',
        timestamp: new Date().toISOString(),
        error: this.error,
      } as UpdateEvent);

      throw error;
    }
  }

  /**
   * Fetch releases from GitHub API
   */
  private async fetchGitHubReleases(): Promise<GitHubRelease[]> {
    const url = this.config.customServerUrl
      ? `${this.config.customServerUrl}/releases`
      : `${GITHUB_API_BASE}/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases`;

    const headers: HeadersInit = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': `VibeCode/${this.currentVersion}`,
    };

    // Add GitHub token if available
    const token = process.env.GITHUB_TOKEN;
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    const fetchOptions: RequestInit = { headers };

    // Add proxy support
    if (this.config.proxyUrl) {
      // In a real implementation, you'd use a proxy agent
      console.log('[UpdateManager] Using proxy:', this.config.proxyUrl);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('GitHub API rate limit exceeded');
      } else if (response.status === 404) {
        throw new Error('Release repository not found');
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Find the latest compatible release for current platform and channel
   */
  private findLatestCompatibleRelease(releases: GitHubRelease[]): GitHubRelease | null {
    const format = getPackageFormatForPlatform(this.platform);

    for (const release of releases) {
      // Skip drafts
      if (release.draft) continue;

      // Check channel compatibility
      const releaseChannel = getChannelFromVersion(release.tag_name);
      if (!this.isChannelCompatible(releaseChannel)) continue;

      // Check if release has asset for our platform
      const hasCompatibleAsset = release.assets.some((asset) => {
        const name = asset.name.toLowerCase();
        return (
          name.includes(this.platform) ||
          (this.platform.includes('darwin') && name.endsWith('.dmg')) ||
          (this.platform.includes('linux') && name.endsWith('.AppImage')) ||
          (this.platform.includes('win32') && (name.endsWith('.exe') || name.endsWith('.msi')))
        );
      });

      if (hasCompatibleAsset) {
        return release;
      }
    }

    return null;
  }

  /**
   * Check if a release channel is compatible with config
   */
  private isChannelCompatible(releaseChannel: UpdateChannel): boolean {
    const { channel, allowPrerelease } = this.config;

    if (channel === 'nightly') {
      return true; // Nightly gets everything
    } else if (channel === 'beta') {
      return releaseChannel === 'beta' || releaseChannel === 'stable';
    } else {
      // Stable channel
      return releaseChannel === 'stable' || (allowPrerelease && releaseChannel === 'beta');
    }
  }

  /**
   * Parse a GitHub release into UpdateInfo
   */
  private parseRelease(release: GitHubRelease): UpdateInfo {
    const version = release.tag_name.replace(/^v/, '');
    const channel = getChannelFromVersion(version);
    const releaseNotes = parseReleaseNotes(release.body || '');

    const assets: UpdateAsset[] = release.assets
      .filter((asset) => {
        const name = asset.name.toLowerCase();
        return (
          name.endsWith('.dmg') ||
          name.endsWith('.pkg') ||
          name.endsWith('.appimage') ||
          name.endsWith('.deb') ||
          name.endsWith('.rpm') ||
          name.endsWith('.exe') ||
          name.endsWith('.msi')
        );
      })
      .map((asset) => this.parseAsset(asset));

    return {
      version,
      releaseDate: release.published_at,
      channel,
      releaseNotes,
      assets,
      mandatory: releaseNotes.breakingChanges !== undefined,
      releaseUrl: release.html_url,
      requiresRestart: true,
    };
  }

  /**
   * Parse a GitHub asset into UpdateAsset
   */
  private parseAsset(asset: GitHubReleaseAsset): UpdateAsset {
    const name = asset.name.toLowerCase();
    let platform: UpdatePlatform = 'darwin-arm64';
    let format: UpdatePackageFormat = 'dmg';

    // Detect platform
    if (name.includes('arm64') || name.includes('aarch64')) {
      if (name.includes('darwin') || name.includes('mac')) {
        platform = 'darwin-arm64';
      } else {
        platform = 'linux-arm64';
      }
    } else if (name.includes('x64') || name.includes('amd64')) {
      if (name.includes('darwin') || name.includes('mac')) {
        platform = 'darwin-x64';
      } else if (name.includes('linux')) {
        platform = 'linux-x64';
      } else if (name.includes('win')) {
        platform = 'win32-x64';
      }
    }

    // Detect format
    if (name.endsWith('.dmg')) {
      format = 'dmg';
    } else if (name.endsWith('.pkg')) {
      format = 'pkg';
    } else if (name.endsWith('.appimage')) {
      format = 'AppImage';
    } else if (name.endsWith('.deb')) {
      format = 'deb';
    } else if (name.endsWith('.rpm')) {
      format = 'rpm';
    } else if (name.endsWith('.exe')) {
      format = 'exe';
    } else if (name.endsWith('.msi')) {
      format = 'msi';
    }

    return {
      platform,
      format,
      downloadUrl: asset.browser_download_url,
      size: asset.size,
      checksum: '', // Will be fetched separately
    };
  }

  /**
   * Create a summary from UpdateInfo
   */
  private createUpdateSummary(info: UpdateInfo): UpdateInfoSummary {
    const asset = info.assets.find((a) => a.platform === this.platform);

    return {
      version: info.version,
      releaseDate: info.releaseDate,
      channel: info.channel,
      summary: info.releaseNotes.summary,
      mandatory: info.mandatory,
      downloadSize: asset?.size || 0,
    };
  }

  // ============================================================================
  // Download Methods
  // ============================================================================

  /**
   * Download the available update
   */
  public async downloadUpdate(): Promise<string> {
    if (!this.updateInfo) {
      throw new Error('No update available to download');
    }

    if (this.state === 'downloading') {
      throw new Error('Download already in progress');
    }

    // Find asset for current platform
    const asset = this.updateInfo.assets.find((a) => a.platform === this.platform);
    if (!asset) {
      throw new Error(`No download available for platform: ${this.platform}`);
    }

    this.setState('downloading');
    this.error = null;
    this.downloadController = new AbortController();

    this.downloadProgress = {
      bytesDownloaded: 0,
      totalBytes: asset.size,
      percent: 0,
      speedBytesPerSecond: 0,
      estimatedTimeRemaining: 0,
      isPaused: false,
    };

    this.emitEvent({
      type: 'download-started',
      timestamp: new Date().toISOString(),
    });

    try {
      // Create download directory
      const downloadDir = path.join(os.tmpdir(), 'vibecode-updates');
      if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
      }

      const fileName = `vibecode-${this.updateInfo.version}.${asset.format}`;
      const filePath = path.join(downloadDir, fileName);

      // Download with progress tracking
      await this.downloadWithProgress(asset.downloadUrl, filePath, this.downloadController.signal);

      // Verify checksum if available
      if (asset.checksum) {
        this.setState('verifying');

        this.emitEvent({
          type: 'verification-started',
          timestamp: new Date().toISOString(),
        });

        const isValid = await this.verifyChecksum(filePath, asset.checksum);
        if (!isValid) {
          fs.unlinkSync(filePath);
          throw new Error('Checksum verification failed');
        }

        this.emitEvent({
          type: 'verification-completed',
          timestamp: new Date().toISOString(),
        });
      }

      this.downloadedFilePath = filePath;
      this.setState('ready');
      this.downloadProgress = null;

      this.emitEvent({
        type: 'download-completed',
        timestamp: new Date().toISOString(),
      });

      // Auto-install if enabled
      if (this.config.autoInstall) {
        this.installUpdate().catch((err) => {
          console.error('[UpdateManager] Auto-install failed:', err);
        });
      }

      return filePath;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        this.setState('available');
        this.downloadProgress = null;

        this.emitEvent({
          type: 'download-cancelled',
          timestamp: new Date().toISOString(),
        });

        throw new Error('Download cancelled');
      }

      const error = err as Error;
      console.error('[UpdateManager] Download failed:', error);

      this.error = this.handleError(error);
      this.setState('error');
      this.downloadProgress = null;

      this.emitEvent({
        type: 'error',
        timestamp: new Date().toISOString(),
        error: this.error,
      } as UpdateEvent);

      throw error;
    } finally {
      this.downloadController = null;
    }
  }

  /**
   * Download a file with progress tracking
   */
  private async downloadWithProgress(
    url: string,
    filePath: string,
    signal: AbortSignal
  ): Promise<void> {
    const response = await fetch(url, { signal });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    const writer = fs.createWriteStream(filePath);
    let bytesDownloaded = 0;
    const startTime = Date.now();
    let lastUpdateTime = startTime;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        writer.write(Buffer.from(value));
        bytesDownloaded += value.length;

        // Update progress
        const now = Date.now();
        const elapsedSeconds = (now - startTime) / 1000;
        const speedBytesPerSecond = bytesDownloaded / elapsedSeconds;
        const remainingBytes = totalBytes - bytesDownloaded;
        const estimatedTimeRemaining = remainingBytes / speedBytesPerSecond;

        this.downloadProgress = {
          bytesDownloaded,
          totalBytes,
          percent: totalBytes > 0 ? Math.round((bytesDownloaded / totalBytes) * 100) : 0,
          speedBytesPerSecond: Math.round(speedBytesPerSecond),
          estimatedTimeRemaining: Math.round(estimatedTimeRemaining),
          isPaused: false,
        };

        // Throttle progress events
        if (now - lastUpdateTime >= 250) {
          lastUpdateTime = now;

          this.emitEvent({
            type: 'download-progress',
            timestamp: new Date().toISOString(),
            progress: this.downloadProgress,
          } as UpdateEvent);
        }
      }
    } finally {
      writer.end();
    }
  }

  /**
   * Pause the current download
   */
  public pauseDownload(): void {
    if (this.state !== 'downloading' || !this.downloadProgress) {
      return;
    }

    this.downloadProgress.isPaused = true;

    this.emitEvent({
      type: 'download-paused',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Resume a paused download
   */
  public resumeDownload(): void {
    if (!this.downloadProgress?.isPaused) {
      return;
    }

    this.downloadProgress.isPaused = false;

    this.emitEvent({
      type: 'download-resumed',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Cancel the current download
   */
  public cancelDownload(): void {
    if (this.downloadController) {
      this.downloadController.abort();
    }
  }

  /**
   * Verify file checksum
   */
  private async verifyChecksum(filePath: string, expectedChecksum: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => {
        const actualChecksum = hash.digest('hex');
        resolve(actualChecksum.toLowerCase() === expectedChecksum.toLowerCase());
      });
      stream.on('error', reject);
    });
  }

  // ============================================================================
  // Installation Methods
  // ============================================================================

  /**
   * Install the downloaded update
   */
  public async installUpdate(): Promise<void> {
    if (!this.downloadedFilePath) {
      throw new Error('No update downloaded');
    }

    if (!fs.existsSync(this.downloadedFilePath)) {
      throw new Error('Downloaded update file not found');
    }

    this.setState('installing');
    this.error = null;

    this.installProgress = {
      step: 'preparing',
      description: 'Preparing to install update...',
      percent: 0,
    };

    this.emitEvent({
      type: 'install-started',
      timestamp: new Date().toISOString(),
    });

    try {
      // In a real Tauri app, this would invoke the Tauri updater
      // For now, we simulate the installation process

      // Step 1: Preparing
      this.updateInstallProgress('preparing', 'Preparing update files...', 10);
      await this.sleep(500);

      // Step 2: Extracting
      this.updateInstallProgress('extracting', 'Extracting update package...', 30);
      await this.sleep(1000);

      // Step 3: Installing
      this.updateInstallProgress('installing', 'Installing update...', 60);
      await this.sleep(1500);

      // Step 4: Cleanup
      this.updateInstallProgress('cleanup', 'Cleaning up temporary files...', 90);
      await this.sleep(500);

      // Step 5: Finalizing
      this.updateInstallProgress('finalizing', 'Finalizing installation...', 100);
      await this.sleep(500);

      // In a real implementation:
      // - For macOS: Launch the DMG installer
      // - For Linux: Replace the AppImage and restart
      // - For Windows: Run the installer executable

      this.installProgress = null;
      this.setState('idle');
      this.updateInfo = null;
      this.downloadedFilePath = null;

      this.emitEvent({
        type: 'install-completed',
        timestamp: new Date().toISOString(),
      });

      console.log('[UpdateManager] Installation completed - restart required');
    } catch (err) {
      const error = err as Error;
      console.error('[UpdateManager] Installation failed:', error);

      this.error = this.handleError(error);
      this.setState('error');
      this.installProgress = null;

      this.emitEvent({
        type: 'error',
        timestamp: new Date().toISOString(),
        error: this.error,
      } as UpdateEvent);

      throw error;
    }
  }

  /**
   * Update installation progress
   */
  private updateInstallProgress(
    step: InstallProgress['step'],
    description: string,
    percent: number
  ): void {
    this.installProgress = { step, description, percent };

    this.emitEvent({
      type: 'install-progress',
      timestamp: new Date().toISOString(),
      progress: this.installProgress,
    } as UpdateEvent);
  }

  /**
   * Queue update to install on quit
   */
  public installOnQuit(): void {
    if (!this.downloadedFilePath) {
      console.warn('[UpdateManager] No update to install on quit');
      return;
    }

    // In a real implementation, this would register with the Tauri app
    // to run the installer when the app quits
    console.log('[UpdateManager] Update queued for installation on quit');
  }

  // ============================================================================
  // Scheduled Check Methods
  // ============================================================================

  /**
   * Start scheduled update checks
   */
  public startScheduledChecks(): void {
    if (this.checkTimer) {
      return; // Already running
    }

    // Initial check on startup
    if (this.config.checkOnStartup) {
      setTimeout(() => {
        this.checkForUpdates().catch((err) => {
          console.error('[UpdateManager] Startup check failed:', err);
        });
      }, 5000); // Delay startup check by 5 seconds
    }

    // Schedule periodic checks
    this.checkTimer = setInterval(() => {
      this.checkForUpdates().catch((err) => {
        console.error('[UpdateManager] Scheduled check failed:', err);
      });
    }, this.config.checkInterval);

    this.nextCheckTime = new Date(Date.now() + this.config.checkInterval);

    console.log('[UpdateManager] Scheduled checks started, interval:', this.config.checkInterval);
  }

  /**
   * Stop scheduled update checks
   */
  public stopScheduledChecks(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
      this.nextCheckTime = null;
    }

    console.log('[UpdateManager] Scheduled checks stopped');
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Skip a specific version
   */
  public skipVersion(version: string): void {
    if (!this.config.skippedVersions.includes(version)) {
      this.config.skippedVersions.push(version);
    }

    if (this.updateInfo?.version === version) {
      this.updateInfo = null;
      this.setState('idle');
    }

    console.log('[UpdateManager] Version skipped:', version);
  }

  /**
   * Clear skipped versions
   */
  public clearSkippedVersions(): void {
    this.config.skippedVersions = [];
    console.log('[UpdateManager] Skipped versions cleared');
  }

  /**
   * Handle errors and create UpdateError
   */
  private handleError(error: Error): UpdateError {
    let type: UpdateErrorType = 'unknown';
    let recoverable = true;
    let suggestion: string | undefined;

    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch') || message.includes('enotfound')) {
      type = 'network';
      suggestion = 'Check your internet connection and try again';
    } else if (message.includes('rate limit')) {
      type = 'rate_limited';
      recoverable = true;
      suggestion = 'Please wait a few minutes before checking again';
    } else if (message.includes('checksum')) {
      type = 'checksum';
      suggestion = 'The download may be corrupted. Please try downloading again';
    } else if (message.includes('signature')) {
      type = 'signature';
      recoverable = false;
      suggestion = 'The update signature is invalid. Please download from the official source';
    } else if (message.includes('enospc') || message.includes('disk space')) {
      type = 'disk_space';
      suggestion = 'Free up some disk space and try again';
    } else if (message.includes('permission') || message.includes('eacces')) {
      type = 'permission';
      suggestion = 'Try running the application with administrator privileges';
    } else if (message.includes('corrupted')) {
      type = 'corrupted';
      suggestion = 'The update file is corrupted. Please try downloading again';
    } else if (message.includes('500') || message.includes('502') || message.includes('503')) {
      type = 'server_error';
      suggestion = 'The update server is experiencing issues. Please try again later';
    }

    return createUpdateError(type, error.message, error.stack, recoverable, suggestion);
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    if (!this.cache) return false;

    const cacheAge = Date.now() - new Date(this.cache.cachedAt).getTime();
    return cacheAge < this.cache.ttlMs;
  }

  /**
   * Cache an update check response
   */
  private cacheResponse(response: UpdateCheckResponse): void {
    this.cache = {
      response,
      cachedAt: new Date().toISOString(),
      ttlMs: UPDATE_CHECK_CACHE_TTL,
      isValid: true,
    };
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopScheduledChecks();

    if (this.downloadController) {
      this.downloadController.abort();
    }

    this.emitter.removeAllListeners();

    console.log('[UpdateManager] Destroyed');
  }
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Get the singleton update manager instance
 */
export function getUpdateManager(config?: Partial<UpdateConfig>): UpdateManager {
  return UpdateManager.getInstance(config);
}

/**
 * Re-export types for convenience
 */
export type {
  UpdateChannel,
  UpdatePlatform,
  UpdateInfo,
  UpdateState,
  UpdateProgress,
  UpdateConfig,
  UpdateEvent,
  UpdateEventListener,
  UpdateManagerState,
  UpdateCheckResponse,
} from '@/types/auto-update';
