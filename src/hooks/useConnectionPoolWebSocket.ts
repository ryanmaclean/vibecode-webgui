/**
 * Custom hook for real-time connection pool monitoring via WebSocket
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'

interface WebSocketMessage {
  type: string
  data?: unknown
  timestamp: string
}

interface PoolUpdateMessage extends WebSocketMessage {
  type: 'pool_update'
  data: {
    poolName: string
    metrics: unknown
    alerts: unknown[]
  }
}

interface SystemOverviewMessage extends WebSocketMessage {
  type: 'system_overview'
  data: {
    overview: unknown
    capacityReports: unknown[]
  }
}

interface AlertUpdateMessage extends WebSocketMessage {
  type: 'alert_update'
  data: {
    alert: unknown
  }
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

interface UseConnectionPoolWebSocketOptions {
  enabled?: boolean
  reconnectAttempts?: number
  reconnectDelay?: number
}

export function useConnectionPoolWebSocket(options: UseConnectionPoolWebSocketOptions = {}) {
  const { data: session } = useSession()
  const {
    enabled = true,
    reconnectAttempts = 5,
    reconnectDelay = 3000
  } = options

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const [systemOverview, setSystemOverview] = useState<unknown>(null)
  const [poolMetrics, setPoolMetrics] = useState<Map<string, unknown>>(new Map())
  const [alerts, setAlerts] = useState<unknown[]>([])
  const [error, setError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectCountRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Clear reconnect timeout
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  // Send message to WebSocket
  const sendMessage = useCallback((message: Omit<WebSocketMessage, 'timestamp'>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        ...message,
        timestamp: new Date().toISOString()
      }))
    }
  }, [])

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!enabled || !session?.user || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return
    }

    try {
      setConnectionState('connecting')
      setError(null)

      // Create WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/api/monitoring/connection-pool/ws`

      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onopen = () => {
        console.log('Connection pool monitoring WebSocket connected')
        setConnectionState('connected')
        reconnectCountRef.current = 0
        
        // Subscribe to updates
        sendMessage({ type: 'subscribe' })
        
        // Start heartbeat
        const heartbeatInterval = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            sendMessage({ type: 'heartbeat' })
          } else {
            clearInterval(heartbeatInterval)
          }
        }, 30000)
      }

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          setLastMessage(message)

          switch (message.type) {
            case 'system_overview':
              const overviewMsg = message as SystemOverviewMessage
              setSystemOverview(overviewMsg.data.overview)
              break

            case 'pool_update':
              const poolMsg = message as PoolUpdateMessage
              setPoolMetrics(prev => {
                const newMap = new Map(prev)
                newMap.set(poolMsg.data.poolName, poolMsg.data.metrics)
                return newMap
              })
              setAlerts(poolMsg.data.alerts)
              break

            case 'alert_update':
              const alertMsg = message as AlertUpdateMessage
              setAlerts(prev => {
                // Add or update alert
                const alertId = (alertMsg.data.alert as any)?.id
                if (alertId) {
                  const existingIndex = prev.findIndex((alert: any) => alert.id === alertId)
                  if (existingIndex >= 0) {
                    const updated = [...prev]
                    updated[existingIndex] = alertMsg.data.alert
                    return updated
                  } else {
                    return [...prev, alertMsg.data.alert]
                  }
                }
                return prev
              })
              break

            case 'heartbeat':
              // Heartbeat response - connection is alive
              break

            case 'error':
              console.error('WebSocket error message:', message.data)
              setError(JSON.stringify(message.data))
              break
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
          setError('Failed to parse WebSocket message')
        }
      }

      wsRef.current.onclose = (event) => {
        console.log('Connection pool monitoring WebSocket closed:', event.code, event.reason)
        setConnectionState('disconnected')
        
        // Attempt to reconnect if not intentional close
        if (event.code !== 1000 && reconnectCountRef.current < reconnectAttempts) {
          clearReconnectTimeout()
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectCountRef.current++
            console.log(`Attempting to reconnect... (${reconnectCountRef.current}/${reconnectAttempts})`)
            connect()
          }, reconnectDelay)
        }
      }

      wsRef.current.onerror = (error) => {
        console.error('Connection pool monitoring WebSocket error:', error)
        setConnectionState('error')
        setError('WebSocket connection error')
      }
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      setConnectionState('error')
      setError(`Connection failed: ${(error as Error).message}`)
    }
  }, [enabled, session, reconnectAttempts, reconnectDelay, sendMessage, clearReconnectTimeout])

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    clearReconnectTimeout()
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect')
      wsRef.current = null
    }
    
    setConnectionState('disconnected')
    setError(null)
  }, [clearReconnectTimeout])

  // Connect on mount and when dependencies change
  useEffect(() => {
    if (enabled && session?.user) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      disconnect()
    }
  }, [enabled, session, connect, disconnect])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearReconnectTimeout()
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount')
      }
    }
  }, [clearReconnectTimeout])

  return {
    connectionState,
    lastMessage,
    systemOverview,
    poolMetrics,
    alerts,
    error,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting',
    connect,
    disconnect,
    sendMessage
  }
}