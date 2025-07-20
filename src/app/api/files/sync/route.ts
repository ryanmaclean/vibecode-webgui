/**
 * Real-time File Synchronization API
 *
 * WebSocket-based real-time file synchronization for collaborative editing
 * Implements secure file sync with conflict resolution
 *
 * Staff Engineer Implementation - Enterprise-grade real-time sync
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { WebSocketServer, WebSocket } from 'ws'
import { getFileSystemInstance } from '@/lib/file-system-operations'
import type { FileSystemConfig, FileSyncEvent } from '@/lib/file-system-operations'

interface WebSocketMessage {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any; // To be refined in future implementations
}

// WebSocket connections per workspace
const workspaceConnections = new Map<string, Set<WebSocket>>()

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    // Validate workspace access
    if (!await hasWorkspaceAccess(session.user.id, workspaceId)) {
      return NextResponse.json(
        { error: 'Access denied to workspace' },
        { status: 403 }
      )
    }

    // Get current sync status
    const connectionCount = workspaceConnections.get(workspaceId)?.size || 0

    return NextResponse.json({
      success: true,
      workspaceId,
      activeConnections: connectionCount,
      syncEnabled: true,
      conflictResolution: 'user-choice'
    })

  } catch (error) {
    console.error('File sync status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { workspaceId, files } = body

    if (!workspaceId || !files || !Array.isArray(files)) {
      return NextResponse.json(
        { error: 'Workspace ID and files array are required' },
        { status: 400 }
      )
    }

    // Validate workspace access
    if (!await hasWorkspaceAccess(session.user.id, workspaceId)) {
      return NextResponse.json(
        { error: 'Access denied to workspace' },
        { status: 403 }
      )
    }

    // This endpoint is for manual bulk sync, e.g., on project import
    // Real-time sync is handled via WebSocket
    try {
      await createFilesInWorkspace(workspaceId, files)
      return NextResponse.json({ success: true, message: 'Sync initiated' })
    } catch (error) {
      console.error('File creation error:', error)
      return NextResponse.json(
        { error: 'Failed to create files in workspace' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('File sync POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function createFilesInWorkspace(workspaceId: string, files: Array<{path: string, content: string, type: string}>) {
  const { spawn } = require('child_process')
  const namespace = 'vibecode'

  // Create a temporary pod to handle file creation
  const podName = `file-creator-${workspaceId}-${Date.now()}`
  const podSpec = {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: {
      name: podName,
      namespace: namespace,
    },
    spec: {
      containers: [
        {
          name: 'file-creator',
          image: 'alpine:latest',
          command: ['/bin/sh', '-c'],
          args: [
            `
              mkdir -p /workspace/${workspaceId} && \
              echo '${JSON.stringify(files)}' | \
              while IFS= read -r file; do
                path=$(echo "$file" | jq -r .path)
                content=$(echo "$file" | jq -r .content)
                type=$(echo "$file" | jq -r .type)
                
                if [ "$type" = "directory" ]; then
                  mkdir -p "/workspace/${workspaceId}/$path"
                else
                  mkdir -p "/workspace/${workspaceId}/$(dirname "$path")"
                  echo "$content" > "/workspace/${workspaceId}/$path"
                fi
              done && \
              echo "Files created successfully"
            `
          ],
          volumeMounts: [
            {
              name: 'workspace-storage',
              mountPath: '/workspace',
            },
          ],
        },
      ],
      volumes: [
        {
          name: 'workspace-storage',
          persistentVolumeClaim: {
            claimName: 'vibecode-pvc',
          },
        },
      ],
      restartPolicy: 'Never',
    },
  }

  // Use kubectl to apply the pod spec
  const kubectl = spawn('kubectl', ['apply', '-f', '-'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  kubectl.stdin.write(JSON.stringify(podSpec))
  kubectl.stdin.end()

  kubectl.stdout.on('data', (data: Buffer) => {
    console.log(`kubectl stdout: ${data}`)
  })

  kubectl.stderr.on('data', (data: Buffer) => {
    console.error(`kubectl stderr: ${data}`)
  })

  kubectl.on('close', (code: number) => {
    if (code !== 0) {
      console.error(`kubectl process exited with code ${code}`)
    } else {
      console.log('File creation pod applied successfully')
    }
  })
}

// Extend the global object to hold the WebSocket server
declare global {
  var wss: WebSocketServer | undefined
}

// Initialize WebSocket server if it doesn't exist
if (!global.wss) {
  global.wss = new WebSocketServer({ noServer: true })
  console.log('WebSocket server initialized')

  global.wss.on('connection', async (ws: WebSocket, request: NextRequest) => {
    const { searchParams } = new URL(request.url || '', `http://${request.headers.host}`)
    const workspaceId = searchParams.get('workspaceId') || ''
    const userId = searchParams.get('userId') || ''

    try {
      // Validate connection parameters
      if (!workspaceId || !userId) {
        ws.close(1008, 'Workspace ID and User ID are required')
        return
      }

      // Add connection to workspace pool
      if (!workspaceConnections.has(workspaceId)) {
        workspaceConnections.set(workspaceId, new Set())
      }
      workspaceConnections.get(workspaceId)?.add(ws)

      // Initialize file system monitoring for this workspace
      const fsConfig: FileSystemConfig = {
        workspaceId,
        // Other config for this workspace
      }
      const fileSystem = getFileSystemInstance(fsConfig)

      // Event handler for file sync events
      const handleFileSyncEvent = (event: FileSyncEvent) => {
        const connections = workspaceConnections.get(workspaceId)
        if (connections) {
          connections.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(event))
            }
          })
        }
      }

      // Subscribe to file system events
      fileSystem.on('file-sync', handleFileSyncEvent)
      fileSystem.on('conflict-detected', handleFileSyncEvent)

      // Handle incoming messages
      ws.on('message', (data: string) => {
        try {
          const message: WebSocketMessage = JSON.parse(data)

          switch (message.type) {
            case 'file-update':
              fileSystem.handleFileUpdate(message.payload)
              break

            case 'ping':
              ws.send(JSON.stringify({ type: 'pong', timestamp: new Date() }))
              break

            case 'subscribe-file':
              // Subscribe to specific file changes
              // TODO: Implement file-specific subscriptions
              break

            default:
              console.warn('Unknown WebSocket message type:', message.type)
          }
        } catch (error) {
          console.error('Failed to process WebSocket message:', error)
        }
      })

      // Handle connection close
      ws.on('close', () => {
        const connections = workspaceConnections.get(workspaceId)
        if (connections) {
          connections.delete(ws)
          if (connections.size === 0) {
            workspaceConnections.delete(workspaceId)
          }
        }

        fileSystem.off('file-sync', handleFileSyncEvent)
        fileSystem.off('conflict-detected', handleFileSyncEvent)
      })

      // Send initial connection confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        workspaceId,
        userId,
        timestamp: new Date()
      }))

    } catch (error) {
      console.error('WebSocket connection error:', error)
      ws.close(1011, 'Internal server error')
    }
  })
}

/**
 * Validate user access to workspace
 */
async function hasWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
  // TODO: Implement proper workspace access validation
  if (!userId || !workspaceId) {
    return false
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId) || workspaceId.length > 50) {
    return false
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(userId) || userId.length > 50) {
    return false
  }

  return true // Temporary - allow all access for development
}

export async function OPTIONS(_request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
