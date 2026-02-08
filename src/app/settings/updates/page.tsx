'use client';

import { useCallback, useEffect, useState } from 'react';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import { UpdateNotifier, useUpdateNotifier } from '@/components/updates';
import { Download, RefreshCw, CheckCircle, Info, AlertCircle, Settings, ArrowLeft } from 'lucide-react';
import type { UpdateChannel, UpdateStatusResponse } from '@/types/auto-update';

function UpdatesPageContent() {
  const {
    state,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    skipVersion,
    cancelDownload,
    isLoading,
  } = useUpdateNotifier();

  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<UpdateChannel>('stable');
  const [lastCheckedDisplay, setLastCheckedDisplay] = useState<string | null>(null);

  // Fetch initial status on mount
  useEffect(() => {
    fetch('/api/updates')
      .then((res) => res.json())
      .then((data: UpdateStatusResponse) => {
        if (data.lastCheckTime) {
          setLastCheckedDisplay(new Date(data.lastCheckTime).toLocaleString());
        }
      })
      .catch(() => {
        // Silently ignore - the useUpdateNotifier hook handles errors
      });
  }, []);

  // Update last checked time when state changes
  useEffect(() => {
    if (state.lastCheckTime) {
      setLastCheckedDisplay(new Date(state.lastCheckTime).toLocaleString());
    }
  }, [state.lastCheckTime]);

  const handleCheckForUpdates = useCallback(async () => {
    await checkForUpdates();
  }, [checkForUpdates]);

  const handleToggleAutoUpdate = useCallback(() => {
    setAutoUpdateEnabled((prev) => !prev);
  }, []);

  const handleChannelChange = useCallback(async (channel: UpdateChannel) => {
    setSelectedChannel(channel);
    try {
      await fetch('/api/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_channel', channel }),
      });
    } catch {
      // Channel change is best-effort
    }
  }, []);

  const isChecking = state.state === 'checking';
  const isUpToDate = state.state === 'idle' && !state.updateInfo && lastCheckedDisplay;
  const hasUpdate = state.state === 'available' || (state.updateInfo && state.state !== 'downloading' && state.state !== 'installing' && state.state !== 'ready');
  const isDownloading = state.state === 'downloading';
  const isReady = state.state === 'ready';
  const hasError = state.state === 'error';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </a>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Software Updates
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage application updates and release channels
          </p>
        </div>

        {/* Current Version Card */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Current Version
                </p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {state.currentVersion}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full bg-green-50 dark:bg-green-900/30 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-300 capitalize">
              {selectedChannel}
            </span>
          </div>
          {lastCheckedDisplay && (
            <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
              Last checked: {lastCheckedDisplay}
            </p>
          )}
        </div>

        {/* Update Status / Check Section */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
          {/* Up to date */}
          {isUpToDate && (
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="h-6 w-6 text-green-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  You are up to date
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  VibeCode {state.currentVersion} is the latest version.
                </p>
              </div>
            </div>
          )}

          {/* No check performed yet */}
          {state.state === 'idle' && !state.updateInfo && !lastCheckedDisplay && (
            <div className="flex items-center gap-3 mb-4">
              <Info className="h-6 w-6 text-gray-400" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Click the button below to check for available updates.
              </p>
            </div>
          )}

          {/* Checking */}
          {isChecking && (
            <div className="flex items-center gap-3 mb-4">
              <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Checking for updates...
              </p>
            </div>
          )}

          {/* Error */}
          {hasError && state.error && (
            <div className="flex items-start gap-3 mb-4 rounded-md bg-red-50 dark:bg-red-900/20 p-4">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  {state.error.message}
                </p>
                {state.error.suggestion && (
                  <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                    {state.error.suggestion}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Update Notifier for download/install/available states */}
          {(hasUpdate || isDownloading || isReady || state.state === 'installing' || state.state === 'verifying') && (
            <div className="mb-4">
              <UpdateNotifier
                state={state}
                onCheckForUpdates={handleCheckForUpdates}
                onDownload={downloadUpdate}
                onInstall={installUpdate}
                onSkipVersion={skipVersion}
                onCancelDownload={cancelDownload}
                onRetry={handleCheckForUpdates}
              />
            </div>
          )}

          {/* Check for Updates button */}
          <button
            onClick={handleCheckForUpdates}
            disabled={isChecking || isLoading || isDownloading}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {isChecking ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isChecking ? 'Checking...' : 'Check for Updates'}
          </button>
        </div>

        {/* Settings Section */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Update Settings
            </h2>
          </div>

          {/* Auto-update toggle */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Automatic Updates
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Automatically download and notify about new updates
              </p>
            </div>
            <button
              onClick={handleToggleAutoUpdate}
              role="switch"
              aria-checked={autoUpdateEnabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                autoUpdateEnabled
                  ? 'bg-blue-600'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoUpdateEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Update channel selection */}
          <div className="py-3">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
              Release Channel
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Choose which type of updates you want to receive
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(['stable', 'beta', 'nightly'] as UpdateChannel[]).map((channel) => (
                <button
                  key={channel}
                  onClick={() => handleChannelChange(channel)}
                  className={`rounded-md px-3 py-2 text-sm font-medium capitalize transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    selectedChannel === channel
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {channel}
                </button>
              ))}
            </div>
            <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              {selectedChannel === 'stable' && 'Production-ready releases. Recommended for most users.'}
              {selectedChannel === 'beta' && 'Pre-release versions for testing new features.'}
              {selectedChannel === 'nightly' && 'Daily builds with the latest features. May be unstable.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UpdatesPage() {
  return (
    <ErrorBoundary componentName="UpdatesPage">
      <UpdatesPageContent />
    </ErrorBoundary>
  );
}
