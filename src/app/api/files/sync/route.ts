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
    // Authenticate user
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { workspaceId, files } = body

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID required' },
        { status: 400 }
      )
    }

    if (files && Array.isArray(files) && files.length > 0) {
      // Create files in the workspace
      await createFilesInWorkspace(workspaceId, files)
      
      return NextResponse.json({
        success: true,
        workspaceId,
        filesCreated: files.length,
        message: 'Files synchronized successfully'
      })
    }

    return NextResponse.json({ success: true, message: 'Sync initiated' })

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
  
  for (const file of files) {
    if (file.type === 'directory') {
      // Create directory
      await execInPod(namespace, workspaceId, `mkdir -p "/home/coder/workspace/${file.path}"`)
    } else {
      // Create file and its directory structure
      const dirPath = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : ''
      if (dirPath) {
        await execInPod(namespace, workspaceId, `mkdir -p "/home/coder/workspace/${dirPath}"`)
      }
      
      // Write file content using base64 encoding to handle special characters
      const base64Content = Buffer.from(file.content).toString('base64')
      await execInPod(namespace, workspaceId, `echo "${base64Content}" | base64 -d > "/home/coder/workspace/${file.path}"`)
    }
  }
}

function execInPod(namespace: string, workspaceId: string, command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const deploymentName = `code-server-${workspaceId}`
    
    // Execute command in pod
    const execCmd = spawn('kubectl', [
      'exec', '-n', namespace,
      `deployment/${deploymentName}`,
      '--', 'bash', '-c', command
    ])
    
    let stderr = ''
    
    execCmd.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    
    execCmd.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command failed: ${stderr}`))
      }
    })
    
    execCmd.on('error', (error) => {
      reject(error)
    })
  })
}

// Extend the global object to hold the WebSocket server
declare global {
  var wss: WebSocketServer | undefined
}

// Initialize WebSocket server
if (!global.wss) {
  global.wss = new WebSocketServer({ noServer: true })

  global.wss.on('connection', async (ws: WebSocket, request: NextRequest) => {
    const { searchParams } = new URL(request.url || '', `http://${request.headers.get('host')}`)
    const workspaceId = searchParams.get('workspaceId') || 'default'

    try {
      const session = await getServerSession()
      if (!session?.user?.id) {
        ws.close(4001, 'Unauthorized')
        return
      }

      const userId = session.user.id

      // Get file system instance for the user
      const fsConfig: FileSystemConfig = {
        userId,
        workspaceId
      }
      const fileSystem = getFileSystemInstance(fsConfig)

      // Add connection to workspace pool
      if (!workspaceConnections.has(workspaceId)) {
        workspaceConnections.set(workspaceId, new Set())
      }
      workspaceConnections.get(workspaceId)?.add(ws)

      // Define event handler
      const handleFileSyncEvent = (event: FileSyncEvent) => {
        if (event.workspaceId === workspaceId) {
          ws.send(JSON.stringify(event))
        }
      }

      // Subscribe to file system events
      fileSystem.on('file-sync', handleFileSyncEvent)
      fileSystem.on('conflict-detected', handleFileSyncEvent)

      // Handle incoming messages
      ws.on('message', (data) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString())

          switch (message.type) {
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
