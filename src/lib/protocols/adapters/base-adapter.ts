/**
 * Base Agent Adapter Interface
 * @module protocols/adapters/base-adapter
 */

import type { AgentAPIClient } from '../agentapi-client';
import type { MCPClient } from '../mcp-client';

// ============================================================================
// Agent Adapter Types
// ============================================================================

export type AgentAdapterType = 'aider' | 'cline' | 'continue' | 'claude-code' | 'goose' | 'universal';

export interface AgentCapabilities {
  gitOperations: boolean;
  fileOperations: boolean;
  codeGeneration: boolean;
  refactoring: boolean;
  testing: boolean;
  documentation: boolean;
  interactiveMode: boolean;
  mcpNative: boolean;
  agentAPISupport: boolean;
}

export interface AgentConfig {
  type: AgentAdapterType;
  workspace: string;
  model?: string;
  files?: string[];
  apiKey?: string;
  baseUrl?: string;
  customConfig?: Record<string, unknown>;
}

export interface AgentSession {
  id: string;
  type: AgentAdapterType;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  startedAt: Date;
  workspace: string;
  capabilities: AgentCapabilities;
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface AgentResult {
  success: boolean;
  output?: string;
  error?: string;
  filesChanged?: string[];
  duration?: number;
}

// ============================================================================
// Base Agent Adapter
// ============================================================================

export abstract class BaseAgentAdapter {
  protected config: AgentConfig;
  protected session: AgentSession | null = null;
  protected agentAPIClient: AgentAPIClient | null = null;
  protected mcpClient: MCPClient | null = null;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  // Abstract methods that must be implemented by each adapter
  abstract getCapabilities(): AgentCapabilities;
  abstract start(task: string): Promise<AgentSession>;
  abstract sendMessage(message: string): Promise<AgentResult>;
  abstract stop(): Promise<void>;

  // Common methods with default implementations
  async getStatus(): Promise<AgentSession | null> {
    return this.session;
  }

  async isRunning(): Promise<boolean> {
    return this.session?.status === 'running';
  }

  async getHistory(): Promise<AgentMessage[]> {
    return [];
  }

  protected generateSessionId(): string {
    const type = this.config.type;
    const crypto = require('crypto');
    const randomHex = crypto.randomBytes(4).toString('hex');
    return `${type}-${randomHex}`;
  }

  protected createSession(id: string): AgentSession {
    return {
      id,
      type: this.config.type,
      status: 'running',
      startedAt: new Date(),
      workspace: this.config.workspace,
      capabilities: this.getCapabilities(),
    };
  }
}

// ============================================================================
// Adapter Registry
// ============================================================================

// Type for concrete adapter class constructors (not abstract)
type ConcreteAdapterClass = new (config: AgentConfig) => BaseAgentAdapter;

export class AgentAdapterRegistry {
  private static adapters = new Map<AgentAdapterType, ConcreteAdapterClass>();

  static register(type: AgentAdapterType, adapter: ConcreteAdapterClass): void {
    this.adapters.set(type, adapter);
  }

  static get(type: AgentAdapterType): ConcreteAdapterClass | undefined {
    return this.adapters.get(type);
  }

  static create(config: AgentConfig): BaseAgentAdapter {
    const AdapterClass = this.adapters.get(config.type);
    if (!AdapterClass) {
      throw new Error(`No adapter registered for type: ${config.type}`);
    }
    return new AdapterClass(config);
  }

  static getSupportedTypes(): AgentAdapterType[] {
    return Array.from(this.adapters.keys());
  }
}
