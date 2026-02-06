/**
 * Context Window Types for AI Context Management
 *
 * This module defines interfaces for managing AI context windows,
 * including token counting, context prioritization, and window filling strategies.
 */

/**
 * Context strategy enumeration for different context filling approaches
 */
export enum ContextStrategy {
  /** Prioritize recently opened/modified files */
  RECENT_FILES = 'recent_files',
  /** Include imports and dependencies of current files */
  RELATED_FILES = 'related_files',
  /** Use embeddings for semantic relevance scoring */
  SEMANTIC = 'semantic',
  /** Combine multiple strategies with weighted scoring */
  HYBRID = 'hybrid',
  /** Prioritize conversation history */
  CONVERSATION = 'conversation',
  /** Focus on specific file types or patterns */
  TARGETED = 'targeted'
}

/**
 * Supported AI model families for token counting
 */
export enum ModelFamily {
  GPT4 = 'gpt-4',
  GPT4_TURBO = 'gpt-4-turbo',
  GPT35_TURBO = 'gpt-3.5-turbo',
  CLAUDE = 'claude',
  CLAUDE_3 = 'claude-3',
  LLAMA = 'llama',
  LLAMA_3 = 'llama-3',
  MISTRAL = 'mistral',
  GEMINI = 'gemini',
  UNKNOWN = 'unknown'
}

/**
 * Context item types for classification
 */
export enum ContextItemType {
  FILE = 'file',
  CODE_SNIPPET = 'code_snippet',
  DOCUMENTATION = 'documentation',
  CONVERSATION = 'conversation',
  SYSTEM_PROMPT = 'system_prompt',
  USER_MESSAGE = 'user_message',
  ASSISTANT_MESSAGE = 'assistant_message',
  TOOL_RESULT = 'tool_result',
  RAG_RESULT = 'rag_result',
  WEB_SEARCH = 'web_search',
  CUSTOM = 'custom'
}

/**
 * Priority levels for context items
 */
export enum ContextPriority {
  CRITICAL = 1,
  HIGH = 2,
  MEDIUM = 3,
  LOW = 4,
  OPTIONAL = 5
}

/**
 * Metadata for context items
 */
export interface ContextItemMetadata {
  /** Source file path or URL */
  source?: string;
  /** Language or format of the content */
  language?: string;
  /** Line numbers if applicable (start, end) */
  lineRange?: [number, number];
  /** Timestamp when content was last modified */
  lastModified?: Date;
  /** Timestamp when content was accessed */
  lastAccessed?: Date;
  /** Symbol or function name if code */
  symbol?: string;
  /** Parent file or document */
  parent?: string;
  /** Related file paths (imports, dependencies) */
  relatedFiles?: string[];
  /** Tags for categorization */
  tags?: string[];
  /** Custom metadata */
  custom?: Record<string, unknown>;
}

/**
 * Represents a single item in the context window
 */
export interface ContextItem {
  /** Unique identifier for the context item */
  id: string;
  /** Type of context item */
  type: ContextItemType;
  /** The actual content */
  content: string;
  /** Token count for this item */
  tokenCount: number;
  /** Priority level (1-5, lower is higher priority) */
  priority: ContextPriority;
  /** Relevance score (0-1) based on ranking criteria */
  relevanceScore: number;
  /** Recency score (0-1) based on how recently accessed/modified */
  recencyScore: number;
  /** Combined weighted score */
  combinedScore: number;
  /** Whether this item is required and cannot be removed */
  isRequired: boolean;
  /** Metadata about the content */
  metadata: ContextItemMetadata;
  /** When this item was added to context */
  addedAt: Date;
  /** Embedding vector if available */
  embedding?: number[];
}

/**
 * Criteria for ranking context items
 */
export interface RankingCriteria {
  /** Weight for relevance score (0-1) */
  relevanceWeight: number;
  /** Weight for recency score (0-1) */
  recencyWeight: number;
  /** Weight for priority (0-1) */
  priorityWeight: number;
  /** Weight for file proximity (same directory, imports, etc.) */
  proximityWeight: number;
  /** Boost factor for specific file types */
  typeBoosts: Record<string, number>;
  /** Boost factor for matching keywords */
  keywordBoosts: Record<string, number>;
  /** Maximum age in milliseconds for recency calculation */
  recencyMaxAge: number;
  /** Whether to consider dependencies in ranking */
  includeDependencies: boolean;
  /** Minimum relevance threshold (0-1) */
  minRelevanceThreshold: number;
}

/**
 * Model-specific token limits and configuration
 */
export interface ModelTokenConfig {
  /** Model identifier */
  model: string;
  /** Model family for tokenizer selection */
  family: ModelFamily;
  /** Maximum context window size in tokens */
  maxContextTokens: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
  /** Reserved tokens for system prompts */
  systemPromptReserved: number;
  /** Reserved tokens for the response */
  responseReserved: number;
  /** Cost per 1K input tokens (in USD) */
  inputCostPer1K?: number;
  /** Cost per 1K output tokens (in USD) */
  outputCostPer1K?: number;
}

/**
 * Represents the full context window state
 */
export interface ContextWindow {
  /** Unique identifier for this context window */
  id: string;
  /** Model configuration for this context */
  modelConfig: ModelTokenConfig;
  /** Strategy used for context selection */
  strategy: ContextStrategy;
  /** All items in the context window */
  items: ContextItem[];
  /** Total tokens used */
  totalTokens: number;
  /** Available tokens remaining */
  availableTokens: number;
  /** Utilization percentage (0-100) */
  utilizationPercent: number;
  /** Whether the context is at capacity */
  isAtCapacity: boolean;
  /** Items that were excluded due to capacity */
  excludedItems: ContextItem[];
  /** Estimated cost for this context (if pricing available) */
  estimatedCost?: number;
  /** When this context was created */
  createdAt: Date;
  /** When this context was last updated */
  updatedAt: Date;
  /** Ranking criteria used */
  rankingCriteria: RankingCriteria;
}

/**
 * Options for context window creation
 */
export interface ContextWindowOptions {
  /** Model to use for token counting and limits */
  model: string;
  /** Strategy for context selection */
  strategy?: ContextStrategy;
  /** Custom ranking criteria */
  rankingCriteria?: Partial<RankingCriteria>;
  /** Maximum utilization percentage (default: 90) */
  maxUtilization?: number;
  /** Minimum tokens to reserve for response */
  responseReserve?: number;
  /** Required items that must be included */
  requiredItems?: ContextItem[];
  /** Keywords to boost in ranking */
  boostKeywords?: string[];
  /** File patterns to prioritize */
  priorityPatterns?: string[];
}

/**
 * Token count result with metadata
 */
export interface TokenCountResult {
  /** Number of tokens */
  count: number;
  /** Model used for counting */
  model: string;
  /** Whether count is exact or estimated */
  isExact: boolean;
  /** Time taken to count in milliseconds */
  durationMs: number;
  /** Whether result came from cache */
  fromCache: boolean;
}

/**
 * File ranking result with scores
 */
export interface FileRankingResult {
  /** File path */
  path: string;
  /** Content of the file */
  content: string;
  /** Token count */
  tokenCount: number;
  /** Relevance score (0-1) */
  relevanceScore: number;
  /** Recency score (0-1) */
  recencyScore: number;
  /** Proximity score (0-1) */
  proximityScore: number;
  /** Dependency score (0-1) */
  dependencyScore: number;
  /** Final combined score */
  finalScore: number;
  /** Metadata about the file */
  metadata: ContextItemMetadata;
  /** Reason for ranking */
  rankingReason: string;
}

/**
 * Context update event
 */
export interface ContextUpdateEvent {
  /** Type of update */
  type: 'add' | 'remove' | 'update' | 'rerank' | 'clear';
  /** Items affected */
  items: ContextItem[];
  /** Previous token count */
  previousTokens: number;
  /** New token count */
  newTokens: number;
  /** Timestamp of update */
  timestamp: Date;
}

/**
 * Context manager statistics
 */
export interface ContextManagerStats {
  /** Total items managed */
  totalItems: number;
  /** Items currently in context */
  activeItems: number;
  /** Items excluded */
  excludedItems: number;
  /** Total tokens in context */
  totalTokens: number;
  /** Cache hit rate for token counting */
  cacheHitRate: number;
  /** Average ranking time in ms */
  averageRankingTimeMs: number;
  /** Number of context updates */
  updateCount: number;
  /** Last update timestamp */
  lastUpdate: Date;
}

/**
 * Dependency information for a file
 */
export interface FileDependency {
  /** Source file path */
  source: string;
  /** Imported/required file path */
  target: string;
  /** Type of dependency */
  type: 'import' | 'require' | 'include' | 'reference';
  /** Whether it's a default export */
  isDefault?: boolean;
  /** Named exports/imports */
  names?: string[];
}

/**
 * File change event for real-time updates
 */
export interface FileChangeEvent {
  /** Type of change */
  type: 'create' | 'modify' | 'delete' | 'rename';
  /** File path */
  path: string;
  /** Previous path (for rename) */
  previousPath?: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Semantic search options for context building
 */
export interface SemanticSearchOptions {
  /** Query text for semantic matching */
  query: string;
  /** Maximum results to return */
  maxResults?: number;
  /** Minimum similarity threshold */
  minSimilarity?: number;
  /** File patterns to include */
  includePatterns?: string[];
  /** File patterns to exclude */
  excludePatterns?: string[];
  /** Whether to use cached embeddings */
  useCache?: boolean;
}

/**
 * Export default ranking criteria
 */
export const DEFAULT_RANKING_CRITERIA: RankingCriteria = {
  relevanceWeight: 0.4,
  recencyWeight: 0.3,
  priorityWeight: 0.2,
  proximityWeight: 0.1,
  typeBoosts: {
    'ts': 1.2,
    'tsx': 1.2,
    'js': 1.1,
    'jsx': 1.1,
    'py': 1.1,
    'md': 0.9,
    'json': 0.8
  },
  keywordBoosts: {},
  recencyMaxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  includeDependencies: true,
  minRelevanceThreshold: 0.1
};

/**
 * Common model configurations
 */
export const MODEL_CONFIGS: Record<string, ModelTokenConfig> = {
  'gpt-4': {
    model: 'gpt-4',
    family: ModelFamily.GPT4,
    maxContextTokens: 8192,
    maxOutputTokens: 4096,
    systemPromptReserved: 500,
    responseReserved: 2000,
    inputCostPer1K: 0.03,
    outputCostPer1K: 0.06
  },
  'gpt-4-turbo': {
    model: 'gpt-4-turbo',
    family: ModelFamily.GPT4_TURBO,
    maxContextTokens: 128000,
    maxOutputTokens: 4096,
    systemPromptReserved: 1000,
    responseReserved: 4000,
    inputCostPer1K: 0.01,
    outputCostPer1K: 0.03
  },
  'gpt-4o': {
    model: 'gpt-4o',
    family: ModelFamily.GPT4_TURBO,
    maxContextTokens: 128000,
    maxOutputTokens: 16384,
    systemPromptReserved: 1000,
    responseReserved: 8000,
    inputCostPer1K: 0.005,
    outputCostPer1K: 0.015
  },
  'gpt-3.5-turbo': {
    model: 'gpt-3.5-turbo',
    family: ModelFamily.GPT35_TURBO,
    maxContextTokens: 16384,
    maxOutputTokens: 4096,
    systemPromptReserved: 500,
    responseReserved: 2000,
    inputCostPer1K: 0.0005,
    outputCostPer1K: 0.0015
  },
  'claude-3-opus': {
    model: 'claude-3-opus',
    family: ModelFamily.CLAUDE_3,
    maxContextTokens: 200000,
    maxOutputTokens: 4096,
    systemPromptReserved: 2000,
    responseReserved: 4000,
    inputCostPer1K: 0.015,
    outputCostPer1K: 0.075
  },
  'claude-3-sonnet': {
    model: 'claude-3-sonnet',
    family: ModelFamily.CLAUDE_3,
    maxContextTokens: 200000,
    maxOutputTokens: 4096,
    systemPromptReserved: 2000,
    responseReserved: 4000,
    inputCostPer1K: 0.003,
    outputCostPer1K: 0.015
  },
  'claude-3-haiku': {
    model: 'claude-3-haiku',
    family: ModelFamily.CLAUDE_3,
    maxContextTokens: 200000,
    maxOutputTokens: 4096,
    systemPromptReserved: 1000,
    responseReserved: 4000,
    inputCostPer1K: 0.00025,
    outputCostPer1K: 0.00125
  },
  'llama-3-70b': {
    model: 'llama-3-70b',
    family: ModelFamily.LLAMA_3,
    maxContextTokens: 8192,
    maxOutputTokens: 2048,
    systemPromptReserved: 500,
    responseReserved: 2000
  },
  'mistral-large': {
    model: 'mistral-large',
    family: ModelFamily.MISTRAL,
    maxContextTokens: 32000,
    maxOutputTokens: 4096,
    systemPromptReserved: 1000,
    responseReserved: 4000,
    inputCostPer1K: 0.008,
    outputCostPer1K: 0.024
  },
  'gemini-pro': {
    model: 'gemini-pro',
    family: ModelFamily.GEMINI,
    maxContextTokens: 32000,
    maxOutputTokens: 8192,
    systemPromptReserved: 1000,
    responseReserved: 4000,
    inputCostPer1K: 0.00025,
    outputCostPer1K: 0.0005
  }
};
