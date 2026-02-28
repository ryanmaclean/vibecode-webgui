/**
 * Suggestion Configuration - Centralized configuration for context-aware AI suggestions
 *
 * This module provides default configurations and feature flags for the AI suggestion
 * enhancement system, including token budgets, relevance thresholds, and optimization
 * settings.
 */

import { OptimizationStrategy } from '../context-optimizer';
import { ModelFamily } from '../../../types/context';

/**
 * Feature flags for suggestion enhancement
 */
export interface SuggestionFeatureFlags {
  /** Enable code analysis (imports, types, functions) */
  enableCodeAnalysis: boolean;
  /** Enable related code discovery */
  enableRelatedCode: boolean;
  /** Enable project conventions detection */
  enableConventions: boolean;
  /** Enable context optimization */
  enableOptimization: boolean;
  /** Enable caching of analysis results */
  enableCaching: boolean;
  /** Enable detailed statistics and metrics */
  enableStats: boolean;
}

/**
 * Token budget configuration
 */
export interface TokenBudgetConfig {
  /** Default token budget for context */
  defaultBudget: number;
  /** Maximum token budget allowed */
  maxBudget: number;
  /** Minimum token budget allowed */
  minBudget: number;
  /** Reserved tokens for system prompts */
  systemReserved: number;
  /** Reserved tokens for response */
  responseReserved: number;
  /** Token overhead per source */
  tokenOverhead: number;
  /** Model-specific budgets */
  modelBudgets: Record<string, number>;
}

/**
 * Relevance threshold configuration
 */
export interface RelevanceThresholdConfig {
  /** Minimum relevance score for including sources (0-1) */
  minRelevanceScore: number;
  /** Relevance threshold for related code (0-1) */
  relatedCodeThreshold: number;
  /** Relevance threshold for conventions (0-1) */
  conventionsThreshold: number;
  /** High relevance threshold (0-1) */
  highRelevanceThreshold: number;
  /** Critical relevance threshold (0-1) */
  criticalRelevanceThreshold: number;
}

/**
 * Context building limits
 */
export interface ContextLimitsConfig {
  /** Maximum number of imports to include */
  maxImports: number;
  /** Maximum number of types to include */
  maxTypes: number;
  /** Maximum number of functions to include */
  maxFunctions: number;
  /** Maximum number of related code elements */
  maxRelatedElements: number;
  /** Maximum number of convention examples */
  maxConventionExamples: number;
  /** Maximum number of sources per type */
  maxSourcesPerType: number;
  /** Maximum depth for related code discovery */
  maxRelatedDepth: number;
}

/**
 * Optimization configuration
 */
export interface OptimizationConfig {
  /** Default optimization strategy */
  defaultStrategy: OptimizationStrategy;
  /** Strategy preferences by scenario */
  strategyPreferences: {
    /** Strategy for code completion */
    codeCompletion: OptimizationStrategy;
    /** Strategy for code review */
    codeReview: OptimizationStrategy;
    /** Strategy for refactoring */
    refactoring: OptimizationStrategy;
    /** Strategy for debugging */
    debugging: OptimizationStrategy;
    /** Strategy for general queries */
    general: OptimizationStrategy;
  };
  /** Whether to preserve source ordering */
  preserveOrder: boolean;
  /** Type priority weights for diverse strategy */
  typePriorities: Record<string, number>;
}

/**
 * Caching configuration
 */
export interface CachingConfig {
  /** Enable caching */
  enabled: boolean;
  /** Cache TTL in milliseconds */
  ttl: number;
  /** Maximum cache size (number of entries) */
  maxSize: number;
  /** Whether to cache context building results */
  cacheContextBuilding: boolean;
  /** Whether to cache optimization results */
  cacheOptimization: boolean;
  /** Whether to cache code analysis results */
  cacheCodeAnalysis: boolean;
}

/**
 * Performance configuration
 */
export interface PerformanceConfig {
  /** Maximum time for code analysis in milliseconds */
  maxAnalysisTime: number;
  /** Maximum time for context building in milliseconds */
  maxContextBuildTime: number;
  /** Maximum time for optimization in milliseconds */
  maxOptimizationTime: number;
  /** Enable parallel processing where possible */
  enableParallel: boolean;
  /** Number of worker threads for parallel processing */
  workerThreads: number;
}

/**
 * Complete suggestion configuration
 */
export interface SuggestionConfig {
  /** Feature flags */
  features: SuggestionFeatureFlags;
  /** Token budget settings */
  tokenBudget: TokenBudgetConfig;
  /** Relevance thresholds */
  relevance: RelevanceThresholdConfig;
  /** Context limits */
  limits: ContextLimitsConfig;
  /** Optimization settings */
  optimization: OptimizationConfig;
  /** Caching settings */
  caching: CachingConfig;
  /** Performance settings */
  performance: PerformanceConfig;
}

/**
 * Default feature flags
 */
export const DEFAULT_FEATURE_FLAGS: SuggestionFeatureFlags = {
  enableCodeAnalysis: true,
  enableRelatedCode: true,
  enableConventions: true,
  enableOptimization: true,
  enableCaching: true,
  enableStats: true,
};

/**
 * Default token budget configuration
 */
export const DEFAULT_TOKEN_BUDGET: TokenBudgetConfig = {
  defaultBudget: 4000,
  maxBudget: 16000,
  minBudget: 500,
  systemReserved: 500,
  responseReserved: 1000,
  tokenOverhead: 10,
  modelBudgets: {
    [ModelFamily.GPT4]: 8000,
    [ModelFamily.GPT4_TURBO]: 16000,
    [ModelFamily.GPT35_TURBO]: 4000,
    [ModelFamily.CLAUDE]: 8000,
    [ModelFamily.CLAUDE_3]: 16000,
    [ModelFamily.LLAMA]: 4000,
    [ModelFamily.LLAMA_3]: 8000,
    [ModelFamily.MISTRAL]: 4000,
    [ModelFamily.GEMINI]: 8000,
  },
};

/**
 * Default relevance thresholds
 */
export const DEFAULT_RELEVANCE_THRESHOLDS: RelevanceThresholdConfig = {
  minRelevanceScore: 0.1,
  relatedCodeThreshold: 0.2,
  conventionsThreshold: 0.15,
  highRelevanceThreshold: 0.7,
  criticalRelevanceThreshold: 0.9,
};

/**
 * Default context limits
 */
export const DEFAULT_CONTEXT_LIMITS: ContextLimitsConfig = {
  maxImports: 20,
  maxTypes: 15,
  maxFunctions: 20,
  maxRelatedElements: 10,
  maxConventionExamples: 5,
  maxSourcesPerType: 50,
  maxRelatedDepth: 2,
};

/**
 * Default optimization configuration
 */
export const DEFAULT_OPTIMIZATION_CONFIG: OptimizationConfig = {
  defaultStrategy: OptimizationStrategy.BALANCED,
  strategyPreferences: {
    codeCompletion: OptimizationStrategy.GREEDY,
    codeReview: OptimizationStrategy.DIVERSE,
    refactoring: OptimizationStrategy.PRIORITY,
    debugging: OptimizationStrategy.PRIORITY,
    general: OptimizationStrategy.BALANCED,
  },
  preserveOrder: false,
  typePriorities: {
    import: 1.0,
    type: 0.9,
    function: 0.85,
    related_code: 0.7,
    convention: 0.6,
    project_pattern: 0.5,
  },
};

/**
 * Default caching configuration
 */
export const DEFAULT_CACHING_CONFIG: CachingConfig = {
  enabled: true,
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 100,
  cacheContextBuilding: true,
  cacheOptimization: true,
  cacheCodeAnalysis: true,
};

/**
 * Default performance configuration
 */
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  maxAnalysisTime: 5000, // 5 seconds
  maxContextBuildTime: 3000, // 3 seconds
  maxOptimizationTime: 1000, // 1 second
  enableParallel: false, // Disabled by default for simplicity
  workerThreads: 2,
};

/**
 * Default complete suggestion configuration
 */
export const DEFAULT_SUGGESTION_CONFIG: SuggestionConfig = {
  features: DEFAULT_FEATURE_FLAGS,
  tokenBudget: DEFAULT_TOKEN_BUDGET,
  relevance: DEFAULT_RELEVANCE_THRESHOLDS,
  limits: DEFAULT_CONTEXT_LIMITS,
  optimization: DEFAULT_OPTIMIZATION_CONFIG,
  caching: DEFAULT_CACHING_CONFIG,
  performance: DEFAULT_PERFORMANCE_CONFIG,
};

/**
 * Configuration presets for different use cases
 */
export const SUGGESTION_CONFIG_PRESETS = {
  /**
   * Minimal configuration for fast responses
   */
  minimal: {
    ...DEFAULT_SUGGESTION_CONFIG,
    features: {
      ...DEFAULT_FEATURE_FLAGS,
      enableRelatedCode: false,
      enableConventions: false,
    },
    tokenBudget: {
      ...DEFAULT_TOKEN_BUDGET,
      defaultBudget: 1000,
    },
    limits: {
      ...DEFAULT_CONTEXT_LIMITS,
      maxImports: 5,
      maxTypes: 5,
      maxFunctions: 5,
      maxRelatedElements: 0,
      maxConventionExamples: 0,
    },
  } as SuggestionConfig,

  /**
   * Balanced configuration for general use
   */
  balanced: DEFAULT_SUGGESTION_CONFIG,

  /**
   * Comprehensive configuration for detailed analysis
   */
  comprehensive: {
    ...DEFAULT_SUGGESTION_CONFIG,
    tokenBudget: {
      ...DEFAULT_TOKEN_BUDGET,
      defaultBudget: 8000,
    },
    limits: {
      ...DEFAULT_CONTEXT_LIMITS,
      maxImports: 50,
      maxTypes: 30,
      maxFunctions: 40,
      maxRelatedElements: 20,
      maxConventionExamples: 10,
      maxRelatedDepth: 3,
    },
    optimization: {
      ...DEFAULT_OPTIMIZATION_CONFIG,
      defaultStrategy: OptimizationStrategy.DIVERSE,
    },
  } as SuggestionConfig,

  /**
   * Performance-optimized configuration
   */
  performance: {
    ...DEFAULT_SUGGESTION_CONFIG,
    features: {
      ...DEFAULT_FEATURE_FLAGS,
      enableConventions: false,
    },
    tokenBudget: {
      ...DEFAULT_TOKEN_BUDGET,
      defaultBudget: 2000,
    },
    limits: {
      ...DEFAULT_CONTEXT_LIMITS,
      maxImports: 10,
      maxTypes: 10,
      maxFunctions: 10,
      maxRelatedElements: 5,
      maxConventionExamples: 0,
    },
    performance: {
      ...DEFAULT_PERFORMANCE_CONFIG,
      maxAnalysisTime: 2000,
      maxContextBuildTime: 1000,
      maxOptimizationTime: 500,
    },
  } as SuggestionConfig,
};

/**
 * Get configuration for specific model
 */
export function getModelConfig(model: string): Partial<SuggestionConfig> {
  const modelFamily = detectModelFamily(model);
  const tokenBudget = DEFAULT_TOKEN_BUDGET.modelBudgets[modelFamily] || DEFAULT_TOKEN_BUDGET.defaultBudget;

  return {
    tokenBudget: {
      ...DEFAULT_TOKEN_BUDGET,
      defaultBudget: tokenBudget,
    },
  };
}

/**
 * Detect model family from model identifier
 */
function detectModelFamily(model: string): ModelFamily {
  const modelLower = model.toLowerCase();

  if (modelLower.includes('gpt-4-turbo')) return ModelFamily.GPT4_TURBO;
  if (modelLower.includes('gpt-4')) return ModelFamily.GPT4;
  if (modelLower.includes('gpt-3.5')) return ModelFamily.GPT35_TURBO;
  if (modelLower.includes('claude-3')) return ModelFamily.CLAUDE_3;
  if (modelLower.includes('claude')) return ModelFamily.CLAUDE;
  if (modelLower.includes('llama-3')) return ModelFamily.LLAMA_3;
  if (modelLower.includes('llama')) return ModelFamily.LLAMA;
  if (modelLower.includes('mistral')) return ModelFamily.MISTRAL;
  if (modelLower.includes('gemini')) return ModelFamily.GEMINI;

  return ModelFamily.UNKNOWN;
}

/**
 * Merge partial configuration with defaults
 */
export function mergeConfig(
  partial: Partial<SuggestionConfig>,
  base: SuggestionConfig = DEFAULT_SUGGESTION_CONFIG
): SuggestionConfig {
  return {
    features: { ...base.features, ...partial.features },
    tokenBudget: { ...base.tokenBudget, ...partial.tokenBudget },
    relevance: { ...base.relevance, ...partial.relevance },
    limits: { ...base.limits, ...partial.limits },
    optimization: {
      ...base.optimization,
      ...partial.optimization,
      strategyPreferences: {
        ...base.optimization.strategyPreferences,
        ...(partial.optimization?.strategyPreferences || {}),
      },
      typePriorities: {
        ...base.optimization.typePriorities,
        ...(partial.optimization?.typePriorities || {}),
      },
    },
    caching: { ...base.caching, ...partial.caching },
    performance: { ...base.performance, ...partial.performance },
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: SuggestionConfig): string[] {
  const errors: string[] = [];

  // Validate token budgets
  if (config.tokenBudget.defaultBudget < config.tokenBudget.minBudget) {
    errors.push('Default token budget cannot be less than minimum budget');
  }
  if (config.tokenBudget.defaultBudget > config.tokenBudget.maxBudget) {
    errors.push('Default token budget cannot exceed maximum budget');
  }
  if (config.tokenBudget.tokenOverhead < 0) {
    errors.push('Token overhead cannot be negative');
  }

  // Validate relevance thresholds
  if (config.relevance.minRelevanceScore < 0 || config.relevance.minRelevanceScore > 1) {
    errors.push('Minimum relevance score must be between 0 and 1');
  }
  if (config.relevance.relatedCodeThreshold < 0 || config.relevance.relatedCodeThreshold > 1) {
    errors.push('Related code threshold must be between 0 and 1');
  }
  if (config.relevance.conventionsThreshold < 0 || config.relevance.conventionsThreshold > 1) {
    errors.push('Conventions threshold must be between 0 and 1');
  }

  // Validate limits
  if (config.limits.maxImports < 0) {
    errors.push('Maximum imports cannot be negative');
  }
  if (config.limits.maxTypes < 0) {
    errors.push('Maximum types cannot be negative');
  }
  if (config.limits.maxFunctions < 0) {
    errors.push('Maximum functions cannot be negative');
  }
  if (config.limits.maxRelatedElements < 0) {
    errors.push('Maximum related elements cannot be negative');
  }
  if (config.limits.maxConventionExamples < 0) {
    errors.push('Maximum convention examples cannot be negative');
  }
  if (config.limits.maxRelatedDepth < 1) {
    errors.push('Maximum related depth must be at least 1');
  }

  // Validate caching
  if (config.caching.ttl < 0) {
    errors.push('Cache TTL cannot be negative');
  }
  if (config.caching.maxSize < 1) {
    errors.push('Cache max size must be at least 1');
  }

  // Validate performance
  if (config.performance.maxAnalysisTime < 0) {
    errors.push('Max analysis time cannot be negative');
  }
  if (config.performance.maxContextBuildTime < 0) {
    errors.push('Max context build time cannot be negative');
  }
  if (config.performance.maxOptimizationTime < 0) {
    errors.push('Max optimization time cannot be negative');
  }
  if (config.performance.workerThreads < 1) {
    errors.push('Worker threads must be at least 1');
  }

  return errors;
}

/**
 * Create configuration from environment variables
 */
export function createConfigFromEnv(): Partial<SuggestionConfig> {
  const config: Partial<SuggestionConfig> = {};

  // Token budget from env
  if (process.env.AI_SUGGESTION_TOKEN_BUDGET) {
    const budget = parseInt(process.env.AI_SUGGESTION_TOKEN_BUDGET, 10);
    if (!isNaN(budget)) {
      config.tokenBudget = {
        ...DEFAULT_TOKEN_BUDGET,
        defaultBudget: budget,
      };
    }
  }

  // Feature flags from env
  if (process.env.AI_SUGGESTION_ENABLE_RELATED_CODE !== undefined) {
    config.features = {
      ...DEFAULT_FEATURE_FLAGS,
      enableRelatedCode: process.env.AI_SUGGESTION_ENABLE_RELATED_CODE === 'true',
    };
  }

  if (process.env.AI_SUGGESTION_ENABLE_CONVENTIONS !== undefined) {
    config.features = {
      ...(config.features || DEFAULT_FEATURE_FLAGS),
      enableConventions: process.env.AI_SUGGESTION_ENABLE_CONVENTIONS === 'true',
    };
  }

  // Caching from env
  if (process.env.AI_SUGGESTION_CACHE_TTL) {
    const ttl = parseInt(process.env.AI_SUGGESTION_CACHE_TTL, 10);
    if (!isNaN(ttl)) {
      config.caching = {
        ...DEFAULT_CACHING_CONFIG,
        ttl,
      };
    }
  }

  return config;
}

/**
 * Configuration manager singleton
 */
class SuggestionConfigManager {
  private config: SuggestionConfig;

  constructor(initialConfig?: Partial<SuggestionConfig>) {
    const envConfig = createConfigFromEnv();
    this.config = mergeConfig(
      { ...envConfig, ...initialConfig },
      DEFAULT_SUGGESTION_CONFIG
    );
  }

  /**
   * Get current configuration
   */
  getConfig(): SuggestionConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * Update configuration
   */
  updateConfig(partial: Partial<SuggestionConfig>): void {
    this.config = mergeConfig(partial, this.config);
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    this.config = { ...DEFAULT_SUGGESTION_CONFIG };
  }

  /**
   * Load preset configuration
   */
  loadPreset(preset: keyof typeof SUGGESTION_CONFIG_PRESETS): void {
    this.config = { ...SUGGESTION_CONFIG_PRESETS[preset] };
  }
}

// Export singleton instance
let configManagerInstance: SuggestionConfigManager | null = null;

/**
 * Get global configuration manager instance
 */
export function getConfigManager(): SuggestionConfigManager {
  if (!configManagerInstance) {
    configManagerInstance = new SuggestionConfigManager();
  }
  return configManagerInstance;
}

/**
 * Create a new configuration manager instance
 */
export function createConfigManager(config?: Partial<SuggestionConfig>): SuggestionConfigManager {
  return new SuggestionConfigManager(config);
}
