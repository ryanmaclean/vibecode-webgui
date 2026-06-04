// Jest setup file
import '@testing-library/jest-dom';
import { jest } from '@jest/globals';

// Mock global objects - Enhanced fetch mock with proper Response object (Issue #791)
// URL-aware mock responses for common API endpoints (Issue #848)
// Fixed Node 20 compatibility by explicitly importing jest (Issue mm-tdy3)
const getMockResponse = (url) => {
  const urlStr = typeof url === 'string' ? url : url?.url || '';

  // Auth-required endpoints - return 401 by default (tests can override)
  if (urlStr.includes('/api/ai/litellm') || urlStr.includes('/api/ai/chat')) {
    return {
      status: 401,
      ok: false,
      data: { error: 'Unauthorized', message: 'Authentication required' },
    };
  }

  // Health and monitoring endpoints
  if (urlStr.includes('/api/monitoring/health') || urlStr.includes('/api/health')) {
    return {
      status: 200,
      ok: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: 3600,
        version: '1.0.0',
        checks: {
          database: {
            status: 'healthy',
            responseTime: 5,
            lastChecked: Date.now(),
            details: { version: 'PostgreSQL 16.0', activeConnections: 10, maxConnections: 100 },
          },
          redis: {
            status: 'healthy',
            responseTime: 2,
            lastChecked: Date.now(),
            details: { version: 'Redis 8.1.0', memoryUsed: '50MB', maxMemory: '256MB' },
          },
          datadog: { status: 'healthy', responseTime: 10, lastChecked: Date.now() },
          memory: {
            status: 'healthy',
            usage: 0.5,
            threshold: 0.8,
            details: { used: '512MB', total: '1024MB', percentage: '50%' },
          },
        },
        components: {
          datadog: {
            status: 'healthy',
            connected: true,
            details: { integrationTested: true, apiKeyValid: true, lastCheck: new Date().toISOString() },
          },
          database: { status: 'healthy', connected: true, details: { connectionPool: 10, active: 2 } },
          redis: { status: 'healthy', connected: true, details: { latency: 1, memoryUsage: 0.3 } },
        },
      },
    };
  }

  // Metrics endpoints
  if (urlStr.includes('/api/monitoring/metrics') || urlStr.includes('/api/metrics')) {
    return {
      status: 200,
      ok: true,
      data: {
        timestamp: new Date().toISOString(),
        system: {
          cpu: 25.5,
          memory: 42.3,
          loadAverage: [1.5, 1.2, 0.9],
          network: { rx: 1024000, tx: 512000 },
        },
        application: {
          requestCount: 1000,
          responseTime: 45.2,
          errorRate: 0.5,
        },
      },
    };
  }

  // System monitoring endpoints
  if (urlStr.includes('/api/monitoring/system') || urlStr.includes('/api/monitoring/application') ||
      urlStr.includes('/api/monitoring/database') || urlStr.includes('/api/monitoring/errors')) {
    return {
      status: 200,
      ok: true,
      data: {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        data: {},
      },
    };
  }

  // Datadog API endpoints
  if (urlStr.includes('datadoghq.com')) {
    if (urlStr.includes('/api/v1/validate')) {
      return { status: 200, ok: true, data: { valid: true } };
    }
    if (urlStr.includes('/api/v1/series')) {
      return { status: 202, ok: true, data: { status: 'ok' } };
    }
    if (urlStr.includes('/api/v1/query')) {
      return { status: 200, ok: true, data: { series: [], status: 'ok' } };
    }
    return { status: 200, ok: true, data: { status: 'ok' } };
  }

  // AI Dashboard endpoint
  if (urlStr.includes('/api/ai/dashboard')) {
    return {
      status: 200,
      ok: true,
      data: {
        recentActivity: [
          { text: 'Used Claude 3.5 Sonnet for code review', time: '2m ago' },
          { text: 'Generated unit tests with GPT-4o', time: '15m ago' },
          { text: 'Refactored auth module via multi-agent', time: '1h ago' },
        ],
        usageStats: {
          requestsToday: '47',
          avgResponseTime: '1.2s',
          topModel: 'Claude 3.5 Sonnet',
        },
      },
    };
  }

  // AI Conversations endpoint
  if (urlStr.includes('/api/ai/conversations')) {
    const now = new Date();
    const conversations = [
      // 10 active conversations
      { id: '1', title: 'Help me refactor this React component', model: 'Claude 3.5 Sonnet', modelProvider: 'anthropic', messageCount: 15, createdAt: new Date(now - 3600000).toISOString(), updatedAt: new Date(now - 3600000).toISOString(), estimatedCost: 0.05, archived: false },
      { id: '2', title: 'Write a Python script to parse CSV files', model: 'GPT-4o', modelProvider: 'openai', messageCount: 8, createdAt: new Date(now - 7200000).toISOString(), updatedAt: new Date(now - 7200000).toISOString(), estimatedCost: 0.03, archived: false },
      { id: '3', title: 'Review my Terraform configuration for best practices', model: 'Claude 3.5 Sonnet', modelProvider: 'anthropic', messageCount: 12, createdAt: new Date(now - 10800000).toISOString(), updatedAt: new Date(now - 10800000).toISOString(), estimatedCost: 0.04, archived: false },
      { id: '4', title: 'Explain the differences between REST and GraphQL', model: 'GPT-4o', modelProvider: 'openai', messageCount: 6, createdAt: new Date(now - 14400000).toISOString(), updatedAt: new Date(now - 14400000).toISOString(), estimatedCost: 0.02, archived: false },
      { id: '5', title: 'Debug this Node.js memory leak', model: 'Claude 3.5 Sonnet', modelProvider: 'anthropic', messageCount: 20, createdAt: new Date(now - 18000000).toISOString(), updatedAt: new Date(now - 18000000).toISOString(), estimatedCost: 0.08, archived: false },
      { id: '6', title: 'Create a Docker compose file for my app', model: 'GPT-4o', modelProvider: 'openai', messageCount: 10, createdAt: new Date(now - 21600000).toISOString(), updatedAt: new Date(now - 21600000).toISOString(), estimatedCost: 0.04, archived: false },
      { id: '7', title: 'Design a database schema for e-commerce', model: 'Claude 3.5 Sonnet', modelProvider: 'anthropic', messageCount: 18, createdAt: new Date(now - 25200000).toISOString(), updatedAt: new Date(now - 25200000).toISOString(), estimatedCost: 0.07, archived: false },
      { id: '8', title: 'Optimize SQL queries for performance', model: 'GPT-4o', modelProvider: 'openai', messageCount: 9, createdAt: new Date(now - 28800000).toISOString(), updatedAt: new Date(now - 28800000).toISOString(), estimatedCost: 0.03, archived: false },
      { id: '9', title: 'Set up CI/CD pipeline with GitHub Actions', model: 'Claude 3.5 Sonnet', modelProvider: 'anthropic', messageCount: 14, createdAt: new Date(now - 32400000).toISOString(), updatedAt: new Date(now - 32400000).toISOString(), estimatedCost: 0.06, archived: false },
      { id: '10', title: 'Implement OAuth2 authentication', model: 'GPT-4o', modelProvider: 'openai', messageCount: 11, createdAt: new Date(now - 36000000).toISOString(), updatedAt: new Date(now - 36000000).toISOString(), estimatedCost: 0.04, archived: false },
      // 2 archived conversations
      { id: '11', title: 'Old project discussion', model: 'Claude 3.5 Sonnet', modelProvider: 'anthropic', messageCount: 5, createdAt: new Date(now - 86400000).toISOString(), updatedAt: new Date(now - 86400000).toISOString(), estimatedCost: 0.02, archived: true },
      { id: '12', title: 'Archived brainstorming session', model: 'GPT-4o', modelProvider: 'openai', messageCount: 3, createdAt: new Date(now - 172800000).toISOString(), updatedAt: new Date(now - 172800000).toISOString(), estimatedCost: 0.01, archived: true },
    ];
    return { status: 200, ok: true, data: { conversations } };
  }

  // Agents list endpoint
  if (urlStr.includes('/api/agents/list') || urlStr.endsWith('/api/agents')) {
    return { status: 200, ok: true, data: { data: [] } };
  }

  // Default response for unmatched URLs
  return { status: 200, ok: true, data: {} };
};

const defaultFetchMock = jest.fn((url, options) => {
  const urlStr = typeof url === 'string' ? url : url?.url || '';
  const mockResponse = getMockResponse(url);

  return Promise.resolve({
    ok: mockResponse.ok,
    status: mockResponse.status,
    statusText: mockResponse.ok ? 'OK' : 'Unauthorized',
    headers: new Headers({ 'content-type': 'application/json' }),
    url: urlStr,
    redirected: false,
    type: 'basic',
    body: null,
    bodyUsed: false,
    json: () => Promise.resolve(mockResponse.data),
    text: () => Promise.resolve(JSON.stringify(mockResponse.data)),
    blob: () => Promise.resolve(new Blob([JSON.stringify(mockResponse.data)])),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    formData: () => Promise.resolve(new FormData()),
    clone: function() { return { ...this }; },
  });
});

const restoreDefaultFetchMock = () => {
  global.fetch = defaultFetchMock;
};

restoreDefaultFetchMock();

beforeEach(() => {
  restoreDefaultFetchMock();
  defaultFetchMock.mockClear();
});

afterEach(() => {
  restoreDefaultFetchMock();
  defaultFetchMock.mockClear();
});

// Mock Next.js modules
// Create mock functions outside the factory to avoid scope issues
const mockPush = () => {};
const mockReplace = () => {};
const mockBack = () => {};
const mockForward = () => {};
const mockRefresh = () => {};
const mockPrefetch = () => {};

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    forward: mockForward,
    refresh: mockRefresh,
    prefetch: mockPrefetch,
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/server with our custom implementation
jest.mock('next/server', () => {
  const mockModule = jest.requireActual('./__mocks__/next/server.ts');
  return mockModule;
});

// Create mock function outside the factory
const mockGetServerSession = () => Promise.resolve({
  user: {
    id: 'test-user',
    email: 'test@example.com',
    role: 'admin',
  },
});

jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: mockGetServerSession,
}));

// Mock logger to prevent auth module loading issues (Issue #792)
// Added createChildLogger for Node 20 compatibility (Issue mm-tdy3)
// Create mock logger outside the factory to avoid scope issues
const mockLogFn = () => {};
const mockLoggerObj = {
  info: mockLogFn,
  warn: mockLogFn,
  error: mockLogFn,
  debug: mockLogFn,
  log: mockLogFn,
  child: () => mockLoggerObj,
};

jest.mock('@/lib/logger', () => ({
  logger: mockLoggerObj,
  createChildLogger: () => mockLoggerObj,
  createLogger: () => mockLoggerObj,
}));

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
// OAuth provider credentials (required for auth.ts to load correctly)
process.env.GITHUB_ID = 'test-github-id';
process.env.GITHUB_SECRET = 'test-github-secret';
process.env.GOOGLE_CLIENT_ID = 'test-google-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';

// Mock DOM methods not available in JSDOM
if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = () => {};
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
};

// Mock matchMedia (only in browser environments)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}
