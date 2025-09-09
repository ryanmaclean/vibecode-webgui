/**
 * Unit tests for WorkspaceCollaboration
 * Tests the workspace collaboration system functionality
 */

import { WorkspaceCollaboration } from '../workspace-collaboration';
import { CollaborationUser, WorkspaceSession } from '../workspace-collaboration';

// Mock external dependencies
jest.mock('ioredis', () => {
  const mockRedisInstance = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    hget: jest.fn().mockResolvedValue(null),
    hset: jest.fn().mockResolvedValue(1),
    hdel: jest.fn().mockResolvedValue(1),
    publish: jest.fn().mockResolvedValue(1),
    subscribe: jest.fn().mockResolvedValue(undefined),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    off: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
    // Add all Redis methods that might be called
    exists: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(-1),
    keys: jest.fn().mockResolvedValue([]),
    mget: jest.fn().mockResolvedValue([]),
    mset: jest.fn().mockResolvedValue('OK'),
    sadd: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    smembers: jest.fn().mockResolvedValue([]),
    sismember: jest.fn().mockResolvedValue(0),
    zadd: jest.fn().mockResolvedValue(1),
    zrem: jest.fn().mockResolvedValue(1),
    zrange: jest.fn().mockResolvedValue([]),
    zscore: jest.fn().mockResolvedValue(null),
    lpush: jest.fn().mockResolvedValue(1),
    rpush: jest.fn().mockResolvedValue(1),
    lpop: jest.fn().mockResolvedValue(null),
    rpop: jest.fn().mockResolvedValue(null),
    llen: jest.fn().mockResolvedValue(0),
    lrange: jest.fn().mockResolvedValue([])
  };

  return {
    Redis: jest.fn().mockImplementation(() => mockRedisInstance)
  };
});

jest.mock('ws', () => {
  return jest.fn().mockImplementation(() => ({
    send: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    readyState: 1
  }));
});

describe('WorkspaceCollaboration', () => {
  let collaboration: WorkspaceCollaboration;
  let mockUser: CollaborationUser;

  beforeEach(() => {
    jest.clearAllMocks();
    collaboration = new WorkspaceCollaboration();
    mockUser = {
      id: 'user1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'editor',
      status: 'online',
      lastSeen: new Date()
    };
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(collaboration).toBeDefined();
      expect(collaboration['redis']).toBeDefined();
      expect(collaboration['sessions']).toBeDefined();
      expect(collaboration['sessions'].size).toBe(0);
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        redisUrl: 'redis://localhost:6379',
        maxUsersPerWorkspace: 10,
        sessionTimeout: 300000
      };
      
      const customCollaboration = new WorkspaceCollaboration(customConfig);
      expect(customCollaboration).toBeDefined();
    });
  });

  describe('createWorkspaceSession', () => {
    it('should create a new workspace session', async () => {
      const workspaceId = 'workspace1';
      const userId = 'user1';

      const session = await collaboration.createWorkspaceSession(workspaceId, userId);

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.workspaceId).toBe(workspaceId);
      expect(session.users.size).toBe(1);
      expect(session.users.has(userId)).toBe(true);
      expect(session.files.size).toBe(0);
      expect(session.terminals.size).toBe(0);
      expect(session.debugSessions.size).toBe(0);
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.lastActivity).toBeInstanceOf(Date);
    });

    it('should throw error if user does not exist', async () => {
      const workspaceId = 'workspace1';
      const userId = 'nonexistent';

      await expect(collaboration.createWorkspaceSession(workspaceId, userId))
        .rejects.toThrow('User not found');
    });

    it('should throw error if workspace already has active session', async () => {
      const workspaceId = 'workspace1';
      const userId = 'user1';

      // Create first session
      await collaboration.createWorkspaceSession(workspaceId, userId);

      // Try to create second session for same workspace
      await expect(collaboration.createWorkspaceSession(workspaceId, userId))
        .rejects.toThrow('Workspace session already exists');
    });
  });

  describe('joinWorkspaceSession', () => {
    beforeEach(async () => {
      // Create a session to join
      await collaboration.createWorkspaceSession('workspace1', 'user1');
    });

    it('should allow user to join existing session', async () => {
      const session = await collaboration.joinWorkspaceSession('workspace1', 'user2');

      expect(session).toBeDefined();
      expect(session.users.size).toBe(2);
      expect(session.users.has('user1')).toBe(true);
      expect(session.users.has('user2')).toBe(true);
    });

    it('should throw error if workspace session does not exist', async () => {
      await expect(collaboration.joinWorkspaceSession('nonexistent', 'user2'))
        .rejects.toThrow('Workspace session not found');
    });

    it('should throw error if user does not exist', async () => {
      await expect(collaboration.joinWorkspaceSession('workspace1', 'nonexistent'))
        .rejects.toThrow('User not found');
    });

    it('should throw error if user is already in session', async () => {
      await expect(collaboration.joinWorkspaceSession('workspace1', 'user1'))
        .rejects.toThrow('User already in session');
    });

    it('should throw error if workspace is at capacity', async () => {
      // Mock max users to 1
      collaboration['maxUsersPerWorkspace'] = 1;

      await expect(collaboration.joinWorkspaceSession('workspace1', 'user2'))
        .rejects.toThrow('Workspace at maximum capacity');
    });
  });

  describe('leaveWorkspaceSession', () => {
    beforeEach(async () => {
      // Create a session with multiple users
      await collaboration.createWorkspaceSession('workspace1', 'user1');
      await collaboration.joinWorkspaceSession('workspace1', 'user2');
    });

    it('should allow user to leave session', async () => {
      await collaboration.leaveWorkspaceSession('workspace1', 'user1');

      const session = collaboration['sessions'].get('workspace1');
      expect(session?.users.size).toBe(1);
      expect(session?.users.has('user1')).toBe(false);
      expect(session?.users.has('user2')).toBe(true);
    });

    it('should close session when last user leaves', async () => {
      // Remove user2 first
      await collaboration.leaveWorkspaceSession('workspace1', 'user2');
      
      // Remove user1 (last user)
      await collaboration.leaveWorkspaceSession('workspace1', 'user1');

      const session = collaboration['sessions'].get('workspace1');
      expect(session).toBeUndefined();
    });

    it('should throw error if workspace session does not exist', async () => {
      await expect(collaboration.leaveWorkspaceSession('nonexistent', 'user1'))
        .rejects.toThrow('Workspace session not found');
    });

    it('should throw error if user is not in session', async () => {
      await expect(collaboration.leaveWorkspaceSession('workspace1', 'user3'))
        .rejects.toThrow('User not in session');
    });
  });

  describe('updateUserPresence', () => {
    beforeEach(async () => {
      await collaboration.createWorkspaceSession('workspace1', 'user1');
    });

    it('should update user status', async () => {
      await collaboration.updateUserPresence('workspace1', 'user1', 'away');

      const session = collaboration['sessions'].get('workspace1');
      const user = session?.users.get('user1');
      expect(user?.status).toBe('away');
    });

    it('should update user cursor position', async () => {
      const cursor = {
        file: 'test.js',
        line: 10,
        column: 5
      };

      await collaboration.updateUserPresence('workspace1', 'user1', 'online', cursor);

      const session = collaboration['sessions'].get('workspace1');
      const user = session?.users.get('user1');
      expect(user?.cursor).toEqual(cursor);
    });

    it('should update user selection', async () => {
      const selection = {
        file: 'test.js',
        startLine: 5,
        startColumn: 0,
        endLine: 10,
        endColumn: 5
      };

      await collaboration.updateUserPresence('workspace1', 'user1', 'online', undefined, selection);

      const session = collaboration['sessions'].get('workspace1');
      const user = session?.users.get('user1');
      expect(user?.selection).toEqual(selection);
    });

    it('should throw error if workspace session does not exist', async () => {
      await expect(collaboration.updateUserPresence('nonexistent', 'user1', 'online'))
        .rejects.toThrow('Workspace session not found');
    });

    it('should throw error if user is not in session', async () => {
      await expect(collaboration.updateUserPresence('workspace1', 'user2', 'online'))
        .rejects.toThrow('User not in session');
    });
  });

  describe('getWorkspaceSession', () => {
    beforeEach(async () => {
      await collaboration.createWorkspaceSession('workspace1', 'user1');
    });

    it('should return existing session', async () => {
      const session = await collaboration.getWorkspaceSession('workspace1');

      expect(session).toBeDefined();
      expect(session?.workspaceId).toBe('workspace1');
      expect(session?.users.size).toBe(1);
    });

    it('should return undefined for non-existent session', async () => {
      const session = await collaboration.getWorkspaceSession('nonexistent');

      expect(session).toBeUndefined();
    });
  });

  describe('getWorkspaceUsers', () => {
    beforeEach(async () => {
      await collaboration.createWorkspaceSession('workspace1', 'user1');
      await collaboration.joinWorkspaceSession('workspace1', 'user2');
    });

    it('should return all users in workspace', async () => {
      const users = await collaboration.getWorkspaceUsers('workspace1');

      expect(users).toHaveLength(2);
      expect(users.map(u => u.id)).toContain('user1');
      expect(users.map(u => u.id)).toContain('user2');
    });

    it('should return empty array for non-existent workspace', async () => {
      const users = await collaboration.getWorkspaceUsers('nonexistent');

      expect(users).toHaveLength(0);
    });
  });

  describe('file operations', () => {
    beforeEach(async () => {
      await collaboration.createWorkspaceSession('workspace1', 'user1');
    });

    it('should open file in workspace', async () => {
      await collaboration.openFile('workspace1', 'user1', 'test.js');

      const session = collaboration['sessions'].get('workspace1');
      const fileState = session?.files.get('test.js');
      expect(fileState).toBeDefined();
      expect(fileState?.openBy).toContain('user1');
    });

    it('should close file in workspace', async () => {
      await collaboration.openFile('workspace1', 'user1', 'test.js');
      await collaboration.closeFile('workspace1', 'user1', 'test.js');

      const session = collaboration['sessions'].get('workspace1');
      const fileState = session?.files.get('test.js');
      expect(fileState?.openBy).not.toContain('user1');
    });

    it('should throw error when opening file if user not in session', async () => {
      await expect(collaboration.openFile('workspace1', 'user2', 'test.js'))
        .rejects.toThrow('User not in session');
    });

    it('should throw error when closing file if user not in session', async () => {
      await expect(collaboration.closeFile('workspace1', 'user2', 'test.js'))
        .rejects.toThrow('User not in session');
    });
  });

  describe('terminal operations', () => {
    beforeEach(async () => {
      await collaboration.createWorkspaceSession('workspace1', 'user1');
    });

    it('should create terminal session', async () => {
      const terminalId = await collaboration.createTerminal('workspace1', 'user1');

      expect(terminalId).toBeDefined();
      
      const session = collaboration['sessions'].get('workspace1');
      const terminal = session?.terminals.get(terminalId);
      expect(terminal).toBeDefined();
      expect(terminal?.owner).toBe('user1');
    });

    it('should join terminal session', async () => {
      const terminalId = await collaboration.createTerminal('workspace1', 'user1');
      await collaboration.joinTerminal('workspace1', 'user2', terminalId);

      const session = collaboration['sessions'].get('workspace1');
      const terminal = session?.terminals.get(terminalId);
      expect(terminal?.participants).toContain('user2');
    });

    it('should throw error when creating terminal if user not in session', async () => {
      await expect(collaboration.createTerminal('workspace1', 'user2'))
        .rejects.toThrow('User not in session');
    });

    it('should throw error when joining terminal if user not in session', async () => {
      const terminalId = await collaboration.createTerminal('workspace1', 'user1');
      
      await expect(collaboration.joinTerminal('workspace1', 'user2', terminalId))
        .rejects.toThrow('User not in session');
    });
  });

  describe('debug operations', () => {
    beforeEach(async () => {
      await collaboration.createWorkspaceSession('workspace1', 'user1');
    });

    it('should create debug session', async () => {
      const debugId = await collaboration.createDebugSession('workspace1', 'user1');

      expect(debugId).toBeDefined();
      
      const session = collaboration['sessions'].get('workspace1');
      const debugSession = session?.debugSessions.get(debugId);
      expect(debugSession).toBeDefined();
      expect(debugSession?.owner).toBe('user1');
    });

    it('should join debug session', async () => {
      const debugId = await collaboration.createDebugSession('workspace1', 'user1');
      await collaboration.joinDebugSession('workspace1', 'user2', debugId);

      const session = collaboration['sessions'].get('workspace1');
      const debugSession = session?.debugSessions.get(debugId);
      expect(debugSession?.participants).toContain('user2');
    });

    it('should throw error when creating debug session if user not in session', async () => {
      await expect(collaboration.createDebugSession('workspace1', 'user2'))
        .rejects.toThrow('User not in session');
    });

    it('should throw error when joining debug session if user not in session', async () => {
      const debugId = await collaboration.createDebugSession('workspace1', 'user1');
      
      await expect(collaboration.joinDebugSession('workspace1', 'user2', debugId))
        .rejects.toThrow('User not in session');
    });
  });

  describe('cleanup and maintenance', () => {
    it('should clean up inactive sessions', async () => {
      // Create a session
      await collaboration.createWorkspaceSession('workspace1', 'user1');
      
      // Mock old timestamp
      const session = collaboration['sessions'].get('workspace1');
      if (session) {
        session.lastActivity = new Date(Date.now() - 1000000); // Very old
      }

      await collaboration.cleanupInactiveSessions();

      const cleanedSession = collaboration['sessions'].get('workspace1');
      expect(cleanedSession).toBeUndefined();
    });

    it('should get collaboration statistics', async () => {
      await collaboration.createWorkspaceSession('workspace1', 'user1');
      await collaboration.joinWorkspaceSession('workspace1', 'user2');

      const stats = await collaboration.getCollaborationStats();

      expect(stats.activeSessions).toBe(1);
      expect(stats.totalUsers).toBe(2);
      expect(stats.activeFiles).toBe(0);
      expect(stats.activeTerminals).toBe(0);
      expect(stats.activeDebugSessions).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      // Mock Redis error
      const mockRedis = collaboration['redis'];
      mockRedis.get = jest.fn().mockRejectedValue(new Error('Redis connection failed'));

      await expect(collaboration.createWorkspaceSession('workspace1', 'user1'))
        .rejects.toThrow('Redis connection failed');
    });

    it('should handle WebSocket connection errors gracefully', async () => {
      // Mock WebSocket error
      const mockWebSocket = collaboration['ws'];
      mockWebSocket.send = jest.fn().mockImplementation(() => {
        throw new Error('WebSocket connection failed');
      });

      await collaboration.createWorkspaceSession('workspace1', 'user1');
      
      // This should not throw, but handle the error gracefully
      expect(collaboration['sessions'].size).toBe(1);
    });
  });
});
