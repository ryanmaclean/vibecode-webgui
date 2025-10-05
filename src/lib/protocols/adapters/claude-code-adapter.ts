/**
 * Claude Code Agent Adapter
 * Native MCP support with Anthropic's Claude models
 * @module protocols/adapters/claude-code-adapter
 */

import { BaseAgentAdapter, AgentCapabilities, AgentSession, AgentResult } from './base-adapter';
import { createMCPClient } from '../mcp-client';
import type { AgentConfig } from './base-adapter';
import type { MCPClient } from '../mcp-client';

export class ClaudeCodeAdapter extends BaseAgentAdapter {
  private client: MCPClient | null = null;

  constructor(config: AgentConfig) {
    super(config);
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
      agentAPISupport: false,
    };
  }

  async start(task: string): Promise<AgentSession> {
    // Claude Code is MCP-native
    this.client = createMCPClient({
      transport: 'websocket',
      url: this.config.baseUrl || 'ws://localhost:3000/mcp',
    });

    await this.client.connect();

    const sessionId = this.generateSessionId();
    this.session = this.createSession(sessionId);

    // Use MCP sampling API for initial message
    await this.client.createMessage([
      { role: 'user', content: task },
    ]);

    return this.session;
  }

  async sendMessage(message: string): Promise<AgentResult> {
    if (!this.client || !this.client.isConnected()) {
      throw new Error('Claude Code client not connected');
    }

    const startTime = Date.now();

    try {
      const result = await this.client.createMessage([
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

  async stop(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }

    if (this.session) {
      this.session.status = 'stopped';
    }
  }

  // Claude Code-specific methods
  async listTools(): Promise<AgentResult> {
    if (!this.client) {
      throw new Error('Claude Code client not connected');
    }

    try {
      const tools = await this.client.listTools();
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

  async invokeTool(name: string, args: Record<string, unknown>): Promise<AgentResult> {
    if (!this.client) {
      throw new Error('Claude Code client not connected');
    }

    try {
      const result = await this.client.invokeTool(name, args);
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

  async readResource(uri: string): Promise<AgentResult> {
    if (!this.client) {
      throw new Error('Claude Code client not connected');
    }

    try {
      const content = await this.client.readResource(uri);
      return {
        success: true,
        output: content,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async writeResource(uri: string, content: string): Promise<AgentResult> {
    if (!this.client) {
      throw new Error('Claude Code client not connected');
    }

    try {
      await this.client.writeResource(uri, content);
      return {
        success: true,
        output: `Successfully wrote to ${uri}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getPrompt(name: string, args: Record<string, string>): Promise<AgentResult> {
    if (!this.client) {
      throw new Error('Claude Code client not connected');
    }

    try {
      const result = await this.client.getPrompt(name, args);
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
}
