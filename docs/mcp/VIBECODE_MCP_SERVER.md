# VibeCode MCP Server

Making VibeCode programmable via Model Context Protocol.

## Vision

**VibeCode as Infrastructure**: Instead of being just a UI, VibeCode becomes an **MCP Server** that AI assistants can program against. Any MCP client (Claude Desktop, ChatGPT, Cursor) can control VibeCode's:

- Docker containers
- Experimentation platform
- VM infrastructure (vfkit, Lima)
- Serial communication with hardware
- Database connections
- File system operations

## Architecture

```
┌─────────────────────────────────────┐
│   AI Assistant (MCP Client)         │
│   - Claude Desktop                  │
│   - ChatGPT with MCP plugin         │
│   - Cursor IDE                      │
└─────────────┬───────────────────────┘
              │ MCP Protocol
              │ (JSON-RPC over stdio/HTTP)
              ▼
┌─────────────────────────────────────┐
│   VibeCode MCP Server               │
│   - Exposes tools as MCP resources  │
│   - Handles authentication          │
│   - Manages state and sessions      │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   VibeCode Backend Services         │
│   - Docker API                      │
│   - Experiments Platform            │
│   - VM Management (vfkit/Lima)      │
│   - Serial Port Access              │
│   - PostgreSQL Database             │
└─────────────────────────────────────┘
```

## MCP Tools Exposed by VibeCode

### 1. Docker Management

```typescript
// MCP tool: docker_container_create
{
  name: "docker_container_create",
  description: "Create and start a Docker container",
  inputSchema: {
    type: "object",
    properties: {
      image: { type: "string", description: "Docker image name" },
      command: { type: "string", description: "Command to run" },
      env: { type: "object", description: "Environment variables" },
      ports: { type: "object", description: "Port mappings" }
    }
  }
}

// AI assistant usage:
"Create a PostgreSQL container with Datadog monitoring"
→ Calls docker_container_create with proper config
```

### 2. Experimentation Platform

```typescript
// MCP tool: experiment_create
{
  name: "experiment_create",
  description: "Create an A/B test experiment",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" },
      variants: { type: "array", items: { type: "object" } },
      metrics: { type: "array", items: { type: "string" } },
      allocation: { type: "object" }
    }
  }
}

// AI assistant usage:
"Run an experiment testing GPT-4 vs Claude for code generation"
→ Creates experiment, logs results, runs statistical analysis
```

### 3. VM Management

```typescript
// MCP tool: vm_start
{
  name: "vm_start",
  description: "Start a virtual machine",
  inputSchema: {
    type: "object",
    properties: {
      type: { enum: ["vfkit", "lima"], description: "VM type" },
      name: { type: "string" },
      config: { type: "object" }
    }
  }
}

// AI assistant usage:
"Start an Alpine Linux VM with 2GB RAM for testing"
→ Calls vm_start with vfkit backend
```

### 4. Serial Communication

```typescript
// MCP tool: serial_monitor
{
  name: "serial_monitor",
  description: "Monitor serial port for embedded device",
  inputSchema: {
    type: "object",
    properties: {
      port: { type: "string", description: "/dev/ttyUSB0" },
      baudRate: { type: "number" },
      duration: { type: "number", description: "Seconds to monitor" }
    }
  }
}

// AI assistant usage:
"Monitor serial output from Arduino on /dev/ttyUSB0 for 30 seconds"
→ Returns captured serial data
```

### 5. Database Operations

```typescript
// MCP tool: db_query
{
  name: "db_query",
  description: "Execute SQL query on VibeCode database",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "SQL query" },
      params: { type: "array" }
    }
  }
}

// AI assistant usage:
"Show me the last 10 experiments with their conversion rates"
→ Executes SQL, returns formatted results
```

## Implementation

### 1. MCP Server Setup

```typescript
// src/mcp/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  {
    name: 'vibecode-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'docker_container_create',
      description: 'Create and start a Docker container',
      inputSchema: { /* ... */ }
    },
    {
      name: 'experiment_create',
      description: 'Create an A/B test experiment',
      inputSchema: { /* ... */ }
    },
    {
      name: 'vm_start',
      description: 'Start a virtual machine',
      inputSchema: { /* ... */ }
    },
    {
      name: 'serial_monitor',
      description: 'Monitor serial port',
      inputSchema: { /* ... */ }
    },
    {
      name: 'db_query',
      description: 'Execute SQL query',
      inputSchema: { /* ... */ }
    }
  ]
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'docker_container_create':
      return await handleDockerContainerCreate(args);
    case 'experiment_create':
      return await handleExperimentCreate(args);
    case 'vm_start':
      return await handleVmStart(args);
    case 'serial_monitor':
      return await handleSerialMonitor(args);
    case 'db_query':
      return await handleDbQuery(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

### 2. Tool Handlers

```typescript
// src/mcp/handlers/docker.ts
import { Docker } from '../lib/docker';

export async function handleDockerContainerCreate(args: any) {
  const docker = new Docker();

  const container = await docker.createContainer({
    Image: args.image,
    Cmd: args.command?.split(' '),
    Env: Object.entries(args.env || {}).map(([k, v]) => `${k}=${v}`),
    HostConfig: {
      PortBindings: args.ports || {}
    }
  });

  await container.start();

  return {
    content: [
      {
        type: 'text',
        text: `Container ${container.id} created and started successfully`
      }
    ]
  };
}
```

```typescript
// src/mcp/handlers/experiments.ts
import { createExperiment } from '../lib/experiments/warehouse';

export async function handleExperimentCreate(args: any) {
  const experiment = await createExperiment({
    name: args.name,
    description: args.description,
    variants: args.variants,
    metrics: args.metrics,
    allocation: args.allocation
  });

  return {
    content: [
      {
        type: 'text',
        text: `Experiment "${experiment.name}" created with ID: ${experiment.id}`
      }
    ]
  };
}
```

### 3. MCP Client Configuration

```json
// Claude Desktop config: ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "vibecode": {
      "command": "node",
      "args": ["/path/to/vibecode-webgui/dist/mcp-server.js"]
    }
  }
}
```

## Use Cases

### 1. AI-Driven Infrastructure

```
User: "Setup a full-stack development environment"

AI Assistant:
1. docker_container_create → PostgreSQL database
2. docker_container_create → Redis cache
3. docker_container_create → Datadog agent
4. vm_start → Alpine Linux for testing
5. db_query → Create schema
→ Returns connection strings and status
```

### 2. Automated Experimentation

```
User: "Test if GPT-4-turbo is faster than Claude for code reviews"

AI Assistant:
1. experiment_create → A/B test with 2 variants
2. Loop 100 times:
   - Assign user to variant
   - Log response time
   - Record quality score
3. db_query → Fetch results
4. Statistical analysis → Determine winner
→ Returns full report with p-values
```

### 3. Hardware Testing Automation

```
User: "Flash firmware to 5 ESP32 boards and verify serial output"

AI Assistant:
For each board:
1. serial_monitor → Capture boot logs
2. Parse for MAC address
3. db_query → Store MAC in database
4. Verify output matches expected pattern
→ Returns pass/fail for each board
```

### 4. Infrastructure Monitoring

```
User: "Check health of all running containers and VMs"

AI Assistant:
1. docker_container_list → Get all containers
2. For each: docker_container_inspect → Check status
3. vm_list → Get all VMs
4. For each: vm_status → Check health
5. db_query → Log metrics to database
→ Returns dashboard URL
```

## Advantages of MCP Approach

### vs. Direct API
- **Standardized**: Any MCP client can use VibeCode
- **Discoverable**: Tools are self-documenting
- **Composable**: AI can chain multiple tools
- **Authenticated**: Built-in auth via MCP protocol

### vs. Custom CLI
- **AI-Native**: Designed for LLM consumption
- **Type-Safe**: JSON Schema validation
- **Bi-directional**: Server can push updates
- **Multiplexed**: Handle concurrent requests

### vs. Web UI
- **Programmable**: Full automation possible
- **Composable**: Combine with other MCP servers
- **Faster**: No human in the loop
- **Scalable**: Handle 1000s of operations

## MCP Resources (Read-Only Data)

```typescript
// Expose VibeCode data as MCP resources
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'vibecode://experiments/active',
      name: 'Active Experiments',
      description: 'List of currently running experiments',
      mimeType: 'application/json'
    },
    {
      uri: 'vibecode://containers/running',
      name: 'Running Containers',
      description: 'Docker containers currently running',
      mimeType: 'application/json'
    },
    {
      uri: 'vibecode://vms/status',
      name: 'VM Status',
      description: 'Status of all virtual machines',
      mimeType: 'application/json'
    }
  ]
}));
```

## MCP Prompts (Reusable Templates)

```typescript
// Pre-configured prompts for common tasks
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: 'setup_dev_environment',
      description: 'Setup a complete development environment',
      arguments: [
        { name: 'stack', description: 'Tech stack (node, python, go)', required: true }
      ]
    },
    {
      name: 'run_ab_test',
      description: 'Run an A/B test experiment',
      arguments: [
        { name: 'feature', description: 'Feature to test', required: true },
        { name: 'variants', description: 'Number of variants', required: true }
      ]
    }
  ]
}));
```

## Security Considerations

### Authentication
```typescript
// Validate MCP client tokens
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const token = request.params._meta?.clientToken;
  if (!await validateToken(token)) {
    throw new Error('Unauthorized');
  }
  // ... handle request
});
```

### Authorization
```typescript
// Role-based access control
const TOOL_PERMISSIONS = {
  'docker_container_create': ['admin', 'developer'],
  'db_query': ['admin', 'developer', 'analyst'],
  'experiment_create': ['admin', 'researcher']
};
```

### Sandboxing
```typescript
// Restrict dangerous operations
if (args.query.toUpperCase().includes('DROP TABLE')) {
  throw new Error('Destructive queries not allowed via MCP');
}
```

## Roundtable-AI Integration

VibeCode MCP Server can integrate with roundtable-ai for multi-agent orchestration:

```typescript
// Roundtable-AI coordinates multiple AI agents
// Each agent uses VibeCode MCP Server for infrastructure

Agent 1 (Backend): docker_container_create → API server
Agent 2 (Database): db_query → Create schema
Agent 3 (Testing): vm_start → Test environment
Agent 4 (Monitoring): experiment_create → Performance test
Agent 5 (Deployment): docker_container_create → Production
```

## Next Steps

1. **Implement MCP Server**: `src/mcp/server.ts`
2. **Add Tool Handlers**: Docker, Experiments, VMs, Serial
3. **Test with Claude Desktop**: Verify end-to-end
4. **Document Tool Schemas**: Full JSON Schema definitions
5. **Publish to MCP Registry**: Make discoverable
6. **Integrate with Roundtable-AI**: Multi-agent coordination

## References

- **MCP Specification**: https://modelcontextprotocol.io/
- **MCP SDK**: https://github.com/modelcontextprotocol/sdk
- **Claude Desktop MCP**: https://docs.anthropic.com/claude/docs/mcp
- **Roundtable-AI**: https://github.com/plastic-labs/roundtable-ai
