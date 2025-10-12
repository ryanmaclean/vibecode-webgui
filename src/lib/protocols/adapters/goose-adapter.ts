/**
 * Goose Agent Adapter
 * Extensible MCP-based agent with plugin support
 * @module protocols/adapters/goose-adapter
 */

import { BaseAgentAdapter, AgentCapabilities, AgentSession, AgentResult } from './base-adapter';
import { createAgentAPIClient } from '../agentapi-client';
import { createMCPClient } from '../mcp-client';
import type { AgentConfig } from './base-adapter';
import type { MCPClient } from '../mcp-client';
import { logger } from '@/lib/logger';

export class GooseAdapter extends BaseAgentAdapter {
  private agentId: string | null = null;
  private eventSource: EventSource | null = null;
  private mcpClient: MCPClient | null = null;

  constructor(config: AgentConfig) {
    super(config);
    this.agentAPIClient = createAgentAPIClient({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
    });
  }

  getCapabilities(): AgentCapabilities {
    return {
      gitOperations: true,
      fileOperations: true,
      codeGeneration: true,
      refactoring: true,
      testing: true,
      documentation: true,
      interactiveMode: true,
      mcpNative: true,
      agentAPISupport: true,
    };
  }

  async start(task: string): Promise<AgentSession> {
    if (!this.agentAPIClient) {
      throw new Error('AgentAPI client not initialized');
    }

    // Start via AgentAPI
    const response = await this.agentAPIClient.startAgent({
      agent_type: 'goose',
      workspace: this.config.workspace,
      files: this.config.files,
      model: (this.config.model || 'claude-3-5-sonnet-20241022') as any,
      task,
    });

    this.agentId = response.data.agent_id;
    this.session = this.createSession(this.agentId);

    // Set up event stream for output
    this.setupEventStream();

    // Also establish MCP connection for enhanced features
    await this.setupMCPConnection();

    return this.session;
  }

  async sendMessage(message: string): Promise<AgentResult> {
    if (!this.agentAPIClient || !this.agentId) {
      throw new Error('Agent not started');
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

  async stop(): Promise<void> {
    if (this.agentAPIClient && this.agentId) {
      await this.agentAPIClient.stopAgent(this.agentId);
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.mcpClient) {
      await this.mcpClient.disconnect();
      this.mcpClient = null;
    }

    if (this.session) {
      this.session.status = 'stopped';
    }

    this.agentId = null;
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
          logger.info(`[Goose] ${data.line}`);
        },
        onStatus: (data) => {
          if (this.session) {
            this.session.status = data.status as any;
          }
        },
        onError: (data) => {
          logger.error(`[Goose Error] ${data.error}`);
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

  private async setupMCPConnection(): Promise<void> {
    try {
      this.mcpClient = createMCPClient({
        transport: 'websocket',
        url: this.config.customConfig?.mcpUrl as string || 'ws://localhost:3000/mcp',
      });

      await this.mcpClient.connect();
    } catch (error) {
      logger.warn('[Goose] MCP connection failed, continuing with AgentAPI only:', error);
    }
  }

  // Goose-specific methods
  async listPlugins(): Promise<AgentResult> {
    if (this.mcpClient) {
      try {
        const tools = await this.mcpClient.listTools();
        return {
          success: true,
          output: JSON.stringify(tools, null, 2),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return this.sendMessage('/plugins list');
  }

  async enablePlugin(plugin: string): Promise<AgentResult> {
    return this.sendMessage(`/plugins enable ${plugin}`);
  }

  async disablePlugin(plugin: string): Promise<AgentResult> {
    return this.sendMessage(`/plugins disable ${plugin}`);
  }

  async invokePlugin(plugin: string, action: string, args?: Record<string, unknown>): Promise<AgentResult> {
    if (this.mcpClient) {
      try {
        const result = await this.mcpClient.invokeTool(`${plugin}.${action}`, args || {});
        return {
          success: true,
          output: JSON.stringify(result),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    const argsStr = args ? JSON.stringify(args) : '';
    return this.sendMessage(`/plugins invoke ${plugin} ${action} ${argsStr}`);
  }

  async configurePlugin(plugin: string, config: Record<string, unknown>): Promise<AgentResult> {
    return this.sendMessage(`/plugins configure ${plugin} ${JSON.stringify(config)}`);
  }
}
