import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/updates',
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Download: (props: any) => <svg data-testid="icon-download" {...props} />,
  RefreshCw: (props: any) => <svg data-testid="icon-refresh" {...props} />,
  CheckCircle: (props: any) => <svg data-testid="icon-check" {...props} />,
  Info: (props: any) => <svg data-testid="icon-info" {...props} />,
  AlertCircle: (props: any) => <svg data-testid="icon-alert" {...props} />,
  Settings: (props: any) => <svg data-testid="icon-settings" {...props} />,
  ArrowLeft: (props: any) => <svg data-testid="icon-arrow-left" {...props} />,
}));

// Mock useUpdateNotifier hook
const mockCheckForUpdates = jest.fn().mockResolvedValue(undefined);
const mockDownloadUpdate = jest.fn();
const mockInstallUpdate = jest.fn();
const mockSkipVersion = jest.fn();
const mockCancelDownload = jest.fn();

jest.mock('@/components/updates', () => ({
  UpdateNotifier: (props: any) => (
    <div data-testid="update-notifier">UpdateNotifier</div>
  ),
  useUpdateNotifier: () => ({
    state: {
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
      currentVersion: '1.2.3',
      platform: 'darwin-arm64',
    },
    checkForUpdates: mockCheckForUpdates,
    downloadUpdate: mockDownloadUpdate,
    installUpdate: mockInstallUpdate,
    skipVersion: mockSkipVersion,
    cancelDownload: mockCancelDownload,
    isLoading: false,
  }),
}));

// Mock ErrorBoundary to render children directly
jest.mock('@/components/error/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import UpdatesPage from '../page';

describe('UpdatesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock fetch for the initial status polling
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            state: 'idle',
            update: null,
            progress: null,
            error: null,
            lastCheckTime: null,
          }),
      })
    ) as jest.Mock;
  });

  it('renders without crashing', () => {
    render(<UpdatesPage />);
    expect(screen.getByText('Software Updates')).toBeInTheDocument();
  });

  it('shows page heading and description', () => {
    render(<UpdatesPage />);
    expect(screen.getByText('Software Updates')).toBeInTheDocument();
    expect(
      screen.getByText('Manage application updates and release channels')
    ).toBeInTheDocument();
  });

  it('displays current version', () => {
    render(<UpdatesPage />);
    expect(screen.getByText('Current Version')).toBeInTheDocument();
    expect(screen.getByText('1.2.3')).toBeInTheDocument();
  });

  it('shows Check for Updates button', () => {
    render(<UpdatesPage />);
    expect(screen.getByText('Check for Updates')).toBeInTheDocument();
  });

  it('calls checkForUpdates when button is clicked', () => {
    render(<UpdatesPage />);
    fireEvent.click(screen.getByText('Check for Updates'));
    expect(mockCheckForUpdates).toHaveBeenCalled();
  });

  it('shows auto-update toggle switch', () => {
    render(<UpdatesPage />);
    expect(screen.getByText('Automatic Updates')).toBeInTheDocument();
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles auto-update when switch is clicked', () => {
    render(<UpdatesPage />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('shows release channel options', () => {
    render(<UpdatesPage />);
    expect(screen.getByText('Release Channel')).toBeInTheDocument();
    // "stable" appears in both channel badge and button, so use getAllByText
    expect(screen.getAllByText('stable').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('beta')).toBeInTheDocument();
    expect(screen.getByText('nightly')).toBeInTheDocument();
  });

  it('shows stable channel description by default', () => {
    render(<UpdatesPage />);
    expect(
      screen.getByText('Production-ready releases. Recommended for most users.')
    ).toBeInTheDocument();
  });

  it('switches channel when a channel button is clicked', async () => {
    render(<UpdatesPage />);
    fireEvent.click(screen.getByText('beta'));
    await waitFor(() => {
      expect(
        screen.getByText('Pre-release versions for testing new features.')
      ).toBeInTheDocument();
    });
  });

  it('shows Update Settings section', () => {
    render(<UpdatesPage />);
    expect(screen.getByText('Update Settings')).toBeInTheDocument();
  });

  it('shows back link to home', () => {
    render(<UpdatesPage />);
    const backLink = screen.getByText('Back');
    expect(backLink.closest('a')).toHaveAttribute('href', '/');
  });

  it('shows the selected channel badge', () => {
    render(<UpdatesPage />);
    // The channel badge shows "stable" capitalized
    const badges = screen.getAllByText('stable');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('fetches initial status on mount', () => {
    render(<UpdatesPage />);
    expect(global.fetch).toHaveBeenCalledWith('/api/updates');
  });
});
