/**
 * Unit tests for WorkspaceCollaboration
 * Tests the actual public API methods
 */

// Mock ioredis module completely
jest.mock('ioredis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    publish: jest.fn().mockResolvedValue(1),
    subscribe: jest.fn().mockResolvedValue('OK'),
    unsubscribe: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(),
    off: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK')
  }))
}));

jest.mock('ws', () => {
  return jest.fn().mockImplementation(() => ({
    send: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
    readyState: 1,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
  }));
});

import { WorkspaceCollaboration } from '@/lib/collaboration/workspace-collaboration';

describe('WorkspaceCollaboration', () => {
  let collaboration: WorkspaceCollaboration;

  beforeEach(() => {
    jest.clearAllMocks();
    collaboration = new WorkspaceCollaboration();
  });

  describe('joinWorkspace', () => {
    it('should create a new workspace session when joining', async () => {
      const workspaceId = 'test-workspace';
      const mockUser = {
        id: 'user1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'editor' as const,
        status: 'online' as const,
        lastSeen: new Date()
      };

      const session = await collaboration.joinWorkspace(workspaceId, mockUser);

      expect(session).toBeDefined();
      expect(session.workspaceId).toBe(workspaceId);
      expect(session.users.has(mockUser.id)).toBe(true);
    });
  });

  describe('leaveWorkspace', () => {
    it('should remove user from workspace', async () => {
      const workspaceId = 'test-workspace';
      const userId = 'user1';

      // First join the workspace
      const mockUser = {
        id: userId,
        name: 'Test User',
        email: 'test@example.com',
        role: 'editor' as const,
        status: 'online' as const,
        lastSeen: new Date()
      };

      await collaboration.joinWorkspace(workspaceId, mockUser);

      // Then leave
      await expect(collaboration.leaveWorkspace(workspaceId, userId)).resolves.toBeUndefined();
    });
  });
});