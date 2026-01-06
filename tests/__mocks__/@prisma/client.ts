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

// In-memory storage for experiments
const experimentsStore: Array<any> = []
const experimentAssignmentsStore: Array<any> = []
const experimentMetricsStore: Array<any> = []

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

    // Mock pgvector extension check
    if (queryStr.toLowerCase().includes('pg_extension') && queryStr.toLowerCase().includes('vector')) {
      return Promise.resolve([{ extname: 'vector' }]);
    }

    // Mock pgvector type check
    if (queryStr.toLowerCase().includes('pg_type') && queryStr.toLowerCase().includes('vector')) {
      return Promise.resolve([{ typname: 'vector' }]);
    }

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

  // Experiment models with in-memory storage
  experiment: {
    ...createModelMock(),
    findUnique: jest.fn((args) => {
      const exp = experimentsStore.find(e =>
        (args.where.id && e.id === args.where.id) ||
        (args.where.key && e.key === args.where.key)
      );
      if (!exp) return Promise.resolve(null);

      // Include related data if requested
      const result = { ...exp };
      if (args.include?.assignments !== undefined) {
        let assignments = experimentAssignmentsStore.filter(a => a.experimentId === exp.id);
        // Map to include both camelCase and snake_case fields
        assignments = assignments.map(a => ({
          ...a,
          experiment_id: a.experimentId,
          user_id: a.userId,
          variant_key: a.variantKey,
          timestamp: a.assignedAt
        }));
        result.assignments = assignments;
      }
      if (args.include?.metrics !== undefined) {
        // Handle both boolean and object includes
        const metricsInclude = typeof args.include.metrics === 'object' ? args.include.metrics : {};
        const metricsWhere = metricsInclude.where || {};
        let metrics = experimentMetricsStore.filter(m => m.experimentId === exp.id);

        // Apply metric name filter if specified (support both metricName and metric_name)
        if (metricsWhere.metricName) {
          metrics = metrics.filter(m => m.metricName === metricsWhere.metricName);
        }
        if (metricsWhere.metric_name) {
          metrics = metrics.filter(m => m.metricName === metricsWhere.metric_name);
        }
        // Handle OR conditions
        if (metricsWhere.OR) {
          metrics = metrics.filter(m =>
            metricsWhere.OR.some((cond: any) =>
              (cond.metricName && m.metricName === cond.metricName) ||
              (cond.metric_name && m.metricName === cond.metric_name)
            )
          );
        }

        // Include assignment relationship if requested
        if (metricsInclude.include?.assignment) {
          metrics = metrics.map(m => {
            const assignment = experimentAssignmentsStore.find(a => a.id === m.assignmentId);
            return {
              ...m,
              experiment_id: m.experimentId,
              metric_name: m.metricName,
              value: m.metricValue,
              assignment: assignment ? {
                ...assignment,
                user_id: assignment.userId,
                variant_key: assignment.variantKey
              } : null
            };
          });
        } else {
          // Still map field names even without assignment
          metrics = metrics.map(m => ({
            ...m,
            experiment_id: m.experimentId,
            metric_name: m.metricName,
            value: m.metricValue
          }));
        }

        result.metrics = metrics;
      }
      return Promise.resolve(result);
    }),
    findFirst: jest.fn((args) => {
      const exp = experimentsStore.find(e => {
        if (args.where?.id && e.id === args.where.id) return true;
        if (args.where?.key && e.key === args.where.key) return true;
        if (args.where?.OR) {
          return args.where.OR.some((cond: any) =>
            (cond.id && e.id === cond.id) || (cond.key && e.key === cond.key)
          );
        }
        return false;
      });
      return Promise.resolve(exp || null);
    }),
    create: jest.fn((args) => {
      const id = String(mockIdCounter++);
      const created = {
        id,
        key: args.data.key,
        name: args.data.name,
        config: args.data.config,
        hypothesis: args.data.hypothesis || null,
        status: args.data.status || 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: null,
        completedAt: null,
      };
      experimentsStore.push(created);
      return Promise.resolve(created);
    }),
    upsert: jest.fn((args) => {
      const existing = experimentsStore.find(e => e.key === args.where.key);
      if (existing) {
        Object.assign(existing, args.update, { updatedAt: new Date() });
        return Promise.resolve(existing);
      } else {
        const id = String(mockIdCounter++);
        const created = {
          id,
          ...args.create,
          createdAt: new Date(),
          updatedAt: new Date(),
          startedAt: null,
          completedAt: null,
        };
        experimentsStore.push(created);
        return Promise.resolve(created);
      }
    }),
    update: jest.fn((args) => {
      const exp = experimentsStore.find(e =>
        (args.where.id && e.id === args.where.id) ||
        (args.where.key && e.key === args.where.key)
      );
      if (exp) {
        Object.assign(exp, args.data, { updatedAt: new Date() });
        return Promise.resolve(exp);
      }
      return Promise.reject(new Error('Experiment not found'));
    }),
    findMany: jest.fn((args) => {
      let filtered = [...experimentsStore];
      if (args?.where?.status) {
        filtered = filtered.filter(e => e.status === args.where.status);
      }
      if (args?.where?.key?.startsWith) {
        filtered = filtered.filter(e => e.key.startsWith(args.where.key.startsWith));
      }
      if (args?.orderBy) {
        const orderBy = Array.isArray(args.orderBy) ? args.orderBy[0] : args.orderBy;
        const key = Object.keys(orderBy)[0];
        const direction = orderBy[key];
        filtered.sort((a, b) => {
          const aVal = a[key];
          const bVal = b[key];
          if (direction === 'desc') {
            return aVal < bVal ? 1 : -1;
          }
          return aVal < bVal ? -1 : 1;
        });
      }
      return Promise.resolve(filtered);
    }),
    deleteMany: jest.fn((args) => {
      const initialLength = experimentsStore.length;
      if (args?.where?.key?.startsWith) {
        experimentsStore.splice(0, experimentsStore.length,
          ...experimentsStore.filter(e => !e.key.startsWith(args.where.key.startsWith))
        );
      }
      return Promise.resolve({ count: initialLength - experimentsStore.length });
    }),
  },
  experimentAssignment: {
    ...createModelMock(),
    findUnique: jest.fn((args) => {
      const key = args.where.experiment_id_user_id;
      const assignment = experimentAssignmentsStore.find(a =>
        a.experimentId === key.experimentId && a.userId === key.userId
      );
      return Promise.resolve(assignment || null);
    }),
    create: jest.fn((args) => {
      const id = String(mockIdCounter++);
      const created = {
        id,
        experimentId: args.data.experimentId,
        userId: args.data.userId,
        variantKey: args.data.variantKey,
        metadata: args.data.metadata || null,
        assignedAt: args.data.assignedAt || new Date(),
      };
      experimentAssignmentsStore.push(created);
      return Promise.resolve(created);
    }),
    createMany: jest.fn((args) => {
      const created = args.data.map((d: any) => {
        const id = String(mockIdCounter++);
        const assignment = {
          id,
          experimentId: d.experimentId,
          userId: d.userId,
          variantKey: d.variantKey,
          metadata: d.metadata || null,
          assignedAt: d.assignedAt || new Date(),
        };
        experimentAssignmentsStore.push(assignment);
        return assignment;
      });
      return Promise.resolve({ count: created.length });
    }),
    upsert: jest.fn((args) => {
      const key = args.where.experiment_id_user_id;
      const existing = experimentAssignmentsStore.find(a =>
        a.experimentId === key.experimentId && a.userId === key.userId
      );
      if (existing) {
        Object.assign(existing, args.update);
        return Promise.resolve(existing);
      } else {
        const id = String(mockIdCounter++);
        const created = {
          id,
          experimentId: key.experimentId,
          userId: key.userId,
          variantKey: args.create.variantKey,
          metadata: args.create.metadata || null,
          assignedAt: new Date(),
        };
        experimentAssignmentsStore.push(created);
        return Promise.resolve(created);
      }
    }),
    groupBy: jest.fn((args) => {
      const filtered = experimentAssignmentsStore.filter(a =>
        a.experimentId === args.where?.experimentId
      );
      const grouped = filtered.reduce((acc, a) => {
        const existing = acc.find((g: any) => g.variantKey === a.variantKey);
        if (existing) {
          existing._count.id++;
        } else {
          acc.push({ variantKey: a.variantKey, _count: { id: 1 } });
        }
        return acc;
      }, [] as any[]);
      return Promise.resolve(grouped);
    }),
    deleteMany: jest.fn((args) => {
      const initialLength = experimentAssignmentsStore.length;
      if (args?.where?.experiment) {
        const keyMatch = args.where.experiment.key?.startsWith;
        if (keyMatch) {
          // Filter based on experiment key starting with pattern
          const experimentsToDelete = experimentsStore
            .filter(e => e.key.startsWith(keyMatch))
            .map(e => e.id);
          experimentAssignmentsStore.splice(0, experimentAssignmentsStore.length,
            ...experimentAssignmentsStore.filter(a => !experimentsToDelete.includes(a.experimentId))
          );
        }
      }
      return Promise.resolve({ count: initialLength - experimentAssignmentsStore.length });
    }),
  },
  experimentMetric: {
    ...createModelMock(),
    create: jest.fn((args) => {
      const id = String(mockIdCounter++);
      const metric = {
        id,
        experimentId: args.data.experimentId,
        assignmentId: args.data.assignmentId,
        metricName: args.data.metricName,
        metricValue: args.data.metricValue,
        metadata: args.data.metadata || null,
        timestamp: args.data.timestamp || new Date(),
      };
      experimentMetricsStore.push(metric);
      return Promise.resolve(metric);
    }),
    createMany: jest.fn((args) => {
      const created = args.data.map((d: any) => {
        // Skip if assignmentId is empty/null and skipDuplicates is true
        if (args.skipDuplicates && (!d.assignmentId || d.assignmentId === '')) {
          return null;
        }

        const id = String(mockIdCounter++);
        const metric = {
          id,
          experimentId: d.experimentId,
          assignmentId: d.assignmentId,
          metricName: d.metricName,
          metricValue: d.metricValue,
          metadata: d.metadata || null,
          timestamp: new Date(),
        };
        experimentMetricsStore.push(metric);
        return metric;
      }).filter(Boolean); // Remove nulls
      return Promise.resolve({ count: created.length });
    }),
    findMany: jest.fn((args) => {
      let filtered = [...experimentMetricsStore];
      if (args?.where?.experimentId) {
        filtered = filtered.filter(m => m.experimentId === args.where.experimentId);
      }
      if (args?.where?.metricName) {
        filtered = filtered.filter(m => m.metricName === args.where.metricName);
      }

      // Include assignment if requested
      if (args?.include?.assignment) {
        filtered = filtered.map(m => ({
          ...m,
          assignment: experimentAssignmentsStore.find(a => a.id === m.assignmentId) || null
        }));
      }

      return Promise.resolve(filtered);
    }),
    deleteMany: jest.fn((args) => {
      const initialLength = experimentMetricsStore.length;
      if (args?.where?.experiment) {
        const keyMatch = args.where.experiment.key?.startsWith;
        if (keyMatch) {
          // Filter based on experiment key starting with pattern
          const experimentsToDelete = experimentsStore
            .filter(e => e.key.startsWith(keyMatch))
            .map(e => e.id);
          experimentMetricsStore.splice(0, experimentMetricsStore.length,
            ...experimentMetricsStore.filter(m => !experimentsToDelete.includes(m.experimentId))
          );
        }
      }
      return Promise.resolve({ count: initialLength - experimentMetricsStore.length });
    }),
  },
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

// Export ExperimentStatus enum for direct imports
export const ExperimentStatus = {
  DRAFT: 'DRAFT',
  REVIEW: 'REVIEW',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
} as const

// Export Prisma namespace types (these won't affect runtime)
export const Prisma = {
  // Enums
  ExperimentStatus: {
    DRAFT: 'DRAFT',
    REVIEW: 'REVIEW',
    RUNNING: 'RUNNING',
    PAUSED: 'PAUSED',
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
  experimentsStore.splice(0, experimentsStore.length);
  experimentAssignmentsStore.splice(0, experimentAssignmentsStore.length);
  experimentMetricsStore.splice(0, experimentMetricsStore.length);

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
