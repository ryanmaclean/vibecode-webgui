/**
 * Comprehensive TypeScript type definitions for Monacopilot configuration
 * 
 * This file provides complete type safety for AI-powered code completion
 * with Monaco Editor using Monacopilot library.
 * 
 * @see https://monacopilot.dev/
 * @version 1.2.7+
 */

import * as monaco from 'monaco-editor';
import type { 
  RegisterCompletionOptions, 
  CompletionRegistration,
  FetchCompletionItemParams,
  FetchCompletionItemReturn
} from 'monacopilot';

// =============================================================================
// AI PROVIDER TYPES
// =============================================================================

/**
 * Supported AI providers for code completion
 */
export type AIProvider = 
  | 'openai'
  | 'mistral'
  | 'anthropic'
  | 'groq'
  | 'cohere'
  | 'fireworks-ai'
  | 'perplexity'
  | 'together'
  | 'custom';

/**
 * OpenAI model types for code completion
 */
export type OpenAIModel = 
  | 'gpt-4'
  | 'gpt-4-turbo'
  | 'gpt-4-turbo-preview'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-3.5-turbo'
  | 'gpt-3.5-turbo-16k';

/**
 * Mistral model types optimized for code completion
 */
export type MistralModel =
  | 'codestral-latest'
  | 'codestral'
  | 'mistral-large'
  | 'mistral-medium'
  | 'mistral-small';

/**
 * Anthropic Claude model types
 */
export type AnthropicModel =
  | 'claude-3-opus-20240229'
  | 'claude-3-sonnet-20240229'
  | 'claude-3-haiku-20240307'
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-5-haiku-20241022';

/**
 * Groq model types (very fast inference)
 */
export type GroqModel =
  | 'mixtral-8x7b-32768'
  | 'llama3-70b-8192'
  | 'llama3-8b-8192'
  | 'gemma-7b-it'
  | 'codellama-34b-instruct';

/**
 * Cohere model types
 */
export type CohereModel =
  | 'command-r'
  | 'command-r-plus'
  | 'command'
  | 'command-light';

/**
 * Fireworks AI model types
 */
export type FireworksModel =
  | 'accounts/fireworks/models/llama-v3-70b-instruct'
  | 'accounts/fireworks/models/mixtral-8x7b-instruct'
  | 'accounts/fireworks/models/deepseek-coder-v2-lite-instruct';

/**
 * Union of all supported model types
 */
export type AIModel = 
  | OpenAIModel 
  | MistralModel 
  | AnthropicModel 
  | GroqModel 
  | CohereModel 
  | FireworksModel;

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/**
 * Trigger modes for code completion
 */
export type CompletionTrigger = 
  | 'onIdle'    // Provides completions after a brief pause in typing (default)
  | 'onTyping'  // Provides completions in real-time as you type
  | 'onDemand'; // Manual trigger only

/**
 * Programming languages supported by Monaco Editor
 */
export type SupportedLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'java'
  | 'cpp'
  | 'c'
  | 'csharp'
  | 'go'
  | 'rust'
  | 'php'
  | 'ruby'
  | 'kotlin'
  | 'swift'
  | 'dart'
  | 'scala'
  | 'html'
  | 'css'
  | 'scss'
  | 'less'
  | 'json'
  | 'yaml'
  | 'xml'
  | 'sql'
  | 'shell'
  | 'dockerfile'
  | 'markdown';

/**
 * Related file information for enhanced context
 */
export interface RelatedFile {
  /** Relative path from the current editing file */
  path: string;
  /** Content of the related file */
  content: string;
}

/**
 * Advanced AI model parameters
 */
export interface ModelParameters {
  /** Controls randomness in generation (0.0-2.0, default: 0.1) */
  temperature?: number;
  /** Maximum tokens in completion (default: 256) */
  maxTokens?: number;
  /** Top-p sampling parameter (0.0-1.0, default: 0.1) */
  topP?: number;
  /** Stop sequences to end completion */
  stopSequences?: string[];
  /** Frequency penalty (-2.0 to 2.0) */
  frequencyPenalty?: number;
  /** Presence penalty (-2.0 to 2.0) */
  presencePenalty?: number;
}

/**
 * Caching configuration for completion results
 */
export interface CacheConfig {
  /** Enable caching of completion results */
  enabled?: boolean;
  /** Cache TTL in milliseconds */
  ttl?: number;
  /** Maximum cache size in entries */
  maxSize?: number;
}

/**
 * Request timeout configuration
 */
export interface TimeoutConfig {
  /** Connection timeout in milliseconds */
  connection?: number;
  /** Request timeout in milliseconds */
  request?: number;
  /** Maximum retry attempts */
  retries?: number;
}

/**
 * Performance monitoring configuration
 */
export interface PerformanceConfig {
  /** Enable performance metrics collection */
  enabled?: boolean;
  /** Log slow requests above this threshold (ms) */
  slowRequestThreshold?: number;
  /** Sample rate for metrics (0.0-1.0) */
  sampleRate?: number;
}

// =============================================================================
// CALLBACK TYPES
// =============================================================================

/**
 * Callback triggered when a completion is shown in the editor
 */
export type OnCompletionShown = (completion: string, range: monaco.IRange | undefined) => void;

/**
 * Callback triggered when a completion is accepted by the user
 */
export type OnCompletionAccepted = () => void;

/**
 * Callback triggered when a completion is rejected by the user
 */
export type OnCompletionRejected = () => void;

/**
 * Callback triggered when a completion is requested
 */
export type OnCompletionRequested = (params: FetchCompletionItemParams) => void;

/**
 * Callback triggered when a completion request finishes
 */
export type OnCompletionRequestFinished = (
  params: FetchCompletionItemParams,
  response: FetchCompletionItemReturn
) => void;

/**
 * Custom request handler for advanced use cases
 */
export type CustomRequestHandler = (params: FetchCompletionItemParams) => Promise<FetchCompletionItemReturn>;

/**
 * Error handling callback
 */
export type OnError = (error: Error) => void;

/**
 * Custom trigger condition function
 */
export type TriggerCondition = (params: {
  text: string;
  position: monaco.IPosition;
  triggerType: CompletionTrigger;
}) => boolean;

// =============================================================================
// MAIN CONFIGURATION INTERFACE
// =============================================================================

/**
 * Enhanced Monacopilot configuration interface with comprehensive options
 */
export interface EnhancedMonacopilotConfig {
  // === REQUIRED CONFIGURATION ===
  
  /** 
   * API endpoint for completion requests
   * @example '/api/code-completion'
   * @example 'https://api.openai.com/v1/completions'
   */
  endpoint: string;
  
  /** 
   * Programming language of the code being edited
   * @example 'typescript', 'python', 'java'
   */
  language: SupportedLanguage;

  // === AI PROVIDER CONFIGURATION ===
  
  /** 
   * AI provider to use for completions
   * @default 'openai'
   */
  provider?: AIProvider;
  
  /** 
   * Specific AI model to use
   * @example 'gpt-4-turbo', 'codestral-latest', 'claude-3-sonnet-20240229'
   */
  model?: AIModel;
  
  /** Advanced model parameters */
  modelParameters?: ModelParameters;

  // === BASIC OPTIONS ===
  
  /** 
   * Enable debug logging to console
   * @default false
   */
  debug?: boolean;
  
  /** 
   * Custom HTTP headers for requests
   * @example { 'Authorization': 'Bearer token', 'X-Custom': 'value' }
   */
  headers?: Record<string, string>;
  
  /** 
   * API key for the AI provider
   * @deprecated Use headers for authentication instead
   */
  apiKey?: string;

  // === ADVANCED CONFIGURATION ===
  
  /** 
   * When completions should be triggered
   * @default 'onIdle'
   */
  trigger?: CompletionTrigger;
  
  /** 
   * Name of the file being edited for context
   * @example 'utils.ts', 'main.py'
   */
  filename?: string;
  
  /** 
   * Technologies/frameworks being used for enhanced context
   * @example ['react', 'nextjs', 'tailwindcss']
   */
  technologies?: string[];
  
  /** 
   * Related files to provide additional context
   */
  relatedFiles?: RelatedFile[];
  
  /** 
   * Maximum number of lines to include in context
   * @default 100
   */
  maxContextLines?: number;
  
  /** 
   * Enable caching of completion results
   * @default true
   */
  enableCaching?: boolean;
  
  /** 
   * Allow follow-up completions after accepting one
   * @default true
   */
  allowFollowUpCompletions?: boolean;

  // === PERFORMANCE CONFIGURATION ===
  
  /** Caching configuration */
  cache?: CacheConfig;
  
  /** Request timeout configuration */
  timeout?: TimeoutConfig;
  
  /** Performance monitoring configuration */
  performance?: PerformanceConfig;

  // === CALLBACKS ===
  
  /** Error handling callback */
  onError?: OnError;
  
  /** Custom request handler */
  requestHandler?: CustomRequestHandler;
  
  /** Completion shown callback */
  onCompletionShown?: OnCompletionShown;
  
  /** Completion accepted callback */
  onCompletionAccepted?: OnCompletionAccepted;
  
  /** Completion rejected callback */
  onCompletionRejected?: OnCompletionRejected;
  
  /** Completion requested callback */
  onCompletionRequested?: OnCompletionRequested;
  
  /** Completion request finished callback */
  onCompletionRequestFinished?: OnCompletionRequestFinished;
  
  /** Custom trigger condition function */
  triggerIf?: TriggerCondition;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Basic Monacopilot configuration (backwards compatible)
 */
export interface MonacopilotConfig {
  /** API endpoint for completion requests */
  endpoint: string;
  /** Programming language */
  language: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom request headers */
  headers?: Record<string, string>;
}

/**
 * Provider-specific configuration helpers
 */
export interface OpenAIConfig extends Omit<EnhancedMonacopilotConfig, 'provider' | 'model'> {
  provider: 'openai';
  model?: OpenAIModel;
  /** OpenAI API key */
  apiKey?: string;
}

export interface MistralConfig extends Omit<EnhancedMonacopilotConfig, 'provider' | 'model'> {
  provider: 'mistral';
  model?: MistralModel;
  /** Mistral API key */
  apiKey?: string;
}

export interface AnthropicConfig extends Omit<EnhancedMonacopilotConfig, 'provider' | 'model'> {
  provider: 'anthropic';
  model?: AnthropicModel;
  /** Anthropic API key */
  apiKey?: string;
}

export interface GroqConfig extends Omit<EnhancedMonacopilotConfig, 'provider' | 'model'> {
  provider: 'groq';
  model?: GroqModel;
  /** Groq API key */
  apiKey?: string;
}

/**
 * Union type for all provider-specific configurations
 */
export type ProviderSpecificConfig = 
  | OpenAIConfig 
  | MistralConfig 
  | AnthropicConfig 
  | GroqConfig
  | EnhancedMonacopilotConfig;

// =============================================================================
// FUNCTION TYPES
// =============================================================================

/**
 * Setup function type for Monacopilot integration
 */
export type SetupMonacopilot = (
  monacoInstance: typeof monaco,
  editor: monaco.editor.IStandaloneCodeEditor,
  config: MonacopilotConfig | EnhancedMonacopilotConfig
) => MonacopilotRegistration;

/**
 * Multi-editor setup function type
 */
export type SetupMonacopilotMulti = (
  monacoInstance: typeof monaco,
  editors: monaco.editor.IStandaloneCodeEditor[],
  config: MonacopilotConfig | EnhancedMonacopilotConfig
) => MonacopilotRegistration[];

/**
 * Registration result type
 */
export type MonacopilotRegistration = CompletionRegistration;

// =============================================================================
// EXPORTED HELPER TYPES
// =============================================================================

/**
 * All available configuration types for easy import
 */
export {
  RegisterCompletionOptions,
  CompletionRegistration
} from 'monacopilot';

/**
 * Configuration validation helpers
 */
export interface ConfigValidation {
  /** Validate basic configuration */
  isValidConfig(config: unknown): config is MonacopilotConfig;
  /** Validate enhanced configuration */
  isValidEnhancedConfig(config: unknown): config is EnhancedMonacopilotConfig;
  /** Validate provider-specific configuration */
  isValidProviderConfig(config: unknown): config is ProviderSpecificConfig;
}

/**
 * Default configuration values
 */
export interface DefaultConfig {
  trigger: CompletionTrigger;
  maxContextLines: number;
  enableCaching: boolean;
  allowFollowUpCompletions: boolean;
  modelParameters: Required<ModelParameters>;
}

// Re-export commonly used Monaco types for convenience
export type MonacoEditor = monaco.editor.IStandaloneCodeEditor;
export type MonacoInstance = typeof monaco;
export type EditorPosition = monaco.IPosition;
export type EditorRange = monaco.IRange;