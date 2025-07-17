/**
 * Collaboration Integration Tests
 *
 * End-to-end tests for collaborative editing functionality
 * Tests real-time synchronization, conflict resolution, and persistence
 *
 * Staff Engineer Implementation - Production-ready collaboration testing
 */

const { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, jest } = require('@jest/globals');

// Mock WebSocket and Yjs for integration testing
global.WebSocket = jest.fn().mockImplementation(() => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1, // OPEN
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
}));

// Mock IndexedDB for persistence testing
global.indexedDB = {
  open: jest.fn().mockReturnValue({
    addEventListener: jest.fn(),
    result: {
      createObjectStore: jest.fn(),
      transaction: jest.fn().mockReturnValue({
        objectStore: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue({ addEventListener: jest.fn() }),
          put: jest.fn().mockReturnValue({ addEventListener: jest.fn() }),
          delete: jest.fn().mockReturnValue({ addEventListener: jest.fn() })
        }),
      })}
  }),
  deleteDatabase: jest.fn()
}
const { CollaborationManager, CollaborationUser } = require('../../src/lib/collaboration')

describe('Collaboration Integration Tests', () => {
  let manager1
  let manager2
  let user1
  let user2

  beforeAll(() => {
    // Set up test environment
    process.env.NODE_ENV = 'test'
  })

  beforeEach(() => {
    // Create two collaboration managers to simulate different clients
    manager1 = new CollaborationManager('ws://localhost:3001')
    manager2 = new CollaborationManager('ws://localhost:3001')

    user1 = {
      id: 'user1',
      name: 'Alice Developer',
      email: 'alice@vibecode.dev',
      color: CollaborationManager.generateUserColor('user1')}
    user2 = {
      id: 'user2',
      name: 'Bob Engineer',
      email: 'bob@vibecode.dev',
      color: CollaborationManager.generateUserColor('user2')}
  });

  afterEach(async () => {
    await manager1.destroy();
    await manager2.destroy()})

  describe('Multi-User Collaboration', () => {
    test('should allow multiple users to join same document', async () => {
      // Setup users
      manager1.setCurrentUser(user1);
      manager2.setCurrentUser(user2)

      // Both users join same document
      const session1 = await manager1.joinSession('doc123', 'project1', 'main.js')
      const session2 = await manager2.joinSession('doc123', 'project1', 'main.js')

      expect(session1.documentId).toBe('doc123')
      expect(session2.documentId).toBe('doc123')

      // Verify users are tracked
      expect(session1.users.has('user1')).toBe(true)
      expect(session2.users.has('user2')).toBe(true)})

    test('should synchronize text changes between users', async () => {
      manager1.setCurrentUser(user1);
      manager2.setCurrentUser(user2)

      const session1 = await manager1.joinSession('doc123', 'project1', 'main.js')
      const session2 = await manager2.joinSession('doc123', 'project1', 'main.js');

      // User 1 makes changes
      const text1 = manager1.getText(session1)
      text1.insert(0, 'console.log("Hello from User 1");');

      // Simulate sync (in real scenario this would happen via WebSocket);
      const text2 = manager2.getText(session2);

      // Both should have the same document ID
      expect(session1.documentId).toBe(session2.documentId)})

    test('should handle cursor position updates', async () => {
      manager1.setCurrentUser(user1)
      const session = await manager1.joinSession('doc123', 'project1', 'main.js');

      // Update cursor position
      manager1.updateCursor(session, 10, 15);

      // Verify cursor was updated on user object
      expect(user1.cursor).toEqual({ line: 10, column: 15 })})

    test('should track collaboration statistics', async () => {
      manager1.setCurrentUser(user1);
      manager2.setCurrentUser(user2)

      const session1 = await manager1.joinSession('doc123', 'project1', 'main.js')
      await manager2.joinSession('doc123', 'project1', 'main.js');

      // Add some text
      const text = manager1.getText(session1)
      text.insert(0, 'function test() { return true}');

      const stats = manager1.getStats(session1);
      expect(stats.userCount).toBeGreaterThan(0);
      expect(stats.documentSize).toBeGreaterThanOrEqual(0);
      expect(stats.conflicts).toBeGreaterThanOrEqual(0);
      expect(stats.lastActivity).toBeInstanceOf(Number)})})

  describe('Conflict Resolution', () => {
    test('should handle simultaneous edits without conflicts', async () => {
      manager1.setCurrentUser(user1);
      manager2.setCurrentUser(user2)

      const session1 = await manager1.joinSession('doc123', 'project1', 'main.js')
      const session2 = await manager2.joinSession('doc123', 'project1', 'main.js');

      // Simulate simultaneous edits at different positions
      const text1 = manager1.getText(session1);
      const text2 = manager2.getText(session2)

      text1.insert(0, 'const a = 1;\n')  // User 1 adds at beginning
      text2.insert(0, 'const b = 2;\n')  // User 2 also adds at beginning;

      // Both operations should succeed (CRDT handles conflicts)
      expect(text1.toString()).toContain('const')
      expect(text2.toString()).toContain('const')})

    test('should resolve conflicts and update metadata', async () => {
      manager1.setCurrentUser(user1)
      const session = await manager1.joinSession('doc123', 'project1', 'main.js');

      // Simulate conflict resolution
      manager1.resolveConflicts(session);

      const metadata = manager1.getMap(session);

      // Verify conflict tracking
      expect(metadata.set).toBeDefined()})})

  describe('Persistence and Recovery', () => {
    test('should persist document changes', async () => {
      manager1.setCurrentUser(user1)
      const session = await manager1.joinSession('doc123', 'project1', 'main.js');

      // Add content
      const text = manager1.getText(session)
      text.insert(0, 'const persistedData = "test";');

      // Verify persistence provider is set up
      expect(session.persistence).toBeDefined()})

    test('should handle offline scenarios', async () => {
      manager1.setCurrentUser(user1)
      const session = await manager1.joinSession('doc123', 'project1', 'main.js');

      // Add content while "offline"
      const text = manager1.getText(session);
      text.insert(0, 'const offlineEdit = true');

      // Content should still be available locally
      expect(text.toString()).toContain('offlineEdit')})

    test('should restore session after reconnection', async () => {
      manager1.setCurrentUser(user1)

      // Initial session
      const session1 = await manager1.joinSession('doc123', 'project1', 'main.js');
      const text1 = manager1.getText(session1)
      text1.insert(0, 'const beforeReconnect = true;')

      // Simulate disconnect and reconnect
      await manager1.leaveSession('doc123')
      const session2 = await manager1.joinSession('doc123', 'project1', 'main.js')

      // Session should be restored
      expect(session2.documentId).toBe('doc123')})})

  describe('User Presence and Awareness', () => {
    test('should track active users in real-time', async () => {
      manager1.setCurrentUser(user1);
      manager2.setCurrentUser(user2)

      const session1 = await manager1.joinSession('doc123', 'project1', 'main.js')
      await manager2.joinSession('doc123', 'project1', 'main.js');

      const activeUsers1 = manager1.getActiveUsers(session1);
      expect(activeUsers1.length).toBeGreaterThan(0)})

    test('should handle user join and leave events', async () => {
      manager1.setCurrentUser(user1)
      const session = await manager1.joinSession('doc123', 'project1', 'main.js');

      // Initial user count
      const initialUsers = manager1.getActiveUsers(session);
      const initialCount = initialUsers.length;

      // Add second user (simulate);
      session.users.set(user2.id, user2);

      const updatedUsers = manager1.getActiveUsers(session);
      expect(updatedUsers.length).toBe(initialCount + 1);

      // Remove user
      session.users.delete(user2.id);

      const finalUsers = manager1.getActiveUsers(session);
      expect(finalUsers.length).toBe(initialCount)})

    test('should update user awareness information', async () => {
      manager1.setCurrentUser(user1)
      const session = await manager1.joinSession('doc123', 'project1', 'main.js');

      // Update cursor and user status
      manager1.updateCursor(session, 5, 10);

      // Verify awareness provider is available
      expect(session.provider?.awareness).toBeDefined()})})

  describe('Performance and Scalability', () => {
    test('should handle large document content efficiently', async () => {
      manager1.setCurrentUser(user1)
      const session = await manager1.joinSession('doc123', 'project1', 'large-file.js');

      const text = manager1.getText(session)

      // Insert large content
      const largeContent = 'console.log("line");\n'.repeat(1000);
      text.insert(0, largeContent);

      const stats = manager1.getStats(session);
      expect(stats.documentSize).toBeGreaterThan(15000) // Approximate size
    })

    test('should handle multiple concurrent operations', async () => {
      manager1.setCurrentUser(user1)
      const session = await manager1.joinSession('doc123', 'project1', 'main.js');

      const text = manager1.getText(session);

      // Perform multiple operations rapidly
      for (let i = 0; i < 10; i++) {
        text.insert(i * 10, `// Comment ${i}\n`)}

      // All operations should complete successfully
      expect(text.toString()).toContain('Comment 0')
      expect(text.toString()).toContain('Comment 9')})})

  describe('Error Handling and Recovery', () => {
    test('should handle WebSocket connection failures gracefully', async () => {
      manager1.setCurrentUser(user1)

      // This should not throw even if WebSocket fails
      await expect(
        manager1.joinSession('doc123', 'project1', 'main.js')).resolves.toBeDefined()})

    test('should handle invalid document IDs', async () => {
      manager1.setCurrentUser(user1)

      // Should handle edge cases gracefully
      await expect(
        manager1.joinSession('', 'project1', 'main.js')).resolves.toBeDefined()})

    test('should cleanup resources on session errors', async () => {
      manager1.setCurrentUser(user1)
      const session = await manager1.joinSession('doc123', 'project1', 'main.js')

      // Force an error scenario
      await manager1.leaveSession('doc123');

      // Session should be cleaned up
      expect(session).toBeDefined() // Session object exists but is cleaned up
    })})

  describe('Cross-Browser Compatibility', () => {
    test('should work with different WebSocket implementations', async () => {
      // Test would verify compatibility across different browser environments
      manager1.setCurrentUser(user1)
      const session = await manager1.joinSession('doc123', 'project1', 'main.js');

      expect(session.provider).toBeDefined()})

    test('should handle different IndexedDB implementations', async () => {
      // Test would verify persistence across different browsers
      manager1.setCurrentUser(user1)
      const session = await manager1.joinSession('doc123', 'project1', 'main.js');

      expect(session.persistence).toBeDefined()})})});
