/**
 * Update API Routes
 *
 * Provides REST endpoints for the auto-update system:
 * - GET /api/updates - Get current update status
 * - GET /api/updates?action=check - Check for new versions
 * - GET /api/updates?action=download - Start download
 * - POST /api/updates - Trigger installation
 *
 * @module app/api/updates/route
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  UpdateChannel,
  UpdateCheckResponse,
  UpdateStatusResponse,
  UpdateState,
  UpdateInfoSummary,
  UpdateProgress,
  UpdateError,
  GitHubRelease,
  GitHubReleaseAsset,
  ReleaseNotes,
  ReleaseNotesSection,
} from '@/types/auto-update';

export const dynamic = 'force-dynamic'

// ============================================================================
// Constants
// ============================================================================

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'vibecode';
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || 'vibecode-desktop';
const CURRENT_VERSION = process.env.npm_package_version || '1.0.0';

// Cache for update checks (in-memory, would use Redis in production)
const updateCache = new Map<string, { data: UpdateCheckResponse; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// In-memory state (would use persistent storage in production)
let currentState: UpdateState = 'idle';
let currentUpdateInfo: UpdateInfoSummary | null = null;
let downloadProgress: UpdateProgress | null = null;
let lastError: UpdateError | null = null;
let lastCheckTime: string | null = null;
let downloadedFilePath: string | null = null;

// ============================================================================
// Utility Functions
// ============================================================================

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

        if (
          currentSection.title.toLowerCase().includes('breaking') ||
          item.toLowerCase().includes('breaking change')
        ) {
          breakingChanges.push(item);
        }

        if (currentSection.title.toLowerCase().includes('known issue')) {
          knownIssues.push(item);
        }
      }
    } else if (!currentSection && trimmedLine && !trimmedLine.startsWith('#')) {
      if (!summary) {
        summary = trimmedLine;
      }
    }
  }

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
 * Compare two semver versions
 * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.replace(/^v/, '').split(/[.-]/).map(p => parseInt(p, 10) || 0);
  const parts2 = v2.replace(/^v/, '').split(/[.-]/).map(p => parseInt(p, 10) || 0);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }

  return 0;
}

/**
 * Get cached response if valid
 */
function getCachedResponse(channel: UpdateChannel): UpdateCheckResponse | null {
  const cached = updateCache.get(channel);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  updateCache.delete(channel);
  return null;
}

/**
 * Cache a response
 */
function cacheResponse(channel: UpdateChannel, response: UpdateCheckResponse): void {
  updateCache.set(channel, {
    data: response,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Fetch releases from GitHub
 */
async function fetchGitHubReleases(): Promise<GitHubRelease[]> {
  const url = `${GITHUB_API_BASE}/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases`;

  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': `VibeCode/${CURRENT_VERSION}`,
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  const response = await fetch(url, { headers, next: { revalidate: 300 } });

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
 * Find the best asset for download
 */
function findBestAsset(assets: GitHubReleaseAsset[]): GitHubReleaseAsset | null {
  // Prefer DMG for macOS, then AppImage for Linux
  const preferredFormats = ['.dmg', '.pkg', '.appimage', '.deb', '.exe', '.msi'];

  for (const format of preferredFormats) {
    const asset = assets.find((a) => a.name.toLowerCase().endsWith(format));
    if (asset) {
      return asset;
    }
  }

  return assets[0] || null;
}

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const channel = (searchParams.get('channel') as UpdateChannel) || 'stable';
  const forceCheck = searchParams.get('force') === 'true';

  try {
    // Action: check - Check for updates
    if (action === 'check') {
      // Check cache first
      if (!forceCheck) {
        const cached = getCachedResponse(channel);
        if (cached) {
          return NextResponse.json(cached);
        }
      }

      currentState = 'checking';
      lastError = null;

      const releases = await fetchGitHubReleases();

      // Find the latest non-draft, non-prerelease (unless beta/nightly channel)
      const validReleases = releases.filter((release) => {
        if (release.draft) return false;
        if (channel === 'stable' && release.prerelease) return false;
        if (channel === 'beta' && !release.prerelease && !release.tag_name.includes('stable')) {
          return true;
        }
        return true;
      });

      if (validReleases.length === 0) {
        currentState = 'idle';
        const response: UpdateCheckResponse = {
          available: false,
          update: null,
          currentVersion: CURRENT_VERSION,
          checkedAt: new Date().toISOString(),
        };
        cacheResponse(channel, response);
        lastCheckTime = response.checkedAt;
        return NextResponse.json(response);
      }

      const latestRelease = validReleases[0];
      const latestVersion = latestRelease.tag_name.replace(/^v/, '');

      // Check if newer than current version
      if (compareVersions(latestVersion, CURRENT_VERSION) <= 0) {
        currentState = 'idle';
        const response: UpdateCheckResponse = {
          available: false,
          update: null,
          currentVersion: CURRENT_VERSION,
          checkedAt: new Date().toISOString(),
        };
        cacheResponse(channel, response);
        lastCheckTime = response.checkedAt;
        return NextResponse.json(response);
      }

      // Parse release notes
      const releaseNotes = parseReleaseNotes(latestRelease.body || '');
      const releaseChannel = getChannelFromVersion(latestVersion);
      const bestAsset = findBestAsset(latestRelease.assets);

      currentUpdateInfo = {
        version: latestVersion,
        releaseDate: latestRelease.published_at,
        channel: releaseChannel,
        summary: releaseNotes.summary,
        mandatory: releaseNotes.breakingChanges !== undefined,
        downloadSize: bestAsset?.size || 0,
      };

      currentState = 'available';
      lastCheckTime = new Date().toISOString();

      const response: UpdateCheckResponse = {
        available: true,
        update: currentUpdateInfo,
        currentVersion: CURRENT_VERSION,
        checkedAt: lastCheckTime,
      };

      cacheResponse(channel, response);

      return NextResponse.json(response);
    }

    // Action: download - Start download (returns immediately, download happens async)
    if (action === 'download') {
      if (!currentUpdateInfo) {
        return NextResponse.json(
          { error: 'No update available to download' },
          { status: 400 }
        );
      }

      if (currentState === 'downloading') {
        return NextResponse.json(
          { error: 'Download already in progress' },
          { status: 400 }
        );
      }

      // Start download simulation (in real app, this would be handled by the UpdateManager)
      currentState = 'downloading';
      downloadProgress = {
        bytesDownloaded: 0,
        totalBytes: currentUpdateInfo.downloadSize,
        percent: 0,
        speedBytesPerSecond: 0,
        estimatedTimeRemaining: 0,
        isPaused: false,
      };

      // Simulate download completion after a delay
      // In a real implementation, this would be handled by the UpdateManager
      setTimeout(() => {
        currentState = 'ready';
        downloadProgress = null;
        downloadedFilePath = `/tmp/vibecode-${currentUpdateInfo?.version}.dmg`;
      }, 5000);

      return NextResponse.json({
        status: 'download_started',
        version: currentUpdateInfo.version,
        size: currentUpdateInfo.downloadSize,
      });
    }

    // Action: status - Get current update status (default)
    const statusResponse: UpdateStatusResponse = {
      state: currentState,
      update: currentUpdateInfo,
      progress: downloadProgress,
      error: lastError,
      lastCheckTime,
    };

    return NextResponse.json(statusResponse);
  } catch (error) {
    console.error('[UpdateAPI] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isRateLimit = errorMessage.includes('rate limit');

    currentState = 'error';
    lastError = {
      type: isRateLimit ? 'rate_limited' : 'server_error',
      message: errorMessage,
      recoverable: true,
      suggestion: isRateLimit
        ? 'Please wait a few minutes before checking again'
        : 'Please try again later',
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    return NextResponse.json(
      {
        error: errorMessage,
        type: lastError.type,
        suggestion: lastError.suggestion,
      },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}

// ============================================================================
// POST Handler - Install Update
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({}));
    const { action } = body;

    // Action: install - Trigger installation
    if (action === 'install' || !action) {
      if (currentState !== 'ready') {
        return NextResponse.json(
          { error: 'No update ready to install' },
          { status: 400 }
        );
      }

      if (!downloadedFilePath) {
        return NextResponse.json(
          { error: 'Update file not found' },
          { status: 400 }
        );
      }

      currentState = 'installing';

      // Simulate installation (in real app, this would trigger Tauri updater)
      setTimeout(() => {
        currentState = 'idle';
        currentUpdateInfo = null;
        downloadedFilePath = null;
        // In real implementation: app would restart here
      }, 3000);

      return NextResponse.json({
        status: 'installation_started',
        message: 'The application will restart after installation',
      });
    }

    // Action: skip - Skip this version
    if (action === 'skip') {
      const { version } = body;

      if (!version) {
        return NextResponse.json(
          { error: 'Version is required' },
          { status: 400 }
        );
      }

      // In a real implementation, this would update persistent settings
      currentState = 'idle';
      if (currentUpdateInfo?.version === version) {
        currentUpdateInfo = null;
      }

      return NextResponse.json({
        status: 'version_skipped',
        version,
      });
    }

    // Action: cancel - Cancel download
    if (action === 'cancel') {
      if (currentState === 'downloading') {
        currentState = 'available';
        downloadProgress = null;
      }

      return NextResponse.json({
        status: 'download_cancelled',
      });
    }

    // Action: set_channel - Change update channel
    if (action === 'set_channel') {
      const { channel } = body as { channel: UpdateChannel };

      if (!['stable', 'beta', 'nightly'].includes(channel)) {
        return NextResponse.json(
          { error: 'Invalid channel' },
          { status: 400 }
        );
      }

      // Clear cache when channel changes
      updateCache.clear();
      currentUpdateInfo = null;
      currentState = 'idle';

      return NextResponse.json({
        status: 'channel_updated',
        channel,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[UpdateAPI] POST Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE Handler - Clean up
// ============================================================================

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    // Reset state
    currentState = 'idle';
    currentUpdateInfo = null;
    downloadProgress = null;
    lastError = null;
    downloadedFilePath = null;

    // Clear cache
    updateCache.clear();

    return NextResponse.json({
      status: 'reset_complete',
      message: 'Update state has been reset',
    });
  } catch (error) {
    console.error('[UpdateAPI] DELETE Error:', error);

    return NextResponse.json(
      { error: 'Failed to reset update state' },
      { status: 500 }
    );
  }
}
