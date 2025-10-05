# Integration Testing Guide

Guide for writing integration tests that verify interactions between components, services, and APIs.

## Overview

Integration tests verify that different parts of your application work together correctly. They test real interactions while still allowing for controlled test environments through selective mocking.

## When to Write Integration Tests

Use integration tests for:

- API route handlers
- Service layer interactions
- Database operations (with test databases)
- Authentication and authorization flows
- External service integrations (with mocking)
- Multi-component workflows
- Data transformation pipelines

## Integration vs Unit Tests

| Aspect | Unit Tests | Integration Tests |
|--------|-----------|-------------------|
| Scope | Single function/component | Multiple components/services |
| Dependencies | Heavily mocked | Selectively mocked |
| Speed | Very fast (ms) | Medium (seconds) |
| Complexity | Simple, focused | More complex scenarios |
| Failure diagnosis | Easy, pinpointed | Requires investigation |

## API Route Testing

### Basic API Route Test

```typescript
import { jest } from '@jest/globals'
import type { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/data/route'

describe('API /api/data', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    it('returns data for authenticated user', async () => {
      const request = new Request('http://localhost:3000/api/data', {
        headers: new Headers()
      }) as NextRequest

      const response = await GET(request)

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('results')
      expect(Array.isArray(data.results)).toBe(true)
    })

    it('returns 401 for unauthenticated requests', async () => {
      const request = new Request('http://localhost:3000/api/data', {
        headers: new Headers()
      }) as NextRequest

      const response = await GET(request)

      expect(response.status).toBe(401)

      const data = await response.json()
      expect(data).toEqual({ error: 'Unauthorized' })
    })
  })
})
```

### Testing with Authentication

```typescript
import { getServerSession } from 'next-auth'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>

describe('API /api/monitoring/metrics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('allows admin users to access metrics', async () => {
    mockedGetServerSession.mockResolvedValue({
      user: { id: 'admin123', role: 'admin' }
    })

    const request = new Request('http://localhost:3000/api/monitoring/metrics', {
      headers: new Headers()
    }) as NextRequest

    const response = await GET(request)

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('cpu')
    expect(data).toHaveProperty('memory')
  })

  it('denies access to regular users', async () => {
    mockedGetServerSession.mockResolvedValue({
      user: { id: 'user123', role: 'user' }
    })

    const request = new Request('http://localhost:3000/api/monitoring/metrics', {
      headers: new Headers()
    }) as NextRequest

    const response = await GET(request)

    expect(response.status).toBe(401)
  })
})
```

### Testing POST Requests

```typescript
describe('POST /api/monitoring/metrics', () => {
  it('accepts valid metric data', async () => {
    mockedGetServerSession.mockResolvedValue({
      user: { id: 'user123', role: 'user' }
    })

    const requestBody = {
      type: 'response_time',
      data: { duration: 250 }
    }

    const request = new Request('http://localhost:3000/api/monitoring/metrics', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: new Headers({ 'Content-Type': 'application/json' })
    }) as NextRequest

    const response = await POST(request)

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data).toEqual({ success: true })
  })

  it('rejects invalid metric types', async () => {
    mockedGetServerSession.mockResolvedValue({
      user: { id: 'user123', role: 'user' }
    })

    const requestBody = {
      type: 'unknown_metric',
      data: {}
    }

    const request = new Request('http://localhost:3000/api/monitoring/metrics', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: new Headers({ 'Content-Type': 'application/json' })
    }) as NextRequest

    const response = await POST(request)

    expect(response.status).toBe(400)

    const data = await response.json()
    expect(data).toEqual({ error: 'Unknown metric type' })
  })
})
```

## Testing Service Integrations

### Mocking External Services

```typescript
import { OpenAI } from 'openai'

jest.mock('openai')

describe('AI Service', () => {
  let mockOpenAI: jest.Mocked<OpenAI>

  beforeEach(() => {
    mockOpenAI = new OpenAI() as jest.Mocked<OpenAI>

    mockOpenAI.chat.completions.create = jest.fn().mockResolvedValue({
      choices: [{
        message: {
          content: 'AI response',
          role: 'assistant'
        }
      }]
    })
  })

  it('generates AI response', async () => {
    const result = await generateAIResponse('test prompt')

    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'test prompt' }]
    })

    expect(result).toBe('AI response')
  })

  it('handles API errors gracefully', async () => {
    mockOpenAI.chat.completions.create = jest.fn().mockRejectedValue(
      new Error('API rate limit exceeded')
    )

    await expect(generateAIResponse('test prompt'))
      .rejects
      .toThrow('API rate limit exceeded')
  })
})
```

### Database Integration Tests

```typescript
import { PrismaClient } from '@prisma/client'

describe('User Repository', () => {
  let prisma: PrismaClient

  beforeAll(async () => {
    prisma = new PrismaClient()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: { contains: 'test@example.com' } }
    })
  })

  it('creates new user', async () => {
    const userData = {
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashedPassword'
    }

    const user = await createUser(userData)

    expect(user).toHaveProperty('id')
    expect(user.email).toBe(userData.email)
    expect(user.name).toBe(userData.name)
  })

  it('throws error for duplicate email', async () => {
    const userData = {
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashedPassword'
    }

    await createUser(userData)

    await expect(createUser(userData))
      .rejects
      .toThrow('Email already exists')
  })
})
```

## Testing WebSocket Connections

```typescript
import { io, Socket } from 'socket.io-client'

describe('WebSocket Integration', () => {
  let clientSocket: Socket

  beforeAll((done) => {
    clientSocket = io('http://localhost:3000', {
      transports: ['websocket']
    })

    clientSocket.on('connect', done)
  })

  afterAll(() => {
    clientSocket.close()
  })

  it('receives workspace updates', (done) => {
    const testData = { workspaceId: 'test-123', action: 'update' }

    clientSocket.emit('workspace:subscribe', testData)

    clientSocket.on('workspace:updated', (data) => {
      expect(data).toHaveProperty('workspaceId', 'test-123')
      done()
    })

    // Trigger update
    clientSocket.emit('workspace:update', testData)
  })

  it('handles disconnection gracefully', (done) => {
    clientSocket.on('disconnect', () => {
      expect(clientSocket.connected).toBe(false)
      done()
    })

    clientSocket.disconnect()
  })
})
```

## Testing Queue Systems

```typescript
describe('Task Queue', () => {
  let queue: TaskQueue

  beforeEach(async () => {
    queue = new TaskQueue()
    await queue.connect()
  })

  afterEach(async () => {
    await queue.clear()
    await queue.disconnect()
  })

  it('processes tasks in order', async () => {
    const results: number[] = []

    const handler = async (task: Task) => {
      results.push(task.id)
    }

    queue.process(handler)

    await queue.add({ id: 1 })
    await queue.add({ id: 2 })
    await queue.add({ id: 3 })

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 1000))

    expect(results).toEqual([1, 2, 3])
  })

  it('retries failed tasks', async () => {
    let attempts = 0

    const handler = async (task: Task) => {
      attempts++
      if (attempts < 3) {
        throw new Error('Task failed')
      }
      return 'success'
    }

    queue.process(handler)

    await queue.add({ id: 1 }, { attempts: 3 })

    // Wait for retries
    await new Promise(resolve => setTimeout(resolve, 2000))

    expect(attempts).toBe(3)
  })
})
```

## Error Handling Tests

### Testing Error Responses

```typescript
describe('Error Handling', () => {
  it('returns 500 for server errors', async () => {
    // Mock console.error to avoid noise
    const consoleSpy = jest.spyOn(console, 'error')
      .mockImplementation(() => undefined)

    // Force an error
    jest.spyOn(database, 'query').mockRejectedValue(new Error('DB error'))

    const request = new Request('http://localhost:3000/api/data') as NextRequest
    const response = await GET(request)

    expect(response.status).toBe(500)

    const data = await response.json()
    expect(data).toEqual({ error: 'Internal server error' })

    consoleSpy.mockRestore()
  })

  it('handles validation errors', async () => {
    const invalidData = {
      email: 'not-an-email',
      password: '123' // too short
    }

    const request = new Request('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(invalidData),
      headers: new Headers({ 'Content-Type': 'application/json' })
    }) as NextRequest

    const response = await POST(request)

    expect(response.status).toBe(400)

    const data = await response.json()
    expect(data.errors).toContainEqual(
      expect.objectContaining({ field: 'email' })
    )
    expect(data.errors).toContainEqual(
      expect.objectContaining({ field: 'password' })
    )
  })
})
```

## Testing Rate Limiting

```typescript
describe('Rate Limiting', () => {
  beforeEach(async () => {
    // Clear rate limit cache
    await redis.flushdb()
  })

  it('allows requests within rate limit', async () => {
    const requests = Array(5).fill(null).map(() =>
      fetch('http://localhost:3000/api/data')
    )

    const responses = await Promise.all(requests)

    responses.forEach(response => {
      expect(response.status).toBe(200)
    })
  })

  it('blocks requests exceeding rate limit', async () => {
    // Make max allowed requests
    await Promise.all(
      Array(10).fill(null).map(() =>
        fetch('http://localhost:3000/api/data')
      )
    )

    // Next request should be rate limited
    const response = await fetch('http://localhost:3000/api/data')

    expect(response.status).toBe(429)

    const data = await response.json()
    expect(data).toEqual({
      error: 'Too many requests',
      retryAfter: expect.any(Number)
    })
  })
})
```

## Testing with Fixtures

### Using Test Fixtures

```typescript
import { readFileSync } from 'fs'
import { join } from 'path'

describe('File Processing', () => {
  it('processes uploaded file correctly', async () => {
    const fixturePath = join(__dirname, '../fixtures/sample.json')
    const fileContent = readFileSync(fixturePath, 'utf-8')
    const fileData = JSON.parse(fileContent)

    const result = await processUpload(fileData)

    expect(result.status).toBe('success')
    expect(result.recordsProcessed).toBe(fileData.records.length)
  })
})
```

### Creating Test Data Factories

```typescript
// tests/factories/user.factory.ts
export const createTestUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  createdAt: new Date().toISOString(),
  ...overrides
})

// Usage in tests
describe('User Service', () => {
  it('updates user profile', async () => {
    const user = createTestUser({ name: 'Original Name' })

    const updated = await updateUserProfile(user.id, { name: 'New Name' })

    expect(updated.name).toBe('New Name')
  })
})
```

## Running Integration Tests

### Commands

```bash
# Run all integration tests
npm run test:integration

# Run specific integration test
npm run test -- tests/integration/monitoring-api.test.ts

# Run with coverage
npm run test:integration -- --coverage

# Run in watch mode
npm run test:watch -- --testPathPattern=integration
```

### Test Configuration

Integration tests may need environment variables:

```bash
# .env.test
DATABASE_URL="postgresql://user:pass@localhost:5432/test_db"
REDIS_URL="redis://localhost:6379/1"
TEST_MODE="true"
```

## Best Practices

### Do's

1. **Test real interactions** - Use real code paths when possible
2. **Selectively mock** - Only mock external services and databases
3. **Clean up test data** - Use beforeEach/afterEach for cleanup
4. **Test error paths** - Verify error handling works correctly
5. **Use transactions** - Wrap tests in DB transactions for isolation
6. **Test boundaries** - Focus on integration points between modules

### Don'ts

1. **Don't test implementation details** - Focus on public APIs
2. **Don't make real external API calls** - Use mocks or test services
3. **Don't share state** - Each test should be independent
4. **Don't ignore timeouts** - Set appropriate timeout values
5. **Don't skip cleanup** - Always clean up resources
6. **Don't test everything** - Focus on critical integration points

## Common Patterns

### Testing Middleware

```typescript
describe('Authentication Middleware', () => {
  it('passes authenticated requests', async () => {
    const mockNext = jest.fn()
    const mockRequest = {
      headers: {
        authorization: 'Bearer valid-token'
      }
    }

    await authMiddleware(mockRequest, {}, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRequest).toHaveProperty('user')
  })

  it('blocks unauthenticated requests', async () => {
    const mockNext = jest.fn()
    const mockRequest = { headers: {} }
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    }

    await authMiddleware(mockRequest, mockResponse, mockNext)

    expect(mockNext).not.toHaveBeenCalled()
    expect(mockResponse.status).toHaveBeenCalledWith(401)
  })
})
```

### Testing Data Pipelines

```typescript
describe('Data Processing Pipeline', () => {
  it('transforms data through all stages', async () => {
    const rawData = { value: '100', unit: 'USD' }

    // Stage 1: Validation
    const validated = await validateData(rawData)
    expect(validated.isValid).toBe(true)

    // Stage 2: Transformation
    const transformed = await transformData(validated.data)
    expect(transformed.value).toBe(100)
    expect(transformed.currency).toBe('USD')

    // Stage 3: Storage
    const stored = await storeData(transformed)
    expect(stored.id).toBeDefined()
  })
})
```

## Troubleshooting

### Common Issues

**Tests hang or timeout**
```typescript
// Increase timeout for slow operations
it('slow integration test', async () => {
  // test code
}, 30000) // 30 seconds
```

**Database connection errors**
```bash
# Ensure test database is running
docker-compose up -d postgres-test

# Check connection string
echo $DATABASE_URL
```

**Flaky tests due to timing**
```typescript
// Use explicit waits instead of arbitrary timeouts
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument()
}, { timeout: 5000 })
```

## Example Test Files

Reference these integration tests in the codebase:

- `tests/integration/monitoring-api.test.ts` - API route testing
- `tests/integration/websocket.test.ts` - WebSocket integration
- `tests/integration/user-provisioning-integration.test.ts` - Service integration

## Next Steps

- [E2E Testing Guide](./E2E_TESTING.md)
- [Test Patterns](./TEST_PATTERNS.md)
- [CI Testing](./CI_TESTING.md)
