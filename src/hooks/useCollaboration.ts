'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import io, { Socket } from 'socket.io-client'

// Define the interface locally instead of importing from an unavailable module
export interface CollaborativeUser {
  id: string
  name: string
  avatar?: string
  color?: string
  isActive: boolean
  lastSeen?: Date
}

interface UseCollaborationProps {
  workspaceId: string
  conversationId?: string
  userId: string
  userName: string
  enabled?: boolean
}

interface TypingUser {
  userId: string
  conversationId: string
  timestamp: Date
}

interface CursorPosition {
  userId: string
  x: number
  y: number
  timestamp: Date
}

interface UseCollaborationProps {
  workspaceId: string
  conversationId?: string
  userId: string
  userName: string
  enabled?: boolean
}

interface TypingUser {
  userId: string
  conversationId: string
  timestamp: Date
}

interface CursorPosition {
  userId: string
  x: number
  y: number
  timestamp: Date
}

>>>>>>> Stashed changes
export function useCollaboration({
  workspaceId,
  conversationId,
  userId,
  userName,
  enabled = true
}: UseCollaborationProps) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [activeUsers, setActiveUsers] = useState<CollaborativeUser[]>([])
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])
  const [cursors, setCursors] = useState<CursorPosition[]>([])
  const [connectionError, setConnectionError] = useState<string | null>(null)

<<<<<<< Updated upstream
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const cursorThrottleRef = useRef<NodeJS.Timeout | null>(null)
=======
  const typingTimeoutRef = useRef<NodeJS.Timeout>()
  const cursorThrottleRef = useRef<NodeJS.Timeout>()
>>>>>>> Stashed changes

  // Initialize socket connection
  useEffect(() => {
    if (!enabled || !workspaceId || !userId) return

    const initializeSocket = async () => {
      try {
        // Initialize socket endpoint
        await fetch('/api/collaboration/socket')
        
        const socketInstance = io({
          path: '/api/collaboration/socket',
          transports: ['websocket', 'polling']
        })

        socketInstance.on('connect', () => {
          console.log('🔌 Connected to collaboration server')
          setIsConnected(true)
          setConnectionError(null)

          // Join workspace
          socketInstance.emit('join_workspace', {
            workspaceId,
            conversationId,
            userId,
            userName
          })
        })

        socketInstance.on('disconnect', () => {
          console.log('🔌 Disconnected from collaboration server')
          setIsConnected(false)
          setActiveUsers([])
          setTypingUsers([])
          setCursors([])
        })

        socketInstance.on('connect_error', (error) => {
          console.error('❌ Collaboration connection error:', error)
          setConnectionError(error.message)
          setIsConnected(false)
        })

        // Handle workspace events
        socketInstance.on('workspace_state', (data) => {
          setActiveUsers(data.activeUsers || [])
        })

        socketInstance.on('user_joined', (data) => {
          setActiveUsers(data.activeUsers || [])
          console.log(`👥 User joined: ${data.user.name}`)
        })

        socketInstance.on('user_left', (data) => {
          setActiveUsers(data.activeUsers || [])
          console.log(`👥 User left: ${data.userId}`)
        })

        socketInstance.on('user_typing', (data) => {
          setTypingUsers(current => {
            const filtered = current.filter(u => u.userId !== data.userId)
            if (data.isTyping) {
              return [...filtered, {
                userId: data.userId,
                conversationId: data.conversationId,
                timestamp: new Date()
              }]
            }
            return filtered
          })
        })

        socketInstance.on('cursor_moved', (data) => {
          setCursors(current => {
            const filtered = current.filter(c => c.userId !== data.userId)
            return [...filtered, {
              userId: data.userId,
              x: data.cursor.x,
              y: data.cursor.y,
              timestamp: new Date(data.timestamp)
            }]
          })
        })

        setSocket(socketInstance)

      } catch (error) {
        console.error('Failed to initialize collaboration:', error)
        setConnectionError(error instanceof Error ? error.message : 'Connection failed')
      }
    }

    initializeSocket()

    return () => {
      if (socket) {
        socket.emit('leave_workspace', { workspaceId, userId })
        socket.disconnect()
      }
    }
  }, [enabled, workspaceId, conversationId, userId, userName])

  // Typing indicators
  const startTyping = useCallback((conversationId: string) => {
    if (!socket || !isConnected) return

    socket.emit('typing_start', { conversationId })

    // Auto-stop typing after 3 seconds of inactivity
<<<<<<< Updated upstream
    if (typingTimeoutRef.current !== null) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
=======
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
>>>>>>> Stashed changes
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(conversationId)
<<<<<<< Updated upstream
    }, 3000) as NodeJS.Timeout
=======
    }, 3000)
>>>>>>> Stashed changes
  }, [socket, isConnected])

  const stopTyping = useCallback((conversationId: string) => {
    if (!socket || !isConnected) return

    socket.emit('typing_stop', { conversationId })
    
<<<<<<< Updated upstream
    if (typingTimeoutRef.current !== null) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
=======
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
>>>>>>> Stashed changes
    }
  }, [socket, isConnected])

  // Cursor sharing
  const updateCursor = useCallback((x: number, y: number, messageId?: string) => {
    if (!socket || !isConnected) return

    // Throttle cursor updates to avoid spam
    if (cursorThrottleRef.current) return

    socket.emit('cursor_move', { x, y, messageId })
    
    cursorThrottleRef.current = setTimeout(() => {
<<<<<<< Updated upstream
      cursorThrottleRef.current = null
    }, 100) as NodeJS.Timeout // 10 FPS max
=======
      cursorThrottleRef.current = undefined
    }, 100) // 10 FPS max
>>>>>>> Stashed changes
  }, [socket, isConnected])

  // Get user info by ID
  const getUserById = useCallback((userId: string) => {
    return activeUsers.find(user => user.id === userId)
  }, [activeUsers])

  // Get typing users for a conversation
  const getTypingUsers = useCallback((conversationId: string) => {
    return typingUsers
      .filter(t => t.conversationId === conversationId)
      .map(t => getUserById(t.userId))
      .filter(Boolean) as CollaborativeUser[]
  }, [typingUsers, getUserById])

  // Clean up old cursors and typing indicators
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = new Date()
      
      // Remove old typing indicators (10 seconds)
      setTypingUsers(current => 
        current.filter(t => now.getTime() - t.timestamp.getTime() < 10000)
      )

      // Remove old cursors (5 seconds)
      setCursors(current => 
        current.filter(c => now.getTime() - c.timestamp.getTime() < 5000)
      )
<<<<<<< Updated upstream
    }, 5000) as NodeJS.Timeout
=======
    }, 5000)
>>>>>>> Stashed changes

    return () => clearInterval(cleanup)
  }, [])

  return {
    // Connection state
    isConnected,
    connectionError,
    
    // Users and presence
    activeUsers,
    getUserById,
    
    // Typing indicators
    typingUsers: getTypingUsers,
    startTyping,
    stopTyping,
    
    // Cursor sharing
    cursors,
    updateCursor,
    
    // Raw socket for custom events
    socket: isConnected ? socket : null
  }
}