/**
 * User Presence Indicators Component
 * 
 * Advanced real-time user presence system with activity tracking,
 * cursor positions, typing indicators, and user status management
 * 
 * Staff Engineer Implementation - Enterprise-grade presence management
 */

'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Cursor, Activity, Clock, Wifi, WifiOff } from 'lucide-react'
import { useCollaboration } from '../../hooks/useCollaboration'

export interface UserPresence {
  userId: string
  userName: string
  userAvatar?: string
  userColor: string
  position: {
    line: number
    column: number
  }
  selection?: {
    start: { line: number; column: number }
    end: { line: number; column: number }
  }
  isTyping: boolean
  isActive: boolean
  lastActivity: number
  connectionStatus: 'connected' | 'connecting' | 'disconnected'
  viewport?: {
    startLine: number
    endLine: number
  }
  metadata?: {
    device: 'desktop' | 'mobile' | 'tablet'
    browser: string
    timezone: string
  }
}

export interface UserPresenceIndicatorsProps {
  sessionId: string
  currentUserId: string
  maxVisibleUsers?: number
  showTypingIndicators?: boolean
  showCursorPositions?: boolean
  showActivityStatus?: boolean
  showConnectionStatus?: boolean
  className?: string
  onUserClick?: (user: UserPresence) => void
}

const USER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
  '#6C5CE7', '#FD79A8', '#FDCB6E', '#74B9FF', '#00B894',
  '#E17055', '#81ECEC', '#A29BFE', '#FF7675', '#DDA0DD'
]

const ACTIVITY_THRESHOLD = 5 * 60 * 1000 // 5 minutes
const TYPING_TIMEOUT = 3000 // 3 seconds

export default function UserPresenceIndicators({
  sessionId,
  currentUserId,
  maxVisibleUsers = 8,
  showTypingIndicators = true,
  showCursorPositions = true,
  showActivityStatus = true,
  showConnectionStatus = true,
  className = '',
  onUserClick
}: UserPresenceIndicatorsProps) {
  const { collaborationManager, awareness, isConnected } = useCollaboration()
  const [presenceData, setPresenceData] = useState<Map<string, UserPresence>>(new Map())
  const [isExpanded, setIsExpanded] = useState(false)
  const [hoveredUser, setHoveredUser] = useState<string | null>(null)

  /**
   * Generate consistent color for user
   */
  const getUserColor = useCallback((userId: string): string => {
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash + userId.charCodeAt(i)) & 0xffffffff
    }
    return USER_COLORS[Math.abs(hash) % USER_COLORS.length]
  }, [])

  /**
   * Update user presence data
   */
  const updatePresence = useCallback((position: { line: number; column: number }, selection?: any) => {
    if (!awareness || !collaborationManager) return

    const presence: Partial<UserPresence> = {
      userId: currentUserId,
      position,
      selection,
      isTyping: true,
      isActive: true,
      lastActivity: Date.now(),
      connectionStatus: isConnected ? 'connected' : 'disconnected',
      metadata: {
        device: getDeviceType(),
        browser: getBrowserInfo(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    }

    awareness.setLocalStateField('presence', presence)

    // Clear typing indicator after timeout
    setTimeout(() => {
      const currentPresence = awareness.getLocalState()?.presence
      if (currentPresence && currentPresence.lastActivity === presence.lastActivity) {
        awareness.setLocalStateField('presence', { ...currentPresence, isTyping: false })
      }
    }, TYPING_TIMEOUT)
  }, [awareness, collaborationManager, currentUserId, isConnected])

  /**
   * Get device type
   */
  const getDeviceType = useCallback((): 'desktop' | 'mobile' | 'tablet' => {
    const userAgent = navigator.userAgent
    if (/tablet|ipad|playbook|silk/i.test(userAgent)) return 'tablet'
    if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) return 'mobile'
    return 'desktop'
  }, [])

  /**
   * Get browser info
   */
  const getBrowserInfo = useCallback((): string => {
    const userAgent = navigator.userAgent
    if (userAgent.includes('Chrome')) return 'Chrome'
    if (userAgent.includes('Firefox')) return 'Firefox'
    if (userAgent.includes('Safari')) return 'Safari'
    if (userAgent.includes('Edge')) return 'Edge'
    return 'Unknown'
  }, [])

  /**
   * Handle awareness updates
   */
  useEffect(() => {
    if (!awareness) return

    const handleAwarenessUpdate = () => {
      const states = awareness.getStates()
      const newPresenceData = new Map<string, UserPresence>()

      states.forEach((state, clientId) => {
        if (state.presence && state.presence.userId !== currentUserId) {
          const user = state.user || {}
          const presence: UserPresence = {
            userId: state.presence.userId,
            userName: user.name || `User ${state.presence.userId.slice(0, 8)}`,
            userAvatar: user.avatar,
            userColor: getUserColor(state.presence.userId),
            position: state.presence.position || { line: 0, column: 0 },
            selection: state.presence.selection,
            isTyping: state.presence.isTyping || false,
            isActive: Date.now() - (state.presence.lastActivity || 0) < ACTIVITY_THRESHOLD,
            lastActivity: state.presence.lastActivity || 0,
            connectionStatus: state.presence.connectionStatus || 'connected',
            viewport: state.presence.viewport,
            metadata: state.presence.metadata
          }
          newPresenceData.set(state.presence.userId, presence)
        }
      })

      setPresenceData(newPresenceData)
    }

    awareness.on('update', handleAwarenessUpdate)
    handleAwarenessUpdate() // Initial load

    return () => {
      awareness.off('update', handleAwarenessUpdate)
    }
  }, [awareness, currentUserId, getUserColor])

  /**
   * Expose updatePresence for parent components
   */
  useEffect(() => {
    if (collaborationManager) {
      (collaborationManager as any).updatePresence = updatePresence
    }
  }, [collaborationManager, updatePresence])

  /**
   * Get sorted and filtered users
   */
  const displayUsers = useMemo(() => {
    const users = Array.from(presenceData.values())
      .filter(user => user.isActive)
      .sort((a, b) => {
        // Sort by activity, then by name
        if (a.isTyping !== b.isTyping) return a.isTyping ? -1 : 1
        return a.userName.localeCompare(b.userName)
      })

    return isExpanded ? users : users.slice(0, maxVisibleUsers)
  }, [presenceData, isExpanded, maxVisibleUsers])

  /**
   * Get total user count
   */
  const totalUsers = useMemo(() => {
    return Array.from(presenceData.values()).filter(user => user.isActive).length
  }, [presenceData])

  /**
   * Render user avatar with status
   */
  const renderUserAvatar = useCallback((user: UserPresence, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClasses = {
      sm: 'w-6 h-6',
      md: 'w-8 h-8',
      lg: 'w-10 h-10'
    }

    return (
      <div className="relative">
        {/* Avatar */}
        <div 
          className={`${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-medium text-xs relative overflow-hidden`}
          style={{ backgroundColor: user.userColor }}
        >
          {user.userAvatar ? (
            <img 
              src={user.userAvatar} 
              alt={user.userName}
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-4 h-4" />
          )}
        </div>

        {/* Connection status indicator */}
        {showConnectionStatus && (
          <div className="absolute -bottom-0.5 -right-0.5">
            <div className={`w-3 h-3 rounded-full border-2 border-white ${
              user.connectionStatus === 'connected' ? 'bg-green-500' :
              user.connectionStatus === 'connecting' ? 'bg-yellow-500' :
              'bg-red-500'
            }`} />
          </div>
        )}

        {/* Typing indicator */}
        {showTypingIndicators && user.isTyping && (
          <motion.div
            className="absolute -top-1 -right-1"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <div className="w-3 h-3 bg-blue-500 rounded-full border border-white" />
          </motion.div>
        )}
      </div>
    )
  }, [showConnectionStatus, showTypingIndicators])

  /**
   * Render user tooltip
   */
  const renderUserTooltip = useCallback((user: UserPresence) => (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50"
    >
      <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-2 rounded-lg shadow-lg text-xs whitespace-nowrap">
        <div className="font-medium">{user.userName}</div>
        {showActivityStatus && (
          <div className="text-gray-300 dark:text-gray-600 mt-1 flex items-center gap-1">
            <Activity className="w-3 h-3" />
            {user.isTyping ? 'Typing...' : `Line ${user.position.line + 1}`}
          </div>
        )}
        {user.metadata && (
          <div className="text-gray-400 dark:text-gray-500 text-xs mt-1">
            {user.metadata.device} • {user.metadata.browser}
          </div>
        )}
        {/* Arrow */}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-100" />
      </div>
    </motion.div>
  ), [showActivityStatus])

  /**
   * Render typing users list
   */
  const typingUsers = useMemo(() => {
    return displayUsers.filter(user => user.isTyping)
  }, [displayUsers])

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Main presence indicators */}
      <div className="flex items-center gap-2">
        {/* User avatars */}
        <div className="flex items-center -space-x-1">
          <AnimatePresence>
            {displayUsers.map((user) => (
              <motion.div
                key={user.userId}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="relative"
                onMouseEnter={() => setHoveredUser(user.userId)}
                onMouseLeave={() => setHoveredUser(null)}
                onClick={() => onUserClick?.(user)}
              >
                {renderUserAvatar(user)}
                
                {/* Tooltip */}
                <AnimatePresence>
                  {hoveredUser === user.userId && renderUserTooltip(user)}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* More users indicator */}
          {totalUsers > maxVisibleUsers && !isExpanded && (
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setIsExpanded(true)}
              className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 text-xs font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              +{totalUsers - maxVisibleUsers}
            </motion.button>
          )}
        </div>

        {/* Connection status */}
        {showConnectionStatus && (
          <div className="flex items-center gap-1 ml-2">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {totalUsers} online
            </span>
          </div>
        )}

        {/* Collapse button */}
        {isExpanded && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setIsExpanded(false)}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 ml-2"
          >
            Show less
          </motion.button>
        )}
      </div>

      {/* Typing indicators */}
      {showTypingIndicators && typingUsers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-2 text-xs text-gray-500 dark:text-gray-400"
        >
          <div className="flex items-center gap-1">
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="flex gap-0.5"
            >
              <div className="w-1 h-1 bg-blue-500 rounded-full" />
              <div className="w-1 h-1 bg-blue-500 rounded-full" />
              <div className="w-1 h-1 bg-blue-500 rounded-full" />
            </motion.div>
            <span>
              {typingUsers.length === 1 
                ? `${typingUsers[0].userName} is typing...`
                : `${typingUsers.length} people are typing...`
              }
            </span>
          </div>
        </motion.div>
      )}

      {/* Expanded user list */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 max-h-64 overflow-y-auto"
          >
            <div className="space-y-2">
              {Array.from(presenceData.values()).map((user) => (
                <div
                  key={user.userId}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => onUserClick?.(user)}
                >
                  {renderUserAvatar(user, 'sm')}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {user.userName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      {user.isTyping ? (
                        <>
                          <motion.div
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 1, repeat: Infinity }}
                            className="w-2 h-2 bg-blue-500 rounded-full"
                          />
                          Typing...
                        </>
                      ) : (
                        <>
                          <Cursor className="w-3 h-3" />
                          Line {user.position.line + 1}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                    <Clock className="w-3 h-3" />
                    {user.isActive ? 'Active' : 'Away'}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}