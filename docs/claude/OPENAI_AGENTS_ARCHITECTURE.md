# OpenAI Agents Platform Integration Architecture

**Document Version**: 1.0
**Date**: 2025-10-02
**Status**: Architecture Design
**Author**: System Architect

---

## Executive Summary

This document defines the bidirectional integration architecture between VibeCode and OpenAI's Agent Platform. VibeCode will function both AS an OpenAI Agent (exposing VibeCode capabilities via OpenAI Agent Protocol) and as a HOST for OpenAI Agents (running OpenAI Agents within VibeCode workspaces).

**Key Objectives:**
- Package VibeCode capabilities as OpenAI-compatible agent tools
- Enable OpenAI Agents to execute within VibeCode containerized workspaces
- Provide seamless protocol translation between OpenAI Agent Protocol and existing AgentAPI/MCP infrastructure
- Scale to support multiple concurrent agents with proper isolation and resource management

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [VibeCode AS OpenAI Agent](#2-vibecode-as-openai-agent)
3. [VibeCode HOSTING OpenAI Agents](#3-vibecode-hosting-openai-agents)
4. [API Gateway Design](#4-api-gateway-design)
5. [State Management](#5-state-management)
6. [Tool Registry System](#6-tool-registry-system)
7. [Security Architecture](#7-security-architecture)
8. [Scaling Strategy](#8-scaling-strategy)
9. [Data Flow Diagrams](#9-data-flow-diagrams)
10. [Infrastructure Requirements](#10-infrastructure-requirements)
11. [Deployment Strategy](#11-deployment-strategy)
12. [Implementation Roadmap](#12-implementation-roadmap)

---

## 1. System Overview

### 1.1 Architecture Principles

**Bidirectional Integration Model:**
```
┌─────────────────────────────────────────────────────────┐
│                     VibeCode Platform                    │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌────────────────┐              ┌──────────────────┐   │
│  │  VibeCode AS   │              │   VibeCode AS    │   │
│  │  OpenAI Agent  │◄────────────►│   Agent Host     │   │
│  │  (Outbound)    │              │   (Inbound)      │   │
│  └────────────────┘              └──────────────────┘   │
│         │                                  │             │
│         │                                  │             │
│  ┌──────▼──────────────────────────────────▼─────────┐  │
│  │          OpenAI Agent Protocol Gateway            │  │
│  │        (Bidirectional Protocol Translation)       │  │
│  └────────────────────────────────────────────────────┘ │
│                          │                               │
│  ┌───────────────────────▼──────────────────────────┐   │
│  │         Existing VibeCode Infrastructure         │   │
│  │  - AgentAPI (Aider/Goose/Cline)                  │   │
│  │  - MCP Protocol Support                          │   │
│  │  - Container Orchestration                       │   │
│  │  - WebSocket Infrastructure                      │   │
│  │  - Vector Store & Context Management             │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Integration Boundaries

**External Interfaces:**
- OpenAI Agents API (inbound: hosts external OpenAI Agents)
- OpenAI Agent Tools API (outbound: exposes VibeCode as agent tool)
- OpenAI Assistants API (optional: compatibility with Assistants)

**Internal Systems:**
- AgentAPI protocol (existing Aider/Goose/Cline integration)
- MCP protocol servers (existing tool infrastructure)
- Container runtime (Docker/Kubernetes workspace isolation)
- WebSocket streaming (real-time agent communication)
- Vector store (context/memory persistence)

---

## 2. VibeCode AS OpenAI Agent

### 2.1 Tool Capability Mapping

**VibeCode exposes these capabilities as OpenAI Agent tools:**

```typescript
interface VibeCodeOpenAITools {
  // Code Workspace Operations
  create_workspace: {
    description: "Create isolated development workspace with specified runtime"
    parameters: {
      runtime: "node" | "python" | "go" | "rust" | "java"
      template?: string
      resource_limits?: ResourceSpec
    }
    returns: { workspace_id: string; access_url: string }
  }

  execute_code: {
    description: "Execute code in sandboxed workspace environment"
    parameters: {
      workspace_id: string
      code: string
      language: string
      timeout?: number
    }
    returns: { output: string; exit_code: number; error?: string }
  }

  run_terminal_command: {
    description: "Execute terminal command in workspace"
    parameters: {
      workspace_id: string
      command: string
      cwd?: string
      timeout?: number
    }
    returns: { stdout: string; stderr: string; exit_code: number }
  }

  // File System Operations
  read_file: {
    description: "Read file contents from workspace"
    parameters: {
      workspace_id: string
      path: string
      encoding?: "utf8" | "base64"
    }
    returns: { content: string; metadata: FileMetadata }
  }

  write_file: {
    description: "Write or update file in workspace"
    parameters: {
      workspace_id: string
      path: string
      content: string
      create_dirs?: boolean
    }
    returns: { success: boolean; path: string }
  }

  list_directory: {
    description: "List workspace directory contents"
    parameters: {
      workspace_id: string
      path: string
      recursive?: boolean
    }
    returns: { entries: FileEntry[] }
  }

  // AI-Assisted Code Operations
  analyze_codebase: {
    description: "Perform deep code analysis using VibeCode AI agents"
    parameters: {
      workspace_id: string
      focus?: "architecture" | "quality" | "security" | "performance"
      agent?: "aider" | "goose" | "cline"
    }
    returns: { analysis: CodeAnalysis; recommendations: string[] }
  }

  generate_code: {
    description: "Generate code using VibeCode AI agents"
    parameters: {
      workspace_id: string
      prompt: string
      files_context?: string[]
      agent?: "aider" | "goose" | "cline"
      model?: string
    }
    returns: { generated_files: GeneratedFile[]; explanation: string }
  }

  refactor_code: {
    description: "Refactor existing code with AI assistance"
    parameters: {
      workspace_id: string
      files: string[]
      refactor_goal: string
      agent?: "aider" | "goose" | "cline"
    }
    returns: { changes: CodeChange[]; summary: string }
  }

  // Context & Memory Operations
  query_codebase_context: {
    description: "Semantic search across workspace using vector embeddings"
    parameters: {
      workspace_id: string
      query: string
      max_results?: number
      min_similarity?: number
    }
    returns: { results: ContextResult[]; metadata: SearchMetadata }
  }

  store_conversation_context: {
    description: "Persist conversation context for future sessions"
    parameters: {
      workspace_id: string
      context: ConversationContext
      tags?: string[]
    }
    returns: { context_id: string }
  }

  // Web & Browser Operations
  web_search: {
    description: "Search web for information"
    parameters: {
      query: string
      max_results?: number
      time_range?: "day" | "week" | "month" | "year"
    }
    returns: { results: SearchResult[] }
  }

  browse_webpage: {
    description: "Fetch and parse webpage content"
    parameters: {
      url: string
      extract?: "text" | "markdown" | "html"
      screenshot?: boolean
    }
    returns: { content: string; metadata: PageMetadata; screenshot?: string }
  }

  // Monitoring & Observability
  get_workspace_metrics: {
    description: "Retrieve workspace resource usage and performance metrics"
    parameters: {
      workspace_id: string
      metric_type?: "cpu" | "memory" | "disk" | "network"
      time_range?: string
    }
    returns: { metrics: Metrics; health_status: HealthStatus }
  }
}
```

### 2.2 OpenAI Agent Protocol Adapter

**Component: `openai-agent-adapter.ts`**

```typescript
/**
 * Adapter that exposes VibeCode as OpenAI Agent
 * Translates OpenAI Agent protocol to VibeCode internal APIs
 */

import { OpenAI } from 'openai';
import { AgentAPIClient } from '@/lib/protocols/agentapi-client';
import { MCPClient } from '@/lib/protocols/mcp-client';

interface OpenAIAgentConfig {
  agent_name: string;
  agent_description: string;
  tools: OpenAIToolDefinition[];
  model: string;
  instructions?: string;
}

export class VibeCodeOpenAIAgent {
  private openai: OpenAI;
  private agentId: string;
  private agentApiClient: AgentAPIClient;
  private mcpClients: Map<string, MCPClient>;

  constructor(config: OpenAIAgentConfig) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.agentApiClient = new AgentAPIClient();
    this.mcpClients = new Map();
  }

  /**
   * Register VibeCode as OpenAI Agent
   */
  async register(): Promise<string> {
    const agent = await this.openai.beta.agents.create({
      name: "VibeCode Development Environment",
      description: "Full-featured cloud IDE with AI-powered code generation, analysis, and execution",
      model: "gpt-4o",
      tools: this.buildToolDefinitions(),
      instructions: this.buildAgentInstructions(),
    });

    this.agentId = agent.id;
    return agent.id;
  }

  /**
   * Handle tool execution requests from OpenAI
   */
  async handleToolCall(
    tool_name: string,
    tool_arguments: Record<string, unknown>
  ): Promise<unknown> {
    // Route to appropriate internal handler
    switch (tool_name) {
      case 'create_workspace':
        return await this.createWorkspace(tool_arguments);

      case 'execute_code':
        return await this.executeCode(tool_arguments);

      case 'analyze_codebase':
        return await this.analyzeCodebase(tool_arguments);

      case 'generate_code':
        return await this.generateCode(tool_arguments);

      // ... other tool handlers

      default:
        throw new Error(`Unknown tool: ${tool_name}`);
    }
  }

  /**
   * Create workspace using AgentAPI
   */
  private async createWorkspace(args: any): Promise<any> {
    const response = await this.agentApiClient.startAgent({
      agent_type: 'aider',
      workspace: `/workspaces/${Date.now()}`,
      model: 'claude-3-5-sonnet-20241022',
      task: 'Initialize workspace',
    });

    return {
      workspace_id: response.data.agent_id,
      access_url: `https://vibecode.dev/workspace/${response.data.agent_id}`,
      status: 'ready',
    };
  }

  /**
   * Execute code using AgentAPI
   */
  private async executeCode(args: any): Promise<any> {
    const { workspace_id, code, language } = args;

    const response = await this.agentApiClient.sendMessage(
      workspace_id,
      { content: `Execute this ${language} code:\n\`\`\`${language}\n${code}\n\`\`\`` }
    );

    // Stream output and wait for completion
    const eventSource = this.agentApiClient.createEventStream(workspace_id);

    return new Promise((resolve) => {
      let output = '';

      eventSource.addEventListener('output', (event) => {
        output += JSON.parse(event.data).line;
      });

      eventSource.addEventListener('complete', (event) => {
        const data = JSON.parse(event.data);
        eventSource.close();
        resolve({
          output,
          exit_code: data.exit_code,
          status: 'completed',
        });
      });
    });
  }

  /**
   * Analyze codebase using MCP/AgentAPI agents
   */
  private async analyzeCodebase(args: any): Promise<any> {
    const { workspace_id, focus, agent = 'aider' } = args;

    // Use sequential-thinking MCP for complex analysis
    const mcpClient = await this.getMCPClient('sequential-thinking');

    const analysisPrompt = `Analyze codebase in workspace ${workspace_id} focusing on ${focus}`;

    const result = await mcpClient.invokeTool('sequential_thinking', {
      thought: analysisPrompt,
      next_thought_needed: true,
    });

    return {
      analysis: result,
      recommendations: this.extractRecommendations(result),
      confidence_score: 0.85,
    };
  }

  /**
   * Build OpenAI tool definitions from VibeCode capabilities
   */
  private buildToolDefinitions(): OpenAIToolDefinition[] {
    return [
      {
        type: 'function',
        function: {
          name: 'create_workspace',
          description: 'Create isolated development workspace',
          parameters: {
            type: 'object',
            properties: {
              runtime: {
                type: 'string',
                enum: ['node', 'python', 'go', 'rust', 'java'],
                description: 'Runtime environment',
              },
              template: {
                type: 'string',
                description: 'Project template name',
              },
            },
            required: ['runtime'],
          },
        },
      },
      // ... additional tool definitions
    ];
  }

  /**
   * Build agent instructions
   */
  private buildAgentInstructions(): string {
    return `You are VibeCode, a powerful cloud development environment with AI capabilities.

You can:
- Create isolated workspaces with various runtimes (Node.js, Python, Go, etc.)
- Execute code and terminal commands in sandboxed environments
- Read, write, and analyze files
- Generate, refactor, and analyze code using AI agents (Aider, Goose, Cline)
- Search codebases semantically using vector embeddings
- Browse the web and search for information
- Monitor workspace resource usage and performance

Best practices:
- Always create a workspace before executing code
- Use appropriate AI agents for different tasks (Aider for editing, Goose for planning, Cline for complex tasks)
- Consider resource limits when creating workspaces
- Store important context for future sessions
- Clean up workspaces when done to free resources`;
  }
}
```

### 2.3 Tool Function Implementations

**Component: `openai-tool-handlers.ts`**

Each tool function implements the bridge between OpenAI's expectations and VibeCode's internal APIs, handling:
- Parameter validation and transformation
- Authentication and authorization
- Resource allocation and cleanup
- Error handling and retries
- Response formatting

---

## 3. VibeCode HOSTING OpenAI Agents

### 3.1 OpenAI Agent Runtime Environment

**Architecture:**

```
┌───────────────────────────────────────────────────────┐
│                 VibeCode Agent Host                    │
├───────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────┐    │
│  │     OpenAI Agent Execution Controller         │    │
│  │  - Agent lifecycle management                 │    │
│  │  - Thread/conversation tracking               │    │
│  │  - Tool call orchestration                    │    │
│  │  - Streaming response handling                │    │
│  └──────────────────────────────────────────────┘    │
│                      │                                 │
│  ┌───────────────────▼──────────────────────────┐    │
│  │        OpenAI Agents Sandbox Layer            │    │
│  │  - Isolated container per agent               │    │
│  │  - Tool execution sandboxing                  │    │
│  │  - Resource limit enforcement                 │    │
│  │  - Network policy controls                    │    │
│  └──────────────────────────────────────────────┘    │
│                      │                                 │
│  ┌───────────────────▼──────────────────────────┐    │
│  │      Tool Bridge to VibeCode Services         │    │
│  │  - File system operations                     │    │
│  │  - Terminal/shell access                      │    │
│  │  - Code execution                             │    │
│  │  - Vector store queries                       │    │
│  └──────────────────────────────────────────────┘    │
│                                                         │
└───────────────────────────────────────────────────────┘
```

### 3.2 OpenAI Agent Execution Controller

**Component: `openai-agent-controller.ts`**

```typescript
/**
 * Controls execution of OpenAI Agents within VibeCode
 */

import { OpenAI } from 'openai';
import { createAgentAPIClient } from '@/lib/protocols/agentapi-client';
import { ContainerRuntime } from '@/lib/container-runtime';

interface OpenAIAgentSession {
  agent_id: string;
  thread_id: string;
  workspace_id: string;
  container_id: string;
  status: 'initializing' | 'running' | 'waiting' | 'stopped';
  created_at: number;
  last_activity: number;
}

export class OpenAIAgentController {
  private openai: OpenAI;
  private runtime: ContainerRuntime;
  private sessions: Map<string, OpenAIAgentSession>;
  private toolBridge: ToolBridge;

  constructor() {
    this.openai = new OpenAI();
    this.runtime = new ContainerRuntime();
    this.sessions = new Map();
    this.toolBridge = new ToolBridge();
  }

  /**
   * Start OpenAI Agent in VibeCode workspace
   */
  async startAgent(config: {
    agent_id: string;
    workspace_id: string;
    initial_message: string;
    tools?: AgentTool[];
  }): Promise<OpenAIAgentSession> {
    // Create isolated container for agent
    const container = await this.runtime.createContainer({
      workspace_id: config.workspace_id,
      image: 'vibecode/openai-agent-runtime:latest',
      resource_limits: {
        cpu: '2',
        memory: '4Gi',
      },
      network_policy: 'restricted',
    });

    // Create OpenAI thread
    const thread = await this.openai.beta.threads.create({
      metadata: {
        workspace_id: config.workspace_id,
        container_id: container.id,
      },
    });

    // Register session
    const session: OpenAIAgentSession = {
      agent_id: config.agent_id,
      thread_id: thread.id,
      workspace_id: config.workspace_id,
      container_id: container.id,
      status: 'initializing',
      created_at: Date.now(),
      last_activity: Date.now(),
    };

    this.sessions.set(session.agent_id, session);

    // Send initial message
    await this.openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: config.initial_message,
    });

    // Start agent run
    const run = await this.openai.beta.threads.runs.create(thread.id, {
      agent_id: config.agent_id,
    });

    // Monitor run and handle tool calls
    await this.monitorRun(session, run.id);

    return session;
  }

  /**
   * Monitor agent run and handle tool calls
   */
  private async monitorRun(
    session: OpenAIAgentSession,
    run_id: string
  ): Promise<void> {
    const stream = await this.openai.beta.threads.runs.stream(
      session.thread_id,
      run_id
    );

    for await (const event of stream) {
      switch (event.event) {
        case 'thread.run.requires_action':
          await this.handleToolCalls(session, event.data);
          break;

        case 'thread.message.created':
          this.emit('message', {
            session_id: session.agent_id,
            message: event.data,
          });
          break;

        case 'thread.run.completed':
          session.status = 'waiting';
          session.last_activity = Date.now();
          break;

        case 'thread.run.failed':
          session.status = 'stopped';
          this.emit('error', {
            session_id: session.agent_id,
            error: event.data.last_error,
          });
          break;
      }
    }
  }

  /**
   * Handle tool calls from OpenAI Agent
   */
  private async handleToolCalls(
    session: OpenAIAgentSession,
    run_data: any
  ): Promise<void> {
    const tool_outputs = [];

    for (const tool_call of run_data.required_action.submit_tool_outputs.tool_calls) {
      try {
        // Execute tool in sandboxed environment
        const output = await this.toolBridge.executeTool({
          workspace_id: session.workspace_id,
          container_id: session.container_id,
          tool_name: tool_call.function.name,
          tool_arguments: JSON.parse(tool_call.function.arguments),
        });

        tool_outputs.push({
          tool_call_id: tool_call.id,
          output: JSON.stringify(output),
        });
      } catch (error) {
        tool_outputs.push({
          tool_call_id: tool_call.id,
          output: JSON.stringify({
            error: error.message,
            type: 'tool_execution_error',
          }),
        });
      }
    }

    // Submit tool outputs back to OpenAI
    await this.openai.beta.threads.runs.submitToolOutputs(
      session.thread_id,
      run_data.id,
      { tool_outputs }
    );
  }

  /**
   * Send message to running agent
   */
  async sendMessage(
    agent_id: string,
    message: string
  ): Promise<void> {
    const session = this.sessions.get(agent_id);
    if (!session) throw new Error('Agent session not found');

    await this.openai.beta.threads.messages.create(session.thread_id, {
      role: 'user',
      content: message,
    });

    const run = await this.openai.beta.threads.runs.create(session.thread_id, {
      agent_id: session.agent_id,
    });

    await this.monitorRun(session, run.id);
  }

  /**
   * Stop agent and cleanup resources
   */
  async stopAgent(agent_id: string): Promise<void> {
    const session = this.sessions.get(agent_id);
    if (!session) return;

    // Stop container
    await this.runtime.stopContainer(session.container_id);

    // Delete thread (optional)
    // await this.openai.beta.threads.del(session.thread_id);

    // Remove session
    this.sessions.delete(agent_id);
  }

  /**
   * List active agent sessions
   */
  listSessions(): OpenAIAgentSession[] {
    return Array.from(this.sessions.values());
  }
}
```

### 3.3 Tool Bridge Implementation

**Component: `tool-bridge.ts`**

Provides sandboxed access to VibeCode capabilities for OpenAI Agents:

```typescript
/**
 * Bridges OpenAI Agent tool calls to VibeCode services
 * Enforces security policies and resource limits
 */

export class ToolBridge {
  private agentApiClient: AgentAPIClient;
  private fileSystemService: FileSystemService;
  private executionService: ExecutionService;
  private vectorStoreClient: VectorStoreClient;

  /**
   * Execute tool call with security checks
   */
  async executeTool(request: {
    workspace_id: string;
    container_id: string;
    tool_name: string;
    tool_arguments: Record<string, unknown>;
  }): Promise<unknown> {
    // Validate permissions
    await this.validateToolAccess(request.workspace_id, request.tool_name);

    // Route to appropriate service
    switch (request.tool_name) {
      case 'read_file':
        return await this.handleReadFile(request);

      case 'write_file':
        return await this.handleWriteFile(request);

      case 'execute_shell_command':
        return await this.handleExecuteCommand(request);

      case 'search_codebase':
        return await this.handleSearchCodebase(request);

      default:
        throw new Error(`Unsupported tool: ${request.tool_name}`);
    }
  }

  /**
   * Validate tool access permissions
   */
  private async validateToolAccess(
    workspace_id: string,
    tool_name: string
  ): Promise<void> {
    // Check workspace permissions
    // Check tool allowlist
    // Check rate limits
    // Check resource quotas
  }

  /**
   * Handle file read with path validation
   */
  private async handleReadFile(request: any): Promise<any> {
    const { workspace_id, tool_arguments } = request;
    const { path } = tool_arguments;

    // Validate path is within workspace
    this.validatePath(path);

    // Read file from workspace container
    const content = await this.fileSystemService.readFile(
      workspace_id,
      path
    );

    return {
      content,
      path,
      size: content.length,
      encoding: 'utf8',
    };
  }

  /**
   * Handle file write with validation
   */
  private async handleWriteFile(request: any): Promise<any> {
    const { workspace_id, tool_arguments } = request;
    const { path, content } = tool_arguments;

    // Validate path and content
    this.validatePath(path);
    this.validateFileSize(content);

    // Write file to workspace container
    await this.fileSystemService.writeFile(
      workspace_id,
      path,
      content
    );

    return {
      success: true,
      path,
      size: content.length,
    };
  }

  /**
   * Handle shell command execution
   */
  private async handleExecuteCommand(request: any): Promise<any> {
    const { workspace_id, container_id, tool_arguments } = request;
    const { command, timeout = 30000 } = tool_arguments;

    // Validate command safety
    this.validateCommand(command);

    // Execute in container with timeout
    const result = await this.executionService.executeInContainer(
      container_id,
      command,
      { timeout }
    );

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exit_code: result.exit_code,
      execution_time: result.duration,
    };
  }

  /**
   * Handle codebase search
   */
  private async handleSearchCodebase(request: any): Promise<any> {
    const { workspace_id, tool_arguments } = request;
    const { query, max_results = 10 } = tool_arguments;

    // Query vector store
    const results = await this.vectorStoreClient.search(
      workspace_id,
      query,
      max_results
    );

    return {
      results: results.map(r => ({
        file: r.metadata.file,
        line: r.metadata.line,
        content: r.content,
        similarity: r.score,
      })),
      query,
      total_results: results.length,
    };
  }

  /**
   * Security validation methods
   */
  private validatePath(path: string): void {
    if (path.includes('..') || path.startsWith('/')) {
      throw new Error('Invalid path: path traversal detected');
    }
  }

  private validateCommand(command: string): void {
    const blockedCommands = ['rm -rf /', 'dd if=', 'mkfs', ':(){:|:&};:'];
    if (blockedCommands.some(cmd => command.includes(cmd))) {
      throw new Error('Dangerous command blocked');
    }
  }

  private validateFileSize(content: string): void {
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (content.length > maxSize) {
      throw new Error('File size exceeds limit');
    }
  }
}
```

---

## 4. API Gateway Design

### 4.1 OpenAI Agent Protocol Gateway

**Component: `openai-protocol-gateway.ts`**

Central gateway that handles protocol translation and routing:

```typescript
/**
 * API Gateway for OpenAI Agent Protocol
 * Handles bidirectional communication and protocol translation
 */

export class OpenAIProtocolGateway {
  private vibeCodeAgent: VibeCodeOpenAIAgent;
  private agentController: OpenAIAgentController;
  private router: ProtocolRouter;
  private rateLimiter: RateLimiter;
  private authService: AuthService;

  /**
   * Initialize gateway with both directions
   */
  async initialize(): Promise<void> {
    // Initialize VibeCode AS agent (outbound)
    this.vibeCodeAgent = new VibeCodeOpenAIAgent({
      agent_name: 'VibeCode',
      agent_description: 'Cloud IDE with AI capabilities',
      tools: this.buildToolDefinitions(),
      model: 'gpt-4o',
    });
    await this.vibeCodeAgent.register();

    // Initialize agent controller (inbound)
    this.agentController = new OpenAIAgentController();

    // Setup routing
    this.setupRouting();
  }

  /**
   * Setup API routing
   */
  private setupRouting(): void {
    // Outbound: VibeCode tool calls
    this.router.post('/openai/tools/:tool_name', async (req, res) => {
      await this.handleToolCall(req, res);
    });

    // Inbound: Start OpenAI Agent in VibeCode
    this.router.post('/openai/agents/start', async (req, res) => {
      await this.startHostedAgent(req, res);
    });

    // Inbound: Send message to hosted agent
    this.router.post('/openai/agents/:agent_id/messages', async (req, res) => {
      await this.sendMessageToAgent(req, res);
    });

    // Inbound: Get agent status
    this.router.get('/openai/agents/:agent_id', async (req, res) => {
      await this.getAgentStatus(req, res);
    });

    // Inbound: Stop hosted agent
    this.router.delete('/openai/agents/:agent_id', async (req, res) => {
      await this.stopHostedAgent(req, res);
    });

    // Bidirectional: Health check
    this.router.get('/openai/health', async (req, res) => {
      await this.healthCheck(req, res);
    });
  }

  /**
   * Handle tool call from external OpenAI Agent
   */
  private async handleToolCall(req: Request, res: Response): Promise<void> {
    const { tool_name } = req.params;
    const tool_arguments = req.body;

    // Authenticate
    const user = await this.authService.authenticate(req);

    // Rate limit
    await this.rateLimiter.checkLimit(user.id, 'tool_call');

    try {
      const result = await this.vibeCodeAgent.handleToolCall(
        tool_name,
        tool_arguments
      );

      res.json({
        success: true,
        result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Start hosted OpenAI Agent
   */
  private async startHostedAgent(req: Request, res: Response): Promise<void> {
    const { agent_id, workspace_id, initial_message, tools } = req.body;

    // Authenticate
    const user = await this.authService.authenticate(req);

    // Validate workspace access
    await this.authService.validateWorkspaceAccess(user.id, workspace_id);

    try {
      const session = await this.agentController.startAgent({
        agent_id,
        workspace_id,
        initial_message,
        tools,
      });

      res.json({
        success: true,
        session,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
```

### 4.2 API Endpoints Specification

**OpenAPI/Swagger Specification:**

```yaml
openapi: 3.1.0
info:
  title: VibeCode OpenAI Agents API
  version: 1.0.0
  description: Bidirectional OpenAI Agents integration API

servers:
  - url: https://api.vibecode.dev/v1
    description: Production
  - url: http://localhost:3000/api/v1
    description: Development

paths:
  # Outbound: VibeCode AS OpenAI Agent
  /openai/tools/{tool_name}:
    post:
      summary: Execute VibeCode tool
      operationId: executeVibeCodeTool
      parameters:
        - name: tool_name
          in: path
          required: true
          schema:
            type: string
            enum:
              - create_workspace
              - execute_code
              - read_file
              - write_file
              - analyze_codebase
              - generate_code
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              additionalProperties: true
      responses:
        200:
          description: Tool execution result
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ToolResult'
        401:
          $ref: '#/components/responses/Unauthorized'
        429:
          $ref: '#/components/responses/RateLimited'

  # Inbound: VibeCode HOSTING OpenAI Agents
  /openai/agents/start:
    post:
      summary: Start OpenAI Agent in VibeCode
      operationId: startOpenAIAgent
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - agent_id
                - workspace_id
                - initial_message
              properties:
                agent_id:
                  type: string
                  description: OpenAI Agent ID
                workspace_id:
                  type: string
                  description: VibeCode workspace ID
                initial_message:
                  type: string
                  description: Initial message to agent
                tools:
                  type: array
                  items:
                    $ref: '#/components/schemas/AgentTool'
      responses:
        200:
          description: Agent session started
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AgentSession'

  /openai/agents/{agent_id}/messages:
    post:
      summary: Send message to hosted agent
      operationId: sendAgentMessage
      parameters:
        - name: agent_id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - message
              properties:
                message:
                  type: string
      responses:
        200:
          description: Message sent successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MessageResponse'

  /openai/agents/{agent_id}:
    get:
      summary: Get agent status
      operationId: getAgentStatus
      parameters:
        - name: agent_id
          in: path
          required: true
          schema:
            type: string
      responses:
        200:
          description: Agent status
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AgentSession'

    delete:
      summary: Stop hosted agent
      operationId: stopAgent
      parameters:
        - name: agent_id
          in: path
          required: true
          schema:
            type: string
      responses:
        200:
          description: Agent stopped successfully

  /openai/agents/{agent_id}/events:
    get:
      summary: Stream agent events (SSE)
      operationId: streamAgentEvents
      parameters:
        - name: agent_id
          in: path
          required: true
          schema:
            type: string
      responses:
        200:
          description: Event stream
          content:
            text/event-stream:
              schema:
                type: string

components:
  schemas:
    ToolResult:
      type: object
      required:
        - success
        - result
      properties:
        success:
          type: boolean
        result:
          type: object
        error:
          type: string
        timestamp:
          type: string
          format: date-time

    AgentSession:
      type: object
      required:
        - agent_id
        - thread_id
        - workspace_id
        - status
      properties:
        agent_id:
          type: string
        thread_id:
          type: string
        workspace_id:
          type: string
        container_id:
          type: string
        status:
          type: string
          enum: [initializing, running, waiting, stopped]
        created_at:
          type: integer
          format: int64
        last_activity:
          type: integer
          format: int64

    AgentTool:
      type: object
      required:
        - name
        - description
      properties:
        name:
          type: string
        description:
          type: string
        parameters:
          type: object

    MessageResponse:
      type: object
      required:
        - success
      properties:
        success:
          type: boolean
        message_id:
          type: string
        timestamp:
          type: string
          format: date-time

  responses:
    Unauthorized:
      description: Authentication required
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: string
                example: "Unauthorized"

    RateLimited:
      description: Rate limit exceeded
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: string
              retry_after:
                type: integer
                description: Seconds until retry allowed

  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

security:
  - BearerAuth: []
```

---

## 5. State Management

### 5.1 State Architecture

**Multi-layer state management:**

```
┌─────────────────────────────────────────────────────┐
│              State Management Layers                 │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌────────────────────────────────────────────┐     │
│  │     Agent Session State (In-Memory)        │     │
│  │  - Active agent instances                  │     │
│  │  - WebSocket connections                   │     │
│  │  - Real-time execution state               │     │
│  │  Storage: Redis + Local Memory             │     │
│  │  TTL: 1 hour (with activity refresh)       │     │
│  └────────────────────────────────────────────┘     │
│                      │                               │
│  ┌────────────────────▼───────────────────────┐     │
│  │   Conversation Context (Short-term)        │     │
│  │  - Thread messages                         │     │
│  │  - Tool call history                       │     │
│  │  - Workspace context                       │     │
│  │  Storage: PostgreSQL                       │     │
│  │  Retention: 30 days                        │     │
│  └────────────────────────────────────────────┘     │
│                      │                               │
│  ┌────────────────────▼───────────────────────┐     │
│  │    Knowledge Base (Long-term)              │     │
│  │  - Codebase embeddings                     │     │
│  │  - Project documentation                   │     │
│  │  - Historical insights                     │     │
│  │  Storage: Vector DB (Weaviate/Chroma)     │     │
│  │  Retention: Indefinite                     │     │
│  └────────────────────────────────────────────┘     │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### 5.2 State Synchronization

**Component: `state-manager.ts`**

```typescript
/**
 * State management for OpenAI Agent sessions
 */

import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { VectorStoreClient } from '@/lib/vector-store';

interface AgentState {
  agent_id: string;
  thread_id: string;
  workspace_id: string;
  status: 'active' | 'idle' | 'terminated';
  created_at: number;
  last_activity: number;
  message_count: number;
  tool_calls_count: number;
  metadata: Record<string, unknown>;
}

export class StateManager {
  private redis: Redis;
  private db: PrismaClient;
  private vectorStore: VectorStoreClient;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });
    this.db = new PrismaClient();
    this.vectorStore = new VectorStoreClient();
  }

  /**
   * Store agent session state (in-memory + persistent)
   */
  async saveAgentState(state: AgentState): Promise<void> {
    // In-memory cache (Redis)
    await this.redis.setex(
      `agent:${state.agent_id}`,
      3600, // 1 hour TTL
      JSON.stringify(state)
    );

    // Persistent storage (PostgreSQL)
    await this.db.agentSession.upsert({
      where: { agent_id: state.agent_id },
      update: {
        status: state.status,
        last_activity: new Date(state.last_activity),
        message_count: state.message_count,
        tool_calls_count: state.tool_calls_count,
        metadata: state.metadata,
      },
      create: {
        agent_id: state.agent_id,
        thread_id: state.thread_id,
        workspace_id: state.workspace_id,
        status: state.status,
        created_at: new Date(state.created_at),
        last_activity: new Date(state.last_activity),
        message_count: state.message_count,
        tool_calls_count: state.tool_calls_count,
        metadata: state.metadata,
      },
    });
  }

  /**
   * Retrieve agent state (cache-first)
   */
  async getAgentState(agent_id: string): Promise<AgentState | null> {
    // Try cache first
    const cached = await this.redis.get(`agent:${agent_id}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fallback to database
    const session = await this.db.agentSession.findUnique({
      where: { agent_id },
    });

    if (!session) return null;

    const state: AgentState = {
      agent_id: session.agent_id,
      thread_id: session.thread_id,
      workspace_id: session.workspace_id,
      status: session.status as any,
      created_at: session.created_at.getTime(),
      last_activity: session.last_activity.getTime(),
      message_count: session.message_count,
      tool_calls_count: session.tool_calls_count,
      metadata: session.metadata as any,
    };

    // Repopulate cache
    await this.redis.setex(
      `agent:${agent_id}`,
      3600,
      JSON.stringify(state)
    );

    return state;
  }

  /**
   * Store conversation message
   */
  async saveMessage(message: {
    thread_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.message.create({
      data: {
        thread_id: message.thread_id,
        role: message.role,
        content: message.content,
        metadata: message.metadata,
        created_at: new Date(),
      },
    });

    // Also embed message for semantic search
    await this.vectorStore.addDocument({
      content: message.content,
      metadata: {
        type: 'conversation',
        thread_id: message.thread_id,
        role: message.role,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(
    thread_id: string,
    limit = 50
  ): Promise<Array<{ role: string; content: string }>> {
    const messages = await this.db.message.findMany({
      where: { thread_id },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return messages.reverse().map(m => ({
      role: m.role,
      content: m.content,
    }));
  }

  /**
   * Store tool call result
   */
  async saveToolCall(toolCall: {
    agent_id: string;
    tool_name: string;
    arguments: Record<string, unknown>;
    result: unknown;
    duration_ms: number;
    success: boolean;
  }): Promise<void> {
    await this.db.toolCall.create({
      data: {
        agent_id: toolCall.agent_id,
        tool_name: toolCall.tool_name,
        arguments: toolCall.arguments,
        result: toolCall.result,
        duration_ms: toolCall.duration_ms,
        success: toolCall.success,
        created_at: new Date(),
      },
    });

    // Update agent state metrics
    await this.redis.incr(`agent:${toolCall.agent_id}:tool_calls`);
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    const expiryTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours

    await this.db.agentSession.updateMany({
      where: {
        last_activity: { lt: new Date(expiryTime) },
        status: { not: 'terminated' },
      },
      data: {
        status: 'terminated',
      },
    });
  }
}
```

### 5.3 Database Schema

**Prisma Schema:**

```prisma
model AgentSession {
  id             String   @id @default(cuid())
  agent_id       String   @unique
  thread_id      String   @unique
  workspace_id   String
  status         String   // active, idle, terminated
  created_at     DateTime @default(now())
  last_activity  DateTime @default(now())
  message_count  Int      @default(0)
  tool_calls_count Int    @default(0)
  metadata       Json?

  workspace      Workspace @relation(fields: [workspace_id], references: [id])
  messages       Message[]
  tool_calls     ToolCall[]

  @@index([workspace_id])
  @@index([status])
  @@index([last_activity])
}

model Message {
  id         String   @id @default(cuid())
  thread_id  String
  role       String   // user, assistant, system
  content    String   @db.Text
  metadata   Json?
  created_at DateTime @default(now())

  session    AgentSession @relation(fields: [thread_id], references: [thread_id])

  @@index([thread_id])
  @@index([created_at])
}

model ToolCall {
  id          String   @id @default(cuid())
  agent_id    String
  tool_name   String
  arguments   Json
  result      Json?
  duration_ms Int
  success     Boolean
  error       String?
  created_at  DateTime @default(now())

  session     AgentSession @relation(fields: [agent_id], references: [agent_id])

  @@index([agent_id])
  @@index([tool_name])
  @@index([created_at])
}

model Workspace {
  id            String   @id @default(cuid())
  user_id       String
  name          String
  runtime       String
  status        String
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  agent_sessions AgentSession[]

  @@index([user_id])
  @@index([status])
}
```

---

## 6. Tool Registry System

### 6.1 Tool Discovery and Registration

**Component: `tool-registry.ts`**

```typescript
/**
 * Central registry for OpenAI Agent tools
 * Handles discovery, validation, and execution routing
 */

interface ToolDefinition {
  name: string;
  description: string;
  category: 'workspace' | 'code' | 'ai' | 'data' | 'web' | 'monitoring';
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      required?: boolean;
    }>;
    required: string[];
  };
  handler: (args: any, context: ToolContext) => Promise<any>;
  permissions: string[];
  rate_limit?: {
    calls_per_minute: number;
    calls_per_hour: number;
  };
  resource_cost?: {
    cpu_units: number;
    memory_mb: number;
    estimated_duration_ms: number;
  };
}

interface ToolContext {
  workspace_id: string;
  user_id: string;
  agent_id: string;
  session_metadata: Record<string, unknown>;
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition>;
  private rateLimiter: RateLimiter;
  private permissionService: PermissionService;

  constructor() {
    this.tools = new Map();
    this.rateLimiter = new RateLimiter();
    this.permissionService = new PermissionService();
    this.registerBuiltInTools();
  }

  /**
   * Register built-in VibeCode tools
   */
  private registerBuiltInTools(): void {
    // Workspace tools
    this.registerTool({
      name: 'create_workspace',
      description: 'Create new isolated development workspace',
      category: 'workspace',
      parameters: {
        type: 'object',
        properties: {
          runtime: {
            type: 'string',
            description: 'Runtime environment',
            enum: ['node', 'python', 'go', 'rust', 'java'],
          },
          template: {
            type: 'string',
            description: 'Project template name',
          },
        },
        required: ['runtime'],
      },
      handler: async (args, context) => {
        const agentClient = new AgentAPIClient();
        const response = await agentClient.startAgent({
          agent_type: 'aider',
          workspace: `/workspaces/${Date.now()}`,
          model: 'claude-3-5-sonnet-20241022',
          task: `Initialize ${args.runtime} workspace`,
        });
        return {
          workspace_id: response.data.agent_id,
          access_url: `https://vibecode.dev/workspace/${response.data.agent_id}`,
        };
      },
      permissions: ['workspace:create'],
      rate_limit: {
        calls_per_minute: 10,
        calls_per_hour: 100,
      },
      resource_cost: {
        cpu_units: 2,
        memory_mb: 4096,
        estimated_duration_ms: 5000,
      },
    });

    // Code execution tools
    this.registerTool({
      name: 'execute_code',
      description: 'Execute code in sandbox',
      category: 'code',
      parameters: {
        type: 'object',
        properties: {
          workspace_id: {
            type: 'string',
            description: 'Workspace ID',
          },
          code: {
            type: 'string',
            description: 'Code to execute',
          },
          language: {
            type: 'string',
            description: 'Programming language',
          },
        },
        required: ['workspace_id', 'code', 'language'],
      },
      handler: async (args, context) => {
        // Implementation from earlier sections
      },
      permissions: ['code:execute'],
      rate_limit: {
        calls_per_minute: 30,
        calls_per_hour: 500,
      },
    });

    // AI agent tools
    this.registerTool({
      name: 'analyze_codebase',
      description: 'AI-powered code analysis',
      category: 'ai',
      parameters: {
        type: 'object',
        properties: {
          workspace_id: { type: 'string', description: 'Workspace ID' },
          focus: {
            type: 'string',
            description: 'Analysis focus',
            enum: ['architecture', 'quality', 'security', 'performance'],
          },
        },
        required: ['workspace_id'],
      },
      handler: async (args, context) => {
        // Implementation from earlier sections
      },
      permissions: ['ai:analyze'],
      rate_limit: {
        calls_per_minute: 5,
        calls_per_hour: 50,
      },
    });

    // Additional tools for file operations, web search, etc.
    // ... (similar pattern)
  }

  /**
   * Register custom tool
   */
  registerTool(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Get tool definition
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * List all available tools
   */
  listTools(category?: string): ToolDefinition[] {
    const tools = Array.from(this.tools.values());
    if (category) {
      return tools.filter(t => t.category === category);
    }
    return tools;
  }

  /**
   * Execute tool with validation and rate limiting
   */
  async executeTool(
    name: string,
    args: any,
    context: ToolContext
  ): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }

    // Validate permissions
    await this.permissionService.validatePermissions(
      context.user_id,
      tool.permissions
    );

    // Check rate limits
    if (tool.rate_limit) {
      await this.rateLimiter.checkLimit(
        context.user_id,
        name,
        tool.rate_limit
      );
    }

    // Validate arguments
    this.validateArguments(args, tool.parameters);

    // Execute tool handler
    const startTime = Date.now();
    try {
      const result = await tool.handler(args, context);
      const duration = Date.now() - startTime;

      // Log execution metrics
      this.logToolExecution({
        tool_name: name,
        user_id: context.user_id,
        workspace_id: context.workspace_id,
        duration_ms: duration,
        success: true,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log failure
      this.logToolExecution({
        tool_name: name,
        user_id: context.user_id,
        workspace_id: context.workspace_id,
        duration_ms: duration,
        success: false,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Convert to OpenAI tool format
   */
  toOpenAIFormat(): Array<OpenAIToolDefinition> {
    return Array.from(this.tools.values()).map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Validate tool arguments against schema
   */
  private validateArguments(args: any, schema: any): void {
    // JSON Schema validation
    // Implementation using ajv or similar validator
  }

  /**
   * Log tool execution metrics
   */
  private logToolExecution(metrics: {
    tool_name: string;
    user_id: string;
    workspace_id: string;
    duration_ms: number;
    success: boolean;
    error?: string;
  }): void {
    // Send to monitoring system (Datadog/OpenTelemetry)
    console.log('Tool execution:', metrics);
  }
}
```

### 6.2 Dynamic Tool Loading

Support for user-defined and plugin tools:

```typescript
/**
 * Plugin system for custom tools
 */

interface ToolPlugin {
  name: string;
  version: string;
  tools: ToolDefinition[];
  initialize?: () => Promise<void>;
  cleanup?: () => Promise<void>;
}

export class PluginManager {
  private plugins: Map<string, ToolPlugin>;
  private registry: ToolRegistry;

  constructor(registry: ToolRegistry) {
    this.plugins = new Map();
    this.registry = registry;
  }

  /**
   * Load plugin from package
   */
  async loadPlugin(pluginPath: string): Promise<void> {
    const plugin = await import(pluginPath) as ToolPlugin;

    // Validate plugin
    this.validatePlugin(plugin);

    // Initialize if needed
    if (plugin.initialize) {
      await plugin.initialize();
    }

    // Register tools
    for (const tool of plugin.tools) {
      this.registry.registerTool(tool);
    }

    this.plugins.set(plugin.name, plugin);
  }

  /**
   * Unload plugin
   */
  async unloadPlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) return;

    // Cleanup
    if (plugin.cleanup) {
      await plugin.cleanup();
    }

    // Unregister tools
    for (const tool of plugin.tools) {
      this.registry.unregisterTool(tool.name);
    }

    this.plugins.delete(pluginName);
  }

  private validatePlugin(plugin: ToolPlugin): void {
    if (!plugin.name || !plugin.version || !Array.isArray(plugin.tools)) {
      throw new Error('Invalid plugin format');
    }
  }
}
```

---

## 7. Security Architecture

### 7.1 Security Layers

```
┌─────────────────────────────────────────────────────┐
│            Security Architecture Layers              │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌────────────────────────────────────────────┐     │
│  │   Layer 1: Authentication & Authorization   │     │
│  │  - JWT token validation                     │     │
│  │  - API key management                       │     │
│  │  - Role-based access control (RBAC)         │     │
│  │  - Workspace-level permissions              │     │
│  └────────────────────────────────────────────┘     │
│                      │                               │
│  ┌────────────────────▼───────────────────────┐     │
│  │   Layer 2: Request Validation & Filtering   │     │
│  │  - Input sanitization                       │     │
│  │  - Parameter validation                     │     │
│  │  - Rate limiting                            │     │
│  │  - Quota enforcement                        │     │
│  └────────────────────────────────────────────┘     │
│                      │                               │
│  ┌────────────────────▼───────────────────────┐     │
│  │   Layer 3: Sandbox Isolation                │     │
│  │  - Container-based isolation                │     │
│  │  - Network policy enforcement               │     │
│  │  - Resource limits (CPU, memory, disk)      │     │
│  │  - File system restrictions                 │     │
│  └────────────────────────────────────────────┘     │
│                      │                               │
│  ┌────────────────────▼───────────────────────┐     │
│  │   Layer 4: Data Protection                  │     │
│  │  - Encryption at rest (AES-256)             │     │
│  │  - Encryption in transit (TLS 1.3)          │     │
│  │  - Secret management (Vault/KMS)            │     │
│  │  - PII detection and masking                │     │
│  └────────────────────────────────────────────┘     │
│                      │                               │
│  ┌────────────────────▼───────────────────────┐     │
│  │   Layer 5: Monitoring & Auditing            │     │
│  │  - Security event logging                   │     │
│  │  - Anomaly detection                        │     │
│  │  - Compliance reporting                     │     │
│  │  - Incident response automation             │     │
│  └────────────────────────────────────────────┘     │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### 7.2 Authentication and Authorization

**Component: `auth-service.ts`**

```typescript
/**
 * Authentication and authorization service
 */

import { verify } from 'jsonwebtoken';
import { hash, compare } from 'bcryptjs';

interface User {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  api_keys: ApiKey[];
}

interface ApiKey {
  id: string;
  key_hash: string;
  name: string;
  permissions: string[];
  expires_at?: Date;
  last_used?: Date;
}

export class AuthService {
  private db: PrismaClient;
  private jwtSecret: string;

  constructor() {
    this.db = new PrismaClient();
    this.jwtSecret = process.env.JWT_SECRET!;
  }

  /**
   * Authenticate request
   */
  async authenticate(req: Request): Promise<User> {
    // Try JWT token first
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      return await this.validateJWT(token);
    }

    // Try API key
    const apiKey = req.headers.get('x-api-key');
    if (apiKey) {
      return await this.validateApiKey(apiKey);
    }

    throw new Error('Authentication required');
  }

  /**
   * Validate JWT token
   */
  private async validateJWT(token: string): Promise<User> {
    try {
      const payload = verify(token, this.jwtSecret) as any;

      const user = await this.db.user.findUnique({
        where: { id: payload.sub },
        include: {
          roles: true,
          permissions: true,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      return this.mapUserFromDB(user);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Validate API key
   */
  private async validateApiKey(key: string): Promise<User> {
    const keyHash = await hash(key, 10);

    const apiKey = await this.db.apiKey.findFirst({
      where: {
        key_hash: keyHash,
        expires_at: { gt: new Date() },
      },
      include: {
        user: {
          include: {
            roles: true,
            permissions: true,
          },
        },
      },
    });

    if (!apiKey) {
      throw new Error('Invalid API key');
    }

    // Update last used
    await this.db.apiKey.update({
      where: { id: apiKey.id },
      data: { last_used: new Date() },
    });

    return this.mapUserFromDB(apiKey.user);
  }

  /**
   * Check workspace access
   */
  async validateWorkspaceAccess(
    user_id: string,
    workspace_id: string
  ): Promise<void> {
    const workspace = await this.db.workspace.findFirst({
      where: {
        id: workspace_id,
        OR: [
          { user_id },
          {
            shared_with: {
              some: { user_id },
            },
          },
        ],
      },
    });

    if (!workspace) {
      throw new Error('Workspace not found or access denied');
    }
  }

  /**
   * Check permissions
   */
  async validatePermissions(
    user_id: string,
    required_permissions: string[]
  ): Promise<void> {
    const user = await this.db.user.findUnique({
      where: { id: user_id },
      include: {
        permissions: true,
        roles: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Collect all permissions (direct + from roles)
    const userPermissions = new Set([
      ...user.permissions.map(p => p.name),
      ...user.roles.flatMap(r => r.permissions.map(p => p.name)),
    ]);

    // Check if user has all required permissions
    const missing = required_permissions.filter(p => !userPermissions.has(p));
    if (missing.length > 0) {
      throw new Error(`Missing permissions: ${missing.join(', ')}`);
    }
  }

  private mapUserFromDB(dbUser: any): User {
    return {
      id: dbUser.id,
      email: dbUser.email,
      roles: dbUser.roles.map((r: any) => r.name),
      permissions: [
        ...dbUser.permissions.map((p: any) => p.name),
        ...dbUser.roles.flatMap((r: any) => r.permissions.map((p: any) => p.name)),
      ],
      api_keys: dbUser.api_keys || [],
    };
  }
}
```

### 7.3 Sandboxing and Isolation

**Container Security Configuration:**

```yaml
# Docker container security profile
apiVersion: v1
kind: SecurityContext
metadata:
  name: openai-agent-sandbox
spec:
  # Run as non-root user
  runAsUser: 1000
  runAsGroup: 1000
  fsGroup: 1000
  runAsNonRoot: true

  # Drop all capabilities
  capabilities:
    drop:
      - ALL
    add:
      - NET_BIND_SERVICE  # Only if needed

  # Read-only root filesystem
  readOnlyRootFilesystem: true

  # No privilege escalation
  allowPrivilegeEscalation: false

  # Security profiles
  seccompProfile:
    type: RuntimeDefault
  seLinuxOptions:
    level: "s0:c123,c456"

---

# Network policy
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: openai-agent-network-policy
spec:
  podSelector:
    matchLabels:
      app: openai-agent
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: vibecode-gateway
      ports:
        - protocol: TCP
          port: 8080
  egress:
    # Allow OpenAI API
    - to:
        - namespaceSelector: {}
      ports:
        - protocol: TCP
          port: 443
    # Allow internal services
    - to:
        - podSelector:
            matchLabels:
              app: vibecode-services
      ports:
        - protocol: TCP
          port: 8080

---

# Resource limits
apiVersion: v1
kind: LimitRange
metadata:
  name: openai-agent-limits
spec:
  limits:
    - type: Container
      default:
        cpu: "2"
        memory: "4Gi"
      defaultRequest:
        cpu: "500m"
        memory: "1Gi"
      max:
        cpu: "4"
        memory: "8Gi"
      min:
        cpu: "100m"
        memory: "256Mi"
```

### 7.4 Secret Management

**Component: `secrets-manager.ts`**

```typescript
/**
 * Secrets management using HashiCorp Vault or AWS KMS
 */

import { VaultClient } from '@vault/client';

export class SecretsManager {
  private vault: VaultClient;

  constructor() {
    this.vault = new VaultClient({
      endpoint: process.env.VAULT_ADDR,
      token: process.env.VAULT_TOKEN,
    });
  }

  /**
   * Store OpenAI API key
   */
  async storeOpenAIKey(
    user_id: string,
    api_key: string
  ): Promise<void> {
    await this.vault.write(`secret/users/${user_id}/openai`, {
      api_key: api_key,
      created_at: new Date().toISOString(),
    });
  }

  /**
   * Retrieve OpenAI API key
   */
  async getOpenAIKey(user_id: string): Promise<string | null> {
    try {
      const secret = await this.vault.read(`secret/users/${user_id}/openai`);
      return secret.data.api_key;
    } catch (error) {
      return null;
    }
  }

  /**
   * Rotate API key
   */
  async rotateOpenAIKey(
    user_id: string,
    new_key: string
  ): Promise<void> {
    // Store old key with version
    const old_key = await this.getOpenAIKey(user_id);
    if (old_key) {
      await this.vault.write(`secret/users/${user_id}/openai_old`, {
        api_key: old_key,
        rotated_at: new Date().toISOString(),
      });
    }

    // Store new key
    await this.storeOpenAIKey(user_id, new_key);
  }

  /**
   * Delete API key
   */
  async deleteOpenAIKey(user_id: string): Promise<void> {
    await this.vault.delete(`secret/users/${user_id}/openai`);
  }
}
```

---

## 8. Scaling Strategy

### 8.1 Horizontal Scaling Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Load Balancer (Nginx/HAProxy)              │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌───────────────────┐         ┌───────────────────┐
│  Gateway Pod 1    │         │  Gateway Pod N    │
│  - Protocol       │   ...   │  - Protocol       │
│  - Auth           │         │  - Auth           │
│  - Rate Limiting  │         │  - Rate Limiting  │
└─────────┬─────────┘         └─────────┬─────────┘
          │                             │
          └──────────────┬──────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
┌───────────────────┐         ┌───────────────────┐
│ Agent Controller  │         │ Agent Controller  │
│    Pod 1          │   ...   │    Pod N          │
│ - Session Mgmt    │         │ - Session Mgmt    │
│ - Tool Execution  │         │ - Tool Execution  │
└─────────┬─────────┘         └─────────┬─────────┘
          │                             │
          └──────────────┬──────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
┌───────────────────┐         ┌───────────────────┐
│  Workspace        │         │  Workspace        │
│  Container 1      │   ...   │  Container N      │
│  - OpenAI Agent   │         │  - OpenAI Agent   │
│  - Sandboxed      │         │  - Sandboxed      │
└───────────────────┘         └───────────────────┘
```

### 8.2 Auto-Scaling Configuration

**Kubernetes HPA (Horizontal Pod Autoscaler):**

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: openai-gateway-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: openai-gateway
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "1000"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 30
        - type: Pods
          value: 4
          periodSeconds: 30
      selectPolicy: Max

---

apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-controller-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agent-controller
  minReplicas: 5
  maxReplicas: 50
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Pods
      pods:
        metric:
          name: active_agent_sessions
        target:
          type: AverageValue
          averageValue: "10"
```

### 8.3 Resource Management

**Component: `resource-manager.ts`**

```typescript
/**
 * Resource management and allocation
 */

interface ResourceQuota {
  user_id: string;
  max_concurrent_agents: number;
  max_cpu_cores: number;
  max_memory_gb: number;
  max_storage_gb: number;
  max_api_calls_per_hour: number;
}

export class ResourceManager {
  private db: PrismaClient;
  private metrics: MetricsClient;

  /**
   * Check if user can allocate resources
   */
  async checkResourceAvailability(
    user_id: string,
    requested: {
      cpu_cores: number;
      memory_gb: number;
      storage_gb: number;
    }
  ): Promise<boolean> {
    // Get user quota
    const quota = await this.getUserQuota(user_id);

    // Get current usage
    const usage = await this.getCurrentUsage(user_id);

    // Check limits
    if (usage.cpu_cores + requested.cpu_cores > quota.max_cpu_cores) {
      return false;
    }
    if (usage.memory_gb + requested.memory_gb > quota.max_memory_gb) {
      return false;
    }
    if (usage.storage_gb + requested.storage_gb > quota.max_storage_gb) {
      return false;
    }

    return true;
  }

  /**
   * Allocate resources for agent
   */
  async allocateResources(
    user_id: string,
    agent_id: string,
    resources: {
      cpu_cores: number;
      memory_gb: number;
      storage_gb: number;
    }
  ): Promise<void> {
    // Check availability
    const available = await this.checkResourceAvailability(user_id, resources);
    if (!available) {
      throw new Error('Insufficient resources available');
    }

    // Record allocation
    await this.db.resourceAllocation.create({
      data: {
        user_id,
        agent_id,
        cpu_cores: resources.cpu_cores,
        memory_gb: resources.memory_gb,
        storage_gb: resources.storage_gb,
        allocated_at: new Date(),
      },
    });

    // Update metrics
    this.metrics.recordResourceAllocation(user_id, resources);
  }

  /**
   * Release resources when agent stops
   */
  async releaseResources(agent_id: string): Promise<void> {
    const allocation = await this.db.resourceAllocation.findFirst({
      where: { agent_id },
    });

    if (!allocation) return;

    await this.db.resourceAllocation.delete({
      where: { id: allocation.id },
    });

    this.metrics.recordResourceRelease(allocation.user_id, {
      cpu_cores: allocation.cpu_cores,
      memory_gb: allocation.memory_gb,
      storage_gb: allocation.storage_gb,
    });
  }

  /**
   * Get current resource usage
   */
  private async getCurrentUsage(user_id: string): Promise<{
    cpu_cores: number;
    memory_gb: number;
    storage_gb: number;
    active_agents: number;
  }> {
    const allocations = await this.db.resourceAllocation.findMany({
      where: { user_id },
    });

    return {
      cpu_cores: allocations.reduce((sum, a) => sum + a.cpu_cores, 0),
      memory_gb: allocations.reduce((sum, a) => sum + a.memory_gb, 0),
      storage_gb: allocations.reduce((sum, a) => sum + a.storage_gb, 0),
      active_agents: allocations.length,
    };
  }

  /**
   * Get user quota
   */
  private async getUserQuota(user_id: string): Promise<ResourceQuota> {
    const quota = await this.db.userQuota.findUnique({
      where: { user_id },
    });

    // Default quota if not set
    return quota || {
      user_id,
      max_concurrent_agents: 5,
      max_cpu_cores: 10,
      max_memory_gb: 20,
      max_storage_gb: 50,
      max_api_calls_per_hour: 1000,
    };
  }
}
```

### 8.4 Connection Pool Management

**WebSocket connection pooling for agent sessions:**

```typescript
/**
 * WebSocket connection pool for agent sessions
 */

import { Server as SocketServer } from 'socket.io';

export class ConnectionPoolManager {
  private io: SocketServer;
  private connections: Map<string, Set<SocketClient>>;
  private maxConnectionsPerAgent: number = 10;

  constructor(server: any) {
    this.io = new SocketServer(server, {
      cors: { origin: '*' },
      maxHttpBufferSize: 1e6, // 1MB
      pingTimeout: 60000,
      pingInterval: 25000,
    });
    this.connections = new Map();
    this.setupHandlers();
  }

  /**
   * Setup WebSocket handlers
   */
  private setupHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('subscribe_agent', async (data: { agent_id: string; auth_token: string }) => {
        try {
          // Authenticate
          const user = await this.authenticate(data.auth_token);

          // Check connection limit
          const agentConnections = this.connections.get(data.agent_id) || new Set();
          if (agentConnections.size >= this.maxConnectionsPerAgent) {
            socket.emit('error', { message: 'Max connections reached for agent' });
            socket.disconnect();
            return;
          }

          // Join agent room
          socket.join(`agent:${data.agent_id}`);
          agentConnections.add(socket.id);
          this.connections.set(data.agent_id, agentConnections);

          socket.emit('subscribed', { agent_id: data.agent_id });
        } catch (error) {
          socket.emit('error', { message: error.message });
          socket.disconnect();
        }
      });

      socket.on('disconnect', () => {
        // Remove from all agent rooms
        for (const [agent_id, connections] of this.connections.entries()) {
          if (connections.has(socket.id)) {
            connections.delete(socket.id);
            if (connections.size === 0) {
              this.connections.delete(agent_id);
            }
          }
        }
      });
    });
  }

  /**
   * Broadcast message to agent subscribers
   */
  broadcastToAgent(agent_id: string, event: string, data: any): void {
    this.io.to(`agent:${agent_id}`).emit(event, data);
  }

  /**
   * Get connection count for agent
   */
  getConnectionCount(agent_id: string): number {
    return this.connections.get(agent_id)?.size || 0;
  }

  private async authenticate(token: string): Promise<any> {
    // JWT validation
    return { id: 'user_123' };
  }
}
```

---

## 9. Data Flow Diagrams

### 9.1 VibeCode AS OpenAI Agent Flow

```
┌──────────────┐
│ External     │
│ OpenAI Agent │
└──────┬───────┘
       │
       │ 1. Tool Call Request
       │    POST /openai/tools/create_workspace
       │    { runtime: "node", template: "express" }
       ▼
┌──────────────────────────────────────┐
│  OpenAI Protocol Gateway             │
│  - Authenticate request              │
│  - Validate parameters               │
│  - Check rate limits                 │
└──────┬───────────────────────────────┘
       │
       │ 2. Route to Tool Handler
       ▼
┌──────────────────────────────────────┐
│  VibeCode OpenAI Agent               │
│  - handleToolCall('create_workspace') │
└──────┬───────────────────────────────┘
       │
       │ 3. Call Internal API
       ▼
┌──────────────────────────────────────┐
│  AgentAPI Client                     │
│  - startAgent({ agent_type: 'aider' })│
└──────┬───────────────────────────────┘
       │
       │ 4. Create Container
       ▼
┌──────────────────────────────────────┐
│  Container Runtime                   │
│  - Provision workspace container     │
│  - Apply security policies           │
│  - Mount volumes                     │
└──────┬───────────────────────────────┘
       │
       │ 5. Return Workspace Info
       ▼
┌──────────────────────────────────────┐
│  Tool Result                         │
│  {                                   │
│    workspace_id: "ws_123",           │
│    access_url: "https://...",        │
│    status: "ready"                   │
│  }                                   │
└──────┬───────────────────────────────┘
       │
       │ 6. Send Tool Result
       ▼
┌──────────────┐
│ External     │
│ OpenAI Agent │
└──────────────┘
```

### 9.2 VibeCode HOSTING OpenAI Agent Flow

```
┌──────────────┐
│  User        │
└──────┬───────┘
       │
       │ 1. Start Agent Request
       │    POST /openai/agents/start
       │    { agent_id: "asst_123", workspace_id: "ws_456", initial_message: "..." }
       ▼
┌──────────────────────────────────────┐
│  OpenAI Protocol Gateway             │
│  - Authenticate user                 │
│  - Validate workspace access         │
│  - Check resource quotas             │
└──────┬───────────────────────────────┘
       │
       │ 2. Initialize Agent Session
       ▼
┌──────────────────────────────────────┐
│  OpenAI Agent Controller             │
│  - Create container                  │
│  - Create OpenAI thread              │
│  - Register session                  │
└──────┬───────────────────────────────┘
       │
       │ 3. Send Initial Message
       ▼
┌──────────────────────────────────────┐
│  OpenAI API                          │
│  - Create message in thread          │
│  - Start agent run                   │
└──────┬───────────────────────────────┘
       │
       │ 4. Stream Run Events
       ▼
┌──────────────────────────────────────┐
│  OpenAI Agent Controller             │
│  - Monitor run stream                │
│  - Detect tool calls                 │
└──────┬───────────────────────────────┘
       │
       │ 5. Tool Call Required
       │    { tool: "read_file", args: { path: "main.js" } }
       ▼
┌──────────────────────────────────────┐
│  Tool Bridge                         │
│  - Validate tool access              │
│  - Execute in sandbox                │
└──────┬───────────────────────────────┘
       │
       │ 6. Execute in Workspace
       ▼
┌──────────────────────────────────────┐
│  Workspace Container                 │
│  - Read file from filesystem         │
│  - Apply security checks             │
└──────┬───────────────────────────────┘
       │
       │ 7. Tool Result
       │    { content: "const express = ...", size: 1024 }
       ▼
┌──────────────────────────────────────┐
│  OpenAI Agent Controller             │
│  - Submit tool outputs               │
│  - Continue monitoring run           │
└──────┬───────────────────────────────┘
       │
       │ 8. Agent Response
       ▼
┌──────────────────────────────────────┐
│  WebSocket / SSE Stream              │
│  - Broadcast to subscribed clients   │
└──────┬───────────────────────────────┘
       │
       │ 9. Display Response
       ▼
┌──────────────┐
│  User        │
└──────────────┘
```

### 9.3 Bidirectional Integration Flow

```
         ┌─────────────────────────────────────┐
         │     External OpenAI Agent          │
         │  (Using VibeCode as tool)          │
         └────────┬────────────────────────────┘
                  │
                  │ Tool Calls
                  ▼
         ┌────────────────────────────────────┐
         │   OpenAI Protocol Gateway          │
         │   - Bidirectional routing          │
         └────────┬───────────────────────────┘
                  │
     ┌────────────┴────────────┐
     │                         │
     ▼                         ▼
┌─────────────────┐   ┌─────────────────┐
│  VibeCode AS    │   │  VibeCode AS    │
│  OpenAI Agent   │   │  Agent Host     │
│  (Outbound)     │   │  (Inbound)      │
└────────┬────────┘   └────────┬────────┘
         │                     │
         │                     │
         ▼                     ▼
┌─────────────────┐   ┌─────────────────┐
│  Tool Registry  │   │ Agent Controller│
│  - Tool defs    │   │ - Session mgmt  │
│  - Execution    │   │ - Tool bridge   │
└────────┬────────┘   └────────┬────────┘
         │                     │
         └──────────┬──────────┘
                    │
                    ▼
         ┌──────────────────────────────┐
         │  Shared VibeCode Services    │
         │  - AgentAPI                  │
         │  - MCP Servers               │
         │  - Container Runtime         │
         │  - Vector Store              │
         │  - File System               │
         └──────────────────────────────┘
```

---

## 10. Infrastructure Requirements

### 10.1 Compute Resources

**Minimum Production Deployment:**

```yaml
# Kubernetes cluster specifications
cluster:
  nodes:
    - role: control-plane
      count: 3
      specs:
        cpu: 4 cores
        memory: 16 GB
        storage: 100 GB SSD

    - role: gateway-worker
      count: 3
      specs:
        cpu: 8 cores
        memory: 32 GB
        storage: 200 GB SSD
      autoscaling:
        min: 3
        max: 10

    - role: agent-worker
      count: 5
      specs:
        cpu: 16 cores
        memory: 64 GB
        storage: 500 GB SSD
      autoscaling:
        min: 5
        max: 50

    - role: workspace-worker
      count: 10
      specs:
        cpu: 32 cores
        memory: 128 GB
        storage: 1 TB SSD
      autoscaling:
        min: 10
        max: 100
```

**Total Resource Estimates:**

- **Minimum**: 21 nodes, 500 cores, 2TB RAM, 10TB storage
- **Peak**: 163 nodes, 3000+ cores, 15TB RAM, 80TB storage
- **Estimated cost**: $5,000-$50,000/month (depending on cloud provider and usage)

### 10.2 Storage Requirements

```yaml
storage:
  # PostgreSQL (state, metadata)
  postgresql:
    type: managed-rds
    size: 500 GB
    iops: 10000
    backup: daily
    retention: 30 days

  # Redis (session cache)
  redis:
    type: managed-elasticache
    nodes: 3
    memory_per_node: 32 GB
    persistence: enabled

  # Vector database (embeddings)
  vector_db:
    type: weaviate-cluster
    nodes: 5
    storage_per_node: 500 GB
    memory_per_node: 64 GB

  # Object storage (files, artifacts)
  object_storage:
    type: s3
    storage: unlimited
    lifecycle:
      transition_to_glacier: 90 days
      delete: 365 days

  # Container registry
  registry:
    type: ecr
    storage: 2 TB
    image_retention: 50 versions
```

### 10.3 Network Requirements

```yaml
network:
  # Load balancing
  load_balancer:
    type: application-lb
    throughput: 10 Gbps
    ssl_certificates: managed
    waf: enabled

  # CDN
  cdn:
    provider: cloudflare
    cache_locations: global
    ssl: full-strict

  # Service mesh
  service_mesh:
    type: istio
    features:
      - traffic-management
      - security
      - observability

  # VPC configuration
  vpc:
    cidr: 10.0.0.0/16
    subnets:
      public:
        - 10.0.1.0/24
        - 10.0.2.0/24
        - 10.0.3.0/24
      private:
        - 10.0.10.0/24
        - 10.0.11.0/24
        - 10.0.12.0/24
    nat_gateways: 3
    vpn: enabled
```

### 10.4 Monitoring and Observability

```yaml
observability:
  # Metrics
  metrics:
    provider: datadog
    retention: 15 months
    metrics:
      - api_requests_total
      - agent_sessions_active
      - tool_execution_duration
      - resource_utilization
      - error_rate

  # Logging
  logging:
    provider: datadog-logs
    retention: 90 days
    log_levels:
      - ERROR
      - WARN
      - INFO

  # Tracing
  tracing:
    provider: datadog-apm
    sample_rate: 0.1
    retention: 30 days

  # Alerts
  alerts:
    channels:
      - pagerduty
      - slack
      - email
    rules:
      - name: high-error-rate
        condition: error_rate > 5%
        severity: critical
      - name: resource-exhaustion
        condition: resource_usage > 90%
        severity: warning
```

---

## 11. Deployment Strategy

### 11.1 Deployment Architecture

```yaml
# Multi-environment deployment strategy
environments:
  development:
    region: us-east-1
    cluster_size: small
    replicas:
      gateway: 2
      controller: 2
      workers: 3
    features:
      - debug-mode
      - hot-reload

  staging:
    region: us-east-1
    cluster_size: medium
    replicas:
      gateway: 3
      controller: 3
      workers: 5
    features:
      - production-like
      - load-testing

  production:
    regions:
      - us-east-1
      - eu-west-1
      - ap-southeast-1
    cluster_size: large
    replicas:
      gateway: 5+
      controller: 10+
      workers: 20+
    features:
      - high-availability
      - auto-scaling
      - disaster-recovery
```

### 11.2 CI/CD Pipeline

```yaml
# GitHub Actions workflow
name: OpenAI Agents Integration CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run unit tests
        run: npm test

      - name: Run integration tests
        run: npm run test:integration

      - name: Test OpenAI protocol compatibility
        run: npm run test:openai-protocol

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker images
        run: |
          docker build -t vibecode/openai-gateway:${{ github.sha }} -f docker/openai-gateway/Dockerfile .
          docker build -t vibecode/openai-agent-controller:${{ github.sha }} -f docker/agent-controller/Dockerfile .

      - name: Push to registry
        run: |
          docker push vibecode/openai-gateway:${{ github.sha }}
          docker push vibecode/openai-agent-controller:${{ github.sha }}

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging
        run: |
          kubectl set image deployment/openai-gateway openai-gateway=vibecode/openai-gateway:${{ github.sha }} -n staging
          kubectl set image deployment/agent-controller agent-controller=vibecode/openai-agent-controller:${{ github.sha }} -n staging

      - name: Run smoke tests
        run: npm run test:smoke -- --env=staging

  deploy-production:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production (canary)
        run: |
          # Deploy to 10% of traffic
          kubectl apply -f k8s/openai-agents/canary-deployment.yaml

      - name: Monitor canary
        run: npm run monitor:canary -- --duration=30m

      - name: Promote canary
        if: success()
        run: |
          kubectl apply -f k8s/openai-agents/production-deployment.yaml

      - name: Rollback on failure
        if: failure()
        run: |
          kubectl rollout undo deployment/openai-gateway -n production
          kubectl rollout undo deployment/agent-controller -n production
```

### 11.3 Blue-Green Deployment

```yaml
# Blue-Green deployment configuration
apiVersion: v1
kind: Service
metadata:
  name: openai-gateway
spec:
  selector:
    app: openai-gateway
    version: blue  # Switch to 'green' for deployment
  ports:
    - port: 80
      targetPort: 8080

---

apiVersion: apps/v1
kind: Deployment
metadata:
  name: openai-gateway-blue
spec:
  replicas: 5
  selector:
    matchLabels:
      app: openai-gateway
      version: blue
  template:
    metadata:
      labels:
        app: openai-gateway
        version: blue
    spec:
      containers:
        - name: gateway
          image: vibecode/openai-gateway:v1.0.0
          ports:
            - containerPort: 8080

---

apiVersion: apps/v1
kind: Deployment
metadata:
  name: openai-gateway-green
spec:
  replicas: 5
  selector:
    matchLabels:
      app: openai-gateway
      version: green
  template:
    metadata:
      labels:
        app: openai-gateway
        version: green
    spec:
      containers:
        - name: gateway
          image: vibecode/openai-gateway:v1.1.0
          ports:
            - containerPort: 8080
```

---

## 12. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

**Week 1-2: Core Protocol Implementation**
- Implement OpenAI Agent Protocol gateway
- Build tool registry system
- Create protocol translation layer
- Setup authentication and authorization

**Week 3-4: VibeCode AS Agent**
- Implement VibeCode OpenAI Agent adapter
- Define and implement core tool functions
- Build tool execution handlers
- Setup OpenAI Agent registration

**Deliverables:**
- Working OpenAI Protocol Gateway
- VibeCode registered as OpenAI Agent
- 5-10 core tools implemented
- Authentication system

### Phase 2: Agent Hosting (Weeks 5-8)

**Week 5-6: Agent Controller**
- Implement OpenAI Agent execution controller
- Build container sandbox environment
- Create tool bridge system
- Setup session management

**Week 7-8: State Management**
- Implement multi-layer state system
- Setup Redis caching
- Configure PostgreSQL storage
- Build vector store integration

**Deliverables:**
- OpenAI Agents can run in VibeCode
- Tool bridge functional
- State persistence working
- Container isolation proven

### Phase 3: Security & Scaling (Weeks 9-12)

**Week 9-10: Security Implementation**
- Implement all security layers
- Setup sandbox isolation
- Configure network policies
- Integrate secrets management

**Week 11-12: Scaling Infrastructure**
- Implement auto-scaling
- Setup resource management
- Configure connection pooling
- Load testing and optimization

**Deliverables:**
- Production-ready security
- Auto-scaling functional
- Resource quotas enforced
- Performance benchmarks met

### Phase 4: Polish & Launch (Weeks 13-16)

**Week 13-14: Monitoring & Observability**
- Setup comprehensive monitoring
- Implement alerting
- Configure tracing
- Build admin dashboard

**Week 15-16: Documentation & Launch**
- Complete API documentation
- Write integration guides
- Create example applications
- Beta launch

**Deliverables:**
- Full monitoring stack
- Complete documentation
- Beta release
- Marketing materials

---

## Appendix A: Technology Stack

### Core Technologies

**Backend:**
- Node.js 18+ with TypeScript
- Next.js 15.5 (API routes)
- Express.js (custom services)

**Protocols:**
- OpenAI Agent Protocol (bidirectional)
- AgentAPI (Aider/Goose/Cline)
- MCP (Model Context Protocol)
- WebSocket (real-time streaming)

**Containerization:**
- Docker 24+
- Kubernetes 1.28+
- Helm 3.12+

**Databases:**
- PostgreSQL 15 (state, metadata)
- Redis 7 (session cache)
- Weaviate/Chroma (vector embeddings)

**Monitoring:**
- Datadog (metrics, logs, APM)
- OpenTelemetry (tracing)
- Prometheus (metrics backup)

**Cloud Infrastructure:**
- AWS/Azure/GCP (multi-cloud)
- Cloudflare (CDN, WAF)
- HashiCorp Vault (secrets)

---

## Appendix B: API Reference Summary

### Outbound APIs (VibeCode AS Agent)

```
POST   /openai/tools/{tool_name}           Execute VibeCode tool
GET    /openai/tools                       List available tools
GET    /openai/capabilities                Get agent capabilities
GET    /openai/health                      Health check
```

### Inbound APIs (VibeCode HOSTING Agents)

```
POST   /openai/agents/start                Start OpenAI Agent
POST   /openai/agents/{id}/messages        Send message
GET    /openai/agents/{id}                 Get agent status
GET    /openai/agents/{id}/events          Stream agent events (SSE)
DELETE /openai/agents/{id}                 Stop agent
GET    /openai/agents                      List active agents
```

---

## Appendix C: Performance Targets

### Response Time SLAs

- Tool execution: p50 < 500ms, p95 < 2s, p99 < 5s
- Agent startup: p50 < 3s, p95 < 10s, p99 < 30s
- Message processing: p50 < 200ms, p95 < 1s, p99 < 3s
- API gateway: p50 < 50ms, p95 < 200ms, p99 < 500ms

### Throughput Targets

- Concurrent agents: 1,000+ per cluster
- API requests: 10,000+ req/s per cluster
- WebSocket connections: 50,000+ concurrent
- Tool executions: 5,000+ per minute

### Availability Targets

- System uptime: 99.9% (3 nines)
- API availability: 99.95%
- Agent availability: 99.5%
- Data durability: 99.999999999% (11 nines)

---

## Appendix D: Cost Estimates

### Infrastructure Costs (Monthly)

**Development Environment:**
- Kubernetes cluster: $500
- Databases: $200
- Storage: $100
- **Total: ~$800/month**

**Staging Environment:**
- Kubernetes cluster: $1,500
- Databases: $500
- Storage: $300
- **Total: ~$2,300/month**

**Production Environment (Base):**
- Kubernetes cluster: $5,000
- Databases: $2,000
- Storage: $1,000
- CDN: $500
- Monitoring: $500
- **Total: ~$9,000/month**

**Production Environment (Peak):**
- Kubernetes cluster: $30,000
- Databases: $5,000
- Storage: $3,000
- CDN: $2,000
- Monitoring: $1,000
- **Total: ~$41,000/month**

### OpenAI API Costs

- GPT-4o: $5.00 per 1M input tokens, $15.00 per 1M output tokens
- GPT-4o-mini: $0.15 per 1M input tokens, $0.60 per 1M output tokens
- Estimated usage: $5,000-$50,000/month depending on adoption

---

## Document Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-10-02 | Initial architecture design | System Architect |

---

## Next Steps

1. **Review and approval** of architecture design
2. **Resource allocation** for implementation team
3. **Technology evaluation** and proof-of-concept
4. **Implementation kickoff** following roadmap
5. **Regular architecture reviews** and updates

---

**End of Document**
