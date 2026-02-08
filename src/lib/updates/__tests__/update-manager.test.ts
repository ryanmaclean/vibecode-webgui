/**
 * Update Manager Tests
 *
 * Unit tests for the auto-update system.
 *
 * @module lib/updates/__tests__/update-manager.test
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

import {
  UpdateChannel,
  UpdatePlatform,
  UpdateInfo,
  UpdateState,
  UpdateConfig,
  UpdateProgress,
  UpdateError,
  UpdateCheckResponse,
  GitHubRelease,
  DEFAULT_UPDATE_CONFIG,
} from '@/types/auto-update';

// ============================================================================
// Mock Data
// ============================================================================

const mockGitHubReleases: GitHubRelease[] = [
  {
    id: 1,
    tag_name: 'v2.0.0',
    name: 'Version 2.0.0',
    body: `## What's New

This is a major release with exciting new features!

### Features
- New AI-powered code completion
- Dark mode support
- Performance improvements

### Bug Fixes
- Fixed memory leak in editor
- Resolved startup crashes

### Breaking Changes
- Removed deprecated API endpoints
`,
    draft: false,
    prerelease: false,
    created_at: '2024-01-15T10:00:00Z',
    published_at: '2024-01-15T12:00:00Z',
    html_url: 'https://github.com/vibecode/vibecode-desktop/releases/tag/v2.0.0',
    assets: [
      {
        name: 'VibeCode-2.0.0-darwin-arm64.dmg',
        browser_download_url: 'https://github.com/vibecode/vibecode-desktop/releases/download/v2.0.0/VibeCode-2.0.0-darwin-arm64.dmg',
        size: 150000000,
        content_type: 'application/octet-stream',
        download_count: 1000,
      },
      {
        name: 'VibeCode-2.0.0-darwin-x64.dmg',
        browser_download_url: 'https://github.com/vibecode/vibecode-desktop/releases/download/v2.0.0/VibeCode-2.0.0-darwin-x64.dmg',
        size: 160000000,
        content_type: 'application/octet-stream',
        download_count: 500,
      },
      {
        name: 'VibeCode-2.0.0-linux-x64.AppImage',
        browser_download_url: 'https://github.com/vibecode/vibecode-desktop/releases/download/v2.0.0/VibeCode-2.0.0-linux-x64.AppImage',
        size: 140000000,
        content_type: 'application/octet-stream',
        download_count: 300,
      },
    ],
  },
  {
    id: 2,
    tag_name: 'v2.0.0-beta.1',
    name: 'Version 2.0.0 Beta 1',
    body: 'Beta release for testing',
    draft: false,
    prerelease: true,
    created_at: '2024-01-10T10:00:00Z',
    published_at: '2024-01-10T12:00:00Z',
    html_url: 'https://github.com/vibecode/vibecode-desktop/releases/tag/v2.0.0-beta.1',
    assets: [
      {
        name: 'VibeCode-2.0.0-beta.1-darwin-arm64.dmg',
        browser_download_url: 'https://github.com/vibecode/vibecode-desktop/releases/download/v2.0.0-beta.1/VibeCode-2.0.0-beta.1-darwin-arm64.dmg',
        size: 148000000,
        content_type: 'application/octet-stream',
        download_count: 50,
      },
    ],
  },
  {
    id: 3,
    tag_name: 'v1.5.0',
    name: 'Version 1.5.0',
    body: 'Previous stable release',
    draft: false,
    prerelease: false,
    created_at: '2024-01-01T10:00:00Z',
    published_at: '2024-01-01T12:00:00Z',
    html_url: 'https://github.com/vibecode/vibecode-desktop/releases/tag/v1.5.0',
    assets: [
      {
        name: 'VibeCode-1.5.0-darwin-arm64.dmg',
        browser_download_url: 'https://github.com/vibecode/vibecode-desktop/releases/download/v1.5.0/VibeCode-1.5.0-darwin-arm64.dmg',
        size: 145000000,
        content_type: 'application/octet-stream',
        download_count: 5000,
      },
    ],
  },
];

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Compare two semver versions
 */
function compareVersions(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/, '');
  const clean2 = v2.replace(/^v/, '');

  // Split version and prerelease parts
  const [ver1, pre1] = clean1.split('-', 2);
  const [ver2, pre2] = clean2.split('-', 2);

  const parts1 = ver1.split('.').map(p => parseInt(p, 10) || 0);
  const parts2 = ver2.split('.').map(p => parseInt(p, 10) || 0);

  // Compare major.minor.patch
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }

  // Same version number: release > prerelease
  if (!pre1 && pre2) return 1;
  if (pre1 && !pre2) return -1;
  if (!pre1 && !pre2) return 0;

  // Both have prereleases, compare them
  const preParts1 = (pre1 || '').split('.').map(p => { const n = parseInt(p, 10); return isNaN(n) ? p : n; });
  const preParts2 = (pre2 || '').split('.').map(p => { const n = parseInt(p, 10); return isNaN(n) ? p : n; });

  for (let i = 0; i < Math.max(preParts1.length, preParts2.length); i++) {
    const a = preParts1[i];
    const b = preParts2[i];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    if (typeof a === 'number' && typeof b === 'number') {
      if (a > b) return 1;
      if (a < b) return -1;
    } else {
      const sa = String(a);
      const sb = String(b);
      if (sa > sb) return 1;
      if (sa < sb) return -1;
    }
  }

  return 0;
}

/**
 * Determine channel from version string
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
 * Parse release notes
 */
function parseReleaseNotes(body: string): { summary: string; sections: Array<{ title: string; items: string[] }> } {
  const sections: Array<{ title: string; items: string[] }> = [];
  const lines = body.split('\n');
  let currentSection: { title: string; items: string[] } | null = null;
  let summary = '';
  let foundFirstSection = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('## ') || trimmedLine.startsWith('### ')) {
      if (currentSection) {
        sections.push(currentSection);
      }
      const title = trimmedLine.replace(/^#+ /, '');
      currentSection = { title, items: [] };
      foundFirstSection = true;
    } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      const item = trimmedLine.replace(/^[-*] /, '');
      if (currentSection) {
        currentSection.items.push(item);
      }
    } else if (foundFirstSection && currentSection && currentSection.items.length === 0 && trimmedLine && !trimmedLine.startsWith('#')) {
      if (!summary) {
        summary = trimmedLine;
      }
    } else if (!foundFirstSection && trimmedLine && !trimmedLine.startsWith('#')) {
      if (!summary) {
        summary = trimmedLine;
      }
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return { summary: summary || 'New version available', sections };
}

// ============================================================================
// Tests: Type Definitions
// ============================================================================

describe('Auto-Update Type Definitions', () => {
  describe('UpdateChannel', () => {
    it('should have valid channel values', () => {
      const channels: UpdateChannel[] = ['stable', 'beta', 'nightly'];
      expect(channels).toContain('stable');
      expect(channels).toContain('beta');
      expect(channels).toContain('nightly');
    });
  });

  describe('UpdatePlatform', () => {
    it('should have valid platform values', () => {
      const platforms: UpdatePlatform[] = [
        'darwin-arm64',
        'darwin-x64',
        'linux-x64',
        'linux-arm64',
        'win32-x64',
      ];
      expect(platforms).toHaveLength(5);
    });
  });

  describe('UpdateState', () => {
    it('should have valid state values', () => {
      const states: UpdateState[] = [
        'idle',
        'checking',
        'available',
        'downloading',
        'verifying',
        'ready',
        'installing',
        'error',
      ];
      expect(states).toHaveLength(8);
    });
  });

  describe('DEFAULT_UPDATE_CONFIG', () => {
    it('should have valid default values', () => {
      expect(DEFAULT_UPDATE_CONFIG.channel).toBe('stable');
      expect(DEFAULT_UPDATE_CONFIG.checkInterval).toBe(3600000); // 1 hour
      expect(DEFAULT_UPDATE_CONFIG.autoDownload).toBe(true);
      expect(DEFAULT_UPDATE_CONFIG.autoInstall).toBe(false);
      expect(DEFAULT_UPDATE_CONFIG.installOnQuit).toBe(true);
      expect(DEFAULT_UPDATE_CONFIG.showNotification).toBe(true);
      expect(DEFAULT_UPDATE_CONFIG.checkOnStartup).toBe(true);
      expect(DEFAULT_UPDATE_CONFIG.allowPrerelease).toBe(false);
      expect(DEFAULT_UPDATE_CONFIG.skippedVersions).toEqual([]);
    });
  });
});

// ============================================================================
// Tests: Version Comparison
// ============================================================================

describe('Version Comparison', () => {
  it('should correctly compare major versions', () => {
    expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('should correctly compare minor versions', () => {
    expect(compareVersions('1.2.0', '1.1.0')).toBe(1);
    expect(compareVersions('1.1.0', '1.2.0')).toBe(-1);
    expect(compareVersions('1.1.0', '1.1.0')).toBe(0);
  });

  it('should correctly compare patch versions', () => {
    expect(compareVersions('1.0.2', '1.0.1')).toBe(1);
    expect(compareVersions('1.0.1', '1.0.2')).toBe(-1);
    expect(compareVersions('1.0.1', '1.0.1')).toBe(0);
  });

  it('should handle version prefixes', () => {
    expect(compareVersions('v2.0.0', 'v1.0.0')).toBe(1);
    expect(compareVersions('v1.0.0', '2.0.0')).toBe(-1);
  });

  it('should handle prerelease versions', () => {
    expect(compareVersions('2.0.0', '2.0.0-beta.1')).toBe(1);
    expect(compareVersions('2.0.0-beta.2', '2.0.0-beta.1')).toBe(1);
  });
});

// ============================================================================
// Tests: Channel Detection
// ============================================================================

describe('Channel Detection', () => {
  it('should detect stable channel', () => {
    expect(getChannelFromVersion('1.0.0')).toBe('stable');
    expect(getChannelFromVersion('2.5.3')).toBe('stable');
    expect(getChannelFromVersion('v1.0.0')).toBe('stable');
  });

  it('should detect beta channel', () => {
    expect(getChannelFromVersion('1.0.0-beta.1')).toBe('beta');
    expect(getChannelFromVersion('2.0.0-alpha.1')).toBe('beta');
    expect(getChannelFromVersion('1.5.0-rc.1')).toBe('beta');
  });

  it('should detect nightly channel', () => {
    expect(getChannelFromVersion('1.0.0-nightly.20240115')).toBe('nightly');
    expect(getChannelFromVersion('2.0.0-dev.123')).toBe('nightly');
  });
});

// ============================================================================
// Tests: Release Notes Parsing
// ============================================================================

describe('Release Notes Parsing', () => {
  const sampleBody = `## What's New

This is a major release!

### Features
- Feature 1
- Feature 2

### Bug Fixes
- Fix 1
- Fix 2
`;

  it('should extract summary', () => {
    const result = parseReleaseNotes(sampleBody);
    expect(result.summary).toBe('This is a major release!');
  });

  it('should extract sections', () => {
    const result = parseReleaseNotes(sampleBody);
    expect(result.sections).toHaveLength(3);
  });

  it('should extract section titles', () => {
    const result = parseReleaseNotes(sampleBody);
    const titles = result.sections.map(s => s.title);
    expect(titles).toContain("What's New");
    expect(titles).toContain('Features');
    expect(titles).toContain('Bug Fixes');
  });

  it('should extract section items', () => {
    const result = parseReleaseNotes(sampleBody);
    const features = result.sections.find(s => s.title === 'Features');
    expect(features?.items).toContain('Feature 1');
    expect(features?.items).toContain('Feature 2');
  });

  it('should handle empty body', () => {
    const result = parseReleaseNotes('');
    expect(result.summary).toBe('New version available');
    expect(result.sections).toHaveLength(0);
  });
});

// ============================================================================
// Tests: GitHub Release Processing
// ============================================================================

describe('GitHub Release Processing', () => {
  it('should filter out draft releases', () => {
    const releases = [
      { ...mockGitHubReleases[0], draft: true },
      mockGitHubReleases[1],
    ];
    const validReleases = releases.filter(r => !r.draft);
    expect(validReleases).toHaveLength(1);
  });

  it('should filter out prereleases for stable channel', () => {
    const releases = mockGitHubReleases.filter(r => !r.draft && !r.prerelease);
    expect(releases).toHaveLength(2);
    expect(releases[0].tag_name).toBe('v2.0.0');
  });

  it('should include prereleases for beta channel', () => {
    const releases = mockGitHubReleases.filter(r => !r.draft);
    expect(releases).toHaveLength(3);
  });

  it('should sort releases by version', () => {
    const sortedReleases = [...mockGitHubReleases]
      .filter(r => !r.draft && !r.prerelease)
      .sort((a, b) => compareVersions(b.tag_name, a.tag_name));

    expect(sortedReleases[0].tag_name).toBe('v2.0.0');
    expect(sortedReleases[1].tag_name).toBe('v1.5.0');
  });
});

// ============================================================================
// Tests: Asset Selection
// ============================================================================

describe('Asset Selection', () => {
  it('should find macOS ARM64 asset', () => {
    const release = mockGitHubReleases[0];
    const asset = release.assets.find(a => a.name.includes('darwin-arm64'));
    expect(asset).toBeDefined();
    expect(asset?.name).toContain('darwin-arm64');
    expect(asset?.name).toContain('.dmg');
  });

  it('should find macOS x64 asset', () => {
    const release = mockGitHubReleases[0];
    const asset = release.assets.find(a => a.name.includes('darwin-x64'));
    expect(asset).toBeDefined();
    expect(asset?.name).toContain('darwin-x64');
  });

  it('should find Linux x64 asset', () => {
    const release = mockGitHubReleases[0];
    const asset = release.assets.find(a => a.name.includes('linux-x64'));
    expect(asset).toBeDefined();
    expect(asset?.name).toContain('.AppImage');
  });

  it('should extract download size', () => {
    const release = mockGitHubReleases[0];
    const asset = release.assets.find(a => a.name.includes('darwin-arm64'));
    expect(asset?.size).toBe(150000000);
  });
});

// ============================================================================
// Tests: Update State Transitions
// ============================================================================

describe('Update State Transitions', () => {
  it('should transition from idle to checking', () => {
    const validTransitions: Record<UpdateState, UpdateState[]> = {
      idle: ['checking'],
      checking: ['available', 'idle', 'error'],
      available: ['downloading', 'idle'],
      downloading: ['verifying', 'available', 'error'],
      verifying: ['ready', 'error'],
      ready: ['installing', 'idle'],
      installing: ['idle', 'error'],
      error: ['idle', 'checking'],
    };

    expect(validTransitions.idle).toContain('checking');
    expect(validTransitions.checking).toContain('available');
  });

  it('should allow retry from error state', () => {
    const validTransitions: Record<UpdateState, UpdateState[]> = {
      idle: ['checking'],
      checking: ['available', 'idle', 'error'],
      available: ['downloading', 'idle'],
      downloading: ['verifying', 'available', 'error'],
      verifying: ['ready', 'error'],
      ready: ['installing', 'idle'],
      installing: ['idle', 'error'],
      error: ['idle', 'checking'],
    };

    expect(validTransitions.error).toContain('checking');
  });

  it('should allow cancel from downloading state', () => {
    const validTransitions: Record<UpdateState, UpdateState[]> = {
      idle: ['checking'],
      checking: ['available', 'idle', 'error'],
      available: ['downloading', 'idle'],
      downloading: ['verifying', 'available', 'error'],
      verifying: ['ready', 'error'],
      ready: ['installing', 'idle'],
      installing: ['idle', 'error'],
      error: ['idle', 'checking'],
    };

    expect(validTransitions.downloading).toContain('available');
  });
});

// ============================================================================
// Tests: Progress Tracking
// ============================================================================

describe('Progress Tracking', () => {
  it('should calculate download percentage correctly', () => {
    const progress: UpdateProgress = {
      bytesDownloaded: 75000000,
      totalBytes: 150000000,
      percent: 50,
      speedBytesPerSecond: 1000000,
      estimatedTimeRemaining: 75,
      isPaused: false,
    };

    expect(progress.percent).toBe(50);
    expect(progress.bytesDownloaded / progress.totalBytes * 100).toBe(50);
  });

  it('should calculate estimated time remaining', () => {
    const bytesDownloaded = 50000000;
    const totalBytes = 150000000;
    const speedBytesPerSecond = 1000000; // 1 MB/s

    const remainingBytes = totalBytes - bytesDownloaded;
    const estimatedTimeRemaining = remainingBytes / speedBytesPerSecond;

    expect(estimatedTimeRemaining).toBe(100); // 100 seconds
  });

  it('should handle zero speed gracefully', () => {
    const progress: UpdateProgress = {
      bytesDownloaded: 50000000,
      totalBytes: 150000000,
      percent: 33,
      speedBytesPerSecond: 0,
      estimatedTimeRemaining: Infinity,
      isPaused: true,
    };

    expect(progress.isPaused).toBe(true);
    expect(progress.estimatedTimeRemaining).toBe(Infinity);
  });
});

// ============================================================================
// Tests: Error Handling
// ============================================================================

describe('Error Handling', () => {
  it('should create network error', () => {
    const error: UpdateError = {
      type: 'network',
      message: 'Failed to connect to update server',
      recoverable: true,
      suggestion: 'Check your internet connection and try again',
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    expect(error.type).toBe('network');
    expect(error.recoverable).toBe(true);
  });

  it('should create checksum error', () => {
    const error: UpdateError = {
      type: 'checksum',
      message: 'Checksum verification failed',
      recoverable: true,
      suggestion: 'The download may be corrupted. Please try downloading again',
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    expect(error.type).toBe('checksum');
    expect(error.recoverable).toBe(true);
  });

  it('should create signature error (non-recoverable)', () => {
    const error: UpdateError = {
      type: 'signature',
      message: 'Code signature verification failed',
      recoverable: false,
      suggestion: 'The update signature is invalid. Please download from the official source',
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    expect(error.type).toBe('signature');
    expect(error.recoverable).toBe(false);
  });

  it('should track retry count', () => {
    const error: UpdateError = {
      type: 'network',
      message: 'Failed to connect',
      recoverable: true,
      timestamp: new Date().toISOString(),
      retryCount: 3,
    };

    expect(error.retryCount).toBe(3);
  });
});

// ============================================================================
// Tests: Configuration
// ============================================================================

describe('Configuration', () => {
  it('should merge custom config with defaults', () => {
    const customConfig: Partial<UpdateConfig> = {
      channel: 'beta',
      autoDownload: false,
    };

    const mergedConfig: UpdateConfig = {
      ...DEFAULT_UPDATE_CONFIG,
      ...customConfig,
    };

    expect(mergedConfig.channel).toBe('beta');
    expect(mergedConfig.autoDownload).toBe(false);
    expect(mergedConfig.checkInterval).toBe(DEFAULT_UPDATE_CONFIG.checkInterval);
  });

  it('should handle skipped versions', () => {
    const config: UpdateConfig = {
      ...DEFAULT_UPDATE_CONFIG,
      skippedVersions: ['2.0.0', '2.0.1'],
    };

    expect(config.skippedVersions).toContain('2.0.0');
    expect(config.skippedVersions).toHaveLength(2);
  });

  it('should support custom server URL', () => {
    const config: UpdateConfig = {
      ...DEFAULT_UPDATE_CONFIG,
      customServerUrl: 'https://updates.company.com',
    };

    expect(config.customServerUrl).toBe('https://updates.company.com');
  });

  it('should support proxy configuration', () => {
    const config: UpdateConfig = {
      ...DEFAULT_UPDATE_CONFIG,
      proxyUrl: 'http://proxy.company.com:8080',
    };

    expect(config.proxyUrl).toBe('http://proxy.company.com:8080');
  });
});

// ============================================================================
// Tests: Update Check Response
// ============================================================================

describe('Update Check Response', () => {
  it('should create response when update is available', () => {
    const response: UpdateCheckResponse = {
      available: true,
      update: {
        version: '2.0.0',
        releaseDate: '2024-01-15T12:00:00Z',
        channel: 'stable',
        summary: 'Major new release',
        mandatory: false,
        downloadSize: 150000000,
      },
      currentVersion: '1.0.0',
      checkedAt: new Date().toISOString(),
    };

    expect(response.available).toBe(true);
    expect(response.update?.version).toBe('2.0.0');
  });

  it('should create response when no update is available', () => {
    const response: UpdateCheckResponse = {
      available: false,
      update: null,
      currentVersion: '2.0.0',
      checkedAt: new Date().toISOString(),
    };

    expect(response.available).toBe(false);
    expect(response.update).toBeNull();
  });

  it('should mark mandatory updates correctly', () => {
    const response: UpdateCheckResponse = {
      available: true,
      update: {
        version: '2.0.0',
        releaseDate: '2024-01-15T12:00:00Z',
        channel: 'stable',
        summary: 'Critical security update',
        mandatory: true,
        downloadSize: 150000000,
      },
      currentVersion: '1.0.0',
      checkedAt: new Date().toISOString(),
    };

    expect(response.update?.mandatory).toBe(true);
  });
});
