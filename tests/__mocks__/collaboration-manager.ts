/**
 * Mock Collaboration Manager for Testing
 * Extracted from src/components/collaboration/CollaborativeEditor.tsx
 */

import * as Y from 'yjs'

// Types for collaboration - compatible with real lib/collaboration types
export interface CollaborationUser {
  id: string;
  name: string;
  email: string;
  color: string;
  cursor?: {
    line: number;
    column: number;
  };
}

export interface CollaborationSession {
  documentId: string;
  projectId: string;
  filePath: string;
  users: Map<string, CollaborationUser>;
  doc: Y.Doc;
  provider?: {
    awareness?: {
      on: (event: 'change', callback: () => void) => void;
      off: (event: 'change', callback: () => void) => void;
      getStates: () => Map<number, any>;
      setLocalState: (state: any) => void;
      getLocalState: () => any;
    };
  };
}

export class MockCollaborationManager {
  private sessions: Map<string, CollaborationSession> = new Map()
  private currentUser: CollaborationUser | null = null

  setCurrentUser(user: CollaborationUser): void {
    this.currentUser = user
  }
  
  async joinSession(documentId: string, projectId: string, filePath: string): Promise<CollaborationSession> {
    const existingSession = this.sessions.get(documentId)
    if (existingSession) {
      // Add current user to existing session
      if (this.currentUser) {
        existingSession.users.set(this.currentUser.id, this.currentUser)
      }
      return existingSession
    }

    // Create a new mock session
    const doc = new Y.Doc()
    const users = new Map<string, CollaborationUser>()
    
    if (this.currentUser) {
      users.set(this.currentUser.id, this.currentUser)
    }
    
    const session: CollaborationSession = {
      documentId,
      projectId,  
      filePath,
      users,
      doc,
      provider: {
        awareness: {
          on: (event: 'change', callback: () => void) => {
            // Mock awareness event handling
          },
          off: (event: 'change', callback: () => void) => {
            // Mock awareness event handling
          },
          getStates: () => new Map(),
          setLocalState: (state: any) => {
            // Mock local state setting
          },
          getLocalState: () => null,
        }
      }
    }
    
    this.sessions.set(documentId, session)
    return session
  }
  
  getText(session: CollaborationSession, key: string = 'content'): Y.Text {
    return session.doc.getText(key)
  }
  
  getMap(session: CollaborationSession, key: string = 'metadata'): Y.Map<any> {
    return session.doc.getMap(key)
  }
  
  updateCursor(session: CollaborationSession | null, line: number, column: number): void {
    if (!session || !this.currentUser) return
    
    // Update current user's cursor position
    const user = session.users.get(this.currentUser.id)
    if (user) {
      user.cursor = { line, column }
    }
  }
  
  getActiveUsers(session: CollaborationSession | null): CollaborationUser[] {
    if (!session) return []
    return Array.from(session.users.values())
  }
  
  async leaveSession(documentId: string): Promise<void> {
    const session = this.sessions.get(documentId)
    if (session && this.currentUser) {
      session.users.delete(this.currentUser.id)
      
      // If no users left, remove the session
      if (session.users.size === 0) {
        this.sessions.delete(documentId)
      }
    }
  }
  
  getStats(session: CollaborationSession) {
    const metadata = session.doc.getMap('metadata')
    const textContent = session.doc.getText('content')
    
    return {
      userCount: session.users.size,
      documentSize: textContent.length,
      conflicts: metadata.get('conflicts') || 0,
      lastActivity: Date.now()
    }
  }

  /**
   * Test helpers
   */
  clearAllSessions(): void {
    this.sessions.clear()
  }

  getSession(documentId: string): CollaborationSession | undefined {
    return this.sessions.get(documentId)
  }

  addUserToSession(documentId: string, user: CollaborationUser): void {
    const session = this.sessions.get(documentId)
    if (session) {
      session.users.set(user.id, user)
    }
  }
}

// Create default instance for testing
export const mockCollaborationManager = new MockCollaborationManager()

// Export for Jest mocking
export default mockCollaborationManager