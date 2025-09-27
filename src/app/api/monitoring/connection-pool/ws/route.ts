/**
 * WebSocket endpoint for real-time connection pool monitoring
 * Provides real-time updates for database connection pool metrics and alerts
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { WebSocketServer, WebSocket } from 'ws'
import ConnectionPoolAlertService from '@/lib/db/connection-pool-alerts'
import { connectionPoolMonitor } from '@/lib/monitoring/connection-pool-monitor'
import type { Alert } from '@/lib/db/connection-pool-alerts'

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'

interface ConnectionPoolWebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'heartbeat' | 'error'
  data?: unknown
  timestamp: string
}

interface PoolUpdateMessage extends ConnectionPoolWebSocketMessage {
  type: 'pool_update'
  data: {
    poolName: string
    metrics: unknown
    alerts: Alert[]
  }
}

interface SystemOverviewMessage extends ConnectionPoolWebSocketMessage {
  type: 'system_overview'
  data: {
    overview: unknown
    capacityReports: unknown[]
  }
}

// WebSocket connections for monitoring clients
const monitoringConnections = new Set<WebSocket>()

// Global WebSocket server for monitoring
declare global {
  var monitoringWss: WebSocketServer | undefined
}

// Initialize WebSocket server if it doesn't exist
if (!global.monitoringWss) {
  global.monitoringWss = new WebSocketServer({ noServer: true })
  console.log('Monitoring WebSocket server initialized')

  global.monitoringWss.on('connection', async (ws: WebSocket, request: NextRequest) => {
    console.log('New monitoring WebSocket connection established')
    
    // Add connection to monitoring set
    monitoringConnections.add(ws)
    
    // Set up connection pool monitoring listeners
    const alertService = ConnectionPoolAlertService.getInstance()
    const poolMonitor = connectionPoolMonitor

    // Alert listener for real-time alert updates
    const alertListener = (alert: Alert) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'alert_update',
          data: { alert },
          timestamp: new Date().toISOString()
        }))
      }
    }

    // Pool metrics listener for real-time updates
    const metricsListener = (poolName: string, metrics: unknown) => {
      if (ws.readyState === WebSocket.OPEN) {
        const activeAlerts = alertService.getActiveAlerts()
        ws.send(JSON.stringify({
          type: 'pool_update',
          data: {
            poolName,
            metrics,
            alerts: activeAlerts
          },
          timestamp: new Date().toISOString()
        } satisfies PoolUpdateMessage))
      }
    }

    // System overview updates
    const sendSystemOverview = () => {
      if (ws.readyState === WebSocket.OPEN) {
        const overview = poolMonitor.getSystemOverview()
        const capacityReports = poolMonitor.generateCapacityReport()
        
        ws.send(JSON.stringify({
          type: 'system_overview',
          data: {
            overview,
            capacityReports
          },
          timestamp: new Date().toISOString()
        } satisfies SystemOverviewMessage))
      }
    }

    // Add listeners
    alertService.addAlertListener(alertListener)
    poolMonitor.on('metricsUpdated', metricsListener)
    poolMonitor.on('alertCreated', alertListener)
    poolMonitor.on('alertResolved', alertListener)

    // Send initial data
    sendSystemOverview()
    
    // Send periodic system overviews every 30 seconds
    const overviewInterval = setInterval(sendSystemOverview, 30000)

    // Handle incoming messages
    ws.on('message', async (data: Buffer) => {
      try {
        const message: ConnectionPoolWebSocketMessage = JSON.parse(data.toString())
        
        switch (message.type) {
          case 'heartbeat':
            // Respond to heartbeat
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'heartbeat',
                timestamp: new Date().toISOString()
              }))
            }
            break
            
          case 'subscribe':
            // Client wants to subscribe to real-time updates
            // Already handled by default connection setup
            console.log('Client subscribed to real-time monitoring updates')
            break
            
          case 'unsubscribe':
            // Client wants to unsubscribe (will be handled by cleanup)
            console.log('Client requested unsubscribe from real-time updates')
            break
            
          default:
            ws.send(JSON.stringify({
              type: 'error',
              data: { message: `Unknown message type: ${message.type}` },
              timestamp: new Date().toISOString()
            }))
        }
      } catch (error) {
        console.error('Error processing monitoring WebSocket message:', error)
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Failed to process message' },
            timestamp: new Date().toISOString()
          }))
        }
      }
    })

    // Handle connection close
    ws.on('close', () => {
      console.log('Monitoring WebSocket connection closed')
      
      // Clean up listeners
      alertService.removeAlertListener(alertListener)
      poolMonitor.removeListener('metricsUpdated', metricsListener)
      poolMonitor.removeListener('alertCreated', alertListener)
      poolMonitor.removeListener('alertResolved', alertListener)
      
      // Clear interval
      clearInterval(overviewInterval)
      
      // Remove from connections set
      monitoringConnections.delete(ws)
    })

    // Handle connection errors
    ws.on('error', (error) => {
      console.error('Monitoring WebSocket error:', error)
      monitoringConnections.delete(ws)
    })
  })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  // Check authentication
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Upgrade to WebSocket
  const upgrade = request.headers.get('upgrade')
  if (upgrade !== 'websocket') {
    return new Response('Expected websocket', { status: 400 })
  }

  return new Response(null, {
    status: 101,
    headers: {
      'Upgrade': 'websocket',
      'Connection': 'Upgrade'
    }
  })
}

// Utility function to broadcast to all monitoring clients
export function broadcastToMonitoringClients(message: ConnectionPoolWebSocketMessage) {
  const messageStr = JSON.stringify(message)
  
  monitoringConnections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr)
    } else {
      // Remove closed connections
      monitoringConnections.delete(ws)
    }
  })
}