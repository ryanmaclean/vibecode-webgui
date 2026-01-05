/**
 * Prisma Test Utilities
 *
 * Factory functions and helpers for creating mock Prisma objects
 * and working with Prisma in tests.
 */

import type { PrismaClient } from '@prisma/client'
import { mockPrismaClient, resetPrismaMock } from './__mocks__/@prisma/client'

/**
 * Create a mock PrismaClient for testing
 * Returns the global mock instance that can be configured per test
 */
export function createMockPrismaClient(): typeof mockPrismaClient {
  resetPrismaMock()
  return mockPrismaClient
}

/**
 * Mock User Factory
 * Creates a realistic user object for testing
 */
export function mockPrismaUser(overrides: Partial<any> = {}) {
  return {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    avatar: null,
    github_id: null,
    google_id: null,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    ...overrides,
  }
}

/**
 * Mock Workspace Factory
 * Creates a realistic workspace object for testing
 */
export function mockPrismaWorkspace(overrides: Partial<any> = {}) {
  return {
    id: 1,
    name: 'Test Workspace',
    description: 'A test workspace',
    user_id: 1,
    status: 'active',
    workspace_id: 'test-workspace-123',
    url: 'http://localhost:8080',
    dbm_last_sample_at: null,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    ...overrides,
  }
}

/**
 * Mock Project Factory
 * Creates a realistic project object for testing
 */
export function mockPrismaProject(overrides: Partial<any> = {}) {
  return {
    id: 1,
    name: 'Test Project',
    description: 'A test project',
    user_id: 1,
    workspace_id: 1,
    language: 'typescript',
    framework: 'react',
    template: null,
    ai_prompt: null,
    status: 'active',
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    ...overrides,
  }
}

/**
 * Mock File Factory
 * Creates a realistic file object for testing
 */
export function mockPrismaFile(overrides: Partial<any> = {}) {
  return {
    id: 1,
    name: 'test.ts',
    path: '/test/test.ts',
    content: 'console.log("test")',
    size: 100,
    mime_type: 'text/typescript',
    language: 'typescript',
    lines: 1,
    checksum: 'abc123',
    user_id: 1,
    workspace_id: 1,
    project_id: 1,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    ...overrides,
  }
}

/**
 * Mock RAGChunk Factory
 * Creates a realistic RAG chunk object for testing
 */
export function mockPrismaRAGChunk(overrides: Partial<any> = {}) {
  return {
    id: 1,
    content: 'This is a test chunk of content for RAG indexing',
    metadata: { source: 'test' },
    file_id: 1,
    user_id: 1,
    workspace_id: 1,
    project_id: 1,
    chunk_index: 0,
    token_count: 10,
    start_line: 1,
    end_line: 5,
    tokens: 10,
    chunk_id: 'chunk-123',
    embedding: null,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    ...overrides,
  }
}

/**
 * Mock Experiment Factory
 * Creates a realistic experiment object for testing
 */
export function mockPrismaExperiment(overrides: Partial<any> = {}) {
  return {
    id: 'exp-123',
    key: 'test-experiment',
    name: 'Test Experiment',
    description: 'A test experiment',
    status: 'RUNNING',
    config: {
      variants: [
        { key: 'control', weight: 0.5 },
        { key: 'treatment', weight: 0.5 },
      ],
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    startedAt: new Date('2024-01-01'),
    completedAt: null,
    ...overrides,
  }
}

/**
 * Mock ExperimentAssignment Factory
 * Creates a realistic experiment assignment object for testing
 */
export function mockPrismaExperimentAssignment(overrides: Partial<any> = {}) {
  return {
    id: 'assign-123',
    experimentId: 'exp-123',
    userId: 'user-123',
    variantKey: 'control',
    assignedAt: new Date('2024-01-01'),
    metadata: {},
    ...overrides,
  }
}

/**
 * Mock ExperimentMetric Factory
 * Creates a realistic experiment metric object for testing
 */
export function mockPrismaExperimentMetric(overrides: Partial<any> = {}) {
  return {
    id: 'metric-123',
    experimentId: 'exp-123',
    assignmentId: 'assign-123',
    metricName: 'conversion',
    metricValue: 1.0,
    timestamp: new Date('2024-01-01'),
    metadata: {},
    ...overrides,
  }
}

/**
 * Mock AIRequest Factory
 * Creates a realistic AI request object for testing
 */
export function mockPrismaAIRequest(overrides: Partial<any> = {}) {
  return {
    id: 1,
    user_id: 1,
    project_id: 1,
    request_type: 'chat',
    prompt: 'Test prompt',
    model: 'anthropic/claude-3.5-sonnet',
    provider: 'openrouter',
    input_tokens: 100,
    output_tokens: 200,
    cost: 0.01,
    duration_ms: 1000,
    status: 'completed',
    response: { message: 'Test response' },
    error: null,
    created_at: new Date('2024-01-01'),
    completed_at: new Date('2024-01-01'),
    ...overrides,
  }
}

/**
 * Mock Session Factory
 * Creates a realistic session object for testing
 */
export function mockPrismaSession(overrides: Partial<any> = {}) {
  return {
    id: 1,
    session_token: 'session-token-123',
    user_id: 1,
    expires: new Date('2024-12-31'),
    created_at: new Date('2024-01-01'),
    ...overrides,
  }
}

/**
 * Mock Upload Factory
 * Creates a realistic upload object for testing
 */
export function mockPrismaUpload(overrides: Partial<any> = {}) {
  return {
    id: 1,
    original_name: 'test.pdf',
    stored_name: 'upload-123.pdf',
    path: '/uploads/upload-123.pdf',
    size: 1024,
    mime_type: 'application/pdf',
    user_id: 1,
    workspace_id: 1,
    status: 'uploaded',
    metadata: {},
    created_at: new Date('2024-01-01'),
    ...overrides,
  }
}

/**
 * Mock RAGIngestJob Factory
 * Creates a realistic RAG ingest job object for testing
 */
export function mockPrismaRAGIngestJob(overrides: Partial<any> = {}) {
  return {
    id: 'job-123',
    uploadId: 1,
    blobName: 'blob-123',
    storageContainer: 'uploads',
    originalFileName: 'document.pdf',
    size: 1024,
    status: 'queued',
    queueName: 'rag-ingest',
    userIdentifier: 'user-123',
    workspaceIdentifier: 'workspace-123',
    projectIdentifier: null,
    chunkCount: 0,
    error: null,
    requestedAt: new Date('2024-01-01'),
    startedAt: null,
    completedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

/**
 * Setup standard Prisma mocks for common queries
 * Use this in beforeEach to set up typical responses
 */
export function setupStandardPrismaMocks() {
  const prisma = mockPrismaClient

  // User queries
  prisma.user.findUnique.mockResolvedValue(mockPrismaUser())
  prisma.user.findMany.mockResolvedValue([mockPrismaUser()])
  prisma.user.create.mockResolvedValue(mockPrismaUser())

  // Workspace queries
  prisma.workspace.findUnique.mockResolvedValue(mockPrismaWorkspace())
  prisma.workspace.findMany.mockResolvedValue([mockPrismaWorkspace()])
  prisma.workspace.create.mockResolvedValue(mockPrismaWorkspace())

  // Project queries
  prisma.project.findUnique.mockResolvedValue(mockPrismaProject())
  prisma.project.findMany.mockResolvedValue([mockPrismaProject()])
  prisma.project.create.mockResolvedValue(mockPrismaProject())

  // File queries
  prisma.file.findUnique.mockResolvedValue(mockPrismaFile())
  prisma.file.findMany.mockResolvedValue([mockPrismaFile()])
  prisma.file.create.mockResolvedValue(mockPrismaFile())

  // Experiment queries
  prisma.experiment.findUnique.mockResolvedValue(mockPrismaExperiment())
  prisma.experiment.findMany.mockResolvedValue([mockPrismaExperiment()])
  prisma.experiment.create.mockResolvedValue(mockPrismaExperiment())

  return prisma
}

/**
 * Helper to configure Prisma transaction mock
 * Makes it easier to test transaction logic
 */
export function mockPrismaTransaction<T>(result: T) {
  mockPrismaClient.$transaction.mockResolvedValue(result)
}

/**
 * Helper to simulate Prisma errors
 */
export class PrismaErrorMock extends Error {
  code: string
  meta?: any

  constructor(message: string, code: string = 'P2002', meta?: any) {
    super(message)
    this.name = 'PrismaClientKnownRequestError'
    this.code = code
    this.meta = meta
  }
}

/**
 * Common Prisma error codes for testing
 */
export const PRISMA_ERROR_CODES = {
  UNIQUE_CONSTRAINT: 'P2002',
  FOREIGN_KEY_CONSTRAINT: 'P2003',
  RECORD_NOT_FOUND: 'P2025',
  CONNECTION_ERROR: 'P1001',
  TIMEOUT: 'P1008',
}

/**
 * Helper to mock a Prisma unique constraint violation
 */
export function mockPrismaUniqueConstraintError(field: string) {
  return new PrismaErrorMock(
    `Unique constraint failed on the fields: (${field})`,
    PRISMA_ERROR_CODES.UNIQUE_CONSTRAINT,
    { target: [field] }
  )
}

/**
 * Helper to mock a Prisma record not found error
 */
export function mockPrismaNotFoundError(model: string) {
  return new PrismaErrorMock(
    `No ${model} found`,
    PRISMA_ERROR_CODES.RECORD_NOT_FOUND
  )
}
