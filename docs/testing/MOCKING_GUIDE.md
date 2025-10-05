# Mocking Guide

Comprehensive guide to mocking in the VibeCode testing suite. This document covers all major mocking scenarios, patterns, tools, and best practices used throughout the project.

## Table of Contents

- [Introduction](#introduction)
- [Mocking Tools](#mocking-tools)
- [Jest Mock Fundamentals](#jest-mock-fundamentals)
- [Database Mocking](#database-mocking)
- [API Mocking](#api-mocking)
- [External Service Mocking](#external-service-mocking)
- [Authentication Mocking](#authentication-mocking)
- [Environment Variable Mocking](#environment-variable-mocking)
- [Browser API Mocking](#browser-api-mocking)
- [Best Practices](#best-practices)
- [Anti-Patterns](#anti-patterns)
- [Troubleshooting](#troubleshooting)

## Introduction

### Why Mocking Matters

Mocking is essential for:

1. **Isolation** - Test individual units without external dependencies
2. **Speed** - Avoid slow network calls and database operations
3. **Reliability** - Eliminate flakiness from external services
4. **Control** - Simulate edge cases and error conditions
5. **Security** - Test without real credentials or sensitive data

### When to Mock

**DO Mock:**
- External API calls (OpenRouter, AI providers)
- Database queries (Prisma, SQL)
- File system operations
- Network requests
- Authentication services
- Time-dependent operations
- Browser APIs (localStorage, fetch)

**DON'T Mock:**
- Pure functions (no side effects)
- Simple utilities and helpers
- The code under test itself
- Everything (keep some integration tests)

## Mocking Tools

### Jest Built-in Mocking

Jest provides comprehensive mocking capabilities:

```typescript
// Function mocking
jest.fn()
jest.fn(implementation)
jest.spyOn(object, 'method')

// Module mocking
jest.mock('./module')
jest.requireActual('./module')
jest.requireMock('./module')

// Timer mocking
jest.useFakeTimers()
jest.useRealTimers()
jest.advanceTimersByTime(1000)

// System mocking
jest.setSystemTime(new Date('2024-01-01'))
```

### Testing Library

For React component testing:

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Simulate user interactions
await userEvent.click(screen.getByRole('button'))
await userEvent.type(screen.getByRole('textbox'), 'test input')
```

### Global Test Setup

See `tests/jest.setup.js` for global mocks:

```javascript
// Global fetch mock
global.fetch = jest.fn(defaultImpl)

// Global browser APIs
window.speechSynthesis = { speak: jest.fn(), cancel: jest.fn() }
window.ResizeObserver = jest.fn().mockImplementation(...)
```

## Jest Mock Fundamentals

### Basic Function Mocking

```typescript
// Create a simple mock function
const mockFn = jest.fn()

// Mock with implementation
const mockFn = jest.fn((x) => x * 2)

// Mock with return value
const mockFn = jest.fn().mockReturnValue(42)

// Mock with resolved promise
const mockFn = jest.fn().mockResolvedValue({ data: 'success' })

// Mock with rejected promise
const mockFn = jest.fn().mockRejectedValue(new Error('Failed'))
```

### Spy on Existing Functions

```typescript
// Spy on object method
const spy = jest.spyOn(object, 'method')

// Spy with custom implementation
jest.spyOn(object, 'method').mockImplementation(() => 'mocked')

// Spy and preserve original
jest.spyOn(object, 'method').mockImplementationOnce(() => 'first call')
```

### Module Mocking

```typescript
// Auto-mock entire module
jest.mock('@/lib/database')

// Mock with custom implementation
jest.mock('@/lib/database', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}))

// Partial mock (keep some real exports)
jest.mock('@/lib/utils', () => ({
  ...jest.requireActual('@/lib/utils'),
  specificFunction: jest.fn(),
}))
```

### Mock Assertions

```typescript
// Verify calls
expect(mockFn).toHaveBeenCalled()
expect(mockFn).toHaveBeenCalledTimes(3)
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2')
expect(mockFn).toHaveBeenLastCalledWith('last arg')

// Verify call order
expect(mockFn).toHaveBeenNthCalledWith(1, 'first call')
expect(mockFn).toHaveBeenNthCalledWith(2, 'second call')

// Verify return values
expect(mockFn).toHaveReturnedWith(42)
expect(mockFn).toHaveReturned()
```

## Database Mocking

### Prisma Client Mocking

Pattern used in: `tests/unit/middleware/quota-middleware.test.ts`

```typescript
// Mock Prisma client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    workspace: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $disconnect: jest.fn(),
  })),
}))

// In test file
import { PrismaClient } from '@prisma/client'
const mockPrisma = new PrismaClient()

beforeEach(() => {
  jest.clearAllMocks()
})

it('should query user data', async () => {
  const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' }

  mockPrisma.user.findUnique.mockResolvedValue(mockUser)

  const result = await getUserById('1')

  expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
    where: { id: '1' }
  })
  expect(result).toEqual(mockUser)
})
```

### Query Tracking Middleware

Pattern used in: `tests/unit/lib/db/db-metrics.test.ts`

```typescript
// Mock query tracking middleware
const createQueryTrackingMiddleware = () => {
  const middleware = jest.fn(async (params, next) => {
    const start = Date.now()
    try {
      const result = await next(params)
      const duration = Date.now() - start
      collector.recordQuery(
        `${params.model}.${params.action}`,
        duration,
        true
      )
      return result
    } catch (error) {
      const duration = Date.now() - start
      collector.recordQuery(
        `${params.model}.${params.action}`,
        duration,
        false,
        error
      )
      throw error
    }
  })
  return middleware
}

it('should track successful queries', async () => {
  const middleware = createQueryTrackingMiddleware()
  const mockNext = jest.fn().mockResolvedValue('result')

  const result = await middleware(
    { model: 'User', action: 'findMany' },
    mockNext
  )

  expect(result).toBe('result')
  expect(mockNext).toHaveBeenCalledWith({ model: 'User', action: 'findMany' })
})
```

### Database Error Simulation

Pattern used in: `tests/unit/vector-db-error-handler-enhanced.test.ts`

```typescript
// Helper to create database-specific error objects
const createDatabaseError = (provider: string, details: any) => {
  switch (provider) {
    case 'postgres':
      return {
        name: 'PostgresError',
        severity: 'ERROR',
        code: '42P01', // Relation not found
        message: details.message,
        position: '15',
      }
    case 'redis':
      return {
        name: 'ReplyError',
        command: 'GET',
        code: 'ERR',
        message: details.message,
      }
    default:
      return details
  }
}

it('should handle Postgres connection errors', () => {
  const pgError = createDatabaseError('postgres', {
    code: '08006', // Connection failure
    message: 'connection terminated unexpectedly'
  })

  expect(categorizeError(pgError, 'postgres')).toBe(
    VectorDBErrorType.CONNECTION_FAILED
  )
})
```

### Database Configuration Mocking

Pattern used in: `tests/unit/lib/vector-db/vector-database-factory.test.ts`

```typescript
beforeEach(() => {
  // Clear environment variables
  delete process.env.VECTOR_DB_PROVIDER
  delete process.env.VECTOR_DB_HOST
  delete process.env.VECTOR_DB_PORT
  delete process.env.DATABASE_URL
})

it('should create connection from environment variables', () => {
  process.env.VECTOR_DB_PROVIDER = 'postgres'
  process.env.VECTOR_DB_HOST = 'localhost'
  process.env.VECTOR_DB_PORT = '5432'
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db'

  const config = getDatabaseConfig()

  expect(config.provider).toBe('postgres')
  expect(config.host).toBe('localhost')
})
```

## API Mocking

### Global Fetch Mocking

Pattern used in: `tests/jest.setup.js`

```javascript
// Default fetch mock (applied globally in beforeEach)
beforeEach(() => {
  const defaultImpl = (url) => {
    // Handle different endpoints
    if (typeof url === 'string' && url.includes('/api/ai/litellm')) {
      return Promise.resolve({
        ok: false,
        status: 401,
        headers: new Headers(),
        json: async () => ({ error: 'Unauthorized' }),
      })
    }

    if (typeof url === 'string' && url.includes('/api/monitoring/health')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'healthy',
          timestamp: new Date().toISOString(),
        }),
      })
    }

    // Generic success
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({}),
    })
  }

  global.fetch = jest.fn(defaultImpl)
})
```

### AI API Mocking

Pattern used in: `tests/mocks/ai-generation-service.test.ts`

```typescript
it('should mock OpenRouter API response', async () => {
  const mockResponse = {
    choices: [{
      message: {
        content: JSON.stringify({
          name: 'test-project',
          description: 'A test project',
          files: [
            { path: 'package.json', content: '{"name": "test"}' },
            { path: 'src/index.js', content: 'console.log("Hello");' },
          ],
        })
      }
    }]
  }

  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => mockResponse,
  })

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-key',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{ role: 'user', content: 'Create a Node.js app' }],
    }),
  })

  const data = await response.json()
  expect(data.choices[0].message.content).toBeDefined()
})
```

### API Error Scenarios

Pattern used in: `tests/mocks/ai-generation-service.test.ts`

```typescript
it('should mock API rate limiting', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 429,
    statusText: 'Too Many Requests',
    headers: {
      get: (name: string) => {
        if (name === 'retry-after') return '60'
        return null
      }
    }
  })

  const response = await fetch('/api/test')

  expect(response.ok).toBe(false)
  expect(response.status).toBe(429)
  expect(response.headers.get('retry-after')).toBe('60')
})

it('should mock network timeout', async () => {
  global.fetch = jest.fn().mockImplementation(() =>
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Network timeout')), 100)
    )
  )

  await expect(fetch('/api/test')).rejects.toThrow('Network timeout')
})

it('should mock JSON parse errors', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => { throw new Error('Invalid JSON') }
  })

  await expect(
    fetch('/api/test').then(r => r.json())
  ).rejects.toThrow('Invalid JSON')
})
```

### Model-Specific Responses

Pattern used in: `tests/mocks/ai-generation-service.test.ts`

```typescript
it('should mock different AI model responses', async () => {
  const modelResponses = {
    'anthropic/claude-3.5-sonnet': {
      choices: [{
        message: {
          content: JSON.stringify({ name: 'claude-project' })
        }
      }]
    },
    'openai/gpt-4-turbo': {
      choices: [{
        message: {
          content: JSON.stringify({ name: 'gpt-project' })
        }
      }]
    }
  }

  global.fetch = jest.fn().mockImplementation(async (url, options) => {
    const body = JSON.parse(options?.body as string)
    const model = body.model

    return {
      ok: true,
      json: async () => modelResponses[model] || modelResponses['anthropic/claude-3.5-sonnet']
    }
  })

  // Test Claude model
  const claudeResponse = await fetch('/api/ai', {
    method: 'POST',
    body: JSON.stringify({ model: 'anthropic/claude-3.5-sonnet' })
  })
  const claudeData = await claudeResponse.json()
  expect(JSON.parse(claudeData.choices[0].message.content).name).toBe('claude-project')
})
```

### Performance Testing Mocks

Pattern used in: `tests/mocks/ai-generation-service.test.ts`

```typescript
it('should mock slow API responses', async () => {
  const delays = [100, 500, 1000, 2000]

  for (const delay of delays) {
    global.fetch = jest.fn().mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({ success: true, delay })
      }), delay))
    )

    const start = Date.now()
    const response = await fetch('/api/test')
    const actualDelay = Date.now() - start

    expect(actualDelay).toBeGreaterThanOrEqual(delay - 10)
    const data = await response.json()
    expect(data.delay).toBe(delay)
  }
})
```

## External Service Mocking

### Redis Mocking

Pattern used in: `tests/unit/vector-db-error-handler-enhanced.test.ts`

```typescript
// Mock Redis client
jest.mock('redis', () => ({
  createClient: jest.fn().mockReturnValue({
    connect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
  }),
}))

import { createClient } from 'redis'

it('should mock Redis operations', async () => {
  const mockRedis = createClient()

  mockRedis.get.mockResolvedValue('cached-value')
  mockRedis.set.mockResolvedValue('OK')

  await mockRedis.connect()
  const value = await mockRedis.get('key')

  expect(value).toBe('cached-value')
  expect(mockRedis.get).toHaveBeenCalledWith('key')
})

it('should mock Redis connection errors', async () => {
  const mockRedis = createClient()

  mockRedis.connect.mockRejectedValue(
    new Error('Connection refused')
  )

  await expect(mockRedis.connect()).rejects.toThrow('Connection refused')
})
```

### Kubernetes API Mocking

Pattern used in: `tests/mocks/ai-generation-service.test.ts`

```typescript
const mockKubernetesAPI = {
  pods: {
    list: jest.fn(),
    exec: jest.fn(),
  },
  deployments: {
    create: jest.fn(),
    get: jest.fn(),
  },
}

it('should mock pod creation', async () => {
  const mockPod = {
    metadata: {
      name: 'code-server-test-123',
      namespace: 'default',
    },
    status: {
      phase: 'Running',
      podIP: '10.244.0.5'
    }
  }

  mockKubernetesAPI.pods.list.mockResolvedValue({
    items: [mockPod]
  })

  const pods = await mockKubernetesAPI.pods.list('default')

  expect(pods.items).toHaveLength(1)
  expect(pods.items[0].status.phase).toBe('Running')
})

it('should mock kubectl exec', async () => {
  mockKubernetesAPI.pods.exec.mockResolvedValue({
    stdout: 'npm install completed\n',
    stderr: '',
    exitCode: 0
  })

  const result = await mockKubernetesAPI.pods.exec(
    'default/pod-123',
    'npm install'
  )

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('npm install completed')
})
```

### WebSocket Mocking

Pattern used in: `tests/mocks/ai-generation-service.test.ts`

```typescript
it('should mock WebSocket connection', (done) => {
  const mockWebSocket = {
    readyState: 1, // WebSocket.OPEN
    send: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }

  const progressUpdates = [
    { status: 'initializing', progress: 10 },
    { status: 'generating', progress: 50 },
    { status: 'completed', progress: 100 }
  ]

  const messageHandler = jest.fn()
  mockWebSocket.addEventListener('message', messageHandler)

  // Simulate receiving messages
  progressUpdates.forEach((update, index) => {
    setTimeout(() => {
      messageHandler({
        type: 'message',
        data: JSON.stringify(update)
      })

      if (index === progressUpdates.length - 1) {
        expect(messageHandler).toHaveBeenCalledTimes(3)
        done()
      }
    }, index * 10)
  })
})
```

### File System Mocking

Pattern used in: `tests/mocks/ai-generation-service.test.ts`

```typescript
it('should mock file system operations', async () => {
  const mockFiles = new Map([
    ['/tmp/workspaces/test/package.json', '{"name": "test"}'],
    ['/tmp/workspaces/test/src/index.js', 'console.log("Hello");'],
  ])

  const mockFileSystem = {
    writeFile: jest.fn((path: string, content: string) => {
      mockFiles.set(path, content)
      return Promise.resolve()
    }),
    readFile: jest.fn((path: string) => {
      const content = mockFiles.get(path)
      if (!content) throw new Error('File not found')
      return Promise.resolve(content)
    }),
    mkdir: jest.fn(() => Promise.resolve()),
    exists: jest.fn((path: string) =>
      Promise.resolve(mockFiles.has(path))
    )
  }

  // Simulate file operations
  await mockFileSystem.mkdir('/tmp/workspaces/test/src')
  await mockFileSystem.writeFile(
    '/tmp/workspaces/test/package.json',
    '{"name": "test"}'
  )

  expect(mockFileSystem.writeFile).toHaveBeenCalled()
  expect(await mockFileSystem.exists('/tmp/workspaces/test/package.json')).toBe(true)
  expect(await mockFileSystem.readFile('/tmp/workspaces/test/package.json')).toBe('{"name": "test"}')
})
```

## Authentication Mocking

### NextAuth Session Mocking

Pattern used in: `tests/unit/middleware/quota-middleware.test.ts`

```typescript
// Mock NextAuth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {}
}))

import { getServerSession } from 'next-auth'

const mockedGetServerSession = jest.mocked(getServerSession)

// Type-safe session builder
type SessionUser = { id?: string; email?: string; name?: string; role?: string }
const buildSession = (user: SessionUser | null) => ({ user } as any)

it('should return authentication required when no session', async () => {
  mockedGetServerSession.mockResolvedValue(null)

  const result = await withQuotaCheck(mockRequest, 'create_workspace')

  expect(result).toEqual({
    allowed: false,
    reason: 'Authentication required'
  })
})

it('should allow action with valid session', async () => {
  mockedGetServerSession.mockResolvedValue(
    buildSession({ id: '123', email: 'test@example.com', role: 'user' })
  )

  const result = await withQuotaCheck(mockRequest, 'create_workspace')

  expect(result.allowed).toBe(true)
})
```

### Credentials Provider Testing

Pattern used in: `tests/unit/auth/credentials-provider.test.ts`

```typescript
// Mock password verification
jest.mock('@/lib/auth/password', () => {
  const actual = jest.requireActual<typeof import('@/lib/auth/password')>(
    '@/lib/auth/password'
  )
  return {
    ...actual,
    verifyPassword: jest.fn((...args) => actual.verifyPassword(...args)),
  }
})

import { authOptions } from '@/lib/auth'
import { verifyPassword } from '@/lib/auth/password'

const credentialsProvider = authOptions.providers.find(
  (provider: any) => provider.id === 'credentials'
)

beforeEach(() => {
  (verifyPassword as jest.Mock).mockClear()
})

it('returns user for valid credentials', async () => {
  const user = await credentialsProvider.authorize({
    email: 'admin@vibecode.dev',
    password: 'admin123',
  })

  expect(user).toEqual({
    id: 'legacy-admin',
    name: 'Admin User',
    email: 'admin@vibecode.dev',
    role: 'admin',
  })
})

it('returns null for invalid password', async () => {
  const user = await credentialsProvider.authorize({
    email: 'admin@vibecode.dev',
    password: 'wrong-password',
  })

  expect(user).toBeNull()
})

it('performs timing-safe compare', async () => {
  const user = await credentialsProvider.authorize({
    email: 'ghost@vibecode.dev',
    password: 'ghostpass123',
  })

  expect(user).toBeNull()
  expect(verifyPassword).toHaveBeenCalledWith(
    'ghostpass123',
    '$2b$12$eUlS0dNKrMxLdkPgDJZdpuHlNCn/KkheBmEzKE2.yOrembE1ccsV.'
  )
})
```

### Auth Configuration Testing

Pattern used in: `tests/unit/lib/auth.test.ts`

```typescript
describe('auth.ts Configuration', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env = {
      ...originalEnv,
      NEXTAUTH_SECRET: 'test-secret',
      GITHUB_ID: 'test-github-id',
      GITHUB_SECRET: 'test-github-secret',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should have JWT session strategy', () => {
    expect(authOptions.session?.strategy).toBe('jwt')
  })

  it('should have GitHub provider configured', () => {
    const githubProvider = authOptions.providers?.find(
      provider => provider.id === 'github'
    )
    expect(githubProvider).toBeDefined()
  })
})
```

### JWT and Session Callbacks

Pattern used in: `tests/unit/lib/auth.test.ts`

```typescript
it('should update token with user data on login', async () => {
  const jwtCallback = authOptions.callbacks?.jwt

  const mockToken = { id: '', role: '' }
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'user',
  }

  const result = await jwtCallback({
    token: mockToken,
    user: mockUser,
    account: { provider: 'github' },
  })

  expect(result).toEqual({
    id: 'user-123',
    role: 'user',
    email: 'test@example.com',
  })
})

it('should update session with token data', async () => {
  const sessionCallback = authOptions.callbacks?.session

  const mockSession = {
    user: { id: '', email: '', name: '', role: '' },
    expires: '2024-12-31T23:59:59.999Z',
  }
  const mockToken = {
    id: 'user-123',
    role: 'user',
    email: 'test@example.com',
  }

  const result = await sessionCallback({
    session: mockSession,
    token: mockToken,
    user: mockToken,
  })

  expect(result.user.id).toBe('user-123')
  expect(result.user.role).toBe('user')
})
```

## Environment Variable Mocking

### Basic Environment Mocking

Pattern used in: `tests/unit/lib/auth.test.ts`

```typescript
const originalEnv = process.env

beforeEach(() => {
  jest.resetModules()
  process.env = {
    ...originalEnv,
    CUSTOM_VAR: 'test-value',
    API_URL: 'https://api.test.com',
    NODE_ENV: 'test',
  }
})

afterEach(() => {
  process.env = originalEnv
})

it('should read environment variables', () => {
  expect(process.env.CUSTOM_VAR).toBe('test-value')
  expect(process.env.API_URL).toBe('https://api.test.com')
})
```

### Template Environment Overrides

Pattern used in: `tests/unit/template-generation.test.ts`

```typescript
it('should handle environment variable overrides', async () => {
  const template = PROJECT_TEMPLATES[0]
  const envOverrides = {
    'CUSTOM_VAR': 'custom_value',
    'API_URL': 'https://api.example.com'
  }

  const result = await generateFromTemplate({
    template: template.id,
    projectName: 'test-project',
    envOverrides
  })

  expect(result.envVars).toBeDefined()
  expect(Array.isArray(result.envVars)).toBe(true)
})
```

### Database Configuration

Pattern used in: `tests/unit/lib/vector-db/vector-database-factory.test.ts`

```typescript
beforeEach(() => {
  // Clear environment variables
  delete process.env.VECTOR_DB_PROVIDER
  delete process.env.VECTOR_DB_HOST
  delete process.env.VECTOR_DB_PORT
  delete process.env.DATABASE_URL
})

it('should use environment variables for config', () => {
  process.env.VECTOR_DB_PROVIDER = 'postgres'
  process.env.VECTOR_DB_HOST = 'localhost'
  process.env.VECTOR_DB_PORT = '5432'
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db'

  const config = getDatabaseConfig()

  expect(config.provider).toBe('postgres')
  expect(config.host).toBe('localhost')
})
```

### Secret Redaction

Pattern used in: `tests/jest.setup.js`

```javascript
// Redact sensitive environment variables from logs
const SECRET_ENV_KEYS = [
  'DD_API_KEY',
  'DATADOG_API_KEY',
  'NEXTAUTH_SECRET',
  'GITHUB_SECRET',
]

const secretValues = SECRET_ENV_KEYS
  .map(k => process.env[k])
  .filter(v => v && String(v).length > 8)
  .map(v => String(v))

function redact(value) {
  if (typeof value !== 'string') return value
  let out = value
  for (const s of secretValues) {
    out = out.split(s).join('***REDACTED***')
  }
  return out
}

console.log = (...args) => {
  originalConsoleLog(...args.map(a =>
    typeof a === 'string' ? redact(a) : a
  ))
}
```

## Browser API Mocking

### Speech Synthesis

Pattern used in: `tests/jest.setup.js`

```javascript
Object.defineProperty(window, 'speechSynthesis', {
  value: {
    speak: jest.fn(),
    cancel: jest.fn(),
    getVoices: jest.fn(() => [
      { lang: 'en-US', name: 'Google US English' },
      { lang: 'en-GB', name: 'Google UK English Female' },
    ]),
  },
  writable: true,
})
```

### Speech Recognition

```javascript
Object.defineProperty(window, 'SpeechRecognition', {
  value: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    onresult: jest.fn(),
    onerror: jest.fn(),
    onend: jest.fn(),
  })),
  writable: true,
})
```

### Media APIs

```javascript
// MediaDevices
Object.defineProperty(window.navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn(() => Promise.resolve({
      getTracks: () => [{ stop: jest.fn() }],
    })),
  },
  writable: true,
})

// MediaRecorder
Object.defineProperty(window, 'MediaRecorder', {
  value: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    ondataavailable: jest.fn(),
    onerror: jest.fn(),
    state: 'inactive',
    mimeType: 'audio/webm',
  })),
  writable: true,
})
```

### Storage APIs

```javascript
// localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
global.localStorage = localStorageMock

// sessionStorage
global.sessionStorage = localStorageMock
```

### Observer APIs

```javascript
// ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))
```

### DOM APIs

```javascript
// scrollIntoView
window.HTMLElement.prototype.scrollIntoView = jest.fn()

// URL.createObjectURL
URL.createObjectURL = jest.fn(() => 'mock-blob-url')
URL.revokeObjectURL = jest.fn()
```

## Best Practices

### 1. Mock at the Right Level

```typescript
// ✅ GOOD: Mock external dependencies
jest.mock('@/lib/external-api')

// ❌ BAD: Mock the code under test
jest.mock('./my-function') // Don't do this!
```

### 2. Clear Mocks Between Tests

```typescript
beforeEach(() => {
  jest.clearAllMocks() // Clear call history
  // OR
  jest.resetAllMocks() // Clear history and implementations
})
```

### 3. Use Type-Safe Mocks

```typescript
// ✅ GOOD: Type-safe mocking
import { getServerSession } from 'next-auth'
const mockedGetServerSession = jest.mocked(getServerSession)

mockedGetServerSession.mockResolvedValue({ user: { id: '123' } })

// ❌ BAD: Untyped mocking
(getServerSession as any).mockResolvedValue({ user: { id: '123' } })
```

### 4. Mock Only What You Need

```typescript
// ✅ GOOD: Partial mock
jest.mock('@/lib/utils', () => ({
  ...jest.requireActual('@/lib/utils'),
  specificFunction: jest.fn(), // Only mock what's needed
}))

// ❌ BAD: Mock everything
jest.mock('@/lib/utils') // Mocks all exports
```

### 5. Use Realistic Mock Data

```typescript
// ✅ GOOD: Realistic data structure
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: new Date('2024-01-01'),
  role: 'user'
}

// ❌ BAD: Minimal/unrealistic data
const mockUser = { id: '1' }
```

### 6. Test Error Scenarios

```typescript
it('should handle API errors', async () => {
  mockFetch.mockRejectedValue(new Error('Network error'))

  await expect(fetchData()).rejects.toThrow('Network error')
})

it('should handle 404 responses', async () => {
  mockFetch.mockResolvedValue({
    ok: false,
    status: 404,
    json: async () => ({ error: 'Not found' })
  })

  const result = await fetchData()
  expect(result.error).toBe('Not found')
})
```

### 7. Verify Mock Interactions

```typescript
it('should call API with correct parameters', async () => {
  await saveUser({ name: 'Test', email: 'test@example.com' })

  expect(mockFetch).toHaveBeenCalledWith('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test', email: 'test@example.com' })
  })
})
```

### 8. Use Helper Functions for Complex Mocks

```typescript
// ✅ GOOD: Reusable mock helper
function mockAuthenticatedSession(userId: string, role: string = 'user') {
  mockedGetServerSession.mockResolvedValue({
    user: { id: userId, role },
    expires: new Date(Date.now() + 3600000).toISOString()
  })
}

it('should work for admin users', async () => {
  mockAuthenticatedSession('admin-1', 'admin')
  const result = await performAdminAction()
  expect(result.success).toBe(true)
})
```

### 9. Mock Timers for Time-Dependent Tests

```typescript
it('should retry after delay', async () => {
  jest.useFakeTimers()

  const promise = retryWithBackoff(fetchData, 3)

  jest.advanceTimersByTime(1000)
  await promise

  expect(fetchData).toHaveBeenCalledTimes(2)

  jest.useRealTimers()
})
```

### 10. Document Complex Mocks

```typescript
/**
 * Mock OpenRouter API with Claude 3.5 Sonnet response
 * Simulates successful project generation with files
 */
function mockOpenRouterSuccess() {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{
        message: {
          content: JSON.stringify({
            files: [/* ... */],
            dependencies: {/* ... */}
          })
        }
      }]
    })
  })
}
```

## Anti-Patterns

### ❌ Don't Mock What You Don't Own

```typescript
// ❌ BAD: Mocking third-party library internals
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    pathname: '/',
    query: {},
    // Dozens of other properties you don't need...
  }),
}))

// ✅ GOOD: Create a thin wrapper and mock that
// lib/navigation.ts
export const useNavigation = () => {
  const router = useRouter()
  return {
    navigate: router.push,
    currentPath: router.pathname,
  }
}

// In tests:
jest.mock('@/lib/navigation')
```

### ❌ Don't Over-Mock

```typescript
// ❌ BAD: Mocking everything
jest.mock('./utils')
jest.mock('./helpers')
jest.mock('./constants')
jest.mock('./types')
jest.mock('./validators')

// ✅ GOOD: Only mock external dependencies
jest.mock('@/lib/external-api')
// Use real implementations for your own code
```

### ❌ Don't Use Magic Values

```typescript
// ❌ BAD: Unclear magic values
mockUser.id.mockReturnValue('123')
mockDate.now.mockReturnValue(1234567890)

// ✅ GOOD: Named constants
const TEST_USER_ID = 'test-user-123'
const MOCK_TIMESTAMP = new Date('2024-01-01').getTime()
mockUser.id.mockReturnValue(TEST_USER_ID)
mockDate.now.mockReturnValue(MOCK_TIMESTAMP)
```

### ❌ Don't Share State Between Tests

```typescript
// ❌ BAD: Shared mock state
const mockUser = { id: '1', name: 'Test' }

it('should update user name', () => {
  mockUser.name = 'Updated'
  expect(updateUser(mockUser)).toBe(true)
})

it('should create user', () => {
  // This test now has modified mockUser from previous test!
  expect(mockUser.name).toBe('Test') // FAILS
})

// ✅ GOOD: Fresh mock per test
beforeEach(() => {
  mockUser = { id: '1', name: 'Test' }
})
```

### ❌ Don't Mock Everything in Integration Tests

```typescript
// ❌ BAD: Mocking in integration test
describe('API Integration', () => {
  beforeEach(() => {
    jest.mock('@/lib/database')
    jest.mock('@/lib/auth')
    jest.mock('@/lib/validation')
  })

  // This isn't an integration test anymore!
})

// ✅ GOOD: Use real implementations
describe('API Integration', () => {
  // Use real database with test data
  // Use real auth with test users
  // Test actual integration
})
```

### ❌ Don't Forget to Restore

```typescript
// ❌ BAD: No cleanup
it('should work', () => {
  jest.spyOn(console, 'log').mockImplementation()
  // Test code...
  // console.log is now broken for other tests!
})

// ✅ GOOD: Restore after test
it('should work', () => {
  const spy = jest.spyOn(console, 'log').mockImplementation()
  // Test code...
  spy.mockRestore()
})
```

### ❌ Don't Mock Time Without Cleanup

```typescript
// ❌ BAD: Fake timers leak to other tests
it('should timeout', () => {
  jest.useFakeTimers()
  // Test code...
  // Timers still fake for next test!
})

// ✅ GOOD: Always restore
it('should timeout', () => {
  jest.useFakeTimers()
  try {
    // Test code...
  } finally {
    jest.useRealTimers()
  }
})
```

## Troubleshooting

### Mock Not Being Applied

**Problem:** Mock is defined but real implementation is still called

```typescript
// Check mock hoisting
// Mocks must be at the top of the file, before imports

// ✅ CORRECT ORDER:
jest.mock('@/lib/database')
import { query } from '@/lib/database'

// ❌ WRONG ORDER:
import { query } from '@/lib/database'
jest.mock('@/lib/database') // Too late!
```

**Solution:** Move `jest.mock()` calls to the top of the file before any imports.

### Module Not Found in Mock

**Problem:** `Cannot find module '@/lib/module' from 'tests/test.ts'`

```typescript
// Check TypeScript path aliases in jest.config.js
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
}
```

**Solution:** Ensure `moduleNameMapper` matches your `tsconfig.json` paths.

### Mock Implementation Not Working

**Problem:** Mock is called but doesn't return expected value

```typescript
// Check if mock is properly typed
const mockFn = jest.fn() // Returns undefined by default

// ✅ FIX: Provide implementation
const mockFn = jest.fn().mockReturnValue('expected value')
// OR
const mockFn = jest.fn(() => 'expected value')
```

**Solution:** Always provide return values or implementations for mocks.

### Async Mock Issues

**Problem:** Test passes but console shows unhandled promise rejection

```typescript
// ❌ WRONG: Missing await
it('should fetch data', () => {
  mockFetch.mockResolvedValue({ data: 'test' })
  fetchData() // Promise not awaited!
})

// ✅ CORRECT: Await promises
it('should fetch data', async () => {
  mockFetch.mockResolvedValue({ data: 'test' })
  await fetchData()
})
```

**Solution:** Always `await` async operations and mark test as `async`.

### Mock Not Resetting Between Tests

**Problem:** Mock retains state from previous test

```typescript
// Add to beforeEach
beforeEach(() => {
  jest.clearAllMocks()    // Clear call history
  jest.resetAllMocks()    // Clear history + implementation
  jest.restoreAllMocks()  // Restore original implementation
})
```

**Solution:** Use appropriate cleanup in `beforeEach`.

### Type Errors with Mocks

**Problem:** TypeScript complains about mock types

```typescript
// ❌ Type error: Property 'mockResolvedValue' doesn't exist
const mockFn = jest.fn()
mockFn.mockResolvedValue('value')

// ✅ FIX: Use jest.mocked()
import { myFunction } from './module'
jest.mock('./module')
const mockedFunction = jest.mocked(myFunction)
mockedFunction.mockResolvedValue('value')
```

**Solution:** Use `jest.mocked()` for type-safe mocking.

### Environment Variable Not Available

**Problem:** `process.env.VAR` is `undefined` in test

```typescript
// Check if variable is set in test
beforeEach(() => {
  process.env.MY_VAR = 'test-value'
})

afterEach(() => {
  delete process.env.MY_VAR
  // OR restore original
  process.env = originalEnv
})
```

**Solution:** Set environment variables in test setup.

### Global Mock Conflicts

**Problem:** Global mock affects unrelated tests

```typescript
// Problem: global.fetch mocked globally
global.fetch = jest.fn().mockResolvedValue(...)

// Solution: Reset in beforeEach
beforeEach(() => {
  global.fetch = jest.fn().mockImplementation(defaultFetchImpl)
})
```

**Solution:** Reset global mocks in `beforeEach` (see `tests/jest.setup.js`).

### Mock Module with Side Effects

**Problem:** Module has side effects on import

```typescript
// Module with side effects:
// database.ts
export const db = new DatabaseClient() // Runs on import!

// Solution: Use factory pattern
// database.ts
let db: DatabaseClient | null = null
export const getDb = () => {
  if (!db) db = new DatabaseClient()
  return db
}

// In tests:
jest.mock('@/lib/database', () => ({
  getDb: jest.fn(() => mockDb)
}))
```

**Solution:** Refactor to use factory functions instead of top-level initialization.

### Prisma Client Mock Issues

**Problem:** Prisma client mock not working

```typescript
// Common issue: Mocking wrong import
jest.mock('@prisma/client') // ❌ Wrong

// Solution: Mock your Prisma instance
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    }
  }
}))
```

**Solution:** Mock your Prisma client instance, not `@prisma/client` directly.

## Reference Examples

### Complete Test File Examples

#### API Route Test
See: `tests/unit/middleware/quota-middleware.test.ts`
- NextAuth session mocking
- Resource manager mocking
- Request mocking
- Error handling

#### Database Test
See: `tests/unit/lib/db/db-metrics.test.ts`
- Query tracking
- Metrics collection
- Performance testing
- Edge cases

#### AI Service Test
See: `tests/mocks/ai-generation-service.test.ts`
- OpenRouter API mocking
- Multiple model responses
- Rate limiting simulation
- WebSocket mocking

#### Authentication Test
See: `tests/unit/auth/credentials-provider.test.ts`
- Credentials validation
- Password verification
- Timing-safe comparison
- Session building

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/mock-functions)
- [Testing Library](https://testing-library.com/)
- [Test Patterns Guide](./TEST_PATTERNS.md)
- [Unit Testing Guide](./UNIT_TESTING.md)
- [Integration Testing Guide](./INTEGRATION_TESTING.md)

## Summary

Effective mocking requires:

1. **Understanding** - Know what to mock and what to test with real implementations
2. **Isolation** - Mock external dependencies, not your own code
3. **Realism** - Use realistic mock data and scenarios
4. **Cleanup** - Always clear mocks between tests
5. **Verification** - Assert both outcomes and interactions
6. **Documentation** - Comment complex mock setups
7. **Type Safety** - Use TypeScript for type-safe mocks

Follow these patterns and best practices to write reliable, maintainable tests with proper mocking strategies.
