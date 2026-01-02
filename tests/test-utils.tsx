import React, { ReactElement } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { UserPreferencesProvider } from '@/providers/UserPreferencesProvider';

/**
 * Test utilities for React Testing Library
 * Provides common wrapper components and helper functions for testing
 */

// Mock router type
export type MockRouter = ReturnType<typeof useRouter>;

// Default mock router implementation
export const createMockRouter = (overrides: Partial<MockRouter> = {}): MockRouter => ({
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
  ...overrides,
});

// Mock Next.js navigation hooks
export const mockNextNavigation = (options: {
  router?: Partial<MockRouter>;
  pathname?: string;
  searchParams?: Record<string, string>;
} = {}) => {
  const mockRouter = createMockRouter(options.router);
  const mockPathname = options.pathname || '/';
  const mockSearchParams = new URLSearchParams(options.searchParams || {});

  jest.mock('next/navigation', () => ({
    useRouter: () => mockRouter,
    usePathname: () => mockPathname,
    useSearchParams: () => mockSearchParams,
  }));

  return {
    mockRouter,
    mockPathname,
    mockSearchParams,
  };
};

/**
 * Theme Provider wrapper for components that use theming
 */
interface ThemeProviderWrapperProps {
  children: React.ReactNode;
  theme?: 'light' | 'dark';
}

export const ThemeProviderWrapper: React.FC<ThemeProviderWrapperProps> = ({
  children,
  theme = 'light'
}) => {
  // Simple theme context mock
  return <div data-theme={theme}>{children}</div>;
};

/**
 * Combined providers wrapper
 */
interface AllProvidersProps {
  children: React.ReactNode;
  theme?: 'light' | 'dark';
  router?: Partial<MockRouter>;
  pathname?: string;
  searchParams?: Record<string, string>;
}

export const AllProviders: React.FC<AllProvidersProps> = ({
  children,
  theme = 'light',
}) => {
  return (
    <UserPreferencesProvider>
      <ThemeProviderWrapper theme={theme}>
        {children}
      </ThemeProviderWrapper>
    </UserPreferencesProvider>
  );
};

/**
 * Custom render function that includes all providers
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  theme?: 'light' | 'dark';
  router?: Partial<MockRouter>;
  pathname?: string;
  searchParams?: Record<string, string>;
}

export const renderWithProviders = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
): RenderResult & { mockRouter?: MockRouter } => {
  const {
    theme = 'light',
    router,
    pathname,
    searchParams,
    ...renderOptions
  } = options;

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <AllProviders
      theme={theme}
      router={router}
      pathname={pathname}
      searchParams={searchParams}
    >
      {children}
    </AllProviders>
  );

  const renderResult = render(ui, { wrapper: Wrapper, ...renderOptions });

  return {
    ...renderResult,
    mockRouter: router ? createMockRouter(router) : undefined,
  };
};

/**
 * Helper to wait for an element and then perform an action
 */
export const waitForAndClick = async (
  getByRole: (role: string, options?: any) => HTMLElement,
  role: string,
  options?: any
) => {
  const element = getByRole(role, options);
  element.click();
  return element;
};

/**
 * Mock localStorage for tests
 */
export const mockLocalStorage = () => {
  const storage: { [key: string]: string } = {};

  return {
    getItem: jest.fn((key: string) => storage[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      storage[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete storage[key];
    }),
    clear: jest.fn(() => {
      Object.keys(storage).forEach(key => delete storage[key]);
    }),
    get length() {
      return Object.keys(storage).length;
    },
    key: jest.fn((index: number) => Object.keys(storage)[index] || null),
  };
};

/**
 * Mock sessionStorage for tests
 */
export const mockSessionStorage = () => mockLocalStorage();

/**
 * Setup global mocks for browser APIs
 */
export const setupBrowserMocks = () => {
  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage(),
    writable: true,
  });

  Object.defineProperty(window, 'sessionStorage', {
    value: mockSessionStorage(),
    writable: true,
  });

  // Mock window.location
  delete (window as any).location;
  window.location = {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    protocol: 'http:',
    host: 'localhost:3000',
    hostname: 'localhost',
    port: '3000',
    pathname: '/',
    search: '',
    hash: '',
    assign: jest.fn(),
    reload: jest.fn(),
    replace: jest.fn(),
    toString: () => 'http://localhost:3000',
  } as any;
};

/**
 * Cleanup function to reset all mocks
 */
export const cleanupMocks = () => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
};

/**
 * Helper to create a mock file
 */
export const createMockFile = (
  name: string,
  size: number,
  type: string,
  content: string = ''
): File => {
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

/**
 * Helper to wait for async operations
 */
export const waitForAsync = (ms: number = 0) =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mock IntersectionObserver entries
 */
export const mockIntersectionObserver = (isIntersecting: boolean = true) => {
  const mockObserver = jest.fn().mockImplementation((callback) => {
    callback([{ isIntersecting, target: {} }]);
    return {
      observe: jest.fn(),
      disconnect: jest.fn(),
      unobserve: jest.fn(),
      takeRecords: jest.fn(),
      root: null,
      rootMargin: '',
      thresholds: [],
    };
  });

  window.IntersectionObserver = mockObserver as any;
  return mockObserver;
};

/**
 * Re-export commonly used testing-library functions
 */
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

// Export renderWithProviders as default render
export { renderWithProviders as render };

/**
 * Re-export Prisma test utilities
 */
export {
  createMockPrismaClient,
  mockPrismaUser,
  mockPrismaWorkspace,
  mockPrismaProject,
  mockPrismaFile,
  mockPrismaRAGChunk,
  mockPrismaExperiment,
  mockPrismaExperimentAssignment,
  mockPrismaExperimentMetric,
  mockPrismaAIRequest,
  mockPrismaSession,
  mockPrismaUpload,
  mockPrismaRAGIngestJob,
  setupStandardPrismaMocks,
  mockPrismaTransaction,
  PrismaErrorMock,
  PRISMA_ERROR_CODES,
  mockPrismaUniqueConstraintError,
  mockPrismaNotFoundError,
} from './prisma-test-utils';
