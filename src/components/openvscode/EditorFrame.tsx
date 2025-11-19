'use client'

import { useEffect, useRef, useState } from 'react'
import { ServerStatus } from './ServerConnection'

export interface EditorFrameProps {
  serverUrl: string | null
  onLoad?: () => void
  onError?: (error: string) => void
  className?: string
  redirectMode?: boolean
}

/**
 * EditorFrame - Displays the OpenVSCode Server in an iframe or redirects to it
 *
 * Features:
 * - Iframe embedding mode (default)
 * - Redirect mode (for better compatibility)
 * - Load detection
 * - Error handling
 * - Responsive sizing
 *
 * Usage:
 * ```tsx
 * <EditorFrame
 *   serverUrl="http://127.0.0.1:8080"
 *   onLoad={() => console.log('Editor loaded')}
 *   redirectMode={false}
 * />
 * ```
 */
export function EditorFrame({
  serverUrl,
  onLoad,
  onError,
  className = '',
  redirectMode = false,
}: EditorFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Redirect mode - navigate to the server URL directly
  useEffect(() => {
    if (redirectMode && serverUrl) {
      window.location.href = serverUrl
    }
  }, [redirectMode, serverUrl])

  // Handle iframe load
  const handleLoad = () => {
    setIsLoading(false)
    setLoadError(null)
    if (onLoad) {
      onLoad()
    }
  }

  // Handle iframe error
  const handleError = () => {
    const error = 'Failed to load editor'
    setLoadError(error)
    setIsLoading(false)
    if (onError) {
      onError(error)
    }
  }

  // Periodically check if iframe is responsive
  useEffect(() => {
    if (!serverUrl || redirectMode) return

    const checkInterval = setInterval(() => {
      const iframe = iframeRef.current
      if (!iframe) return

      try {
        // Try to access iframe document to check if it's loaded
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
        if (iframeDoc?.readyState === 'complete') {
          setIsLoading(false)
        }
      } catch (err) {
        // Cross-origin, but that's expected
        // If we can't access it, assume it's loaded
        setIsLoading(false)
      }
    }, 1000)

    return () => clearInterval(checkInterval)
  }, [serverUrl, redirectMode])

  if (!serverUrl) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-900">
        <p className="text-slate-500">No server URL available</p>
      </div>
    )
  }

  if (redirectMode) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500 mb-4" />
          <p className="text-slate-400">Redirecting to editor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative h-full w-full ${className}`}>
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500 mb-4" />
            <p className="text-slate-400">Loading editor...</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
          <div className="text-center max-w-md px-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
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
            <h3 className="text-lg font-semibold text-red-400 mb-2">
              Editor Load Failed
            </h3>
            <p className="text-sm text-red-300/80 mb-4">{loadError}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      )}

      {/* Iframe */}
      <iframe
        ref={iframeRef}
        src={serverUrl}
        className="w-full h-full border-0"
        title="OpenVSCode Server"
        onLoad={handleLoad}
        onError={handleError}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  )
}

/**
 * EditorContainer - Higher-level component that combines server status and editor frame
 */
export interface EditorContainerProps {
  status: ServerStatus | null
  isLoading: boolean
  error: string | null
  onRetry?: () => void
  redirectMode?: boolean
}

export function EditorContainer({
  status,
  isLoading,
  error,
  onRetry,
  redirectMode = false,
}: EditorContainerProps) {
  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500 mb-4" />
          <p className="text-slate-400">Starting server...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-900">
        <div className="text-center max-w-md px-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
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
          <h3 className="text-lg font-semibold text-red-400 mb-2">Server Error</h3>
          <p className="text-sm text-red-300/80 mb-4">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!status?.running || !status?.url) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <p className="text-slate-500">Server is not running</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Start Server
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <EditorFrame
      serverUrl={status.url}
      redirectMode={redirectMode}
      onError={(err) => console.error('Editor load error:', err)}
    />
  )
}
