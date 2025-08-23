/**
 * Collaborative Code Editor Component
 *
 * Integrates CodeMirror 6 with Yjs CRDT for real-time collaborative editing
 * Supports syntax highlighting, user presence, and conflict resolution
 *
 * Staff Engineer Implementation - Production-ready collaborative code editor
 */

'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState, Extension } from '@codemirror/state'
import { basicSetup } from '@codemirror/basic-setup'
import { javascript } from '@codemirror/lang-javascript'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { yCollab } from 'y-codemirror.next'
import * as Y from 'yjs'

import {
  CollaborationManager,
  CollaborationSession,
  CollaborationUser,
  collaborationManager
} from '@/lib/collaboration'

interface CollaborativeEditorProps {
  documentId: string
  projectId: string
  filePath: string
  language?: 'javascript' | 'typescript' | 'html' | 'css' | 'json' | 'markdown'
  initialContent?: string
  currentUser: CollaborationUser
  onContentChange?: (content: string) => void
  onUserJoin?: (user: CollaborationUser) => void
  onUserLeave?: (user: CollaborationUser) => void
  className?: string
  readOnly?: boolean
}

interface UserPresenceIndicator {
  user: CollaborationUser
  isActive: boolean
  lastSeen: Date
}

export const CollaborativeEditor: React.FC<CollaborativeEditorProps> = ({
  documentId,
  projectId,
  filePath,
  language = 'javascript',
  initialContent = '',
  currentUser,
  onContentChange,
  onUserJoin,
  onUserLeave,
  className = '',
  readOnly = false
}) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const sessionRef = useRef<CollaborationSession | null>(null)

  const [users, setUsers] = useState<UserPresenceIndicator[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  /**
   * Get language extension for CodeMirror
   */
  const getLanguageExtension = useCallback((): Extension => {
    switch (language) {
      case 'javascript':
      case 'typescript':
        return javascript()
      case 'html':
        return html()
      case 'css':
        return css()
      default:
        return javascript() // Default fallback
    }
  }, [language])

  /**
   * Initialize collaborative editing session
   */
  const initializeCollaboration = useCallback(async () => {
    try {
      setConnectionError(null)

      // Set current user in collaboration manager
      collaborationManager.setCurrentUser(currentUser)

      // Join collaboration session
      const session = await collaborationManager.joinSession(
        documentId,
        projectId,
        filePath
      )

      sessionRef.current = session

      // Get or create text content
      const yText = collaborationManager.getText(session)

      // Initialize content if empty
      if (yText.length === 0 && initialContent) {
        yText.insert(0, initialContent)
      }

      // Create CodeMirror extensions
      const extensions: Extension[] = [
        basicSetup,
        getLanguageExtension(),
        yCollab(yText, session.provider?.awareness || null),
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '14px'
          },
          '.cm-editor': {
            height: '100%'
          },
          '.cm-scroller': {
            height: '100%'
          }
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const content = update.state.doc.toString()
            onContentChange?.(content)

            // Update metadata
            const metadata = collaborationManager.getMap(session)
            metadata.set('lastActivity', Date.now())
            metadata.set('lastEditBy', currentUser.id)
          }

          // Update cursor position
          if (update.selectionSet) {
            const cursor = update.state.selection.main.head
            const line = update.state.doc.lineAt(cursor)
            collaborationManager.updateCursor(
              session,
              line.number - 1,
              cursor - line.from
            )
          }
        })
      ]

      // Add read-only extension if needed
      if (readOnly) {
        extensions.push(EditorState.readOnly.of(true))
      }

      // Create editor state
      const state = EditorState.create({
        doc: yText.toString(),
        extensions
      })

      // Create editor view
      if (editorRef.current) {
        viewRef.current = new EditorView({
          state,
          parent: editorRef.current
        })
      }

      // Set up connection status monitoring
      if (session.provider) {
        session.provider.on('status', ({ status }: { status: string }) => {
          setIsConnected(status === 'connected')
          if (status === 'disconnected') {
            setConnectionError('Connection lost. Attempting to reconnect...')
          } else if (status === 'connected') {
            setConnectionError(null)
          }
        })

        session.provider.on('connection-error', (error: Error) => {
          setConnectionError(`Connection error: ${error.message}`)
        })
      }

      // Monitor user presence
      const updateUserPresence = () => {
        if (session.provider?.awareness) {
          const activeUsers = collaborationManager.getActiveUsers(session)
          const userIndicators: UserPresenceIndicator[] = activeUsers.map(user => ({
            user,
            isActive: user.id !== currentUser.id, // Current user is always active
            lastSeen: new Date()
          }))

          setUsers(userIndicators)
        }
      }

      // Set up user presence monitoring
      if (session.provider?.awareness) {
        session.provider.awareness.on('change', updateUserPresence)
        updateUserPresence()
      }

      setIsConnected(true)

    } catch (error) {
      console.error('Failed to initialize collaboration:', error)
      setConnectionError(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [documentId, projectId, filePath, currentUser, initialContent, getLanguageExtension, onContentChange, readOnly])

  /**
   * Cleanup collaboration session
   */
  const cleanup = useCallback(async () => {
    if (viewRef.current) {
      viewRef.current.destroy()
      viewRef.current = null
    }

    if (sessionRef.current) {
      await collaborationManager.leaveSession(documentId)
      sessionRef.current = null
    }
  }, [documentId])

  /**
   * Handle user join/leave events
   */
  useEffect(() => {
    if (!sessionRef.current?.provider?.awareness) return

    const awareness = sessionRef.current.provider.awareness

    const handleAwarenessChange = () => {
      const currentUsers = collaborationManager.getActiveUsers(sessionRef.current!)
      const previousUserIds = new Set(users.map(u => u.user.id))
      const currentUserIds = new Set(currentUsers.map(u => u.id))

      // Detect new users
      currentUsers.forEach(user => {
        if (!previousUserIds.has(user.id) && user.id !== currentUser.id) {
          onUserJoin?.(user)
        }
      })

      // Detect users who left
      users.forEach(({ user }) => {
        if (!currentUserIds.has(user.id) && user.id !== currentUser.id) {
          onUserLeave?.(user)
        }
      })
    }

    awareness.on('change', handleAwarenessChange)

    return () => {
      awareness.off('change', handleAwarenessChange)
    }
  }, [users, currentUser.id, onUserJoin, onUserLeave])

  // Initialize collaboration on mount
  useEffect(() => {
    initializeCollaboration()
    return cleanup
  }, [initializeCollaboration, cleanup])

  /**
   * Get file content for saving
   */
  const getContent = useCallback((): string => {
    return viewRef.current?.state.doc.toString() || ''
  }, [])

  /**
   * Set editor content programmatically
   */
  const setContent = useCallback((content: string) => {
    if (sessionRef.current) {
      const yText = collaborationManager.getText(sessionRef.current)
      yText.delete(0, yText.length)
      yText.insert(0, content)
    }
  }, [])

  /**
   * Get collaboration statistics
   */
  const getStats = useCallback(() => {
    if (!sessionRef.current) return null
    return collaborationManager.getStats(sessionRef.current)
  }, [])

  return (
    <div className={`collaborative-editor ${className}`}>
      {/* Connection Status */}
      <div className="flex items-center justify-between p-2 bg-gray-50 border-b text-sm">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className={isConnected ? 'text-green-700' : 'text-red-700'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          {connectionError && (
            <span className="text-red-600 text-xs">({connectionError})</span>
          )}
        </div>

        {/* Active Users */}
        <div className="flex items-center gap-1">
          {users.length > 0 && (
            <span className="text-gray-600 text-xs mr-2">
              {users.length} collaborator{users.length !== 1 ? 's' : ''}
            </span>
          )}
          {users.map(({ user }) => (
            <div
              key={user.id}
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
              style={{ backgroundColor: user.color }}
              title={`${user.name} (${user.email})`}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      </div>

      {/* Editor Container */}
      <div
        ref={editorRef}
        className="flex-1 overflow-hidden"
        style={{ height: 'calc(100% - 41px)' }}
      />
    </div>
  )
}

export default CollaborativeEditor

// Export utilities for external use
export { type CollaborativeEditorProps, type UserPresenceIndicator }
