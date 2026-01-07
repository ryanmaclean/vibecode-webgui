/**
 * Mock Session Factory
 *
 * Creates realistic mock session objects for testing NextAuth authentication flows.
 *
 * @example
 * ```typescript
 * const session = createMockSession();
 * const expiredSession = createMockSession({ expires: new Date('2020-01-01') });
 * const customUserSession = createMockSession({ user: createMockUser({ id: 'custom-id' }) });
 * ```
 */

import { createMockUser, type MockUser } from './user';

export interface MockSession {
  user: MockUser;
  expires: Date | string;
}

/**
 * Creates a mock NextAuth session object with sensible defaults
 *
 * @param overrides - Partial session object to override defaults
 * @returns Complete mock session object
 */
export const createMockSession = (overrides: Partial<MockSession> = {}): MockSession => {
  // Default expiry: 24 hours from now
  const defaultExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  return {
    user: createMockUser(),
    expires: defaultExpiry,
    ...overrides,
  };
};

/**
 * Creates a mock session with a specific user
 *
 * @param user - Mock user object
 * @param expiryHours - Hours until expiry (default: 24)
 * @returns Mock session with the specified user
 */
export const createMockSessionWithUser = (
  user: MockUser,
  expiryHours: number = 24
): MockSession => {
  return createMockSession({
    user,
    expires: new Date(Date.now() + expiryHours * 60 * 60 * 1000),
  });
};

/**
 * Creates an expired mock session
 *
 * @param user - Optional mock user object
 * @returns Expired mock session
 */
export const createExpiredMockSession = (user?: MockUser): MockSession => {
  return createMockSession({
    user: user || createMockUser(),
    expires: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
  });
};

/**
 * Creates a mock session that expires soon (useful for testing refresh logic)
 *
 * @param minutesUntilExpiry - Minutes until expiry (default: 5)
 * @param user - Optional mock user object
 * @returns Mock session expiring soon
 */
export const createExpiringSoonMockSession = (
  minutesUntilExpiry: number = 5,
  user?: MockUser
): MockSession => {
  return createMockSession({
    user: user || createMockUser(),
    expires: new Date(Date.now() + minutesUntilExpiry * 60 * 1000),
  });
};
