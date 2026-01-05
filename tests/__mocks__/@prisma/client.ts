/**
 * Comprehensive Prisma Client Mock for Testing
 *
 * This mock provides a complete PrismaClient implementation with all models
 * from the schema. Each model has all standard CRUD operations mocked.
 *
 * Usage:
 * ```typescript
 * import { PrismaClient } from '@prisma/client'
 * jest.mock('@prisma/client')
 *
 * const prisma = new PrismaClient()
 * // All methods are jest.fn() and can be mocked per test
 * ```
 */

// Auto-incrementing ID counter for mocks
let mockIdCounter = 1;

// Create standard CRUD operations for a model
const createModelMock = () => ({
  findUnique: jest.fn(),
  findUniqueOrThrow: jest.fn(),
  findFirst: jest.fn(),
  findFirstOrThrow: jest.fn(),
  findMany: jest.fn(() => Promise.resolve([])),
  create: jest.fn((args) => {
    // Return the data with an auto-generated ID
    const id = mockIdCounter++;
    const created = {
      id,
      ...args.data,
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Store user data for raw SQL queries
    if (args?.data?.email) {
      usersStore.push({
        id: created.id,
        email: args.data.email,
        name: args.data.name || null
      });
    }

    return Promise.resolve(created);
  }),
  createMany: jest.fn(),
  update: jest.fn((args) => {
    // Return the updated data
    return Promise.resolve({
      ...args.data,
      updated_at: new Date(),
    });
  }),
  updateMany: jest.fn(),
  upsert: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
  count: jest.fn(() => Promise.resolve(0)),
  aggregate: jest.fn(),
  groupBy: jest.fn(),
})

// In-memory storage for raw SQL operations
const workspaceMembersStore: Array<{
  user_id: number
  workspace_id: number
  role: string
  invited_by: number
  invited_at: Date
  accepted_at: Date | null
  revoked_at: Date | null
  permissions: any
  created_at: Date
  updated_at: Date
}> = []

const usersStore: Array<{
  id: number
  email: string
  name: string | null
}> = []

// Create a mock PrismaClient instance
const createPrismaClientMock = () => ({
  // Core Prisma methods
  $connect: jest.fn(() => Promise.resolve()),
  $disconnect: jest.fn(() => Promise.resolve()),
  $executeRaw: jest.fn((query, ...params) => {
    // Handle tagged template literal - query is an array of string parts
    // Filter out empty strings and join to form the full query
    const queryStr = Array.isArray(query)
      ? query.filter(s => s && s.trim()).join(' ')
      : String(query);

    // Mock INSERT INTO workspace_members
    if (queryStr.includes('INSERT INTO workspace_members')) {
      const userId = params[0]
      const workspaceId = params[1]
      const role = params[2]
      const invitedBy = params[3]

      const existingIndex = workspaceMembersStore.findIndex(
        m => m.user_id === userId && m.workspace_id === workspaceId
      )

      if (existingIndex >= 0) {
        // Update existing
        workspaceMembersStore[existingIndex] = {
          ...workspaceMembersStore[existingIndex],
          role,
          revoked_at: null,
          updated_at: new Date()
        }
      } else {
        // Insert new
        workspaceMembersStore.push({
          user_id: userId,
          workspace_id: workspaceId,
          role,
          invited_by: invitedBy,
          invited_at: new Date(),
          accepted_at: new Date(),
          revoked_at: null,
          permissions: null,
          created_at: new Date(),
          updated_at: new Date()
        })
      }
      return Promise.resolve(1)
    }

    // Mock UPDATE workspace_members (role change) - check this FIRST before revoke
    if (queryStr.includes('UPDATE workspace_members') && queryStr.includes('SET role')) {
      // Query format: UPDATE workspace_members SET role = ${newRole}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ${userId} AND workspace_id = ${workspaceId}
      // So params are: [newRole, userId, workspaceId]
      const newRole = params[0]
      const userId = params[1]
      const workspaceId = params[2]

      const member = workspaceMembersStore.find(
        m => m.user_id === userId && m.workspace_id === workspaceId && !m.revoked_at
      )

      if (member) {
        member.role = newRole
        member.updated_at = new Date()
        return Promise.resolve(1)
      }
      return Promise.resolve(0)
    }

    // Mock UPDATE workspace_members (revoke)
    if (queryStr.includes('UPDATE workspace_members') && queryStr.includes('SET revoked_at')) {
      const userId = params[0]
      const workspaceId = params[1]

      const member = workspaceMembersStore.find(
        m => m.user_id === userId && m.workspace_id === workspaceId && !m.revoked_at
      )

      if (member) {
        member.revoked_at = new Date()
        return Promise.resolve(1)
      }
      return Promise.resolve(0)
    }

    // Mock DELETE FROM workspace_members
    if (queryStr.includes('DELETE FROM workspace_members')) {
      const workspaceId = params[0]
      const initialLength = workspaceMembersStore.length
      workspaceMembersStore.splice(0, workspaceMembersStore.length,
        ...workspaceMembersStore.filter(m => m.workspace_id !== workspaceId)
      )
      return Promise.resolve(initialLength - workspaceMembersStore.length)
    }

    return Promise.resolve(0)
  }),
  $executeRawUnsafe: jest.fn(() => Promise.resolve(0)),
  $queryRaw: jest.fn((query, ...params) => {
    // Handle tagged template literal - query is an array of string parts
    // Filter out empty strings and join to form the full query
    const queryStr = Array.isArray(query)
      ? query.filter(s => s && s.trim()).join(' ')
      : String(query);

    // Mock SELECT FROM workspace_members JOIN users (list members) - check this FIRST
    if (queryStr.includes('wm.user_id') && queryStr.includes('JOIN users')) {
      const workspaceId = params[0]

      const members = workspaceMembersStore
        .filter(m => m.workspace_id === workspaceId && !m.revoked_at)
        .map(m => {
          const user = usersStore.find(u => u.id === m.user_id)
          return {
            user_id: m.user_id,
            email: user?.email || `user${m.user_id}@test.com`,
            name: user?.name || `User ${m.user_id}`,
            role: m.role,
            invited_at: m.invited_at,
            accepted_at: m.accepted_at
          }
        })

      return Promise.resolve(members)
    }

    // Mock SELECT FROM workspace_members (single user access check)
    if (queryStr.includes('FROM workspace_members') && queryStr.includes('WHERE user_id')) {
      const userId = params[0]
      const workspaceId = params[1]

      const member = workspaceMembersStore.find(
        m => m.user_id === userId && m.workspace_id === workspaceId && !m.revoked_at
      )

      if (member) {
        return Promise.resolve([{
          role: member.role,
          permissions: member.permissions,
          revoked_at: member.revoked_at
        }])
      }
      return Promise.resolve([])
    }

    return Promise.resolve([])
  }),
  $queryRawUnsafe: jest.fn(() => Promise.resolve([])),
  $transaction: jest.fn((callback) => {
    if (typeof callback === 'function') {
      return Promise.resolve(callback(createPrismaClientMock()))
    }
    return Promise.resolve([])
  }),
  $use: jest.fn(),
  $on: jest.fn(),
  $extends: jest.fn(),

  // User model
  user: createModelMock(),

  // Session model
  session: createModelMock(),

  // Workspace model (with special handling for workspace_members)
  workspace: {
    ...createModelMock(),
    create: jest.fn((args) => {
      const id = mockIdCounter++;
      const created = {
        id,
        ...args.data,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Automatically add workspace owner to workspace_members
      if (args.data.user_id) {
        workspaceMembersStore.push({
          user_id: args.data.user_id,
          workspace_id: created.id,
          role: 'owner',
          invited_by: args.data.user_id,
          invited_at: new Date(),
          accepted_at: new Date(),
          revoked_at: null,
          permissions: null,
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      return Promise.resolve(created);
    })
  },

  // Project model
  project: createModelMock(),

  // File model
  file: createModelMock(),

  // RAGChunk model
  rAGChunk: createModelMock(),

  // RAGIngestJob model
  rAGIngestJob: createModelMock(),

  // Upload model
  upload: createModelMock(),

  // AIRequest model
  aIRequest: createModelMock(),

  // Event model
  event: createModelMock(),

  // SystemMetric model
  systemMetric: createModelMock(),

  // Setting model
  setting: createModelMock(),

  // Experiment models
  experiment: createModelMock(),
  experimentAssignment: createModelMock(),
  experimentMetric: createModelMock(),
})

// Create a singleton mock instance (recreate it to get the updated createModelMock behavior)
let globalMockInstance = createPrismaClientMock()

// Mock PrismaClient constructor - always returns the same instance
const MockPrismaClient = jest.fn(() => globalMockInstance)

// Function to recreate the global instance (useful after changing mock implementations)
export const recreateGlobalMockInstance = () => {
  globalMockInstance = createPrismaClientMock()
}

// Export the mock
export { MockPrismaClient as PrismaClient }

// Export the global instance for direct access
export { globalMockInstance as prismaMock }

// Export Prisma namespace types (these won't affect runtime)
export const Prisma = {
  // Enums
  ExperimentStatus: {
    DRAFT: 'DRAFT',
    REVIEW: 'REVIEW',
    RUNNING: 'RUNNING',
    COMPLETED: 'COMPLETED',
    ARCHIVED: 'ARCHIVED',
  },

  // Query modes
  QueryMode: {
    default: 'default',
    insensitive: 'insensitive',
  },

  // Sort order
  SortOrder: {
    asc: 'asc',
    desc: 'desc',
  },

  // Transaction isolation level
  TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable',
  },

  // Model names
  ModelName: {
    User: 'User',
    Session: 'Session',
    Workspace: 'Workspace',
    Project: 'Project',
    File: 'File',
    RAGChunk: 'RAGChunk',
    RAGIngestJob: 'RAGIngestJob',
    Upload: 'Upload',
    AIRequest: 'AIRequest',
    Event: 'Event',
    SystemMetric: 'SystemMetric',
    Setting: 'Setting',
    Experiment: 'Experiment',
    ExperimentAssignment: 'ExperimentAssignment',
    ExperimentMetric: 'ExperimentMetric',
  },

  // Validators (pass-through for mocking)
  validator: <T>(fn: () => T) => fn,

  // DMMF (Database Metadata Model Format)
  dmmf: {
    datamodel: { models: [], enums: [], types: [] },
    schema: { inputObjectTypes: [], outputObjectTypes: [], enumTypes: [] },
    mappings: { modelOperations: [] },
  },
} as any

// Export a default mock instance for convenience
export const mockPrismaClient = createPrismaClientMock()

// Reset function for tests
export const resetPrismaMock = () => {
  // Reset the ID counter
  mockIdCounter = 1;

  // Clear in-memory stores
  workspaceMembersStore.splice(0, workspaceMembersStore.length);
  usersStore.splice(0, usersStore.length);

  // Reset all mocks on the global instance
  Object.values(globalMockInstance).forEach((value) => {
    if (value && typeof value === 'object') {
      Object.values(value).forEach((fn) => {
        if (jest.isMockFunction(fn)) {
          fn.mockClear()
        }
      })
    }
  })

  // Also reset the mock prismaClient
  Object.values(mockPrismaClient).forEach((value) => {
    if (value && typeof value === 'object') {
      Object.values(value).forEach((fn) => {
        if (jest.isMockFunction(fn)) {
          fn.mockClear()
        }
      })
    }
  })
}
