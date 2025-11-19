'use client'

import { useEffect, useState } from 'react'

export interface LoadingScreenProps {
  message?: string
  submessage?: string
  progress?: number
  onRetry?: () => void
  error?: string | null
  showSpinner?: boolean
}

/**
 * LoadingScreen - Shows loading state while server starts
 *
 * Features:
 * - Animated spinner
 * - Progress indicator (if provided)
 * - Error state with retry button
 * - Customizable messages
 * - Smooth animations
 *
 * Usage:
 * ```tsx
 * <LoadingScreen
 *   message="Starting code server..."
 *   submessage="This may take a few seconds"
 *   progress={65}
 *   error={error}
 *   onRetry={startServer}
 * />
 * ```
 */
export function LoadingScreen({
  message = 'Starting VibeCode...',
  submessage = 'Initializing development environment',
  progress,
  onRetry,
  error,
  showSpinner = true,
}: LoadingScreenProps) {
  const [dots, setDots] = useState('')

  // Animated dots effect
  useEffect(() => {
    if (!error) {
      const interval = setInterval(() => {
        setDots((prev) => (prev.length >= 3 ? '' : prev + '.'))
      }, 500)
      return () => clearInterval(interval)
    }
  }, [error])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-md w-full mx-4">
          <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-8 backdrop-blur-sm">
            {/* Error Icon */}
            <div className="mx-auto w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
              <svg
                className="w-8 h-8 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            {/* Error Message */}
            <h2 className="text-xl font-bold text-red-400 text-center mb-2">
              Failed to Start Server
            </h2>
            <p className="text-sm text-red-300/80 text-center mb-6 break-words">
              {error}
            </p>

            {/* Retry Button */}
            {onRetry && (
              <button
                onClick={onRetry}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
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
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Retry
              </button>
            )}

            {/* Troubleshooting Tips */}
            <div className="mt-6 pt-6 border-t border-red-900/50">
              <p className="text-xs text-red-300/60 mb-2">Troubleshooting tips:</p>
              <ul className="text-xs text-red-300/60 space-y-1 list-disc list-inside">
                <li>Check if port 8080 is available</li>
                <li>Ensure code-server is installed</li>
                <li>Check Tauri backend logs</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-md w-full mx-4">
        <div className="text-center">
          {/* Logo/Icon */}
          <div className="mx-auto w-20 h-20 mb-8 rounded-2xl bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 flex items-center justify-center shadow-2xl shadow-purple-500/50">
            <svg
              className="w-10 h-10 text-white"
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

          {/* Spinner */}
          {showSpinner && (
            <div className="mx-auto mb-6 relative">
              <div className="w-16 h-16 mx-auto">
                <div className="absolute inset-0 border-4 border-slate-700 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-t-blue-500 border-r-purple-500 rounded-full animate-spin"></div>
              </div>
            </div>
          )}

          {/* Messages */}
          <h1 className="text-2xl font-bold text-white mb-2">
            {message}
            <span className="inline-block w-8 text-left">{dots}</span>
          </h1>
          <p className="text-slate-400 mb-8">{submessage}</p>

          {/* Progress Bar */}
          {progress !== undefined && (
            <div className="mb-6">
              <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500 h-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-xs text-slate-500 mt-2">{progress}%</p>
            </div>
          )}

          {/* Status Messages */}
          <div className="space-y-2">
            <StatusStep completed={progress ? progress > 20 : false}>
              Locating code-server binary
            </StatusStep>
            <StatusStep completed={progress ? progress > 40 : false}>
              Allocating port
            </StatusStep>
            <StatusStep completed={progress ? progress > 60 : false}>
              Starting server process
            </StatusStep>
            <StatusStep completed={progress ? progress > 80 : false}>
              Waiting for server to be ready
            </StatusStep>
          </div>
        </div>
      </div>
    </div>
  )
}

interface StatusStepProps {
  completed: boolean
  children: React.ReactNode
}

function StatusStep({ completed, children }: StatusStepProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
          completed
            ? 'bg-green-500/20 border-2 border-green-500'
            : 'bg-slate-700 border-2 border-slate-600'
        }`}
      >
        {completed && (
          <svg
            className="w-3 h-3 text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
      </div>
      <span className={completed ? 'text-slate-300' : 'text-slate-500'}>
        {children}
      </span>
    </div>
  )
}

/**
 * MinimalLoadingScreen - Simpler loading screen for faster loads
 */
export function MinimalLoadingScreen({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="h-full w-full flex items-center justify-center bg-slate-900">
      <div className="space-y-4 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />
        <p className="text-sm text-slate-400">{message}</p>
      </div>
    </div>
  )
}
