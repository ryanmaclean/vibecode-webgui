# OpenAI Agents Troubleshooting Guide

**Version**: 1.0.0
**Last Updated**: 2025-10-02

## Table of Contents

1. [Common Issues](#common-issues)
2. [Connection Problems](#connection-problems)
3. [Performance Issues](#performance-issues)
4. [Error Codes](#error-codes)
5. [Debugging Tools](#debugging-tools)
6. [Advanced Diagnostics](#advanced-diagnostics)
7. [Known Issues](#known-issues)

---

## Common Issues

### Agent Won't Start

**Symptom**: Agent creation request fails immediately

**Possible Causes**:
1. Concurrent agent limit reached
2. Invalid workspace path
3. File permissions issues
4. Model not available
5. AgentAPI server not running

**Diagnostic Steps**:

```typescript
// 1. Check concurrent agents
const { stats } = useAgentStore();
console.log('Active agents:', stats.running);
console.log('Max allowed:', 5);

// 2. Verify workspace path
const workspace = '/home/coder/workspace/my-project';
console.log('Valid path:', workspace.startsWith('/home/coder/workspace'));

// 3. Check API server health
const health = await fetch('/api/agents/health');
const status = await health.json();
console.log('API status:', status.status);

// 4. Test file permissions
const testResponse = await fetch(`/api/workspace/check`, {
  method: 'POST',
  body: JSON.stringify({ path: workspace })
});
```

**Solutions**:

```typescript
// Solution 1: Wait for agent slots
if (stats.running >= 5) {
  // Stop inactive agents
  const inactiveAgents = Array.from(sessions.values())
    .filter(a => a.uptime_seconds > 3600);

  for (const agent of inactiveAgents) {
    await stopAgent(agent.agent_id);
  }
}

// Solution 2: Fix workspace path
const validWorkspace = workspace.startsWith('/home/coder/workspace')
  ? workspace
  : `/home/coder/workspace/${workspace.replace(/^\/+/, '')}`;

// Solution 3: Check AgentAPI service
// Run in terminal:
// curl http://localhost:3284/health
```

---

### Agent Stuck in Running State

**Symptom**: Agent shows "running" but no output for extended period

**Possible Causes**:
1. SSE connection lost
2. Agent process hung
3. Task complexity too high
4. Resource exhaustion

**Diagnostic Steps**:

```typescript
// 1. Check SSE connection
const agent = getAgent(agentId);
console.log('SSE connected:', agent.sse_connected);
console.log('Last output:', agent.last_output_at);
console.log('Time since output:', Date.now() - new Date(agent.last_output_at).getTime());

// 2. Check resource usage
console.log('CPU:', agent.resource_usage?.cpu_percent);
console.log('Memory:', agent.resource_usage?.memory_mb);
console.log('Uptime:', agent.uptime_seconds);

// 3. Test agent responsiveness
const pingResponse = await fetch(`/api/agents/${agentId}/ping`);
console.log('Agent responsive:', pingResponse.ok);
```

**Solutions**:

```typescript
// Solution 1: Reconnect SSE
eventSource.close();
const newEventSource = new EventSource(
  `/api/agents/${agentId}/events?from_sequence=${lastSequence}`
);

// Solution 2: Send interrupt signal
await fetch(`/api/agents/${agentId}/message`, {
  method: 'POST',
  body: JSON.stringify({
    message: 'Please provide status update',
    type: 'system'
  })
});

// Solution 3: Force restart
await stopAgent(agentId, true);
await restartAgent(agentId);

// Solution 4: Adjust timeout
// For long-running tasks, increase timeout in configuration
```

---

### Rate Limit Errors

**Symptom**: 429 status code responses

**Possible Causes**:
1. Too many concurrent agents
2. Message rate exceeded
3. Workspace quota exceeded
4. Global limit reached

**Diagnostic Steps**:

```typescript
// Check rate limit headers
const response = await fetch('/api/agents', { method: 'POST', ... });
const headers = response.headers;

console.log('Limit:', headers.get('X-RateLimit-Limit'));
console.log('Remaining:', headers.get('X-RateLimit-Remaining'));
console.log('Reset:', new Date(parseInt(headers.get('X-RateLimit-Reset')) * 1000));
console.log('Retry after:', headers.get('Retry-After'), 'seconds');
```

**Solutions**:

```typescript
// Solution 1: Implement backoff strategy
async function createAgentWithBackoff(config) {
  let retries = 0;
  const maxRetries = 5;

  while (retries < maxRetries) {
    try {
      return await startAgent(config);
    } catch (error) {
      if (error.status === 429) {
        const retryAfter = error.rateLimit?.['Retry-After'] || 60;
        const backoffDelay = Math.min(
          retryAfter * 1000 * Math.pow(2, retries),
          300000 // Max 5 minutes
        );

        console.log(`Rate limited. Retrying in ${backoffDelay}ms...`);
        await new Promise(r => setTimeout(r, backoffDelay));
        retries++;
      } else {
        throw error;
      }
    }
  }
}

// Solution 2: Queue requests
class AgentRequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private rateLimitDelay = 1000; // 1 second between requests

  async enqueue(fn: () => Promise<any>) {
    this.queue.push(fn);
    if (!this.processing) {
      await this.process();
    }
  }

  private async process() {
    this.processing = true;

    while (this.queue.length > 0) {
      const fn = this.queue.shift()!;
      try {
        await fn();
        await new Promise(r => setTimeout(r, this.rateLimitDelay));
      } catch (error) {
        console.error('Queue processing error:', error);
      }
    }

    this.processing = false;
  }
}

// Solution 3: Reduce concurrent agents
const activeAgents = getAgentsByStatus('running');
if (activeAgents.length >= 5) {
  // Stop oldest agent
  const oldest = activeAgents.sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )[0];
  await stopAgent(oldest.agent_id);
}
```

---

## Connection Problems

### SSE Connection Fails

**Symptom**: EventSource immediately errors or closes

**Diagnostic Steps**:

```typescript
const eventSource = new EventSource(`/api/agents/${agentId}/events`);

eventSource.onerror = (error) => {
  console.error('SSE Error:', error);
  console.log('Ready state:', eventSource.readyState);
  // 0 = CONNECTING, 1 = OPEN, 2 = CLOSED
};

// Test direct connection
fetch(`/api/agents/${agentId}/events`, {
  headers: { 'Accept': 'text/event-stream' }
}).then(async response => {
  console.log('Status:', response.status);
  console.log('Headers:', Object.fromEntries(response.headers));
  const body = await response.text();
  console.log('Body preview:', body.substring(0, 500));
});
```

**Solutions**:

```typescript
// Solution 1: Implement reconnection logic
function createResilientSSE(url, maxRetries = 10) {
  let retries = 0;
  let eventSource: EventSource | null = null;

  function connect() {
    eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.log('SSE connected');
      retries = 0; // Reset on successful connection
    };

    eventSource.onerror = () => {
      eventSource?.close();

      if (retries < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retries), 30000);
        console.log(`SSE error. Reconnecting in ${delay}ms...`);

        setTimeout(() => {
          retries++;
          connect();
        }, delay);
      } else {
        console.error('Max SSE reconnection attempts reached');
      }
    };

    return eventSource;
  }

  return connect();
}

// Solution 2: Check CORS and headers
// Ensure server sends proper SSE headers:
// Content-Type: text/event-stream
// Cache-Control: no-cache
// Connection: keep-alive

// Solution 3: Use WebSocket fallback
if (eventSource.readyState === EventSource.CLOSED) {
  const ws = new WebSocket(
    `ws://localhost:3000/api/agents/${agentId}/ws`,
    'agent-v1'
  );
  // Handle WebSocket messages
}
```

---

### WebSocket Connection Drops

**Symptom**: WebSocket closes unexpectedly

**Diagnostic Steps**:

```typescript
const ws = new WebSocket(url, 'agent-v1');

ws.onclose = (event) => {
  console.log('WebSocket closed');
  console.log('Code:', event.code);
  console.log('Reason:', event.reason);
  console.log('Clean close:', event.wasClean);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

// Common close codes:
// 1000 - Normal closure
// 1001 - Going away
// 1006 - Abnormal closure (no close frame)
// 1008 - Policy violation
// 1011 - Server error
```

**Solutions**:

```typescript
// Solution 1: Implement ping/pong
function keepAlive(ws: WebSocket, interval = 30000) {
  let timeout: NodeJS.Timeout;

  function heartbeat() {
    clearTimeout(timeout);

    timeout = setTimeout(() => {
      ws.send(JSON.stringify({ type: 'ping' }));

      // If no pong received in 5 seconds, reconnect
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }, 5000);
    }, interval);
  }

  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'pong') {
      heartbeat();
    }
  });

  ws.addEventListener('open', heartbeat);
  ws.addEventListener('close', () => clearTimeout(timeout));

  return () => clearTimeout(timeout);
}

// Solution 2: Automatic reconnection
class ResilientWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private messageQueue: any[] = [];

  constructor(url: string) {
    this.url = url;
    this.connect();
  }

  private connect() {
    this.ws = new WebSocket(this.url, 'agent-v1');

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;

      // Flush queued messages
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        this.send(message);
      }
    };

    this.ws.onclose = () => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        console.log(`Reconnecting in ${delay}ms...`);

        setTimeout(() => {
          this.reconnectAttempts++;
          this.connect();
        }, delay);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      // Queue message for when connection is restored
      this.messageQueue.push(data);
    }
  }

  close() {
    this.maxReconnectAttempts = 0; // Prevent reconnection
    this.ws?.close();
  }
}
```

---

## Performance Issues

### Slow Agent Responses

**Symptom**: Long delays between agent actions

**Diagnostic Steps**:

```typescript
// Monitor response times
const startTime = Date.now();
const response = await fetch(`/api/agents/${agentId}`);
const endTime = Date.now();
console.log('Response time:', endTime - startTime, 'ms');

// Check resource usage
const agent = await response.json();
console.log('CPU:', agent.resource_usage?.cpu_percent);
console.log('Memory:', agent.resource_usage?.memory_mb);

// Monitor event latency
let lastEventTime = Date.now();
eventSource.addEventListener('output', () => {
  const now = Date.now();
  console.log('Event latency:', now - lastEventTime, 'ms');
  lastEventTime = now;
});
```

**Solutions**:

```typescript
// Solution 1: Optimize file selection
// Reduce number of files agent needs to process
const essentialFiles = files.filter(f =>
  f.includes('main') || f.includes('core')
);

await startAgent({
  ...config,
  files: essentialFiles // Only include essential files
});

// Solution 2: Use faster model
// Switch from Claude to GPT-4o for faster responses
model: 'gpt-4o' // vs 'claude-3-5-sonnet-20241022'

// Solution 3: Enable response caching
const cache = new Map<string, any>();

async function getCachedAgentStatus(agentId: string) {
  const cached = cache.get(agentId);

  if (cached && Date.now() - cached.timestamp < 5000) {
    return cached.data;
  }

  const data = await fetchAgentStatus(agentId);
  cache.set(agentId, { data, timestamp: Date.now() });
  return data;
}

// Solution 4: Batch operations
// Instead of multiple individual requests
const agentIds = ['agent-1', 'agent-2', 'agent-3'];
const statuses = await Promise.all(
  agentIds.map(id => fetchAgentStatus(id))
);
```

---

### Memory Leaks

**Symptom**: Increasing memory usage over time

**Diagnostic Steps**:

```typescript
// Monitor store size
const { sessions } = useAgentStore();
console.log('Active sessions:', sessions.size);
console.log('Memory usage:', process.memoryUsage());

// Check for unclosed connections
let activeConnections = 0;
const originalEventSource = window.EventSource;

window.EventSource = function(...args) {
  activeConnections++;
  const es = new originalEventSource(...args);

  const originalClose = es.close.bind(es);
  es.close = function() {
    activeConnections--;
    originalClose();
  };

  return es;
};

console.log('Active SSE connections:', activeConnections);
```

**Solutions**:

```typescript
// Solution 1: Cleanup on unmount
useEffect(() => {
  const eventSource = new EventSource(url);

  return () => {
    eventSource.close(); // Always cleanup
  };
}, [url]);

// Solution 2: Periodic cleanup
const { clearCompleted } = useAgentStore();

useEffect(() => {
  const interval = setInterval(() => {
    clearCompleted(); // Remove completed agents
  }, 300000); // Every 5 minutes

  return () => clearInterval(interval);
}, []);

// Solution 3: Limit store size
const MAX_SESSIONS = 50;

if (sessions.size > MAX_SESSIONS) {
  // Remove oldest completed agents
  const sortedSessions = Array.from(sessions.values())
    .filter(s => s.status === 'completed')
    .sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  const toRemove = sortedSessions.slice(0, sessions.size - MAX_SESSIONS);
  toRemove.forEach(s => removeAgent(s.agent_id));
}
```

---

## Error Codes

### HTTP Error Codes

| Code | Type | Description | Action |
|------|------|-------------|--------|
| 400 | Validation Error | Invalid request data | Fix request body |
| 401 | Unauthorized | Authentication required | Login again |
| 403 | Forbidden | Insufficient permissions | Check user roles |
| 404 | Not Found | Agent not found | Verify agent ID |
| 409 | Conflict | Agent already exists | Use different ID |
| 429 | Rate Limit | Too many requests | Implement backoff |
| 500 | Server Error | Internal error | Check logs, retry |
| 502 | Bad Gateway | AgentAPI server down | Check service status |
| 503 | Service Unavailable | Temporary outage | Retry later |
| 504 | Gateway Timeout | Request timeout | Increase timeout |

### Agent Status Codes

| Status | Description | Next Action |
|--------|-------------|-------------|
| running | Agent actively working | Monitor output |
| completed | Task finished successfully | Review results |
| failed | Task failed with error | Check error logs |
| stopped | Manually stopped by user | N/A |
| error | System error occurred | Check diagnostics |

---

## Debugging Tools

### Enable Debug Logging

```typescript
// Enable detailed logging
localStorage.setItem('debug', 'agent:*');

// Logs will show:
// agent:store Starting agent...
// agent:api POST /api/agents
// agent:sse Connected to stream
// agent:ws WebSocket opened
```

### Browser DevTools

```javascript
// Monitor all agent API calls
const originalFetch = window.fetch;
window.fetch = async function(...args) {
  const [url] = args;
  if (url.includes('/api/agents')) {
    console.log('[Agent API]', args[0], args[1]);
  }
  const response = await originalFetch(...args);
  console.log('[Agent API Response]', response.status, response.statusText);
  return response;
};
```

### Store Debugging

```typescript
// Subscribe to store changes
useAgentStore.subscribe(
  (state) => state.sessions,
  (sessions, prevSessions) => {
    console.log('Sessions changed:', {
      before: prevSessions.size,
      after: sessions.size,
      diff: sessions.size - prevSessions.size
    });
  }
);

// Export store state
function exportStoreState() {
  const state = useAgentStore.getState();
  const json = JSON.stringify({
    sessions: Array.from(state.sessions.entries()),
    stats: state.stats,
    errors: Array.from(state.errors.entries())
  }, null, 2);

  console.log(json);
  // Or download as file
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'agent-store-state.json';
  a.click();
}
```

---

## Advanced Diagnostics

### Network Inspection

```bash
# Monitor AgentAPI server
curl http://localhost:3284/health

# Check agent status directly
curl http://localhost:3284/v1/agents/{agent_id}/status

# View metrics
curl http://localhost:3284/metrics
```

### Log Analysis

```typescript
// Collect diagnostic information
async function collectDiagnostics(agentId: string) {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    agent: await fetchAgentStatus(agentId),
    system: {
      userAgent: navigator.userAgent,
      memory: performance.memory,
      connection: navigator.connection
    },
    store: {
      sessions: useAgentStore.getState().sessions.size,
      stats: useAgentStore.getState().stats
    },
    network: {
      // Test connectivity
      apiHealth: await fetch('/api/agents/health').then(r => r.ok),
      agentApiHealth: await fetch('http://localhost:3284/health').then(r => r.ok)
    }
  };

  console.log('Diagnostics:', diagnostics);
  return diagnostics;
}
```

---

## Known Issues

### Issue: Agent process orphaned after parent dies

**Impact**: Agent continues running after browser closed

**Workaround**: Implement server-side cleanup

```typescript
// Set up cleanup job
setInterval(async () => {
  const allAgents = await fetchAllAgents();
  const staleAgents = allAgents.filter(agent =>
    Date.now() - new Date(agent.last_output_at).getTime() > 3600000 // 1 hour
  );

  for (const agent of staleAgents) {
    await stopAgent(agent.agent_id, true);
  }
}, 600000); // Every 10 minutes
```

### Issue: SSE connection limit in browser

**Impact**: Browser limits concurrent SSE connections (6 per domain)

**Workaround**: Use WebSocket for new connections when limit reached

```typescript
let sseConnections = 0;
const MAX_SSE_CONNECTIONS = 5;

function connectToAgent(agentId: string) {
  if (sseConnections >= MAX_SSE_CONNECTIONS) {
    // Use WebSocket instead
    return new WebSocket(`ws://localhost:3000/api/agents/${agentId}/ws`);
  } else {
    sseConnections++;
    const es = new EventSource(`/api/agents/${agentId}/events`);
    es.addEventListener('close', () => sseConnections--);
    return es;
  }
}
```

---

## Support Resources

- **GitHub Issues**: Report bugs at https://github.com/vibecode/issues
- **Documentation**: https://docs.vibecode.com/agents
- **Community Discord**: https://discord.gg/vibecode
- **Email Support**: support@vibecode.com

## Next Steps

- [User Guide](./01-USER-GUIDE.md) - Getting started
- [API Reference](./02-API-REFERENCE.md) - Complete API docs
- [FAQ](./07-FAQ.md) - Frequently asked questions
