# OpenAI Agents Migration Guide

**Version**: 1.0.0
**Last Updated**: 2025-10-02
**From**: Legacy AgentAPI
**To**: OpenAI Agents API v1.0

## Table of Contents

1. [Migration Overview](#migration-overview)
2. [Breaking Changes](#breaking-changes)
3. [API Mapping](#api-mapping)
4. [Code Examples](#code-examples)
5. [Migration Checklist](#migration-checklist)
6. [Rollback Plan](#rollback-plan)

---

## Migration Overview

### What's Changing

The OpenAI Agents API v1.0 introduces a unified interface for managing AI coding agents with improved type safety, better error handling, and enhanced real-time capabilities.

### Migration Timeline

- **Phase 1 (Current)**: Legacy and new API coexist
- **Phase 2 (30 days)**: New API recommended, legacy deprecated
- **Phase 3 (90 days)**: Legacy API disabled, new API required

### Compatibility

- **Backward Compatible**: Legacy endpoints remain functional during transition
- **Feature Parity**: All legacy features available in new API
- **Enhanced Features**: New API adds SSE streaming, WebSocket support, improved error handling

---

## Breaking Changes

### 1. Endpoint Structure

**Legacy:**
```
POST /api/code-server/agent/start
GET /api/code-server/agent/status/:id
DELETE /api/code-server/agent/stop/:id
```

**New:**
```
POST /api/agents
GET /api/agents/:agentId
DELETE /api/agents/:agentId
```

### 2. Request/Response Format

**Legacy Request:**
```json
{
  "type": "aider",
  "workspace_path": "/workspace/project",
  "file_list": ["main.py"],
  "llm_model": "claude-sonnet",
  "task_description": "Add tests"
}
```

**New Request:**
```json
{
  "agent_type": "aider",
  "workspace": "/home/coder/workspace/project",
  "files": ["main.py"],
  "model": "claude-3-5-sonnet-20241022",
  "task": "Add tests"
}
```

**Legacy Response:**
```json
{
  "success": true,
  "agent_id": "aider_abc123",
  "terminal_id": "term_xyz",
  "status": "started"
}
```

**New Response:**
```json
{
  "agent_id": "aider-abc12345",
  "status": "running",
  "terminal_id": "term_xyz",
  "pid": 12345,
  "created_at": "2025-10-02T10:30:00Z",
  "stream_url": "/api/agents/aider-abc12345/events",
  "ws_url": "ws://localhost:3000/api/agents/aider-abc12345/ws"
}
```

### 3. Error Format

**Legacy:**
```json
{
  "success": false,
  "error": "Invalid workspace path",
  "code": "INVALID_PATH"
}
```

**New (RFC 7807):**
```json
{
  "type": "https://vibecode.com/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Invalid workspace path: must start with /home/coder/workspace",
  "instance": "/api/agents",
  "trace_id": "abc123-def456"
}
```

### 4. Agent ID Format

**Legacy:**
```
aider_abc123
goose_def456
```

**New:**
```
aider-abc12345  (type-hex8)
goose-def45678
```

### 5. Status Values

**Legacy:**
```
started | running | complete | error | stopped
```

**New:**
```
running | completed | failed | stopped | error
```

---

## API Mapping

### Start Agent

**Legacy:**
```typescript
const response = await fetch('/api/code-server/agent/start', {
  method: 'POST',
  body: JSON.stringify({
    type: 'aider',
    workspace_path: '/workspace/my-project',
    file_list: ['src/main.py'],
    llm_model: 'claude-sonnet',
    task_description: 'Add error handling'
  })
});
```

**New:**
```typescript
const response = await fetch('/api/agents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    agent_type: 'aider',
    workspace: '/home/coder/workspace/my-project',
    files: ['src/main.py'],
    model: 'claude-3-5-sonnet-20241022',
    task: 'Add error handling'
  })
});
```

### Get Agent Status

**Legacy:**
```typescript
const response = await fetch(`/api/code-server/agent/status/${agentId}`);
const data = await response.json();

if (data.success) {
  console.log('Status:', data.status);
}
```

**New:**
```typescript
const response = await fetch(`/api/agents/${agentId}`);

if (response.ok) {
  const agent = await response.json();
  console.log('Status:', agent.status);
  console.log('Uptime:', agent.uptime_seconds);
  console.log('CPU:', agent.resource_usage?.cpu_percent);
}
```

### Stop Agent

**Legacy:**
```typescript
const response = await fetch(`/api/code-server/agent/stop/${agentId}`, {
  method: 'DELETE'
});
```

**New:**
```typescript
// Graceful stop
const response = await fetch(`/api/agents/${agentId}`, {
  method: 'DELETE'
});

// Force stop
const response = await fetch(`/api/agents/${agentId}?force=true`, {
  method: 'DELETE'
});
```

### List Agents

**Legacy:**
```typescript
const response = await fetch('/api/code-server/agent/list');
const data = await response.json();

const agents = data.agents; // Simple array
```

**New:**
```typescript
const response = await fetch('/api/agents?status=running&limit=50');
const data = await response.json();

const agents = data.agents; // Array with pagination
console.log('Total:', data.pagination.total);
console.log('Pages:', data.pagination.pages);
console.log('Summary:', data.summary);
```

---

## Code Examples

### Using Legacy Store

**Before:**
```typescript
import { useCodeServerStore } from '@/stores/codeServerStore';

function AgentManager() {
  const { startAgent, agents } = useCodeServerStore();

  const handleStart = async () => {
    const result = await startAgent({
      type: 'aider',
      workspace_path: '/workspace/project',
      file_list: ['main.py'],
      llm_model: 'claude-sonnet',
      task_description: 'Add tests'
    });

    if (result.success) {
      console.log('Agent started:', result.agent_id);
    } else {
      console.error('Error:', result.error);
    }
  };

  return (
    <div>
      {agents.map(agent => (
        <div key={agent.id}>{agent.status}</div>
      ))}
    </div>
  );
}
```

**After:**
```typescript
import { useAgentStore } from '@/stores/agentStore';

function AgentManager() {
  const { startAgent } = useAgentStore();
  const agents = useAgentStore(state => Array.from(state.sessions.values()));

  const handleStart = async () => {
    try {
      const agent = await startAgent({
        agent_type: 'aider',
        workspace: '/home/coder/workspace/project',
        files: ['main.py'],
        model: 'claude-3-5-sonnet-20241022',
        task: 'Add tests'
      });

      console.log('Agent started:', agent.agent_id);
    } catch (error) {
      console.error('Error:', error.problem?.detail || error.message);
    }
  };

  return (
    <div>
      {agents.map(agent => (
        <div key={agent.agent_id}>
          {agent.status} - {agent.progress}%
        </div>
      ))}
    </div>
  );
}
```

### Polling to SSE Migration

**Before (Polling):**
```typescript
function MonitorAgent({ agentId }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/code-server/agent/status/${agentId}`);
      const data = await response.json();

      if (data.success) {
        setStatus(data.status);

        if (data.status === 'complete') {
          clearInterval(interval);
        }
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [agentId]);

  return <div>Status: {status}</div>;
}
```

**After (SSE):**
```typescript
function MonitorAgent({ agentId }) {
  const agent = useAgentStore(state => state.sessions.get(agentId));

  useEffect(() => {
    const eventSource = new EventSource(`/api/agents/${agentId}/events`);

    eventSource.addEventListener('output', (event) => {
      const data = JSON.parse(event.data);
      console.log('[Agent]:', data.line);
    });

    eventSource.addEventListener('status', (event) => {
      const data = JSON.parse(event.data);
      useAgentStore.getState().updateAgentStatus(
        agentId,
        data.status,
        data.progress
      );
    });

    eventSource.addEventListener('complete', () => {
      eventSource.close();
    });

    return () => eventSource.close();
  }, [agentId]);

  return (
    <div>
      Status: {agent?.status}
      Progress: {(agent?.progress || 0) * 100}%
    </div>
  );
}
```

### Error Handling Migration

**Before:**
```typescript
try {
  const response = await fetch('/api/code-server/agent/start', {
    method: 'POST',
    body: JSON.stringify(config)
  });

  const data = await response.json();

  if (!data.success) {
    switch (data.code) {
      case 'INVALID_PATH':
        console.error('Invalid path');
        break;
      case 'MAX_AGENTS':
        console.error('Too many agents');
        break;
      default:
        console.error(data.error);
    }
  }
} catch (error) {
  console.error('Network error:', error);
}
```

**After:**
```typescript
try {
  const response = await fetch('/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });

  if (!response.ok) {
    const problem = await response.json();

    // RFC 7807 Problem Details
    switch (response.status) {
      case 400:
        console.error('Validation error:', problem.detail);
        if (problem.errors) {
          console.error('Fields:', problem.errors);
        }
        break;

      case 429:
        console.error('Rate limited:', problem.detail);
        const retryAfter = response.headers.get('Retry-After');
        console.log('Retry in:', retryAfter, 'seconds');
        break;

      default:
        console.error('Error:', problem.title, problem.detail);
        console.log('Trace ID:', problem.trace_id);
    }

    return;
  }

  const agent = await response.json();
  console.log('Success:', agent.agent_id);
} catch (error) {
  console.error('Network error:', error);
}
```

---

## Migration Checklist

### Phase 1: Preparation (Week 1)

- [ ] Review breaking changes documentation
- [ ] Audit existing agent usage in codebase
- [ ] Identify all API call locations
- [ ] Create migration branch
- [ ] Set up parallel testing environment

### Phase 2: Update Dependencies (Week 1)

- [ ] Update type definitions
  ```bash
  # Ensure latest types
  npm install --save-dev @types/agent-api@latest
  ```

- [ ] Update store imports
  ```typescript
  // Old
  import { useCodeServerStore } from '@/stores/codeServerStore';

  // New
  import { useAgentStore } from '@/stores/agentStore';
  ```

- [ ] Install new agent SDK (if using)
  ```bash
  npm install @vibecode/agent-sdk@latest
  ```

### Phase 3: Code Migration (Week 2-3)

- [ ] Update all API endpoints
  - [ ] Agent start calls
  - [ ] Agent status calls
  - [ ] Agent stop calls
  - [ ] Agent list calls

- [ ] Migrate request/response handling
  - [ ] Update request body structure
  - [ ] Update response parsing
  - [ ] Handle new error format

- [ ] Replace polling with SSE
  - [ ] Remove setInterval polling
  - [ ] Implement EventSource
  - [ ] Add reconnection logic

- [ ] Update agent ID references
  - [ ] Change ID format handling
  - [ ] Update URL construction
  - [ ] Update database queries

### Phase 4: Testing (Week 3-4)

- [ ] Unit tests
  - [ ] Store tests
  - [ ] API client tests
  - [ ] Component tests

- [ ] Integration tests
  - [ ] End-to-end flows
  - [ ] Error scenarios
  - [ ] Rate limiting

- [ ] Performance tests
  - [ ] Response time comparison
  - [ ] Memory usage
  - [ ] Connection stability

### Phase 5: Deployment (Week 4)

- [ ] Deploy to staging
- [ ] Monitor for errors
- [ ] Verify all features work
- [ ] Deploy to production
- [ ] Monitor production metrics

---

## Rollback Plan

### If Migration Issues Occur

1. **Immediate Rollback**
   ```bash
   # Revert to legacy API
   git checkout previous-stable-commit
   npm run build
   npm run deploy
   ```

2. **Partial Rollback**
   ```typescript
   // Feature flag to toggle between APIs
   const USE_NEW_AGENT_API = process.env.NEXT_PUBLIC_NEW_AGENT_API === 'true';

   const agentStore = USE_NEW_AGENT_API
     ? useAgentStore
     : useCodeServerStore;
   ```

3. **Gradual Rollout**
   ```typescript
   // Roll out to percentage of users
   const useNewAPI = Math.random() < 0.1; // 10% of users

   if (useNewAPI) {
     return useAgentStore();
   } else {
     return useCodeServerStore();
   }
   ```

### Data Migration Rollback

If agent data needs to be reverted:

```typescript
// Backup before migration
async function backupAgentData() {
  const agents = await fetch('/api/code-server/agent/list').then(r => r.json());

  await fs.writeFile(
    'agent-backup.json',
    JSON.stringify(agents, null, 2)
  );
}

// Restore if needed
async function restoreAgentData() {
  const backup = JSON.parse(
    await fs.readFile('agent-backup.json', 'utf8')
  );

  for (const agent of backup.agents) {
    await fetch('/api/code-server/agent/start', {
      method: 'POST',
      body: JSON.stringify(agent)
    });
  }
}
```

---

## Post-Migration

### Cleanup (After 90 days)

1. **Remove Legacy Code**
   ```bash
   # Remove old store
   rm src/stores/codeServerStore.ts

   # Remove old API routes
   rm -rf src/pages/api/code-server/agent
   ```

2. **Update Documentation**
   - Remove legacy API references
   - Update code examples
   - Archive old guides

3. **Database Cleanup**
   ```sql
   -- Archive old agent records
   UPDATE agents
   SET archived = true
   WHERE created_at < NOW() - INTERVAL '90 days'
     AND api_version = 'legacy';
   ```

### Monitoring Metrics

Track these metrics post-migration:

- API response times (target: <200ms P95)
- Error rates (target: <1%)
- Agent success rates (target: >95%)
- SSE connection stability (target: >99%)
- User satisfaction scores

---

## Support

### Migration Issues

- **Slack**: #agent-migration channel
- **Email**: migration-support@vibecode.com
- **Office Hours**: Daily 2-4 PM EST during migration period

### Resources

- [API Reference](./02-API-REFERENCE.md)
- [User Guide](./01-USER-GUIDE.md)
- [Developer Guide](./03-DEVELOPER-GUIDE.md)
- [Troubleshooting](./04-TROUBLESHOOTING.md)

---

## FAQ

**Q: Can I use both APIs during migration?**
A: Yes, both APIs will coexist for 90 days.

**Q: Will my existing agents be migrated automatically?**
A: No, existing agents will continue using legacy API. New agents should use new API.

**Q: What if I encounter a bug in the new API?**
A: Report via GitHub issues with "migration" label. Critical issues will be prioritized.

**Q: Do I need to update all code at once?**
A: No, you can migrate incrementally. Use feature flags to control rollout.

**Q: Will legacy API receive updates?**
A: Only critical security fixes. New features only in new API.
