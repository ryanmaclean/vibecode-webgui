# OpenAI Agents API Client

Production-ready TypeScript client for OpenAI Assistants API integration.

## Quick Start

```typescript
import { createOpenAIAgentsClient } from './openai-client'
import { getToolRegistry, registerBuiltInTools } from './tool-registry'
import { initializeThreadManager } from './thread-manager'

// Initialize components
const client = createOpenAIAgentsClient()
const registry = getToolRegistry()
registerBuiltInTools(registry)
const threadManager = initializeThreadManager({ client })

// Create agent
const agent = await client.createAgent({
  model: 'gpt-4',
  name: 'Assistant',
  instructions: 'You are helpful',
  tools: registry.getDefinitions()
})

// Start conversation
const session = await threadManager.createThread('user-123', agent.id)
await threadManager.addMessage(session.threadId, 'user', 'Hello!')

// Execute run
const run = await client.createRun(session.threadId, {
  assistant_id: agent.id
})
```

## API Client

**Features**:
- Agent CRUD operations
- Thread management
- Message handling
- Run execution with streaming
- File operations
- Vector store management
- Automatic retry logic
- Error handling

**Configuration**:
```typescript
const client = createOpenAIAgentsClient({
  apiKey: 'sk-...',        // Required
  organization: 'org-...',  // Optional
  timeout: 60000,          // Optional (ms)
  maxRetries: 3            // Optional
})
```

## Tool Registry

**Features**:
- Dynamic tool registration
- Type-safe handlers
- Rate limiting
- Execution metrics
- Batch execution

**Usage**:
```typescript
registry.register(
  'tool_name',
  {
    description: 'Tool description',
    parameters: { /* JSON schema */ }
  },
  async (args) => { /* handler */ },
  {
    category: 'utility',
    tags: ['tag1'],
    rateLimit: { maxCalls: 100, windowMs: 60000 }
  }
)
```

## Thread Manager

**Features**:
- Session lifecycle
- Context caching
- Message history
- Auto cleanup
- Thread reuse

**Configuration**:
```typescript
const threadManager = initializeThreadManager({
  client,
  sessionTTL: 86400000,        // 24 hours
  maxMessagesPerThread: 100,
  enableAutoCleanup: true,
  cleanupInterval: 3600000     // 1 hour
})
```

## API Endpoints

- `POST /api/agents/create` - Create agent
- `GET /api/agents/list` - List agents
- `GET /api/agents/:id` - Get agent
- `DELETE /api/agents/:id` - Delete agent
- `POST /api/agents/threads` - Create thread
- `POST /api/agents/threads/:id/messages` - Add message
- `POST /api/agents/threads/:id/run` - Execute run
- `POST /api/agents/files` - Upload file
- `GET /api/agents/tools` - List tools

## Environment Variables

```bash
OPENAI_API_KEY=sk-...       # Required
OPENAI_ORGANIZATION=org-... # Optional
```

## Testing

```bash
# Unit tests
npm run test:unit -- tests/unit/agents

# Integration tests
npm run test:integration -- tests/integration/agents

# All tests
npm test
```

## Documentation

See `/claudedocs/OPENAI_AGENTS_API_IMPLEMENTATION.md` for complete documentation.

## License

MIT
