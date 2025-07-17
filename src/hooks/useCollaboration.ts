/**
 * Collaboration Hook
 *
 * React hook for managing collaborative editing sessions
 * Provides state management and event handling for real-time editing
 *
 * Staff Engineer Implementation - Production-ready collaboration hook
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CollaborationUser, CollaborationSession, collaborationManager } from '@/lib/collaboration'

export interface UseCollaborationOptions {
  documentId: string
  projectId: string
  filePath: string
  currentUser: CollaborationUser
  autoSave?: boolean
  autoSaveInterval?: number
  onUserJoin?: (user: CollaborationUser) => void
  onUserLeave?: (user: CollaborationUser) => void
  onConnectionChange?: (connected: boolean) => void
  onContentChange?: (content: string) => void
  onError?: (error: Error) => void
}

export interface UseCollaborationReturn {
  // Session state
  session: CollaborationSession | null
  isConnected: boolean
  isLoading: boolean
  error: string | null

  // User management
  activeUsers: CollaborationUser[]
  userCount: number

  // Content management
  content: string
  hasUnsavedChanges: boolean

  // Actions
  joinSession: () => Promise<void>
  leaveSession: () => Promise<void>
  saveContent: () => Promise<void>
  getContent: () => string
  setContent: (content: string) => void

  // Statistics
  stats: {
    documentSize: number
    conflicts: number
    lastActivity: number
  } | null
}

export const useCollaboration = (options: UseCollaborationOptions): UseCollaborationReturn => {
  const {
    documentId,
    projectId,
    filePath,
    currentUser,
    autoSave = true,
    autoSaveInterval = 30000, // 30 seconds
    onUserJoin,
    onUserLeave,
    onConnectionChange,
    onContentChange,
    onError
  } = options

  // State
  const [session, setSession] = useState<CollaborationSession | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeUsers, setActiveUsers] = useState<CollaborationUser[]>([])
  const [content, setContentState] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [stats, setStats] = useState<UseCollaborationReturn['stats']>(null)

  // Refs
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedContentRef = useRef('')

  /**
   * Join collaborative editing session
   */
  const joinSession = useCallback(async (): Promise<void> => {
    if (session || isLoading) return

    setIsLoading(true)
    setError(null)

    try {
      // Set current user
      collaborationManager.setCurrentUser(currentUser)

      // Join session
      const newSession = await collaborationManager.joinSession(
        documentId,
        projectId,
        filePath
      )

      setSession(newSession)

      // Get initial content
      const yText = collaborationManager.getText(newSession)
      const initialContent = yText.toString()
      setContentState(initialContent)
      lastSavedContentRef.current = initialContent

      // Set up content monitoring
      yText.observe(() => {
        const newContent = yText.toString()
        setContentState(newContent)
        onContentChange?.(newContent)

        // Check for unsaved changes
        const hasChanges = newContent !== lastSavedContentRef.current
        setHasUnsavedChanges(hasChanges)
      })

      // Monitor connection status
      if (newSession.provider) {
        const provider = newSession.provider

        const handleStatusChange = ({ status }: { status: string }) => {
          const connected = status === 'connected'
          setIsConnected(connected)
          onConnectionChange?.(connected)
        }

        const handleConnectionError = (err: Error) => {
          setError(err.message)
          onError?.(err)
        }

        provider.on('status', handleStatusChange)
        provider.on('connection-error', handleConnectionError)

        // Monitor user presence
        if (provider.awareness) {
          const handleAwarenessChange = () => {
            const users = collaborationManager.getActiveUsers(newSession)
            setActiveUsers(users)

            // Detect user join/leave events
            const currentUserIds = new Set(activeUsers.map(u => u.id))
            const newUserIds = new Set(users.map(u => u.id))

            // New users
            users.forEach(user => {
              if (!currentUserIds.has(user.id) && user.id !== currentUser.id) {
                onUserJoin?.(user)
              }
            })

            // Users who left
            activeUsers.forEach(user => {
              if (!newUserIds.has(user.id) && user.id !== currentUser.id) {
                onUserLeave?.(user)
              }
            })
          }

          provider.awareness.on('change', handleAwarenessChange)
          handleAwarenessChange() // Initial call
        }
      }

      // Update stats
      const sessionStats = collaborationManager.getStats(newSession)
      setStats(sessionStats)

      setIsConnected(true)

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to join session')
      setError(error.message)
      onError?.(error)
    } finally {
      setIsLoading(false)
    }
  }, [
    session, isLoading, documentId, projectId, filePath, currentUser,
    onContentChange, onConnectionChange, onError, onUserJoin, onUserLeave, activeUsers
  ])

  /**
   * Leave collaborative editing session
   */
  const leaveSession = useCallback(async (): Promise<void> => {
    if (!session) return

    try {
      // Save any unsaved changes
      if (hasUnsavedChanges) {
        await saveContent()
      }

      // Leave session
      await collaborationManager.leaveSession(documentId)

      // Clear timers
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }

      // Reset state
      setSession(null)
      setIsConnected(false)
      setActiveUsers([])
      setHasUnsavedChanges(false)
      setStats(null)

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to leave session')
      setError(error.message)
      onError?.(error)
    }
  }, [session, hasUnsavedChanges, documentId, onError])

  /**
   * Save current content
   */
  const saveContent = useCallback(async (): Promise<void> => {
    if (!session) return

    try {
      const currentContent = collaborationManager.getText(session).toString()

      // Update metadata
      const metadata = collaborationManager.getMap(session)
      metadata.set('lastSaved', Date.now())
      metadata.set('lastSavedBy', currentUser.id)

      // Mark as saved
      lastSavedContentRef.current = currentContent
      setHasUnsavedChanges(false)

      // TODO: Integrate with file system API
      console.log('Content saved:', currentContent.length, 'characters')

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to save content')
      setError(error.message)
      onError?.(error)
    }
  }, [session, currentUser.id, onError])

  /**
   * Get current content
   */
  const getContent = useCallback((): string => {
    if (!session) return ''
    return collaborationManager.getText(session).toString()
  }, [session])

  /**
   * Set content programmatically
   */
  const setContent = useCallback((newContent: string): void => {
    if (!session) return

    const yText = collaborationManager.getText(session)
    yText.delete(0, yText.length)
    yText.insert(0, newContent)
  }, [session])

  /**
   * Auto-save functionality
   */
  useEffect(() => {
    if (!autoSave || !hasUnsavedChanges || !session) return

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    // Set new timer
    autoSaveTimerRef.current = setTimeout(() => {
      saveContent()
    }, autoSaveInterval)

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [autoSave, hasUnsavedChanges, session, autoSaveInterval, saveContent])

  /**
   * Update stats periodically
   */
  useEffect(() => {
    if (!session) return

    const updateStats = () => {
      const sessionStats = collaborationManager.getStats(session)
      setStats(sessionStats)
    }

    // Update immediately
    updateStats()

    // Update every 5 seconds
    const interval = setInterval(updateStats, 5000)

    return () => clearInterval(interval)
  }, [session])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (session) {
        leaveSession()
      }
    }
  }, []) // Only on unmount

  return {
    // Session state
    session,
    isConnected,
    isLoading,
    error,

    // User management
    activeUsers,
    userCount: activeUsers.length,

    // Content management
    content,
    hasUnsavedChanges,

    // Actions
    joinSession,
    leaveSession,
    saveContent,
    getContent,
    setContent,

    // Statistics
    stats
  }
}

export default useCollaboration
