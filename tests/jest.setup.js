// Jest setup file
import '@testing-library/jest-dom';

// Note: Browser API polyfills (fetch, Headers, Request, Response, TextEncoder, etc.) 
// are provided by tests/jest.polyfills.js which is loaded first via setupFiles.
// Individual tests can mock global.fetch as needed using jest.fn().

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
}));

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
