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
