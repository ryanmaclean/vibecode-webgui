// Agent Framework - Building on top of UnifiedAIClient
// Provides a flexible foundation for creating AI agents with tools, memory, and planning capabilities

import { UnifiedAIClient, type UnifiedChatMessage } from '../unified-ai-client';
import { EventEmitter } from 'events';
import { ConfirmationService } from './confirmation/service';
import type { ActionPreview, ActionType } from '../../types/agent-confirmation';
import { randomUUID } from 'crypto';

// Types
export type AgentRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AgentMessage {
  role: AgentRole;
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  timestamp?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (params: Record<string, any>) => Promise<any>;
  requiresConfirmation?: boolean;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface AgentOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  memorySize?: number;
  systemPrompt?: string;
  client?: UnifiedAIClient;
  confirmationService?: ConfirmationService;
  agentId?: string;
}

export interface AgentResponse {
  content: string;
  toolCalls?: ToolCall[];
  metadata: {
    model: string;
    provider: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };
}

// Event types
export enum AgentEvent {
  Message = 'message',
  ToolCall = 'tool_call',
  ToolResult = 'tool_result',
  Error = 'error',
  Complete = 'complete',
  ConfirmationRequired = 'confirmation_required',
  ConfirmationApproved = 'confirmation_approved',
  ConfirmationRejected = 'confirmation_rejected',
}

/**
 * Base Agent class providing core functionality for AI agents
 */
export class Agent extends EventEmitter {
  private client: UnifiedAIClient;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private tools: Map<string, ToolDefinition>;
  private memory: AgentMessage[] = [];
  private memorySize: number;
  private systemPrompt: string;
  private confirmationService: ConfirmationService;
  private agentId: string;

  constructor(options: AgentOptions = {}) {
    super();

    this.client = options.client || new UnifiedAIClient();
    this.model = options.model || 'openrouter/meta-llama/llama-3-70b-instruct';
    this.temperature = options.temperature ?? 0.7;
    this.maxTokens = options.maxTokens ?? 1000;
    this.memorySize = options.memorySize ?? 20;
    this.systemPrompt = options.systemPrompt || 'You are a helpful AI assistant.';
    this.tools = new Map();
    this.confirmationService = options.confirmationService || new ConfirmationService();
    this.agentId = options.agentId || randomUUID();

    // Forward confirmation service events to agent events
    this.confirmationService.on('confirmation_required', (event) => {
      this.emit(AgentEvent.ConfirmationRequired, event);
    });

    this.confirmationService.on('confirmation_approved', (event) => {
      this.emit(AgentEvent.ConfirmationApproved, event);
    });

    this.confirmationService.on('confirmation_rejected', (event) => {
      this.emit(AgentEvent.ConfirmationRejected, event);
    });

    // Register tools if provided
    if (options.tools) {
      this.registerTools(options.tools);
    }

    // Initialize with system message
    this.addToMemory({
      role: 'system',
      content: this.systemPrompt,
    });
  }

  /**
   * Register one or more tools with the agent
   */
  registerTools(tools: ToolDefinition | ToolDefinition[]): void {
    const toolsArray = Array.isArray(tools) ? tools : [tools];
    
    for (const tool of toolsArray) {
      this.tools.set(tool.name, tool);
    }
  }

  /**
   * Add a message to the agent's memory
   */
  addToMemory(message: Omit<AgentMessage, 'timestamp'>): void {
    const messageWithTimestamp = {
      ...message,
      timestamp: Date.now(),
    };
    
    this.memory.push(messageWithTimestamp);
    this.emit(AgentEvent.Message, messageWithTimestamp);
    
    // Trim memory if it exceeds the maximum size
    if (this.memory.length > this.memorySize) {
      // Keep system message and recent messages
      const systemMessage = this.memory[0];
      const recentMessages = this.memory.slice(-(this.memorySize - 1));
      this.memory = [systemMessage, ...recentMessages];
    }
  }

  /**
   * Clear the agent's memory while preserving the system prompt
   */
  clearMemory(): void {
    const systemMessage = this.memory.find(m => m.role === 'system');
    this.memory = systemMessage ? [systemMessage] : [];
  }

  /**
   * Convert agent memory to unified chat messages
   */
  private getChatMessages(): UnifiedChatMessage[] {
    return this.memory
      .filter(msg => msg.role === 'system' || msg.role === 'user' || msg.role === 'assistant')
      .map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      }));
  }

  /**
   * Execute a tool call and return the result
   */
  private async executeToolCall(toolCall: ToolCall): Promise<any> {
    const { name, arguments: argsString } = toolCall.function;
    const tool = this.tools.get(name);

    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }

    let args: Record<string, any>;
    try {
      args = JSON.parse(argsString);
    } catch (error) {
      throw new Error(`Invalid tool arguments: ${argsString}`);
    }

    // Check if tool requires confirmation
    if (tool.requiresConfirmation) {
      await this.requestAndAwaitConfirmation(tool, args);
    }

    this.emit(AgentEvent.ToolCall, { tool: name, args });

    try {
      const result = await tool.execute(args);
      this.emit(AgentEvent.ToolResult, { tool: name, result });
      return result;
    } catch (error) {
      this.emit(AgentEvent.Error, { tool: name, error });
      throw error;
    }
  }

  /**
   * Request confirmation for a tool execution and await user decision
   */
  private async requestAndAwaitConfirmation(
    tool: ToolDefinition,
    args: Record<string, any>
  ): Promise<void> {
    // Map tool name to action type
    const actionTypeMap: Record<string, ActionType> = {
      file_write: 'file_write',
      file_edit: 'file_edit',
      file_delete: 'file_delete',
      code_replace: 'code_replace',
      command_execute: 'command_execute',
    };

    const actionType = actionTypeMap[tool.name] || 'file_edit';

    // Create action preview
    const actionPreview: ActionPreview = {
      action_id: randomUUID(),
      action_type: actionType,
      tool_name: tool.name,
      file_path: args.file_path || args.path || args.file,
      explanation: this.generateExplanation(tool, args),
      created_at: new Date().toISOString(),
    };

    // Add diff preview if available
    if (args.old_content && args.new_content) {
      actionPreview.diff = {
        old_content: args.old_content,
        new_content: args.new_content,
        language: args.language,
        lines_added: this.countLines(args.new_content) - this.countLines(args.old_content),
        lines_removed: Math.max(0, this.countLines(args.old_content) - this.countLines(args.new_content)),
      };
    }

    // Request confirmation
    const confirmationRequest = this.confirmationService.requestConfirmation(
      this.agentId,
      actionPreview,
      {
        timeout: 300000, // 5 minutes
        bulkApprovable: true,
        riskLevel: this.assessRiskLevel(tool, args),
      }
    );

    // Await user decision
    try {
      const response = await this.confirmationService.awaitConfirmation(
        confirmationRequest.request_id
      );

      if (response.decision === 'reject') {
        throw new Error(`User rejected action: ${response.comment || 'No reason provided'}`);
      }
    } catch (error) {
      throw new Error(
        `Confirmation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate human-readable explanation for an action
   */
  private generateExplanation(tool: ToolDefinition, args: Record<string, any>): string {
    const filePath = args.file_path || args.path || args.file;

    switch (tool.name) {
      case 'file_write':
        return `Write new content to file: ${filePath}`;
      case 'file_edit':
        return `Edit existing file: ${filePath}`;
      case 'file_delete':
        return `Delete file: ${filePath}`;
      case 'code_replace':
        return `Replace code in: ${filePath}`;
      case 'command_execute':
        return `Execute command: ${args.command || 'unknown'}`;
      default:
        return `Execute ${tool.name} with parameters: ${JSON.stringify(args)}`;
    }
  }

  /**
   * Assess risk level of a tool action
   */
  private assessRiskLevel(
    tool: ToolDefinition,
    args: Record<string, any>
  ): 'low' | 'medium' | 'high' {
    // High risk: file deletion, command execution
    if (tool.name === 'file_delete' || tool.name === 'command_execute') {
      return 'high';
    }

    // Medium risk: file writes, code replacement
    if (tool.name === 'file_write' || tool.name === 'code_replace') {
      return 'medium';
    }

    // Low risk: file edits
    return 'low';
  }

  /**
   * Count number of lines in a string
   */
  private countLines(content: string): number {
    if (!content) return 0;
    return content.split('\n').length;
  }

  /**
   * Process a message and generate a response
   */
  async processMessage(
    content: string,
    options: Partial<AgentOptions> = {}
  ): Promise<AgentResponse> {
    // Add user message to memory
    this.addToMemory({
      role: 'user',
      content,
    });

    try {
      const messages = this.getChatMessages();
      const response = await this.client.chat(
        messages,
        options.model || this.model,
        {
          temperature: options.temperature ?? this.temperature,
          maxTokens: options.maxTokens ?? this.maxTokens,
        }
      );

      // Add assistant's response to memory
      const assistantMessage: AgentMessage = {
        role: 'assistant',
        content: response.content,
        ...(response.tool_calls && { tool_calls: response.tool_calls }),
      };
      
      this.addToMemory(assistantMessage);

      // Handle tool calls if present
      if (response.tool_calls && response.tool_calls.length) {
        const toolResults: AgentMessage[] = [];
        
        for (const toolCall of response.tool_calls) {
          try {
            const result = await this.executeToolCall(toolCall);
            toolResults.push({
              role: 'tool' as const,
              content: JSON.stringify(result),
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
            });
          } catch (error) {
            toolResults.push({
              role: 'tool' as const,
              content: `Error executing tool: ${error instanceof Error ? error.message : 'Unknown error'}`,
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
            });
          }
        }
        
        // Add tool results to memory
        for (const result of toolResults) {
          this.addToMemory(result);
        }
        
        // Get final response after tool execution
        return this.processMessage('', options);
      }

      return {
        content: response.content,
        metadata: {
          model: response.model,
          provider: response.provider,
          usage: response.usage,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit(AgentEvent.Error, new Error(`Failed to process message: ${errorMessage}`));
      throw error;
    }
  }

  /**
   * Stream a response to the user
   */
  async *streamResponse(
    content: string,
    options: Partial<AgentOptions> = {}
  ): AsyncGenerator<AgentResponse> {
    // Add user message to memory
    this.addToMemory({
      role: 'user',
      content,
    });

    try {
      const messages = this.getChatMessages();
      const stream = await this.client.chatStream(
        messages,
        options.model || this.model,
        {
          temperature: options.temperature ?? this.temperature,
          maxTokens: options.maxTokens ?? this.maxTokens,
        }
      );

      let fullContent = '';
      
      for await (const chunk of stream) {
        fullContent += chunk.content;
        
        yield {
          content: chunk.content,
          metadata: {
            model: chunk.model,
            provider: chunk.provider,
            usage: chunk.usage,
          },
        };
      }

      // Add assistant's full response to memory
      this.addToMemory({
        role: 'assistant',
        content: fullContent,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit(AgentEvent.Error, new Error(`Streaming failed: ${errorMessage}`));
      throw error;
    }
  }
}

/**
 * Create a new agent with the specified options
 */
export function createAgent(options: AgentOptions = {}): Agent {
  return new Agent(options);
}
