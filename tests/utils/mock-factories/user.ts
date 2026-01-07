/**
 * Mock User Factory
 *
 * Creates realistic mock user objects for testing authentication, authorization,
 * and user-related features.
 *
 * @example
 * ```typescript
 * const user = createMockUser();
 * const admin = createMockUser({ role: 'admin' });
 * const specificUser = createMockUser({ id: 'user-123', email: 'specific@example.com' });
 * ```
 */

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role?: string;
  image?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Creates a mock user object with sensible defaults
 *
 * @param overrides - Partial user object to override defaults
 * @returns Complete mock user object
 */
export const createMockUser = (overrides: Partial<MockUser> = {}): MockUser => {
  const timestamp = new Date();

  return {
    id: 'mock-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    image: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
};

/**
 * Creates a mock admin user
 */
export const createMockAdmin = (overrides: Partial<MockUser> = {}): MockUser => {
  return createMockUser({
    id: 'mock-admin-id',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin',
    ...overrides,
  });
};

/**
 * Creates multiple mock users at once
 *
 * @param count - Number of users to create
 * @param baseOverrides - Base overrides to apply to all users
 * @returns Array of mock users
 */
export const createMockUsers = (
  count: number,
  baseOverrides: Partial<MockUser> = {}
): MockUser[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockUser({
      id: `mock-user-${index + 1}`,
      email: `user${index + 1}@example.com`,
      name: `Test User ${index + 1}`,
      ...baseOverrides,
    })
  );
};
