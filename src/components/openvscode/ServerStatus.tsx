'use client'

import { useState } from 'react'
import { ServerStatus as ServerStatusType } from './ServerConnection'

export interface ServerStatusProps {
  status: ServerStatusType | null
  onStart?: () => void
  onStop?: () => void
  onRestart?: () => void
  isLoading?: boolean
  compact?: boolean
}

/**
 * ServerStatus - Displays server health and provides control buttons
 *
 * Features:
 * - Visual status indicator
 * - Server details (port, PID, uptime)
 * - Control buttons (start/stop/restart)
 * - Compact mode for minimal UI
 * - Auto-refresh capability
 *
 * Usage:
 * ```tsx
 * <ServerStatus
 *   status={serverStatus}
 *   onStart={startServer}
 *   onStop={stopServer}
 *   onRestart={restartServer}
 *   compact={false}
 * />
 * ```
 */
export function ServerStatus({
  status,
  onStart,
  onStop,
  onRestart,
  isLoading = false,
  compact = false,
}: ServerStatusProps) {
  const [showDetails, setShowDetails] = useState(!compact)

  const isRunning = status?.running ?? false
  const statusColor = isRunning ? 'green' : 'gray'
  const statusText = isRunning ? 'Running' : 'Stopped'

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700">
        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
            }`}
          />
          <span className="text-xs text-slate-300">{statusText}</span>
        </div>

        {/* Port */}
        {status?.port && (
          <span className="text-xs text-slate-500">:{status.port}</span>
        )}

        {/* Toggle Details */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-slate-500 hover:text-slate-300 ml-auto"
        >
          {showDetails ? '−' : '+'}
        </button>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              isRunning
                ? 'bg-green-500 shadow-lg shadow-green-500/50 animate-pulse'
                : 'bg-gray-500'
            }`}
          />
          <div>
            <h3 className="text-sm font-semibold text-white">Code Server</h3>
            <p className="text-xs text-slate-400">{statusText}</p>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-2">
          {!isRunning && onStart && (
            <button
              onClick={onStart}
              disabled={isLoading}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white text-xs rounded-md transition-colors flex items-center gap-1"
            >
              {isLoading ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Start
                </>
              )}
            </button>
          )}

          {isRunning && (
            <>
              {onRestart && (
                <button
                  onClick={onRestart}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white text-xs rounded-md transition-colors flex items-center gap-1"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Restart
                </button>
              )}
              {onStop && (
                <button
                  onClick={onStop}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 text-white text-xs rounded-md transition-colors flex items-center gap-1"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                    />
                  </svg>
                  Stop
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Details */}
      {showDetails && (
        <div className="px-4 py-3">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500 text-xs mb-1">Status</dt>
              <dd className="text-white flex items-center gap-2">
                <span className={`text-${statusColor}-500 font-semibold`}>
                  {statusText}
                </span>
                {isRunning && (
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                    Active
                  </span>
                )}
              </dd>
            </div>

            <div>
              <dt className="text-slate-500 text-xs mb-1">Port</dt>
              <dd className="text-white font-mono">
                {status?.port ?? 'N/A'}
              </dd>
            </div>

            <div>
              <dt className="text-slate-500 text-xs mb-1">Process ID</dt>
              <dd className="text-white font-mono">{status?.pid ?? 'N/A'}</dd>
            </div>

            <div>
              <dt className="text-slate-500 text-xs mb-1">Startup Time</dt>
              <dd className="text-white">
                {status?.startup_time ? `${status.startup_time}ms` : 'N/A'}
              </dd>
            </div>

            {status?.url && (
              <div className="col-span-2">
                <dt className="text-slate-500 text-xs mb-1">URL</dt>
                <dd className="text-white">
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
      )}
    </div>
  )
}

/**
 * ServerStatusBadge - Minimal status indicator for headers/toolbars
 */
export interface ServerStatusBadgeProps {
  status: ServerStatusType | null
  onClick?: () => void
}

export function ServerStatusBadge({ status, onClick }: ServerStatusBadgeProps) {
  const isRunning = status?.running ?? false

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors border border-slate-700"
    >
      <div
        className={`w-2 h-2 rounded-full ${
          isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
        }`}
      />
      <span className="text-xs text-slate-300">
        {isRunning ? 'Online' : 'Offline'}
      </span>
      {status?.port && (
        <span className="text-xs text-slate-500 font-mono">:{status.port}</span>
      )}
    </button>
  )
}

/**
 * FullScreenServerStatus - Large status panel for dedicated status pages
 */
export function FullScreenServerStatus({
  status,
  onStart,
  onStop,
  onRestart,
  isLoading,
}: ServerStatusProps) {
  const isRunning = status?.running ?? false

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 shadow-2xl">
          {/* Status Icon */}
          <div className="text-center mb-8">
            <div
              className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
                isRunning
                  ? 'bg-green-500/20 border-4 border-green-500'
                  : 'bg-gray-500/20 border-4 border-gray-500'
              }`}
            >
              <svg
                className={`w-10 h-10 ${
                  isRunning ? 'text-green-500' : 'text-gray-500'
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 12h14M12 5l7 7-7 7"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Code Server {isRunning ? 'Running' : 'Stopped'}
            </h1>
            <p className="text-slate-400">
              {isRunning
                ? 'Your development environment is ready'
                : 'Start the server to begin coding'}
            </p>
          </div>

          {/* Server Details */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <InfoCard
              label="Status"
              value={isRunning ? 'Active' : 'Inactive'}
              valueColor={isRunning ? 'text-green-500' : 'text-gray-500'}
            />
            <InfoCard
              label="Port"
              value={status?.port?.toString() ?? 'N/A'}
              mono
            />
            <InfoCard
              label="Process ID"
              value={status?.pid?.toString() ?? 'N/A'}
              mono
            />
            <InfoCard
              label="Startup Time"
              value={status?.startup_time ? `${status.startup_time}ms` : 'N/A'}
            />
          </div>

          {/* URL */}
          {status?.url && (
            <div className="mb-8 p-4 bg-slate-900 rounded-lg border border-slate-700">
              <p className="text-slate-500 text-xs mb-2">Server URL</p>
              <a
                href={status.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 font-mono text-sm break-all"
              >
                {status.url}
              </a>
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex gap-4">
            {!isRunning && onStart && (
              <button
                onClick={onStart}
                disabled={isLoading}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                {isLoading ? 'Starting...' : 'Start Server'}
              </button>
            )}
            {isRunning && (
              <>
                {onRestart && (
                  <button
                    onClick={onRestart}
                    disabled={isLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-colors"
                  >
                    Restart
                  </button>
                )}
                {onStop && (
                  <button
                    onClick={onStop}
                    disabled={isLoading}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-colors"
                  >
                    Stop Server
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface InfoCardProps {
  label: string
  value: string
  valueColor?: string
  mono?: boolean
}

function InfoCard({ label, value, valueColor = 'text-white', mono = false }: InfoCardProps) {
  return (
    <div className="p-4 bg-slate-900 rounded-lg border border-slate-700">
      <p className="text-slate-500 text-xs mb-2">{label}</p>
      <p className={`text-lg font-semibold ${valueColor} ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </div>
  )
}
