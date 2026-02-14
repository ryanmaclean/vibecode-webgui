/**
 * Model Comparison Types for VibeCode AI Model Selection
 *
 * Comprehensive type definitions for comparing and selecting AI models
 * across 340+ available models from multiple providers.
 */

import type { ModelFamily } from './context';

// ============================================================================
// Core Capability Types
// ============================================================================

/**
 * Model capabilities that can be compared
 */
export interface ModelCapabilities {
  /** Code generation and understanding */
  coding: number;
  /** Logical reasoning and analysis */
  reasoning: number;
  /** Creative writing and generation */
  creative: number;
  /** Mathematical and numerical operations */
  math: number;
  /** Image understanding and processing */
  vision: number;
  /** Tool and function calling support */
  function_calling: boolean;
  /** Streaming response support */
  streaming: boolean;
  /** Multi-turn conversation support */
  conversation: number;
  /** Instruction following */
  instruction_following: number;
  /** Code analysis and debugging */
  debugging: number;
}

/**
 * Capability categories for filtering
 */
export type CapabilityCategory =
  | 'coding'
  | 'reasoning'
  | 'creative'
  | 'math'
  | 'vision'
  | 'function_calling'
  | 'conversation'
  | 'instruction_following'
  | 'debugging';

// ============================================================================
// Benchmark Types
// ============================================================================

/**
 * Benchmark categories
 */
export type BenchmarkCategory =
  | 'code_generation'
  | 'code_understanding'
  | 'reasoning'
  | 'math'
  | 'creative_writing'
  | 'instruction_following'
  | 'multi_turn'
  | 'safety'
  | 'speed'
  | 'general';

/**
 * Individual benchmark result
 */
export interface ModelBenchmark {
  /** Benchmark name (e.g., HumanEval, MMLU) */
  name: string;
  /** Score as percentage (0-100) */
  score: number;
  /** Category of this benchmark */
  category: BenchmarkCategory;
  /** Date when benchmark was last updated */
  lastUpdated?: string;
  /** Source of the benchmark data */
  source?: string;
  /** Additional notes about this benchmark */
  notes?: string;
}

/**
 * Aggregated benchmark scores by category
 */
export interface BenchmarkSummary {
  /** Average score across all benchmarks */
  overall: number;
  /** Score by category */
  byCategory: Partial<Record<BenchmarkCategory, number>>;
  /** Individual benchmark results */
  benchmarks: ModelBenchmark[];
  /** Number of benchmarks evaluated */
  benchmarkCount: number;
}

// ============================================================================
// Comparison Types
// ============================================================================

/**
 * Criteria for comparing models
 */
export interface ComparisonCriteria {
  /** Weight for cost comparison (0-1) */
  cost: number;
  /** Weight for speed comparison (0-1) */
  speed: number;
  /** Weight for quality comparison (0-1) */
  quality: number;
  /** Weight for context size comparison (0-1) */
  context_size: number;
  /** Minimum capabilities required */
  requiredCapabilities?: Partial<ModelCapabilities>;
  /** Specific benchmark categories to prioritize */
  priorityBenchmarks?: BenchmarkCategory[];
  /** Maximum price per 1K tokens (input) */
  maxInputCost?: number;
  /** Maximum price per 1K tokens (output) */
  maxOutputCost?: number;
  /** Minimum context window size */
  minContextSize?: number;
}

/**
 * Individual model score in a comparison
 */
export interface ModelComparisonScore {
  /** Model identifier */
  modelId: string;
  /** Overall comparison score (0-100) */
  overallScore: number;
  /** Score breakdown by criteria */
  criteriaScores: {
    cost: number;
    speed: number;
    quality: number;
    contextSize: number;
  };
  /** Capability matching score */
  capabilityMatch: number;
  /** Benchmark-based score */
  benchmarkScore: number;
  /** Pros for this model */
  pros: string[];
  /** Cons for this model */
  cons: string[];
  /** Why this model ranks at this position */
  rankingReason: string;
}

/**
 * Complete comparison result
 */
export interface ComparisonResult {
  /** Models being compared */
  models: ModelProfile[];
  /** Scores for each model */
  scores: ModelComparisonScore[];
  /** Recommended model ID */
  recommendation: string;
  /** Reason for recommendation */
  recommendationReason: string;
  /** Comparison criteria used */
  criteria: ComparisonCriteria;
  /** When this comparison was generated */
  generatedAt: string;
  /** Comparison summary */
  summary: {
    /** Best for coding */
    bestForCoding?: string;
    /** Best for reasoning */
    bestForReasoning?: string;
    /** Best value */
    bestValue?: string;
    /** Fastest */
    fastest?: string;
    /** Largest context */
    largestContext?: string;
  };
}

// ============================================================================
// Model Profile Types
// ============================================================================

/**
 * Provider tier levels
 */
export type ProviderTier = 'free' | 'low' | 'medium' | 'high' | 'enterprise';

/**
 * Speed tier levels
 */
export type SpeedTier = 'slow' | 'medium' | 'fast' | 'very_fast';

/**
 * Quality tier levels
 */
export type QualityTier = 'basic' | 'good' | 'excellent' | 'state_of_art';

/**
 * Model pricing information
 */
export interface ModelPricing {
  /** Cost per 1K input tokens (USD) */
  inputPer1K: number;
  /** Cost per 1K output tokens (USD) */
  outputPer1K: number;
  /** Whether model is free to use */
  isFree: boolean;
  /** Billing unit (usually 'token' or 'character') */
  billingUnit: 'token' | 'character';
  /** Currency (usually USD) */
  currency: string;
  /** Any usage limits for free tier */
  freeLimit?: string;
}

/**
 * Model performance metrics
 */
export interface ModelPerformance {
  /** Average latency in milliseconds */
  avgLatencyMs: number;
  /** Tokens per second throughput */
  tokensPerSecond: number;
  /** Speed tier classification */
  speedTier: SpeedTier;
  /** Time to first token (TTFT) in ms */
  timeToFirstTokenMs?: number;
  /** Reliability score (0-100) */
  reliability?: number;
}

/**
 * Model context and token limits
 */
export interface ModelLimits {
  /** Maximum context window in tokens */
  contextWindow: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
  /** Maximum input tokens */
  maxInputTokens: number;
  /** Reserved tokens for system prompt */
  systemPromptReserved?: number;
  /** Effective context (after reservations) */
  effectiveContext?: number;
}

/**
 * Model provider information
 */
export interface ModelProvider {
  /** Provider ID (e.g., 'openrouter', 'anthropic') */
  id: string;
  /** Provider display name */
  name: string;
  /** Provider tier */
  tier: ProviderTier;
  /** Provider logo URL */
  logoUrl?: string;
  /** API endpoint */
  endpoint?: string;
  /** Whether provider is currently available */
  available: boolean;
}

/**
 * Complete model profile with all information
 */
export interface ModelProfile {
  /** Unique model identifier (e.g., 'anthropic/claude-3.5-sonnet') */
  id: string;
  /** Display name */
  name: string;
  /** Model description */
  description: string;
  /** Model family */
  family: ModelFamily | string;
  /** Provider information */
  provider: ModelProvider;
  /** Model capabilities */
  capabilities: ModelCapabilities;
  /** Pricing information */
  pricing: ModelPricing;
  /** Performance metrics */
  performance: ModelPerformance;
  /** Token and context limits */
  limits: ModelLimits;
  /** Benchmark summary */
  benchmarks: BenchmarkSummary;
  /** Quality tier classification */
  qualityTier: QualityTier;
  /** Use case tags */
  tags: string[];
  /** When this model was released */
  releaseDate?: string;
  /** Whether model is deprecated */
  deprecated: boolean;
  /** Replacement model if deprecated */
  replacementModelId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Filter and Search Types
// ============================================================================

/**
 * Filter options for model search
 */
export interface ModelFilterOptions {
  /** Filter by provider IDs */
  providers?: string[];
  /** Filter by capability categories */
  capabilities?: CapabilityCategory[];
  /** Minimum quality tier */
  minQualityTier?: QualityTier;
  /** Maximum price per 1K input tokens */
  maxInputCost?: number;
  /** Maximum price per 1K output tokens */
  maxOutputCost?: number;
  /** Minimum context window size */
  minContextSize?: number;
  /** Speed tier requirements */
  minSpeedTier?: SpeedTier;
  /** Include deprecated models */
  includeDeprecated?: boolean;
  /** Only show models with vision */
  requiresVision?: boolean;
  /** Only show models with function calling */
  requiresFunctionCalling?: boolean;
  /** Only show models supporting streaming */
  requiresStreaming?: boolean;
  /** Filter by tags */
  tags?: string[];
}

/**
 * Search options for model lookup
 */
export interface ModelSearchOptions extends ModelFilterOptions {
  /** Search query (matches name, description, tags) */
  query?: string;
  /** Sort by field */
  sortBy?: 'name' | 'price' | 'contextSize' | 'quality' | 'speed' | 'relevance';
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Page number for pagination */
  page?: number;
  /** Items per page */
  pageSize?: number;
}

/**
 * Search result with pagination
 */
export interface ModelSearchResult {
  /** Matching models */
  models: ModelProfile[];
  /** Total count before pagination */
  totalCount: number;
  /** Current page */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Total pages */
  totalPages: number;
  /** Applied filters */
  filters: ModelFilterOptions;
  /** Search query if any */
  query?: string;
}

// ============================================================================
// Recommendation Types
// ============================================================================

/**
 * Task types for model recommendation
 */
export type TaskType =
  | 'code_generation'
  | 'code_review'
  | 'debugging'
  | 'chat'
  | 'analysis'
  | 'creative_writing'
  | 'summarization'
  | 'translation'
  | 'math'
  | 'research'
  | 'general';

/**
 * Recommendation request
 */
export interface RecommendationRequest {
  /** Type of task to perform */
  taskType: TaskType;
  /** Estimated input length in tokens */
  estimatedInputTokens?: number;
  /** Estimated output length in tokens */
  estimatedOutputTokens?: number;
  /** Budget constraints */
  budget?: {
    maxCostPerRequest?: number;
    maxMonthlyCost?: number;
  };
  /** Speed requirements */
  speedRequirement?: 'any' | 'fast' | 'very_fast';
  /** Quality requirements */
  qualityRequirement?: 'any' | 'good' | 'excellent' | 'state_of_art';
  /** Whether vision is needed */
  needsVision?: boolean;
  /** Whether function calling is needed */
  needsFunctionCalling?: boolean;
  /** Preferred providers */
  preferredProviders?: string[];
  /** Models to exclude */
  excludeModels?: string[];
}

/**
 * Model recommendation with explanation
 */
export interface ModelRecommendation {
  /** Recommended model */
  model: ModelProfile;
  /** Confidence score (0-100) */
  confidence: number;
  /** Reason for recommendation */
  reason: string;
  /** Estimated cost for the task */
  estimatedCost?: {
    perRequest: number;
    monthly?: number;
  };
  /** Alternative models */
  alternatives: Array<{
    model: ModelProfile;
    reason: string;
    tradeoffs: string[];
  }>;
}

// ============================================================================
// UI State Types
// ============================================================================

/**
 * State for model comparison UI
 */
export interface ModelComparisonState {
  /** Models selected for comparison */
  selectedModels: string[];
  /** Maximum models to compare */
  maxModels: number;
  /** Comparison criteria weights */
  criteria: ComparisonCriteria;
  /** Comparison result if generated */
  result?: ComparisonResult;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error?: string;
}

/**
 * State for model selector UI
 */
export interface ModelSelectorState {
  /** Currently selected model */
  selectedModelId?: string;
  /** Search query */
  searchQuery: string;
  /** Applied filters */
  filters: ModelFilterOptions;
  /** Search results */
  results: ModelSearchResult;
  /** Recent models */
  recentModels: string[];
  /** Favorite models */
  favoriteModels: string[];
  /** Loading state */
  isLoading: boolean;
  /** Panel expanded state */
  isExpanded: boolean;
}

/**
 * Quick filter presets
 */
export interface QuickFilterPreset {
  /** Preset ID */
  id: string;
  /** Display label */
  label: string;
  /** Description */
  description: string;
  /** Filter options to apply */
  filters: ModelFilterOptions;
  /** Icon name */
  icon?: string;
}

/**
 * Default quick filter presets
 */
export const DEFAULT_QUICK_FILTERS: QuickFilterPreset[] = [
  {
    id: 'best-for-coding',
    label: 'Best for Coding',
    description: 'Top models for code generation and debugging',
    filters: {
      capabilities: ['coding', 'debugging'],
      minQualityTier: 'excellent',
    },
    icon: 'code',
  },
  {
    id: 'best-value',
    label: 'Best Value',
    description: 'Great quality at affordable prices',
    filters: {
      maxInputCost: 0.005,
      maxOutputCost: 0.015,
      minQualityTier: 'good',
    },
    icon: 'dollar',
  },
  {
    id: 'fastest',
    label: 'Fastest',
    description: 'Models optimized for speed',
    filters: {
      minSpeedTier: 'fast',
    },
    icon: 'zap',
  },
  {
    id: 'largest-context',
    label: 'Largest Context',
    description: 'Models with 100K+ context windows',
    filters: {
      minContextSize: 100000,
    },
    icon: 'maximize',
  },
  {
    id: 'vision-enabled',
    label: 'Vision',
    description: 'Models that can understand images',
    filters: {
      requiresVision: true,
    },
    icon: 'eye',
  },
  {
    id: 'free-tier',
    label: 'Free Models',
    description: 'No-cost AI models',
    filters: {
      maxInputCost: 0,
      maxOutputCost: 0,
    },
    icon: 'gift',
  },
];

/**
 * Default comparison criteria weights
 */
export const DEFAULT_COMPARISON_CRITERIA: ComparisonCriteria = {
  cost: 0.25,
  speed: 0.2,
  quality: 0.35,
  context_size: 0.2,
};

// ============================================================================
// Event Types
// ============================================================================

/**
 * Model selection change event
 */
export interface ModelSelectionEvent {
  /** Previous model ID */
  previousModelId?: string;
  /** New model ID */
  newModelId: string;
  /** Selection source */
  source: 'selector' | 'comparison' | 'recommendation' | 'quick_filter';
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Model comparison event
 */
export interface ModelComparisonEvent {
  /** Models being compared */
  modelIds: string[];
  /** Criteria used */
  criteria: ComparisonCriteria;
  /** Result if available */
  result?: ComparisonResult;
  /** Event timestamp */
  timestamp: string;
}
