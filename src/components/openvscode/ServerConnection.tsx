'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'

export interface ServerStatus {
  running: boolean
  port?: number
  pid?: number
  url?: string
  startup_time?: number
}

export interface ServerConnectionProps {
  onStatusChange?: (status: ServerStatus) => void
  onError?: (error: string) => void
  autoStart?: boolean
  children?: (props: ServerConnectionState) => React.ReactNode
}

export interface ServerConnectionState {
  status: ServerStatus | null
  isLoading: boolean
  error: string | null
  startServer: () => Promise<void>
  stopServer: () => Promise<void>
  restartServer: () => Promise<void>
  checkStatus: () => Promise<void>
}

/**
 * ServerConnection - Manages connection state to the OpenVSCode/code-server backend
 *
 * This component handles:
 * - Starting/stopping the code server
 * - Monitoring server health
 * - Auto-reconnection logic
 * - Error handling and recovery
 *
 * Usage:
 * ```tsx
 * <ServerConnection autoStart>
 *   {({ status, isLoading, error, startServer }) => (
 *     // Your UI here
 *   )}
 * </ServerConnection>
 * ```
 */
export function ServerConnection({
  onStatusChange,
  onError,
  autoStart = true,
  children,
}: ServerConnectionProps) {
  const [status, setStatus] = useState<ServerStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const healthCheckInterval = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 3

  // Update parent component when status changes
  useEffect(() => {
    if (status && onStatusChange) {
      onStatusChange(status)
    }
  }, [status, onStatusChange])

  // Update parent component when error occurs
  useEffect(() => {
    if (error && onError) {
      onError(error)
    }
  }, [error, onError])

  const checkStatus = useCallback(async () => {
    try {
      // Check if we're in Tauri environment
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        const serverStatus = await invoke<ServerStatus>('get_server_status')
        setStatus(serverStatus)
        setError(null)
        reconnectAttempts.current = 0
      } else {
        // Web environment - check via HTTP
        try {
          const response = await fetch('http://127.0.0.1:8080/healthz')
          if (response.ok) {
            setStatus({
              running: true,
              port: 8080,
              url: 'http://127.0.0.1:8080',
            })
            setError(null)
            reconnectAttempts.current = 0
          }
        } catch (err) {
          // Server not running, but this is not an error state for web
          setStatus({ running: false })
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('Failed to check server status:', errorMessage)

      // Only set error if we've exceeded reconnect attempts
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        setError(errorMessage)
        setStatus({ running: false })
      }
    }
  }, [])

  const startServer = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        const serverStatus = await invoke<ServerStatus>('start_server')
        setStatus(serverStatus)
        reconnectAttempts.current = 0
      } else {
        throw new Error('Server start is only available in Tauri environment')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      reconnectAttempts.current++

      // Auto-retry if under max attempts
      if (reconnectAttempts.current < maxReconnectAttempts) {
        console.log(`Retry attempt ${reconnectAttempts.current}/${maxReconnectAttempts}`)
        setTimeout(() => startServer(), 2000 * reconnectAttempts.current)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const stopServer = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        await invoke('stop_server')
        setStatus({ running: false })
      } else {
        throw new Error('Server stop is only available in Tauri environment')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const restartServer = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        const serverStatus = await invoke<ServerStatus>('restart_server')
        setStatus(serverStatus)
        reconnectAttempts.current = 0
      } else {
        throw new Error('Server restart is only available in Tauri environment')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Auto-start on mount
  useEffect(() => {
    if (autoStart) {
      checkStatus().then(() => {
        // If server is not running, try to start it
        if (!status?.running) {
          startServer()
        }
      })
    }
  }, [autoStart]) // Only run on mount

  // Health check polling
  useEffect(() => {
    if (status?.running) {
      // Poll every 30 seconds to ensure server is still alive
      healthCheckInterval.current = setInterval(() => {
        checkStatus()
      }, 30000)
    }

    return () => {
      if (healthCheckInterval.current) {
        clearInterval(healthCheckInterval.current)
        healthCheckInterval.current = null
      }
    }
  }, [status?.running, checkStatus])

  const connectionState: ServerConnectionState = {
    status,
    isLoading,
    error,
    startServer,
    stopServer,
    restartServer,
    checkStatus,
  }

  return children ? <>{children(connectionState)}</> : null
}

/**
 * useServerConnection - Hook for accessing server connection state
 * Use this when you need to access server state outside of the ServerConnection component
 */
export function useServerConnection() {
  const [status, setStatus] = useState<ServerStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkStatus = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        const serverStatus = await invoke<ServerStatus>('get_server_status')
        setStatus(serverStatus)
        setError(null)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
    }
  }, [])

  const startServer = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        const serverStatus = await invoke<ServerStatus>('start_server')
        setStatus(serverStatus)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const stopServer = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        await invoke('stop_server')
        setStatus({ running: false })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    status,
    isLoading,
    error,
    startServer,
    stopServer,
    checkStatus,
  }
}
