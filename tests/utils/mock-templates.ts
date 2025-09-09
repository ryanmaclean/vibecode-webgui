/**
 * Standardized Mock Configuration Templates
 * 
 * Use these templates to ensure consistent mocking patterns across test types.
 * This reduces test failures due to inconsistent mock implementations.
 */

// ================================
// NEXT-AUTH MOCKING PATTERNS
// ================================

export const NEXT_AUTH_MOCK = {
  // Standard next-auth mock for integration tests
  standard: () => ({
    getServerSession: jest.fn(),
  }),
  
  // Mock with authenticated user session
  withUser: (user = { id: 'test-user', email: 'test@example.com', name: 'Test User' }) => ({
    getServerSession: jest.fn().mockResolvedValue({
      user,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }),
  }),
  
  // Mock with no session (unauthenticated)
  noSession: () => ({
    getServerSession: jest.fn().mockResolvedValue(null),
  }),
};

// Usage: jest.mock('next-auth', () => NEXT_AUTH_MOCK.withUser());

// ================================
// DATABASE MOCKING PATTERNS  
// ================================

export const DATABASE_MOCK = {
  // PostgreSQL/Prisma mock
  postgres: () => ({
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $transaction: jest.fn().mockImplementation((fn) => fn({
      user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      project: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
    })),
  }),
  
  // Redis mock
  redis: () => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    flushall: jest.fn().mockResolvedValue('OK'),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue('OK'),
  }),
  
  // Vector database mock
  vector: () => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    search: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    createCollection: jest.fn().mockResolvedValue(undefined),
  }),
};

// Usage: jest.mock('../../src/lib/prisma', () => ({ prisma: DATABASE_MOCK.postgres() }));

// ================================
// API ENDPOINT MOCKING PATTERNS
// ================================

export const API_MOCK = {
  // OpenRouter/AI API mock
  openrouter: () => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'Mock AI response',
              role: 'assistant',
            },
          }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }),
      },
    },
  }),
  
  // Datadog monitoring mock
  datadog: () => ({
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
    metrics: {
      increment: jest.fn(),
      histogram: jest.fn(),
      gauge: jest.fn(),
    },
  }),
  
  // File system operations mock
  filesystem: () => ({
    promises: {
      readFile: jest.fn().mockResolvedValue('mock file content'),
      writeFile: jest.fn().mockResolvedValue(undefined),
      mkdir: jest.fn().mockResolvedValue(undefined),
      readdir: jest.fn().mockResolvedValue(['file1.txt', 'file2.txt']),
      stat: jest.fn().mockResolvedValue({ isDirectory: () => false, size: 1024 }),
    },
  }),
};

// Usage: jest.mock('openai', () => API_MOCK.openrouter());

// ================================
// ENVIRONMENT MOCKING PATTERNS
// ================================

export const ENV_MOCK = {
  // Standard test environment variables
  test: () => ({
    NODE_ENV: 'test',
    NEXTAUTH_SECRET: 'test-secret',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/testdb',
    REDIS_URL: 'redis://localhost:6379',
  }),
  
  // Development environment
  development: () => ({
    NODE_ENV: 'development',
    NEXTAUTH_SECRET: 'dev-secret',
    OPENROUTER_API_KEY: 'test-openrouter-key',
    DD_API_KEY: 'test-datadog-key',
  }),
};

// Usage: Object.assign(process.env, ENV_MOCK.test());

// ================================
// UTILITY FUNCTIONS
// ================================

export const MockUtils = {
  // Reset all mocks between tests
  resetAllMocks: () => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  },
  
  // Setup authenticated test environment
  setupAuthenticatedTest: (user?: any) => {
    // Note: Jest mocks must be configured at the top level due to hoisting
    Object.assign(process.env, ENV_MOCK.test());
  },
  
  // Setup unauthenticated test environment  
  setupUnauthenticatedTest: () => {
    // Note: Jest mocks must be configured at the top level due to hoisting
    Object.assign(process.env, ENV_MOCK.test());
  },
  
  // Create mock NextRequest
  createMockRequest: (options: {
    url?: string;
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  } = {}) => {
    const {
      url = 'http://localhost:3000/api/test',
      method = 'POST',
      body = null,
      headers = { 'content-type': 'application/json' },
    } = options;
    
    return {
      url,
      method,
      json: jest.fn().mockResolvedValue(body),
      text: jest.fn().mockResolvedValue(JSON.stringify(body)),
      headers: new Map(Object.entries(headers)),
    } as any;
  },
};

// ================================
// COMPLETE TEST TEMPLATES
// ================================

export const TestTemplates = {
  // Integration test with authentication
  authenticatedIntegration: `
import { NEXT_AUTH_MOCK, DATABASE_MOCK, MockUtils } from '../utils/mock-templates';

jest.mock('next-auth', () => NEXT_AUTH_MOCK.withUser());
jest.mock('../../src/lib/prisma', () => ({ prisma: DATABASE_MOCK.postgres() }));

describe('Your Integration Test', () => {
  beforeEach(() => {
    MockUtils.resetAllMocks();
    Object.assign(process.env, ENV_MOCK.test());
  });
  
  // Your tests here
});
`,

  // Unit test with minimal mocking
  unit: `
import { MockUtils } from '../utils/mock-templates';

jest.mock('../../src/lib/external-dependency', () => ({
  someFunction: jest.fn(),
}));

describe('Your Unit Test', () => {
  beforeEach(() => {
    MockUtils.resetAllMocks();
  });
  
  // Your tests here
});
`,
};

export default {
  NEXT_AUTH_MOCK,
  DATABASE_MOCK,
  API_MOCK,
  ENV_MOCK,
  MockUtils,
  TestTemplates,
};