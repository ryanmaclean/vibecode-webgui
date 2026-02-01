/**
 * Cline Agent Adapter
 * Interactive coding assistant with VS Code integration
 * @module protocols/adapters/cline-adapter
 */

import { BaseAgentAdapter, AgentCapabilities, AgentSession, AgentResult } from './base-adapter';
import { createAgentAPIClient } from '../agentapi-client';
import type { AgentConfig } from './base-adapter';
import type { ModelType } from '@/types/agent-api';
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

export class ClineAdapter extends BaseAgentAdapter {
  private agentId: string | null = null;
  private eventSource: EventSource | null = null;

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

    const response = await this.agentAPIClient.startAgent({
      agent_type: 'cline',
      workspace: this.config.workspace,
      files: this.config.files,
      model: getValidModel(this.config.model),
      task,
    });

    this.agentId = response.data.agent_id;
    this.session = this.createSession(this.agentId);

    // Set up event stream for output
    this.setupEventStream();

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
    if (!this.agentAPIClient || !this.agentId) {
      return;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    await this.agentAPIClient.stopAgent(this.agentId);

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
          console.info(`[Cline] ${data.line}`);
        },
        onStatus: (data) => {
          if (this.session && isValidSessionStatus(data.status)) {
            this.session.status = data.status;
          }
        },
        onError: (data) => {
          console.error(`[Cline Error] ${data.error}`);
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

  // Cline-specific methods
  async approveAction(actionId: string): Promise<AgentResult> {
    return this.sendMessage(`/approve ${actionId}`);
  }

  async rejectAction(actionId: string): Promise<AgentResult> {
    return this.sendMessage(`/reject ${actionId}`);
  }

  async listMCPTools(): Promise<AgentResult> {
    return this.sendMessage('/mcp list-tools');
  }

  async invokeMCPTool(tool: string, args: Record<string, unknown>): Promise<AgentResult> {
    return this.sendMessage(`/mcp invoke ${tool} ${JSON.stringify(args)}`);
  }
}
