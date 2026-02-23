/**
 * SuggestionContextBuilder - Build enriched context for AI code suggestions
 *
 * Combines code analysis (imports, types, functions), related code discovery,
 * and project conventions to build comprehensive context for AI suggestions.
 * Similar to RAG but focused on code structure and conventions.
 */

import { ImportExtractor, ImportExtractionResult } from './analysis/import-extractor';
import { TypeExtractor, TypeExtractionResult } from './analysis/type-extractor';
import { FunctionExtractor, FunctionSignature } from './analysis/function-extractor';
import { RelatedCodeFinder, RelatedCodeResult, RelatedCodeElement } from './analysis/related-code-finder';
import { ConventionsAggregator, ProjectConventionsResult } from './conventions/conventions-aggregator';

/**
 * Represents a source of enriched context
 */
export interface ContextSource {
  id: string;
  content: string;
  metadata: {
    title?: string;
    filePath?: string;
    type: 'import' | 'type' | 'function' | 'related_code' | 'convention' | 'project_pattern';
    category?: string;
    relevance: number;
    lineNumber?: number;
    documentation?: string;
  };
}

/**
 * Enriched context for AI suggestions
 */
export interface SuggestionContext {
  /** Source code being analyzed */
  sourceCode: string;
  /** Source file path if available */
  sourceFile?: string;
  /** All enriched context sources */
  sources: ContextSource[];
  /** Extracted imports */
  imports: ImportExtractionResult;
  /** Extracted types */
  types: TypeExtractionResult;
  /** Extracted functions */
  functions: FunctionSignature[];
  /** Related code elements */
  relatedCode?: RelatedCodeResult;
  /** Project conventions */
  conventions?: ProjectConventionsResult;
  /** Total token count estimate */
  totalTokens: number;
  /** Overall relevance score (0-1) */
  relevanceScore: number;
  /** Statistics about the context */
  stats: {
    totalSources: number;
    importCount: number;
    typeCount: number;
    functionCount: number;
    relatedCodeCount: number;
    conventionCount: number;
  };
}

/**
 * Options for building suggestion context
 */
export interface SuggestionContextOptions {
  /** Include related code discovery (default: true) */
  includeRelatedCode?: boolean;
  /** Include project conventions (default: true) */
  includeConventions?: boolean;
  /** Maximum number of related code elements (default: 10) */
  maxRelatedElements?: number;
  /** Maximum number of convention examples (default: 5) */
  maxConventionExamples?: number;
  /** Minimum relevance score for related code (default: 0.2) */
  minRelevanceScore?: number;
  /** Workspace root path for file resolution */
  workspaceRoot?: string;
  /** Additional files to analyze for conventions */
  conventionFiles?: string[];
  /** Token budget limit (default: 4000) */
  tokenBudget?: number;
}

/**
 * Query for building suggestion context
 */
export interface SuggestionContextQuery {
  /** Source code to analyze */
  sourceCode: string;
  /** Source file path (optional) */
  sourceFile?: string;
  /** Workspace identifier (optional) */
  workspaceId?: string;
  /** Additional context or user intent */
  intent?: string;
  /** Options for context building */
  options?: SuggestionContextOptions;
}

/**
 * SuggestionContextBuilder class for building enriched AI context
 */
export class SuggestionContextBuilder {
  private readonly importExtractor: ImportExtractor;
  private readonly typeExtractor: TypeExtractor;
  private readonly functionExtractor: FunctionExtractor;
  private readonly relatedCodeFinder: RelatedCodeFinder;
  private readonly conventionsAggregator: ConventionsAggregator;

  constructor() {
    this.importExtractor = new ImportExtractor();
    this.typeExtractor = new TypeExtractor();
    this.functionExtractor = new FunctionExtractor();
    this.relatedCodeFinder = new RelatedCodeFinder();
    this.conventionsAggregator = new ConventionsAggregator();
  }

  /**
   * Build enriched context for AI suggestions
   */
  async buildContext(query: SuggestionContextQuery): Promise<SuggestionContext> {
    const {
      sourceCode,
      sourceFile,
      workspaceId,
      intent,
      options = {}
    } = query;

    const {
      includeRelatedCode = true,
      includeConventions = true,
      maxRelatedElements = 10,
      maxConventionExamples = 5,
      minRelevanceScore = 0.2,
      workspaceRoot,
      conventionFiles = [],
      tokenBudget = 4000
    } = options;

    try {
      // 1. Extract imports from source code
      const imports = this.importExtractor.extract(sourceCode, sourceFile);

      // 2. Extract type definitions
      const types = this.typeExtractor.extract(sourceCode, sourceFile);

      // 3. Extract function signatures
      const functions = this.functionExtractor.extract(sourceCode, sourceFile);

      // 4. Find related code if enabled and source file is provided
      let relatedCode: RelatedCodeResult | undefined;
      if (includeRelatedCode && sourceFile && workspaceRoot) {
        relatedCode = await this.findRelatedCode(
          sourceFile,
          imports,
          workspaceRoot,
          maxRelatedElements,
          minRelevanceScore
        );
      }

      // 5. Build project conventions if enabled
      let conventions: ProjectConventionsResult | undefined;
      if (includeConventions && conventionFiles.length > 0) {
        conventions = await this.buildConventions(
          [...conventionFiles, sourceCode],
          maxConventionExamples
        );
      }

      // 6. Build context sources from all extracted information
      const sources = this.buildContextSources(
        imports,
        types,
        functions,
        relatedCode,
        conventions,
        intent
      );

      // 7. Optimize sources to fit within token budget
      const optimizedSources = this.optimizeSources(sources, tokenBudget);

      // 8. Calculate statistics
      const stats = {
        totalSources: optimizedSources.length,
        importCount: imports.stats.total,
        typeCount: types.stats.total,
        functionCount: functions.length,
        relatedCodeCount: relatedCode?.stats.total || 0,
        conventionCount: conventions?.stats.totalConventions || 0
      };

      // 9. Calculate relevance score
      const relevanceScore = this.calculateRelevanceScore(
        imports,
        types,
        functions,
        relatedCode,
        conventions
      );

      // 10. Estimate total tokens
      const totalTokens = this.estimateTokenCount(optimizedSources, sourceCode);

      return {
        sourceCode,
        sourceFile,
        sources: optimizedSources,
        imports,
        types,
        functions,
        relatedCode,
        conventions,
        totalTokens,
        relevanceScore,
        stats
      };

    } catch (error) {
      console.error('Suggestion context building failed:', error);

      // Return minimal context on error
      return {
        sourceCode,
        sourceFile,
        sources: [],
        imports: {
          imports: [],
          stats: { total: 0, default: 0, named: 0, namespace: 0, sideEffect: 0, typeOnly: 0 },
          externalPackages: [],
          internalImports: [],
          errors: [String(error)]
        },
        types: {
          types: [],
          stats: { total: 0, interfaces: 0, typeAliases: 0, enums: 0, classes: 0, exported: 0 },
          exportedTypes: [],
          errors: [String(error)]
        },
        functions: [],
        totalTokens: this.estimateTokenCount([], sourceCode),
        relevanceScore: 0,
        stats: {
          totalSources: 0,
          importCount: 0,
          typeCount: 0,
          functionCount: 0,
          relatedCodeCount: 0,
          conventionCount: 0
        }
      };
    }
  }

  /**
   * Find related code based on imports and dependencies
   */
  private async findRelatedCode(
    sourceFile: string,
    imports: ImportExtractionResult,
    workspaceRoot: string,
    maxElements: number,
    minRelevance: number
  ): Promise<RelatedCodeResult | undefined> {
    try {
      const result = await this.relatedCodeFinder.findRelated(sourceFile, {
        workspaceRoot,
        maxResults: maxElements,
        minRelevanceScore: minRelevance,
        includeTransitive: false // Only direct dependencies for performance
      });

      return result;
    } catch (error) {
      console.warn('Related code finding failed:', error);
      return undefined;
    }
  }

  /**
   * Build project conventions from multiple files
   */
  private async buildConventions(
    files: string[],
    maxExamples: number
  ): Promise<ProjectConventionsResult | undefined> {
    try {
      // Analyze each file
      for (const file of files) {
        if (typeof file === 'string' && file.length > 0) {
          await this.conventionsAggregator.analyzeFile(file, file);
        }
      }

      // Aggregate conventions
      const result = this.conventionsAggregator.aggregate({
        maxExamples,
        minConfidence: 0.6
      });

      return result;
    } catch (error) {
      console.warn('Convention building failed:', error);
      return undefined;
    }
  }

  /**
   * Build context sources from extracted information
   */
  private buildContextSources(
    imports: ImportExtractionResult,
    types: TypeExtractionResult,
    functions: FunctionSignature[],
    relatedCode?: RelatedCodeResult,
    conventions?: ProjectConventionsResult,
    intent?: string
  ): ContextSource[] {
    const sources: ContextSource[] = [];

    // Add import sources
    imports.imports.forEach((imp, index) => {
      const relevance = this.calculateImportRelevance(imp, intent);
      sources.push({
        id: `import-${index}`,
        content: imp.text,
        metadata: {
          title: `Import from ${imp.moduleSpecifier}`,
          type: 'import',
          category: imp.type,
          relevance,
          lineNumber: imp.line
        }
      });
    });

    // Add type definition sources
    types.types.forEach((type, index) => {
      const relevance = this.calculateTypeRelevance(type, intent);
      sources.push({
        id: `type-${index}`,
        content: type.text,
        metadata: {
          title: `${type.kind}: ${type.name}`,
          type: 'type',
          category: type.kind,
          relevance,
          lineNumber: type.line,
          documentation: type.documentation
        }
      });
    });

    // Add function sources
    functions.forEach((func, index) => {
      const relevance = this.calculateFunctionRelevance(func, intent);
      sources.push({
        id: `function-${index}`,
        content: func.signature,
        metadata: {
          title: `Function: ${func.name}`,
          type: 'function',
          category: func.kind,
          relevance,
          lineNumber: func.line,
          documentation: func.documentation
        }
      });
    });

    // Add related code sources
    if (relatedCode) {
      relatedCode.relatedElements.forEach((element, index) => {
        sources.push({
          id: `related-${index}`,
          content: element.signature || element.name,
          metadata: {
            title: `Related ${element.elementType}: ${element.name}`,
            filePath: element.filePath,
            type: 'related_code',
            category: element.relationshipType,
            relevance: element.relevanceScore,
            lineNumber: element.line,
            documentation: element.documentation
          }
        });
      });
    }

    // Add convention sources
    if (conventions) {
      const conventionSources = this.buildConventionSources(conventions);
      sources.push(...conventionSources);
    }

    return sources;
  }

  /**
   * Build sources from project conventions
   */
  private buildConventionSources(conventions: ProjectConventionsResult): ContextSource[] {
    const sources: ContextSource[] = [];
    let sourceIndex = 0;

    // Add top recommendations as sources
    conventions.recommendations.forEach((rec) => {
      const content = `${rec.recommendation}\nExamples:\n${rec.examples.join('\n')}`;
      sources.push({
        id: `convention-${sourceIndex++}`,
        content,
        metadata: {
          title: `Convention: ${rec.category}`,
          type: 'convention',
          category: rec.category,
          relevance: 1.0 / rec.priority // Higher priority = higher relevance
        }
      });
    });

    return sources;
  }

  /**
   * Optimize sources to fit within token budget
   */
  private optimizeSources(sources: ContextSource[], tokenBudget: number): ContextSource[] {
    // Sort by relevance descending
    const sorted = [...sources].sort((a, b) => b.metadata.relevance - a.metadata.relevance);

    // Select sources until token budget is reached
    const optimized: ContextSource[] = [];
    let currentTokens = 0;

    for (const source of sorted) {
      const sourceTokens = this.estimateSourceTokens(source);

      if (currentTokens + sourceTokens <= tokenBudget) {
        optimized.push(source);
        currentTokens += sourceTokens;
      } else {
        // Token budget exceeded, stop adding
        break;
      }
    }

    return optimized;
  }

  /**
   * Calculate import relevance based on intent and usage
   */
  private calculateImportRelevance(imp: any, intent?: string): number {
    let relevance = 0.5; // Base relevance

    // External packages are typically more relevant
    if (!imp.moduleSpecifier.startsWith('.')) {
      relevance += 0.2;
    }

    // Type-only imports are less relevant for runtime suggestions
    if (imp.isTypeOnly) {
      relevance -= 0.1;
    }

    // If intent matches the module name, boost relevance
    if (intent && imp.moduleSpecifier.toLowerCase().includes(intent.toLowerCase())) {
      relevance += 0.3;
    }

    return Math.max(0, Math.min(1, relevance));
  }

  /**
   * Calculate type relevance
   */
  private calculateTypeRelevance(type: any, intent?: string): number {
    let relevance = 0.6; // Base relevance for types

    // Exported types are more relevant
    if (type.isExported) {
      relevance += 0.2;
    }

    // Interfaces and types with documentation are more relevant
    if (type.documentation) {
      relevance += 0.1;
    }

    // Match with intent
    if (intent && type.name.toLowerCase().includes(intent.toLowerCase())) {
      relevance += 0.3;
    }

    return Math.max(0, Math.min(1, relevance));
  }

  /**
   * Calculate function relevance
   */
  private calculateFunctionRelevance(func: FunctionSignature, intent?: string): number {
    let relevance = 0.7; // Base relevance for functions

    // Exported functions are more relevant
    if (func.isExported) {
      relevance += 0.15;
    }

    // Functions with documentation are more relevant
    if (func.documentation) {
      relevance += 0.1;
    }

    // Async functions might be more relevant in async contexts
    if (func.isAsync) {
      relevance += 0.05;
    }

    // Match with intent
    if (intent && func.name.toLowerCase().includes(intent.toLowerCase())) {
      relevance += 0.3;
    }

    return Math.max(0, Math.min(1, relevance));
  }

  /**
   * Calculate overall relevance score
   */
  private calculateRelevanceScore(
    imports: ImportExtractionResult,
    types: TypeExtractionResult,
    functions: FunctionSignature[],
    relatedCode?: RelatedCodeResult,
    conventions?: ProjectConventionsResult
  ): number {
    let totalScore = 0;
    let weightSum = 0;

    // Weight imports (0.2)
    if (imports.stats.total > 0) {
      totalScore += 0.6 * 0.2;
      weightSum += 0.2;
    }

    // Weight types (0.25)
    if (types.stats.total > 0) {
      totalScore += 0.7 * 0.25;
      weightSum += 0.25;
    }

    // Weight functions (0.25)
    if (functions.length > 0) {
      totalScore += 0.8 * 0.25;
      weightSum += 0.25;
    }

    // Weight related code (0.15)
    if (relatedCode && relatedCode.stats.total > 0) {
      totalScore += (relatedCode.stats.averageRelevance || 0.5) * 0.15;
      weightSum += 0.15;
    }

    // Weight conventions (0.15)
    if (conventions && conventions.stats.totalConventions > 0) {
      totalScore += (conventions.stats.consistencyScore || 0.5) * 0.15;
      weightSum += 0.15;
    }

    return weightSum > 0 ? totalScore / weightSum : 0;
  }

  /**
   * Estimate token count for a source
   */
  private estimateSourceTokens(source: ContextSource): number {
    // Rough estimation: ~4 characters per token
    const contentTokens = Math.ceil(source.content.length / 4);
    const metadataTokens = 10; // Overhead for metadata
    return contentTokens + metadataTokens;
  }

  /**
   * Estimate total token count
   */
  private estimateTokenCount(sources: ContextSource[], sourceCode: string): number {
    const sourceTokens = sources.reduce((sum, source) => sum + this.estimateSourceTokens(source), 0);
    const codeTokens = Math.ceil(sourceCode.length / 4);
    const overhead = 50; // System prompt overhead
    return sourceTokens + codeTokens + overhead;
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.importExtractor.clearCache();
    this.typeExtractor.clearCache();
    this.functionExtractor.clearCache();
    this.relatedCodeFinder.clearCache();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      imports: this.importExtractor.getCacheStats(),
      types: this.typeExtractor.getCacheStats(),
      functions: this.functionExtractor.getCacheStats(),
      relatedCode: this.relatedCodeFinder.getCacheStats()
    };
  }
}

/**
 * Factory function to create a SuggestionContextBuilder instance
 */
export function createSuggestionContextBuilder(): SuggestionContextBuilder {
  return new SuggestionContextBuilder();
}
