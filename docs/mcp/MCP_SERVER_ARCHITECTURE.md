# VibeCode MCP Server Architecture

## Executive Summary

This document outlines the architecture for exposing VibeCode's AI-powered development capabilities as a Model Context Protocol (MCP) server. The design enables AI coding tools (Aider, Goose, Claude Desktop, Cursor, Windsurf) to leverage VibeCode's vector search, code completion, workspace management, and AI services through a standardized protocol.

## Design Goals

1. **Standardized Interface**: Expose VibeCode capabilities through MCP protocol
2. **Multi-Client Support**: Work seamlessly with all major MCP clients
3. **Performance**: Low-latency responses for real-time coding workflows
4. **Extensibility**: Easy to add new tools and capabilities
5. **Security**: Proper authentication and authorization
6. **Observability**: Comprehensive logging and monitoring

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Client Ecosystem                          │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌────────┐ ┌─────────┐ │
│  │ Windsurf │ │  Claude  │ │  Aider  │ │ Cursor │ │  Goose  │ │
│  │   IDE    │ │ Desktop  │ │   CLI   │ │  IDE   │ │   CLI   │ │
│  └─────┬────┘ └─────┬────┘ └────┬────┘ └───┬────┘ └────┬────┘ │
└────────┼────────────┼───────────┼──────────┼──────────┼────────┘
         │            │           │          │          │
         └────────────┴───────────┴──────────┴──────────┘
                                  │
                           MCP Protocol (stdio/SSE)
                                  │
         ┌────────────────────────▼─────────────────────────┐
         │        VibeCode MCP Server (Node.js/TypeScript)  │
         │                                                   │
         │  ┌─────────────────────────────────────────────┐ │
         │  │         MCP Server Core (SDK)               │ │
         │  │  • Protocol Handler                         │ │
         │  │  • Transport Layer (stdio/SSE)              │ │
         │  │  • Request Routing                          │ │
         │  └─────────────────────────────────────────────┘ │
         │                        │                          │
         │  ┌─────────────────────▼─────────────────────┐  │
         │  │            Tool Registry                   │  │
         │  │  • Tool Discovery                          │  │
         │  │  • Schema Validation                       │  │
         │  │  • Authorization                           │  │
         │  └─────────────────────────────────────────────┘ │
         │                        │                          │
         │  ┌─────────────────────▼─────────────────────┐  │
         │  │         MCP Tool Implementations          │  │
         │  │                                            │  │
         │  │  ┌──────────────┐  ┌──────────────┐      │  │
         │  │  │  Code Search │  │   Workspace  │      │  │
         │  │  │    Tools     │  │    Tools     │      │  │
         │  │  └──────────────┘  └──────────────┘      │  │
         │  │                                            │  │
         │  │  ┌──────────────┐  ┌──────────────┐      │  │
         │  │  │     AI       │  │  Completion  │      │  │
         │  │  │    Tools     │  │    Tools     │      │  │
         │  │  └──────────────┘  └──────────────┘      │  │
         │  │                                            │  │
         │  │  ┌──────────────┐  ┌──────────────┐      │  │
         │  │  │   Testing    │  │  Deployment  │      │  │
         │  │  │    Tools     │  │    Tools     │      │  │
         │  │  └──────────────┘  └──────────────┘      │  │
         │  └────────────────────────────────────────────┘ │
         │                        │                          │
         │  ┌─────────────────────▼─────────────────────┐  │
         │  │        Resource Providers                  │  │
         │  │  • Project Templates                       │  │
         │  │  • Active Workspaces                       │  │
         │  │  • Documentation                           │  │
         │  │  • Code Context                            │  │
         │  └─────────────────────────────────────────────┘ │
         │                        │                          │
         │  ┌─────────────────────▼─────────────────────┐  │
         │  │      Prompt Template System                │  │
         │  │  • Code Generation Prompts                 │  │
         │  │  • Analysis Prompts                        │  │
         │  │  • Refactoring Prompts                     │  │
         │  └─────────────────────────────────────────────┘ │
         └───────────────────────┬───────────────────────────┘
                                 │
         ┌───────────────────────▼───────────────────────────┐
         │         VibeCode Core Services Layer              │
         │                                                    │
         │  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  │
         │  │   Vector    │  │     AI      │  │  Workspace│ │
         │  │   Search    │  │  Services   │  │  Manager │  │
         │  └─────────────┘  └─────────────┘  └──────────┘  │
         │                                                    │
         │  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  │
         │  │    Code     │  │    Test     │  │ Deployment│ │
         │  │  Analysis   │  │   Runner    │  │  Manager │  │
         │  └─────────────┘  └─────────────┘  └──────────┘  │
         └────────────────────────────────────────────────────┘
                                 │
         ┌───────────────────────▼───────────────────────────┐
         │            Data & Infrastructure Layer            │
         │                                                    │
         │  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
         │  │ pgvector │  │ ChromaDB │  │  Redis   │       │
         │  └──────────┘  └──────────┘  └──────────┘       │
         │                                                    │
         │  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
         │  │   K8s    │  │ MongoDB  │  │ Datadog  │       │
         │  └──────────┘  └──────────┘  └──────────┘       │
         └────────────────────────────────────────────────────┘
```

## MCP Server Design

### 1. Server Architecture Patterns

#### Option A: Standalone MCP Server (Recommended)
**Pros:**
- Independent deployment and scaling
- Clear separation of concerns
- Easier testing and development
- Can run without full VibeCode stack

**Cons:**
- Additional process management
- Network overhead for local communication

**Implementation:**
```typescript
// Standalone server process
// src/mcp/server.ts
import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';

const server = new Server({
  name: 'vibecode-mcp',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {},
    resources: {},
    prompts: {}
  }
});

// Transport: stdio for CLI tools, SSE for web clients
const transport = new StdioServerTransport();
await server.connect(transport);
```

#### Option B: Embedded in Next.js
**Pros:**
- Shared authentication and state
- Direct access to database connections
- Simplified deployment

**Cons:**
- Tighter coupling
- stdio transport complications with Next.js
- Harder to scale independently

#### Option C: Hybrid Approach (Best of Both Worlds)
**Pros:**
- Standalone server for MCP protocol
- HTTP API bridge to VibeCode services
- Flexible deployment options
- Independent scaling

**Implementation:**
```typescript
// MCP Server communicates with VibeCode via HTTP/gRPC
const vibeCodeClient = new VibeCodeAPIClient({
  baseURL: process.env.VIBECODE_API_URL || 'http://localhost:3000/api'
});

// Tools delegate to VibeCode services
export async function searchCode(args: SearchArgs) {
  return await vibeCodeClient.vectorSearch.search(args);
}
```

### 2. Multi-Tenant Considerations

```typescript
interface MCPServerConfig {
  // Deployment mode
  mode: 'single-tenant' | 'multi-tenant';

  // Authentication
  authentication: {
    enabled: boolean;
    method: 'api-key' | 'jwt' | 'oauth';
    apiKeys?: Map<string, UserContext>;
  };

  // Resource isolation
  isolation: {
    workspaceId?: string;
    userId?: string;
    organizationId?: string;
  };

  // Rate limiting
  rateLimit: {
    enabled: boolean;
    requestsPerMinute: number;
  };
}
```

### 3. Server Lifecycle Management

```typescript
class VibeCodeMCPServer {
  private server: Server;
  private transport: Transport;
  private healthCheck: NodeJS.Timeout;

  async start() {
    // Initialize server
    await this.initializeServer();

    // Connect transport
    await this.connectTransport();

    // Start health checks
    this.startHealthChecks();

    // Register signal handlers
    this.registerShutdownHandlers();
  }

  async shutdown() {
    // Graceful shutdown
    await this.closeConnections();
    await this.flushLogs();
    process.exit(0);
  }

  private startHealthChecks() {
    this.healthCheck = setInterval(async () => {
      await this.checkDependencies();
      await this.reportMetrics();
    }, 30000);
  }
}
```

## MCP Tools Design

### Tool Categories

```typescript
// 1. Code Search Tools
interface CodeSearchTools {
  'search-code': {
    input: {
      query: string;
      workspaceId?: string;
      language?: string;
      limit?: number;
    };
    output: {
      results: Array<{
        filePath: string;
        content: string;
        score: number;
        metadata: Record<string, any>;
      }>;
    };
  };

  'search-code-hybrid': {
    input: {
      query: string;
      keywords: string[];
      workspaceId?: string;
    };
    output: SearchResult[];
  };

  'get-code-context': {
    input: {
      filePath: string;
      lineNumber: number;
      contextLines?: number;
    };
    output: {
      before: string[];
      current: string;
      after: string[];
      imports: string[];
      functions: string[];
    };
  };
}

// 2. AI Code Intelligence Tools
interface AICodeTools {
  'generate-code': {
    input: {
      description: string;
      language: string;
      framework?: string;
      includeTests?: boolean;
      includeDocumentation?: boolean;
    };
    output: GeneratedCode;
  };

  'smart-complete': {
    input: CompletionContext;
    output: CodeSuggestion[];
  };

  'inline-edit': {
    input: {
      instruction: string;
      code: string;
      language: string;
    };
    output: {
      editedCode: string;
      explanation: string;
      diff: string;
    };
  };

  'analyze-code': {
    input: {
      workspaceId: string;
      filePath?: string;
      checks: Array<'security' | 'performance' | 'quality' | 'style'>;
    };
    output: AnalysisResult;
  };

  'refactor-code': {
    input: {
      code: string;
      refactorRequest: string;
      language: string;
    };
    output: {
      refactoredCode: string;
      explanation: string;
      improvements: string[];
    };
  };
}

// 3. Workspace Management Tools
interface WorkspaceTools {
  'create-workspace': {
    input: {
      name: string;
      template: 'react' | 'nextjs' | 'nodejs' | 'python' | 'go' | 'rust';
      description?: string;
    };
    output: {
      workspaceId: string;
      url: string;
      status: 'creating' | 'ready';
    };
  };

  'list-workspaces': {
    input: {};
    output: {
      workspaces: Array<{
        id: string;
        name: string;
        template: string;
        status: string;
        createdAt: string;
      }>;
    };
  };

  'get-workspace-files': {
    input: {
      workspaceId: string;
      path?: string;
    };
    output: {
      files: Array<{
        path: string;
        type: 'file' | 'directory';
        size: number;
        modifiedAt: string;
      }>;
    };
  };

  'read-file': {
    input: {
      workspaceId: string;
      filePath: string;
    };
    output: {
      content: string;
      language: string;
      encoding: string;
    };
  };

  'write-file': {
    input: {
      workspaceId: string;
      filePath: string;
      content: string;
    };
    output: {
      success: boolean;
      filePath: string;
    };
  };
}

// 4. Testing & Deployment Tools
interface DevOpsTools {
  'run-tests': {
    input: {
      workspaceId: string;
      testType?: 'unit' | 'integration' | 'e2e' | 'all';
      pattern?: string;
    };
    output: {
      testRunId: string;
      status: 'running' | 'passed' | 'failed';
      results?: TestResults;
    };
  };

  'deploy-project': {
    input: {
      workspaceId: string;
      environment: 'development' | 'staging' | 'production';
      buildCommand?: string;
    };
    output: {
      deploymentId: string;
      status: string;
      url?: string;
    };
  };
}

// 5. Project Context Tools
interface ContextTools {
  'get-project-structure': {
    input: {
      workspaceId: string;
    };
    output: {
      structure: FileTree;
      languages: string[];
      frameworks: string[];
      dependencies: Record<string, string>;
    };
  };

  'get-dependencies': {
    input: {
      workspaceId: string;
    };
    output: {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
  };

  'analyze-project': {
    input: {
      workspaceId: string;
    };
    output: {
      summary: string;
      technologies: string[];
      entryPoints: string[];
      testCoverage?: number;
      codeQuality?: number;
    };
  };
}
```

### Tool Implementation Pattern

```typescript
// Base tool interface
interface MCPTool<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: JSONSchema;

  // Execution
  execute(input: TInput): Promise<TOutput>;

  // Validation
  validateInput(input: unknown): input is TInput;

  // Authorization
  authorize(context: RequestContext): Promise<boolean>;

  // Monitoring
  recordMetrics(input: TInput, output: TOutput, duration: number): void;
}

// Example implementation
class SearchCodeTool implements MCPTool<SearchCodeInput, SearchCodeOutput> {
  name = 'search-code';
  description = 'Search code semantically using vector search';

  inputSchema = {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Natural language search query' },
      workspaceId: { type: 'string' },
      language: { type: 'string' },
      limit: { type: 'number', default: 10 }
    },
    required: ['query']
  };

  async execute(input: SearchCodeInput): Promise<SearchCodeOutput> {
    // Delegate to VibeCode's vector search service
    const vectorSearch = new VectorSearch();
    const results = await vectorSearch.semanticSearch(
      input.query,
      input.workspaceId || 'default',
      input.limit || 10
    );

    return {
      results: results.map(r => ({
        filePath: r.metadata.filePath as string,
        content: r.content,
        score: r.score,
        metadata: r.metadata
      }))
    };
  }

  validateInput(input: unknown): input is SearchCodeInput {
    return typeof input === 'object' &&
           input !== null &&
           'query' in input &&
           typeof (input as any).query === 'string';
  }

  async authorize(context: RequestContext): Promise<boolean> {
    // Check workspace access
    if (context.input.workspaceId) {
      return await this.checkWorkspaceAccess(
        context.userId,
        context.input.workspaceId
      );
    }
    return true;
  }

  recordMetrics(input: SearchCodeInput, output: SearchCodeOutput, duration: number): void {
    // Send to monitoring system
    metrics.histogram('mcp.tool.search_code.duration', duration);
    metrics.increment('mcp.tool.search_code.requests');
    metrics.gauge('mcp.tool.search_code.results', output.results.length);
  }
}
```

## Resource Providers

Resources expose VibeCode data that can be read by MCP clients.

```typescript
interface MCPResources {
  // Project templates
  'vibecode://templates': {
    mimeType: 'application/json';
    content: Array<{
      id: string;
      name: string;
      description: string;
      languages: string[];
      frameworks: string[];
    }>;
  };

  // Active workspaces
  'vibecode://workspaces': {
    mimeType: 'application/json';
    content: Array<WorkspaceInfo>;
  };

  // Workspace file tree
  'vibecode://workspaces/{id}/files': {
    mimeType: 'application/json';
    content: FileTree;
  };

  // Workspace file content
  'vibecode://workspaces/{id}/files/{path}': {
    mimeType: 'text/plain' | 'application/json';
    content: string;
  };

  // Documentation
  'vibecode://docs': {
    mimeType: 'text/markdown';
    content: string;
  };

  // Code search index
  'vibecode://index/{workspaceId}': {
    mimeType: 'application/json';
    content: {
      totalFiles: number;
      indexed: number;
      languages: Record<string, number>;
      lastUpdated: string;
    };
  };

  // AI model configuration
  'vibecode://models': {
    mimeType: 'application/json';
    content: Array<{
      id: string;
      name: string;
      provider: string;
      capabilities: string[];
    }>;
  };
}

// Resource provider implementation
class WorkspaceResourceProvider implements ResourceProvider {
  async list(): Promise<ResourceInfo[]> {
    return [
      {
        uri: 'vibecode://workspaces',
        name: 'Active Workspaces',
        description: 'List of active development workspaces',
        mimeType: 'application/json'
      }
    ];
  }

  async read(uri: string): Promise<ResourceContent> {
    if (uri === 'vibecode://workspaces') {
      const workspaces = await this.fetchWorkspaces();
      return {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(workspaces, null, 2)
      };
    }

    throw new Error(`Unknown resource: ${uri}`);
  }

  async subscribe(uri: string, callback: (content: ResourceContent) => void): Promise<() => void> {
    // Support real-time updates for workspace changes
    const interval = setInterval(async () => {
      const content = await this.read(uri);
      callback(content);
    }, 5000);

    return () => clearInterval(interval);
  }
}
```

## Prompt Templates

Provide reusable prompts for common AI tasks.

```typescript
interface MCPPrompts {
  'code-review': {
    description: 'Review code for quality, security, and best practices';
    arguments: [
      { name: 'code', description: 'Code to review', required: true },
      { name: 'language', description: 'Programming language', required: true },
      { name: 'focus', description: 'Review focus areas', required: false }
    ];
    template: string;
  };

  'refactor': {
    description: 'Refactor code for better structure';
    arguments: [
      { name: 'code', description: 'Code to refactor', required: true },
      { name: 'goal', description: 'Refactoring goal', required: true }
    ];
    template: string;
  };

  'explain-code': {
    description: 'Explain what code does';
    arguments: [
      { name: 'code', description: 'Code to explain', required: true },
      { name: 'level', description: 'Explanation depth', required: false }
    ];
    template: string;
  };

  'generate-tests': {
    description: 'Generate unit tests for code';
    arguments: [
      { name: 'code', description: 'Code to test', required: true },
      { name: 'framework', description: 'Test framework', required: false }
    ];
    template: string;
  };
}

// Prompt provider implementation
class CodeReviewPromptProvider implements PromptProvider {
  name = 'code-review';
  description = 'Review code for quality, security, and best practices';

  arguments = [
    { name: 'code', description: 'Code to review', required: true },
    { name: 'language', description: 'Programming language', required: true },
    { name: 'focus', description: 'Review focus areas', required: false }
  ];

  async generate(args: Record<string, string>): Promise<string> {
    const focusAreas = args.focus || 'quality, security, performance, best practices';

    return `You are an expert code reviewer. Review the following ${args.language} code:

\`\`\`${args.language}
${args.code}
\`\`\`

Focus on: ${focusAreas}

Provide a detailed review including:
1. Overall code quality assessment
2. Specific issues found (with line numbers if applicable)
3. Security vulnerabilities
4. Performance concerns
5. Best practice violations
6. Suggested improvements

Be constructive and specific in your feedback.`;
  }
}
```

## Sampling Strategies

For AI model interactions, implement sampling strategies:

```typescript
interface SamplingConfig {
  // Model selection
  model?: string;

  // Temperature (creativity)
  temperature?: number;

  // Max tokens
  maxTokens?: number;

  // Stop sequences
  stopSequences?: string[];

  // Top-p (nucleus sampling)
  topP?: number;

  // Frequency penalty
  frequencyPenalty?: number;
}

class AdaptiveSamplingStrategy {
  getSamplingConfig(taskType: string): SamplingConfig {
    switch (taskType) {
      case 'code-generation':
        return {
          temperature: 0.2,
          maxTokens: 2000,
          topP: 0.95,
          stopSequences: ['```\n']
        };

      case 'code-explanation':
        return {
          temperature: 0.3,
          maxTokens: 1000,
          topP: 0.9
        };

      case 'creative-naming':
        return {
          temperature: 0.7,
          maxTokens: 100,
          topP: 1.0
        };

      default:
        return {
          temperature: 0.5,
          maxTokens: 1500,
          topP: 0.95
        };
    }
  }
}
```

## Configuration Format

```json
{
  "mcpServers": {
    "vibecode": {
      "command": "npx",
      "args": ["-y", "@vibecode/mcp-server"],
      "env": {
        "VIBECODE_API_URL": "http://localhost:3000",
        "VIBECODE_API_KEY": "your-api-key",
        "WORKSPACE_ID": "optional-workspace-id",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

Or for local development:

```json
{
  "mcpServers": {
    "vibecode": {
      "command": "tsx",
      "args": ["src/mcp/server.ts"],
      "cwd": "/path/to/vibecode-webgui",
      "env": {
        "NODE_ENV": "development",
        "VIBECODE_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

## Distribution Strategy

### NPM Package
```json
{
  "name": "@vibecode/mcp-server",
  "version": "1.0.0",
  "description": "VibeCode Model Context Protocol Server",
  "main": "dist/server.js",
  "bin": {
    "vibecode-mcp": "dist/server.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.18.2"
  }
}
```

### Docker Image
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 3001

CMD ["node", "dist/server.js"]
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vibecode-mcp-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: vibecode-mcp
  template:
    metadata:
      labels:
        app: vibecode-mcp
    spec:
      containers:
      - name: mcp-server
        image: vibecode/mcp-server:1.0.0
        env:
        - name: VIBECODE_API_URL
          value: "http://vibecode-api:3000"
        ports:
        - containerPort: 3001
```

## Security Considerations

### Authentication
```typescript
class MCPAuthenticationManager {
  async authenticate(apiKey: string): Promise<UserContext | null> {
    // Validate API key
    const user = await this.validateAPIKey(apiKey);
    if (!user) return null;

    return {
      userId: user.id,
      organizationId: user.organizationId,
      permissions: user.permissions
    };
  }

  async authorizeWorkspaceAccess(
    userId: string,
    workspaceId: string
  ): Promise<boolean> {
    // Check workspace permissions
    return await this.checkPermission(userId, workspaceId, 'read');
  }
}
```

### Rate Limiting
```typescript
class MCPRateLimiter {
  private limits: Map<string, RateLimit> = new Map();

  async checkLimit(userId: string, tool: string): Promise<boolean> {
    const key = `${userId}:${tool}`;
    const limit = this.limits.get(key) || {
      requestsPerMinute: 60,
      requests: []
    };

    // Clean old requests
    const now = Date.now();
    limit.requests = limit.requests.filter(t => now - t < 60000);

    // Check limit
    if (limit.requests.length >= limit.requestsPerMinute) {
      return false;
    }

    // Record request
    limit.requests.push(now);
    this.limits.set(key, limit);

    return true;
  }
}
```

### Input Validation
```typescript
class MCPInputValidator {
  validateToolInput<T>(schema: JSONSchema, input: unknown): T {
    // Validate against JSON schema
    const result = this.ajv.validate(schema, input);

    if (!result) {
      throw new ValidationError(
        'Invalid input',
        this.ajv.errors || []
      );
    }

    // Sanitize inputs
    return this.sanitize(input as T);
  }

  private sanitize<T>(input: T): T {
    // Remove dangerous characters
    // Escape HTML/SQL injection attempts
    // Validate file paths
    return input;
  }
}
```

## Monitoring & Observability

### Metrics
```typescript
interface MCPMetrics {
  // Request metrics
  'mcp.requests.total': Counter;
  'mcp.requests.duration': Histogram;
  'mcp.requests.errors': Counter;

  // Tool-specific metrics
  'mcp.tool.{name}.requests': Counter;
  'mcp.tool.{name}.duration': Histogram;
  'mcp.tool.{name}.errors': Counter;

  // Resource metrics
  'mcp.resources.reads': Counter;
  'mcp.resources.subscriptions': Gauge;

  // Vector search metrics
  'mcp.vector_search.queries': Counter;
  'mcp.vector_search.duration': Histogram;
  'mcp.vector_search.results': Histogram;
}
```

### Logging
```typescript
class MCPLogger {
  logToolExecution(
    tool: string,
    input: unknown,
    output: unknown,
    duration: number,
    error?: Error
  ) {
    logger.info('MCP tool executed', {
      tool,
      duration,
      inputSize: JSON.stringify(input).length,
      outputSize: JSON.stringify(output).length,
      success: !error,
      error: error?.message,
      timestamp: new Date().toISOString()
    });
  }

  logResourceAccess(uri: string, userId: string) {
    logger.info('MCP resource accessed', {
      uri,
      userId,
      timestamp: new Date().toISOString()
    });
  }
}
```

### Tracing
```typescript
// OpenTelemetry integration
import { trace } from '@opentelemetry/api';

class TracedMCPTool<TInput, TOutput> extends MCPTool<TInput, TOutput> {
  async execute(input: TInput): Promise<TOutput> {
    const span = trace.getTracer('vibecode-mcp').startSpan(`tool.${this.name}`);

    try {
      span.setAttributes({
        'tool.name': this.name,
        'input.size': JSON.stringify(input).length
      });

      const result = await super.execute(input);

      span.setAttributes({
        'output.size': JSON.stringify(result).length,
        'success': true
      });

      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2 }); // ERROR
      throw error;
    } finally {
      span.end();
    }
  }
}
```

## Related Documentation
- [MCP Integration RFC](./MCP_INTEGRATION_RFC.md)
- [MCP Implementation Plan](./MCP_IMPLEMENTATION_PLAN.md)
- [API Documentation](../api/README.md)
