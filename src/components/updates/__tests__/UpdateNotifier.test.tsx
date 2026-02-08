/**
 * UpdateNotifier Component Tests
 *
 * Tests for the update notification UI component.
 *
 * @module components/updates/__tests__/UpdateNotifier.test
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UpdateNotifier, UpdateNotifierProps } from '../UpdateNotifier';
import { UpdateManagerState, UpdateInfo, UpdateProgress, InstallProgress, UpdateError } from '@/types/auto-update';

// ============================================================================
// Mock Data
// ============================================================================

const createMockUpdateInfo = (overrides?: Partial<UpdateInfo>): UpdateInfo => ({
  version: '2.0.0',
  releaseDate: '2024-01-15T12:00:00Z',
  channel: 'stable',
  releaseNotes: {
    summary: 'This is a major release with exciting new features!',
    sections: [
      {
        title: 'Features',
        items: ['New AI-powered code completion', 'Dark mode support'],
      },
      {
        title: 'Bug Fixes',
        items: ['Fixed memory leak', 'Resolved startup crashes'],
      },
    ],
    markdown: '## Features\n- Feature 1\n- Feature 2',
    breakingChanges: undefined,
    knownIssues: undefined,
  },
  assets: [
    {
      platform: 'darwin-arm64',
      format: 'dmg',
      downloadUrl: 'https://example.com/app.dmg',
      size: 150000000,
      checksum: 'abc123',
    },
  ],
  mandatory: false,
  releaseUrl: 'https://github.com/example/releases/v2.0.0',
  requiresRestart: true,
  ...overrides,
});

const createMockState = (overrides?: Partial<UpdateManagerState>): UpdateManagerState => ({
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
  ...overrides,
});

const defaultProps: UpdateNotifierProps = {
  state: createMockState(),
};

// ============================================================================
// Test Utilities
// ============================================================================

const renderComponent = (props: Partial<UpdateNotifierProps> = {}) => {
  return render(<UpdateNotifier {...defaultProps} {...props} />);
};

// ============================================================================
// Tests: Idle State
// ============================================================================

describe('UpdateNotifier - Idle State', () => {
  it('should render nothing when idle with no update', () => {
    const { container } = renderComponent({
      state: createMockState({ state: 'idle', updateInfo: null }),
    });
    expect(container.firstChild).toBeNull();
  });
});

// ============================================================================
// Tests: Checking State
// ============================================================================

describe('UpdateNotifier - Checking State', () => {
  it('should show checking message', () => {
    renderComponent({
      state: createMockState({ state: 'checking' }),
    });
    expect(screen.getByText(/checking for updates/i)).toBeInTheDocument();
  });

  it('should show spinner animation', () => {
    renderComponent({
      state: createMockState({ state: 'checking' }),
    });
    // Look for the animate-spin class on an element
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});

// ============================================================================
// Tests: Available State
// ============================================================================

describe('UpdateNotifier - Available State', () => {
  const updateInfo = createMockUpdateInfo();

  it('should show update available message', () => {
    renderComponent({
      state: createMockState({ state: 'available', updateInfo }),
    });
    expect(screen.getByText(/update available/i)).toBeInTheDocument();
  });

  it('should display version number', () => {
    renderComponent({
      state: createMockState({ state: 'available', updateInfo }),
    });
    expect(screen.getByText(/2\.0\.0/)).toBeInTheDocument();
  });

  it('should show channel badge', () => {
    renderComponent({
      state: createMockState({ state: 'available', updateInfo }),
    });
    expect(screen.getByText(/stable/i)).toBeInTheDocument();
  });

  it('should show download button', () => {
    renderComponent({
      state: createMockState({ state: 'available', updateInfo }),
    });
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
  });

  it('should show later button', () => {
    renderComponent({
      state: createMockState({ state: 'available', updateInfo }),
    });
    expect(screen.getByRole('button', { name: /later/i })).toBeInTheDocument();
  });

  it('should show skip version button for non-mandatory updates', () => {
    renderComponent({
      state: createMockState({ state: 'available', updateInfo }),
    });
    expect(screen.getByRole('button', { name: /skip version/i })).toBeInTheDocument();
  });

  it('should not show skip version button for mandatory updates', () => {
    const mandatoryUpdate = createMockUpdateInfo({ mandatory: true });
    renderComponent({
      state: createMockState({ state: 'available', updateInfo: mandatoryUpdate }),
    });
    expect(screen.queryByRole('button', { name: /skip version/i })).not.toBeInTheDocument();
  });

  it('should call onDownload when download button is clicked', () => {
    const onDownload = jest.fn();
    renderComponent({
      state: createMockState({ state: 'available', updateInfo }),
      onDownload,
    });
    fireEvent.click(screen.getByRole('button', { name: /download/i }));
    expect(onDownload).toHaveBeenCalled();
  });

  it('should call onDismiss when later button is clicked', () => {
    const onDismiss = jest.fn();
    renderComponent({
      state: createMockState({ state: 'available', updateInfo }),
      onDismiss,
    });
    fireEvent.click(screen.getByRole('button', { name: /later/i }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('should call onSkipVersion when skip button is clicked', () => {
    const onSkipVersion = jest.fn();
    renderComponent({
      state: createMockState({ state: 'available', updateInfo }),
      onSkipVersion,
    });
    fireEvent.click(screen.getByRole('button', { name: /skip version/i }));
    expect(onSkipVersion).toHaveBeenCalledWith('2.0.0');
  });

  it('should show download size', () => {
    renderComponent({
      state: createMockState({ state: 'available', updateInfo }),
    });
    expect(screen.getByText(/download size/i)).toBeInTheDocument();
  });

  it('should show mandatory update warning', () => {
    const mandatoryUpdate = createMockUpdateInfo({ mandatory: true });
    renderComponent({
      state: createMockState({ state: 'available', updateInfo: mandatoryUpdate }),
    });
    expect(screen.getByText(/required update/i)).toBeInTheDocument();
  });
});

// ============================================================================
// Tests: Downloading State
// ============================================================================

describe('UpdateNotifier - Downloading State', () => {
  const downloadProgress: UpdateProgress = {
    bytesDownloaded: 75000000,
    totalBytes: 150000000,
    percent: 50,
    speedBytesPerSecond: 1000000,
    estimatedTimeRemaining: 75,
    isPaused: false,
  };

  it('should show downloading message', () => {
    renderComponent({
      state: createMockState({
        state: 'downloading',
        updateInfo: createMockUpdateInfo(),
        downloadProgress,
      }),
    });
    expect(screen.getByText(/downloading update/i)).toBeInTheDocument();
  });

  it('should show progress percentage', () => {
    renderComponent({
      state: createMockState({
        state: 'downloading',
        updateInfo: createMockUpdateInfo(),
        downloadProgress,
      }),
    });
    expect(screen.getByText(/50%/)).toBeInTheDocument();
  });

  it('should show progress bar', () => {
    renderComponent({
      state: createMockState({
        state: 'downloading',
        updateInfo: createMockUpdateInfo(),
        downloadProgress,
      }),
    });
    // Progress component should be present
    const progressBar = document.querySelector('[role="progressbar"]');
    expect(progressBar).toBeInTheDocument();
  });

  it('should show cancel button', () => {
    const onCancelDownload = jest.fn();
    renderComponent({
      state: createMockState({
        state: 'downloading',
        updateInfo: createMockUpdateInfo(),
        downloadProgress,
      }),
      onCancelDownload,
    });
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('should call onCancelDownload when cancel button is clicked', () => {
    const onCancelDownload = jest.fn();
    renderComponent({
      state: createMockState({
        state: 'downloading',
        updateInfo: createMockUpdateInfo(),
        downloadProgress,
      }),
      onCancelDownload,
    });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancelDownload).toHaveBeenCalled();
  });
});

// ============================================================================
// Tests: Verifying State
// ============================================================================

describe('UpdateNotifier - Verifying State', () => {
  it('should show verifying message', () => {
    renderComponent({
      state: createMockState({ state: 'verifying' }),
    });
    expect(screen.getByText(/verifying/i)).toBeInTheDocument();
  });
});

// ============================================================================
// Tests: Ready State
// ============================================================================

describe('UpdateNotifier - Ready State', () => {
  const updateInfo = createMockUpdateInfo();

  it('should show update ready message', () => {
    renderComponent({
      state: createMockState({
        state: 'ready',
        updateInfo,
        downloadedFilePath: '/tmp/update.dmg',
      }),
    });
    expect(screen.getByText(/update ready/i)).toBeInTheDocument();
  });

  it('should show install now button', () => {
    renderComponent({
      state: createMockState({
        state: 'ready',
        updateInfo,
        downloadedFilePath: '/tmp/update.dmg',
      }),
    });
    expect(screen.getByRole('button', { name: /install now/i })).toBeInTheDocument();
  });

  it('should show later button', () => {
    renderComponent({
      state: createMockState({
        state: 'ready',
        updateInfo,
        downloadedFilePath: '/tmp/update.dmg',
      }),
    });
    expect(screen.getByRole('button', { name: /later/i })).toBeInTheDocument();
  });

  it('should call onInstall when install button is clicked', () => {
    const onInstall = jest.fn();
    renderComponent({
      state: createMockState({
        state: 'ready',
        updateInfo,
        downloadedFilePath: '/tmp/update.dmg',
      }),
      onInstall,
    });
    fireEvent.click(screen.getByRole('button', { name: /install now/i }));
    expect(onInstall).toHaveBeenCalled();
  });
});

// ============================================================================
// Tests: Installing State
// ============================================================================

describe('UpdateNotifier - Installing State', () => {
  const installProgress: InstallProgress = {
    step: 'installing',
    description: 'Installing update...',
    percent: 60,
  };

  it('should show installing message', () => {
    renderComponent({
      state: createMockState({
        state: 'installing',
        installProgress,
      }),
    });
    expect(screen.getAllByText(/installing update/i).length).toBeGreaterThan(0);
  });

  it('should show progress bar', () => {
    renderComponent({
      state: createMockState({
        state: 'installing',
        installProgress,
      }),
    });
    const progressBar = document.querySelector('[role="progressbar"]');
    expect(progressBar).toBeInTheDocument();
  });

  it('should show warning message', () => {
    renderComponent({
      state: createMockState({
        state: 'installing',
        installProgress,
      }),
    });
    expect(screen.getByText(/do not close/i)).toBeInTheDocument();
  });
});

// ============================================================================
// Tests: Error State
// ============================================================================

describe('UpdateNotifier - Error State', () => {
  const error: UpdateError = {
    type: 'network',
    message: 'Failed to connect to update server',
    recoverable: true,
    suggestion: 'Check your internet connection',
    timestamp: new Date().toISOString(),
    retryCount: 0,
  };

  it('should show error message', () => {
    renderComponent({
      state: createMockState({
        state: 'error',
        error,
      }),
    });
    expect(screen.getByText(/failed to connect/i)).toBeInTheDocument();
  });

  it('should show suggestion', () => {
    renderComponent({
      state: createMockState({
        state: 'error',
        error,
      }),
    });
    expect(screen.getByText(/check your internet/i)).toBeInTheDocument();
  });

  it('should show retry button for recoverable errors', () => {
    const onRetry = jest.fn();
    renderComponent({
      state: createMockState({
        state: 'error',
        error,
      }),
      onRetry,
    });
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('should call onRetry when retry button is clicked', () => {
    const onRetry = jest.fn();
    renderComponent({
      state: createMockState({
        state: 'error',
        error,
      }),
      onRetry,
    });
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('should not show retry button for non-recoverable errors', () => {
    const nonRecoverableError: UpdateError = {
      ...error,
      type: 'signature',
      recoverable: false,
    };
    renderComponent({
      state: createMockState({
        state: 'error',
        error: nonRecoverableError,
      }),
    });
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('should show dismiss button', () => {
    const onDismiss = jest.fn();
    renderComponent({
      state: createMockState({
        state: 'error',
        error,
      }),
      onDismiss,
    });
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });
});

// ============================================================================
// Tests: Release Notes
// ============================================================================

describe('UpdateNotifier - Release Notes', () => {
  const updateInfo = createMockUpdateInfo();

  it('should show "What\'s New" toggle', () => {
    renderComponent({
      state: createMockState({ state: 'available', updateInfo }),
    });
    expect(screen.getByText(/what's new/i)).toBeInTheDocument();
  });

  it('should expand release notes on click', async () => {
    renderComponent({
      state: createMockState({ state: 'available', updateInfo }),
    });

    const toggle = screen.getByText(/what's new/i);
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByText(/new ai-powered code completion/i)).toBeInTheDocument();
    });
  });

  it('should show breaking changes warning', async () => {
    const updateWithBreaking = createMockUpdateInfo({
      releaseNotes: {
        ...createMockUpdateInfo().releaseNotes,
        breakingChanges: ['API endpoint removed'],
      },
    });

    renderComponent({
      state: createMockState({ state: 'available', updateInfo: updateWithBreaking }),
    });

    const toggle = screen.getByText(/what's new/i);
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByText(/breaking changes/i)).toBeInTheDocument();
    });
  });

  it('should show known issues', async () => {
    const updateWithIssues = createMockUpdateInfo({
      releaseNotes: {
        ...createMockUpdateInfo().releaseNotes,
        knownIssues: ['Windows 11 compatibility issue'],
      },
    });

    renderComponent({
      state: createMockState({ state: 'available', updateInfo: updateWithIssues }),
    });

    const toggle = screen.getByText(/what's new/i);
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByText(/known issues/i)).toBeInTheDocument();
    });
  });
});

// ============================================================================
// Tests: Floating Mode
// ============================================================================

describe('UpdateNotifier - Floating Mode', () => {
  it('should apply floating styles when floating prop is true', () => {
    renderComponent({
      state: createMockState({
        state: 'available',
        updateInfo: createMockUpdateInfo(),
      }),
      floating: true,
    });

    const card = document.querySelector('.shadow-lg');
    expect(card).toBeInTheDocument();
  });
});

// ============================================================================
// Tests: Accessibility
// ============================================================================

describe('UpdateNotifier - Accessibility', () => {
  it('should have accessible dismiss button', () => {
    renderComponent({
      state: createMockState({
        state: 'available',
        updateInfo: createMockUpdateInfo(),
      }),
    });

    const dismissButton = screen.getByLabelText(/dismiss/i);
    expect(dismissButton).toBeInTheDocument();
  });

  it('should have accessible expand/collapse button', () => {
    renderComponent({
      state: createMockState({
        state: 'available',
        updateInfo: createMockUpdateInfo(),
      }),
    });

    const expandButton = screen.getByRole('button', { name: /what's new/i });
    expect(expandButton).toHaveAttribute('aria-expanded');
  });
});
