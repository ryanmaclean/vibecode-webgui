/**
 * useCollaboration Hook
 * React hook for managing collaborative workspace features
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { collaborationManager as sharedCollaborationManager, CollaborationManager } from '@/lib/collaboration';
import io from 'socket.io-client';

export interface CollaborationSocket {
  emit: (event: string, ...args: any[]) => void;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  off?: (event: string, handler?: (...args: any[]) => void) => void;
  once?: (event: string, handler: (...args: any[]) => void) => void;
  disconnect?: () => void;
  connected?: boolean;
  id?: string;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  color?: string;
  isActive: boolean;
  role?: 'owner' | 'collaborator' | 'viewer';
  lastSeen: Date;
  cursor?: {
    x: number;
    y: number;
    file?: string;
  };
}

// Alias for test compatibility
export type CollaborativeUser = User;

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
  connectionError: string | null;
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
  clearCursor: (userId?: string) => void;

  // Typing indicators
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;

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
  conversationId?: string;
  userId?: string;
  userName?: string;
  enabled?: boolean;
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
  typingUsers: (conversationId: string) => User[];
  getUserById: (userId: string) => User | undefined;
  cursors: CursorState[];
  socket: CollaborationSocket | null;
  collaborationManager: CollaborationManager | null;
  awareness: any;
}

type TypingStateMap = Record<string, User[]>;
type CursorState = { userId: string; x: number; y: number; file?: string };

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
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [typingState, setTypingState] = useState<TypingStateMap>({});
  const [cursors, setCursors] = useState<CursorState[]>([]);
  const socketRef = useRef<CollaborationSocket | null>(null);
  const currentUserRef = useRef<User | null>(null);

  // Refs for cleanup and intervals
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cursorTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    setTypingState(prev => {
      if (activeUsers.length === 0) {
        return Object.keys(prev).length ? {} : prev;
      }

      const activeIds = new Set(activeUsers.map(user => user.id));
      let mutated = false;
      const nextState: TypingStateMap = {};

      for (const [conversationId, users] of Object.entries(prev)) {
        const filtered = users.filter(user => activeIds.has(user.id));
        if (filtered.length > 0) {
          nextState[conversationId] = filtered;
        }
        if (filtered.length !== users.length) {
          mutated = true;
        }
      }

      return mutated ? nextState : prev;
    });
  }, [activeUsers]);

  const typingUsers = useCallback((conversationId: string) => {
    return typingState[conversationId] ?? [];
  }, [typingState]);

  const getUserById = useCallback((userId: string) => {
    return activeUsers.find(u => u.id === userId);
  }, [activeUsers]);

  const startTyping = useCallback((conversationId: string) => {
    if (!socketRef.current || !isConnected) return;

    socketRef.current.emit('typing_start', {
      conversationId,
    });
  }, [isConnected]);

  const stopTyping = useCallback((conversationId: string) => {
    if (!socketRef.current || !isConnected) return;

    socketRef.current.emit('typing_stop', {
      conversationId,
    });
  }, [isConnected]);

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

      setTypingState({});
      setCursors([]);
      setActiveUsers([]);
      setCurrentUser(null);
      currentUserRef.current = null;

      await disconnect();
      cleanup();

    } catch (error) {
      console.error('Error leaving workspace:', error);
    }
  }, [currentUser, enableActivityTracking, onUserLeave]);

  /**
   * Invite user to workspace
   */
  const inviteUser = useCallback(async (email: string, role: User['role']) => {
    try {
      // This would integrate with your invitation service
      console.log(`Inviting ${email} as ${role}`);

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
      console.log('Updating user presence:', presence);
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
    console.log('File closed:', filePath);
  }, []);

  /**
   * Clear cursor position
   */
  const clearCursor = useCallback((userId?: string) => {
    const targetId = userId ?? currentUserRef.current?.id;
    if (!targetId) {
      return;
    }

    setCursors(prev => prev.filter(cursor => cursor.userId !== targetId));

    const timeout = cursorTimeoutRef.current[targetId];
    if (timeout) {
      clearTimeout(timeout);
      delete cursorTimeoutRef.current[targetId];
    }

    if (currentUserRef.current?.id === targetId) {
      setCurrentUser(prev => (prev ? { ...prev, cursor: undefined, lastSeen: new Date() } : prev));
    }
  }, []);

  /**
   * Update cursor position (throttled)
   */
  const lastCursorEmitRef = useRef<number>(0);
  const updateCursor = useCallback((x: number, y: number, messageId?: string) => {
    if (!socketRef.current || !isConnected) return;

    // Throttle cursor updates to every 100ms
    const now = Date.now();
    if (now - lastCursorEmitRef.current < 100) {
      return;
    }
    lastCursorEmitRef.current = now;

    socketRef.current.emit('cursor_move', {
      x,
      y,
      messageId,
    });
  }, [isConnected]);

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
    setActiveUsers([]);
    setTypingState({});
    setCursors([]);
    setCurrentUser(null);
    currentUserRef.current = null;

    if (socketRef.current?.disconnect) {
      socketRef.current.disconnect();
    }
    socketRef.current = null;

    // This would disconnect from your collaboration service
    console.log('Disconnected from workspace');
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
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    Object.values(cursorTimeoutRef.current).forEach(timeout => {
      clearTimeout(timeout);
    });
    cursorTimeoutRef.current = {};
  }, []);

  // Socket.io initialization
  useEffect(() => {
    const enabled = options.enabled !== false;
    if (!enabled || !options.workspaceId || !options.userId) {
      return;
    }

    let isMounted = true;
    let cleanupInterval: NodeJS.Timeout | null = null;

    const initializeSocket = async () => {
      try {
        // Test API availability
        await fetch('/api/collaboration/socket');

        // Initialize socket.io connection
        const socket = io({
          path: '/api/collaboration/socket',
          transports: ['websocket', 'polling'],
        }) as any;

        if (!isMounted) {
          socket.disconnect?.();
          return;
        }

        socketRef.current = socket;

        // Set up event handlers
        socket.on('connect', () => {
          if (!isMounted) return;
          console.log('🔌 Connected to collaboration server');
          setIsConnected(true);
          setConnectionError(null);

          // Join workspace
          socket.emit('join_workspace', {
            workspaceId: options.workspaceId,
            userId: options.userId,
            userName: options.userName,
          });
        });

        socket.on('disconnect', () => {
          if (!isMounted) return;
          console.log('🔌 Disconnected from collaboration server');
          setIsConnected(false);
          setActiveUsers([]);
        });

        socket.on('connect_error', (error: any) => {
          if (!isMounted) return;
          console.error('❌ Collaboration connection error:', error);
          setConnectionError(error?.message || 'Connection failed');
          setIsConnected(false);
        });

        socket.on('workspace_state', (data: { activeUsers: any[] }) => {
          if (!isMounted) return;
          setActiveUsers(data.activeUsers || []);
        });

        socket.on('user_joined', (data: { user: any; activeUsers: any[] }) => {
          if (!isMounted) return;
          console.log(`👥 User joined: ${data.user?.name}`);
          setActiveUsers(data.activeUsers || []);
        });

        socket.on('user_left', (data: { userId: string; activeUsers: any[] }) => {
          if (!isMounted) return;
          console.log(`👥 User left: ${data.userId}`);
          setActiveUsers(data.activeUsers || []);
        });

        socket.on('user_typing', (data: { userId: string; conversationId: string; isTyping: boolean }) => {
          if (!isMounted) return;

          // Get user from activeUsers state
          setTypingState(prev => {
            // Find the user in activeUsers
            let user: any;
            setActiveUsers(currentActive => {
              user = currentActive.find(u => u.id === data.userId);
              return currentActive;
            });

            if (!user) return prev;

            if (data.isTyping) {
              const existing = prev[data.conversationId] || [];
              if (existing.some(u => u.id === data.userId)) {
                return prev;
              }
              return {
                ...prev,
                [data.conversationId]: [...existing, user]
              };
            } else {
              const existing = prev[data.conversationId];
              if (!existing) return prev;
              const filtered = existing.filter(u => u.id !== data.userId);
              if (filtered.length === 0) {
                const { [data.conversationId]: _, ...rest } = prev;
                return rest;
              }
              return { ...prev, [data.conversationId]: filtered };
            }
          });
        });

        socket.on('cursor_moved', (data: { userId: string; cursor: { x: number; y: number }; timestamp: string }) => {
          if (!isMounted) return;
          setCursors(prev => {
            const others = prev.filter(c => c.userId !== data.userId);
            return [...others, {
              userId: data.userId,
              x: data.cursor.x,
              y: data.cursor.y,
              timestamp: new Date(data.timestamp)
            }] as any;
          });
        });

        // Cleanup old cursors and typing indicators every 5 seconds
        cleanupInterval = setInterval(() => {
          if (!isMounted) return;

          const now = Date.now();
          const fiveSecondsAgo = now - 5000;

          // Clean up old cursors
          setCursors(prev => {
            return prev.filter(cursor => {
              const timestamp = (cursor as any).timestamp;
              if (!timestamp) return true;
              return timestamp.getTime() > fiveSecondsAgo;
            });
          });

          // Clean up old typing indicators
          setTypingState(prev => {
            const nextState: TypingStateMap = {};
            let hasChanges = false;

            for (const [conversationId, users] of Object.entries(prev)) {
              const filtered = users.filter(user => {
                return user.lastSeen.getTime() > fiveSecondsAgo;
              });
              if (filtered.length > 0) {
                nextState[conversationId] = filtered;
              }
              if (filtered.length !== users.length) {
                hasChanges = true;
              }
            }

            return hasChanges ? nextState : prev;
          });
        }, 5000);

      } catch (error) {
        if (!isMounted) return;
        console.error('Failed to initialize collaboration:', error);
        setConnectionError(error instanceof Error ? error.message : 'Connection failed');
      }
    };

    initializeSocket();

    return () => {
      isMounted = false;
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
      }
      if (socketRef.current) {
        socketRef.current.emit?.('leave_workspace', {
          workspaceId: options.workspaceId,
          userId: options.userId,
        });
        socketRef.current.disconnect?.();
        socketRef.current = null;
      }
      cleanup();
    };
  }, [options.enabled, options.workspaceId, options.userId, options.userName]);

  // Auto-connect on mount (legacy behavior for non-socket.io mode)
  useEffect(() => {
    if (autoConnect && initialWorkspaceId && initialUser && !options.enabled) {
      joinWorkspace(initialWorkspaceId, initialUser);
    }
  }, [autoConnect, initialWorkspaceId, initialUser, options.enabled]);

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
    startTyping,
    stopTyping,
    reconnect,
    disconnect,
    typingUsers,
    getUserById,
    cursors,
    socket: socketRef.current,
    collaborationManager: sharedCollaborationManager,
    awareness: null
  };
}
