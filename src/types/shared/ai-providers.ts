/**
 * Shared AI Provider Types for VibeCode Cross-Service Contracts
 *
 * Unified type definitions for AI provider integrations supporting 12+ models
 * (OpenAI, Anthropic, DeepSeek, Google, Meta, Mistral, etc.). Provides
 * consistent interfaces for chat completions, streaming, embeddings, and
 * provider health monitoring.
 *
 * Based on LiteLLM-inspired unified interface pattern.
 *
 * @module types/shared/ai-providers
 */

import { BaseRequest, BaseResponse, ApiError, ErrorCode, OperationStatus, Timestamp } from './common'

// ============================================================================
// Provider Configuration Types
// ============================================================================

/**
 * Supported AI provider identifiers
 */
export type AIProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'openrouter'
  | 'ollama'
  | 'localai'
  | 'azure'
  | 'bedrock'
  | 'vertex'
  | 'cohere'
  | 'mistral'
  | 'together'
  | 'groq'
  | 'perplexity'

/**
 * AI provider configuration
 */
export interface AIProviderConfig {
  /** Provider unique identifier */
  id: AIProviderId

  /** Human-readable provider name */
  name: string

  /** Base API URL */
  baseURL: string

  /** Available models for this provider */
  models: string[]

  /** Whether API key is required */
  apiKeyRequired: boolean

  /** Default request headers */
  defaultHeaders?: Record<string, string>

  /** Provider-specific configuration */
  config?: Record<string, unknown>

  /** Timeout in milliseconds */
  timeout?: number

  /** Maximum retries on failure */
  maxRetries?: number

  /** Whether this provider is currently enabled */
  enabled?: boolean
}

/**
 * Provider health status
 */
export type ProviderHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'

/**
 * Circuit breaker state
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half_open'

/**
 * Provider health information
 */
export interface ProviderHealth {
  /** Provider identifier */
  providerId: AIProviderId

  /** Current health status */
  status: ProviderHealthStatus

  /** Circuit breaker state */
  circuitState: CircuitBreakerState

  /** Last successful request timestamp */
  lastSuccess?: Timestamp

  /** Last failed request timestamp */
  lastFailure?: Timestamp

  /** Recent failure count */
  recentFailures: number

  /** Average response time (ms) */
  avgResponseTime?: number

  /** Error rate (0-1) */
  errorRate?: number

  /** Additional details */
  details?: Record<string, unknown>

  /** Last check timestamp */
  checkedAt: Timestamp
}

// ============================================================================
// Chat Message Types
// ============================================================================

/**
 * Message role in conversation
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'function' | 'tool'

/**
 * Unified chat message structure
 */
export interface ChatMessage {
  /** Message role */
  role: MessageRole

  /** Message content (text or structured content) */
  content: string | MessageContent[]

  /** Message name (for function/tool messages) */
  name?: string

  /** Tool calls made by assistant (for tool use) */
  tool_calls?: ToolCall[]

  /** Tool call ID (for tool response messages) */
  tool_call_id?: string

  /** Function call (deprecated, use tool_calls) */
  function_call?: FunctionCall
}

/**
 * Structured message content (for multimodal messages)
 */
export type MessageContent = TextContent | ImageContent

/**
 * Text content block
 */
export interface TextContent {
  type: 'text'
  text: string
}

/**
 * Image content block
 */
export interface ImageContent {
  type: 'image_url'
  image_url: {
    url: string
    detail?: 'auto' | 'low' | 'high'
  }
}

// ============================================================================
// Tool/Function Calling Types
// ============================================================================

/**
 * Tool call structure
 */
export interface ToolCall {
  /** Tool call unique identifier */
  id: string

  /** Tool type (currently only 'function' supported) */
  type: 'function'

  /** Function call details */
  function: {
    /** Function name */
    name: string

    /** Function arguments (JSON string) */
    arguments: string
  }
}

/**
 * Function call structure (deprecated, use ToolCall)
 */
export interface FunctionCall {
  /** Function name */
  name: string

  /** Function arguments (JSON string) */
  arguments: string
}

/**
 * Tool definition for tool-calling capable models
 */
export interface ToolDefinition {
  /** Tool type */
  type: 'function'

  /** Function definition */
  function: {
    /** Function name */
    name: string

    /** Function description */
    description: string

    /** Function parameters (JSON Schema) */
    parameters: Record<string, unknown>

    /** Whether to use strict schema validation */
    strict?: boolean
  }
}

// ============================================================================
// Chat Request Types
// ============================================================================

/**
 * Chat completion request parameters
 */
export interface ChatCompletionRequest extends BaseRequest {
  /** AI model identifier (e.g., 'gpt-4', 'claude-3-opus') */
  model: string

  /** Conversation messages */
  messages: ChatMessage[]

  /** Provider to use (auto-selected if not specified) */
  provider?: AIProviderId

  /** Temperature (0-2, controls randomness) */
  temperature?: number

  /** Top-p nucleus sampling (0-1) */
  top_p?: number

  /** Maximum tokens to generate */
  max_tokens?: number

  /** Number of completions to generate */
  n?: number

  /** Whether to stream the response */
  stream?: boolean

  /** Stop sequences */
  stop?: string | string[]

  /** Presence penalty (-2 to 2) */
  presence_penalty?: number

  /** Frequency penalty (-2 to 2) */
  frequency_penalty?: number

  /** User identifier for abuse monitoring */
  user?: string

  /** Tools available for the model to call */
  tools?: ToolDefinition[]

  /** Tool choice mode */
  tool_choice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } }

  /** Response format */
  response_format?: { type: 'text' | 'json_object' }

  /** Seed for deterministic sampling */
  seed?: number

  /** Provider-specific options */
  providerOptions?: Record<string, unknown>
}

// ============================================================================
// Chat Response Types
// ============================================================================

/**
 * Token usage statistics
 */
export interface TokenUsage {
  /** Number of tokens in the prompt */
  promptTokens: number

  /** Number of tokens in the completion */
  completionTokens: number

  /** Total tokens used (prompt + completion) */
  totalTokens: number

  /** Cached tokens (if supported by provider) */
  cachedTokens?: number
}

/**
 * Finish reason for completion
 */
export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'function_call' | null

/**
 * Chat completion choice
 */
export interface ChatCompletionChoice {
  /** Choice index */
  index: number

  /** Generated message */
  message: ChatMessage

  /** Reason for completion finish */
  finish_reason: FinishReason

  /** Log probabilities (if requested) */
  logprobs?: unknown
}

/**
 * Chat completion response
 */
export interface ChatCompletionResponse extends BaseResponse<ChatCompletionChoice[]> {
  /** Response data (array of choices) */
  data: ChatCompletionChoice[]

  /** Model used for generation */
  model: string

  /** Provider that handled the request */
  provider: AIProviderId

  /** Token usage statistics */
  usage: TokenUsage

  /** Response creation timestamp */
  created: number

  /** Response object type */
  object: 'chat.completion'
}

// ============================================================================
// Streaming Types
// ============================================================================

/**
 * Chat completion delta (for streaming)
 */
export interface ChatCompletionDelta {
  /** Role (only in first chunk) */
  role?: MessageRole

  /** Content delta */
  content?: string

  /** Tool calls delta */
  tool_calls?: ToolCall[]

  /** Function call delta */
  function_call?: FunctionCall
}

/**
 * Streaming choice chunk
 */
export interface ChatCompletionStreamChoice {
  /** Choice index */
  index: number

  /** Delta content */
  delta: ChatCompletionDelta

  /** Finish reason (only in last chunk) */
  finish_reason: FinishReason

  /** Log probabilities (if requested) */
  logprobs?: unknown
}

/**
 * Chat completion stream chunk
 */
export interface ChatCompletionStreamChunk {
  /** Chunk object type */
  object: 'chat.completion.chunk'

  /** Response ID */
  id: string

  /** Chunk creation timestamp */
  created: number

  /** Model used */
  model: string

  /** Provider that handled the request */
  provider: AIProviderId

  /** Stream choices */
  choices: ChatCompletionStreamChoice[]

  /** Token usage (only in final chunk for some providers) */
  usage?: TokenUsage

  /** Whether this is the final chunk */
  done?: boolean
}

// ============================================================================
// Embeddings Types
// ============================================================================

/**
 * Embeddings request parameters
 */
export interface EmbeddingsRequest extends BaseRequest {
  /** AI model identifier (e.g., 'text-embedding-ada-002') */
  model: string

  /** Input text(s) to embed */
  input: string | string[]

  /** Provider to use (auto-selected if not specified) */
  provider?: AIProviderId

  /** Encoding format */
  encoding_format?: 'float' | 'base64'

  /** User identifier for abuse monitoring */
  user?: string

  /** Dimensions (for models that support it) */
  dimensions?: number

  /** Provider-specific options */
  providerOptions?: Record<string, unknown>
}

/**
 * Single embedding vector
 */
export interface Embedding {
  /** Embedding vector */
  embedding: number[]

  /** Index in the input array */
  index: number

  /** Object type */
  object: 'embedding'
}

/**
 * Embeddings response
 */
export interface EmbeddingsResponse extends BaseResponse<Embedding[]> {
  /** Response data (array of embeddings) */
  data: Embedding[]

  /** Model used for generation */
  model: string

  /** Provider that handled the request */
  provider: AIProviderId

  /** Token usage statistics */
  usage: {
    /** Number of tokens in the input */
    promptTokens: number

    /** Total tokens used */
    totalTokens: number
  }

  /** Response object type */
  object: 'list'
}

// ============================================================================
// Model Information Types
// ============================================================================

/**
 * Model capability flags
 */
export interface ModelCapabilities {
  /** Supports chat completions */
  chat: boolean

  /** Supports function/tool calling */
  functionCalling: boolean

  /** Supports streaming responses */
  streaming: boolean

  /** Supports vision/image inputs */
  vision: boolean

  /** Supports JSON mode */
  jsonMode: boolean

  /** Supports embeddings */
  embeddings: boolean

  /** Maximum context length (tokens) */
  maxContextLength: number

  /** Maximum output tokens */
  maxOutputTokens?: number
}

/**
 * Model pricing information
 */
export interface ModelPricing {
  /** Cost per 1M input tokens (USD) */
  inputCostPer1M: number

  /** Cost per 1M output tokens (USD) */
  outputCostPer1M: number

  /** Currency code */
  currency: 'USD'
}

/**
 * Model metadata
 */
export interface ModelInfo {
  /** Model identifier */
  id: string

  /** Human-readable model name */
  name: string

  /** Provider that offers this model */
  provider: AIProviderId

  /** Model capabilities */
  capabilities: ModelCapabilities

  /** Pricing information */
  pricing?: ModelPricing

  /** Model description */
  description?: string

  /** Deprecated status */
  deprecated?: boolean

  /** Release date */
  releasedAt?: Timestamp
}

// ============================================================================
// Cost Tracking Types
// ============================================================================

/**
 * Cost calculation result
 */
export interface AIOperationCost {
  /** Input tokens cost (USD) */
  inputCost: number

  /** Output tokens cost (USD) */
  outputCost: number

  /** Total cost (USD) */
  totalCost: number

  /** Currency code */
  currency: 'USD'

  /** Model used */
  model: string

  /** Provider used */
  provider: AIProviderId

  /** Token usage */
  usage: TokenUsage
}

// ============================================================================
// Provider Registry Types
// ============================================================================

/**
 * Provider registry interface
 */
export interface AIProviderRegistry {
  /** Get all available providers */
  providers: AIProviderConfig[]

  /** Get provider by ID */
  getProvider(id: AIProviderId): AIProviderConfig | null

  /** Get provider for a specific model */
  getProviderForModel(model: string): AIProviderConfig | null

  /** Get all available models */
  getAvailableModels(): string[]

  /** Check provider health */
  getProviderHealth(): Promise<Record<AIProviderId, ProviderHealth>>

  /** Check if provider is healthy */
  isProviderHealthy(id: AIProviderId): Promise<boolean>
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * AI provider-specific error codes (extends common ErrorCode)
 */
export type AIErrorCode =
  | ErrorCode
  | 'PROVIDER_UNAVAILABLE'
  | 'MODEL_NOT_FOUND'
  | 'CONTEXT_LENGTH_EXCEEDED'
  | 'INVALID_API_KEY'
  | 'CONTENT_FILTER'
  | 'CIRCUIT_BREAKER_OPEN'
  | 'NETWORK_ERROR'
  | 'PROVIDER_ERROR'

/**
 * AI provider error (extends common ApiError with AI-specific fields)
 */
export interface AIProviderError extends Omit<ApiError, 'code'> {
  /** Error code (common or AI-specific) */
  code: AIErrorCode

  /** Provider that generated the error */
  provider?: AIProviderId

  /** Model that was being used */
  model?: string

  /** HTTP status code (if applicable) */
  statusCode?: number

  /** Provider-specific error details */
  providerError?: unknown
}

// ============================================================================
// Monitoring & Metrics Types
// ============================================================================

/**
 * AI operation metrics
 */
export interface AIOperationMetrics {
  /** Operation type */
  operation: 'chat' | 'embedding' | 'stream'

  /** Provider used */
  provider: AIProviderId

  /** Model used */
  model: string

  /** Operation status */
  status: OperationStatus

  /** Duration in milliseconds */
  durationMs: number

  /** Token usage */
  usage?: TokenUsage

  /** Cost information */
  cost?: AIOperationCost

  /** Error information (if failed) */
  error?: AIProviderError

  /** Timestamp */
  timestamp: Timestamp
}
