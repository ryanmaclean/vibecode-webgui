# AgentAPI Integration Testing Strategy

**Document Version**: 1.0
**Date**: 2025-10-02
**Author**: Quality Engineer Agent
**Status**: Draft for Review

## Executive Summary

This document provides a comprehensive testing strategy for the AgentAPI integration in VibeCode WebGUI. The strategy addresses the unique challenges of testing terminal emulation, AI agent communication, real-time SSE streaming, and multi-agent coordination across multiple system boundaries (Next.js, agentapi, code-server, AI extensions).

**Key Challenges**:
- Terminal emulation is non-deterministic
- AI agent responses vary and cannot be precisely predicted
- Integration across multiple systems with different failure modes
- Real-time SSE streaming with connection management
- Multi-agent coordination with race conditions
- Cross-workspace security isolation

**Testing Philosophy**: Test what can be deterministic (infrastructure, protocols, error handling), mock what cannot (AI responses, terminal output), and validate integration points systematically.

---

## 1. Test Pyramid Architecture

### 1.1 Pyramid Distribution

```
                    E2E Tests (5%)
                  /               \
               Chaos Tests (5%)    \
              /                     \
         Integration Tests (25%)    \
        /                            \
    Unit Tests (65%)                 \
   /_________________________________\
```

**Rationale**:
- Heavy unit test coverage ensures core logic reliability
- Integration tests validate protocol boundaries
- Minimal E2E tests validate critical user paths
- Chaos tests ensure resilience under failure

### 1.2 Test Distribution by Layer

| Layer | Tests | Coverage Target | Execution Time | Environment |
|-------|-------|----------------|----------------|-------------|
| Unit | 200+ | 80%+ | < 30s | Jest (jsdom) |
| Integration | 80+ | 70%+ | < 2min | Jest + TestContainers |
| E2E | 20+ | Critical paths | < 10min | Playwright |
| Chaos | 15+ | Failure scenarios | < 5min | Jest + fault injection |
| Performance | 10+ | Latency/throughput | < 15min | k6 + custom scripts |
| Security | 25+ | Attack vectors | < 5min | Jest + custom exploits |

**Total Test Count**: ~350 tests
**Total Execution Time**: ~32 minutes
**CI Parallelization**: 4-6 workers = ~8 minutes total

---

## 2. Unit Tests (65% - ~200 tests)

### 2.1 Agent Framework Client

**File**: `tests/unit/agent-framework-client.test.ts`

```typescript
import { Agent, AgentCoordinator, AgentContext } from '@/lib/agent-framework'
import { UnifiedAIClient } from '@/lib/unified-ai-client'

describe('Agent Framework', () => {
  describe('Agent', () => {
    let mockAIClient: jest.Mocked<UnifiedAIClient>
    let agent: Agent

    beforeEach(() => {
      mockAIClient = {
        chat: jest.fn().mockResolvedValue({
          content: 'AI response',
          role: 'assistant'
        })
      } as any

      agent = new Agent(
        'test-agent',
        'Test Agent',
        'Agent for testing',
        mockAIClient,
        'gpt-4'
      )
    })

    it('should execute task with required capabilities', async () => {
      const capability = {
        name: 'test-cap',
        description: 'Test capability',
        parameters: {},
        execute: jest.fn().mockResolvedValue({ success: true })
      }

      agent.addCapability(capability)

      const task = {
        id: 'task-1',
        description: 'Test task',
        priority: 'high' as const,
        capabilities: ['test-cap'],
        status: 'pending' as const
      }

      const context: AgentContext = {
        workspaceId: 'ws-123',
        userId: 'user-456',
        sessionId: 'session-789',
        aiClient: mockAIClient,
        previousResults: new Map(),
        maxSteps: 10,
        currentStep: 1
      }

      const result = await agent.executeTask(task, context)

      expect(capability.execute).toHaveBeenCalled()
      expect(mockAIClient.chat).toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('should fail when missing required capabilities', async () => {
      const task = {
        id: 'task-1',
        description: 'Test task',
        priority: 'high' as const,
        capabilities: ['missing-cap'],
        status: 'pending' as const
      }

      const context: AgentContext = {
        workspaceId: 'ws-123',
        userId: 'user-456',
        sessionId: 'session-789',
        aiClient: mockAIClient,
        previousResults: new Map(),
        maxSteps: 10,
        currentStep: 1
      }

      await expect(agent.executeTask(task, context)).rejects.toThrow(
        'Missing capabilities: missing-cap'
      )
    })
  })

  describe('AgentCoordinator', () => {
    it('should create execution plan from goal', async () => {
      const mockAIClient = {
        chat: jest.fn().mockResolvedValue({
          content: JSON.stringify({
            tasks: [
              {
                id: 'task-1',
                description: 'Analyze codebase',
                capabilities: ['analyze-codebase'],
                estimatedTime: 30,
                dependencies: [],
                priority: 'high'
              }
            ]
          }),
          role: 'assistant'
        })
      } as any

      const coordinator = new AgentCoordinator(mockAIClient)

      const context: AgentContext = {
        workspaceId: 'ws-123',
        userId: 'user-456',
        sessionId: 'session-789',
        aiClient: mockAIClient,
        previousResults: new Map(),
        maxSteps: 10,
        currentStep: 0
      }

      const plan = await coordinator.createPlan('Analyze project', context)

      expect(plan.tasks).toHaveLength(1)
      expect(plan.tasks[0].description).toBe('Analyze codebase')
      expect(plan.estimatedTotalTime).toBe(30)
    })

    it('should execute tasks in dependency order', async () => {
      // Test topological sort implementation
    })
  })
})
```

### 2.2 AgentAPI Client Mock

**File**: `tests/unit/agentapi-client.test.ts`

```typescript
describe('AgentAPI Client', () => {
  let mockFetch: jest.Mock

  beforeEach(() => {
    mockFetch = jest.fn()
    global.fetch = mockFetch
  })

  describe('sendMessage', () => {
    it('should send message to correct endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: {"type":"content","content":"test"}\n\n'))
            controller.close()
          }
        })
      })

      const client = new AgentAPIClient({ baseURL: 'http://localhost:3000' })
      const messages: Array<{ role: string; content: string }> = []

      await client.sendMessage({
        workspaceId: 'ws-123',
        agentId: 'agent-456',
        message: 'Hello',
        onMessage: (msg) => messages.push(msg)
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/agents/agent-456/messages',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            workspaceId: 'ws-123',
            message: 'Hello'
          })
        })
      )

      expect(messages).toHaveLength(1)
      expect(messages[0].content).toBe('test')
    })

    it('should handle SSE reconnection', async () => {
      let attemptCount = 0
      mockFetch.mockImplementation(() => {
        attemptCount++
        if (attemptCount === 1) {
          return Promise.reject(new Error('Network error'))
        }
        return Promise.resolve({
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('data: {"type":"content","content":"retry success"}\n\n'))
              controller.close()
            }
          })
        })
      })

      const client = new AgentAPIClient({
        baseURL: 'http://localhost:3000',
        retryAttempts: 3,
        retryDelay: 100
      })

      const messages: Array<{ content: string }> = []

      await client.sendMessage({
        workspaceId: 'ws-123',
        agentId: 'agent-456',
        message: 'Test retry',
        onMessage: (msg) => messages.push(msg)
      })

      expect(attemptCount).toBe(2)
      expect(messages[0].content).toBe('retry success')
    })

    it('should handle malformed SSE data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: invalid json\n\n'))
            controller.close()
          }
        })
      })

      const client = new AgentAPIClient({ baseURL: 'http://localhost:3000' })
      const errors: Error[] = []

      await client.sendMessage({
        workspaceId: 'ws-123',
        agentId: 'agent-456',
        message: 'Test',
        onMessage: () => {},
        onError: (err) => errors.push(err)
      })

      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].message).toContain('JSON')
    })
  })

  describe('switchAgent', () => {
    it('should close existing connection before switching', async () => {
      const abortSpy = jest.spyOn(AbortController.prototype, 'abort')

      const client = new AgentAPIClient({ baseURL: 'http://localhost:3000' })

      mockFetch.mockResolvedValue({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            setTimeout(() => controller.close(), 100)
          }
        })
      })

      // Start first connection
      const firstPromise = client.sendMessage({
        workspaceId: 'ws-123',
        agentId: 'agent-1',
        message: 'First',
        onMessage: () => {}
      })

      await new Promise(resolve => setTimeout(resolve, 10))

      // Switch to second agent
      const secondPromise = client.sendMessage({
        workspaceId: 'ws-123',
        agentId: 'agent-2',
        message: 'Second',
        onMessage: () => {}
      })

      await Promise.allSettled([firstPromise, secondPromise])

      expect(abortSpy).toHaveBeenCalled()
    })
  })
})
```

### 2.3 Additional Unit Test Coverage

**Files to create**:
- `tests/unit/agent-context-manager.test.ts` - Context lifecycle management
- `tests/unit/agent-capability-registry.test.ts` - Capability registration/lookup
- `tests/unit/agent-task-scheduler.test.ts` - Task scheduling logic
- `tests/unit/sse-stream-parser.test.ts` - SSE parsing logic
- `tests/unit/workspace-isolation.test.ts` - Workspace boundary enforcement

---

## 3. Integration Tests (25% - ~80 tests)

### 3.1 Next.js → AgentAPI → Agent Flow

**File**: `tests/integration/agent-communication.test.ts`

```typescript
import { createServer } from 'http'
import { Server } from 'socket.io'
import request from 'supertest'
import { setupTestDatabase } from '../utils/test-database'

describe('Agent Communication Integration', () => {
  let app: any
  let server: any
  let io: Server

  beforeAll(async () => {
    await setupTestDatabase()
    // Start test Next.js server with agent routes
    app = await import('@/app')
    server = createServer(app)
    io = new Server(server)

    await new Promise<void>(resolve => {
      server.listen(0, () => resolve())
    })
  })

  afterAll(async () => {
    await server.close()
    await io.close()
  })

  describe('POST /api/agents/:agentId/messages', () => {
    it('should stream agent response via SSE', async (done) => {
      const messages: string[] = []

      const response = await request(server)
        .post('/api/agents/code-analyzer/messages')
        .send({
          workspaceId: 'test-workspace',
          message: 'Analyze this code'
        })
        .set('Accept', 'text/event-stream')
        .buffer(false)
        .parse((res, callback) => {
          res.on('data', (chunk) => {
            const data = chunk.toString()
            if (data.startsWith('data: ')) {
              const json = JSON.parse(data.substring(6))
              messages.push(json.content)
            }
          })
          res.on('end', () => callback(null, messages))
        })

      expect(response.status).toBe(200)
      expect(messages.length).toBeGreaterThan(0)
      done()
    })

    it('should handle concurrent requests to different agents', async () => {
      const agent1Promise = request(server)
        .post('/api/agents/code-analyzer/messages')
        .send({ workspaceId: 'ws-1', message: 'Task 1' })

      const agent2Promise = request(server)
        .post('/api/agents/test-generator/messages')
        .send({ workspaceId: 'ws-1', message: 'Task 2' })

      const [response1, response2] = await Promise.all([
        agent1Promise,
        agent2Promise
      ])

      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)
    })

    it('should enforce workspace isolation', async () => {
      // Create session in workspace 1
      const session1 = await request(server)
        .post('/api/auth/session')
        .send({ workspaceId: 'ws-1', userId: 'user-1' })

      const token1 = session1.body.token

      // Try to access workspace 2 with workspace 1 token
      const response = await request(server)
        .post('/api/agents/code-analyzer/messages')
        .set('Authorization', `Bearer ${token1}`)
        .send({ workspaceId: 'ws-2', message: 'Unauthorized access' })

      expect(response.status).toBe(403)
      expect(response.body.error).toContain('workspace')
    })
  })

  describe('Agent State Persistence', () => {
    it('should persist agent context across requests', async () => {
      // First request
      const response1 = await request(server)
        .post('/api/agents/code-analyzer/messages')
        .send({
          workspaceId: 'ws-1',
          sessionId: 'session-123',
          message: 'Remember: my name is Alice'
        })

      expect(response1.status).toBe(200)

      // Second request - should remember context
      const response2 = await request(server)
        .post('/api/agents/code-analyzer/messages')
        .send({
          workspaceId: 'ws-1',
          sessionId: 'session-123',
          message: 'What is my name?'
        })

      expect(response2.status).toBe(200)
      // Validate response mentions Alice (implementation-specific)
    })
  })
})
```

### 3.2 Terminal Integration Tests

**File**: `tests/integration/terminal-agent-integration.test.ts`

```typescript
import { GenericContainer, StartedTestContainer } from 'testcontainers'
import WebSocket from 'ws'

describe('Terminal Agent Integration', () => {
  let codeServerContainer: StartedTestContainer
  let wsClient: WebSocket

  beforeAll(async () => {
    // Start code-server container
    codeServerContainer = await new GenericContainer('codercom/code-server:latest')
      .withExposedPorts(8080)
      .withEnvironment({
        PASSWORD: 'test123'
      })
      .start()

    const port = codeServerContainer.getMappedPort(8080)
    const wsUrl = `ws://localhost:${port}/api/terminal`

    wsClient = new WebSocket(wsUrl)
    await new Promise(resolve => wsClient.on('open', resolve))
  }, 30000)

  afterAll(async () => {
    wsClient.close()
    await codeServerContainer.stop()
  })

  it('should execute command and receive output', (done) => {
    const outputs: string[] = []

    wsClient.on('message', (data) => {
      const message = JSON.parse(data.toString())
      if (message.type === 'output') {
        outputs.push(message.data)
      }

      if (outputs.join('').includes('Hello from terminal')) {
        expect(outputs.length).toBeGreaterThan(0)
        done()
      }
    })

    wsClient.send(JSON.stringify({
      type: 'input',
      data: 'echo "Hello from terminal"\n'
    }))
  }, 10000)

  it('should handle long-running commands', (done) => {
    const outputs: string[] = []
    let outputCount = 0

    wsClient.on('message', (data) => {
      const message = JSON.parse(data.toString())
      if (message.type === 'output') {
        outputs.push(message.data)
        outputCount++

        // Should receive multiple output events
        if (outputCount >= 3) {
          done()
        }
      }
    })

    // Run command that outputs incrementally
    wsClient.send(JSON.stringify({
      type: 'input',
      data: 'for i in 1 2 3; do echo "Line $i"; sleep 0.1; done\n'
    }))
  }, 10000)
})
```

### 3.3 Additional Integration Tests

**Files to create**:
- `tests/integration/agent-coordination.test.ts` - Multi-agent task coordination
- `tests/integration/workspace-provisioning.test.ts` - Workspace lifecycle with agents
- `tests/integration/sse-connection-management.test.ts` - Connection pooling, cleanup
- `tests/integration/agent-error-recovery.test.ts` - Error handling across boundaries
- `tests/integration/agent-authentication.test.ts` - Auth token validation

---

## 4. End-to-End Tests (5% - ~20 tests)

### 4.1 Critical User Journeys

**File**: `tests/e2e/agent-user-journey.test.ts`

```typescript
import { test, expect, Page } from '@playwright/test'

test.describe('Agent User Journey', () => {
  let page: Page

  test.beforeEach(async ({ page: p }) => {
    page = p
    await page.goto('http://localhost:3000')

    // Login
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')

    // Wait for workspace to load
    await page.waitForSelector('[data-testid="workspace-layout"]')
  })

  test('should send message and receive response', async () => {
    // Select agent
    await page.click('[data-testid="agent-selector"]')
    await page.click('[data-testid="agent-code-analyzer"]')

    // Type message
    await page.fill('[data-testid="agent-input"]', 'Analyze this project')
    await page.click('[data-testid="send-message"]')

    // Wait for response
    await page.waitForSelector('[data-testid="agent-message"]', {
      timeout: 10000
    })

    const messageText = await page.textContent('[data-testid="agent-message"]')
    expect(messageText).toBeTruthy()
    expect(messageText!.length).toBeGreaterThan(0)
  })

  test('should switch agents mid-conversation', async () => {
    // Start with code analyzer
    await page.click('[data-testid="agent-selector"]')
    await page.click('[data-testid="agent-code-analyzer"]')

    await page.fill('[data-testid="agent-input"]', 'Analyze the auth module')
    await page.click('[data-testid="send-message"]')

    await page.waitForSelector('[data-testid="agent-message"]')

    // Switch to test generator
    await page.click('[data-testid="agent-selector"]')
    await page.click('[data-testid="agent-test-generator"]')

    // Verify agent switched
    const agentName = await page.textContent('[data-testid="current-agent-name"]')
    expect(agentName).toBe('Test Generator')

    // Send new message
    await page.fill('[data-testid="agent-input"]', 'Generate tests for auth')
    await page.click('[data-testid="send-message"]')

    await page.waitForSelector('[data-testid="agent-message"]:nth-child(2)')
  })

  test('should handle agent timeout gracefully', async () => {
    // Simulate slow agent by using mock endpoint
    await page.route('**/api/agents/*/messages', async route => {
      // Delay response significantly
      await new Promise(resolve => setTimeout(resolve, 35000))
      await route.fulfill({ status: 504 })
    })

    await page.click('[data-testid="agent-selector"]')
    await page.click('[data-testid="agent-code-analyzer"]')

    await page.fill('[data-testid="agent-input"]', 'Slow request')
    await page.click('[data-testid="send-message"]')

    // Should show timeout error
    await page.waitForSelector('[data-testid="error-message"]', {
      timeout: 40000
    })

    const errorText = await page.textContent('[data-testid="error-message"]')
    expect(errorText).toContain('timeout')
  })

  test('should maintain conversation history', async () => {
    await page.click('[data-testid="agent-selector"]')
    await page.click('[data-testid="agent-code-analyzer"]')

    // Send three messages
    const messages = [
      'First message',
      'Second message',
      'Third message'
    ]

    for (const msg of messages) {
      await page.fill('[data-testid="agent-input"]', msg)
      await page.click('[data-testid="send-message"]')
      await page.waitForSelector(`[data-testid="user-message"]:has-text("${msg}")`)
    }

    // Verify all messages are visible
    const messageElements = await page.$$('[data-testid="user-message"]')
    expect(messageElements.length).toBe(3)
  })
})
```

### 4.2 Multi-Workspace Agent Tests

**File**: `tests/e2e/multi-workspace-agents.test.ts`

```typescript
test.describe('Multi-Workspace Agent Coordination', () => {
  test('should run agents in parallel across workspaces', async ({ browser }) => {
    // Create two browser contexts (simulating two users)
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    // Login to workspace 1
    await page1.goto('http://localhost:3000')
    await page1.fill('[name="email"]', 'user1@example.com')
    await page1.fill('[name="password"]', 'password123')
    await page1.click('button[type="submit"]')

    // Login to workspace 2
    await page2.goto('http://localhost:3000')
    await page2.fill('[name="email"]', 'user2@example.com')
    await page2.fill('[name="password"]', 'password123')
    await page2.click('button[type="submit"]')

    // Send messages simultaneously
    const [response1Promise, response2Promise] = await Promise.all([
      (async () => {
        await page1.click('[data-testid="agent-selector"]')
        await page1.click('[data-testid="agent-code-analyzer"]')
        await page1.fill('[data-testid="agent-input"]', 'Workspace 1 task')
        await page1.click('[data-testid="send-message"]')
        return page1.waitForSelector('[data-testid="agent-message"]', {
          timeout: 15000
        })
      })(),
      (async () => {
        await page2.click('[data-testid="agent-selector"]')
        await page2.click('[data-testid="agent-test-generator"]')
        await page2.fill('[data-testid="agent-input"]', 'Workspace 2 task')
        await page2.click('[data-testid="send-message"]')
        return page2.waitForSelector('[data-testid="agent-message"]', {
          timeout: 15000
        })
      })()
    ])

    expect(response1Promise).toBeTruthy()
    expect(response2Promise).toBeTruthy()

    await context1.close()
    await context2.close()
  })
})
```

---

## 5. Performance Tests (5% - ~10 tests)

### 5.1 Latency Testing

**File**: `tests/performance/agent-latency.test.ts`

```typescript
import { performance } from 'perf_hooks'

describe('Agent Performance', () => {
  test('should respond within latency threshold', async () => {
    const client = new AgentAPIClient({ baseURL: 'http://localhost:3000' })
    const latencies: number[] = []

    // Send 50 requests
    for (let i = 0; i < 50; i++) {
      const start = performance.now()

      await client.sendMessage({
        workspaceId: 'ws-perf',
        agentId: 'code-analyzer',
        message: `Test message ${i}`,
        onMessage: () => {}
      })

      const end = performance.now()
      latencies.push(end - start)
    }

    // Calculate metrics
    const p50 = latencies.sort()[Math.floor(latencies.length * 0.5)]
    const p95 = latencies.sort()[Math.floor(latencies.length * 0.95)]
    const p99 = latencies.sort()[Math.floor(latencies.length * 0.99)]

    console.log({
      p50: `${p50.toFixed(2)}ms`,
      p95: `${p95.toFixed(2)}ms`,
      p99: `${p99.toFixed(2)}ms`
    })

    // Assertions
    expect(p50).toBeLessThan(500) // 500ms p50
    expect(p95).toBeLessThan(2000) // 2s p95
    expect(p99).toBeLessThan(5000) // 5s p99
  })

  test('should handle concurrent requests efficiently', async () => {
    const client = new AgentAPIClient({ baseURL: 'http://localhost:3000' })
    const concurrency = 20
    const start = performance.now()

    const promises = Array.from({ length: concurrency }, (_, i) =>
      client.sendMessage({
        workspaceId: `ws-${i}`,
        agentId: 'code-analyzer',
        message: `Concurrent test ${i}`,
        onMessage: () => {}
      })
    )

    await Promise.all(promises)
    const end = performance.now()
    const totalTime = end - start

    // With 20 concurrent requests, total time should be ~1-2x single request
    // (not 20x, indicating proper parallel processing)
    expect(totalTime).toBeLessThan(3000)
  })
})
```

### 5.2 Throughput Testing

**File**: `tests/performance/agent-throughput.test.ts`

```typescript
describe('Agent Throughput', () => {
  test('should maintain throughput under sustained load', async () => {
    const client = new AgentAPIClient({ baseURL: 'http://localhost:3000' })
    const duration = 60000 // 60 seconds
    const start = performance.now()
    let requestCount = 0
    let errorCount = 0

    // Sustained load for 60 seconds
    while (performance.now() - start < duration) {
      try {
        await client.sendMessage({
          workspaceId: 'ws-throughput',
          agentId: 'code-analyzer',
          message: `Load test ${requestCount}`,
          onMessage: () => {}
        })
        requestCount++
      } catch (error) {
        errorCount++
      }
    }

    const throughput = requestCount / (duration / 1000)
    const errorRate = errorCount / requestCount

    console.log({
      totalRequests: requestCount,
      throughput: `${throughput.toFixed(2)} req/s`,
      errorRate: `${(errorRate * 100).toFixed(2)}%`
    })

    // Assertions
    expect(throughput).toBeGreaterThan(10) // Minimum 10 req/s
    expect(errorRate).toBeLessThan(0.01) // < 1% error rate
  })
})
```

### 5.3 Memory Leak Testing

**File**: `tests/performance/agent-memory.test.ts`

```typescript
describe('Agent Memory Usage', () => {
  test('should not leak memory over long session', async () => {
    const client = new AgentAPIClient({ baseURL: 'http://localhost:3000' })
    const initialMemory = process.memoryUsage().heapUsed

    // Run 1000 requests
    for (let i = 0; i < 1000; i++) {
      await client.sendMessage({
        workspaceId: 'ws-memory',
        agentId: 'code-analyzer',
        message: `Memory test ${i}`,
        onMessage: () => {}
      })

      // Force garbage collection every 100 requests
      if (i % 100 === 0 && global.gc) {
        global.gc()
      }
    }

    // Final GC
    if (global.gc) global.gc()

    const finalMemory = process.memoryUsage().heapUsed
    const memoryIncrease = finalMemory - initialMemory
    const memoryIncreaseMB = memoryIncrease / 1024 / 1024

    console.log({
      initialMemory: `${(initialMemory / 1024 / 1024).toFixed(2)} MB`,
      finalMemory: `${(finalMemory / 1024 / 1024).toFixed(2)} MB`,
      increase: `${memoryIncreaseMB.toFixed(2)} MB`
    })

    // Memory increase should be < 50MB for 1000 requests
    expect(memoryIncreaseMB).toBeLessThan(50)
  })
})
```

---

## 6. Chaos Tests (5% - ~15 tests)

### 6.1 Network Failure Scenarios

**File**: `tests/chaos/network-failures.test.ts`

```typescript
import nock from 'nock'

describe('Chaos: Network Failures', () => {
  test('should recover from intermittent connection drops', async () => {
    let requestCount = 0

    // Fail first 2 requests, succeed on 3rd
    nock('http://localhost:3000')
      .post('/api/agents/code-analyzer/messages')
      .times(2)
      .replyWithError({ code: 'ECONNRESET' })

    nock('http://localhost:3000')
      .post('/api/agents/code-analyzer/messages')
      .reply(200, 'data: {"type":"content","content":"success"}\n\n')

    const client = new AgentAPIClient({
      baseURL: 'http://localhost:3000',
      retryAttempts: 3,
      retryDelay: 100
    })

    const messages: string[] = []

    await client.sendMessage({
      workspaceId: 'ws-chaos',
      agentId: 'code-analyzer',
      message: 'Test resilience',
      onMessage: (msg) => messages.push(msg.content)
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]).toBe('success')
  })

  test('should handle SSE connection interruption', async () => {
    const server = createMockSSEServer()

    const client = new AgentAPIClient({ baseURL: server.url })
    const messages: string[] = []
    let reconnectCount = 0

    client.on('reconnect', () => reconnectCount++)

    const messagePromise = client.sendMessage({
      workspaceId: 'ws-chaos',
      agentId: 'code-analyzer',
      message: 'Test interruption',
      onMessage: (msg) => messages.push(msg.content)
    })

    // Simulate connection drop after 2 messages
    setTimeout(() => {
      server.dropConnection()
    }, 200)

    await messagePromise

    expect(reconnectCount).toBeGreaterThan(0)
    expect(messages.length).toBeGreaterThan(0)
  })

  test('should timeout after max retry attempts', async () => {
    nock('http://localhost:3000')
      .post('/api/agents/code-analyzer/messages')
      .times(5)
      .replyWithError({ code: 'ETIMEDOUT' })

    const client = new AgentAPIClient({
      baseURL: 'http://localhost:3000',
      retryAttempts: 3,
      retryDelay: 100,
      timeout: 5000
    })

    await expect(
      client.sendMessage({
        workspaceId: 'ws-chaos',
        agentId: 'code-analyzer',
        message: 'Test timeout',
        onMessage: () => {}
      })
    ).rejects.toThrow(/timeout|ETIMEDOUT/)
  })
})
```

### 6.2 Agent Crash Scenarios

**File**: `tests/chaos/agent-crashes.test.ts`

```typescript
describe('Chaos: Agent Crashes', () => {
  test('should handle agent process crash gracefully', async () => {
    // Mock agent endpoint that crashes mid-response
    nock('http://localhost:3000')
      .post('/api/agents/code-analyzer/messages')
      .reply(200, function() {
        const stream = new PassThrough()
        stream.write('data: {"type":"content","content":"Starting..."}\n\n')

        // Simulate crash after 100ms
        setTimeout(() => {
          stream.destroy(new Error('Process crashed'))
        }, 100)

        return stream
      })

    const client = new AgentAPIClient({ baseURL: 'http://localhost:3000' })
    const messages: string[] = []
    const errors: Error[] = []

    await client.sendMessage({
      workspaceId: 'ws-chaos',
      agentId: 'code-analyzer',
      message: 'Test crash',
      onMessage: (msg) => messages.push(msg.content),
      onError: (err) => errors.push(err)
    })

    expect(messages.length).toBeGreaterThan(0) // Should get partial response
    expect(errors.length).toBeGreaterThan(0) // Should capture error
  })

  test('should restart crashed agent automatically', async () => {
    const mockAgentManager = {
      restartAgent: jest.fn().mockResolvedValue(true),
      getAgentHealth: jest.fn()
        .mockResolvedValueOnce({ status: 'crashed' })
        .mockResolvedValueOnce({ status: 'healthy' })
    }

    const coordinator = new AgentCoordinator(mockAIClient)
    coordinator.setAgentManager(mockAgentManager)

    // Trigger crash detection
    await coordinator.handleAgentFailure('code-analyzer')

    expect(mockAgentManager.restartAgent).toHaveBeenCalledWith('code-analyzer')

    // Verify agent is healthy after restart
    const health = await mockAgentManager.getAgentHealth('code-analyzer')
    expect(health.status).toBe('healthy')
  })
})
```

### 6.3 Resource Exhaustion

**File**: `tests/chaos/resource-exhaustion.test.ts`

```typescript
describe('Chaos: Resource Exhaustion', () => {
  test('should handle memory pressure gracefully', async () => {
    const client = new AgentAPIClient({ baseURL: 'http://localhost:3000' })

    // Simulate high memory usage by creating large payloads
    const largeMessage = 'x'.repeat(10 * 1024 * 1024) // 10MB message

    await expect(
      client.sendMessage({
        workspaceId: 'ws-chaos',
        agentId: 'code-analyzer',
        message: largeMessage,
        onMessage: () => {}
      })
    ).rejects.toThrow(/payload too large/i)
  })

  test('should queue requests when at capacity', async () => {
    const maxConcurrent = 5
    const client = new AgentAPIClient({
      baseURL: 'http://localhost:3000',
      maxConcurrentRequests: maxConcurrent
    })

    // Send 10 requests (should queue 5)
    const promises = Array.from({ length: 10 }, (_, i) =>
      client.sendMessage({
        workspaceId: 'ws-chaos',
        agentId: 'code-analyzer',
        message: `Request ${i}`,
        onMessage: () => {}
      })
    )

    // All should eventually complete
    await Promise.all(promises)

    // Verify queue worked correctly
    const metrics = client.getMetrics()
    expect(metrics.maxQueueSize).toBeGreaterThanOrEqual(5)
  })
})
```

---

## 7. Security Tests (5% - ~25 tests)

### 7.1 Authentication & Authorization

**File**: `tests/security/agent-auth.test.ts`

```typescript
describe('Security: Authentication', () => {
  test('should reject requests without valid token', async () => {
    const response = await request(app)
      .post('/api/agents/code-analyzer/messages')
      .send({ workspaceId: 'ws-1', message: 'Test' })

    expect(response.status).toBe(401)
  })

  test('should reject expired tokens', async () => {
    const expiredToken = jwt.sign(
      { userId: 'user-1', workspaceId: 'ws-1' },
      process.env.JWT_SECRET!,
      { expiresIn: '-1h' }
    )

    const response = await request(app)
      .post('/api/agents/code-analyzer/messages')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send({ workspaceId: 'ws-1', message: 'Test' })

    expect(response.status).toBe(401)
  })

  test('should enforce workspace-scoped access', async () => {
    const ws1Token = createToken({ userId: 'user-1', workspaceId: 'ws-1' })

    // Try to access workspace 2
    const response = await request(app)
      .post('/api/agents/code-analyzer/messages')
      .set('Authorization', `Bearer ${ws1Token}`)
      .send({ workspaceId: 'ws-2', message: 'Cross-workspace access' })

    expect(response.status).toBe(403)
  })
})
```

### 7.2 Injection Attacks

**File**: `tests/security/injection-attacks.test.ts`

```typescript
describe('Security: Injection Attacks', () => {
  test('should sanitize agent message input', async () => {
    const maliciousInput = '<script>alert("XSS")</script>'

    const response = await request(app)
      .post('/api/agents/code-analyzer/messages')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ workspaceId: 'ws-1', message: maliciousInput })

    expect(response.status).toBe(200)

    // Verify sanitization occurred
    const messages = await getAgentMessages('ws-1')
    expect(messages[0].content).not.toContain('<script>')
  })

  test('should prevent command injection in terminal', async () => {
    const maliciousCommand = 'ls; rm -rf /'

    const response = await request(app)
      .post('/api/terminal/execute')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ workspaceId: 'ws-1', command: maliciousCommand })

    // Should either reject or sandbox execution
    expect([400, 403]).toContain(response.status)
  })

  test('should prevent SQL injection in agent queries', async () => {
    const maliciousQuery = "'; DROP TABLE agents; --"

    const response = await request(app)
      .post('/api/agents/search')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ query: maliciousQuery })

    expect(response.status).toBe(200)

    // Verify database integrity
    const agents = await db.query('SELECT COUNT(*) FROM agents')
    expect(agents.rows[0].count).toBeGreaterThan(0)
  })
})
```

### 7.3 Rate Limiting & DoS Protection

**File**: `tests/security/rate-limiting.test.ts`

```typescript
describe('Security: Rate Limiting', () => {
  test('should enforce rate limits per user', async () => {
    const token = createToken({ userId: 'user-1', workspaceId: 'ws-1' })

    // Send 100 requests rapidly
    const promises = Array.from({ length: 100 }, () =>
      request(app)
        .post('/api/agents/code-analyzer/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({ workspaceId: 'ws-1', message: 'Rate limit test' })
    )

    const responses = await Promise.all(promises)

    // Should have some 429 responses
    const rateLimited = responses.filter(r => r.status === 429)
    expect(rateLimited.length).toBeGreaterThan(0)
  })

  test('should prevent resource exhaustion via large payloads', async () => {
    const largePayload = {
      workspaceId: 'ws-1',
      message: 'x'.repeat(10 * 1024 * 1024) // 10MB
    }

    const response = await request(app)
      .post('/api/agents/code-analyzer/messages')
      .set('Authorization', `Bearer ${validToken}`)
      .send(largePayload)

    expect(response.status).toBe(413) // Payload too large
  })
})
```

---

## 8. Mocking Strategy

### 8.1 AI Response Mocking

**File**: `tests/mocks/ai-responses.ts`

```typescript
export const mockAIResponses = {
  codeAnalysis: {
    simple: 'The code is well-structured with clear separation of concerns.',
    detailed: `Analysis Results:
      - Architecture: Modular design with clear boundaries
      - Code Quality: 8/10
      - Test Coverage: 75%
      - Recommendations: Add input validation, improve error handling`,
    error: 'Unable to analyze: file not found'
  },

  testGeneration: {
    unit: `describe('User', () => {
      test('should create user', () => {
        const user = new User('Alice')
        expect(user.name).toBe('Alice')
      })
    })`,
    integration: 'Generated 5 integration tests covering authentication flow'
  },

  documentation: {
    readme: '# Project Name\n\nDescription of the project...',
    api: 'API documentation generated for 15 endpoints'
  }
}

export function createMockAIClient(responseType: keyof typeof mockAIResponses) {
  return {
    chat: jest.fn().mockResolvedValue({
      content: JSON.stringify(mockAIResponses[responseType]),
      role: 'assistant'
    }),
    stream: jest.fn(async function* () {
      const content = mockAIResponses[responseType]
      for (const char of JSON.stringify(content)) {
        yield { content: char, role: 'assistant' }
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    })
  }
}
```

### 8.2 Terminal Output Mocking

**File**: `tests/mocks/terminal-output.ts`

```typescript
export const mockTerminalOutputs = {
  ls: `total 48
drwxr-xr-x  12 user  staff   384 Oct  2 10:00 .
drwxr-xr-x   5 user  staff   160 Oct  1 15:30 ..
-rw-r--r--   1 user  staff  1234 Oct  2 09:45 README.md
drwxr-xr-x   8 user  staff   256 Oct  2 10:00 src
drwxr-xr-x   5 user  staff   160 Oct  1 14:20 tests`,

  gitStatus: `On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  modified:   src/lib/agent.ts

Untracked files:
  tests/agent.test.ts`,

  npmTest: `> jest

 PASS  tests/agent.test.ts
  Agent
    ✓ should execute task (45 ms)
    ✓ should handle errors (12 ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        2.345 s`
}

export function createMockTerminal() {
  const outputs: string[] = []

  return {
    on(event: string, callback: (data: string) => void) {
      if (event === 'data') {
        // Simulate async output
        setTimeout(() => {
          callback(mockTerminalOutputs.ls)
        }, 50)
      }
    },
    write(data: string) {
      outputs.push(data)
    },
    clear() {
      outputs.length = 0
    },
    getOutputs: () => outputs
  }
}
```

### 8.3 SSE Stream Mocking

**File**: `tests/mocks/sse-stream.ts`

```typescript
import { Readable } from 'stream'

export function createMockSSEStream(messages: Array<{ type: string; content: string }>) {
  const stream = new Readable({
    read() {}
  })

  // Send messages with delays
  const sendMessages = async () => {
    for (const msg of messages) {
      const data = `data: ${JSON.stringify(msg)}\n\n`
      stream.push(data)
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    stream.push(null) // End stream
  }

  sendMessages()

  return stream
}

export function createFailingSSEStream(failAfter: number = 2) {
  const stream = new Readable({
    read() {}
  })

  let count = 0
  const interval = setInterval(() => {
    count++
    if (count <= failAfter) {
      stream.push(`data: ${JSON.stringify({ type: 'content', content: `Message ${count}` })}\n\n`)
    } else {
      stream.destroy(new Error('Stream failure'))
      clearInterval(interval)
    }
  }, 100)

  return stream
}
```

---

## 9. CI/CD Integration

### 9.1 GitHub Actions Workflow

**File**: `.github/workflows/agentapi-tests.yml`

```yaml
name: AgentAPI Tests

on:
  push:
    branches: [main, develop]
    paths:
      - 'src/lib/agent-framework.ts'
      - 'src/app/api/agents/**'
      - 'tests/**'
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json
          flags: unit

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      - name: Build application
        run: npm run build

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/

  chaos-tests:
    name: Chaos Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run chaos tests
        run: npm run test:chaos

  performance-tests:
    name: Performance Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run performance tests
        run: npm run test:performance

      - name: Upload performance metrics
        uses: actions/upload-artifact@v4
        with:
          name: performance-metrics
          path: performance-results.json

  security-tests:
    name: Security Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run security tests
        run: npm run test:security
```

### 9.2 Package.json Scripts

**Add to package.json**:

```json
{
  "scripts": {
    "test:unit": "jest --testPathPattern=tests/unit",
    "test:integration": "jest --testPathPattern=tests/integration --runInBand",
    "test:e2e": "playwright test tests/e2e",
    "test:chaos": "jest --testPathPattern=tests/chaos",
    "test:performance": "jest --testPathPattern=tests/performance --runInBand",
    "test:security": "jest --testPathPattern=tests/security",
    "test:agent": "npm run test:unit && npm run test:integration",
    "test:agent:full": "npm run test:unit && npm run test:integration && npm run test:e2e && npm run test:chaos",
    "test:agent:ci": "npm run test:agent:full && npm run test:performance && npm run test:security"
  }
}
```

---

## 10. Test Data Management

### 10.1 Test Fixtures

**File**: `tests/fixtures/agent-fixtures.ts`

```typescript
export const testWorkspaces = {
  basic: {
    id: 'ws-test-001',
    name: 'Test Workspace',
    userId: 'user-test-001',
    createdAt: new Date('2025-01-01')
  },
  withAgents: {
    id: 'ws-test-002',
    name: 'Agent Workspace',
    userId: 'user-test-002',
    agents: ['code-analyzer', 'test-generator'],
    createdAt: new Date('2025-01-01')
  }
}

export const testAgents = {
  codeAnalyzer: {
    id: 'agent-test-001',
    name: 'Code Analyzer',
    type: 'code-analyzer',
    capabilities: ['analyze-codebase', 'detect-patterns'],
    status: 'active'
  },
  testGenerator: {
    id: 'agent-test-002',
    name: 'Test Generator',
    type: 'test-generator',
    capabilities: ['generate-tests', 'coverage-analysis'],
    status: 'active'
  }
}

export const testMessages = {
  simple: {
    role: 'user',
    content: 'Analyze this file',
    timestamp: new Date('2025-10-02T10:00:00Z')
  },
  complex: {
    role: 'user',
    content: 'Generate comprehensive test suite with edge cases',
    timestamp: new Date('2025-10-02T10:00:00Z'),
    context: {
      files: ['src/auth.ts', 'src/user.ts'],
      framework: 'jest'
    }
  }
}
```

### 10.2 Test Database Seeding

**File**: `tests/utils/test-database.ts`

```typescript
import { PrismaClient } from '@prisma/client'

export async function setupTestDatabase() {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: process.env.TEST_DATABASE_URL }
    }
  })

  // Clear existing data
  await prisma.message.deleteMany()
  await prisma.agent.deleteMany()
  await prisma.workspace.deleteMany()
  await prisma.user.deleteMany()

  // Seed test data
  const user = await prisma.user.create({
    data: {
      id: 'user-test-001',
      email: 'test@example.com',
      name: 'Test User'
    }
  })

  const workspace = await prisma.workspace.create({
    data: {
      id: 'ws-test-001',
      name: 'Test Workspace',
      userId: user.id
    }
  })

  await prisma.agent.createMany({
    data: [
      {
        id: 'agent-test-001',
        name: 'Code Analyzer',
        type: 'code-analyzer',
        workspaceId: workspace.id
      },
      {
        id: 'agent-test-002',
        name: 'Test Generator',
        type: 'test-generator',
        workspaceId: workspace.id
      }
    ]
  })

  return { prisma, user, workspace }
}

export async function teardownTestDatabase(prisma: PrismaClient) {
  await prisma.$disconnect()
}
```

---

## 11. Monitoring & Observability

### 11.1 Test Metrics Collection

**File**: `tests/utils/metrics-collector.ts`

```typescript
export class TestMetricsCollector {
  private metrics: Map<string, number[]> = new Map()

  recordLatency(operation: string, latency: number) {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, [])
    }
    this.metrics.get(operation)!.push(latency)
  }

  getPercentile(operation: string, percentile: number): number {
    const values = this.metrics.get(operation)
    if (!values || values.length === 0) return 0

    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[index]
  }

  getAverage(operation: string): number {
    const values = this.metrics.get(operation)
    if (!values || values.length === 0) return 0

    return values.reduce((a, b) => a + b, 0) / values.length
  }

  generateReport(): string {
    let report = '# Test Metrics Report\n\n'

    for (const [operation, values] of this.metrics) {
      report += `## ${operation}\n`
      report += `- Count: ${values.length}\n`
      report += `- Average: ${this.getAverage(operation).toFixed(2)}ms\n`
      report += `- P50: ${this.getPercentile(operation, 50).toFixed(2)}ms\n`
      report += `- P95: ${this.getPercentile(operation, 95).toFixed(2)}ms\n`
      report += `- P99: ${this.getPercentile(operation, 99).toFixed(2)}ms\n\n`
    }

    return report
  }
}
```

### 11.2 Datadog Integration

**File**: `tests/utils/datadog-test-reporter.ts`

```typescript
import { StatsD } from 'node-statsd'

export class DatadogTestReporter {
  private client: StatsD

  constructor() {
    this.client = new StatsD({
      host: process.env.DD_AGENT_HOST || 'localhost',
      port: 8125,
      prefix: 'vibecode.tests.'
    })
  }

  reportTestResult(testName: string, passed: boolean, duration: number) {
    this.client.increment(`${testName}.${passed ? 'passed' : 'failed'}`)
    this.client.timing(`${testName}.duration`, duration)
  }

  reportCoverage(coverage: number) {
    this.client.gauge('coverage.percentage', coverage)
  }

  reportPerformance(operation: string, latency: number) {
    this.client.timing(`performance.${operation}`, latency)
  }
}
```

---

## 12. Documentation & Training

### 12.1 Test Writing Guidelines

**Create**: `docs/testing/AGENT_TEST_GUIDELINES.md`

Key sections:
- When to use unit vs integration vs E2E tests
- How to mock AI responses effectively
- Best practices for SSE stream testing
- Error handling patterns
- Test naming conventions

### 12.2 Troubleshooting Guide

**Create**: `docs/testing/TROUBLESHOOTING.md`

Common issues:
- Flaky tests due to timing issues
- SSE connection drops in CI
- Terminal output capture failures
- Agent state pollution between tests
- Memory leaks in test suite

---

## 13. Implementation Timeline

### Phase 1: Foundation (Week 1)
- Set up test infrastructure
- Create unit tests for core agent framework
- Implement basic mocking utilities
- Configure Jest and Playwright

### Phase 2: Integration (Week 2)
- Build integration test suite
- Set up TestContainers for code-server
- Implement SSE stream testing
- Add workspace isolation tests

### Phase 3: Advanced Testing (Week 3)
- Develop chaos tests
- Create performance benchmarks
- Build security test suite
- Implement test metrics collection

### Phase 4: CI/CD & Polish (Week 4)
- Configure GitHub Actions workflows
- Set up Datadog test reporting
- Write documentation
- Train team on test practices

---

## 14. Success Criteria

### Coverage Targets
- Unit test coverage: 80%+
- Integration test coverage: 70%+
- Critical path E2E coverage: 100%

### Performance Targets
- Test suite execution: < 10 minutes in CI
- Unit tests: < 30 seconds
- Integration tests: < 2 minutes
- E2E tests: < 10 minutes

### Quality Targets
- Zero flaky tests
- < 1% false positive rate
- 100% of critical bugs caught before production

---

## 15. Risk Assessment

### High-Risk Areas
1. **Terminal Non-Determinism**: Mitigated by extensive mocking
2. **AI Response Variability**: Mitigated by response templates
3. **SSE Connection Stability**: Mitigated by chaos tests
4. **Cross-Workspace Leakage**: Mitigated by security tests
5. **Performance Degradation**: Mitigated by continuous benchmarking

### Mitigation Strategies
- Extensive mocking reduces external dependencies
- Chaos testing ensures resilience
- Security testing prevents vulnerabilities
- Performance testing catches regressions early

---

## Appendix A: Example Test Code Structure

```
tests/
├── unit/
│   ├── agent-framework-client.test.ts
│   ├── agentapi-client.test.ts
│   ├── agent-context-manager.test.ts
│   ├── agent-capability-registry.test.ts
│   ├── agent-task-scheduler.test.ts
│   ├── sse-stream-parser.test.ts
│   └── workspace-isolation.test.ts
├── integration/
│   ├── agent-communication.test.ts
│   ├── terminal-agent-integration.test.ts
│   ├── agent-coordination.test.ts
│   ├── workspace-provisioning.test.ts
│   ├── sse-connection-management.test.ts
│   └── agent-error-recovery.test.ts
├── e2e/
│   ├── agent-user-journey.test.ts
│   ├── multi-workspace-agents.test.ts
│   └── agent-switching.test.ts
├── chaos/
│   ├── network-failures.test.ts
│   ├── agent-crashes.test.ts
│   └── resource-exhaustion.test.ts
├── performance/
│   ├── agent-latency.test.ts
│   ├── agent-throughput.test.ts
│   └── agent-memory.test.ts
├── security/
│   ├── agent-auth.test.ts
│   ├── injection-attacks.test.ts
│   └── rate-limiting.test.ts
├── mocks/
│   ├── ai-responses.ts
│   ├── terminal-output.ts
│   └── sse-stream.ts
├── fixtures/
│   └── agent-fixtures.ts
└── utils/
    ├── test-database.ts
    ├── metrics-collector.ts
    └── datadog-test-reporter.ts
```

---

## Appendix B: Key Dependencies

```json
{
  "devDependencies": {
    "@playwright/test": "^1.54.2",
    "@testing-library/jest-dom": "^6.7.0",
    "@testing-library/react": "^16.3.0",
    "jest": "^30.0.4",
    "jest-environment-jsdom": "^30.0.4",
    "supertest": "^7.1.3",
    "testcontainers": "^11.3.1",
    "nock": "^14.0.0",
    "node-statsd": "^0.1.1",
    "ws": "^8.18.3"
  }
}
```

---

**Document Status**: Ready for Implementation
**Next Steps**: Review with team, prioritize test development, begin Phase 1 implementation
