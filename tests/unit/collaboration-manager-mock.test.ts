/**
 * Unit tests for Collaboration Manager Mock
 * Tests extracted stub logic behavior for reliable mocking
 */

import { MockCollaborationManager } from '../../__mocks__/collaboration-manager'
import type { CollaborationUser, CollaborationSession } from '../../__mocks__/collaboration-manager'

describe('MockCollaborationManager', () => {
  let manager: MockCollaborationManager

  beforeEach(() => {
    manager = new MockCollaborationManager()
  })

  afterEach(() => {
    manager.clearAllSessions()
  })

  const mockUser1: CollaborationUser = {
    id: 'user-1',
    name: 'Alice',
    email: 'alice@example.com',
    color: '#ff0000'
  }

  const mockUser2: CollaborationUser = {
    id: 'user-2',
    name: 'Bob',
    email: 'bob@example.com',
    color: '#00ff00'
  }

  describe('setCurrentUser', () => {
    it('should set current user', () => {
      manager.setCurrentUser(mockUser1)
      
      // Verify by joining a session and checking if user is added
      return manager.joinSession('doc-1', 'project-1', 'file.ts').then(session => {
        expect(session.users.has(mockUser1.id)).toBe(true)
        expect(session.users.get(mockUser1.id)).toEqual(mockUser1)
      })
    })
  })

  describe('joinSession', () => {
    it('should create new session when none exists', async () => {
      manager.setCurrentUser(mockUser1)
      
      const session = await manager.joinSession('doc-1', 'project-1', 'file.ts')
      
      expect(session).toBeDefined()
      expect(session.documentId).toBe('doc-1')
      expect(session.projectId).toBe('project-1')
      expect(session.filePath).toBe('file.ts')
      expect(session.users.size).toBe(1)
      expect(session.users.has(mockUser1.id)).toBe(true)
      expect(session.doc).toBeDefined()
      expect(session.provider).toBeDefined()
    })

    it('should join existing session', async () => {
      manager.setCurrentUser(mockUser1)
      const session1 = await manager.joinSession('doc-1', 'project-1', 'file.ts')
      
      manager.setCurrentUser(mockUser2)
      const session2 = await manager.joinSession('doc-1', 'project-1', 'file.ts')
      
      expect(session1).toBe(session2) // Same session object
      expect(session2.users.size).toBe(2)
      expect(session2.users.has(mockUser1.id)).toBe(true)
      expect(session2.users.has(mockUser2.id)).toBe(true)
    })

    it('should handle joining without current user', async () => {
      const session = await manager.joinSession('doc-1', 'project-1', 'file.ts')
      
      expect(session.users.size).toBe(0)
    })
  })

  describe('getText', () => {
    it('should return Y.Text instance for content', async () => {
      manager.setCurrentUser(mockUser1)
      const session = await manager.joinSession('doc-1', 'project-1', 'file.ts')
      
      const text = manager.getText(session)
      expect(text).toBeDefined()
      expect(typeof text.toString).toBe('function')
    })

    it('should return Y.Text instance for custom key', async () => {
      manager.setCurrentUser(mockUser1)
      const session = await manager.joinSession('doc-1', 'project-1', 'file.ts')
      
      const text = manager.getText(session, 'custom-content')
      expect(text).toBeDefined()
    })
  })

  describe('getMap', () => {
    it('should return Y.Map instance for metadata', async () => {
      manager.setCurrentUser(mockUser1)
      const session = await manager.joinSession('doc-1', 'project-1', 'file.ts')
      
      const map = manager.getMap(session)
      expect(map).toBeDefined()
      expect(typeof map.set).toBe('function')
      expect(typeof map.get).toBe('function')
    })

    it('should return Y.Map instance for custom key', async () => {
      manager.setCurrentUser(mockUser1)
      const session = await manager.joinSession('doc-1', 'project-1', 'file.ts')
      
      const map = manager.getMap(session, 'custom-metadata')
      expect(map).toBeDefined()
    })
  })

  describe('updateCursor', () => {
    it('should update current user cursor position', async () => {
      manager.setCurrentUser(mockUser1)
      const session = await manager.joinSession('doc-1', 'project-1', 'file.ts')
      
      manager.updateCursor(session, 10, 5)
      
      const user = session.users.get(mockUser1.id)
      expect(user?.cursor).toEqual({ line: 10, column: 5 })
    })

    it('should handle null session', () => {
      manager.setCurrentUser(mockUser1)
      expect(() => manager.updateCursor(null, 10, 5)).not.toThrow()
    })

    it('should handle no current user', async () => {
      const session = await manager.joinSession('doc-1', 'project-1', 'file.ts')
      expect(() => manager.updateCursor(session, 10, 5)).not.toThrow()
    })
  })

  describe('getActiveUsers', () => {
    it('should return empty array for null session', () => {
      const users = manager.getActiveUsers(null)
      expect(users).toEqual([])
    })

    it('should return all users in session', async () => {
      manager.setCurrentUser(mockUser1)
      const session1 = await manager.joinSession('doc-1', 'project-1', 'file.ts')
      
      manager.setCurrentUser(mockUser2)
      await manager.joinSession('doc-1', 'project-1', 'file.ts')
      
      const users = manager.getActiveUsers(session1)
      expect(users).toHaveLength(2)
      expect(users).toContainEqual(mockUser1)
      expect(users).toContainEqual(mockUser2)
    })
  })

  describe('leaveSession', () => {
    it('should remove current user from session', async () => {
      manager.setCurrentUser(mockUser1)
      const session = await manager.joinSession('doc-1', 'project-1', 'file.ts')
      
      expect(session.users.has(mockUser1.id)).toBe(true)
      
      await manager.leaveSession('doc-1')
      
      expect(session.users.has(mockUser1.id)).toBe(false)
    })

    it('should remove session when no users left', async () => {
      manager.setCurrentUser(mockUser1)
      await manager.joinSession('doc-1', 'project-1', 'file.ts')
      
      await manager.leaveSession('doc-1')
      
      expect(manager.getSession('doc-1')).toBeUndefined()
    })

    it('should handle leaving non-existent session', async () => {
      manager.setCurrentUser(mockUser1)
      await expect(manager.leaveSession('non-existent')).resolves.toBeUndefined()
    })
  })

  describe('getStats', () => {
    it('should return session statistics', async () => {
      manager.setCurrentUser(mockUser1)
      const session = await manager.joinSession('doc-1', 'project-1', 'file.ts')
      
      const stats = manager.getStats(session)
      
      expect(stats).toBeDefined()
      expect(stats.userCount).toBe(1)
      expect(stats.documentSize).toBe(0) // Empty document
      expect(stats.conflicts).toBe(0)
      expect(typeof stats.lastActivity).toBe('number')
    })

    it('should reflect updated user count', async () => {
      manager.setCurrentUser(mockUser1)
      const session = await manager.joinSession('doc-1', 'project-1', 'file.ts')
      
      manager.setCurrentUser(mockUser2)
      await manager.joinSession('doc-1', 'project-1', 'file.ts')
      
      const stats = manager.getStats(session)
      expect(stats.userCount).toBe(2)
    })
  })

  describe('test helpers', () => {
    it('should clear all sessions', async () => {
      manager.setCurrentUser(mockUser1)
      await manager.joinSession('doc-1', 'project-1', 'file.ts')
      await manager.joinSession('doc-2', 'project-1', 'file2.ts')
      
      expect(manager.getSession('doc-1')).toBeDefined()
      expect(manager.getSession('doc-2')).toBeDefined()
      
      manager.clearAllSessions()
      
      expect(manager.getSession('doc-1')).toBeUndefined()
      expect(manager.getSession('doc-2')).toBeUndefined()
    })

    it('should get session by document ID', async () => {
      manager.setCurrentUser(mockUser1)
      const session = await manager.joinSession('doc-1', 'project-1', 'file.ts')
      
      const retrieved = manager.getSession('doc-1')
      expect(retrieved).toBe(session)
    })

    it('should add user to existing session', async () => {
      manager.setCurrentUser(mockUser1)
      const session = await manager.joinSession('doc-1', 'project-1', 'file.ts')
      
      manager.addUserToSession('doc-1', mockUser2)
      
      expect(session.users.has(mockUser2.id)).toBe(true)
      expect(session.users.get(mockUser2.id)).toEqual(mockUser2)
    })
  })
})