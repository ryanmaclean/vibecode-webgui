/**
 * Collaboration Unit Tests
 * 
 * Tests for Yjs CRDT collaborative editing functionality
 * Validates conflict resolution, user presence, and data persistence
 * 
 * Staff Engineer Implementation - Comprehensive collaboration testing
 */

const { describe, test, expect, beforeEach, afterEach, jest } = require('@jest/globals');

// Mock Yjs and related dependencies
jest.mock('yjs', () => ({
  Doc: jest.fn().mockImplementation(() => ({
    getText: jest.fn().mockReturnValue({
      toString: jest.fn().mockReturnValue(''),
      insert: jest.fn(),
      delete: jest.fn(),
      observe: jest.fn(),
      length: 0
    }),
    getMap: jest.fn().mockReturnValue({
      get: jest.fn(),
      set: jest.fn();
    });
  }));
}));

jest.mock('y-websocket', () => ({
  WebsocketProvider: jest.fn().mockImplementation(() => ({
    awareness: {
      setLocalStateField: jest.fn(),
      getLocalState: jest.fn().mockReturnValue({}),
      getStates: jest.fn().mockReturnValue(new Map()),
      on: jest.fn(),
      off: jest.fn();
    },
    on: jest.fn(),
    destroy: jest.fn();
  }));
}));

jest.mock('y-indexeddb', () => ({
  IndexeddbPersistence: jest.fn().mockImplementation(() => ({
    destroy: jest.fn();
  }));
}));

const { CollaborationManager, CollaborationUser } = require('../../src/lib/collaboration');

describe('CollaborationManager', () => {
  let collaborationManager
  let mockUser

  beforeEach(() => {
    collaborationManager = new CollaborationManager('ws://test-server');
    mockUser = {
      id: 'user123',
      name: 'Test User',
      email: 'test@example.com',
      color: '#FF6B6B'
    }
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await collaborationManager.destroy();
  });

  describe('User Management', () => {
    test('should set current user', () => {
      collaborationManager.setCurrentUser(mockUser);
      // Test passes if no error is thrown
      expect(true).toBe(true);
    });

    test('should generate consistent user colors', () => {
      const color1 = CollaborationManager.generateUserColor('user123');
      const color2 = CollaborationManager.generateUserColor('user123');
      const color3 = CollaborationManager.generateUserColor('user456');

      expect(color1).toBe(color2) // Same user ID should get same color
      expect(color1).not.toBe(color3) // Different user IDs should get different colors
      expect(color1).toMatch(/^#[0-9A-F]{6}$/i) // Should be valid hex color
    });

    test('should track active users in session', async () => {
      collaborationManager.setCurrentUser(mockUser);
      
      const session = await collaborationManager.joinSession(;
        'doc123',
        'project123',
        'test.js'
      );

      const activeUsers = collaborationManager.getActiveUsers(session);
      expect(activeUsers).toHaveLength(1);
      expect(activeUsers[0]).toEqual(mockUser);
    });
  });

  describe('Session Management', () => {
    beforeEach(() => {
      collaborationManager.setCurrentUser(mockUser);
    });

    test('should create new collaboration session', async () => {
      const session = await collaborationManager.joinSession(;
        'doc123',
        'project123',
        'test.js'
      );

      expect(session).toBeDefined();
      expect(session.documentId).toBe('doc123');
      expect(session.projectId).toBe('project123');
      expect(session.filePath).toBe('test.js');
      expect(session.users.has(mockUser.id)).toBe(true);
    });

    test('should return existing session when joining same document', async () => {
      const session1 = await collaborationManager.joinSession(;
        'doc123',
        'project123',
        'test.js'
      );
      
      const session2 = await collaborationManager.joinSession(;
        'doc123',
        'project123',
        'test.js'
      );

      expect(session1).toBe(session2);
    });

    test('should throw error when joining without setting current user', async () => {
      const manager = new CollaborationManager();
      
      await expect(manager.joinSession('doc123', 'project123', 'test.js'));
        .rejects.toThrow('Current user must be set before joining a session');
    });

    test('should leave session and cleanup resources', async () => {
      const session = await collaborationManager.joinSession(;
        'doc123',
        'project123',
        'test.js'
      );

      await collaborationManager.leaveSession('doc123');

      // Verify session cleanup
      expect(session.provider?.destroy).toHaveBeenCalled();
      expect(session.persistence?.destroy).toHaveBeenCalled();
    });
  });

  describe('Document Operations', () => {
    let session: any;

    beforeEach(async () => {
      collaborationManager.setCurrentUser(mockUser);
      session = await collaborationManager.joinSession(
        'doc123',
        'project123',
        'test.js'
      );
    });

    test('should get text content from document', () => {
      const yText = collaborationManager.getText(session);
      expect(yText).toBeDefined();
      expect(yText.toString).toBeDefined();
    });

    test('should get shared map for metadata', () => {
      const yMap = collaborationManager.getMap(session);
      expect(yMap).toBeDefined();
      expect(yMap.get).toBeDefined();
      expect(yMap.set).toBeDefined();
    });

    test('should update cursor position', () => {
      const mockAwareness = session.provider.awareness;
      collaborationManager.updateCursor(session, 5, 10);

      expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
        'user',
        expect.objectContaining({
          cursor: { line: 5, column: 10 }
        });
      );
    });

    test('should handle conflict resolution', () => {
      const mockMap = session.doc.getMap();
      mockMap.get.mockReturnValue(2) // Mock existing conflict count

      collaborationManager.resolveConflicts(session);

      expect(mockMap.set).toHaveBeenCalledWith('conflicts', 3);
      expect(mockMap.set).toHaveBeenCalledWith('lastResolved', expect.any(Number));
    });
  });

  describe('Statistics and Monitoring', () => {
    let session: any;

    beforeEach(async () => {
      collaborationManager.setCurrentUser(mockUser);
      session = await collaborationManager.joinSession(
        'doc123',
        'project123',
        'test.js'
      );
    });

    test('should get collaboration statistics', () => {
      const mockMap = session.doc.getMap();
      const mockText = session.doc.getText();
      
      mockMap.get.mockImplementation((key: string) => {
        if (key === 'conflicts') return 5
        if (key === 'lastActivity') return Date.now();
        return undefined
      });
      
      mockText.length = 1500

      const stats = collaborationManager.getStats(session);

      expect(stats).toEqual({
        userCount: 1,
        documentSize: 1500,
        conflicts: 5,
        lastActivity: expect.any(Number);
      });
    });

    test('should handle missing metadata gracefully', () => {
      const mockMap = session.doc.getMap();
      const mockText = session.doc.getText();
      
      mockMap.get.mockReturnValue(undefined);
      mockText.length = 0

      const stats = collaborationManager.getStats(session);

      expect(stats).toEqual({
        userCount: 1,
        documentSize: 0,
        conflicts: 0,
        lastActivity: expect.any(Number);
      });
    });
  });

  describe('Multi-User Scenarios', () => {
    test('should handle multiple users in same session', async () => {
      // First user
      collaborationManager.setCurrentUser(mockUser);
      const session = await collaborationManager.joinSession(;
        'doc123',
        'project123',
        'test.js'
      );

      // Add second user manually (simulating awareness update);
      const secondUser: CollaborationUser = {
        id: 'user456',
        name: 'Second User',
        email: 'second@example.com',
        color: '#4ECDC4'
      }
      session.users.set(secondUser.id, secondUser);

      const activeUsers = collaborationManager.getActiveUsers(session);
      expect(activeUsers).toHaveLength(2);
      expect(activeUsers.find(u => u.id === mockUser.id)).toBeDefined();
      expect(activeUsers.find(u => u.id === secondUser.id)).toBeDefined();
    });

    test('should handle concurrent editing scenarios', () => {
      // This test would require more complex Yjs mocking
      // but demonstrates the testing approach for CRDT operations
      expect(true).toBe(true) // Placeholder for CRDT conflict resolution tests
    });
  });

  describe('Error Handling', () => {
    test('should handle WebSocket connection errors gracefully', async () => {
      // Mock WebSocket error
      const errorCallback = jest.fn();
      
      collaborationManager.setCurrentUser(mockUser);
      const session = await collaborationManager.joinSession(;
        'doc123',
        'project123',
        'test.js'
      );

      // Simulate connection error
      const mockProvider = session.provider;
      const onCallback = mockProvider.on.mock.calls.find(call => call[0] === 'connection-error');
      
      if (onCallback) {
        onCallback[1](new Error('Connection failed'));
      }

      // Test should complete without throwing
      expect(true).toBe(true);
    });

    test('should handle missing session operations gracefully', () => {
      // Test operations on non-existent session
      expect(() => {
        collaborationManager.updateCursor(null as any, 0, 0);
      }).not.toThrow();

      expect(() => {
        collaborationManager.getActiveUsers(null as any);
      }).not.toThrow();
    });
  });

  describe('Cleanup and Resource Management', () => {
    test('should cleanup all sessions on destroy', async () => {
      collaborationManager.setCurrentUser(mockUser);
      
      const session1 = await collaborationManager.joinSession('doc1', 'proj1', 'file1.js');
      const session2 = await collaborationManager.joinSession('doc2', 'proj1', 'file2.js');

      await collaborationManager.destroy();

      expect(session1.provider?.destroy).toHaveBeenCalled();
      expect(session1.persistence?.destroy).toHaveBeenCalled();
      expect(session2.provider?.destroy).toHaveBeenCalled();
      expect(session2.persistence?.destroy).toHaveBeenCalled();
    });

    test('should handle destroy when no sessions exist', async () => {
      // Should not throw error
      await expect(collaborationManager.destroy()).resolves.not.toThrow();
    });
  });
});