// Jest setup file
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

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

// Suppress console errors in tests unless explicitly needed
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    // Filter out known React warnings in test environment
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
       args[0].includes('Warning: useLayoutEffect') ||
       args[0].includes('Not implemented: HTMLFormElement.prototype.submit'))
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
