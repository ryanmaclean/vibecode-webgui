# Real-Time Communication Quick Start Guide

**For Developers**: Fast implementation guide for optimized SSE and WebSocket clients

---

## When to Use What

### Use SSE (Optimized) When:
- ✅ One-way server → client streaming (AI responses, notifications)
- ✅ Simpler to implement and debug
- ✅ Better firewall/proxy compatibility
- ✅ Auto-reconnection is critical
- ✅ Text-based data (JSON)

### Use WebSocket (Optimized) When:
- ✅ Two-way client ↔ server communication
- ✅ Need to send commands to server
- ✅ Real-time collaboration features
- ✅ Binary data (files, images)
- ✅ Need flow control (pause/resume)

---

## SSE Client - Quick Start

### Basic Usage

```typescript
import { createOptimizedSSEClient } from '@/lib/streaming/optimized-sse-client'

const client = createOptimizedSSEClient(
  {
    url: '/api/agent/stream',
    method: 'POST',
    body: { query: 'Hello AI' }
  },
  {
    onMessage: (chunk) => {
      console.log('Received:', chunk.content)
    },
    onOpen: () => console.log('Connected!'),
    onError: (error) => console.error('Error:', error)
  }
)

client.connect()
```

### Production Configuration

```typescript
const client = createOptimizedSSEClient(
  {
    url: '/api/agent/stream',
    method: 'POST',

    // HTTP/2 multiplexing
    http2: {
      enabled: true,
      maxConcurrentStreams: 100
    },

    // Compression
    compression: {
      enabled: true,
      algorithm: 'brotli',
      threshold: 1024  // Compress >1KB
    },

    // Message batching
    batching: {
      enabled: true,
      windowMs: 50,        // Group every 50ms
      maxMessages: 100
    },

    // Flow control
    flowControl: {
      enabled: true,
      pauseThreshold: 0.8,
      resumeThreshold: 0.5
    },

    // Monitoring
    performanceMonitoring: {
      enabled: true,
      exportToPrometheus: true,
      metricsPrefix: 'my_app'
    }
  },
  {
    onMessage: (chunk) => {
      // Handle message
    }
  }
)

client.connect()
```

### Get Metrics

```typescript
const metrics = client.getEnhancedMetrics()

console.log({
  latencyP95: metrics.messageLatencyP95,
  throughput: metrics.throughputMsgPerSec,
  compression: metrics.compressionRatio,
  uptime: metrics.connectionUptime
})
```

---

## WebSocket Client - Quick Start

### Basic Usage

```typescript
import { createOptimizedWebSocketClient } from '@/lib/streaming/optimized-websocket-client'

const client = createOptimizedWebSocketClient(
  {
    url: 'ws://localhost:3000/agent'
  },
  {
    onChunk: (chunk) => {
      console.log('Chunk:', chunk.data)
    }
  }
)

await client.connect()

// Send message
const messageId = await client.sendOptimized({
  command: 'execute',
  data: { code: 'print("hello")' }
})
```

### Production Configuration

```typescript
const client = createOptimizedWebSocketClient(
  {
    url: 'ws://localhost:3000/agent',

    // Binary protocol (MessagePack)
    binaryProtocol: {
      enabled: true,
      threshold: 1024,
      fallbackToJSON: true
    },

    // Compression
    compression: {
      enabled: true,
      serverMaxWindowBits: 15,
      clientMaxWindowBits: 15
    },

    // Flow control
    flowControl: {
      enabled: true,
      highWaterMark: 1024 * 1024,  // 1MB
      backpressureStrategy: 'buffer'
    },

    // Monitoring
    performanceMonitoring: {
      enabled: true,
      exportToPrometheus: true,
      metricsPrefix: 'my_app_ws'
    }
  },
  {
    onChunk: (chunk) => {
      // Handle chunk
    },
    onComplete: () => {
      console.log('Stream complete')
    },
    onError: (error) => {
      console.error('Error:', error.error.message)
    }
  }
)

await client.connect()

// Send messages
await client.sendOptimized({ type: 'start' })
await client.sendOptimized({ type: 'data', payload: largeData })
await client.sendOptimized({ type: 'end' })
```

### Get Metrics

```typescript
const metrics = client.getMetrics()

console.log({
  sendLatencyP95: metrics.sendLatencyP95,
  rttP95: metrics.roundTripTimeP95,
  throughput: metrics.messagesSent / (Date.now() - startTime) * 1000,
  backpressure: metrics.backpressureEvents
})
```

---

## Common Patterns

### React Hook for SSE

```typescript
import { useEffect, useState, useRef } from 'react'
import { createOptimizedSSEClient } from '@/lib/streaming/optimized-sse-client'

function useSSEStream(url: string, body: any) {
  const [messages, setMessages] = useState<any[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const clientRef = useRef<any>(null)

  useEffect(() => {
    const client = createOptimizedSSEClient(
      { url, method: 'POST', body },
      {
        onMessage: (chunk) => {
          setMessages(prev => [...prev, chunk])
        },
        onOpen: () => setIsConnected(true),
        onClose: () => setIsConnected(false)
      }
    )

    client.connect()
    clientRef.current = client

    return () => {
      client.disconnect()
    }
  }, [url, body])

  return { messages, isConnected }
}

// Usage
function MyComponent() {
  const { messages, isConnected } = useSSEStream('/api/agent/stream', {
    query: 'Hello AI'
  })

  return (
    <div>
      {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      {messages.map((msg, i) => <div key={i}>{msg.content}</div>)}
    </div>
  )
}
```

### React Hook for WebSocket

```typescript
import { useEffect, useState, useRef, useCallback } from 'react'
import { createOptimizedWebSocketClient } from '@/lib/streaming/optimized-websocket-client'

function useWebSocket(url: string) {
  const [chunks, setChunks] = useState<any[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const clientRef = useRef<any>(null)

  useEffect(() => {
    const client = createOptimizedWebSocketClient(
      { url },
      {
        onChunk: (chunk) => {
          setChunks(prev => [...prev, chunk])
        },
        onStart: () => setIsConnected(true),
        onComplete: () => setIsConnected(false)
      }
    )

    client.connect().then(() => {
      clientRef.current = client
      setIsConnected(true)
    })

    return () => {
      client.disconnect()
    }
  }, [url])

  const sendMessage = useCallback(async (data: any) => {
    if (clientRef.current) {
      return await clientRef.current.sendOptimized(data)
    }
  }, [])

  return { chunks, isConnected, sendMessage }
}

// Usage
function MyComponent() {
  const { chunks, isConnected, sendMessage } = useWebSocket('ws://localhost:3000/agent')

  const handleSend = () => {
    sendMessage({ command: 'execute', data: 'console.log("hello")' })
  }

  return (
    <div>
      {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      <button onClick={handleSend}>Send Message</button>
      {chunks.map((chunk, i) => <div key={i}>{JSON.stringify(chunk.data)}</div>)}
    </div>
  )
}
```

---

## Performance Tuning

### For High Throughput (>10K msg/sec)

```typescript
{
  batching: {
    enabled: true,
    windowMs: 100,        // Larger window
    maxMessages: 500,     // More messages per batch
    maxBytes: 50 * 1024   // 50KB batches
  },
  performanceMonitoring: {
    enabled: true,
    sampleRate: 0.1       // Sample 10% to reduce overhead
  }
}
```

### For Low Latency (<50ms)

```typescript
{
  batching: {
    enabled: false         // Disable batching
  },
  compression: {
    enabled: false         // Disable compression
  },
  performanceMonitoring: {
    enabled: true,
    sampleRate: 1.0        // Full sampling for debugging
  }
}
```

### For Slow Networks

```typescript
{
  compression: {
    enabled: true,
    algorithm: 'brotli',
    level: 9,              // Maximum compression
    threshold: 512         // Compress smaller messages
  },
  batching: {
    enabled: true,
    windowMs: 200,         // Longer window
    maxMessages: 200
  }
}
```

---

## Monitoring

### Check Connection Health

```typescript
// SSE
const metrics = client.getEnhancedMetrics()
console.log({
  connected: client.isConnected(),
  state: client.getState(),
  uptime: metrics.connectionUptime,
  failedConnections: metrics.failedConnections
})

// WebSocket
const metrics = client.getMetrics()
console.log({
  connected: client.isConnected(),
  activeConnections: metrics.connectionsActive,
  failures: metrics.connectionFailures
})
```

### View Prometheus Metrics

```bash
# Metrics endpoint
curl http://localhost:9090/metrics | grep sse_client

# Examples:
# sse_client_connections_active
# sse_client_latency_p95_ms
# sse_client_throughput_msg_per_sec
# sse_client_messages_dropped
```

### Grafana Dashboard

Import from `/docs/monitoring/realtime-communication-dashboard.json`

Or access at: `http://localhost:3000/grafana/d/realtime-comm`

---

## Troubleshooting

### High Latency

```typescript
// Check metrics
const metrics = client.getEnhancedMetrics()
if (metrics.messageLatencyP95 > 100) {
  console.warn('High latency detected:', {
    p95: metrics.messageLatencyP95,
    batchLatency: metrics.batchLatency,
    compressionTime: metrics.compressionTime
  })

  // Solutions:
  // 1. Reduce batch window
  // 2. Reduce compression level
  // 3. Check network
}
```

### Connection Failures

```typescript
// Check failure rate
const metrics = client.getEnhancedMetrics()
const failureRate = metrics.failedConnections / metrics.connectionAttempts

if (failureRate > 0.05) {  // >5% failures
  console.error('High failure rate:', failureRate)

  // Solutions:
  // 1. Check server capacity
  // 2. Increase heartbeat timeout
  // 3. Check firewall/proxy
  // 4. Enable debug logging: { debug: true }
}
```

### Memory Issues

```typescript
// Check buffer usage
const metrics = client.getEnhancedMetrics()
if (metrics.bufferUsage > 0.8) {
  console.warn('High buffer usage:', metrics.bufferUsage)

  // Solutions:
  // 1. Reduce buffer size
  // 2. Enable message dropping
  // 3. Optimize message processing
  // 4. Enable flow control
}
```

### Backpressure

```typescript
// Check for backpressure events
const metrics = client.getMetrics()
if (metrics.backpressureEvents > 10) {
  console.warn('Frequent backpressure:', {
    events: metrics.backpressureEvents,
    buffered: metrics.bufferedMessages,
    dropped: metrics.droppedMessages
  })

  // Solutions:
  // 1. Optimize message processing speed
  // 2. Increase buffer thresholds
  // 3. Use batching to reduce processing overhead
  // 4. Scale consumer capacity
}
```

---

## Testing

### Unit Test Example

```typescript
import { createOptimizedSSEClient } from '@/lib/streaming/optimized-sse-client'

describe('SSE Client', () => {
  it('should connect and receive messages', async () => {
    const messages: any[] = []

    const client = createOptimizedSSEClient(
      { url: '/api/test', method: 'GET' },
      {
        onMessage: (chunk) => messages.push(chunk)
      }
    )

    client.connect()

    // Wait for messages
    await new Promise(resolve => setTimeout(resolve, 1000))

    expect(messages.length).toBeGreaterThan(0)
    expect(client.isConnected()).toBe(true)

    client.disconnect()
  })
})
```

### Performance Test Example

```typescript
import { benchmarkSSEClients } from '@/lib/streaming/optimized-sse-client'

test('should handle 100 concurrent connections', async () => {
  const results = await benchmarkSSEClients(
    {
      url: '/api/test',
      method: 'POST',
      performanceMonitoring: { enabled: true }
    },
    100,    // 100 clients
    5000    // 5 second test
  )

  expect(results.successfulConnections).toBeGreaterThanOrEqual(95)
  expect(results.p95Latency).toBeLessThan(100)
  expect(results.throughputMsgPerSec).toBeGreaterThan(1000)
})
```

---

## Environment Variables

```bash
# .env.local

# Prometheus
PROMETHEUS_PORT=9090
PROMETHEUS_ENDPOINT=/metrics
PROMETHEUS_HOST=0.0.0.0

# Testing
TEST_SSE_ENDPOINT=http://localhost:3000/api/test/sse
TEST_WS_ENDPOINT=ws://localhost:3000/api/test/ws
RUN_LOAD_TESTS=false          # Set true for load tests
LARGE_SCALE_TEST=false         # Set true for 10K+ tests

# Performance
MAX_CONNECTIONS=10000
HEARTBEAT_INTERVAL=30000
CONNECTION_TIMEOUT=30000
```

---

## Best Practices

### 1. Always Handle Errors

```typescript
const client = createOptimizedSSEClient(config, {
  onMessage: (chunk) => { /* handle */ },
  onError: (error) => {
    console.error('Stream error:', error)
    // Show user-friendly error
    // Log to monitoring
    // Attempt recovery
  }
})
```

### 2. Monitor Performance in Production

```typescript
// Enable monitoring
performanceMonitoring: {
  enabled: true,
  exportToPrometheus: true,
  sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0
}
```

### 3. Use Connection Pooling

```typescript
// WebSocket with connection pooling
import { globalWebSocketPool } from '@/lib/websocket-connection-pooling'

const client = createOptimizedWebSocketClient(
  config,
  handlers,
  globalWebSocketPool  // Reuse connections
)
```

### 4. Clean Up Connections

```typescript
useEffect(() => {
  const client = createOptimizedSSEClient(config, handlers)
  client.connect()

  return () => {
    client.disconnect()  // IMPORTANT: Always disconnect
  }
}, [])
```

### 5. Configure for Your Use Case

```typescript
// Real-time collaboration: Low latency
{ batching: { enabled: false }, compression: { enabled: false } }

// AI streaming: Optimize throughput
{ batching: { enabled: true, windowMs: 50 }, compression: { enabled: true } }

// Mobile/slow networks: Maximize compression
{ compression: { enabled: true, level: 9, threshold: 512 } }
```

---

## Further Reading

- [Full Implementation Report](/claudedocs/AGENT13_REALTIME_COMMUNICATION_REPORT.md)
- [Deliverables Summary](/claudedocs/AGENT13_DELIVERABLES_SUMMARY.md)
- [Performance Tests](/tests/performance/realtime-communication-benchmark.test.ts)
- [Grafana Dashboard](/docs/monitoring/realtime-communication-dashboard.json)

---

## Support

- **Slack**: #realtime-infra
- **Issues**: GitHub Issues with `streaming` label
- **Monitoring**: http://localhost:3000/grafana/d/realtime-comm
- **Metrics**: http://localhost:9090/metrics

---

**Quick Start Complete** - You're ready to build high-performance real-time features! 🚀
