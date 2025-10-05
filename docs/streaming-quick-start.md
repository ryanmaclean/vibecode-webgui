# Streaming Protocol Quick Start Guide

Quick reference for integrating SSE and WebSocket streaming in the Vibecode platform.

## When to Use Which Protocol

| Use Case | Protocol | Why |
|----------|----------|-----|
| AI chat text streaming | SSE | Unidirectional, simple, firewall-friendly |
| Real-time status updates | SSE | Event-driven, automatic reconnection |
| Interactive debugging | WebSocket | Bidirectional, send commands |
| File upload progress | SSE | Server → client updates only |
| Collaborative editing | WebSocket | Already implemented with Yjs |
| Agent → UI notifications | SSE | One-way communication |

## SSE Client - 5 Minute Integration

### Step 1: Import
```typescript
import { createSSEClient } from '@/lib/streaming/sse-client'
```

### Step 2: Create Client
```typescript
const client = createSSEClient(
  {
    url: '/api/your-endpoint',
    method: 'POST', // or 'GET'
    body: { /* your request data */ }
  },
  {
    onMessage: (chunk) => {
      // Handle each message chunk
      console.log('Received:', chunk)
    },
    onOpen: () => console.log('Connected'),
    onError: (error) => console.error('Error:', error)
  }
)
```

### Step 3: Connect
```typescript
client.connect()

// Later, disconnect
client.disconnect()
```

### Step 4: Monitor (Optional)
```typescript
// Get real-time metrics
const metrics = client.getMetrics()
console.log('Latency:', metrics.averageLatency)
console.log('Messages:', metrics.totalMessages)
console.log('Uptime:', metrics.connectionUptime)
```

## React Hook Usage

```tsx
import { useSSEStream } from '@/hooks/useSSEStream'

function MyComponent() {
  const { messages, state, metrics, isConnected } = useSSEStream(
    '/api/stream',
    { prompt: 'Hello AI' },
    true // auto-connect
  )

  return (
    <div>
      <div>Status: {state}</div>
      <div>Messages: {messages.length}</div>
      {messages.map((msg, i) => <p key={i}>{msg}</p>)}
    </div>
  )
}
```

## Configuration Options

### Reconnection
```typescript
reconnection: {
  initialDelay: 1000,      // First retry after 1s
  maxDelay: 30000,         // Cap at 30s
  maxAttempts: Infinity,   // Never give up
  backoffMultiplier: 2.0,  // Double delay each time
  jitter: true            // Randomize ±25%
}
```

### Buffering
```typescript
buffer: {
  maxSize: 1000,                     // Max 1000 messages
  strategy: 'drop-oldest',           // When full, drop old
  warningThreshold: 0.8,             // Warn at 80% full
  onBufferWarning: (usage) => {
    console.warn(`Buffer ${usage * 100}% full`)
  }
}
```

### Debugging
```typescript
{
  url: '/api/stream',
  debug: true,  // Enable console logging
  heartbeatTimeout: 60000  // Reconnect if no data for 60s
}
```

## WebSocket Streaming

```typescript
import { createWebSocketStreamingClient } from '@/lib/streaming/websocket-streaming-client'
import { globalWebSocketPool } from '@/lib/websocket-connection-pooling'

const client = createWebSocketStreamingClient(
  { url: 'ws://localhost:3000/api/stream' },
  globalWebSocketPool
)

await client.connect()

const streamId = await client.stream(
  { command: 'process', data: myData },
  {
    onChunk: (chunk) => console.log('Chunk:', chunk),
    onComplete: () => console.log('Done'),
    onError: (err) => console.error('Error:', err)
  }
)

// Control stream
await client.pauseStream(streamId)
await client.resumeStream(streamId)
await client.cancelStream(streamId)
```

## Server-Side Setup

### SSE Endpoint Example
```typescript
// app/api/your-endpoint/route.ts
export async function POST(req: NextRequest) {
  const body = await req.json()

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send chunks
        for (let i = 0; i < 10; i++) {
          const message = {
            type: 'content',
            content: `Chunk ${i}`
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(message)}\n\n`)
          )

          await sleep(100)
        }

        // Signal completion
        controller.enqueue(
          encoder.encode(`data: {"done":true}\n\n`)
        )

        controller.close()
      } catch (error) {
        controller.error(error)
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
```

## Testing

### Unit Test Your Integration
```typescript
import { createSSEClient } from '@/lib/streaming/sse-client'

test('should receive messages', async () => {
  const messages: string[] = []

  const client = createSSEClient(
    { url: '/api/test' },
    { onMessage: (chunk) => messages.push(chunk.content) }
  )

  client.connect()

  // Wait for messages
  await new Promise(resolve => setTimeout(resolve, 2000))

  expect(messages.length).toBeGreaterThan(0)

  client.disconnect()
})
```

### E2E Test with Playwright
```typescript
test('should stream in browser', async ({ page }) => {
  await page.goto('/your-page')
  await page.click('#start-stream')

  // Wait for connection
  await page.waitForFunction(() => {
    return window.__streamConnected === true
  })

  // Verify messages received
  const count = await page.evaluate(() => window.__messageCount)
  expect(count).toBeGreaterThan(0)
})
```

## Common Patterns

### Pattern 1: AI Chat Streaming
```typescript
const streamAIResponse = async (prompt: string) => {
  const client = createSSEClient(
    {
      url: '/api/ai/chat/stream',
      method: 'POST',
      body: { message: prompt, model: 'gpt-4' }
    },
    {
      onMessage: (chunk) => {
        if (chunk.type === 'content') {
          appendToUI(chunk.content)
        }
      },
      onComplete: () => {
        enableSendButton()
      }
    }
  )

  client.connect()
  return client
}
```

### Pattern 2: Progress Monitoring
```typescript
const monitorProgress = async (taskId: string) => {
  const client = createSSEClient(
    { url: `/api/tasks/${taskId}/progress` },
    {
      onMessage: (chunk) => {
        if (chunk.type === 'metadata') {
          const progress = chunk.metadata.progress as number
          updateProgressBar(progress)

          if (progress >= 100) {
            client.disconnect()
          }
        }
      }
    }
  )

  client.connect()
}
```

### Pattern 3: Real-time Notifications
```typescript
const subscribeToNotifications = () => {
  const client = createSSEClient(
    { url: '/api/notifications/stream' },
    {
      onMessage: (chunk) => {
        if (chunk.type === 'metadata') {
          showToast(chunk.metadata.message as string)
        }
      },
      onReconnecting: (attempt) => {
        if (attempt > 3) {
          showReconnectionWarning()
        }
      }
    }
  )

  client.connect()

  // Keep alive for session
  return () => client.disconnect()
}
```

## Performance Tips

1. **Use POST for auth headers**: GET EventSource can't send custom headers
2. **Enable HTTP/2**: Removes 6 connection limit per domain
3. **Set appropriate heartbeat**: 30-60s is good default
4. **Buffer size matters**: 1000 messages ≈ 100KB typical
5. **Monitor metrics**: Track latency and reconnection rate

## Troubleshooting

### Messages not arriving
- Check network tab for SSE connection
- Verify server sends `Content-Type: text/event-stream`
- Ensure messages end with `\n\n`
- Check CORS headers if cross-origin

### High reconnection rate
- Increase heartbeat timeout
- Check server stability
- Verify network quality
- Look for firewall issues

### Memory leaks
- Always call `client.disconnect()` on unmount
- Clear buffer periodically if needed
- Don't keep too many simultaneous streams

### Browser compatibility
- Safari <14: May hit connection limit, use HTTP/2
- Mobile Safari: Reconnect on app focus
- Firefox: Ensure CORS headers correct

## Next Steps

1. Read full analysis: `claudedocs/streaming-protocol-analysis.md`
2. Review examples: `claudedocs/streaming-implementation-summary.md`
3. Run tests: `npm run test:unit -- tests/unit/streaming/`
4. Load test: `npm run test:streaming-benchmark`

## Support

- Documentation: `/docs/streaming-quick-start.md`
- Implementation: Agent 5 (Streaming Protocol Engineer)
- Questions: See `claudedocs/` for detailed guides
