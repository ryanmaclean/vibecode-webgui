// Agent Framework - Building on top of UnifiedAIClient
// Provides a flexible foundation for creating AI agents with tools, memory, and planning capabilities

import { UnifiedAIClient, type UnifiedChatMessage } from '../unified-ai-client';
import { EventEmitter } from 'events';

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

  constructor(options: AgentOptions = {}) {
    super();
    
    this.client = options.client || new UnifiedAIClient();
    this.model = options.model || 'openrouter/meta-llama/llama-3-70b-instruct';
    this.temperature = options.temperature ?? 0.7;
    this.maxTokens = options.maxTokens ?? 1000;
    this.memorySize = options.memorySize ?? 20;
    this.systemPrompt = options.systemPrompt || 'You are a helpful AI assistant.';
    this.tools = new Map();
    
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
    return this.memory.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
      ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
      ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
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
      if (response.tool_calls?.length) {
        const toolResults = [];
        
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

// Export types
export * from './types';

// Export built-in tools
export * from './tools';

// Export specialized agents
export * from './agents';
