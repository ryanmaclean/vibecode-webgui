# WebSocket Mock - Quick Examples

Production-grade examples for testing with WebSocket streaming client mock.

## Quick Start

```typescript
import { createMockWebSocketStreamingClient } from '../__mocks__/websocket-streaming-client'
import type { MockWebSocketStreamingClient } from '../__mocks__/websocket-streaming-client'

// Mock the module (before imports)
jest.mock('@/lib/streaming/websocket-streaming-client')

describe('My Test Suite', () => {
  let mockWSClient: MockWebSocketStreamingClient

  beforeEach(() => {
    mockWSClient = createMockWebSocketStreamingClient({
      defaultLatency: 50,
      autoConnect: false,
      autoComplete: true,
    })
  })

  // Your tests here...
})
```

---

## Example 1: Basic Connection Test

```typescript
it('should connect successfully', async () => {
  // Connect
  await mockWSClient.connect()

  // Verify connected
  expect(mockWSClient.isConnected()).toBe(true)
  expect(mockWSClient.connect).toHaveBeenCalled()
})
```

---

## Example 2: Request Completions

```typescript
it('should request completions successfully', async () => {
  await mockWSClient.connect()

  let receivedData: any = null

  const requestId = await mockWSClient.stream(
    { type: 'completion', position: { line: 1, column: 10 } },
    {
      onChunk: (chunk) => {
        receivedData = chunk.data
      },
      onComplete: () => {
        expect(receivedData).toBeDefined()
        expect(receivedData.completions).toHaveLength(1)
      }
    }
  )

  // Wait for auto-completion
  await new Promise(resolve => setTimeout(resolve, 100))

  expect(receivedData.completions[0].label).toBe('console.log')
})
```

---

## Example 3: Latency Testing

```typescript
it('should meet latency target (<300ms)', async () => {
  // Configure fast responses
  mockWSClient = createMockWebSocketStreamingClient({
    defaultLatency: 50 // 50ms
  })

  await mockWSClient.connect()

  const start = Date.now()

  await mockWSClient.stream(
    { type: 'completion' },
    {
      onChunk: () => {},
      onComplete: () => {}
    }
  )

  // Wait for completion
  await new Promise(resolve => setTimeout(resolve, 100))

  const latency = Date.now() - start
  expect(latency).toBeLessThan(300)
})
```

---

## Example 4: Concurrent Requests

```typescript
it('should handle multiple concurrent requests', async () => {
  await mockWSClient.connect()

  const handlers = {
    onChunk: jest.fn(),
    onComplete: jest.fn()
  }

  // Start 5 concurrent streams
  const promises = Array.from({ length: 5 }, () =>
    mockWSClient.stream({ type: 'completion' }, handlers)
  )

  const requestIds = await Promise.all(promises)

  expect(requestIds).toHaveLength(5)
  expect(mockWSClient.getActiveStreamCount()).toBe(5)

  // Wait for all to complete
  await new Promise(resolve => setTimeout(resolve, 100))

  expect(handlers.onComplete).toHaveBeenCalledTimes(5)
})
```

---

## Example 5: Error Handling

```typescript
it('should handle stream errors', async () => {
  // Disable auto-completion for manual control
  mockWSClient = createMockWebSocketStreamingClient({
    autoComplete: false
  })

  await mockWSClient.connect()

  const errorHandler = jest.fn()

  const requestId = await mockWSClient.stream(
    { type: 'test' },
    {
      onChunk: () => {},
      onError: errorHandler
    }
  )

  // Manually emit error
  mockWSClient._emit(requestId, 'error', {
    type: 'stream-error',
    requestId,
    error: {
      code: 'TEST_ERROR',
      message: 'Something went wrong',
      recoverable: false
    }
  })

  expect(errorHandler).toHaveBeenCalled()
  expect(errorHandler.mock.calls[0][0].error.code).toBe('TEST_ERROR')
})
```

---

## Example 6: Custom Stream Responses

```typescript
it('should handle custom stream response', async () => {
  // Disable auto-completion to control manually
  mockWSClient = createMockWebSocketStreamingClient({
    autoComplete: false
  })

  await mockWSClient.connect()

  const chunks: any[] = []

  const requestId = await mockWSClient.stream(
    { type: 'custom' },
    {
      onChunk: (chunk) => {
        chunks.push(chunk.data)
      },
      onComplete: () => {
        expect(chunks).toHaveLength(3)
      }
    }
  )

  // Emit multiple chunks
  mockWSClient._emit(requestId, 'chunk', {
    type: 'stream-chunk',
    requestId,
    sequence: 1,
    data: { text: 'First chunk' },
    timestamp: Date.now()
  })

  mockWSClient._emit(requestId, 'chunk', {
    type: 'stream-chunk',
    requestId,
    sequence: 2,
    data: { text: 'Second chunk' },
    timestamp: Date.now()
  })

  mockWSClient._emit(requestId, 'chunk', {
    type: 'stream-chunk',
    requestId,
    sequence: 3,
    data: { text: 'Third chunk' },
    timestamp: Date.now()
  })

  // Complete stream
  mockWSClient._emit(requestId, 'complete')

  expect(chunks).toHaveLength(3)
})
```

---

## Example 7: Disconnect Handling

```typescript
it('should handle disconnection', async () => {
  await mockWSClient.connect()

  const errorHandler = jest.fn()

  const requestId = await mockWSClient.stream(
    { type: 'test' },
    {
      onChunk: () => {},
      onError: errorHandler
    }
  )

  // Disconnect (should trigger error on active streams)
  mockWSClient.disconnect()

  expect(mockWSClient.isConnected()).toBe(false)
  expect(errorHandler).toHaveBeenCalled()
  expect(errorHandler.mock.calls[0][0].error.code).toBe('DISCONNECTED')
})
```

---

## Example 8: Stream Cancellation

```typescript
it('should cancel active stream', async () => {
  mockWSClient = createMockWebSocketStreamingClient({
    autoComplete: false // Don't auto-complete
  })

  await mockWSClient.connect()

  const requestId = await mockWSClient.stream(
    { type: 'test' },
    {
      onChunk: () => {},
      onComplete: jest.fn()
    }
  )

  expect(mockWSClient.getActiveStreamCount()).toBe(1)

  // Cancel stream
  await mockWSClient.cancelStream(requestId)

  expect(mockWSClient.getActiveStreamCount()).toBe(0)
})
```

---

## Example 9: Dependency Injection with Monaco

```typescript
import { MonacoAgentAPI } from '@/lib/editor/monaco-agentapi'

it('should inject mock into Monaco API', async () => {
  const mockEditor = {
    getModel: jest.fn(),
    // ... other editor methods
  } as any

  mockWSClient = createMockWebSocketStreamingClient()

  // Inject mock via constructor
  const api = new MonacoAgentAPI(
    mockEditor,
    {
      baseUrl: '/api/agents',
      wsUrl: '/api/agents/ws',
      completionTimeout: 300
    },
    mockWSClient as any // Dependency injection
  )

  await api.initialize()

  expect(mockWSClient.connect).toHaveBeenCalled()
})
```

---

## Example 10: Testing Stream Statistics

```typescript
it('should track stream statistics', async () => {
  await mockWSClient.connect()

  const requestId = await mockWSClient.stream(
    { type: 'test' },
    {
      onChunk: () => {}
    }
  )

  // Get stats
  const stats = mockWSClient.getStreamStats(requestId)

  expect(stats).toBeDefined()
  expect(stats?.chunkCount).toBeGreaterThanOrEqual(0)
  expect(stats?.duration).toBeGreaterThanOrEqual(0)
})
```

---

## Example 11: Testing Pause/Resume

```typescript
it('should pause and resume stream', async () => {
  await mockWSClient.connect()

  const requestId = await mockWSClient.stream(
    { type: 'test' },
    {
      onChunk: () => {}
    }
  )

  // Pause stream
  await mockWSClient.pauseStream(requestId)
  expect(mockWSClient.pauseStream).toHaveBeenCalledWith(requestId)

  // Resume stream
  await mockWSClient.resumeStream(requestId)
  expect(mockWSClient.resumeStream).toHaveBeenCalledWith(requestId)
})
```

---

## Example 12: Testing Different Request Types

```typescript
it('should handle different request types', async () => {
  await mockWSClient.connect()

  // Test completion request
  const completionData = await new Promise(resolve => {
    mockWSClient.stream(
      { type: 'completion' },
      {
        onChunk: (chunk) => resolve(chunk.data)
      }
    )
  })
  expect(completionData).toHaveProperty('completions')

  // Test hover request
  const hoverData = await new Promise(resolve => {
    mockWSClient.stream(
      { type: 'hover' },
      {
        onChunk: (chunk) => resolve(chunk.data)
      }
    )
  })
  expect(hoverData).toHaveProperty('hover')

  // Test code action request
  const actionData = await new Promise(resolve => {
    mockWSClient.stream(
      { type: 'codeAction' },
      {
        onChunk: (chunk) => resolve(chunk.data)
      }
    )
  })
  expect(actionData).toHaveProperty('actions')
})
```

---

## Configuration Tips

### Fast Tests (Low Latency)
```typescript
mockWSClient = createMockWebSocketStreamingClient({
  defaultLatency: 10, // 10ms for fast tests
  autoComplete: true
})
```

### Realistic Tests (Medium Latency)
```typescript
mockWSClient = createMockWebSocketStreamingClient({
  defaultLatency: 100, // 100ms for realistic behavior
  autoComplete: true
})
```

### Manual Control (No Auto-Complete)
```typescript
mockWSClient = createMockWebSocketStreamingClient({
  defaultLatency: 50,
  autoComplete: false // Manual control over events
})
```

### Pre-Connected Tests
```typescript
mockWSClient = createMockWebSocketStreamingClient({
  autoConnect: true // Already connected
})
```

---

## Common Patterns

### Setup/Teardown Pattern
```typescript
describe('My Test Suite', () => {
  let mockWSClient: MockWebSocketStreamingClient

  beforeEach(() => {
    mockWSClient = createMockWebSocketStreamingClient()
  })

  afterEach(() => {
    mockWSClient._reset() // Reset for next test
  })
})
```

### Waiting for Completion Pattern
```typescript
it('should complete', async () => {
  const completed = new Promise(resolve => {
    mockWSClient.stream(
      { type: 'test' },
      {
        onChunk: () => {},
        onComplete: resolve
      }
    )
  })

  await completed
  expect(true).toBe(true)
})
```

### Error Testing Pattern
```typescript
it('should handle errors', async () => {
  const error = await new Promise((_, reject) => {
    mockWSClient.stream(
      { type: 'test' },
      {
        onChunk: () => {},
        onError: reject
      }
    )
  }).catch(err => err)

  expect(error).toBeDefined()
})
```

---

## See Also

- `/tests/__mocks__/README-WEBSOCKET-MOCK.md` - Full documentation
- `/tests/unit/monaco-agentapi.test.ts` - Complete test suite
- `/AGENT-2-RALPH-LOOP-13-WEBSOCKET-MOCK-REPORT.md` - Implementation report
