# WebSocket Streaming Client Mock Infrastructure

Comprehensive mock infrastructure for testing Monaco Agent API and other WebSocket-based functionality.

## Overview

This mock infrastructure provides a production-grade WebSocket streaming client mock that:
- Supports full connection lifecycle (connect, disconnect)
- Provides realistic streaming behavior with configurable latency
- Handles events (onChunk, onComplete, onError, onStart)
- Supports concurrent requests
- Manages state (isConnected, connection state)

## Files Created

### 1. `websocket-streaming-client.ts`
Core mock factory and interface definition.

**Location**: `/tests/__mocks__/websocket-streaming-client.ts`

**Key Features**:
- `createMockWebSocketStreamingClient()` - Factory function
- Configurable latency (default: 50ms)
- Auto-completion of streams
- Event emission control
- State management

### 2. `@/lib/streaming/websocket-streaming-client.ts`
Jest mock module that intercepts imports of the real WebSocket client.

**Location**: `/tests/__mocks__/@/lib/streaming/websocket-streaming-client.ts`

**Key Features**:
- Automatic mock injection via Jest
- Test utilities (`__getMockInstance`, `__setMockInstance`, etc.)
- Type re-exports for compatibility

## Usage

### Basic Usage

```typescript
import { createMockWebSocketStreamingClient } from '../__mocks__/websocket-streaming-client'
import type { MockWebSocketStreamingClient } from '../__mocks__/websocket-streaming-client'

describe('MyComponent', () => {
  let mockWSClient: MockWebSocketStreamingClient

  beforeEach(() => {
    // Create fresh mock for each test
    mockWSClient = createMockWebSocketStreamingClient({
      defaultLatency: 50,
      autoConnect: false,
      autoComplete: true,
    })
  })

  it('should handle WebSocket connection', async () => {
    await mockWSClient.connect()

    expect(mockWSClient.isConnected()).toBe(true)
  })
})
```

### Dependency Injection Pattern

The mock is designed to work with dependency injection:

```typescript
import { MonacoAgentAPI } from '@/lib/editor/monaco-agentapi'

// Create mock
const mockWSClient = createMockWebSocketStreamingClient()

// Inject into API
const api = new MonacoAgentAPI(editor, config, mockWSClient as any)
```

### Custom Stream Responses

You can customize stream responses for specific test scenarios:

```typescript
beforeEach(() => {
  mockWSClient = createMockWebSocketStreamingClient({
    defaultLatency: 50,
    autoComplete: false, // Disable auto-completion
  })
})

it('should handle custom stream response', async () => {
  const requestId = await mockWSClient.stream({ type: 'custom' }, {
    onChunk: (chunk) => {
      expect(chunk.data).toBeDefined()
    },
    onComplete: () => {
      // Stream completed
    }
  })

  // Manually emit chunk
  mockWSClient._emit(requestId, 'chunk', {
    type: 'stream-chunk',
    requestId,
    sequence: 1,
    data: { custom: 'data' },
    timestamp: Date.now()
  })

  // Complete stream
  mockWSClient._emit(requestId, 'complete')
})
```

### Testing Latency

```typescript
it('should meet latency target (<300ms)', async () => {
  mockWSClient = createMockWebSocketStreamingClient({
    defaultLatency: 100, // 100ms response time
  })

  const start = Date.now()

  await mockWSClient.stream({ type: 'completion' }, {
    onChunk: (chunk) => {},
    onComplete: () => {}
  })

  // Wait for completion
  await new Promise(resolve => setTimeout(resolve, 200))

  const latency = Date.now() - start
  expect(latency).toBeLessThan(300)
})
```

### Testing Concurrent Requests

```typescript
it('should handle multiple concurrent requests', async () => {
  mockWSClient = createMockWebSocketStreamingClient({
    defaultLatency: 50,
  })

  const promises = [
    mockWSClient.stream({ type: 'completion' }, { onChunk: () => {} }),
    mockWSClient.stream({ type: 'hover' }, { onChunk: () => {} }),
    mockWSClient.stream({ type: 'codeAction' }, { onChunk: () => {} })
  ]

  const requestIds = await Promise.all(promises)

  expect(requestIds).toHaveLength(3)
  expect(mockWSClient.getActiveStreamCount()).toBe(3)
})
```

### Testing Error Handling

```typescript
it('should handle stream errors', async () => {
  mockWSClient = createMockWebSocketStreamingClient({
    autoComplete: false,
  })

  const errorHandler = jest.fn()

  const requestId = await mockWSClient.stream({ type: 'test' }, {
    onChunk: () => {},
    onError: errorHandler
  })

  // Emit error
  mockWSClient._emit(requestId, 'error', {
    type: 'stream-error',
    requestId,
    error: {
      code: 'TEST_ERROR',
      message: 'Test error message',
      recoverable: false
    }
  })

  expect(errorHandler).toHaveBeenCalled()
})
```

## Configuration Options

### `createMockWebSocketStreamingClient(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultLatency` | `number` | `50` | Simulated network latency in milliseconds |
| `autoConnect` | `boolean` | `false` | Auto-connect on creation |
| `autoComplete` | `boolean` | `true` | Auto-complete streams with default responses |

## Mock Methods

### Connection Methods

- `connect(): Promise<void>` - Connect to WebSocket server
- `disconnect(): void` - Disconnect from server

### Communication Methods

- `stream(payload, handlers): Promise<string>` - Start streaming request
- `cancelStream(requestId): Promise<void>` - Cancel active stream
- `pauseStream(requestId): Promise<void>` - Pause stream
- `resumeStream(requestId): Promise<void>` - Resume stream

### Query Methods

- `isConnected(): boolean` - Check connection status
- `getActiveStreamCount(): number` - Get number of active streams
- `getStreamStats(requestId): object | null` - Get stream statistics

### Test Utilities

- `_emit(requestId, event, data)` - Manually emit events to streams
- `_reset()` - Reset mock to initial state

## Default Stream Responses

The mock automatically generates appropriate responses based on payload type:

### Completion Request
```typescript
{
  completions: [
    {
      label: 'console.log',
      kind: 1,
      insertText: 'console.log()',
      detail: 'Log to console'
    }
  ]
}
```

### Hover Request
```typescript
{
  hover: {
    contents: [{ value: 'Variable information' }]
  }
}
```

### Code Action Request
```typescript
{
  actions: [
    {
      title: 'Quick fix',
      kind: { value: 'quickfix' }
    }
  ]
}
```

## Examples from Monaco Tests

### Test: Request Completions Successfully
```typescript
it('should request completions successfully', async () => {
  const completions = await agentAPI.requestCompletions(mockPosition, {
    triggerKind: 1,
  } as monaco.languages.CompletionContext)

  expect(completions).toEqual([
    {
      label: 'console.log',
      kind: 1,
      insertText: 'console.log()',
      detail: 'Log to console'
    }
  ])
  expect(mockWSClient.stream).toHaveBeenCalled()
})
```

### Test: Meet Latency Target
```typescript
it('should meet latency target (<300ms)', async () => {
  const startTime = Date.now()

  await agentAPI.requestCompletions(mockPosition, {
    triggerKind: 1,
  } as monaco.languages.CompletionContext)

  const latency = Date.now() - startTime

  expect(latency).toBeLessThan(300)
})
```

### Test: Handle Multiple Concurrent Requests
```typescript
it('should handle multiple concurrent requests', async () => {
  const requests = Array.from({ length: 5 }, () =>
    agentAPI.requestCompletions(mockPosition, {
      triggerKind: 1,
    } as monaco.languages.CompletionContext)
  )

  const results = await Promise.all(requests)

  expect(results).toHaveLength(5)
})
```

## Test Results

After implementing this mock infrastructure:

- **Total Tests**: 25
- **Passing**: 25 (100%)
- **Failed**: 0
- **Test Suite**: PASSED

### Test Coverage by Category

1. **Initialization Tests** (3/3 passing)
   - should initialize successfully
   - should setup event listeners
   - should handle initialization failure gracefully

2. **Context Extraction Tests** (6/6 passing)
   - should extract basic context
   - should extract selection
   - should extract imports from JavaScript code
   - should extract imports from Python code
   - should handle no selection
   - should handle no model

3. **Completion Tests** (4/4 passing)
   - should request completions successfully
   - should handle completion timeout
   - should meet latency target (<300ms)
   - should handle WebSocket disconnection

4. **Hover Tests** (2/2 passing)
   - should request hover information
   - should handle hover errors

5. **Code Actions Tests** (2/2 passing)
   - should request code actions
   - should handle code action errors

6. **Suggestion Application Tests** (2/2 passing)
   - should apply suggestion to editor
   - should handle no model

7. **Disposal Tests** (2/2 passing)
   - should dispose all resources
   - should handle multiple dispose calls

8. **Provider Registration Tests** (2/2 passing)
   - should register all providers
   - should dispose all providers

9. **Performance Tests** (2/2 passing)
   - should meet completion latency target
   - should handle multiple concurrent requests

## Benefits

1. **Realistic Behavior**: Simulates actual WebSocket streaming with configurable latency
2. **Full Control**: Tests can control every aspect of stream lifecycle
3. **Concurrent Support**: Handles multiple simultaneous streams
4. **Event-Driven**: Proper event handling with onChunk, onComplete, onError
5. **Type-Safe**: Full TypeScript support with proper types
6. **Isolated**: Each test gets a fresh mock instance
7. **Debuggable**: Clear logging and state inspection

## Future Enhancements

Potential improvements for the mock infrastructure:

1. **Reconnection Simulation**: Simulate connection drops and auto-reconnection
2. **Backpressure Testing**: Test pause/resume behavior
3. **Binary Data Support**: Test binary stream handling
4. **Compression**: Simulate WebSocket compression
5. **Protocol Validation**: Validate message protocol compliance

## Related Files

- `/src/lib/streaming/websocket-streaming-client.ts` - Real implementation
- `/src/lib/editor/monaco-agentapi.ts` - Monaco Agent API
- `/tests/unit/monaco-agentapi.test.ts` - Test suite using this mock

## Troubleshooting

### Mock not being used

Ensure Jest mock is declared before imports:
```typescript
jest.mock('@/lib/streaming/websocket-streaming-client')

import { MonacoAgentAPI } from '@/lib/editor/monaco-agentapi'
```

### Stream not completing

Check if `autoComplete` is enabled:
```typescript
mockWSClient = createMockWebSocketStreamingClient({
  autoComplete: true // Enable auto-completion
})
```

### Tests timing out

Reduce latency for faster tests:
```typescript
mockWSClient = createMockWebSocketStreamingClient({
  defaultLatency: 10 // Faster for tests
})
```

## Credits

Created by: Agent 2, Ralph Loop Iteration 13
Target: 100% test coverage for Monaco Agent API
Status: SUCCESS - All 25 tests passing
