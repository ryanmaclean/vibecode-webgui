# Prisma Mocking Guide for Tests

This guide explains the comprehensive Prisma mocking solution implemented for VibeCode WebGUI tests.

## Overview

The Prisma mocking infrastructure provides automatic mocks for all Prisma client operations, making it easy to write unit tests without needing a real database connection.

## Files Created

### 1. Core Mock: `tests/__mocks__/@prisma/client.ts`

The main Prisma client mock that Jest automatically uses when you mock `@prisma/client`.

**Features:**
- Complete mock of all Prisma models from schema
- All CRUD operations mocked (findUnique, findMany, create, update, delete, etc.)
- Transaction support ($transaction, $executeRaw, $queryRaw)
- Singleton pattern - same instance across all tests
- Easy to configure per test

**Models Mocked:**
- User, Session, Workspace, Project
- File, RAGChunk, RAGIngestJob, Upload
- AIRequest, Event, SystemMetric, Setting
- Experiment, ExperimentAssignment, ExperimentMetric

### 2. Singleton Mock: `tests/__mocks__/@/lib/prisma.ts`

Mocks the `@/lib/prisma` module that provides a singleton Prisma instance.

**Features:**
- Mocks the `prisma` export
- Mocks helper functions (getUserByEmail, createWorkspace, logAIRequest)
- Uses the same underlying mock as @prisma/client

### 3. Test Utilities: `tests/prisma-test-utils.ts`

Factory functions and helpers for creating mock Prisma objects.

**Factory Functions:**
- `mockPrismaUser()` - Create user objects
- `mockPrismaWorkspace()` - Create workspace objects
- `mockPrismaProject()` - Create project objects
- `mockPrismaFile()` - Create file objects
- `mockPrismaRAGChunk()` - Create RAG chunk objects
- `mockPrismaExperiment()` - Create experiment objects
- `mockPrismaExperimentAssignment()` - Create assignment objects
- `mockPrismaExperimentMetric()` - Create metric objects
- `mockPrismaAIRequest()` - Create AI request objects
- `mockPrismaSession()` - Create session objects
- `mockPrismaUpload()` - Create upload objects
- `mockPrismaRAGIngestJob()` - Create ingest job objects

**Helper Functions:**
- `createMockPrismaClient()` - Get a fresh mock client
- `setupStandardPrismaMocks()` - Configure common default responses
- `mockPrismaTransaction(result)` - Mock transaction results
- `PrismaErrorMock` - Create Prisma error objects
- `mockPrismaUniqueConstraintError(field)` - Mock unique constraint violations
- `mockPrismaNotFoundError(model)` - Mock record not found errors

## Usage Examples

### Basic Usage

```typescript
// In your test file
jest.mock('@prisma/client')
import { PrismaClient } from '@prisma/client'
import { prismaMock } from '../__mocks__/@prisma/client'

describe('My Service', () => {
  it('should find a user', async () => {
    // Configure the mock
    prismaMock.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      name: 'Test User'
    })

    const prisma = new PrismaClient()
    const user = await prisma.user.findUnique({ where: { id: 1 } })

    expect(user).toHaveProperty('email', 'test@example.com')
  })
})
```

### Using Test Utilities

```typescript
import { mockPrismaUser, mockPrismaWorkspace } from '../test-utils'
import { prismaMock } from '../__mocks__/@prisma/client'

describe('User Service', () => {
  it('should get user with workspaces', async () => {
    // Use factory functions for realistic mock data
    const mockUser = mockPrismaUser({
      id: 1,
      name: 'John Doe',
      email: 'john@example.com'
    })

    prismaMock.user.findUnique.mockResolvedValue({
      ...mockUser,
      workspaces: [
        mockPrismaWorkspace({ id: 1, name: 'Workspace 1' }),
        mockPrismaWorkspace({ id: 2, name: 'Workspace 2' })
      ]
    })

    // Your test logic here
  })
})
```

### Mocking the Singleton Instance

```typescript
jest.mock('@/lib/prisma')
import { prisma } from '@/lib/prisma'

describe('API Route', () => {
  it('should use the singleton prisma instance', async () => {
    // The mock is already configured
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      email: 'test@example.com'
    })

    // Your API route test
  })
})
```

### Setting Up Standard Mocks

```typescript
import { setupStandardPrismaMocks } from '../test-utils'

describe('Integration Tests', () => {
  beforeEach(() => {
    // Sets up common default responses for all models
    setupStandardPrismaMocks()
  })

  it('should work with default mocks', async () => {
    // User, workspace, project queries return sensible defaults
  })
})
```

### Mocking Transactions

```typescript
import { mockPrismaTransaction } from '../test-utils'
import { prismaMock } from '../__mocks__/@prisma/client'

it('should handle transactions', async () => {
  const result = { success: true, count: 5 }
  mockPrismaTransaction(result)

  const txResult = await prismaMock.$transaction(async (tx) => {
    // Transaction logic
    return result
  })

  expect(txResult).toEqual(result)
})
```

### Mocking Errors

```typescript
import {
  mockPrismaUniqueConstraintError,
  mockPrismaNotFoundError
} from '../test-utils'

it('should handle unique constraint violation', async () => {
  prismaMock.user.create.mockRejectedValue(
    mockPrismaUniqueConstraintError('email')
  )

  await expect(
    prisma.user.create({ data: { email: 'test@example.com' } })
  ).rejects.toThrow('Unique constraint failed')
})

it('should handle record not found', async () => {
  prismaMock.user.findUnique.mockRejectedValue(
    mockPrismaNotFoundError('User')
  )

  await expect(
    prisma.user.findUnique({ where: { id: 999 } })
  ).rejects.toThrow('No User found')
})
```

## Test Files Updated

The following test files were updated to use the new Prisma mocking infrastructure:

1. `tests/api/ai-chat-stream.test.ts` - Simplified Prisma mock
2. `tests/api/ai-upload.test.ts` - Simplified Prisma mock
3. `tests/integration/api/ai-chat-stream-simple.test.ts` - Uses singleton mock
4. `tests/lib/experiments/warehouse.test.ts` - Uses prismaMock export
5. `tests/lib/experiments/queries.test.ts` - Uses prismaMock export
6. `tests/lib/cache/vector-cache-strategy.test.ts` - Simplified Prisma mock

## Best Practices

### Do's ✅

- **Use the comprehensive mock**: Just `jest.mock('@prisma/client')` - no need to define your own mock structure
- **Use factory functions**: Leverage `mockPrismaUser()` etc. for realistic test data
- **Configure per test**: Set specific mock responses in each test's setup
- **Use prismaMock export**: Import `prismaMock` for direct access to the mock instance
- **Reset between tests**: Use `jest.clearAllMocks()` in `beforeEach`

### Don'ts ❌

- **Don't create inline mocks**: Use the provided comprehensive mock instead
- **Don't skip jest.clearAllMocks()**: Always clear mocks between tests
- **Don't use real database in unit tests**: Save integration tests for E2E tests
- **Don't mock partial models**: The comprehensive mock handles all models
- **Don't forget to configure**: Default mocks return empty arrays/undefined - configure them!

## Common Patterns

### Pattern 1: Simple Query Mock

```typescript
prismaMock.user.findMany.mockResolvedValue([
  mockPrismaUser({ id: 1 }),
  mockPrismaUser({ id: 2 })
])
```

### Pattern 2: Query with Relations

```typescript
prismaMock.workspace.findUnique.mockResolvedValue({
  ...mockPrismaWorkspace(),
  user: mockPrismaUser(),
  projects: [
    mockPrismaProject({ id: 1 }),
    mockPrismaProject({ id: 2 })
  ]
})
```

### Pattern 3: Create Operation

```typescript
prismaMock.user.create.mockImplementation((args) => {
  return Promise.resolve({
    id: 1,
    ...args.data,
    created_at: new Date(),
    updated_at: new Date()
  })
})
```

### Pattern 4: Chained Queries

```typescript
beforeEach(() => {
  prismaMock.user.findUnique.mockResolvedValue(mockPrismaUser())
  prismaMock.workspace.findMany.mockResolvedValue([
    mockPrismaWorkspace()
  ])
})
```

## Troubleshooting

### Issue: "Cannot read properties of undefined"

**Solution**: Make sure you're importing and using `prismaMock`:

```typescript
import { prismaMock } from '../__mocks__/@prisma/client'

// Then use prismaMock instead of creating new PrismaClient
prismaMock.user.findUnique.mockResolvedValue(...)
```

### Issue: "Mock not being called"

**Solution**: Ensure the mock is configured before the code under test runs:

```typescript
beforeEach(() => {
  prismaMock.user.findUnique.mockResolvedValue(mockPrismaUser())
})

it('test', async () => {
  // Your test - mock is already configured
})
```

### Issue: "Tests interfering with each other"

**Solution**: Clear mocks between tests:

```typescript
beforeEach(() => {
  jest.clearAllMocks()
  // Then configure fresh mocks
})
```

## Integration Tests vs Unit Tests

### Unit Tests (Use Mocks)
- Test individual functions/methods
- Fast execution
- No external dependencies
- Use the Prisma mocks

### Integration Tests (Use Real DB)
- Test full workflows
- Verify database operations
- Test data integrity
- Use a test database instance

Mark integration tests to skip in CI if needed:

```typescript
describe.skip('Database Integration Tests', () => {
  // Only runs when DATABASE_URL is set
})
```

## Summary

The Prisma mocking infrastructure provides:
- ✅ Comprehensive mocks for all Prisma models
- ✅ Easy-to-use factory functions for test data
- ✅ Singleton pattern for consistent mocking
- ✅ Type-safe mock configuration
- ✅ Error mocking utilities
- ✅ Transaction support
- ✅ Integration with existing test utilities

This eliminates the need for database connections in unit tests and makes tests faster, more reliable, and easier to maintain.
