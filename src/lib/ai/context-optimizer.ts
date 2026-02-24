/**
 * ContextOptimizer - Optimize context to fit within token limits while maximizing relevance
 *
 * Intelligently selects and prioritizes context sources to maximize relevance
 * while staying within token budget constraints. Implements multiple optimization
 * strategies including greedy selection, knapsack optimization, and priority-based
 * selection.
 */

import { ContextSource, SuggestionContext } from './suggestion-context-builder';

/**
 * Optimization strategy for context selection
 */
export enum OptimizationStrategy {
  /** Greedy selection by relevance score */
  GREEDY = 'greedy',
  /** Priority-based selection (required items first, then by priority groups) */
  PRIORITY = 'priority',
  /** Knapsack-style optimization for value-to-size ratio */
  KNAPSACK = 'knapsack',
  /** Balanced approach combining multiple factors */
  BALANCED = 'balanced',
  /** Diversity-focused selection to cover different types */
  DIVERSE = 'diverse'
}

/**
 * Priority group for context sources
 */
export enum SourcePriority {
  /** Critical sources that must be included */
  REQUIRED = 1,
  /** High priority sources */
  HIGH = 2,
  /** Medium priority sources */
  MEDIUM = 3,
  /** Low priority sources */
  LOW = 4,
  /** Optional sources to fill remaining space */
  OPTIONAL = 5
}

/**
 * Options for context optimization
 */
export interface ContextOptimizationOptions {
  /** Maximum token budget (default: 4000) */
  tokenBudget?: number;
  /** Optimization strategy to use (default: BALANCED) */
  strategy?: OptimizationStrategy;
  /** Minimum relevance score to include (default: 0.1) */
  minRelevanceScore?: number;
  /** Maximum number of sources per type (default: unlimited) */
  maxSourcesPerType?: number;
  /** Whether to preserve source ordering (default: false) */
  preserveOrder?: boolean;
  /** Type priority weights for diverse strategy */
  typePriorities?: Record<string, number>;
  /** Required source IDs that must be included */
  requiredSources?: string[];
  /** Source IDs to exclude */
  excludedSources?: string[];
  /** Token overhead per source (default: 10) */
  tokenOverhead?: number;
  /** Enable detailed statistics (default: true) */
  enableStats?: boolean;
}

/**
 * Result of context optimization
 */
export interface OptimizationResult {
  /** Optimized sources that fit within budget */
  optimizedSources: ContextSource[];
  /** Sources that were excluded */
  excludedSources: ContextSource[];
  /** Total token count of optimized sources */
  totalTokens: number;
  /** Available tokens remaining in budget */
  remainingTokens: number;
  /** Utilization percentage (0-100) */
  utilizationPercent: number;
  /** Strategy used for optimization */
  strategy: OptimizationStrategy;
  /** Statistics about optimization */
  stats: {
    /** Total sources processed */
    totalSources: number;
    /** Sources included */
    includedSources: number;
    /** Sources excluded */
    excludedSources: number;
    /** Sources by type */
    sourcesByType: Record<string, number>;
    /** Average relevance of included sources */
    averageRelevance: number;
    /** Average relevance of excluded sources */
    averageExcludedRelevance: number;
    /** Token efficiency (relevance per token) */
    tokenEfficiency: number;
  };
  /** Optimization metadata */
  metadata: {
    /** Duration in milliseconds */
    durationMs: number;
    /** Number of iterations performed */
    iterations?: number;
    /** Warnings or notices */
    warnings: string[];
  };
}

/**
 * Source with priority assignment
 */
interface PrioritizedSource extends ContextSource {
  priority: SourcePriority;
  tokenCount: number;
  efficiencyScore: number;
}

/**
 * ContextOptimizer class for intelligent context optimization
 */
export class ContextOptimizer {
  private readonly defaultOptions: Required<Omit<ContextOptimizationOptions, 'typePriorities' | 'requiredSources' | 'excludedSources'>>;

  constructor(options: ContextOptimizationOptions = {}) {
    this.defaultOptions = {
      tokenBudget: options.tokenBudget ?? 4000,
      strategy: options.strategy ?? OptimizationStrategy.BALANCED,
      minRelevanceScore: options.minRelevanceScore ?? 0.1,
      maxSourcesPerType: options.maxSourcesPerType ?? Number.MAX_SAFE_INTEGER,
      preserveOrder: options.preserveOrder ?? false,
      tokenOverhead: options.tokenOverhead ?? 10,
      enableStats: options.enableStats ?? true
    };
  }

  /**
   * Optimize context sources to fit within token budget
   */
  optimize(
    sources: ContextSource[],
    options: ContextOptimizationOptions = {}
  ): OptimizationResult {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };
    const warnings: string[] = [];

    // Filter by minimum relevance
    let filteredSources = sources.filter(s =>
      s.metadata.relevance >= opts.minRelevanceScore
    );

    // Apply exclusions
    if (options.excludedSources && options.excludedSources.length > 0) {
      const excludeSet = new Set(options.excludedSources);
      filteredSources = filteredSources.filter(s => !excludeSet.has(s.id));
    }

    // Prioritize sources
    const prioritizedSources = this.prioritizeSources(
      filteredSources,
      options.requiredSources,
      options.typePriorities
    );

    // Select optimization strategy
    let result: OptimizationResult;
    switch (opts.strategy) {
      case OptimizationStrategy.GREEDY:
        result = this.greedyOptimization(prioritizedSources, opts);
        break;
      case OptimizationStrategy.PRIORITY:
        result = this.priorityOptimization(prioritizedSources, opts);
        break;
      case OptimizationStrategy.KNAPSACK:
        result = this.knapsackOptimization(prioritizedSources, opts);
        break;
      case OptimizationStrategy.DIVERSE:
        result = this.diverseOptimization(prioritizedSources, opts, options.typePriorities);
        break;
      case OptimizationStrategy.BALANCED:
      default:
        result = this.balancedOptimization(prioritizedSources, opts);
        break;
    }

    // Apply max sources per type constraint
    if (opts.maxSourcesPerType < Number.MAX_SAFE_INTEGER) {
      result = this.enforceTypeLimit(result, opts.maxSourcesPerType);
    }

    // Preserve ordering if requested
    if (opts.preserveOrder) {
      result.optimizedSources = this.preserveSourceOrder(
        sources,
        result.optimizedSources
      );
    }

    // Add timing metadata
    result.metadata.durationMs = Date.now() - startTime;
    result.metadata.warnings.push(...warnings);

    // Add warning if utilization is low
    if (result.utilizationPercent < 50) {
      result.metadata.warnings.push(
        `Low token utilization: ${result.utilizationPercent.toFixed(1)}%. Consider increasing source relevance or adding more sources.`
      );
    }

    return result;
  }

  /**
   * Optimize suggestion context
   */
  optimizeContext(
    context: SuggestionContext,
    options: ContextOptimizationOptions = {}
  ): SuggestionContext {
    const result = this.optimize(context.sources, options);

    return {
      ...context,
      sources: result.optimizedSources,
      totalTokens: result.totalTokens,
      relevanceScore: result.stats.averageRelevance,
      stats: {
        ...context.stats,
        totalSources: result.stats.includedSources
      }
    };
  }

  /**
   * Assign priorities to sources
   */
  private prioritizeSources(
    sources: ContextSource[],
    requiredSources?: string[],
    typePriorities?: Record<string, number>
  ): PrioritizedSource[] {
    const requiredSet = new Set(requiredSources || []);

    return sources.map(source => {
      const tokenCount = this.estimateTokens(source);
      const efficiencyScore = tokenCount > 0 ? source.metadata.relevance / tokenCount : 0;

      let priority: SourcePriority;

      // Check if source is required
      if (requiredSet.has(source.id)) {
        priority = SourcePriority.REQUIRED;
      }
      // Check type priorities if provided
      else if (typePriorities && source.metadata.type in typePriorities) {
        const typePriority = typePriorities[source.metadata.type];
        if (typePriority >= 0.8) priority = SourcePriority.HIGH;
        else if (typePriority >= 0.6) priority = SourcePriority.MEDIUM;
        else if (typePriority >= 0.4) priority = SourcePriority.LOW;
        else priority = SourcePriority.OPTIONAL;
      }
      // Use relevance score to determine priority
      else {
        const relevance = source.metadata.relevance;
        if (relevance >= 0.8) priority = SourcePriority.HIGH;
        else if (relevance >= 0.6) priority = SourcePriority.MEDIUM;
        else if (relevance >= 0.4) priority = SourcePriority.LOW;
        else priority = SourcePriority.OPTIONAL;
      }

      return {
        ...source,
        priority,
        tokenCount,
        efficiencyScore
      };
    });
  }

  /**
   * Greedy optimization - select by relevance score descending
   */
  private greedyOptimization(
    sources: PrioritizedSource[],
    options: Required<Omit<ContextOptimizationOptions, 'typePriorities' | 'requiredSources' | 'excludedSources'>>
  ): OptimizationResult {
    const sorted = [...sources].sort((a, b) => b.metadata.relevance - a.metadata.relevance);
    return this.selectSources(sorted, options);
  }

  /**
   * Priority-based optimization - select by priority groups
   */
  private priorityOptimization(
    sources: PrioritizedSource[],
    options: Required<Omit<ContextOptimizationOptions, 'typePriorities' | 'requiredSources' | 'excludedSources'>>
  ): OptimizationResult {
    const sorted = [...sources].sort((a, b) => {
      // First by priority
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Then by relevance
      return b.metadata.relevance - a.metadata.relevance;
    });
    return this.selectSources(sorted, options);
  }

  /**
   * Knapsack optimization - maximize value per token
   */
  private knapsackOptimization(
    sources: PrioritizedSource[],
    options: Required<Omit<ContextOptimizationOptions, 'typePriorities' | 'requiredSources' | 'excludedSources'>>
  ): OptimizationResult {
    const sorted = [...sources].sort((a, b) => b.efficiencyScore - a.efficiencyScore);
    return this.selectSources(sorted, options);
  }

  /**
   * Balanced optimization - combine priority, relevance, and efficiency
   */
  private balancedOptimization(
    sources: PrioritizedSource[],
    options: Required<Omit<ContextOptimizationOptions, 'typePriorities' | 'requiredSources' | 'excludedSources'>>
  ): OptimizationResult {
    const sorted = [...sources].sort((a, b) => {
      // Calculate combined score
      const scoreA = this.calculateBalancedScore(a);
      const scoreB = this.calculateBalancedScore(b);
      return scoreB - scoreA;
    });
    return this.selectSources(sorted, options);
  }

  /**
   * Diverse optimization - ensure variety of source types
   */
  private diverseOptimization(
    sources: PrioritizedSource[],
    options: Required<Omit<ContextOptimizationOptions, 'typePriorities' | 'requiredSources' | 'excludedSources'>>,
    typePriorities?: Record<string, number>
  ): OptimizationResult {
    const selected: PrioritizedSource[] = [];
    const excluded: PrioritizedSource[] = [];
    let currentTokens = 0;

    // Group sources by type
    const sourcesByType = new Map<string, PrioritizedSource[]>();
    for (const source of sources) {
      const type = source.metadata.type;
      if (!sourcesByType.has(type)) {
        sourcesByType.set(type, []);
      }
      sourcesByType.get(type)!.push(source);
    }

    // Sort each type group by relevance
    for (const [type, typeSources] of sourcesByType.entries()) {
      typeSources.sort((a, b) => b.metadata.relevance - a.metadata.relevance);
    }

    // Round-robin selection from each type
    let hasMore = true;
    let round = 0;
    const maxRounds = 100; // Prevent infinite loop

    while (hasMore && round < maxRounds) {
      hasMore = false;

      for (const [type, typeSources] of sourcesByType.entries()) {
        if (round < typeSources.length) {
          const source = typeSources[round];
          const sourceTokens = source.tokenCount + options.tokenOverhead;

          if (currentTokens + sourceTokens <= options.tokenBudget) {
            selected.push(source);
            currentTokens += sourceTokens;
            hasMore = true;
          } else {
            excluded.push(source);
          }
        }
      }

      round++;
    }

    // Add any remaining sources to excluded
    for (const typeSources of sourcesByType.values()) {
      for (let i = round; i < typeSources.length; i++) {
        excluded.push(typeSources[i]);
      }
    }

    return this.buildResult(selected, excluded, currentTokens, options, round);
  }

  /**
   * Calculate balanced score combining multiple factors
   */
  private calculateBalancedScore(source: PrioritizedSource): number {
    // Weights for different factors
    const priorityWeight = 0.3;
    const relevanceWeight = 0.4;
    const efficiencyWeight = 0.3;

    // Normalize priority (1-5 -> 1-0)
    const priorityScore = (6 - source.priority) / 5;

    // Combine scores
    return (
      priorityScore * priorityWeight +
      source.metadata.relevance * relevanceWeight +
      source.efficiencyScore * efficiencyWeight
    );
  }

  /**
   * Select sources until token budget is reached
   */
  private selectSources(
    sortedSources: PrioritizedSource[],
    options: Required<Omit<ContextOptimizationOptions, 'typePriorities' | 'requiredSources' | 'excludedSources'>>
  ): OptimizationResult {
    const selected: PrioritizedSource[] = [];
    const excluded: PrioritizedSource[] = [];
    let currentTokens = 0;

    for (const source of sortedSources) {
      const sourceTokens = source.tokenCount + options.tokenOverhead;

      if (currentTokens + sourceTokens <= options.tokenBudget) {
        selected.push(source);
        currentTokens += sourceTokens;
      } else {
        excluded.push(source);
      }
    }

    return this.buildResult(selected, excluded, currentTokens, options);
  }

  /**
   * Build optimization result
   */
  private buildResult(
    selected: PrioritizedSource[],
    excluded: PrioritizedSource[],
    totalTokens: number,
    options: Required<Omit<ContextOptimizationOptions, 'typePriorities' | 'requiredSources' | 'excludedSources'>>,
    iterations?: number
  ): OptimizationResult {
    const utilizationPercent = (totalTokens / options.tokenBudget) * 100;

    // Calculate statistics
    const sourcesByType: Record<string, number> = {};
    for (const source of selected) {
      const type = source.metadata.type;
      sourcesByType[type] = (sourcesByType[type] || 0) + 1;
    }

    const averageRelevance = selected.length > 0
      ? selected.reduce((sum, s) => sum + s.metadata.relevance, 0) / selected.length
      : 0;

    const averageExcludedRelevance = excluded.length > 0
      ? excluded.reduce((sum, s) => sum + s.metadata.relevance, 0) / excluded.length
      : 0;

    const tokenEfficiency = totalTokens > 0
      ? averageRelevance / totalTokens * 1000 // Relevance per 1K tokens
      : 0;

    return {
      optimizedSources: selected,
      excludedSources: excluded,
      totalTokens,
      remainingTokens: options.tokenBudget - totalTokens,
      utilizationPercent,
      strategy: options.strategy,
      stats: {
        totalSources: selected.length + excluded.length,
        includedSources: selected.length,
        excludedSources: excluded.length,
        sourcesByType,
        averageRelevance,
        averageExcludedRelevance,
        tokenEfficiency
      },
      metadata: {
        durationMs: 0, // Will be set by caller
        iterations,
        warnings: []
      }
    };
  }

  /**
   * Enforce maximum sources per type constraint
   */
  private enforceTypeLimit(
    result: OptimizationResult,
    maxPerType: number
  ): OptimizationResult {
    const typeCount: Record<string, number> = {};
    const filtered: ContextSource[] = [];
    const additionalExcluded: ContextSource[] = [];

    for (const source of result.optimizedSources) {
      const type = source.metadata.type;
      typeCount[type] = (typeCount[type] || 0) + 1;

      if (typeCount[type] <= maxPerType) {
        filtered.push(source);
      } else {
        additionalExcluded.push(source);
      }
    }

    // Recalculate tokens
    const totalTokens = filtered.reduce(
      (sum, s) => sum + this.estimateTokens(s) + this.defaultOptions.tokenOverhead,
      0
    );

    return {
      ...result,
      optimizedSources: filtered,
      excludedSources: [...result.excludedSources, ...additionalExcluded],
      totalTokens,
      remainingTokens: this.defaultOptions.tokenBudget - totalTokens,
      utilizationPercent: (totalTokens / this.defaultOptions.tokenBudget) * 100,
      stats: {
        ...result.stats,
        includedSources: filtered.length,
        excludedSources: result.excludedSources.length + additionalExcluded.length
      }
    };
  }

  /**
   * Preserve original source ordering
   */
  private preserveSourceOrder(
    originalSources: ContextSource[],
    optimizedSources: ContextSource[]
  ): ContextSource[] {
    const optimizedIds = new Set(optimizedSources.map(s => s.id));
    return originalSources.filter(s => optimizedIds.has(s.id));
  }

  /**
   * Estimate token count for a source
   */
  private estimateTokens(source: ContextSource): number {
    // Rough estimation: ~4 characters per token
    // Add overhead for metadata and formatting
    const contentTokens = Math.ceil(source.content.length / 4);
    const metadataTokens = 5; // Title, type, etc.
    return contentTokens + metadataTokens;
  }

  /**
   * Get recommendations for improving context optimization
   */
  getRecommendations(result: OptimizationResult): string[] {
    const recommendations: string[] = [];

    // Low utilization
    if (result.utilizationPercent < 50) {
      recommendations.push(
        'Token utilization is low. Consider lowering minRelevanceScore or adding more sources.'
      );
    }

    // High exclusion rate
    const exclusionRate = result.stats.excludedSources / result.stats.totalSources;
    if (exclusionRate > 0.5) {
      recommendations.push(
        `${(exclusionRate * 100).toFixed(0)}% of sources were excluded. Consider increasing tokenBudget or raising minRelevanceScore.`
      );
    }

    // Low average relevance
    if (result.stats.averageRelevance < 0.5) {
      recommendations.push(
        'Average relevance is low. Review source relevance scoring or filtering criteria.'
      );
    }

    // Type imbalance
    const typeCount = Object.keys(result.stats.sourcesByType).length;
    if (typeCount < 3 && result.stats.totalSources > 10) {
      recommendations.push(
        'Limited source type diversity. Consider using DIVERSE optimization strategy.'
      );
    }

    // High excluded relevance
    if (result.stats.averageExcludedRelevance > result.stats.averageRelevance * 0.8) {
      recommendations.push(
        'Many high-relevance sources were excluded. Consider increasing tokenBudget.'
      );
    }

    return recommendations;
  }
}

/**
 * Factory function to create a ContextOptimizer instance
 */
export function createContextOptimizer(options?: ContextOptimizationOptions): ContextOptimizer {
  return new ContextOptimizer(options);
}
