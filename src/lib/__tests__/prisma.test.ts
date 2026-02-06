/**
 * Unit tests for Prisma client module
 * Tests database client exports and helper functions
 */

// Mock external dependencies before importing the module
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    workspace: {
      create: jest.fn().mockResolvedValue({ id: 1, name: 'test' }),
    },
    aIRequest: {
      create: jest.fn().mockResolvedValue({ id: 1 }),
    },
    $use: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  })),
  Prisma: {
    InputJsonValue: {},
  },
}));

jest.mock('dd-trace', () => ({
  startSpan: jest.fn().mockReturnValue({
    setTag: jest.fn(),
    finish: jest.fn(),
  }),
}));

jest.mock('../server-monitoring', () => ({
  metrics: {
    histogram: jest.fn(),
    increment: jest.fn(),
  },
}));

// Set build environment to avoid database connection attempts
const originalEnv = process.env;
beforeAll(() => {
  process.env = {
    ...originalEnv,
    BUILDING: 'true',
    DATABASE_URL: 'postgresql://localhost:5432/test',
  };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('Prisma Module', () => {
  let prismaModule;

  beforeEach(() => {
    jest.resetModules();
    // Re-apply environment after module reset
    process.env.BUILDING = 'true';
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    prismaModule = require('../prisma');
  });

  describe('Module exports', () => {
    it('should export prisma client', () => {
      expect(prismaModule.prisma).toBeDefined();
      expect(prismaModule.default).toBeDefined();
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

  describe('getUserByEmail', () => {
    it('should return null during build mode', async () => {
      const result = await prismaModule.getUserByEmail('test@example.com');
      expect(result).toBeNull();
    });

    it('should accept email string parameter', async () => {
      // Should not throw when called with valid email
      await expect(prismaModule.getUserByEmail('valid@email.com')).resolves.not.toThrow();
    });
  });

  describe('createWorkspace', () => {
    it('should return null during build mode', async () => {
      const result = await prismaModule.createWorkspace({
        name: 'Test Workspace',
        user_id: 1,
        workspace_id: 'ws-123',
      });
      expect(result).toBeNull();
    });

    it('should accept workspace data object', async () => {
      const workspaceData = {
        name: 'Test Workspace',
        description: 'A test workspace',
        user_id: 1,
        workspace_id: 'ws-123',
        url: 'http://example.com',
      };

      // Should not throw when called with valid data
      await expect(prismaModule.createWorkspace(workspaceData)).resolves.not.toThrow();
    });
  });

  describe('logAIRequest', () => {
    it('should return null during build mode', async () => {
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

    it('should accept AI request data object', async () => {
      const requestData = {
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
      };

      // Should not throw when called with valid data
      await expect(prismaModule.logAIRequest(requestData)).resolves.not.toThrow();
    });
  });
});
