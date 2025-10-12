/**
 * Aider Agent Adapter
 * Git-focused coding agent with interactive mode
 * @module protocols/adapters/aider-adapter
 */

import { BaseAgentAdapter, AgentCapabilities, AgentSession, AgentResult } from './base-adapter';
import { createAgentAPIClient } from '../agentapi-client';
import type { AgentConfig } from './base-adapter';
import { logger } from '@/lib/logger';

export class AiderAdapter extends BaseAgentAdapter {
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
      testing: false,
      documentation: true,
      interactiveMode: true,
      mcpNative: false,
      agentAPISupport: true,
    };
  }

  async start(task: string): Promise<AgentSession> {
    if (!this.agentAPIClient) {
      throw new Error('AgentAPI client not initialized');
    }

    const response = await this.agentAPIClient.startAgent({
      agent_type: 'aider',
      workspace: this.config.workspace,
      files: this.config.files,
      model: (this.config.model || 'claude-3-5-sonnet-20241022') as any,
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
          logger.info(`[Aider] ${data.line}`);
        },
        onStatus: (data) => {
          if (this.session) {
            this.session.status = data.status as any;
          }
        },
        onError: (data) => {
          logger.error(`[Aider Error] ${data.error}`);
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

  // Aider-specific methods
  async executeGitOperation(command: string): Promise<AgentResult> {
    return this.sendMessage(`/git ${command}`);
  }

  async addFiles(files: string[]): Promise<AgentResult> {
    return this.sendMessage(`/add ${files.join(' ')}`);
  }

  async dropFiles(files: string[]): Promise<AgentResult> {
    return this.sendMessage(`/drop ${files.join(' ')}`);
  }

  async diff(): Promise<AgentResult> {
    return this.sendMessage('/diff');
  }

  async undo(): Promise<AgentResult> {
    return this.sendMessage('/undo');
  }

  async commit(message?: string): Promise<AgentResult> {
    const cmd = message ? `/commit ${message}` : '/commit';
    return this.sendMessage(cmd);
  }
}
