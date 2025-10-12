/**
 * useCollaboration Hook
 * React hook for managing collaborative workspace features
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  color: string;
  isActive: boolean;
  role: 'owner' | 'collaborator' | 'viewer';
  lastSeen: Date;
  cursor?: {
    x: number;
    y: number;
    file?: string;
  };
}

export interface WorkspaceActivity {
  id: string;
  type: 'user_joined' | 'user_left' | 'file_opened' | 'file_edited' | 'project_created' | 'terminal_command';
  userId: string;
  userName: string;
  timestamp: Date;
  data?: {
    file?: string;
    project?: string;
    command?: string;
    message?: string;
  };
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: Date;
  type?: 'message' | 'system';
}

export interface CollaborationState {
  workspaceId: string;
  currentUser: User | null;
  activeUsers: User[];
  workspaceActivity: WorkspaceActivity[];
  chatMessages: ChatMessage[];
  isConnected: boolean;
  connectionError?: string;
}

export interface CollaborationActions {
  // User management
  joinWorkspace: (workspaceId: string, user: Omit<User, 'isActive' | 'lastSeen'>) => Promise<void>;
  leaveWorkspace: () => Promise<void>;
  inviteUser: (email: string, role: User['role']) => Promise<void>;
  updateUserPresence: (presence: Partial<User>) => void;

  // Activity management
  addActivity: (activity: Omit<WorkspaceActivity, 'id' | 'timestamp'>) => void;
  clearActivity: () => void;

  // Chat management
  sendMessage: (message: string) => Promise<void>;
  clearChat: () => void;

  // File operations
  openFile: (filePath: string) => void;
  editFile: (filePath: string, content: string) => void;
  closeFile: (filePath: string) => void;

  // Cursor tracking
  updateCursor: (x: number, y: number, file?: string) => void;
  clearCursor: () => void;

  // Connection management
  reconnect: () => Promise<void>;
  disconnect: () => void;
}

export interface UseCollaborationOptions {
  workspaceId?: string;
  user?: Omit<User, 'isActive' | 'lastSeen'>;
  autoConnect?: boolean;
  enableChat?: boolean;
  enableActivityTracking?: boolean;
  enableCursorTracking?: boolean;
  onUserJoin?: (user: User) => void;
  onUserLeave?: (user: User) => void;
  onMessage?: (message: ChatMessage) => void;
  onActivity?: (activity: WorkspaceActivity) => void;
  onError?: (error: string) => void;
}

export interface UseCollaborationReturn extends CollaborationState, CollaborationActions {
  // Additional computed properties
  onlineUsers: User[];
  recentActivity: WorkspaceActivity[];
  unreadMessages: number;
}

/**
 * React hook for collaborative workspace features
 */
export function useCollaboration(options: UseCollaborationOptions = {}): UseCollaborationReturn {
  const {
    workspaceId: initialWorkspaceId,
    user: initialUser,
    autoConnect = true,
    enableChat = true,
    enableActivityTracking = true,
    enableCursorTracking = true,
    onUserJoin,
    onUserLeave,
    onMessage,
    onActivity,
    onError
  } = options;

  const [workspaceId, setWorkspaceId] = useState(initialWorkspaceId || '');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [workspaceActivity, setWorkspaceActivity] = useState<WorkspaceActivity[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | undefined>();

  // Refs for cleanup and intervals
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const cursorTimeoutRef = useRef<NodeJS.Timeout>();

  /**
   * Join workspace
   */
  const joinWorkspace = useCallback(async (wsId: string, user: Omit<User, 'isActive' | 'lastSeen'>) => {
    try {
      setWorkspaceId(wsId);
      setConnectionError(undefined);

      // Create full user object
      const fullUser: User = {
        ...user,
        isActive: true,
        lastSeen: new Date()
      };

      setCurrentUser(fullUser);

      // This would integrate with your collaboration service
      // For now, simulate connection
      await simulateConnection(wsId);

      setIsConnected(true);

      // Add join activity
      if (enableActivityTracking) {
        addActivity({
          type: 'user_joined',
          userId: user.id,
          userName: user.name,
          data: { message: 'joined the workspace' }
        });
      }

      onUserJoin?.(fullUser);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to join workspace';
      setConnectionError(errorMessage);
      onError?.(errorMessage);
    }
  }, [enableActivityTracking, onUserJoin, onError]);

  /**
   * Leave workspace
   */
  const leaveWorkspace = useCallback(async () => {
    try {
      if (currentUser) {
        // Add leave activity
        if (enableActivityTracking) {
          addActivity({
            type: 'user_left',
            userId: currentUser.id,
            userName: currentUser.name,
            data: { message: 'left the workspace' }
          });
        }

        onUserLeave?.(currentUser);
      }

      await disconnect();
      cleanup();

    } catch (error) {
      logger.error('Error leaving workspace:', error);
    }
  }, [currentUser, enableActivityTracking, onUserLeave]);

  /**
   * Invite user to workspace
   */
  const inviteUser = useCallback(async (email: string, role: User['role']) => {
    try {
      // This would integrate with your invitation service
      logger.info(`Inviting ${email} as ${role}`);

      // Simulate invitation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Add system message
      if (enableChat) {
        const systemMessage: ChatMessage = {
          id: `system-${Date.now()}`,
          userId: 'system',
          userName: 'System',
          message: `Invitation sent to ${email}`,
          timestamp: new Date(),
          type: 'system'
        };

        setChatMessages(prev => [...prev, systemMessage]);
        onMessage?.(systemMessage);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to invite user';
      onError?.(errorMessage);
    }
  }, [enableChat, onMessage, onError]);

  /**
   * Update user presence
   */
  const updateUserPresence = useCallback((presence: Partial<User>) => {
    if (currentUser) {
      const updatedUser = {
        ...currentUser,
        ...presence,
        lastSeen: new Date()
      };
      setCurrentUser(updatedUser);

      // This would broadcast to other users
      logger.info('Updating user presence:', presence);
    }
  }, [currentUser]);

  /**
   * Add workspace activity
   */
  const addActivity = useCallback((activity: Omit<WorkspaceActivity, 'id' | 'timestamp'>) => {
    const fullActivity: WorkspaceActivity = {
      ...activity,
      id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    setWorkspaceActivity(prev => [fullActivity, ...prev.slice(0, 99)]); // Keep last 100 activities
    onActivity?.(fullActivity);
  }, [onActivity]);

  /**
   * Clear activity feed
   */
  const clearActivity = useCallback(() => {
    setWorkspaceActivity([]);
  }, []);

  /**
   * Send chat message
   */
  const sendMessage = useCallback(async (message: string) => {
    if (!currentUser || !message.trim()) return;

    try {
      const chatMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId: currentUser.id,
        userName: currentUser.name,
        message: message.trim(),
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, chatMessage]);
      onMessage?.(chatMessage);

      // Add to activity feed
      if (enableActivityTracking) {
        addActivity({
          type: 'terminal_command',
          userId: currentUser.id,
          userName: currentUser.name,
          data: { command: message }
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      onError?.(errorMessage);
    }
  }, [currentUser, enableActivityTracking, addActivity, onMessage, onError]);

  /**
   * Clear chat messages
   */
  const clearChat = useCallback(() => {
    setChatMessages([]);
  }, []);

  /**
   * Open file
   */
  const openFile = useCallback((filePath: string) => {
    if (currentUser && enableActivityTracking) {
      addActivity({
        type: 'file_opened',
        userId: currentUser.id,
        userName: currentUser.name,
        data: { file: filePath }
      });
    }
  }, [currentUser, enableActivityTracking, addActivity]);

  /**
   * Edit file
   */
  const editFile = useCallback((filePath: string, content: string) => {
    if (currentUser && enableActivityTracking) {
      addActivity({
        type: 'file_edited',
        userId: currentUser.id,
        userName: currentUser.name,
        data: { file: filePath }
      });
    }
  }, [currentUser, enableActivityTracking, addActivity]);

  /**
   * Close file
   */
  const closeFile = useCallback((filePath: string) => {
    // File closing activity would go here if needed
    logger.info('File closed:', filePath);
  }, []);

  /**
   * Update cursor position
   */
  const updateCursor = useCallback((x: number, y: number, file?: string) => {
    if (currentUser && enableCursorTracking) {
      const updatedUser = {
        ...currentUser,
        cursor: { x, y, file },
        lastSeen: new Date()
      };
      setCurrentUser(updatedUser);

      // Clear cursor after inactivity
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
      cursorTimeoutRef.current = setTimeout(() => {
        clearCursor();
      }, 5000); // Hide cursor after 5 seconds of inactivity
    }
  }, [currentUser, enableCursorTracking]);

  /**
   * Clear cursor position
   */
  const clearCursor = useCallback(() => {
    if (currentUser) {
      const updatedUser = {
        ...currentUser,
        cursor: undefined,
        lastSeen: new Date()
      };
      setCurrentUser(updatedUser);
    }
  }, [currentUser]);

  /**
   * Reconnect to workspace
   */
  const reconnect = useCallback(async () => {
    if (!workspaceId || !currentUser) return;

    try {
      setConnectionError(undefined);
      await simulateConnection(workspaceId);
      setIsConnected(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reconnect';
      setConnectionError(errorMessage);
      setIsConnected(false);
      onError?.(errorMessage);

      // Schedule retry
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnect();
      }, 5000);
    }
  }, [workspaceId, currentUser, onError]);

  /**
   * Disconnect from workspace
   */
  const disconnect = useCallback(async () => {
    setIsConnected(false);
    setConnectionError(undefined);

    // This would disconnect from your collaboration service
    logger.info('Disconnected from workspace');
  }, []);

  /**
   * Simulate connection (replace with real collaboration service)
   */
  const simulateConnection = async (wsId: string): Promise<void> => {
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simulate other users in workspace
    const mockUsers: User[] = [
      {
        id: 'user-2',
        name: 'Alice Developer',
        email: 'alice@example.com',
        color: '#ef4444',
        isActive: true,
        role: 'collaborator',
        lastSeen: new Date()
      },
      {
        id: 'user-3',
        name: 'Bob Designer',
        email: 'bob@example.com',
        color: '#22c55e',
        isActive: true,
        role: 'viewer',
        lastSeen: new Date()
      }
    ];

    setActiveUsers(mockUsers);

    // Start heartbeat
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    heartbeatIntervalRef.current = setInterval(() => {
      updateUserPresence({ lastSeen: new Date() });
    }, 30000); // Update presence every 30 seconds
  };

  /**
   * Cleanup function
   */
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    if (cursorTimeoutRef.current) {
      clearTimeout(cursorTimeoutRef.current);
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && initialWorkspaceId && initialUser) {
      joinWorkspace(initialWorkspaceId, initialUser);
    }

    return cleanup;
  }, [autoConnect, initialWorkspaceId, initialUser]);

  // Computed properties
  const onlineUsers = activeUsers.filter(user => user.isActive);
  const recentActivity = workspaceActivity.slice(0, 10);
  const unreadMessages = chatMessages.filter(msg =>
    msg.type === 'message' && msg.userId !== currentUser?.id
  ).length;

  return {
    // State
    workspaceId,
    currentUser,
    activeUsers,
    workspaceActivity,
    chatMessages,
    isConnected,
    connectionError,

    // Computed properties
    onlineUsers,
    recentActivity,
    unreadMessages,

    // Actions
    joinWorkspace,
    leaveWorkspace,
    inviteUser,
    updateUserPresence,
    addActivity,
    clearActivity,
    sendMessage,
    clearChat,
    openFile,
    editFile,
    closeFile,
    updateCursor,
    clearCursor,
    reconnect,
    disconnect
  };
}
