/**
 * SuggestionEnhancer - High-level service for enhancing AI code suggestions with context
 *
 * Orchestrates context building and optimization to provide enriched context for AI models.
 * Combines code analysis, related code discovery, and project conventions to deliver
 * relevant, token-optimized context that improves AI suggestion quality.
 */

import {
  SuggestionContextBuilder,
  SuggestionContext,
  SuggestionContextQuery,
  ContextSource,
  createSuggestionContextBuilder
} from './suggestion-context-builder';
import {
  ContextOptimizer,
  OptimizationStrategy,
  ContextOptimizationOptions,
  OptimizationResult,
  createContextOptimizer
} from './context-optimizer';

/**
 * Enhanced suggestion with enriched context
 */
export interface EnhancedSuggestion {
  /** Original source code */
  sourceCode: string;
  /** Enriched context sources */
  contextSources: ContextSource[];
  /** Formatted context for AI prompt */
  formattedContext: string;
  /** Total token count */
  totalTokens: number;
  /** Relevance score (0-1) */
  relevanceScore: number;
  /** Statistics about the enhancement */
  stats: {
    /** Number of imports included */
    importsIncluded: number;
    /** Number of types included */
    typesIncluded: number;
    /** Number of functions included */
    functionsIncluded: number;
    /** Number of related code elements */
    relatedCodeIncluded: number;
    /** Number of conventions included */
    conventionsIncluded: number;
    /** Token utilization percentage */
    tokenUtilization: number;
    /** Optimization strategy used */
    optimizationStrategy: string;
  };
  /** Optimization details */
  optimization: {
    /** Sources that were excluded */
    excludedSources: ContextSource[];
    /** Remaining token budget */
    remainingTokens: number;
    /** Warnings or recommendations */
    warnings: string[];
  };
}

/**
 * Query for suggestion enhancement
 */
export interface SuggestionEnhancementQuery {
  /** Source code to enhance */
  sourceCode: string;
  /** Source file path (optional) */
  sourceFile?: string;
  /** Workspace identifier (optional) */
  workspaceId?: string;
  /** User intent or task description */
  intent?: string;
  /** Workspace root for file resolution */
  workspaceRoot?: string;
  /** Additional files to analyze for conventions */
  conventionFiles?: string[];
  /** Options for context building */
  contextOptions?: {
    /** Include related code (default: true) */
    includeRelatedCode?: boolean;
    /** Include project conventions (default: true) */
    includeConventions?: boolean;
    /** Maximum related code elements (default: 10) */
    maxRelatedElements?: number;
    /** Maximum convention examples (default: 5) */
    maxConventionExamples?: number;
    /** Minimum relevance score (default: 0.2) */
    minRelevanceScore?: number;
  };
  /** Options for optimization */
  optimizationOptions?: {
    /** Token budget (default: 4000) */
    tokenBudget?: number;
    /** Optimization strategy (default: BALANCED) */
    strategy?: OptimizationStrategy;
    /** Minimum relevance to include (default: 0.1) */
    minRelevanceScore?: number;
    /** Max sources per type (default: unlimited) */
    maxSourcesPerType?: number;
  };
}

/**
 * Options for formatting context
 */
export interface ContextFormattingOptions {
  /** Include source code in context (default: true) */
  includeSourceCode?: boolean;
  /** Include metadata in context (default: false) */
  includeMetadata?: boolean;
  /** Group by type (default: true) */
  groupByType?: boolean;
  /** Maximum content length per source (default: unlimited) */
  maxContentLength?: number;
  /** Custom format template */
  template?: 'detailed' | 'compact' | 'minimal';
}

/**
 * SuggestionEnhancer service for enhancing AI suggestions
 */
export class SuggestionEnhancer {
  private readonly contextBuilder: SuggestionContextBuilder;
  private readonly contextOptimizer: ContextOptimizer;
  private readonly cache: Map<string, EnhancedSuggestion>;
  private readonly cacheTTL: number;

  constructor(options?: {
    cacheTTL?: number;
    defaultOptimizationOptions?: ContextOptimizationOptions;
  }) {
    this.contextBuilder = createSuggestionContextBuilder();
    this.contextOptimizer = createContextOptimizer(options?.defaultOptimizationOptions);
    this.cache = new Map();
    this.cacheTTL = options?.cacheTTL ?? 5 * 60 * 1000; // 5 minutes default
  }

  /**
   * Enhance AI suggestion with contextual information
   */
  async enhance(query: SuggestionEnhancementQuery): Promise<EnhancedSuggestion> {
    const {
      sourceCode,
      sourceFile,
      workspaceId,
      intent,
      workspaceRoot,
      conventionFiles = [],
      contextOptions = {},
      optimizationOptions = {}
    } = query;

    try {
      // Check cache
      const cacheKey = this.buildCacheKey(query);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // 1. Build enriched context
      const context = await this.contextBuilder.buildContext({
        sourceCode,
        sourceFile,
        workspaceId,
        intent,
        options: {
          includeRelatedCode: contextOptions.includeRelatedCode ?? true,
          includeConventions: contextOptions.includeConventions ?? true,
          maxRelatedElements: contextOptions.maxRelatedElements ?? 10,
          maxConventionExamples: contextOptions.maxConventionExamples ?? 5,
          minRelevanceScore: contextOptions.minRelevanceScore ?? 0.2,
          workspaceRoot,
          conventionFiles,
          tokenBudget: optimizationOptions.tokenBudget ?? 4000
        }
      });

      // 2. Optimize context to fit within token budget
      const optimization = this.contextOptimizer.optimize(context.sources, {
        tokenBudget: optimizationOptions.tokenBudget ?? 4000,
        strategy: optimizationOptions.strategy ?? OptimizationStrategy.BALANCED,
        minRelevanceScore: optimizationOptions.minRelevanceScore ?? 0.1,
        maxSourcesPerType: optimizationOptions.maxSourcesPerType
      });

      // 3. Format context for AI prompt
      const formattedContext = this.formatContext(
        optimization.optimizedSources,
        context,
        { template: 'detailed' }
      );

      // 4. Build enhanced suggestion
      const enhanced: EnhancedSuggestion = {
        sourceCode,
        contextSources: optimization.optimizedSources,
        formattedContext,
        totalTokens: optimization.totalTokens,
        relevanceScore: optimization.stats.averageRelevance,
        stats: {
          importsIncluded: this.countByType(optimization.optimizedSources, 'import'),
          typesIncluded: this.countByType(optimization.optimizedSources, 'type'),
          functionsIncluded: this.countByType(optimization.optimizedSources, 'function'),
          relatedCodeIncluded: this.countByType(optimization.optimizedSources, 'related_code'),
          conventionsIncluded: this.countByType(optimization.optimizedSources, 'convention'),
          tokenUtilization: optimization.utilizationPercent,
          optimizationStrategy: optimization.strategy
        },
        optimization: {
          excludedSources: optimization.excludedSources,
          remainingTokens: optimization.remainingTokens,
          warnings: optimization.metadata.warnings
        }
      };

      // Cache the result
      this.cache.set(cacheKey, enhanced);
      setTimeout(() => this.cache.delete(cacheKey), this.cacheTTL);

      return enhanced;

    } catch (error) {
      console.error('Suggestion enhancement failed:', error);

      // Return minimal enhancement on error
      return {
        sourceCode,
        contextSources: [],
        formattedContext: '',
        totalTokens: this.estimateTokens(sourceCode),
        relevanceScore: 0,
        stats: {
          importsIncluded: 0,
          typesIncluded: 0,
          functionsIncluded: 0,
          relatedCodeIncluded: 0,
          conventionsIncluded: 0,
          tokenUtilization: 0,
          optimizationStrategy: 'none'
        },
        optimization: {
          excludedSources: [],
          remainingTokens: 0,
          warnings: [String(error)]
        }
      };
    }
  }

  /**
   * Enhance multiple suggestions in parallel
   */
  async enhanceMany(queries: SuggestionEnhancementQuery[]): Promise<EnhancedSuggestion[]> {
    return Promise.all(queries.map(query => this.enhance(query)));
  }

  /**
   * Format context sources for AI prompt
   */
  formatContext(
    sources: ContextSource[],
    fullContext?: SuggestionContext,
    options: ContextFormattingOptions = {}
  ): string {
    const {
      includeSourceCode = true,
      includeMetadata = false,
      groupByType = true,
      maxContentLength,
      template = 'detailed'
    } = options;

    if (sources.length === 0) {
      return '';
    }

    const sections: string[] = [];

    // Add header
    sections.push('## Relevant Context for Code Suggestion\n');

    if (groupByType) {
      // Group sources by type
      const sourcesByType = this.groupSourcesByType(sources);

      // Add each type section
      for (const [type, typeSources] of Object.entries(sourcesByType)) {
        sections.push(this.formatTypeSection(type, typeSources, template, maxContentLength, includeMetadata));
      }
    } else {
      // Add sources in order
      sections.push('### Context Sources\n');
      sources.forEach((source, index) => {
        sections.push(this.formatSource(source, index + 1, template, maxContentLength, includeMetadata));
      });
    }

    // Add source code if requested
    if (includeSourceCode && fullContext) {
      sections.push('### Source Code\n');
      sections.push('```typescript');
      sections.push(fullContext.sourceCode);
      sections.push('```\n');
    }

    // Add statistics summary if available
    if (fullContext && template === 'detailed') {
      sections.push(this.formatStatistics(fullContext));
    }

    return sections.join('\n');
  }

  /**
   * Format a type section
   */
  private formatTypeSection(
    type: string,
    sources: ContextSource[],
    template: string,
    maxContentLength?: number,
    includeMetadata?: boolean
  ): string {
    const sections: string[] = [];
    const typeLabel = this.getTypeLabel(type);

    sections.push(`### ${typeLabel}\n`);

    sources.forEach((source, index) => {
      sections.push(this.formatSource(source, index + 1, template, maxContentLength, includeMetadata));
    });

    return sections.join('\n');
  }

  /**
   * Format a single context source
   */
  private formatSource(
    source: ContextSource,
    index: number,
    template: string,
    maxContentLength?: number,
    includeMetadata?: boolean
  ): string {
    const sections: string[] = [];

    // Add title
    if (source.metadata.title && template !== 'minimal') {
      sections.push(`#### ${index}. ${source.metadata.title}`);
    }

    // Add metadata if requested
    if (includeMetadata && template === 'detailed') {
      const metadata = [];
      if (source.metadata.filePath) metadata.push(`File: ${source.metadata.filePath}`);
      if (source.metadata.lineNumber) metadata.push(`Line: ${source.metadata.lineNumber}`);
      if (source.metadata.relevance) metadata.push(`Relevance: ${source.metadata.relevance.toFixed(2)}`);
      if (metadata.length > 0) {
        sections.push(`*${metadata.join(' | ')}*`);
      }
    }

    // Add documentation if available
    if (source.metadata.documentation && template === 'detailed') {
      sections.push(`> ${source.metadata.documentation}`);
    }

    // Add content
    let content = source.content;
    if (maxContentLength && content.length > maxContentLength) {
      content = content.substring(0, maxContentLength) + '...';
    }

    sections.push('```typescript');
    sections.push(content);
    sections.push('```\n');

    return sections.join('\n');
  }

  /**
   * Format statistics summary
   */
  private formatStatistics(context: SuggestionContext): string {
    const sections: string[] = [];

    sections.push('### Context Statistics\n');
    sections.push(`- Total Sources: ${context.stats.totalSources}`);
    sections.push(`- Imports: ${context.stats.importCount}`);
    sections.push(`- Types: ${context.stats.typeCount}`);
    sections.push(`- Functions: ${context.stats.functionCount}`);
    sections.push(`- Related Code: ${context.stats.relatedCodeCount}`);
    sections.push(`- Conventions: ${context.stats.conventionCount}`);
    sections.push(`- Total Tokens: ${context.totalTokens}`);
    sections.push(`- Relevance Score: ${context.relevanceScore.toFixed(2)}\n`);

    return sections.join('\n');
  }

  /**
   * Get display label for source type
   */
  private getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      import: 'Imports',
      type: 'Type Definitions',
      function: 'Functions',
      related_code: 'Related Code',
      convention: 'Project Conventions',
      project_pattern: 'Project Patterns'
    };
    return labels[type] || type.charAt(0).toUpperCase() + type.slice(1);
  }

  /**
   * Group sources by type
   */
  private groupSourcesByType(sources: ContextSource[]): Record<string, ContextSource[]> {
    const grouped: Record<string, ContextSource[]> = {};

    for (const source of sources) {
      const type = source.metadata.type;
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(source);
    }

    // Sort each group by relevance
    for (const type in grouped) {
      grouped[type].sort((a, b) => b.metadata.relevance - a.metadata.relevance);
    }

    return grouped;
  }

  /**
   * Count sources by type
   */
  private countByType(sources: ContextSource[], type: string): number {
    return sources.filter(s => s.metadata.type === type).length;
  }

  /**
   * Build cache key from query
   */
  private buildCacheKey(query: SuggestionEnhancementQuery): string {
    const parts = [
      query.sourceCode,
      query.sourceFile || '',
      query.workspaceId || '',
      query.intent || '',
      JSON.stringify(query.contextOptions || {}),
      JSON.stringify(query.optimizationOptions || {})
    ];
    return parts.join('|');
  }

  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      ttl: this.cacheTTL,
      contextBuilder: this.contextBuilder.getCacheStats(),
      keys: Array.from(this.cache.keys()).slice(0, 5) // First 5 keys for debugging
    };
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations(enhanced: EnhancedSuggestion): string[] {
    const recommendations: string[] = [];

    // Low token utilization
    if (enhanced.stats.tokenUtilization < 50) {
      recommendations.push(
        `Token utilization is ${enhanced.stats.tokenUtilization.toFixed(1)}%. Consider increasing token budget or lowering relevance thresholds.`
      );
    }

    // Low relevance score
    if (enhanced.relevanceScore < 0.5) {
      recommendations.push(
        'Average relevance score is low. Consider providing more specific intent or analyzing more files.'
      );
    }

    // No related code
    if (enhanced.stats.relatedCodeIncluded === 0 && enhanced.stats.typesIncluded > 0) {
      recommendations.push(
        'No related code was included. Ensure workspaceRoot and sourceFile are provided for better context.'
      );
    }

    // No conventions
    if (enhanced.stats.conventionsIncluded === 0) {
      recommendations.push(
        'No project conventions detected. Provide conventionFiles to improve suggestion quality.'
      );
    }

    // Add optimization warnings
    if (enhanced.optimization.warnings.length > 0) {
      recommendations.push(...enhanced.optimization.warnings);
    }

    return recommendations;
  }

  /**
   * Clear all internal caches
   */
  clearAllCaches(): void {
    this.clearCache();
    this.contextBuilder.clearCaches();
  }
}

/**
 * Factory function to create a SuggestionEnhancer instance
 */
export function createSuggestionEnhancer(options?: {
  cacheTTL?: number;
  defaultOptimizationOptions?: ContextOptimizationOptions;
}): SuggestionEnhancer {
  return new SuggestionEnhancer(options);
}

/**
 * Singleton instance for convenience
 */
let defaultEnhancer: SuggestionEnhancer | null = null;

/**
 * Get or create default enhancer instance
 */
export function getDefaultEnhancer(): SuggestionEnhancer {
  if (!defaultEnhancer) {
    defaultEnhancer = createSuggestionEnhancer();
  }
  return defaultEnhancer;
}

/**
 * Reset default enhancer (useful for testing)
 */
export function resetDefaultEnhancer(): void {
  if (defaultEnhancer) {
    defaultEnhancer.clearAllCaches();
    defaultEnhancer = null;
  }
}
