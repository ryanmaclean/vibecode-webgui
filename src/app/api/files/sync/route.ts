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
<<<<<<< Updated upstream
import type { FileSystemConfig, FileSyncEvent } from '@/lib/file-system-operations'
import { prisma } from '@/lib/prisma'
import { vectorStore } from '@/lib/vector-store'
=======
import type { FileSystemConfig, FileSyncEvent, SecureFileSystemOperations } from '@/lib/file-system-operations'
import { parseFileSyncMessage } from '@/lib/file-sync/websocket'
import { subscriptionManager } from '@/lib/file-sync/subscription-manager'
import { z } from 'zod'

type StatsdClient = {
  increment: (metric: string, value?: number, tags?: Record<string, string>) => void
  histogram: (metric: string, value: number, tags?: Record<string, string>) => void
}

const statsd = tracer?.dogstatsd as StatsdClient | undefined
>>>>>>> Stashed changes

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'

<<<<<<< Updated upstream
interface WebSocketMessage {
  type: string;
  payload?: any; // To be refined in future implementations
=======
// Zod validation schemas for file sync operations

// Workspace ID validation with security controls
const WorkspaceIdSchema = z.string()
  .min(1, 'Workspace ID cannot be empty')
  .max(64, 'Workspace ID exceeds maximum length')
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Workspace ID must contain only alphanumeric characters, hyphens, and underscores'
  )
  .refine(
    (id) => !id.includes('..') && !id.startsWith('.') && !id.endsWith('.'),
    'Workspace ID contains invalid path traversal patterns'
  )

// File path validation - prevents path traversal attacks
const FilePathSchema = z.string()
  .min(1, 'File path cannot be empty')
  .max(1024, 'File path exceeds maximum length')
  .refine(
    (path) => {
      // Prevent path traversal
      if (path.includes('..')) return false
      // Prevent absolute paths
      if (path.startsWith('/') || path.startsWith('\\')) return false
      // Prevent drive letters (Windows)
      if (/^[a-zA-Z]:/.test(path)) return false
      // Prevent null bytes
      if (path.includes('\0')) return false
      return true
    },
    'File path contains invalid or unsafe patterns'
  )
  .refine(
    (path) => {
      // Block access to sensitive system files
      const blockedPatterns = [
        /\/etc\//i,
        /\/proc\//i,
        /\/sys\//i,
        /\/dev\//i,
        /\.ssh\//i,
        /\.git\//i,
        /node_modules\//i,
        /\.env/i,
        /\.key/i,
        /\.pem/i,
        /\.crt/i,
        /id_rsa/i,
        /id_dsa/i,
        /authorized_keys/i
      ]
      return !blockedPatterns.some(pattern => pattern.test(path))
    },
    'File path accesses restricted system or sensitive files'
  )

// File content validation with size limits
const FileContentSchema = z.string()
  .max(10 * 1024 * 1024, 'File content exceeds 10MB limit') // DoS protection

// File type validation
const FileTypeSchema = z.enum(['file', 'directory'], {
  errorMap: () => ({ message: 'File type must be either "file" or "directory"' })
})

// Individual file validation schema
const FileSyncItemSchema = z.object({
  path: FilePathSchema,
  content: FileContentSchema,
  type: FileTypeSchema
}).strict()

// GET query parameters validation
const GetQuerySchema = z.object({
  workspaceId: WorkspaceIdSchema
})

// POST body validation with array size limit (DoS protection)
const PostBodySchema = z.object({
  workspaceId: WorkspaceIdSchema,
  files: z.array(FileSyncItemSchema)
    .min(1, 'Files array cannot be empty')
    .max(1000, 'Files array exceeds maximum of 1000 items') // DoS protection
}).strict()

// WebSocket connections per workspace (used for wide broadcasts)
const workspaceConnections = new Map<string, Set<WebSocket>>()

type RealtimeFileSystem = SecureFileSystemOperations & {
  handleFileUpdate?: (payload: unknown) => void
>>>>>>> Stashed changes
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
    const workspaceIdParam = searchParams.get('workspaceId')

    // Validate query parameters
    const queryValidation = GetQuerySchema.safeParse({
      workspaceId: workspaceIdParam
    })

    if (!queryValidation.success) {
      console.warn('[FILE_SYNC] Invalid GET query parameters', {
        errors: queryValidation.error.errors,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userId: session.user.id
      })
      return NextResponse.json(
        {
          error: 'Invalid request parameters',
          details: queryValidation.error.errors.map(e => e.message)
        },
        { status: 400 }
      )
    }

    const workspaceId = queryValidation.data.workspaceId

    // Validate workspace access
    if (!await hasWorkspaceAccess(session.user.id, workspaceId)) {
      console.warn('[FILE_SYNC] Access denied to workspace', {
        workspaceId,
        userId: session.user.id,
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      })
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

    // Parse request body
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    // Validate request body with comprehensive security checks
    const bodyValidation = PostBodySchema.safeParse(body)

    if (!bodyValidation.success) {
      console.warn('[FILE_SYNC] Invalid POST body', {
        errors: bodyValidation.error.errors,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userId: session.user.id,
        fileCount: Array.isArray(body?.files) ? body.files.length : 'invalid'
      })
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: bodyValidation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        },
        { status: 400 }
      )
    }

    const { workspaceId, files } = bodyValidation.data

    // Validate workspace access
    if (!await hasWorkspaceAccess(session.user.id, workspaceId)) {
      console.warn('[FILE_SYNC] Access denied to workspace in POST', {
        workspaceId,
        userId: session.user.id,
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      })
      return NextResponse.json(
        { error: 'Access denied to workspace' },
        { status: 403 }
      )
    }

    // Additional validation: Check total content size (DoS protection)
    const totalContentSize = files.reduce((sum, file) => sum + file.content.length, 0)
    const MAX_TOTAL_SIZE = 50 * 1024 * 1024 // 50MB total limit

    if (totalContentSize > MAX_TOTAL_SIZE) {
      console.warn('[FILE_SYNC] Total content size exceeds limit', {
        workspaceId,
        userId: session.user.id,
        totalContentSize,
        maxSize: MAX_TOTAL_SIZE,
        fileCount: files.length
      })
      return NextResponse.json(
        { error: 'Total content size exceeds 50MB limit' },
        { status: 413 }
      )
    }

    // This endpoint is for manual bulk sync, e.g., on project import
    // Real-time sync is handled via WebSocket
    try {
      await createFilesInWorkspace(workspaceId, files)

      console.info('[FILE_SYNC] Bulk sync completed', {
        workspaceId,
        userId: session.user.id,
        fileCount: files.length,
        totalSize: totalContentSize
      })

      return NextResponse.json({
        success: true,
        message: 'Sync initiated',
        fileCount: files.length
      })
    } catch (error) {
      console.error('[FILE_SYNC] File creation error:', error)
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
    const { searchParams } = new URL(request.url || '', `http://${request.headers.get('host') || 'localhost'}`)
    const workspaceId = searchParams.get('workspaceId') || ''
    const userId = searchParams.get('userId') || ''

    try {
      // Validate connection parameters with Zod
      const wsParamsValidation = z.object({
        workspaceId: WorkspaceIdSchema,
        userId: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/)
      }).safeParse({ workspaceId, userId })

      if (!wsParamsValidation.success) {
        console.warn('[FILE_SYNC_WS] Invalid WebSocket parameters', {
          errors: wsParamsValidation.error.errors,
          workspaceId,
          userId
        })
        ws.close(1008, 'Invalid connection parameters')
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
        userId,
        workingDirectory: `/tmp/workspaces/${workspaceId}`,
        enableRealTimeSync: true,
        conflictResolution: 'auto-merge'
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
              (fileSystem as any).handleFileUpdate?.(message.payload)
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

<<<<<<< Updated upstream
=======
function handleSubscription(socket: WebSocket, workspaceId: string, rawPath: string) {
  // Validate file path before subscribing
  const pathValidation = FilePathSchema.safeParse(rawPath)

  if (!pathValidation.success) {
    console.warn('[FILE_SYNC_WS] Invalid subscription path', {
      workspaceId,
      rawPath,
      errors: pathValidation.error.errors
    })
    socket.send(
      JSON.stringify({
        type: 'error',
        reason: 'Invalid file path for subscription',
        timestamp: new Date(),
      }),
    )
    return
  }

  const outcome = subscriptionManager.subscribe(workspaceId, pathValidation.data, socket)

  if (!outcome.ok) {
    recordSubscriptionError(workspaceId, outcome.reason)
    socket.send(
      JSON.stringify({
        type: 'error',
        reason: outcome.reason,
        timestamp: new Date(),
      }),
    )
    return
  }

  recordSubscriptionSuccess(workspaceId, outcome.path)
  socket.send(
    JSON.stringify({
      type: 'subscribed',
      workspaceId,
      path: outcome.path,
      timestamp: new Date(),
    }),
  )
}

>>>>>>> Stashed changes
/**
 * Validate user access to workspace
 */
async function hasWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
  // TODO: Implement proper workspace access validation
  if (!userId || !workspaceId) {
    return false
  }

  // Validate formats
  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId) || workspaceId.length > 64) {
    return false
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(userId) || userId.length > 64) {
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
