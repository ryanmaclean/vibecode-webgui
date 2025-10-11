import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { mongodbChatService } from './chat-mongodb'
import { datadogMetrics } from '../monitoring/datadog-metrics'

export interface CollaborativeUser {
  id: string
  name: string
  avatar?: string
  color: string
  isActive: boolean
  lastSeen: Date
  cursor?: {
    x: number
    y: number
    messageId?: string
  }
}

export interface WorkspaceState {
  id: string
  activeUsers: Map<string, CollaborativeUser>
  activeConversations: Set<string>
  sharedCursor: Map<string, { x: number; y: number; timestamp: Date }>
  typingUsers: Map<string, { conversationId: string; timestamp: Date }>
  lastActivity: Date
}

export interface CollaborationEvent {
  type: 'user_joined' | 'user_left' | 'user_typing' | 'message_sent' | 'cursor_moved' | 'file_shared'
  userId: string
  workspaceId: string
  conversationId?: string
  data?: any
  timestamp: Date
}

export class CollaborationService {
  private io: SocketIOServer | null = null
  private workspaces: Map<string, WorkspaceState> = new Map()
  private userColors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', 
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ]
  private colorIndex = 0

  initialize(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
        methods: ['GET', 'POST']
      },
      path: '/api/collaboration/socket'
    })

    this.setupEventHandlers()
    this.startCleanupInterval()
  }

  private setupEventHandlers() {
    if (!this.io) return

    this.io.on('connection', (socket) => {
      // Debug log removed

      socket.on('join_workspace', async (data) => {
        const { workspaceId, userId, userName, conversationId } = data
        await this.handleUserJoinWorkspace(socket, workspaceId, userId, userName, conversationId)
      })

      socket.on('leave_workspace', async (data) => {
        const { workspaceId, userId } = data
        await this.handleUserLeaveWorkspace(socket, workspaceId, userId)
      })

      socket.on('typing_start', (data) => {
        this.handleTypingStart(socket, data)
      })

      socket.on('typing_stop', (data) => {
        this.handleTypingStop(socket, data)
      })

      socket.on('cursor_move', (data) => {
        this.handleCursorMove(socket, data)
      })

      socket.on('message_draft', (data) => {
        this.handleMessageDraft(socket, data)
      })

      socket.on('file_share', async (data) => {
        await this.handleFileShare(socket, data)
      })

      socket.on('disconnect', () => {
        this.handleDisconnect(socket)
      })
    })
  }

  private async handleUserJoinWorkspace(
    socket: any, 
    workspaceId: string, 
    userId: string, 
    userName: string, 
    conversationId?: string
  ) {
    try {
      // Join the workspace room
      await socket.join(`workspace:${workspaceId}`)
      if (conversationId) {
        await socket.join(`conversation:${conversationId}`)
      }

      // Get or create workspace state
      let workspace = this.workspaces.get(workspaceId)
      if (!workspace) {
        workspace = {
          id: workspaceId,
          activeUsers: new Map(),
          activeConversations: new Set(),
          sharedCursor: new Map(),
          typingUsers: new Map(),
          lastActivity: new Date()
        }
        this.workspaces.set(workspaceId, workspace)
      }

      // Add user to workspace
      const user: CollaborativeUser = {
        id: userId,
        name: userName,
        color: this.userColors[this.colorIndex % this.userColors.length],
        isActive: true,
        lastSeen: new Date()
      }
      this.colorIndex++

      workspace.activeUsers.set(userId, user)
      if (conversationId) {
        workspace.activeConversations.add(conversationId)
      }
      workspace.lastActivity = new Date()

      // Store socket metadata
      socket.userId = userId
      socket.workspaceId = workspaceId
      socket.conversationId = conversationId

      // Notify other users
      socket.to(`workspace:${workspaceId}`).emit('user_joined', {
        user,
        workspaceId,
        conversationId,
        activeUsers: Array.from(workspace.activeUsers.values())
      })

      // Send current workspace state to joining user
      socket.emit('workspace_state', {
        workspaceId,
        activeUsers: Array.from(workspace.activeUsers.values()),
        activeConversations: Array.from(workspace.activeConversations)
      })

      // Record collaboration metric
      datadogMetrics.recordUserAction('workspace_join', userId, workspaceId)

      // Debug log removed

    } catch (error) {
      console.error('Error handling user join workspace:', error)
      socket.emit('error', { message: 'Failed to join workspace' })
    }
  }

  private async handleUserLeaveWorkspace(socket: any, workspaceId: string, userId: string) {
    try {
      const workspace = this.workspaces.get(workspaceId)
      if (!workspace) return

      // Remove user from workspace
      const user = workspace.activeUsers.get(userId)
      workspace.activeUsers.delete(userId)
      workspace.typingUsers.delete(userId)
      workspace.sharedCursor.delete(userId)

      // Leave socket rooms
      await socket.leave(`workspace:${workspaceId}`)
      if (socket.conversationId) {
        await socket.leave(`conversation:${socket.conversationId}`)
      }

      // Notify other users
      socket.to(`workspace:${workspaceId}`).emit('user_left', {
        userId,
        user,
        workspaceId,
        activeUsers: Array.from(workspace.activeUsers.values())
      })

      // Clean up empty workspace
      if (workspace.activeUsers.size === 0) {
        this.workspaces.delete(workspaceId)
      }

      datadogMetrics.recordUserAction('workspace_leave', userId, workspaceId)

      // Debug log removed

    } catch (error) {
      console.error('Error handling user leave workspace:', error)
    }
  }

  private handleTypingStart(socket: any, data: { conversationId: string }) {
    const { conversationId } = data
    const { userId, workspaceId } = socket

    if (!userId || !workspaceId) return

    const workspace = this.workspaces.get(workspaceId)
    if (!workspace) return

    workspace.typingUsers.set(userId, {
      conversationId,
      timestamp: new Date()
    })

    // Notify other users in the conversation
    socket.to(`conversation:${conversationId}`).emit('user_typing', {
      userId,
      conversationId,
      isTyping: true
    })
  }

  private handleTypingStop(socket: any, data: { conversationId: string }) {
    const { conversationId } = data
    const { userId, workspaceId } = socket

    if (!userId || !workspaceId) return

    const workspace = this.workspaces.get(workspaceId)
    if (!workspace) return

    workspace.typingUsers.delete(userId)

    socket.to(`conversation:${conversationId}`).emit('user_typing', {
      userId,
      conversationId,
      isTyping: false
    })
  }

  private handleCursorMove(socket: any, data: { x: number, y: number, messageId?: string }) {
    const { userId, workspaceId } = socket
    if (!userId || !workspaceId) return

    const workspace = this.workspaces.get(workspaceId)
    if (!workspace) return

    workspace.sharedCursor.set(userId, {
      x: data.x,
      y: data.y,
      timestamp: new Date()
    })

    // Throttled broadcast to other users
    socket.to(`workspace:${workspaceId}`).emit('cursor_moved', {
      userId,
      cursor: data,
      timestamp: new Date()
    })
  }

  private handleMessageDraft(socket: any, data: { conversationId: string, content: string }) {
    const { conversationId, content } = data
    const { userId } = socket

    // Broadcast draft message to other users in conversation (for live previews)
    socket.to(`conversation:${conversationId}`).emit('message_draft', {
      userId,
      conversationId,
      content: content.slice(0, 100), // Limit draft preview length
      timestamp: new Date()
    })
  }

  private async handleFileShare(socket: any, data: { fileName: string, fileSize: number, conversationId: string }) {
    const { fileName, fileSize, conversationId } = data
    const { userId, workspaceId } = socket

    try {
      // Notify users in the conversation about file share
      socket.to(`conversation:${conversationId}`).emit('file_shared', {
        userId,
        fileName,
        fileSize,
        conversationId,
        timestamp: new Date()
      })

      datadogMetrics.recordUserAction('file_share', userId, workspaceId, {
        tags: { file_size: fileSize > 1024*1024 ? 'large' : 'small' }
      })
    } catch (error) {
      console.error('Error broadcasting file share:', error)
    }
  }

  private handleDisconnect(socket: any) {
    const { userId, workspaceId } = socket
    if (userId && workspaceId) {
      this.handleUserLeaveWorkspace(socket, workspaceId, userId)
    }
    // Debug log removed
  }

  // Broadcast message to all users in a conversation
  async broadcastMessage(conversationId: string, message: any, excludeUserId?: string) {
    if (!this.io) return

    const messageData = {
      ...message,
      timestamp: new Date()
    }

    // Let all clients handle this - if excludeUserId is set, clients will need to check
    // their own ID and ignore the message if they match
    this.io.to(`conversation:${conversationId}`).emit('new_message', {
      ...messageData,
      _excludeUserId: excludeUserId // Include this so clients can filter
<<<<<<< HEAD
    });
<<<<<<< HEAD
=======
<<<<<<< HEAD
    if (excludeUserId) {
      this.io.to(`conversation:${conversationId}`).except(excludeUserId).emit('new_message', messageData)
    } else {
      this.io.to(`conversation:${conversationId}`).emit('new_message', messageData)
    }
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
  }
=======
    });  }
>>>>>>> fix/consolidated-dependency-updates

  // Broadcast workspace events
  async broadcastWorkspaceEvent(workspaceId: string, event: CollaborationEvent) {
    if (!this.io) return

    this.io.to(`workspace:${workspaceId}`).emit('workspace_event', event)
    
    datadogMetrics.recordUserAction('collaboration_event', event.userId, workspaceId, {
      tags: { event_type: event.type }
    })
  }

  // Get workspace statistics
  getWorkspaceStats(workspaceId: string) {
    const workspace = this.workspaces.get(workspaceId)
    if (!workspace) return null

    return {
      activeUsers: workspace.activeUsers.size,
      activeConversations: workspace.activeConversations.size,
      typingUsers: workspace.typingUsers.size,
      lastActivity: workspace.lastActivity,
      users: Array.from(workspace.activeUsers.values())
    }
  }

  // Clean up inactive workspaces and users
  private startCleanupInterval() {
    setInterval(() => {
      const now = new Date()
      const inactivityThreshold = 30 * 60 * 1000 // 30 minutes

      for (const [workspaceId, workspace] of this.workspaces.entries()) {
        // Remove inactive typing indicators
        for (const [userId, typing] of workspace.typingUsers.entries()) {
          if (now.getTime() - typing.timestamp.getTime() > 10000) { // 10 seconds
            workspace.typingUsers.delete(userId)
          }
        }

        // Remove old cursor positions
        for (const [userId, cursor] of workspace.sharedCursor.entries()) {
          if (now.getTime() - cursor.timestamp.getTime() > 5000) { // 5 seconds
            workspace.sharedCursor.delete(userId)
          }
        }

        // Mark inactive users
        for (const [userId, user] of workspace.activeUsers.entries()) {
          if (now.getTime() - user.lastSeen.getTime() > inactivityThreshold) {
            user.isActive = false
          }
        }

        // Clean up completely empty workspaces
        if (workspace.activeUsers.size === 0 && 
            now.getTime() - workspace.lastActivity.getTime() > inactivityThreshold) {
          this.workspaces.delete(workspaceId)
          // Debug log removed
        }
      }
    }, 30000) // Run cleanup every 30 seconds
  }
}

// Export singleton instance
export const collaborationService = new CollaborationService()

// Types are already exported above with interface declarations