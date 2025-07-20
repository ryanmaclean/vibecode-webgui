// Type definitions for the Agent Framework

import { UnifiedChatMessage } from '../unified-ai-client';

export * from './index';

/**
 * Base interface for all agent events
 */
export interface AgentEventMap {
  [AgentEvent.Message]: (message: AgentMessage) => void;
  [AgentEvent.ToolCall]: (data: { tool: string; args: Record<string, any> }) => void;
  [AgentEvent.ToolResult]: (data: { tool: string; result: any }) => void;
  [AgentEvent.Error]: (error: Error) => void;
  [AgentEvent.Complete]: (result: AgentResponse) => void;
}

/**
 * Configuration for creating a new agent
 */
export interface AgentConfig {
  /** Default model to use for the agent */
  model?: string;
  
  /** Temperature for generation (0-2) */
  temperature?: number;
  
  /** Maximum number of tokens to generate */
  maxTokens?: number;
  
  /** Maximum number of messages to keep in memory */
  memorySize?: number;
  
  /** System prompt to initialize the agent with */
  systemPrompt?: string;
  
  /** Whether to enable verbose logging */
  verbose?: boolean;
  
  /** Custom tools to register with the agent */
  tools?: ToolDefinition[];
}

/**
 * Result of a tool execution
 */
export interface ToolExecutionResult {
  /** Whether the tool executed successfully */
  success: boolean;
  
  /** Result of the tool execution */
  result?: any;
  
  /** Error if the tool failed */
  error?: Error;
  
  /** Time taken to execute the tool in milliseconds */
  duration: number;
}

/**
 * Context available to tools during execution
 */
export interface ToolContext {
  /** The agent instance that executed the tool */
  agent: Agent;
  
  /** The current message being processed */
  message: AgentMessage;
  
  /** The current conversation history */
  history: AgentMessage[];
  
  /** Additional context data */
  [key: string]: any;
}

/**
 * Extended message interface that includes metadata
 */
export interface ExtendedAgentMessage extends AgentMessage {
  /** Unique ID for the message */
  id: string;
  
  /** Timestamp when the message was created */
  createdAt: number;
  
  /** Metadata about the message */
  metadata?: {
    /** Model used to generate the message */
    model?: string;
    
    /** Provider used for the message */
    provider?: string;
    
    /** Token usage information */
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    
    /** Any additional metadata */
    [key: string]: any;
  };
}

/**
 * Function signature for tool execution
 */
export type ToolExecutor = (
  params: Record<string, any>,
  context: ToolContext
) => Promise<any>;

/**
 * Tool definition with enhanced metadata
 */
export interface EnhancedToolDefinition extends ToolDefinition {
  /** Whether the tool is enabled */
  enabled: boolean;
  
  /** Timeout for tool execution in milliseconds */
  timeout?: number;
  
  /** Rate limiting configuration */
  rateLimit?: {
    /** Maximum number of calls per minute */
    maxCalls: number;
    
    /** Time window in minutes */
    timeWindow: number;
  };
}

/**
 * Memory management configuration
 */
export interface MemoryConfig {
  /** Maximum number of messages to keep in memory */
  maxMessages: number;
  
  /** Whether to include tool messages in memory */
  includeToolMessages: boolean;
  
  /** Whether to include system messages in memory */
  includeSystemMessages: boolean;
  
  /** Whether to compress old messages to save space */
  enableCompression: boolean;
}

/**
 * Configuration for the agent's response generation
 */
export interface GenerationConfig {
  /** Model to use for generation */
  model: string;
  
  /** Temperature for generation */
  temperature: number;
  
  /** Maximum number of tokens to generate */
  maxTokens: number;
  
  /** Top-p sampling */
  topP?: number;
  
  /** Frequency penalty */
  frequencyPenalty?: number;
  
  /** Presence penalty */
  presencePenalty?: number;
  
  /** Stop sequences */
  stop?: string | string[];
}

/**
 * Statistics about the agent's operation
 */
export interface AgentStats {
  /** Number of messages processed */
  messagesProcessed: number;
  
  /** Number of tool calls made */
  toolCalls: number;
  
  /** Number of errors encountered */
  errors: number;
  
  /** Average response time in milliseconds */
  averageResponseTime: number;
  
  /** Token usage statistics */
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
