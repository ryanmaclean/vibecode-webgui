/**
 * @jest-environment node
 */

/**
 * Unit tests for IDE Session API Route
 */

import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/ide/session/route';

// Mock next-auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

// Mock auth options
jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

// Mock IDE factory and types
jest.mock('@/lib/ide', () => ({
  IDEFactory: {
    getDefaultIDEType: jest.fn(() => 'code-server'),
    getIDE: jest.fn(),
  },
  IDEType: {
    CODE_SERVER: 'code-server',
    THEIA: 'theia',
  },
}));

// Mock session store
const mockSessionStore = {
  set: jest.fn(),
  get: jest.fn(),
  list: jest.fn(() => []),
  delete: jest.fn(),
};

jest.mock('@/lib/ide/session/store', () => ({
  getSessionStore: jest.fn(() => mockSessionStore),
}));

// Mock rate limiting
jest.mock('@/lib/rate-limiting', () => {
  const mockRateLimit = jest.fn();
  return {
    createAPIRateLimit: jest.fn(() => mockRateLimit),
    __mockRateLimit: mockRateLimit,
  };
});

// Mock logging
jest.mock('@/lib/logging', () => ({
  createServiceLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

// Helper function to create a mock NextRequest
function createMockRequest(
  url: string = 'http://localhost:3000/api/ide/session',
  options: RequestInit = { method: 'GET' }
): NextRequest {
  return new NextRequest(url, {
    ...options,
    headers: {
      'x-forwarded-for': '127.0.0.1',
      ...options.headers,
    },
  });
}

describe('/api/ide/session', () => {
  const mockAuthSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      role: 'user',
    },
  };

  const mockIDESession = {
    id: 'session-123',
    type: 'code-server',
    url: 'http://localhost:8080',
    status: 'running',
    workspaceId: 'workspace-123',
    userId: 'user-123',
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: rate limit passes
    const { createAPIRateLimit } = require('@/lib/rate-limiting');
    const mockRateLimit = createAPIRateLimit();
    mockRateLimit.mockResolvedValue({
      success: true,
      limit: 30,
      remaining: 29,
      reset: Date.now() + 60000,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/ide/session', () => {
    const validRequestBody = {
      workspaceId: 'workspace-123',
      userId: 'user-123',
      type: 'code-server',
      projectPath: '/workspace',
    };

    it('should create a new IDE session successfully', async () => {
      const { getServerSession } = require('next-auth');
      const { IDEFactory } = require('@/lib/ide');

      getServerSession.mockResolvedValue(mockAuthSession);

      const mockIDE = {
        start: jest.fn().mockResolvedValue(mockIDESession),
      };
      IDEFactory.getIDE.mockReturnValue(mockIDE);

      const mockRequest = createMockRequest('http://localhost:3000/api/ide/session', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.session).toBeDefined();
      expect(data.session.id).toBe('session-123');
      expect(data.session.type).toBe('code-server');
      expect(data.session.url).toBe('http://localhost:8080');
      expect(data.session.status).toBe('running');
      expect(mockSessionStore.set).toHaveBeenCalledWith('session-123', mockIDESession);
    });

    it('should enforce rate limiting', async () => {
      const { createAPIRateLimit } = require('@/lib/rate-limiting');
      const mockRateLimit = createAPIRateLimit();
      mockRateLimit.mockResolvedValue({
        success: false,
        limit: 30,
        remaining: 0,
        reset: Date.now() + 60000,
        retryAfter: 60,
      });

      const mockRequest = createMockRequest('http://localhost:3000/api/ide/session', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Too many requests');
      expect(response.headers.get('X-RateLimit-Limit')).toBe('30');
      expect(response.headers.get('Retry-After')).toBeDefined();
    });

    it('should require authentication', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValue(null);

      const mockRequest = createMockRequest('http://localhost:3000/api/ide/session', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(data.message).toBe('Authentication required to create IDE sessions');
    });

    it('should validate required fields', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValue(mockAuthSession);

      const invalidBody = { workspaceId: 'workspace-123' }; // Missing userId

      const mockRequest = createMockRequest('http://localhost:3000/api/ide/session', {
        method: 'POST',
        body: JSON.stringify(invalidBody),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('workspaceId and userId are required');
    });

    it('should prevent session hijacking', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValue(mockAuthSession);

      const hijackAttempt = {
        ...validRequestBody,
        userId: 'different-user-456', // Different from authenticated user
      };

      const mockRequest = createMockRequest('http://localhost:3000/api/ide/session', {
        method: 'POST',
        body: JSON.stringify(hijackAttempt),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
      expect(data.message).toBe('Cannot create IDE session for another user');
    });

    it('should use default IDE type when not specified', async () => {
      const { getServerSession } = require('next-auth');
      const { IDEFactory } = require('@/lib/ide');

      getServerSession.mockResolvedValue(mockAuthSession);
      IDEFactory.getDefaultIDEType.mockReturnValue('code-server');

      const mockIDE = {
        start: jest.fn().mockResolvedValue(mockIDESession),
      };
      IDEFactory.getIDE.mockReturnValue(mockIDE);

      const bodyWithoutType = {
        workspaceId: 'workspace-123',
        userId: 'user-123',
      };

      const mockRequest = createMockRequest('http://localhost:3000/api/ide/session', {
        method: 'POST',
        body: JSON.stringify(bodyWithoutType),
      });

      await POST(mockRequest);

      expect(IDEFactory.getDefaultIDEType).toHaveBeenCalled();
      expect(IDEFactory.getIDE).toHaveBeenCalledWith('code-server');
    });

    it('should handle IDE start failures', async () => {
      const { getServerSession } = require('next-auth');
      const { IDEFactory } = require('@/lib/ide');

      getServerSession.mockResolvedValue(mockAuthSession);

      const mockIDE = {
        start: jest.fn().mockRejectedValue(new Error('Failed to start IDE')),
      };
      IDEFactory.getIDE.mockReturnValue(mockIDE);

      const mockRequest = createMockRequest('http://localhost:3000/api/ide/session', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to start IDE');
    });

    it('should pass optional configuration to IDE', async () => {
      const { getServerSession } = require('next-auth');
      const { IDEFactory } = require('@/lib/ide');

      getServerSession.mockResolvedValue(mockAuthSession);

      const mockIDE = {
        start: jest.fn().mockResolvedValue(mockIDESession),
      };
      IDEFactory.getIDE.mockReturnValue(mockIDE);

      const bodyWithExtensions = {
        ...validRequestBody,
        extensions: ['ms-python.python', 'dbaeumer.vscode-eslint'],
        port: 8080,
        auth: { password: 'secret' },
      };

      const mockRequest = createMockRequest('http://localhost:3000/api/ide/session', {
        method: 'POST',
        body: JSON.stringify(bodyWithExtensions),
      });

      await POST(mockRequest);

      expect(mockIDE.start).toHaveBeenCalledWith(
        expect.objectContaining({
          extensions: ['ms-python.python', 'dbaeumer.vscode-eslint'],
          port: 8080,
          auth: { password: 'secret' },
        })
      );
    });

    it('should use default project path when not specified', async () => {
      const { getServerSession } = require('next-auth');
      const { IDEFactory } = require('@/lib/ide');

      getServerSession.mockResolvedValue(mockAuthSession);

      const mockIDE = {
        start: jest.fn().mockResolvedValue(mockIDESession),
      };
      IDEFactory.getIDE.mockReturnValue(mockIDE);

      const bodyWithoutProjectPath = {
        workspaceId: 'workspace-123',
        userId: 'user-123',
      };

      const mockRequest = createMockRequest('http://localhost:3000/api/ide/session', {
        method: 'POST',
        body: JSON.stringify(bodyWithoutProjectPath),
      });

      await POST(mockRequest);

      expect(mockIDE.start).toHaveBeenCalledWith(
        expect.objectContaining({
          projectPath: '/workspace',
        })
      );
    });
  });

  describe('GET /api/ide/session', () => {
    it('should list all sessions for authenticated user', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValue(mockAuthSession);

      const mockSessions = [
        { ...mockIDESession, id: 'session-1', userId: 'user-123' },
        { ...mockIDESession, id: 'session-2', userId: 'user-123' },
      ];
      mockSessionStore.list.mockReturnValue(mockSessions);

      const mockRequest = createMockRequest('http://localhost:3000/api/ide/session');

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.sessions).toHaveLength(2);
      expect(data.sessions[0].id).toBe('session-1');
      expect(data.sessions[1].id).toBe('session-2');
    });

    it('should enforce rate limiting', async () => {
      const { createAPIRateLimit } = require('@/lib/rate-limiting');
      const mockRateLimit = createAPIRateLimit();
      mockRateLimit.mockResolvedValue({
        success: false,
        limit: 30,
        remaining: 0,
        reset: Date.now() + 60000,
        retryAfter: 60,
      });

      const mockRequest = createMockRequest('http://localhost:3000/api/ide/session');

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Too many requests');
      expect(response.headers.get('X-RateLimit-Limit')).toBe('30');
    });

    it('should require authentication', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValue(null);

      const mockRequest = createMockRequest('http://localhost:3000/api/ide/session');

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(data.message).toBe('Authentication required to list IDE sessions');
    });

    it('should filter sessions by userId for non-admin users', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValue(mockAuthSession);

      const mockSessions = [
        { ...mockIDESession, id: 'session-1', userId: 'user-123' },
        { ...mockIDESession, id: 'session-2', userId: 'other-user' },
        { ...mockIDESession, id: 'session-3', userId: 'user-123' },
      ];
      mockSessionStore.list.mockReturnValue(mockSessions);

      const mockRequest = createMockRequest('http://localhost:3000/api/ide/session');

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessions).toHaveLength(2);
      expect(data.sessions.every((s: any) => s.userId === 'user-123')).toBe(true);
    });

    it('should allow admin users to see all sessions', async () => {
      const { getServerSession } = require('next-auth');
      const adminSession = {
        user: {
          id: 'admin-123',
          email: 'admin@example.com',
          role: 'admin',
        },
      };
      getServerSession.mockResolvedValue(adminSession);

      const mockSessions = [
        { ...mockIDESession, id: 'session-1', userId: 'user-123' },
        { ...mockIDESession, id: 'session-2', userId: 'user-456' },
        { ...mockIDESession, id: 'session-3', userId: 'user-789' },
      ];
      mockSessionStore.list.mockReturnValue(mockSessions);

      const mockRequest = createMockRequest('http://localhost:3000/api/ide/session');

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessions).toHaveLength(3);
    });

    it('should filter sessions by workspaceId', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValue(mockAuthSession);

      const mockSessions = [
        { ...mockIDESession, id: 'session-1', userId: 'user-123', workspaceId: 'workspace-123' },
        { ...mockIDESession, id: 'session-2', userId: 'user-123', workspaceId: 'workspace-456' },
      ];
      mockSessionStore.list.mockReturnValue(mockSessions);

      const mockRequest = createMockRequest('http://localhost:3000/api/ide/session?workspaceId=workspace-123');

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessions).toHaveLength(1);
      expect(data.sessions[0].workspaceId).toBe('workspace-123');
    });

    it('should filter sessions by type', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValue(mockAuthSession);

      const mockSessions = [
        { ...mockIDESession, id: 'session-1', userId: 'user-123', type: 'code-server' },
        { ...mockIDESession, id: 'session-2', userId: 'user-123', type: 'theia' },
      ];
      mockSessionStore.list.mockReturnValue(mockSessions);

      const mockRequest = createMockRequest('http://localhost:3000/api/ide/session?type=code-server');

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessions).toHaveLength(1);
      expect(data.sessions[0].type).toBe('code-server');
    });

    it('should filter sessions by userId query parameter', async () => {
      const { getServerSession } = require('next-auth');
      const adminSession = {
        user: {
          id: 'admin-123',
          email: 'admin@example.com',
          role: 'admin',
        },
      };
      getServerSession.mockResolvedValue(adminSession);

      const mockSessions = [
        { ...mockIDESession, id: 'session-1', userId: 'user-123' },
        { ...mockIDESession, id: 'session-2', userId: 'user-456' },
      ];
      mockSessionStore.list.mockReturnValue(mockSessions);

      const mockRequest = createMockRequest('http://localhost:3000/api/ide/session?userId=user-123');

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessions).toHaveLength(1);
      expect(data.sessions[0].userId).toBe('user-123');
    });

    it('should combine multiple filters', async () => {
      const { getServerSession } = require('next-auth');
      const adminSession = {
        user: {
          id: 'admin-123',
          email: 'admin@example.com',
          role: 'admin',
        },
      };
      getServerSession.mockResolvedValue(adminSession);

      const mockSessions = [
        { ...mockIDESession, id: 'session-1', userId: 'user-123', workspaceId: 'workspace-123', type: 'code-server' },
        { ...mockIDESession, id: 'session-2', userId: 'user-123', workspaceId: 'workspace-123', type: 'theia' },
        { ...mockIDESession, id: 'session-3', userId: 'user-123', workspaceId: 'workspace-456', type: 'code-server' },
      ];
      mockSessionStore.list.mockReturnValue(mockSessions);

      const mockRequest = createMockRequest(
        'http://localhost:3000/api/ide/session?workspaceId=workspace-123&type=code-server'
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessions).toHaveLength(1);
      expect(data.sessions[0].id).toBe('session-1');
    });

    it('should handle empty session list', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValue(mockAuthSession);

      mockSessionStore.list.mockReturnValue([]);

      const mockRequest = createMockRequest('http://localhost:3000/api/ide/session');

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.sessions).toEqual([]);
    });

    it('should handle session store errors gracefully', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValue(mockAuthSession);

      mockSessionStore.list.mockImplementation(() => {
        throw new Error('Session store unavailable');
      });

      const mockRequest = createMockRequest('http://localhost:3000/api/ide/session');

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to list IDE sessions');
    });

    it('should include all session fields in response', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValue(mockAuthSession);

      const mockSessions = [mockIDESession];
      mockSessionStore.list.mockReturnValue(mockSessions);

      const mockRequest = createMockRequest('http://localhost:3000/api/ide/session');

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      const session = data.sessions[0];
      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('type');
      expect(session).toHaveProperty('url');
      expect(session).toHaveProperty('status');
      expect(session).toHaveProperty('workspaceId');
      expect(session).toHaveProperty('userId');
      expect(session).toHaveProperty('createdAt');
      expect(session).toHaveProperty('lastActivity');
    });
  });
});
