/**
 * Mock Workspace Factory
 *
 * Creates realistic mock workspace objects for testing workspace management,
 * collaboration features, and code-server integration.
 *
 * @example
 * ```typescript
 * const workspace = createMockWorkspace();
 * const myWorkspace = createMockWorkspace({ name: 'My Project', owner: 'user-123' });
 * const sharedWorkspace = createMockWorkspace({ members: ['user-1', 'user-2'] });
 * ```
 */

export interface MockWorkspace {
  id: string;
  name: string;
  owner: string;
  members: string[];
  settings: Record<string, any>;
  createdAt: Date;
  updatedAt?: Date;
  description?: string;
  status?: 'active' | 'archived' | 'pending';
}

/**
 * Creates a mock workspace object with sensible defaults
 *
 * @param overrides - Partial workspace object to override defaults
 * @returns Complete mock workspace object
 */
export const createMockWorkspace = (overrides: Partial<MockWorkspace> = {}): MockWorkspace => {
  const timestamp = new Date();

  return {
    id: 'mock-workspace-id',
    name: 'Test Workspace',
    owner: 'user-123',
    members: [],
    settings: {
      language: 'typescript',
      theme: 'dark',
      autoSave: true,
    },
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
    description: 'A test workspace for unit tests',
    ...overrides,
  };
};

/**
 * Creates a mock workspace with multiple members
 *
 * @param memberIds - Array of user IDs to add as members
 * @param overrides - Additional workspace overrides
 * @returns Mock workspace with members
 */
export const createMockSharedWorkspace = (
  memberIds: string[],
  overrides: Partial<MockWorkspace> = {}
): MockWorkspace => {
  return createMockWorkspace({
    id: 'shared-workspace-id',
    name: 'Shared Workspace',
    members: memberIds,
    ...overrides,
  });
};

/**
 * Creates a mock archived workspace
 *
 * @param overrides - Additional workspace overrides
 * @returns Mock archived workspace
 */
export const createMockArchivedWorkspace = (
  overrides: Partial<MockWorkspace> = {}
): MockWorkspace => {
  return createMockWorkspace({
    id: 'archived-workspace-id',
    name: 'Archived Workspace',
    status: 'archived',
    ...overrides,
  });
};

/**
 * Creates multiple mock workspaces at once
 *
 * @param count - Number of workspaces to create
 * @param baseOverrides - Base overrides to apply to all workspaces
 * @returns Array of mock workspaces
 */
export const createMockWorkspaces = (
  count: number,
  baseOverrides: Partial<MockWorkspace> = {}
): MockWorkspace[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockWorkspace({
      id: `workspace-${index + 1}`,
      name: `Workspace ${index + 1}`,
      ...baseOverrides,
    })
  );
};

/**
 * Creates a mock workspace configuration object (settings only)
 *
 * @param overrides - Settings to override defaults
 * @returns Mock workspace settings
 */
export const createMockWorkspaceSettings = (
  overrides: Record<string, any> = {}
): Record<string, any> => {
  return {
    language: 'typescript',
    theme: 'dark',
    autoSave: true,
    fontSize: 14,
    tabSize: 2,
    lineNumbers: true,
    minimap: true,
    wordWrap: 'on',
    ...overrides,
  };
};
