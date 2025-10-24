/**
 * Collaboration Service
 * Handles real-time collaboration features for workspaces
 */

import { Server as SocketIOServer } from 'socket.io';
// import { DefaultEventsMap } from 'socket.io/dist/typed-events';
// import { logger } from '@/lib/logger';

// Stub type for socket.io typed events
type DefaultEventsMap = Record<string, (...args: any[]) => void>;
export interface WorkspaceUser {
  userId: string;
  username: string;
  avatar?: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: Date;
  lastActivity: Date;
  cursor?: {
    x: number;
    y: number;
    file?: string;
  };
}

export interface WorkspaceSession {
  workspaceId: string;
  users: Map<string, WorkspaceUser>;
  createdAt: Date;
  maxUsers: number;
}

export interface CollaborationEvent {
  type: 'user_joined' | 'user_left' | 'cursor_move' | 'file_edit' | 'chat_message';
  workspaceId: string;
  userId: string;
  data: any;
  timestamp: Date;
}

export interface FileEdit {
  filePath: string;
  operation: 'insert' | 'delete' | 'replace';
  position: number;
  content: string;
  length?: number;
}

/**
 * Collaboration Service for real-time workspace features
 */
export class CollaborationService {
  private io: SocketIOServer<DefaultEventsMap, DefaultEventsMap> | null = null;
  private sessions: Map<string, WorkspaceSession> = new Map();
  private userSockets: Map<string, string> = new Map(); // userId -> socketId
  private socketUsers: Map<string, string> = new Map(); // socketId -> userId

  /**
   * Initialize the collaboration service with Socket.IO
   */
  initialize(io: SocketIOServer): void {
    this.io = io;
    this.setupSocketHandlers();
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupSocketHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: any) => {
      console.log('User connected:', socket.id);

      // Handle user joining workspace
      socket.on('join_workspace', async (data: { workspaceId: string; userId: string; username: string }) => {
        await this.handleUserJoin(socket, data);
      });

      // Handle cursor movement
      socket.on('cursor_move', (data: { x: number; y: number; file?: string }) => {
        this.handleCursorMove(socket, data);
      });

      // Handle file edits
      socket.on('file_edit', (data: FileEdit) => {
        this.handleFileEdit(socket, data);
      });

      // Handle chat messages
      socket.on('chat_message', (data: { content: string; conversationId?: string }) => {
        this.handleChatMessage(socket, data);
      });

      // Handle user leaving
      socket.on('leave_workspace', (data: { workspaceId: string }) => {
        this.handleUserLeave(socket, data);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  /**
   * Handle user joining a workspace
   */
  private async handleUserJoin(
    socket: any,
    data: { workspaceId: string; userId: string; username: string }
  ): Promise<void> {
    const { workspaceId, userId, username } = data;

    // Track user socket mapping
    this.userSockets.set(userId, socket.id);
    this.socketUsers.set(socket.id, userId);

    // Get or create workspace session
    let session = this.sessions.get(workspaceId);
    if (!session) {
      session = {
        workspaceId,
        users: new Map(),
        createdAt: new Date(),
        maxUsers: 10 // Configurable limit
      };
      this.sessions.set(workspaceId, session);
    }

    // Check if workspace is full
    if (session.users.size >= session.maxUsers && !session.users.has(userId)) {
      socket.emit('workspace_full', { workspaceId, maxUsers: session.maxUsers });
      return;
    }

    // Add user to workspace
    const workspaceUser: WorkspaceUser = {
      userId,
      username,
      role: 'editor', // Default role, could be determined by permissions
      joinedAt: new Date(),
      lastActivity: new Date()
    };

    session.users.set(userId, workspaceUser);

    // Join socket to workspace room
    await socket.join(`workspace:${workspaceId}`);

    // Notify other users in workspace
    socket.to(`workspace:${workspaceId}`).emit('user_joined', {
      user: workspaceUser,
      workspaceId,
      timestamp: new Date()
    });

    // Send current workspace state to joining user
    socket.emit('workspace_state', {
      users: Array.from(session.users.values()),
      workspaceId,
      timestamp: new Date()
    });

    console.log(`User ${username} joined workspace ${workspaceId}`);
  }

  /**
   * Handle cursor movement
   */
  private handleCursorMove(socket: any, data: { x: number; y: number; file?: string }): void {
    const userId = this.socketUsers.get(socket.id);
    if (!userId) return;

    // Find user's workspace
    for (const [workspaceId, session] of this.sessions.entries()) {
      const user = session.users.get(userId);
      if (user) {
        // Update user's cursor position
        user.cursor = { x: data.x, y: data.y, file: data.file };
        user.lastActivity = new Date();

        // Broadcast cursor movement to other users in workspace
        socket.to(`workspace:${workspaceId}`).emit('cursor_move', {
          userId,
          username: user.username,
          cursor: user.cursor,
          timestamp: new Date()
        });

        break;
      }
    }
  }

  /**
   * Handle file edits
   */
  private handleFileEdit(socket: any, data: FileEdit): void {
    const userId = this.socketUsers.get(socket.id);
    if (!userId) return;

    // Find user's workspace
    for (const [workspaceId, session] of this.sessions.entries()) {
      const user = session.users.get(userId);
      if (user) {
        // Update user's last activity
        user.lastActivity = new Date();

        // Broadcast file edit to other users in workspace
        socket.to(`workspace:${workspaceId}`).emit('file_edit', {
          fileEdit: data,
          userId,
          username: user.username,
          timestamp: new Date()
        });

        // Log collaboration event
        this.logCollaborationEvent({
          type: 'file_edit',
          workspaceId,
          userId,
          data,
          timestamp: new Date()
        });

        break;
      }
    }
  }

  /**
   * Handle chat messages
   */
  private handleChatMessage(socket: any, data: { content: string; conversationId?: string }): void {
    const userId = this.socketUsers.get(socket.id);
    if (!userId) return;

    // Find user's workspace
    for (const [workspaceId, session] of this.sessions.entries()) {
      const user = session.users.get(userId);
      if (user) {
        // Update user's last activity
        user.lastActivity = new Date();

        // Broadcast chat message to workspace
        this.io?.to(`workspace:${workspaceId}`).emit('chat_message', {
          content: data.content,
          userId,
          username: user.username,
          conversationId: data.conversationId,
          timestamp: new Date()
        });

        // Log collaboration event
        this.logCollaborationEvent({
          type: 'chat_message',
          workspaceId,
          userId,
          data: { content: data.content, conversationId: data.conversationId },
          timestamp: new Date()
        });

        break;
      }
    }
  }

  /**
   * Handle user leaving workspace
   */
  private handleUserLeave(socket: any, data: { workspaceId: string }): void {
    const userId = this.socketUsers.get(socket.id);
    if (!userId) return;

    const { workspaceId } = data;
    const session = this.sessions.get(workspaceId);

    if (session) {
      const user = session.users.get(userId);
      if (user) {
        // Remove user from workspace
        session.users.delete(userId);

        // Leave socket room
        socket.leave(`workspace:${workspaceId}`);

        // Notify other users
        socket.to(`workspace:${workspaceId}`).emit('user_left', {
          userId,
          username: user.username,
          workspaceId,
          timestamp: new Date()
        });

        // Clean up empty sessions
        if (session.users.size === 0) {
          this.sessions.delete(workspaceId);
        }

        console.log(`User ${user.username} left workspace ${workspaceId}`);
      }
    }

    // Clean up socket mappings
    this.userSockets.delete(userId);
    this.socketUsers.delete(socket.id);
  }

  /**
   * Handle socket disconnect
   */
  private handleDisconnect(socket: any): void {
    const userId = this.socketUsers.get(socket.id);
    if (!userId) return;

    // Find and remove user from all workspaces
    for (const [workspaceId, session] of this.sessions.entries()) {
      const user = session.users.get(userId);
      if (user) {
        session.users.delete(userId);

        // Notify other users in workspace
        socket.to(`workspace:${workspaceId}`).emit('user_left', {
          userId,
          username: user.username,
          workspaceId,
          timestamp: new Date()
        });

        // Clean up empty sessions
        if (session.users.size === 0) {
          this.sessions.delete(workspaceId);
        }
      }
    }

    // Clean up socket mappings
    this.userSockets.delete(userId);
    this.socketUsers.delete(socket.id);

    console.log('User disconnected:', socket.id);
  }

  /**
   * Send message to specific workspace
   */
  sendToWorkspace(workspaceId: string, event: string, data: any): void {
    this.io?.to(`workspace:${workspaceId}`).emit(event, data);
  }

  /**
   * Send message to specific user
   */
  sendToUser(userId: string, event: string, data: any): void {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.io?.to(socketId).emit(event, data);
    }
  }

  /**
   * Get workspace session information
   */
  getWorkspaceSession(workspaceId: string): WorkspaceSession | undefined {
    return this.sessions.get(workspaceId);
  }

  /**
   * Get all active workspace sessions
   */
  getActiveSessions(): WorkspaceSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get user information by socket ID
   */
  getUserBySocketId(socketId: string): { userId: string; workspaceId?: string } | null {
    const userId = this.socketUsers.get(socketId);
    if (!userId) return null;

    // Find which workspace the user is in
    for (const [workspaceId, session] of this.sessions.entries()) {
      if (session.users.has(userId)) {
        return { userId, workspaceId };
      }
    }

    return { userId };
  }

  /**
   * Check if user is in workspace
   */
  isUserInWorkspace(userId: string, workspaceId: string): boolean {
    const session = this.sessions.get(workspaceId);
    return session?.users.has(userId) || false;
  }

  /**
   * Get collaboration statistics
   */
  getCollaborationStats(): {
    activeSessions: number;
    totalUsers: number;
    averageUsersPerSession: number;
    sessionsByWorkspace: Record<string, number>;
  } {
    const sessions = Array.from(this.sessions.values());
    const totalUsers = sessions.reduce((sum, session) => sum + session.users.size, 0);

    const sessionsByWorkspace: Record<string, number> = {};
    sessions.forEach(session => {
      sessionsByWorkspace[session.workspaceId] = session.users.size;
    });

    return {
      activeSessions: sessions.length,
      totalUsers,
      averageUsersPerSession: sessions.length > 0 ? totalUsers / sessions.length : 0,
      sessionsByWorkspace
    };
  }

  /**
   * Log collaboration event
   */
  private logCollaborationEvent(event: CollaborationEvent): void {
    // This would integrate with your logging/monitoring system
    console.log('Collaboration event:', {
      type: event.type,
      workspaceId: event.workspaceId,
      userId: event.userId,
      timestamp: event.timestamp
    });

    // Store event for analytics (in production, this would go to a database)
    // For now, we'll just keep it in memory for this session
  }

  /**
   * Clean up inactive sessions
   */
  cleanupInactiveSessions(maxIdleTime: number = 30 * 60 * 1000): void { // 30 minutes default
    const now = Date.now();

    for (const [workspaceId, session] of this.sessions.entries()) {
      // Check if all users have been inactive for too long
      const inactiveUsers = Array.from(session.users.values()).filter(
        user => now - user.lastActivity.getTime() > maxIdleTime
      );

      if (inactiveUsers.length === session.users.size && session.users.size > 0) {
        // All users inactive, clean up session
        this.sessions.delete(workspaceId);
        console.log(`Cleaned up inactive workspace session: ${workspaceId}`);
      }
    }
  }

  /**
   * Force disconnect user from all workspaces
   */
  forceDisconnectUser(userId: string): void {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      const socket = this.io?.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect();
      }
    }
  }

  /**
   * Get service health status
   */
  getHealthStatus(): {
    isHealthy: boolean;
    activeConnections: number;
    activeSessions: number;
    uptime: number;
  } {
    const uptime = this.io ? Date.now() - (this.io as any).engine.startTime : 0;

    return {
      isHealthy: this.io !== null,
      activeConnections: this.io?.sockets.sockets.size || 0,
      activeSessions: this.sessions.size,
      uptime
    };
  }

  /**
   * Broadcast system message to all connected users
   */
  broadcastSystemMessage(message: string, data?: any): void {
    this.io?.emit('system_message', {
      message,
      data,
      timestamp: new Date()
    });
  }

  /**
   * Send notification to specific user
   */
  sendNotification(userId: string, notification: {
    type: 'info' | 'warning' | 'error' | 'success';
    title: string;
    message: string;
    data?: any;
  }): void {
    this.sendToUser(userId, 'notification', {
      ...notification,
      timestamp: new Date()
    });
  }

  /**
   * Update user role in workspace
   */
  updateUserRole(workspaceId: string, userId: string, role: WorkspaceUser['role']): boolean {
    const session = this.sessions.get(workspaceId);
    if (!session) return false;

    const user = session.users.get(userId);
    if (!user) return false;

    user.role = role;
    session.users.set(userId, user);

    // Notify all users in workspace about role change
    this.io?.to(`workspace:${workspaceId}`).emit('user_role_updated', {
      userId,
      username: user.username,
      role,
      workspaceId,
      timestamp: new Date()
    });

    return true;
  }

  /**
   * Get users in workspace
   */
  getWorkspaceUsers(workspaceId: string): WorkspaceUser[] {
    const session = this.sessions.get(workspaceId);
    return session ? Array.from(session.users.values()) : [];
  }

  /**
   * Check if workspace exists
   */
  workspaceExists(workspaceId: string): boolean {
    return this.sessions.has(workspaceId);
  }

  /**
   * Create workspace session (for testing/admin purposes)
   */
  createWorkspaceSession(workspaceId: string, maxUsers: number = 10): WorkspaceSession {
    const session: WorkspaceSession = {
      workspaceId,
      users: new Map(),
      createdAt: new Date(),
      maxUsers
    };

    this.sessions.set(workspaceId, session);
    return session;
  }

  /**
   * Remove workspace session
   */
  removeWorkspaceSession(workspaceId: string): boolean {
    const session = this.sessions.get(workspaceId);
    if (!session) return false;

    // Disconnect all users in the workspace
    for (const [userId] of session.users) {
      this.forceDisconnectUser(userId);
    }

    this.sessions.delete(workspaceId);
    return true;
  }
}

// Export singleton instance for global use
export const collaborationService = new CollaborationService();
