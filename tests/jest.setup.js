// Jest setup file
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

// Add Node.js webcrypto to global scope for tests
// This provides crypto.randomUUID() and other Web Crypto API methods
// Required for Edge Runtime route handlers that use crypto.randomUUID()
if (typeof global.crypto === 'undefined') {
  try {
    // Node 18+ provides webcrypto compatible with browser crypto
    const { webcrypto } = require('node:crypto');
    global.crypto = webcrypto;
  } catch (error) {
    // Fallback for older Node versions
    const crypto = require('crypto');
    global.crypto = {
      randomUUID: () => crypto.randomUUID(),
      getRandomValues: (buffer) => crypto.randomFillSync(buffer),
    };
  }
}

// Setup default fetch mock before each test
beforeEach(() => {
  // Mock fetch to return 401 for UserPreferencesProvider (uses default preferences)
  if (!global.fetch || !global.fetch.mockImplementation) {
    global.fetch = jest.fn();
  }
  global.fetch.mockImplementation((url) => {
    // Default mock - return 401 to trigger default preferences
    return Promise.resolve({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob()),
    });
  });
});

// Automatically cleanup after each test
afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

// Don't mock global fetch/Headers/Request/Response here
// They are provided by jest.polyfills.js which loads first

// Mock Next.js modules
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock next/image to avoid image optimization errors in tests
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => {
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    return <img {...props} />;
  },
}));

// Mock next/link to use regular anchor tags in tests
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }) => {
    return <a href={href} {...props}>{children}</a>;
  },
}));

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
// AI Gateway environment variables
process.env.OPENROUTER_API_KEY = 'test-api-key';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.REDIS_URL = 'redis://localhost:6379';

// Suppress console errors in tests unless explicitly needed
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  // Mock global fetch for UserPreferencesProvider
  global.fetch = global.fetch || jest.fn();

  console.error = (...args) => {
    // Filter out known React warnings in test environment
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
       args[0].includes('Warning: useLayoutEffect') ||
       args[0].includes('Not implemented: HTMLFormElement.prototype.submit') ||
       args[0].includes('not wrapped in act'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args) => {
    // Filter out common warnings
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('componentWillReceiveProps') ||
       args[0].includes('componentWillMount'))
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Mock monitoring modules that have complex dependencies
jest.mock('@/lib/security/macos-keychain-server');

// Mock UnifiedAIClient globally to prevent OOM during tests
jest.mock('@/lib/unified-ai-client');

// Mock next-themes globally to fix onboarding tests
jest.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: jest.fn(),
    themes: ['light', 'dark'],
  }),
  ThemeProvider: ({ children }) => children,
}));

jest.mock('@/instrument', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    trace: jest.fn(),
    scope: jest.fn(() => ({
      active: jest.fn(() => ({
        setTag: jest.fn(),
        setTags: jest.fn(),
        addTags: jest.fn(),
        log: jest.fn(),
      })),
    })),
  },
}));

// Mock OpenTelemetry API globally for ai-gateway tests
jest.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: jest.fn(() => ({
      startSpan: jest.fn(() => ({
        end: jest.fn(),
        setAttribute: jest.fn(),
        setAttributes: jest.fn(),
        addEvent: jest.fn(),
        setStatus: jest.fn(),
        updateName: jest.fn(),
        isRecording: jest.fn(() => false),
      })),
    })),
    getActiveSpan: jest.fn(),
    setSpan: jest.fn(),
  },
  context: {
    active: jest.fn(() => ({})),
    with: jest.fn((ctx, fn) => fn()),
  },
  SpanStatusCode: {
    OK: 0,
    ERROR: 1,
  },
}));
