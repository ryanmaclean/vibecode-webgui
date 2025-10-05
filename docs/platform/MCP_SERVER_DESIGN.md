# MCP Server Design

## Overview

The VibeCode MCP (Model Context Protocol) server transforms each workspace into a standardized API that any MCP-compatible AI tool can interact with. This document details the architecture, implementation approach, and technical specifications.

## Architecture Pattern: Kubernetes Sidecar

### Container Structure

Each workspace pod contains two containers:
1. **Primary Container**: code-server (existing development environment)
2. **Sidecar Container**: MCP server (new workspace API layer)

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: workspace-{id}
spec:
  containers:
  - name: code-server
    image: vibecode/code-server:latest
    volumeMounts:
    - name: workspace-data
      mountPath: /workspace
    - name: shared-socket
      mountPath: /var/run/mcp

  - name: mcp-server
    image: vibecode/mcp-server:latest
    env:
    - name: WORKSPACE_PATH
      value: /workspace
    - name: MCP_TRANSPORT
      value: stdio,http,websocket
    volumeMounts:
    - name: workspace-data
      mountPath: /workspace
      readOnly: true  # Start read-only for Phase 1
    - name: shared-socket
      mountPath: /var/run/mcp

  volumes:
  - name: workspace-data
    persistentVolumeClaim:
      claimName: workspace-{id}-data
  - name: shared-socket
    emptyDir: {}
```

### Communication Patterns

**Internal** (between containers):
- Unix domain socket: `/var/run/mcp/server.sock`
- Low latency, high throughput for local tools

**External** (from platform/remote agents):
- HTTP REST API: `https://mcp.vibecode.app/workspace/{id}`
- WebSocket: `wss://mcp.vibecode.app/workspace/{id}/ws`
- Authentication via JWT tokens

**stdio** (for Claude Desktop and similar clients):
- Exposed via terminal multiplexer in code-server
- Standard MCP stdio protocol implementation

## MCP Server Implementation

### Technology Stack

**Language**: TypeScript (Node.js)
- Rationale: MCP TypeScript SDK official support, JSON-RPC native handling

**Framework**: Express.js + ws library
- HTTP/REST endpoints for stateless operations
- WebSocket for streaming responses and long-running operations

**Dependencies**:
```json
{
  "@modelcontextprotocol/sdk": "^1.0.0",
  "express": "^4.18.2",
  "ws": "^8.14.2",
  "simple-git": "^3.20.0",
  "chokidar": "^3.5.3",
  "zod": "^3.22.4"
}
```

### Core Components

```typescript
// src/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';

class VibeCodeMCPServer {
  private server: Server;
  private workspacePath: string;
  private gitManager: GitManager;
  private fileWatcher: FileWatcher;

  constructor(config: ServerConfig) {
    this.workspacePath = config.workspacePath;
    this.server = new Server({
      name: 'vibecode-workspace',
      version: '1.0.0',
    }, {
      capabilities: {
        resources: {
          subscribe: true,  // Enable file watching
          listChanged: true
        },
        tools: {}, // Phase 2
        prompts: {}  // Phase 3
      }
    });

    this.registerResourceHandlers();
    this.registerToolHandlers();  // Phase 2
  }

  private registerResourceHandlers() {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'workspace://files',
            name: 'Workspace Files',
            description: 'All files in the workspace',
            mimeType: 'application/vnd.vibecode.filetree'
          },
          {
            uri: 'workspace://git/status',
            name: 'Git Status',
            description: 'Current repository state',
            mimeType: 'application/json'
          },
          {
            uri: 'workspace://git/history',
            name: 'Git History',
            description: 'Commit history',
            mimeType: 'application/json'
          }
        ]
      };
    });

    // Read specific resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      if (uri.startsWith('workspace://files')) {
        return this.handleFileResource(uri);
      }
      if (uri.startsWith('workspace://git')) {
        return this.handleGitResource(uri);
      }

      throw new Error(`Unknown resource: ${uri}`);
    });
  }

  private async handleFileResource(uri: string): Promise<ResourceContents> {
    const path = uri.replace('workspace://files', '');

    if (!path || path === '/') {
      // Return file tree
      const tree = await this.fileWatcher.getFileTree();
      return {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(tree, null, 2)
      };
    }

    // Return specific file content
    const fullPath = join(this.workspacePath, path);
    const content = await fs.readFile(fullPath, 'utf-8');
    return {
      uri,
      mimeType: mime.lookup(fullPath) || 'text/plain',
      text: content
    };
  }

  private async handleGitResource(uri: string): Promise<ResourceContents> {
    const operation = uri.replace('workspace://git/', '');

    switch (operation) {
      case 'status':
        const status = await this.gitManager.status();
        return {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(status, null, 2)
        };

      case 'history':
        const history = await this.gitManager.log({ maxCount: 100 });
        return {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(history, null, 2)
        };

      default:
        throw new Error(`Unknown git operation: ${operation}`);
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('VibeCode MCP Server running');
  }
}
```

## Resources Exposed

### Phase 1: Read-Only Resources (Weeks 1-3)

#### 1. Workspace Files
**URI Pattern**: `workspace://files/**`

**Capabilities**:
- List all files and directories (tree view)
- Read individual file contents
- Subscribe to file change notifications
- Filter by glob patterns (e.g., `workspace://files/**/*.ts`)

**Response Format**:
```json
{
  "uri": "workspace://files",
  "mimeType": "application/json",
  "text": {
    "tree": [
      {
        "path": "src/index.ts",
        "type": "file",
        "size": 1024,
        "modified": "2025-10-01T12:00:00Z"
      },
      {
        "path": "src/utils",
        "type": "directory",
        "children": [...]
      }
    ]
  }
}
```

#### 2. Git Status
**URI**: `workspace://git/status`

**Capabilities**:
- Current branch information
- Staged and unstaged changes
- Untracked files
- Ahead/behind remote status

**Response Format**:
```json
{
  "branch": "feature/mcp-server",
  "ahead": 2,
  "behind": 0,
  "staged": ["src/server.ts"],
  "modified": ["docs/README.md"],
  "untracked": ["temp.log"]
}
```

#### 3. Git History
**URI**: `workspace://git/history`

**Query Parameters**:
- `?limit=N` - Number of commits (default 100)
- `?since=DATE` - Commits since date
- `?author=NAME` - Filter by author

**Response Format**:
```json
{
  "commits": [
    {
      "hash": "a1b2c3d",
      "author": "Ryan MacLean",
      "date": "2025-10-01T12:00:00Z",
      "message": "feat: add MCP server",
      "files": ["src/server.ts", "docs/MCP_SERVER_DESIGN.md"]
    }
  ]
}
```

#### 4. Terminal Output
**URI**: `workspace://terminal/output`

**Capabilities**:
- Recent command execution history
- Command exit codes
- stdout/stderr streams
- Subscribe to real-time output

**Response Format**:
```json
{
  "history": [
    {
      "command": "npm test",
      "exitCode": 0,
      "startTime": "2025-10-01T11:55:00Z",
      "duration": 3200,
      "stdout": "All tests passed",
      "stderr": ""
    }
  ]
}
```

### Phase 2: Tools (Weeks 4-6)

#### 1. execute_command
**Description**: Execute shell commands in the workspace

**Schema**:
```typescript
{
  name: "execute_command",
  description: "Run a shell command in the workspace environment",
  inputSchema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "Shell command to execute"
      },
      shell: {
        type: "string",
        enum: ["bash", "sh", "zsh"],
        default: "bash"
      },
      timeout: {
        type: "number",
        description: "Timeout in milliseconds",
        default: 30000
      }
    },
    required: ["command"]
  }
}
```

**Security**:
- Sandboxed execution within container
- Timeout enforcement
- Resource limits (CPU, memory)
- Command audit logging

#### 2. edit_file
**Description**: Apply code changes to files

**Schema**:
```typescript
{
  name: "edit_file",
  description: "Edit a file with specified changes",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Relative file path"
      },
      changes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: ["insert", "delete", "replace"]
            },
            line: { type: "number" },
            content: { type: "string" }
          }
        }
      }
    },
    required: ["path", "changes"]
  }
}
```

**Implementation**:
- Atomic file operations (write to temp, then rename)
- Automatic backup creation
- Validation against syntax errors (optional)

#### 3. git_operation
**Description**: Perform Git operations

**Schema**:
```typescript
{
  name: "git_operation",
  description: "Execute Git commands",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["commit", "branch", "checkout", "merge", "rebase"]
      },
      args: {
        type: "object",
        description: "Operation-specific arguments"
      }
    },
    required: ["operation"]
  }
}
```

**Safety**:
- Prevent destructive operations (force push, hard reset)
- Require confirmation for risky operations
- Automatic stash before checkout

#### 4. create_workspace
**Description**: Provision new workspace from template

**Schema**:
```typescript
{
  name: "create_workspace",
  description: "Create a new workspace",
  inputSchema: {
    type: "object",
    properties: {
      template: {
        type: "string",
        description: "Template ID or Git URL"
      },
      config: {
        type: "object",
        properties: {
          name: { type: "string" },
          resources: {
            cpu: { type: "string" },
            memory: { type: "string" }
          }
        }
      }
    },
    required: ["template"]
  }
}
```

## Connection Methods

### 1. stdio (Local Tools)

**Use Case**: Claude Desktop, local CLI tools

**Implementation**:
```typescript
// Start server with stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);

// Client connects via process spawn
const client = spawn('node', ['mcp-server.js'], {
  stdio: ['pipe', 'pipe', 'inherit']
});
```

**Advantages**:
- Low latency
- Simple authentication (process isolation)
- No network configuration required

**Limitations**:
- Local-only access
- Single client connection

### 2. HTTP REST API (Remote Agents)

**Use Case**: Platform orchestration, remote agents, web UI

**Endpoints**:
```
GET  /workspaces/{id}/resources
GET  /workspaces/{id}/resources/{uri}
POST /workspaces/{id}/tools/{name}
GET  /workspaces/{id}/prompts
```

**Authentication**:
```typescript
// JWT token with workspace-specific claims
{
  "sub": "user-123",
  "workspaceId": "ws-456",
  "permissions": ["read", "execute"],
  "exp": 1735689600
}
```

**Rate Limiting**:
- 100 requests/minute per workspace
- 1000 requests/hour per user
- Burst allowance for tool execution

### 3. WebSocket (Streaming)

**Use Case**: Real-time updates, long-running operations, file watching

**Connection**:
```typescript
const ws = new WebSocket('wss://mcp.vibecode.app/workspace/ws-456/ws', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Subscribe to resource changes
ws.send(JSON.stringify({
  jsonrpc: '2.0',
  method: 'resources/subscribe',
  params: {
    uri: 'workspace://files/**/*.ts'
  },
  id: 1
}));

// Receive notifications
ws.on('message', (data) => {
  const notification = JSON.parse(data);
  if (notification.method === 'notifications/resources/updated') {
    console.log('File changed:', notification.params.uri);
  }
});
```

**Message Format** (JSON-RPC 2.0):
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "execute_command",
    "arguments": {
      "command": "npm test"
    }
  },
  "id": 42
}
```

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-3)

**Week 1: Core Server**
- [ ] MCP server TypeScript project setup
- [ ] Implement stdio transport
- [ ] Basic resource handlers (files, git status)
- [ ] File tree generation
- [ ] Unit tests for resource handlers

**Week 2: Kubernetes Integration**
- [ ] Dockerfile for MCP server
- [ ] Sidecar configuration in workspace pods
- [ ] Shared volume mounting
- [ ] Health checks and readiness probes
- [ ] Integration tests with code-server

**Week 3: HTTP/WebSocket Transports**
- [ ] Express server setup
- [ ] JWT authentication middleware
- [ ] REST endpoint implementation
- [ ] WebSocket connection handling
- [ ] API documentation (OpenAPI spec)

**Deliverables**:
- MCP server v1.0.0 Docker image
- Updated workspace Kubernetes manifests
- Documentation for connecting Claude Desktop
- Example scripts for HTTP/WebSocket clients

**Success Criteria**:
- Claude Desktop can connect via stdio
- HTTP API returns file tree and git status
- Zero impact on existing workspace performance
- <100ms latency for resource reads

### Phase 2: Tool Execution (Weeks 4-6)

**Week 4: Command Execution**
- [ ] `execute_command` tool implementation
- [ ] Sandboxed shell execution
- [ ] Timeout and resource limits
- [ ] stdout/stderr streaming via WebSocket
- [ ] Command audit logging

**Week 5: File Operations**
- [ ] `edit_file` tool implementation
- [ ] Atomic file write operations
- [ ] Automatic backup creation
- [ ] Syntax validation (TypeScript, Python, etc.)
- [ ] Rollback mechanism

**Week 6: Git Operations**
- [ ] `git_operation` tool implementation
- [ ] Safe operation validation
- [ ] Confirmation flow for risky operations
- [ ] Git conflict detection and reporting
- [ ] Operation history tracking

**Deliverables**:
- MCP server v2.0.0 with tool execution
- Security audit report
- Tool usage examples and documentation
- Performance benchmarks

**Success Criteria**:
- Tools can modify workspace state safely
- All tool operations logged and auditable
- <2s latency for typical operations
- Zero data loss or corruption incidents

### Phase 3: Advanced Features (Weeks 7-10)

**Enhancements**:
- [ ] Resource subscriptions (real-time file watching)
- [ ] Prompt templates for common workflows
- [ ] Batch operation support (multiple tool calls)
- [ ] Workspace metrics and analytics
- [ ] Tool execution history and replay

**Deliverables**:
- MCP server v3.0.0 with advanced features
- Prometheus metrics integration
- Developer dashboard for tool usage
- Agent development kit (SDK + docs)

### Phase 4: Production Hardening (Weeks 11-14)

**Focus Areas**:
- [ ] Performance optimization (caching, compression)
- [ ] Security hardening (penetration testing)
- [ ] Monitoring and alerting (Datadog, Sentry)
- [ ] High availability (multi-region deployment)
- [ ] Documentation and training materials

**Deliverables**:
- Production-ready MCP server v4.0.0
- Operations runbook
- Incident response procedures
- Customer migration guide

## Performance Considerations

### Caching Strategy
- **File tree**: Cache for 5 seconds, invalidate on file events
- **Git status**: Cache for 2 seconds, invalidate on git operations
- **File contents**: No caching (always fresh)

### Resource Limits
- **Memory**: 256MB per MCP server container
- **CPU**: 0.25 vCPU (burstable to 0.5)
- **Storage**: Shared with code-server workspace volume

### Scalability
- **Concurrent connections**: 100 per workspace (HTTP/WS combined)
- **Tool execution queue**: 10 concurrent operations per workspace
- **WebSocket messages**: 1000/second per connection

## Security Model

### Authentication
1. **API Tokens**: JWT with workspace-specific permissions
2. **Token Rotation**: Automatic refresh every 24 hours
3. **Revocation**: Immediate token invalidation on user logout

### Authorization
- **Role-based access**: owner, admin, member, viewer
- **Resource-level permissions**: read, write, execute
- **Tool-level restrictions**: whitelist/blacklist per workspace

### Audit Logging
- All tool executions logged with user, timestamp, arguments
- Resource access logged (read operations)
- Retention period: 90 days (configurable)
- Export to SIEM systems (Splunk, ELK)

### Sandboxing
- Container isolation (no host access)
- Network policies (no external egress except approved domains)
- Filesystem restrictions (chroot within workspace)
- Resource quotas (prevent DoS)

## Monitoring and Observability

### Metrics
- Request rate and latency (p50, p95, p99)
- Tool execution success/failure rates
- WebSocket connection count and duration
- Resource consumption (CPU, memory, network)

### Logging
- Structured JSON logs
- Log levels: DEBUG, INFO, WARN, ERROR
- Correlation IDs for request tracing
- Integration with Datadog/CloudWatch

### Alerting
- MCP server unavailable (health check failures)
- High error rate (>5% tool execution failures)
- Elevated latency (p95 >1s)
- Resource saturation (>80% memory usage)

## Future Enhancements

### Advanced Resource Types
- `workspace://metrics/*` - Performance analytics
- `workspace://tests/results` - Test execution data
- `workspace://dependencies/*` - Package.json dependencies with vulnerabilities
- `workspace://lint/errors` - Static analysis results

### Enhanced Tools
- `search_codebase` - Semantic code search
- `refactor_code` - Automated refactoring with AST manipulation
- `generate_tests` - Test generation based on coverage gaps
- `optimize_performance` - Profiling and optimization suggestions

### Multi-Workspace Operations
- Cross-workspace file sharing
- Monorepo support (multi-workspace coordination)
- Workspace templates with pre-configured tools
- Workspace cloning and forking

## Conclusion

The MCP server design establishes VibeCode workspaces as first-class API citizens in the AI development ecosystem. By implementing the Model Context Protocol standard, we enable:

1. **Universal Tool Compatibility**: Any MCP client can interact with VibeCode workspaces
2. **Secure Multi-Tenancy**: Isolated, auditable access to workspace resources
3. **Flexible Deployment**: stdio for local, HTTP/WS for cloud-native architectures
4. **Extensible Platform**: Foundation for tool orchestration and agent marketplace

This design prioritizes **security, performance, and developer experience** while maintaining backward compatibility with existing workspace infrastructure.
