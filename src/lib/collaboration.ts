/**
 * Real-time Collaborative Editing Infrastructure
 * 
 * Implements Yjs CRDT for conflict-free collaborative editing
 * with WebSocket synchronization and persistence
 * 
 * Staff Engineer Implementation - Production-ready collaborative editing
 */

import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'

export interface CollaborationUser {
  id: string
  name: string
  email: string
  color: string
  cursor?: {
    line: number
    column: number
  }
}

export interface CollaborationSession {
  documentId: string
  projectId: string
  filePath: string
  users: Map<string, CollaborationUser>
  doc: Y.Doc
  provider?: WebsocketProvider
  persistence?: IndexeddbPersistence
}

export class CollaborationManager {
  private sessions = new Map<string, CollaborationSession>()
  private currentUser: CollaborationUser | null = null
  private wsUrl: string

  constructor(wsUrl: string = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001') {
    this.wsUrl = wsUrl
  }

  /**
   * Initialize collaboration for the current user
   */
  setCurrentUser(user: CollaborationUser): void {
    this.currentUser = user
  }

  /**
   * Create or join a collaborative editing session
   */
  async joinSession(
    documentId: string,
    projectId: string,
    filePath: string
  ): Promise<CollaborationSession> {
    if (this.sessions.has(documentId)) {
      return this.sessions.get(documentId)!
    }

    if (!this.currentUser) {
      throw new Error('Current user must be set before joining a session')
    }

    // Create Yjs document
    const doc = new Y.Doc()
    
    // Set up WebSocket provider for real-time sync
    const wsProvider = new WebsocketProvider(
      this.wsUrl,
      `vibecode-doc-${documentId}`,
      doc,
      {
        params: {
          projectId,
          filePath,
          userId: this.currentUser.id
        }
      }
    )

    // Set up IndexedDB persistence for offline support
    const persistence = new IndexeddbPersistence(
      `vibecode-doc-${documentId}`,
      doc
    )

    // Create session
    const session: CollaborationSession = {
      documentId,
      projectId,
      filePath,
      users: new Map(),
      doc,
      provider: wsProvider,
      persistence
    }

    // Add current user to session
    session.users.set(this.currentUser.id, this.currentUser)

    // Set up awareness for user presence
    if (wsProvider.awareness) {
      wsProvider.awareness.setLocalStateField('user', {
        id: this.currentUser.id,
        name: this.currentUser.name,
        email: this.currentUser.email,
        color: this.currentUser.color
      })
    }

    // Listen for user changes
    wsProvider.awareness?.on('change', () => {
      const states = wsProvider.awareness?.getStates()
      if (states) {
        session.users.clear()
        states.forEach((state, clientId) => {
          if (state.user) {
            session.users.set(state.user.id, state.user)
          }
        })
      }
    })

    this.sessions.set(documentId, session)
    return session
  }

  /**
   * Leave a collaborative session
   */
  async leaveSession(documentId: string): Promise<void> {
    const session = this.sessions.get(documentId)
    if (!session) return

    // Clean up providers
    session.provider?.destroy()
    session.persistence?.destroy()

    // Remove session
    this.sessions.delete(documentId)
  }

  /**
   * Get text content from Yjs document
   */
  getText(session: CollaborationSession, key: string = 'content'): Y.Text {
    return session.doc.getText(key)
  }

  /**
   * Get shared map for metadata
   */
  getMap(session: CollaborationSession, key: string = 'metadata'): Y.Map<any> {
    return session.doc.getMap(key)
  }

  /**
   * Update cursor position for current user
   */
  updateCursor(session: CollaborationSession, line: number, column: number): void {
    if (!this.currentUser || !session.provider?.awareness) return

    this.currentUser.cursor = { line, column }
    session.provider.awareness.setLocalStateField('user', {
      ...session.provider.awareness.getLocalState()?.user,
      cursor: { line, column }
    })
  }

  /**
   * Get all active users in a session
   */
  getActiveUsers(session: CollaborationSession): CollaborationUser[] {
    return Array.from(session.users.values())
  }

  /**
   * Generate a unique color for a user
   */
  static generateUserColor(userId: string): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
      '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD',
      '#00D2D3', '#FF9F43', '#EE5A6F', '#8ED1FC'
    ]
    
    // Generate consistent color based on user ID
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash)
    }
    
    return colors[Math.abs(hash) % colors.length]
  }

  /**
   * Apply conflict resolution for simultaneous edits
   */
  resolveConflicts(session: CollaborationSession): void {
    // Yjs automatically handles conflict resolution through CRDT
    // This method can be extended for custom conflict resolution logic
    
    const metadata = this.getMap(session)
    const conflictCount = metadata.get('conflicts') || 0
    metadata.set('conflicts', conflictCount + 1)
    metadata.set('lastResolved', Date.now())
  }

  /**
   * Get collaboration statistics
   */
  getStats(session: CollaborationSession): {
    userCount: number
    documentSize: number
    conflicts: number
    lastActivity: number
  } {
    const metadata = this.getMap(session)
    const textContent = this.getText(session)
    
    return {
      userCount: session.users.size,
      documentSize: textContent.length,
      conflicts: metadata.get('conflicts') || 0,
      lastActivity: metadata.get('lastActivity') || Date.now()
    }
  }

  /**
   * Cleanup all sessions
   */
  async destroy(): Promise<void> {
    for (const [documentId] of this.sessions) {
      await this.leaveSession(documentId)
    }
  }
}

// Global collaboration manager instance
export const collaborationManager = new CollaborationManager()