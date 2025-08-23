/**
 * Code-server IDE Component for VibeCode WebGUI
 * Integrates code-server 4.101.2 with React frontend using iframe pattern
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

interface CodeServerIDEProps {
  workspaceId: string
  projectPath?: string
  className?: string
  onReady?: (iframe: HTMLIFrameElement) => void
  onError?: (error: Error) => void
}

interface CodeServerSession {
  id: string
  url: string
  status: 'starting' | 'ready' | 'error' | 'stopped'
  workspaceId: string
  createdAt: Date
}

export default function CodeServerIDE({
  workspaceId,
  projectPath = '/workspace',
  className = '',
  onReady,
  onError,
}: CodeServerIDEProps) {
  const { user, isAuthenticated } = useAuth()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [session, setSession] = useState<CodeServerSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const startCodeServerSession = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setError('Authentication required')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/code-server/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          workspaceId,
          projectPath,
          userId: user.id,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to start code-server session: ${response.statusText}`)
      }

      const sessionData = await response.json()
      setSession(sessionData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start code-server'
      setError(errorMessage)
      onError?.(new Error(errorMessage))
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, user, workspaceId, projectPath, onError])

  const stopCodeServerSession = useCallback(async () => {
    if (!session) return

    try {
      await fetch(`/api/code-server/session/${session.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      setSession(null)
    } catch (err) {
      console.error('Failed to stop code-server session:', err)
    }
  }, [session])

  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe || !session) return

    try {
      // Configure iframe security and communication
      iframe.style.opacity = '1'

      // Set up message handling for VS Code extension communication
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== new URL(session.url).origin) return

        // Handle VS Code messages
        if (event.data.type === 'vscode-ready') {
          onReady?.(iframe)
        }
      }

      window.addEventListener('message', handleMessage)

      return () => {
        window.removeEventListener('message', handleMessage)
      }
    } catch (err) {
      console.error('Error setting up iframe communication:', err)
    }
  }, [session, onReady])

  const handleIframeError = useCallback(() => {
    const errorMessage = 'Failed to load code-server IDE'
    setError(errorMessage)
    onError?.(new Error(errorMessage))
  }, [onError])

  // Start session on mount
  useEffect(() => {
    if (isAuthenticated && user) {
      startCodeServerSession()
    }
  }, [isAuthenticated, user, startCodeServerSession])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (session) {
        stopCodeServerSession()
      }
    }
  }, [session, stopCodeServerSession])

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 text-white ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-sm text-gray-300">Starting VS Code environment...</p>
          <p className="text-xs text-gray-500 mt-2">Workspace: {workspaceId}</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 text-white ${className}`}>
        <div className="text-center max-w-md">
          <div className="text-red-400 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">IDE Error</h3>
          <p className="text-sm text-gray-300 mb-4">{error}</p>
          <button
            onClick={startCodeServerSession}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // No session available
  if (!session) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 text-white ${className}`}>
        <div className="text-center">
          <p className="text-sm text-gray-300">No IDE session available</p>
          <button
            onClick={startCodeServerSession}
            className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium transition-colors"
          >
            Start IDE
          </button>
        </div>
      </div>
    )
  }

  // Render code-server iframe
  return (
    <div className={`relative bg-gray-900 ${className}`}>
      {session.status === 'starting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-xs text-gray-400">Connecting to VS Code...</p>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={session.url}
        className="w-full h-full border-0"
        style={{
          opacity: session.status === 'ready' ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out'
        }}
        title="VS Code IDE"
        sandbox="allow-same-origin allow-scripts allow-forms allow-pointer-lock allow-popups allow-modals"
        allow="clipboard-read; clipboard-write; web-share"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
      />

      {/* IDE Controls */}
      <div className="absolute top-2 right-2 flex space-x-2 z-20">
        <button
          onClick={() => {
            if (iframeRef.current) {
              iframeRef.current.contentWindow?.location.reload()
            }
          }}
          className="p-1 bg-gray-800 hover:bg-gray-700 rounded text-white text-xs opacity-80 hover:opacity-100 transition-opacity"
          title="Refresh IDE"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        <button
          onClick={stopCodeServerSession}
          className="p-1 bg-red-600 hover:bg-red-700 rounded text-white text-xs opacity-80 hover:opacity-100 transition-opacity"
          title="Stop IDE Session"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
