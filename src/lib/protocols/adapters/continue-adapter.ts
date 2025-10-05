/**
 * Continue Agent Adapter
 * VS Code extension for AI-powered code completion and chat
 * @module protocols/adapters/continue-adapter
 */

import { BaseAgentAdapter, AgentCapabilities, AgentSession, AgentResult } from './base-adapter';
import { createMCPClient } from '../mcp-client';
import type { AgentConfig } from './base-adapter';
import type { MCPClient } from '../mcp-client';

export class ContinueAdapter extends BaseAgentAdapter {
  private client: MCPClient | null = null;

  constructor(config: AgentConfig) {
    super(config);
  }

  getCapabilities(): AgentCapabilities {
    return {
      gitOperations: false,
      fileOperations: true,
      codeGeneration: true,
      refactoring: true,
      testing: true,
      documentation: true,
      interactiveMode: true,
      mcpNative: true,
      agentAPISupport: false,
    };
  }

  async start(task: string): Promise<AgentSession> {
    // Continue uses MCP for communication
    this.client = createMCPClient({
      transport: 'websocket',
      url: this.config.baseUrl || 'ws://localhost:3000/mcp',
    });

    await this.client.connect();

    const sessionId = this.generateSessionId();
    this.session = this.createSession(sessionId);

    // Send initial task via MCP tool invocation
    await this.client.invokeTool('chat', { message: task });

    return this.session;
  }

  async sendMessage(message: string): Promise<AgentResult> {
    if (!this.client || !this.client.isConnected()) {
      throw new Error('Continue client not connected');
    }

    const startTime = Date.now();

    try {
      const result = await this.client.invokeTool('chat', { message });

      return {
        success: true,
        output: JSON.stringify(result),
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

  async stop(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }

    if (this.session) {
      this.session.status = 'stopped';
    }
  }

  // Continue-specific methods
  async autocomplete(prefix: string, suffix: string): Promise<AgentResult> {
    if (!this.client) {
      throw new Error('Continue client not connected');
    }

    try {
      const result = await this.client.invokeTool('autocomplete', { prefix, suffix });
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

  async explainCode(code: string): Promise<AgentResult> {
    return this.sendMessage(`Explain this code:\n\n${code}`);
  }

  async fixCode(code: string, error: string): Promise<AgentResult> {
    return this.sendMessage(`Fix this code error:\n\nCode:\n${code}\n\nError:\n${error}`);
  }

  async refactorCode(code: string, instruction: string): Promise<AgentResult> {
    return this.sendMessage(`Refactor this code:\n\nCode:\n${code}\n\nInstruction:\n${instruction}`);
  }
}
