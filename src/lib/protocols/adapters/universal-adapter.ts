/**
 * Universal Agent Adapter
 * Fallback adapter for unknown agent types with auto-detection
 * @module protocols/adapters/universal-adapter
 */

import { BaseAgentAdapter, AgentCapabilities, AgentSession, AgentResult } from './base-adapter';
import { createAgentAPIClient } from '../agentapi-client';
import { createMCPClient } from '../mcp-client';
import type { AgentConfig } from './base-adapter';
import type { MCPClient } from '../mcp-client';
import type { ModelType, AgentStatus } from '@/types/agent-api';
// import { logger } from '@/lib/logger';

/**
 * Type guard to check if a status string is a valid AgentSession status
 */
function isValidSessionStatus(status: string): status is AgentSession['status'] {
  return ['running', 'completed', 'failed', 'stopped'].includes(status);
}

/**
 * Type guard to check if a model string is a valid ModelType
 */
function isValidModelType(model: string): model is ModelType {
  return [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'gpt-4o',
    'gpt-4o-mini',
    'deepseek-chat',
  ].includes(model);
}

/**
 * Get a valid model type, defaulting to claude-3-5-sonnet if invalid
 */
function getValidModel(model: string | undefined): ModelType {
  if (model && isValidModelType(model)) {
    return model;
  }
  return 'claude-3-5-sonnet-20241022';
}

export class UniversalAdapter extends BaseAgentAdapter {
  private protocol: 'agentapi' | 'mcp' | null = null;
  private agentId: string | null = null;
  protected override mcpClient: MCPClient | null = null;
  private eventSource: EventSource | null = null;

  constructor(config: AgentConfig) {
    super(config);
  }

  getCapabilities(): AgentCapabilities {
    return {
      gitOperations: false,
      fileOperations: true,
      codeGeneration: true,
      refactoring: true,
      testing: false,
      documentation: true,
      interactiveMode: true,
      mcpNative: false,
      agentAPISupport: false,
    };
  }

  async start(task: string): Promise<AgentSession> {
    // Try to detect protocol
    await this.detectProtocol();

    if (this.protocol === 'mcp') {
      return this.startMCP(task);
    } else if (this.protocol === 'agentapi') {
      return this.startAgentAPI(task);
    }

    throw new Error('Unable to detect agent protocol');
  }

  async sendMessage(message: string): Promise<AgentResult> {
    if (this.protocol === 'mcp') {
      return this.sendMessageMCP(message);
    } else if (this.protocol === 'agentapi') {
      return this.sendMessageAgentAPI(message);
    }

    return {
      success: false,
      error: 'Protocol not detected',
    };
  }

  async stop(): Promise<void> {
    if (this.mcpClient) {
      await this.mcpClient.disconnect();
      this.mcpClient = null;
    }

    if (this.agentAPIClient && this.agentId) {
      await this.agentAPIClient.stopAgent(this.agentId);
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.session) {
      this.session.status = 'stopped';
    }

    this.agentId = null;
    this.protocol = null;
  }

  // Protocol detection
  private async detectProtocol(): Promise<void> {
    // Try MCP first
    if (await this.tryMCP()) {
      this.protocol = 'mcp';
      return;
    }

    // Try AgentAPI
    if (await this.tryAgentAPI()) {
      this.protocol = 'agentapi';
      return;
    }

    throw new Error('No compatible protocol detected');
  }

  private async tryMCP(): Promise<boolean> {
    try {
      const client = createMCPClient({
        transport: 'websocket',
        url: this.config.baseUrl || 'ws://localhost:3000/mcp',
        timeout: 5000,
      });

      await client.connect();
      this.mcpClient = client;
      return true;
    } catch {
      return false;
    }
  }

  private async tryAgentAPI(): Promise<boolean> {
    try {
      this.agentAPIClient = createAgentAPIClient({
        baseUrl: this.config.baseUrl,
        apiKey: this.config.apiKey,
        timeout: 5000,
      });

      await this.agentAPIClient.getHealth();
      return true;
    } catch {
      return false;
    }
  }

  // MCP implementation
  private async startMCP(task: string): Promise<AgentSession> {
    if (!this.mcpClient) {
      throw new Error('MCP client not initialized');
    }

    const sessionId = this.generateSessionId();
    this.session = this.createSession(sessionId);

    await this.mcpClient.createMessage([
      { role: 'user', content: task },
    ]);

    return this.session;
  }

  private async sendMessageMCP(message: string): Promise<AgentResult> {
    if (!this.mcpClient) {
      throw new Error('MCP client not initialized');
    }

    const startTime = Date.now();

    try {
      const result = await this.mcpClient.createMessage([
        { role: 'user', content: message },
      ]);

      return {
        success: true,
        output: result.content,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  // AgentAPI implementation
  private async startAgentAPI(task: string): Promise<AgentSession> {
    if (!this.agentAPIClient) {
      throw new Error('AgentAPI client not initialized');
    }

    // Try to start as aider by default (most compatible)
    const response = await this.agentAPIClient.startAgent({
      agent_type: 'aider',
      workspace: this.config.workspace,
      files: this.config.files,
      model: getValidModel(this.config.model),
      task,
    });

    this.agentId = response.data.agent_id;
    this.session = this.createSession(this.agentId);

    this.setupEventStream();

    return this.session;
  }

  private async sendMessageAgentAPI(message: string): Promise<AgentResult> {
    if (!this.agentAPIClient || !this.agentId) {
      throw new Error('AgentAPI client not initialized');
    }

    const startTime = Date.now();
    const response = await this.agentAPIClient.sendMessage(this.agentId, {
      message,
      type: 'user',
    });

    if (response.data.status === 'sent') {
      return {
        success: true,
        output: 'Message sent successfully',
        duration: Date.now() - startTime,
      };
    }

    return {
      success: false,
      error: 'Failed to send message',
      duration: Date.now() - startTime,
    };
  }

  private setupEventStream(): void {
    if (!this.agentAPIClient || !this.agentId) {
      return;
    }

    this.eventSource = this.agentAPIClient.createEventStream(
      this.agentId,
      undefined,
      {
        onOutput: (data) => {
          console.info(`[Universal] ${data.line}`);
        },
        onStatus: (data) => {
          if (this.session && isValidSessionStatus(data.status)) {
            this.session.status = data.status;
          }
        },
        onError: (data) => {
          console.error(`[Universal Error] ${data.error}`);
          if (this.session) {
            this.session.status = 'failed';
          }
        },
        onComplete: (data) => {
          if (this.session) {
            this.session.status = data.exit_code === 0 ? 'completed' : 'failed';
          }
        },
      }
    );
  }
}
