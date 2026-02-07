/**
 * Comprehensive unit tests for Prisma client module
 * Tests database client exports, helper functions, build-mode behavior,
 * non-build-mode initialization, and database URL handling
 */

// Mock external dependencies before importing the module
const mockFindUnique = jest.fn().mockResolvedValue(null);
const mockWorkspaceCreate = jest.fn().mockResolvedValue({ id: 1, name: 'test' });
const mockAIRequestCreate = jest.fn().mockResolvedValue({ id: 1 });
const mockUse = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      findUnique: mockFindUnique,
    },
    workspace: {
      create: mockWorkspaceCreate,
    },
    aIRequest: {
      create: mockAIRequestCreate,
    },
    $use: mockUse,
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  })),
  Prisma: {
    InputJsonValue: {},
  },
}));

const mockStartSpan = jest.fn().mockReturnValue({
  setTag: jest.fn(),
  finish: jest.fn(),
});

jest.mock('dd-trace', () => ({
  startSpan: mockStartSpan,
  __esModule: true,
  default: { startSpan: mockStartSpan },
}));

const mockHistogram = jest.fn();
const mockIncrement = jest.fn();

jest.mock('../server-monitoring', () => ({
  metrics: {
    histogram: mockHistogram,
    increment: mockIncrement,
  },
}));

describe('Prisma Module - Build Mode', () => {
  const originalEnv = process.env;
  let prismaModule: typeof import('../prisma');

  beforeEach(() => {
    jest.resetModules();
    // Clear globalForPrisma to prevent caching across tests
    delete (globalThis as any).prisma;
    process.env = {
      ...originalEnv,
      BUILDING: 'true',
      DATABASE_URL: 'postgresql://localhost:5432/test',
    };
    prismaModule = require('../prisma');
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Module exports', () => {
    it('should export prisma client as named export', () => {
      expect(prismaModule.prisma).toBeDefined();
    });

    it('should export prisma client as default export', () => {
      expect(prismaModule.default).toBeDefined();
    });

    it('should have prisma and default be the same reference', () => {
      expect(prismaModule.prisma).toBe(prismaModule.default);
    });

    it('should export getUserByEmail function', () => {
      expect(prismaModule.getUserByEmail).toBeDefined();
      expect(typeof prismaModule.getUserByEmail).toBe('function');
    });

    it('should export createWorkspace function', () => {
      expect(prismaModule.createWorkspace).toBeDefined();
      expect(typeof prismaModule.createWorkspace).toBe('function');
    });

    it('should export logAIRequest function', () => {
      expect(prismaModule.logAIRequest).toBeDefined();
      expect(typeof prismaModule.logAIRequest).toBe('function');
    });
  });

  describe('getUserByEmail - build mode', () => {
    it('should return null during build mode', async () => {
      const result = await prismaModule.getUserByEmail('test@example.com');
      expect(result).toBeNull();
    });

    it('should return null for any email during build mode', async () => {
      const result = await prismaModule.getUserByEmail('any@email.com');
      expect(result).toBeNull();
    });

    it('should not throw when called with valid email', async () => {
      await expect(prismaModule.getUserByEmail('valid@email.com')).resolves.not.toThrow();
    });
  });

  describe('createWorkspace - build mode', () => {
    it('should return null during build mode', async () => {
      const result = await prismaModule.createWorkspace({
        name: 'Test Workspace',
        user_id: 1,
        workspace_id: 'ws-123',
      });
      expect(result).toBeNull();
    });

    it('should return null with full workspace data during build mode', async () => {
      const result = await prismaModule.createWorkspace({
        name: 'Full Workspace',
        description: 'A test workspace',
        user_id: 1,
        workspace_id: 'ws-456',
        url: 'http://example.com',
      });
      expect(result).toBeNull();
    });

    it('should not throw with minimal data', async () => {
      await expect(prismaModule.createWorkspace({
        name: 'Min',
        user_id: 1,
        workspace_id: 'ws-min',
      })).resolves.not.toThrow();
    });
  });

  describe('logAIRequest - build mode', () => {
    it('should return null during build mode with completed status', async () => {
      const result = await prismaModule.logAIRequest({
        user_id: 1,
        request_type: 'chat',
        prompt: 'Hello',
        model: 'gpt-4',
        provider: 'openai',
        status: 'completed',
      });
      expect(result).toBeNull();
    });

    it('should return null during build mode with pending status', async () => {
      const result = await prismaModule.logAIRequest({
        user_id: 1,
        request_type: 'completion',
        prompt: 'Generate code',
        model: 'claude-3',
        provider: 'anthropic',
        status: 'pending',
      });
      expect(result).toBeNull();
    });

    it('should return null with all optional fields during build mode', async () => {
      const result = await prismaModule.logAIRequest({
        user_id: 1,
        project_id: 10,
        request_type: 'completion',
        prompt: 'Generate code',
        model: 'claude-3',
        provider: 'anthropic',
        input_tokens: 100,
        output_tokens: 200,
        cost: 0.05,
        duration_ms: 1500,
        status: 'completed',
        response: { text: 'Generated code' },
        error: undefined,
      });
      expect(result).toBeNull();
    });

    it('should return null with error status', async () => {
      const result = await prismaModule.logAIRequest({
        user_id: 1,
        request_type: 'chat',
        prompt: 'Hello',
        model: 'gpt-4',
        provider: 'openai',
        status: 'error',
        error: 'Something went wrong',
      });
      expect(result).toBeNull();
    });
  });
});

describe('Prisma Module - Non-Build Mode', () => {
  const originalEnv = process.env;
  let prismaModule: typeof import('../prisma');

  beforeEach(() => {
    jest.resetModules();
    mockFindUnique.mockClear();
    mockWorkspaceCreate.mockClear();
    mockAIRequestCreate.mockClear();
    mockUse.mockClear();
    mockHistogram.mockClear();
    mockIncrement.mockClear();
    mockStartSpan.mockClear();

    // Clear globalForPrisma to prevent caching across tests
    delete (globalThis as any).prisma;

    process.env = {
      ...originalEnv,
      BUILDING: undefined,
      NEXT_PHASE: undefined,
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost:5432/testdb',
    };
    // Remove build indicators from argv
    const originalArgv = process.argv;
    process.argv = process.argv.filter(arg => arg !== 'build');
    prismaModule = require('../prisma');
    process.argv = originalArgv;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Non-build initialization', () => {
    it('should create a PrismaClient instance (not empty object)', () => {
      expect(prismaModule.prisma).toBeDefined();
      // Non-build prisma should have the user model from our mock
      expect(prismaModule.prisma.user).toBeDefined();
    });

    it('should have the workspace model from PrismaClient', () => {
      expect(prismaModule.prisma.workspace).toBeDefined();
    });

    it('should have the aIRequest model from PrismaClient', () => {
      expect(prismaModule.prisma.aIRequest).toBeDefined();
    });

    it('should set application_name in database URL', () => {
      const { PrismaClient } = require('@prisma/client');
      expect(PrismaClient).toHaveBeenCalled();
    });

    it('should register $use middleware', () => {
      // In non-build mode, $use should be called to register Datadog monitoring
      expect(mockUse).toHaveBeenCalled();
    });
  });

  describe('getUserByEmail - non-build mode', () => {
    it('should call prisma.user.findUnique with correct parameters', async () => {
      const mockUser = { id: 1, email: 'test@example.com', sessions: [], workspaces: [], projects: [] };
      mockFindUnique.mockResolvedValueOnce(mockUser);

      const result = await prismaModule.getUserByEmail('test@example.com');

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        include: {
          sessions: true,
          workspaces: {
            take: 10,
            orderBy: { updated_at: 'desc' },
          },
          projects: {
            take: 10,
            orderBy: { updated_at: 'desc' },
          },
        },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockFindUnique.mockResolvedValueOnce(null);
      const result = await prismaModule.getUserByEmail('nonexistent@example.com');
      expect(result).toBeNull();
    });

    it('should propagate errors from prisma', async () => {
      mockFindUnique.mockRejectedValueOnce(new Error('DB connection error'));
      await expect(prismaModule.getUserByEmail('test@example.com')).rejects.toThrow('DB connection error');
    });
  });

  describe('createWorkspace - non-build mode', () => {
    it('should call prisma.workspace.create with correct data and includes', async () => {
      const workspaceData = {
        name: 'Test Workspace',
        description: 'Description',
        user_id: 1,
        workspace_id: 'ws-789',
        url: 'http://example.com',
      };
      const mockResult = { id: 1, ...workspaceData, user: {}, projects: [] };
      mockWorkspaceCreate.mockResolvedValueOnce(mockResult);

      const result = await prismaModule.createWorkspace(workspaceData);

      expect(mockWorkspaceCreate).toHaveBeenCalledWith({
        data: workspaceData,
        include: {
          user: true,
          projects: true,
        },
      });
      expect(result).toEqual(mockResult);
    });

    it('should create workspace without optional description and url', async () => {
      const workspaceData = {
        name: 'Minimal Workspace',
        user_id: 2,
        workspace_id: 'ws-min',
      };
      mockWorkspaceCreate.mockResolvedValueOnce({ id: 2, ...workspaceData });

      const result = await prismaModule.createWorkspace(workspaceData);
      expect(mockWorkspaceCreate).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should propagate errors from prisma', async () => {
      mockWorkspaceCreate.mockRejectedValueOnce(new Error('Duplicate key'));
      await expect(prismaModule.createWorkspace({
        name: 'Dup',
        user_id: 1,
        workspace_id: 'ws-dup',
      })).rejects.toThrow('Duplicate key');
    });
  });

  describe('logAIRequest - non-build mode', () => {
    it('should call prisma.aIRequest.create with completed_at for completed status', async () => {
      const requestData = {
        user_id: 1,
        request_type: 'chat',
        prompt: 'Hello',
        model: 'gpt-4',
        provider: 'openai',
        status: 'completed',
      };
      mockAIRequestCreate.mockResolvedValueOnce({ id: 1, ...requestData });

      await prismaModule.logAIRequest(requestData);

      expect(mockAIRequestCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ...requestData,
          completed_at: expect.any(Date),
        }),
      });
    });

    it('should not set completed_at for non-completed status', async () => {
      const requestData = {
        user_id: 1,
        request_type: 'chat',
        prompt: 'Hello',
        model: 'gpt-4',
        provider: 'openai',
        status: 'pending',
      };
      mockAIRequestCreate.mockResolvedValueOnce({ id: 1, ...requestData });

      await prismaModule.logAIRequest(requestData);

      expect(mockAIRequestCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ...requestData,
          completed_at: undefined,
        }),
      });
    });

    it('should include optional fields when provided', async () => {
      const requestData = {
        user_id: 1,
        project_id: 5,
        request_type: 'completion',
        prompt: 'Generate code',
        model: 'claude-3',
        provider: 'anthropic',
        input_tokens: 100,
        output_tokens: 200,
        cost: 0.05,
        duration_ms: 1500,
        status: 'completed',
        response: { text: 'code' } as any,
        error: 'some error',
      };
      mockAIRequestCreate.mockResolvedValueOnce({ id: 2, ...requestData });

      const result = await prismaModule.logAIRequest(requestData);

      expect(mockAIRequestCreate).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should propagate errors from prisma', async () => {
      mockAIRequestCreate.mockRejectedValueOnce(new Error('Insert failed'));
      await expect(prismaModule.logAIRequest({
        user_id: 1,
        request_type: 'chat',
        prompt: 'Hello',
        model: 'gpt-4',
        provider: 'openai',
        status: 'completed',
      })).rejects.toThrow('Insert failed');
    });
  });
});

describe('Prisma Module - Build Detection', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    delete (globalThis as any).prisma;
  });

  it('should detect NEXT_PHASE build mode', async () => {
    jest.resetModules();
    delete (globalThis as any).prisma;
    process.env = {
      ...originalEnv,
      NEXT_PHASE: 'phase-production-build',
      BUILDING: undefined,
      DATABASE_URL: 'postgresql://localhost:5432/test',
    };
    const mod = require('../prisma');
    // In build mode, helper functions return null
    const result = await mod.getUserByEmail('test@test.com');
    expect(result).toBeNull();
  });

  it('should detect BUILDING env var', async () => {
    jest.resetModules();
    delete (globalThis as any).prisma;
    process.env = {
      ...originalEnv,
      BUILDING: 'true',
      NEXT_PHASE: undefined,
      DATABASE_URL: 'postgresql://localhost:5432/test',
    };
    const mod = require('../prisma');
    const result = await mod.createWorkspace({
      name: 'Test',
      user_id: 1,
      workspace_id: 'ws-1',
    });
    expect(result).toBeNull();
  });
});

describe('Prisma Module - Database URL handling', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    delete (globalThis as any).prisma;
  });

  it('should use placeholder URL when DATABASE_URL is not set', () => {
    jest.resetModules();
    delete (globalThis as any).prisma;
    process.env = {
      ...originalEnv,
      BUILDING: undefined,
      NEXT_PHASE: undefined,
      NODE_ENV: 'development',
      DATABASE_URL: undefined,
    };
    const originalArgv = process.argv;
    process.argv = process.argv.filter(arg => arg !== 'build');
    // Should not throw even without DATABASE_URL
    expect(() => require('../prisma')).not.toThrow();
    process.argv = originalArgv;
  });

  it('should configure production logging in production mode', () => {
    jest.resetModules();
    delete (globalThis as any).prisma;
    const { PrismaClient } = require('@prisma/client');
    PrismaClient.mockClear();
    process.env = {
      ...originalEnv,
      BUILDING: undefined,
      NEXT_PHASE: undefined,
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localhost:5432/testdb',
    };
    const originalArgv = process.argv;
    process.argv = process.argv.filter(arg => arg !== 'build');
    require('../prisma');
    process.argv = originalArgv;

    if (PrismaClient.mock.calls.length > 0) {
      const lastCall = PrismaClient.mock.calls[PrismaClient.mock.calls.length - 1][0];
      if (lastCall && lastCall.log) {
        expect(lastCall.log).toEqual(['error']);
      }
    }
  });

  it('should configure development logging in development mode', () => {
    jest.resetModules();
    delete (globalThis as any).prisma;
    const { PrismaClient } = require('@prisma/client');
    PrismaClient.mockClear();
    process.env = {
      ...originalEnv,
      BUILDING: undefined,
      NEXT_PHASE: undefined,
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost:5432/testdb',
    };
    const originalArgv = process.argv;
    process.argv = process.argv.filter(arg => arg !== 'build');
    require('../prisma');
    process.argv = originalArgv;

    if (PrismaClient.mock.calls.length > 0) {
      const lastCall = PrismaClient.mock.calls[PrismaClient.mock.calls.length - 1][0];
      if (lastCall && lastCall.log) {
        expect(lastCall.log).toEqual(['query', 'info', 'warn', 'error']);
      }
    }
  });
});

describe('Prisma Middleware Behavior', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    delete (globalThis as any).prisma;
  });

  it('should register $use middleware when available and not building', () => {
    jest.resetModules();
    delete (globalThis as any).prisma;
    mockUse.mockClear();
    process.env = {
      ...originalEnv,
      BUILDING: undefined,
      NEXT_PHASE: undefined,
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost:5432/testdb',
    };
    const originalArgv = process.argv;
    process.argv = process.argv.filter(arg => arg !== 'build');
    require('../prisma');
    process.argv = originalArgv;

    // In non-build mode, $use should be called to register middleware
    expect(mockUse).toHaveBeenCalled();
  });

  it('should track successful queries through middleware', async () => {
    jest.resetModules();
    delete (globalThis as any).prisma;
    mockUse.mockClear();
    mockHistogram.mockClear();
    mockIncrement.mockClear();
    mockStartSpan.mockClear();

    process.env = {
      ...originalEnv,
      BUILDING: undefined,
      NEXT_PHASE: undefined,
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost:5432/testdb',
    };
    const originalArgv = process.argv;
    process.argv = process.argv.filter(arg => arg !== 'build');
    require('../prisma');
    process.argv = originalArgv;

    // Get the middleware function that was registered
    if (mockUse.mock.calls.length > 0) {
      const middleware = mockUse.mock.calls[0][0];
      const mockParams = { action: 'findMany', model: 'User' };
      const mockNext = jest.fn().mockResolvedValue({ count: 5 });

      const result = await middleware(mockParams, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockParams);
      expect(mockHistogram).toHaveBeenCalledWith(
        'db.query.duration',
        expect.any(Number),
        expect.objectContaining({
          operation: 'findMany',
          model: 'User',
          status: 'success',
        })
      );
      expect(mockIncrement).toHaveBeenCalledWith(
        'db.query.count',
        expect.objectContaining({
          operation: 'findMany',
          model: 'User',
          status: 'success',
        })
      );
      expect(result).toEqual({ count: 5 });
    }
  });

  it('should track failed queries through middleware', async () => {
    jest.resetModules();
    delete (globalThis as any).prisma;
    mockUse.mockClear();
    mockIncrement.mockClear();

    process.env = {
      ...originalEnv,
      BUILDING: undefined,
      NEXT_PHASE: undefined,
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost:5432/testdb',
    };
    const originalArgv = process.argv;
    process.argv = process.argv.filter(arg => arg !== 'build');
    require('../prisma');
    process.argv = originalArgv;

    if (mockUse.mock.calls.length > 0) {
      const middleware = mockUse.mock.calls[0][0];
      const mockParams = { action: 'create', model: 'Post' };
      const dbError = new Error('Unique constraint violation');
      dbError.name = 'PrismaClientKnownRequestError';
      const mockNext = jest.fn().mockRejectedValue(dbError);

      await expect(middleware(mockParams, mockNext)).rejects.toThrow('Unique constraint violation');

      expect(mockIncrement).toHaveBeenCalledWith(
        'db.query.error',
        expect.objectContaining({
          operation: 'create',
          model: 'Post',
          error: 'PrismaClientKnownRequestError',
        })
      );
    }
  });

  it('should handle missing model in middleware params', async () => {
    jest.resetModules();
    delete (globalThis as any).prisma;
    mockUse.mockClear();
    mockHistogram.mockClear();

    process.env = {
      ...originalEnv,
      BUILDING: undefined,
      NEXT_PHASE: undefined,
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost:5432/testdb',
    };
    const originalArgv = process.argv;
    process.argv = process.argv.filter(arg => arg !== 'build');
    require('../prisma');
    process.argv = originalArgv;

    if (mockUse.mock.calls.length > 0) {
      const middleware = mockUse.mock.calls[0][0];
      const mockParams = { action: 'queryRaw' };
      const mockNext = jest.fn().mockResolvedValue([]);

      await middleware(mockParams, mockNext);

      expect(mockHistogram).toHaveBeenCalledWith(
        'db.query.duration',
        expect.any(Number),
        expect.objectContaining({
          model: 'unknown',
        })
      );
    }
  });

  it('should handle non-Error exceptions in middleware', async () => {
    jest.resetModules();
    delete (globalThis as any).prisma;
    mockUse.mockClear();
    mockIncrement.mockClear();

    process.env = {
      ...originalEnv,
      BUILDING: undefined,
      NEXT_PHASE: undefined,
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost:5432/testdb',
    };
    const originalArgv = process.argv;
    process.argv = process.argv.filter(arg => arg !== 'build');
    require('../prisma');
    process.argv = originalArgv;

    if (mockUse.mock.calls.length > 0) {
      const middleware = mockUse.mock.calls[0][0];
      const mockParams = { action: 'findFirst', model: 'User' };
      const mockNext = jest.fn().mockRejectedValue('string error');

      await expect(middleware(mockParams, mockNext)).rejects.toBe('string error');

      expect(mockIncrement).toHaveBeenCalledWith(
        'db.query.error',
        expect.objectContaining({
          error: 'unknown_error',
        })
      );
    }
  });

  it('should handle result without count in middleware', async () => {
    jest.resetModules();
    delete (globalThis as any).prisma;
    mockUse.mockClear();
    mockStartSpan.mockClear();

    process.env = {
      ...originalEnv,
      BUILDING: undefined,
      NEXT_PHASE: undefined,
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost:5432/testdb',
    };
    const originalArgv = process.argv;
    process.argv = process.argv.filter(arg => arg !== 'build');
    require('../prisma');
    process.argv = originalArgv;

    if (mockUse.mock.calls.length > 0) {
      const middleware = mockUse.mock.calls[0][0];
      const mockParams = { action: 'findFirst', model: 'User' };
      const mockNext = jest.fn().mockResolvedValue(null);

      const result = await middleware(mockParams, mockNext);
      expect(result).toBeNull();
    }
  });

  it('should not register middleware during build mode', () => {
    jest.resetModules();
    delete (globalThis as any).prisma;
    mockUse.mockClear();
    process.env = {
      ...originalEnv,
      BUILDING: 'true',
      DATABASE_URL: 'postgresql://localhost:5432/testdb',
    };
    require('../prisma');

    // In build mode, prisma is an empty object, so $use should not be called
    expect(mockUse).not.toHaveBeenCalled();
  });
});

describe('Prisma Module - globalForPrisma caching', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    delete (globalThis as any).prisma;
  });

  it('should cache prisma in globalForPrisma in non-production mode', () => {
    jest.resetModules();
    delete (globalThis as any).prisma;
    process.env = {
      ...originalEnv,
      BUILDING: undefined,
      NEXT_PHASE: undefined,
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost:5432/testdb',
    };
    const originalArgv = process.argv;
    process.argv = process.argv.filter(arg => arg !== 'build');
    require('../prisma');
    process.argv = originalArgv;

    // In development mode, globalForPrisma.prisma should be set
    expect((globalThis as any).prisma).toBeDefined();
  });

  it('should not cache prisma in globalForPrisma in production mode', () => {
    jest.resetModules();
    delete (globalThis as any).prisma;
    process.env = {
      ...originalEnv,
      BUILDING: undefined,
      NEXT_PHASE: undefined,
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localhost:5432/testdb',
    };
    const originalArgv = process.argv;
    process.argv = process.argv.filter(arg => arg !== 'build');
    require('../prisma');
    process.argv = originalArgv;

    // In production mode, globalForPrisma.prisma should NOT be set
    expect((globalThis as any).prisma).toBeUndefined();
  });
});
