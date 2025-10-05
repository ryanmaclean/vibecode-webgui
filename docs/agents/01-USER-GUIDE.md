# OpenAI Agents User Guide

**Version**: 1.0.0
**Last Updated**: 2025-10-02
**Audience**: End Users, Developers

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Creating Your First Agent](#creating-your-first-agent)
4. [Managing Agents](#managing-agents)
5. [Working with Agent Output](#working-with-agent-output)
6. [Best Practices](#best-practices)
7. [Common Use Cases](#common-use-cases)
8. [Troubleshooting](#troubleshooting)

---

## Introduction

### What are OpenAI Agents?

OpenAI Agents in VibeCode are AI-powered coding assistants that can autonomously perform development tasks. The platform supports three types of agents:

- **Aider**: Specialized in code editing and refactoring with git integration
- **Goose**: Focused on code review, analysis, and recommendations
- **Cline**: Versatile agent for general-purpose coding tasks

### Key Capabilities

- Automated code generation and editing
- Intelligent refactoring and optimization
- Code review and security analysis
- Documentation generation
- Test creation and debugging
- Real-time collaborative coding

### System Requirements

- Active VibeCode account with authenticated session
- Workspace with appropriate permissions
- Supported LLM model access (Claude, GPT-4, DeepSeek)
- Minimum 500MB available memory per agent

---

## Getting Started

### Accessing Agents

1. Log in to your VibeCode workspace
2. Navigate to the Agent Dashboard (sidebar → Agents)
3. Verify your account has agent creation permissions
4. Check available agent slots (max 5 concurrent per user)

### Understanding Agent Limits

**Per-User Limits:**
- Maximum 5 concurrent agents
- 30 messages per minute per agent
- 1000 messages per hour per workspace

**Global Limits:**
- Maximum 10,000 active agents system-wide
- 100 messages per second across all agents

**Session Limits:**
- 300-second default timeout (configurable)
- Automatic cleanup after 1 hour of inactivity

---

## Creating Your First Agent

### Basic Agent Creation

#### Step 1: Choose Your Agent Type

```typescript
// Aider - Best for code editing
agent_type: 'aider'

// Goose - Best for code review
agent_type: 'goose'

// Cline - Best for general tasks
agent_type: 'cline'
```

#### Step 2: Configure Workspace

```typescript
workspace: '/home/coder/workspace/my-project'
```

**Requirements:**
- Must be absolute path
- Must start with `/home/coder/workspace`
- Must have read/write permissions

#### Step 3: Select Files (Optional)

```typescript
files: [
  'src/main.py',
  'src/utils.py',
  'tests/test_main.py'
]
```

**Best Practices:**
- Include only files the agent needs to modify
- Maximum 50 files per agent
- Use relative paths from workspace root

#### Step 4: Choose Your Model

```typescript
model: 'claude-3-5-sonnet-20241022'  // Recommended for most tasks
// model: 'gpt-4o'                   // Alternative
// model: 'deepseek-chat'            // Budget option
```

**Model Selection Guide:**
- **Claude 3.5 Sonnet**: Best accuracy, complex reasoning
- **GPT-4o**: Fast responses, good for iterative tasks
- **DeepSeek**: Cost-effective for simple tasks

#### Step 5: Write Clear Task Description

```typescript
task: 'Add error handling to the login function in src/auth.py.
Include try-catch blocks for network errors and invalid credentials.
Add logging for failed attempts.'
```

**Task Writing Tips:**
- Be specific and detailed (10-2000 characters)
- Include context about existing code
- Specify expected behavior
- Mention any constraints or requirements

### Complete Example

```typescript
import { useAgentStore } from '@/stores/agentStore';

const { startAgent } = useAgentStore();

const agent = await startAgent({
  agent_type: 'aider',
  workspace: '/home/coder/workspace/my-project',
  files: ['src/auth.py', 'tests/test_auth.py'],
  model: 'claude-3-5-sonnet-20241022',
  task: 'Add comprehensive error handling to the login function with proper logging'
});

console.log('Agent started:', agent.agent_id);
console.log('Terminal ID:', agent.terminal_id);
console.log('Stream URL:', agent.stream_url);
```

---

## Managing Agents

### Viewing Active Agents

```typescript
import { useAgentStore } from '@/stores/agentStore';

const { sessions, stats } = useAgentStore();

// List all active agents
const activeAgents = Array.from(sessions.values())
  .filter(agent => agent.status === 'running');

console.log(`Active agents: ${stats.running}`);
console.log(`Completed: ${stats.completed}`);
console.log(`Failed: ${stats.failed}`);
```

### Monitoring Agent Status

```typescript
// Get specific agent
const agent = useAgentStore.getState().getAgent('aider-abc12345');

console.log('Status:', agent.status);
console.log('Progress:', agent.progress);
console.log('Uptime:', agent.uptime_seconds);
console.log('CPU:', agent.resource_usage?.cpu_percent);
console.log('Memory:', agent.resource_usage?.memory_mb);
```

**Agent Statuses:**
- `running`: Agent is actively working
- `completed`: Task finished successfully
- `failed`: Task failed with error
- `stopped`: User manually stopped
- `error`: System error occurred

### Stopping Agents

#### Graceful Stop (Recommended)

```typescript
await stopAgent('aider-abc12345');
```

Agent will:
1. Finish current operation
2. Save all changes
3. Clean up resources
4. Return exit code

#### Force Stop (Emergency)

```typescript
await stopAgent('aider-abc12345', true);
```

Use when:
- Agent is unresponsive
- Need immediate termination
- Emergency resource cleanup

**Warning**: Force stop may lose unsaved work.

### Restarting Agents

```typescript
const newAgent = await restartAgent('aider-abc12345');

// Same configuration as original agent
console.log('Restarted with ID:', newAgent.agent_id);
```

---

## Working with Agent Output

### Real-Time Streaming (SSE)

```typescript
const eventSource = new EventSource(
  `/api/agents/${agentId}/events`
);

eventSource.addEventListener('output', (event) => {
  const data = JSON.parse(event.data);
  console.log('[Agent Output]:', data.line);
});

eventSource.addEventListener('status', (event) => {
  const data = JSON.parse(event.data);
  console.log('Status:', data.status, 'Progress:', data.progress);
});

eventSource.addEventListener('error', (event) => {
  const data = JSON.parse(event.data);
  console.error('Agent Error:', data.error);
});

eventSource.addEventListener('complete', (event) => {
  const data = JSON.parse(event.data);
  console.log('Completed with exit code:', data.exit_code);
  eventSource.close();
});
```

### WebSocket Communication

```typescript
const ws = new WebSocket(
  `ws://localhost:3000/api/agents/${agentId}/ws`,
  'agent-v1'
);

// Receive messages
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'output':
      console.log(message.content);
      break;
    case 'status':
      console.log('Status:', message.status);
      break;
    case 'error':
      console.error('Error:', message.error);
      break;
  }
};

// Send messages to agent
ws.send(JSON.stringify({
  type: 'message',
  content: 'Please add unit tests for this function'
}));
```

### Using the Agent Store

```typescript
import { useAgentStore } from '@/stores/agentStore';
import { useEffect } from 'react';

function AgentMonitor({ agentId }) {
  const agent = useAgentStore(state =>
    state.sessions.get(agentId)
  );

  useEffect(() => {
    // Store automatically handles SSE connection
    const { handleSSEConnect, handleSSEEvent } = useAgentStore.getState();

    const eventSource = new EventSource(`/api/agents/${agentId}/events`);

    eventSource.onopen = () => handleSSEConnect(agentId);
    eventSource.onmessage = (event) => {
      const sseEvent = JSON.parse(event.data);
      handleSSEEvent(agentId, sseEvent);
    };

    return () => eventSource.close();
  }, [agentId]);

  return (
    <div>
      <h3>Agent: {agent?.agent_id}</h3>
      <p>Status: {agent?.status}</p>
      <p>Progress: {(agent?.progress || 0) * 100}%</p>
      <p>Uptime: {agent?.uptime_seconds}s</p>
    </div>
  );
}
```

---

## Best Practices

### Task Design

1. **Be Specific**
   ```typescript
   // Good
   task: 'Refactor the getUserData function in src/api/users.ts to use async/await
         instead of promises. Add error handling for network failures and invalid
         user IDs. Update the corresponding tests in tests/api/users.test.ts.'

   // Bad
   task: 'Fix the user function'
   ```

2. **Provide Context**
   ```typescript
   task: 'This project uses TypeScript with strict mode enabled. When adding the
         new authentication middleware, ensure all types are properly defined and
         follow the existing pattern in src/middleware/auth.ts.'
   ```

3. **Set Clear Boundaries**
   ```typescript
   task: 'Add input validation to the login endpoint. DO NOT modify the database
         schema or authentication logic. Only update the request validation layer.'
   ```

### File Selection

1. **Include Only Necessary Files**
   ```typescript
   // Good - focused scope
   files: ['src/api/auth.ts', 'tests/api/auth.test.ts']

   // Bad - too broad
   files: ['src/**/*.ts']
   ```

2. **Order Files by Importance**
   ```typescript
   files: [
     'src/main.py',        // Primary file
     'src/utils.py',       // Dependencies
     'tests/test_main.py'  // Tests
   ]
   ```

### Model Selection

1. **Match Model to Task Complexity**
   - Simple tasks: DeepSeek or GPT-4o-mini
   - Medium tasks: GPT-4o
   - Complex tasks: Claude 3.5 Sonnet

2. **Consider Cost vs. Quality**
   - Development: Use budget models
   - Production: Use premium models
   - Critical tasks: Always use best model

### Resource Management

1. **Monitor Active Agents**
   ```typescript
   const { stats } = useAgentStore();

   if (stats.running >= 5) {
     console.warn('Maximum agents running');
     // Wait or stop inactive agents
   }
   ```

2. **Clean Up Completed Agents**
   ```typescript
   const { clearCompleted } = useAgentStore();

   // Periodically clear completed agents
   setInterval(() => {
     clearCompleted();
   }, 300000); // Every 5 minutes
   ```

---

## Common Use Cases

### Use Case 1: Code Refactoring

```typescript
const refactorAgent = await startAgent({
  agent_type: 'aider',
  workspace: '/home/coder/workspace/my-app',
  files: ['src/legacy/user-manager.js'],
  model: 'claude-3-5-sonnet-20241022',
  task: `Refactor user-manager.js to TypeScript:
    - Convert to TypeScript with proper types
    - Split into smaller modules
    - Add JSDoc comments
    - Maintain existing functionality
    - Update imports in dependent files`
});
```

### Use Case 2: Security Review

```typescript
const securityAgent = await startAgent({
  agent_type: 'goose',
  workspace: '/home/coder/workspace/api-server',
  files: ['src/routes/*.ts', 'src/middleware/auth.ts'],
  model: 'gpt-4o',
  task: `Perform security audit:
    - Check for SQL injection vulnerabilities
    - Verify input validation
    - Review authentication logic
    - Check for sensitive data exposure
    - Provide remediation recommendations`
});
```

### Use Case 3: Test Generation

```typescript
const testAgent = await startAgent({
  agent_type: 'cline',
  workspace: '/home/coder/workspace/utils-lib',
  files: ['src/string-utils.ts'],
  model: 'gpt-4o',
  task: `Generate comprehensive unit tests:
    - Test all exported functions
    - Include edge cases and error scenarios
    - Use Jest testing framework
    - Aim for 90%+ code coverage
    - Add meaningful test descriptions`
});
```

### Use Case 4: Documentation

```typescript
const docsAgent = await startAgent({
  agent_type: 'cline',
  workspace: '/home/coder/workspace/my-library',
  files: ['src/index.ts', 'src/api/*.ts'],
  model: 'claude-3-5-sonnet-20241022',
  task: `Generate API documentation:
    - Add JSDoc comments to all public APIs
    - Include usage examples
    - Document parameters and return types
    - Add @throws documentation for errors
    - Generate markdown README from JSDoc`
});
```

---

## Troubleshooting

### Agent Won't Start

**Problem**: Agent creation fails immediately

**Solutions**:
1. Check concurrent agent limit
   ```typescript
   const { stats } = useAgentStore();
   console.log('Active agents:', stats.running);
   ```

2. Verify workspace path
   ```typescript
   // Must start with /home/coder/workspace
   workspace: '/home/coder/workspace/my-project'
   ```

3. Check file permissions
   ```bash
   ls -la /home/coder/workspace/my-project
   ```

### Agent Stuck in Running State

**Problem**: Agent shows running but no output

**Solutions**:
1. Check SSE connection
   ```typescript
   const agent = getAgent(agentId);
   console.log('SSE connected:', agent.sse_connected);
   ```

2. Monitor resource usage
   ```typescript
   console.log('CPU:', agent.resource_usage?.cpu_percent);
   console.log('Memory:', agent.resource_usage?.memory_mb);
   ```

3. Force restart if necessary
   ```typescript
   await stopAgent(agentId, true);
   await restartAgent(agentId);
   ```

### Rate Limit Errors

**Problem**: "Rate limit exceeded" errors

**Solutions**:
1. Check current limits
   ```typescript
   // Response headers include:
   // X-RateLimit-Limit: 30
   // X-RateLimit-Remaining: 0
   // X-RateLimit-Reset: 1696248000
   ```

2. Implement backoff strategy
   ```typescript
   async function startAgentWithRetry(config, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await startAgent(config);
       } catch (error) {
         if (error.status === 429) {
           const retryAfter = error.rateLimit?.['Retry-After'] || 60;
           await new Promise(r => setTimeout(r, retryAfter * 1000));
         } else {
           throw error;
         }
       }
     }
   }
   ```

### Connection Issues

**Problem**: SSE or WebSocket disconnects

**Solutions**:
1. Implement reconnection logic
   ```typescript
   function connectSSE(agentId, maxRetries = 5) {
     let retries = 0;

     function connect() {
       const es = new EventSource(`/api/agents/${agentId}/events`);

       es.onerror = () => {
         es.close();
         if (retries++ < maxRetries) {
           setTimeout(connect, 3000 * retries);
         }
       };

       return es;
     }

     return connect();
   }
   ```

2. Check network connectivity
3. Verify agent is still running

### Memory Issues

**Problem**: Agent fails with out-of-memory error

**Solutions**:
1. Reduce file count
2. Use smaller model
3. Increase timeout for large tasks
4. Monitor system resources

---

## Next Steps

- [API Reference](./02-API-REFERENCE.md) - Complete API documentation
- [Developer Guide](./03-DEVELOPER-GUIDE.md) - Extending agents
- [Troubleshooting Guide](./04-TROUBLESHOOTING.md) - Advanced debugging
- [Migration Guide](./05-MIGRATION-GUIDE.md) - Upgrading from legacy API

## Support

- GitHub Issues: Report bugs and feature requests
- Documentation: Full API reference and guides
- Community: Discord server for questions and discussions
