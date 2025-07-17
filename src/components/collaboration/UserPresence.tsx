/**
 * User Presence Component
 *
 * Displays active collaborators and their status in real-time
 * Shows user avatars, cursor positions, and activity indicators
 *
 * Staff Engineer Implementation - Production-ready user presence UI
 */

'use client'

import React, { useState, useEffect } from 'react'
import { CollaborationUser } from '@/lib/collaboration'

interface UserPresenceProps {
  users: CollaborationUser[]
  currentUserId: string
  maxVisible?: number
  showCursors?: boolean
  className?: string
}

interface UserActivityStatus {
  user: CollaborationUser
  isActive: boolean
  lastSeen: Date
  isTyping?: boolean
  cursorPosition?: {
    line: number
    column: number
  }
}

export const UserPresence: React.FC<UserPresenceProps> = ({
  users,
  currentUserId,
  maxVisible = 5,
  showCursors = true,
  className = ''
}) => {
  const [userStatuses, setUserStatuses] = useState<UserActivityStatus[]>([])
  const [showAllUsers, setShowAllUsers] = useState(false)

  /**
   * Update user activity statuses
   */
  useEffect(() => {
    const statuses: UserActivityStatus[] = users
      .filter(user => user.id !== currentUserId)
      .map(user => ({
        user,
        isActive: true, // Assume active if in the list
        lastSeen: new Date(),
        isTyping: false, // This would be updated via awareness events
        cursorPosition: user.cursor
      }))

    setUserStatuses(statuses)
  }, [users, currentUserId])

  /**
   * Get display name for user
   */
  const getDisplayName = (user: CollaborationUser): string => {
    return user.name || user.email.split('@')[0]
  }

  /**
   * Get user initials for avatar
   */
  const getUserInitials = (user: CollaborationUser): string => {
    const name = getDisplayName(user)
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  /**
   * Format time since last activity
   */
  const getTimeSince = (date: Date): string => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)

    if (minutes < 1) return 'now'
    if (minutes < 60) return `${minutes}m ago`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`

    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  /**
   * Get cursor position text
   */
  const getCursorText = (position?: { line: number; column: number }): string => {
    if (!position) return ''
    return `Line ${position.line + 1}, Col ${position.column + 1}`
  }

  const visibleUsers = showAllUsers ? userStatuses : userStatuses.slice(0, maxVisible)
  const remainingCount = userStatuses.length - maxVisible

  if (userStatuses.length === 0) {
    return (
      <div className={`user-presence ${className}`}>
        <div className="flex items-center text-sm text-gray-500">
          <div className="w-2 h-2 rounded-full bg-gray-300 mr-2" />
          Working alone
        </div>
      </div>
    )
  }

  return (
    <div className={`user-presence ${className}`}>
      <div className="flex items-center gap-2">
        {/* Active Users Count */}
        <div className="flex items-center text-sm text-gray-600">
          <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
          <span className="font-medium">
            {userStatuses.length} collaborator{userStatuses.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* User Avatars */}
        <div className="flex items-center -space-x-2">
          {visibleUsers.map(({ user, isActive, isTyping, cursorPosition }) => (
            <div
              key={user.id}
              className="relative group"
            >
              {/* User Avatar */}
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium
                  border-2 border-white shadow-sm cursor-pointer transition-transform hover:scale-110
                  ${isActive ? 'ring-2 ring-green-400 ring-offset-1' : ''}
                  ${isTyping ? 'animate-pulse' : ''}
                `}
                style={{ backgroundColor: user.color }}
                title={`${getDisplayName(user)} (${user.email})`}
              >
                {getUserInitials(user)}

                {/* Activity Indicator */}
                {isActive && (
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-white" />
                )}

                {/* Typing Indicator */}
                {isTyping && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border border-white animate-bounce" />
                )}
              </div>

              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap">
                  <div className="font-medium">{getDisplayName(user)}</div>
                  <div className="text-gray-300">{user.email}</div>
                  {showCursors && cursorPosition && (
                    <div className="text-gray-400 text-xs mt-1">
                      {getCursorText(cursorPosition)}
                    </div>
                  )}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
              </div>
            </div>
          ))}

          {/* Show More Button */}
          {remainingCount > 0 && !showAllUsers && (
            <button
              onClick={() => setShowAllUsers(true)}
              className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white shadow-sm flex items-center justify-center text-xs font-medium text-gray-600 hover:bg-gray-300 transition-colors"
              title={`Show ${remainingCount} more collaborator${remainingCount !== 1 ? 's' : ''}`}
            >
              +{remainingCount}
            </button>
          )}

          {/* Show Less Button */}
          {showAllUsers && userStatuses.length > maxVisible && (
            <button
              onClick={() => setShowAllUsers(false)}
              className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white shadow-sm flex items-center justify-center text-xs font-medium text-gray-600 hover:bg-gray-300 transition-colors"
              title="Show less"
            >
              −
            </button>
          )}
        </div>
      </div>

      {/* Detailed User List (when expanded) */}
      {showAllUsers && userStatuses.length > maxVisible && (
        <div className="absolute top-full right-0 mt-2 bg-white rounded-lg shadow-lg border p-3 min-w-64 z-20">
          <div className="text-sm font-medium text-gray-900 mb-2">
            Active Collaborators
          </div>
          <div className="space-y-2">
            {userStatuses.map(({ user, isActive, lastSeen, isTyping, cursorPosition }) => (
              <div key={user.id} className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                  style={{ backgroundColor: user.color }}
                >
                  {getUserInitials(user)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {getDisplayName(user)}
                    </span>
                    {isActive && (
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                    )}
                    {isTyping && (
                      <span className="text-xs text-blue-600 animate-pulse">
                        typing...
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {user.email}
                  </div>
                  {showCursors && cursorPosition && (
                    <div className="text-xs text-gray-400">
                      {getCursorText(cursorPosition)}
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  {getTimeSince(lastSeen)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default UserPresence

export { type UserPresenceProps, type UserActivityStatus }
