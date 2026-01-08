// Jest setup file
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

<<<<<<< HEAD
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
=======
// Mock global objects
global.fetch = jest.fn();
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)

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

// Mock next/server with our custom implementation
jest.mock('next/server', () => {
  const mockModule = jest.requireActual('./__mocks__/next/server.ts');
  return mockModule;
});

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';

<<<<<<< HEAD
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
=======
// Mock DOM methods not available in JSDOM
if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = jest.fn();
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

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
