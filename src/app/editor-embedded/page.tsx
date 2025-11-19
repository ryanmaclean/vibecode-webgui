'use client'

import { useState } from 'react'
import {
  ServerConnection,
  LoadingScreen,
  EditorContainer,
  ServerStatusBadge,
  ServerStatus as ServerStatusType,
} from '@/components/openvscode'

/**
 * Embedded Editor Page
 *
 * This page demonstrates the full integration of OpenVSCode Server components.
 * It shows how to:
 * - Manage server connection state
 * - Display loading screens
 * - Embed the editor in an iframe
 * - Show server status
 * - Handle errors and reconnection
 */
export default function EmbeddedEditorPage() {
  const [showStatusPanel, setShowStatusPanel] = useState(false)

  return (
    <ServerConnection autoStart>
      {({ status, isLoading, error, startServer, stopServer, restartServer }) => {
        // Show loading screen during initial startup
        if (isLoading && !status?.running) {
          return (
            <LoadingScreen
              message="Starting Code Server"
              submessage="Setting up your development environment"
              error={error}
              onRetry={startServer}
              progress={isLoading ? 50 : undefined}
            />
          )
        }

        return (
          <div className="h-screen flex flex-col bg-slate-900">
            {/* Header with status badge */}
            <header className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                    />
                  </svg>
                </div>
                <div>
                  <h1 className="text-sm font-semibold text-white">VibeCode Editor</h1>
                  <p className="text-xs text-slate-400">Development Environment</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <ServerStatusBadge
                  status={status}
                  onClick={() => setShowStatusPanel(!showStatusPanel)}
                />
              </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
              {/* Main Editor Area */}
              <div className="flex-1 relative">
                <EditorContainer
                  status={status}
                  isLoading={isLoading}
                  error={error}
                  onRetry={startServer}
                  redirectMode={false}
                />
              </div>

              {/* Status Panel (collapsible) */}
              {showStatusPanel && (
                <div className="w-80 bg-slate-900 border-l border-slate-700 p-4 overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-white">Server Status</h2>
                    <button
                      onClick={() => setShowStatusPanel(false)}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Import and use ServerStatus component */}
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                      <dl className="space-y-3 text-sm">
                        <div>
                          <dt className="text-slate-500 text-xs mb-1">Status</dt>
                          <dd className="text-white flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                status?.running ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
                              }`}
                            />
                            {status?.running ? 'Running' : 'Stopped'}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-slate-500 text-xs mb-1">Port</dt>
                          <dd className="text-white font-mono">{status?.port ?? 'N/A'}</dd>
                        </div>

                        <div>
                          <dt className="text-slate-500 text-xs mb-1">Process ID</dt>
                          <dd className="text-white font-mono">{status?.pid ?? 'N/A'}</dd>
                        </div>

                        {status?.startup_time && (
                          <div>
                            <dt className="text-slate-500 text-xs mb-1">Startup Time</dt>
                            <dd className="text-white">{status.startup_time}ms</dd>
                          </div>
                        )}

                        {status?.url && (
                          <div>
                            <dt className="text-slate-500 text-xs mb-1">URL</dt>
                            <dd>
                              <a
                                href={status.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 text-xs font-mono break-all"
                              >
                                {status.url}
                              </a>
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    {/* Control buttons */}
                    <div className="space-y-2">
                      {!status?.running && (
                        <button
                          onClick={startServer}
                          disabled={isLoading}
                          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white py-2 rounded-lg transition-colors"
                        >
                          {isLoading ? 'Starting...' : 'Start Server'}
                        </button>
                      )}

                      {status?.running && (
                        <>
                          <button
                            onClick={restartServer}
                            disabled={isLoading}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white py-2 rounded-lg transition-colors"
                          >
                            Restart Server
                          </button>
                          <button
                            onClick={stopServer}
                            disabled={isLoading}
                            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-600 text-white py-2 rounded-lg transition-colors"
                          >
                            Stop Server
                          </button>
                        </>
                      )}
                    </div>

                    {/* Error display */}
                    {error && (
                      <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-3">
                        <p className="text-xs text-red-300 break-words">{error}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      }}
    </ServerConnection>
  )
}
