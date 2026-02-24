/**
 * RelatedCodeFinder - Find related code based on imports and usage patterns
 *
 * Analyzes TypeScript/JavaScript files to discover related functions, classes,
 * types, and modules based on import relationships, usage patterns, and semantic
 * connections. Provides relevance scoring and caching for performance.
 */

import * as ts from 'typescript';
import { ImportExtractor, ImportStatement } from './import-extractor';
import { TypeExtractor, TypeDefinition, TypeDefinitionKind } from './type-extractor';
import { FunctionExtractor, FunctionSignature } from './function-extractor';

/**
 * Types of code relationships
 */
export enum RelationshipType {
  /** Direct import relationship */
  IMPORT = 'import',
  /** Exported by same module */
  EXPORTED_BY = 'exported_by',
  /** Used in function/method */
  USED_IN = 'used_in',
  /** Type dependency */
  TYPE_DEPENDENCY = 'type_dependency',
  /** Same namespace/module */
  SAME_MODULE = 'same_module',
  /** Parent-child relationship (inheritance, composition) */
  PARENT_CHILD = 'parent_child',
  /** Sibling relationship (same parent) */
  SIBLING = 'sibling'
}

/**
 * Represents a related code element
 */
export interface RelatedCodeElement {
  /** Name of the code element */
  name: string;
  /** Type of element (function, class, interface, etc.) */
  elementType: 'function' | 'class' | 'interface' | 'type' | 'enum' | 'variable' | 'module';
  /** File path where element is defined */
  filePath: string;
  /** Type of relationship to the source */
  relationshipType: RelationshipType;
  /** Relevance score (0-1) */
  relevanceScore: number;
  /** Distance from source (lower is closer) */
  distance: number;
  /** Line number in file */
  line?: number;
  /** Brief description or signature */
  signature?: string;
  /** Documentation if available */
  documentation?: string;
  /** Related import statement if applicable */
  importStatement?: ImportStatement;
}

/**
 * Result of related code finding
 */
export interface RelatedCodeResult {
  /** Source file path or identifier */
  source: string;
  /** All related code elements */
  relatedElements: RelatedCodeElement[];
  /** Elements grouped by relationship type */
  byRelationship: Record<RelationshipType, RelatedCodeElement[]>;
  /** Elements grouped by element type */
  byElementType: Record<string, RelatedCodeElement[]>;
  /** Direct dependencies (imports) */
  directDependencies: string[];
  /** Transitive dependencies */
  transitiveDependencies: string[];
  /** Statistics */
  stats: {
    total: number;
    byRelationship: Record<RelationshipType, number>;
    byElementType: Record<string, number>;
    averageRelevance: number;
  };
  /** Any errors encountered */
  errors: string[];
}

/**
 * Options for RelatedCodeFinder
 */
export interface RelatedCodeFinderOptions {
  /** Enable caching (default: true) */
  enableCache?: boolean;
  /** Cache TTL in milliseconds (default: 1 hour) */
  cacheTtl?: number;
  /** Maximum cache size (default: 500 entries) */
  maxCacheSize?: number;
  /** Maximum depth for transitive dependencies (default: 2) */
  maxDepth?: number;
  /** Minimum relevance score to include (default: 0.1) */
  minRelevanceScore?: number;
  /** Maximum results to return (default: 100) */
  maxResults?: number;
  /** Include transitive dependencies (default: true) */
  includeTransitive?: boolean;
  /** File resolver function for imports */
  resolveImport?: (importPath: string, fromFile: string) => string | null;
}

/**
 * Cache entry for related code results
 */
interface CacheEntry {
  result: RelatedCodeResult;
  timestamp: number;
  hash: string;
}

/**
 * Context for building related code graph
 */
interface RelationshipContext {
  /** Current file being analyzed */
  currentFile: string;
  /** Current depth in traversal */
  depth: number;
  /** Visited files to prevent cycles */
  visited: Set<string>;
  /** Elements found so far */
  elements: Map<string, RelatedCodeElement>;
}

/**
 * RelatedCodeFinder class for discovering related code
 */
export class RelatedCodeFinder {
  private cache = new Map<string, CacheEntry>();
  private readonly options: Required<RelatedCodeFinderOptions>;
  private readonly importExtractor: ImportExtractor;
  private readonly typeExtractor: TypeExtractor;
  private readonly functionExtractor: FunctionExtractor;

  constructor(options: RelatedCodeFinderOptions = {}) {
    this.options = {
      enableCache: options.enableCache ?? true,
      cacheTtl: options.cacheTtl ?? 60 * 60 * 1000, // 1 hour
      maxCacheSize: options.maxCacheSize ?? 500,
      maxDepth: options.maxDepth ?? 2,
      minRelevanceScore: options.minRelevanceScore ?? 0.1,
      maxResults: options.maxResults ?? 100,
      includeTransitive: options.includeTransitive ?? true,
      resolveImport: options.resolveImport ?? this.defaultResolveImport.bind(this)
    };

    this.importExtractor = new ImportExtractor({
      enableCache: this.options.enableCache
    });

    this.typeExtractor = new TypeExtractor({
      enableCache: this.options.enableCache
    });

    this.functionExtractor = new FunctionExtractor({
      enableCache: this.options.enableCache
    });
  }

  /**
   * Default import path resolver
   */
  private defaultResolveImport(importPath: string, fromFile: string): string | null {
    // Handle relative imports
    if (importPath.startsWith('.')) {
      const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
      let resolved = `${fromDir}/${importPath}`;

      // Normalize path
      resolved = resolved.replace(/\/\.\//g, '/');
      while (resolved.includes('/../')) {
        resolved = resolved.replace(/\/[^/]+\/\.\.\//g, '/');
      }

      // Try common extensions
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
      for (const ext of extensions) {
        // In a real implementation, we'd check if file exists
        // For now, just return the path with .ts extension
        if (!resolved.match(/\.(ts|tsx|js|jsx)$/)) {
          return resolved + '.ts';
        }
      }

      return resolved;
    }

    // For node_modules or absolute imports, return as-is
    // In a real implementation, we'd resolve these properly
    return importPath;
  }

  /**
   * Generate cache key for code content
   */
  private generateCacheKey(source: string, content: string): string {
    // Simple hash function for cache key
    let hash = 0;
    const str = `${source}:${content}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `${source}:${hash}`;
  }

  /**
   * Check if cache entry is valid
   */
  private isCacheValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < this.options.cacheTtl;
  }

  /**
   * Evict old cache entries if cache is full
   */
  private evictCache(): void {
    if (this.cache.size >= this.options.maxCacheSize) {
      const oldestKey = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0]?.[0];

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  /**
   * Calculate relevance score based on relationship type and distance
   */
  private calculateRelevanceScore(
    relationshipType: RelationshipType,
    distance: number
  ): number {
    // Base scores for relationship types
    const baseScores: Record<RelationshipType, number> = {
      [RelationshipType.IMPORT]: 0.9,
      [RelationshipType.USED_IN]: 0.85,
      [RelationshipType.TYPE_DEPENDENCY]: 0.8,
      [RelationshipType.EXPORTED_BY]: 0.75,
      [RelationshipType.PARENT_CHILD]: 0.7,
      [RelationshipType.SAME_MODULE]: 0.6,
      [RelationshipType.SIBLING]: 0.5
    };

    const baseScore = baseScores[relationshipType] || 0.5;

    // Apply distance penalty (exponential decay)
    const distancePenalty = Math.pow(0.7, distance);

    return Math.min(1, baseScore * distancePenalty);
  }

  /**
   * Extract related elements from imports
   */
  private extractFromImports(
    imports: ImportStatement[],
    context: RelationshipContext
  ): void {
    for (const importStmt of imports) {
      const resolvedPath = this.options.resolveImport(
        importStmt.moduleSpecifier,
        context.currentFile
      );

      if (!resolvedPath) continue;

      // Add imported items as related elements
      for (const binding of importStmt.bindings) {
        const elementKey = `${resolvedPath}:${binding.name}`;

        if (!context.elements.has(elementKey)) {
          const element: RelatedCodeElement = {
            name: binding.name,
            elementType: binding.isTypeOnly ? 'type' : 'variable',
            filePath: resolvedPath,
            relationshipType: RelationshipType.IMPORT,
            relevanceScore: this.calculateRelevanceScore(
              RelationshipType.IMPORT,
              context.depth
            ),
            distance: context.depth,
            line: importStmt.line,
            signature: importStmt.text,
            importStatement: importStmt
          };

          context.elements.set(elementKey, element);
        }
      }

      // Handle namespace imports
      if (importStmt.type === 'namespace') {
        const elementKey = `${resolvedPath}:module`;
        if (!context.elements.has(elementKey)) {
          const element: RelatedCodeElement = {
            name: importStmt.bindings[0]?.name || importStmt.moduleSpecifier,
            elementType: 'module',
            filePath: resolvedPath,
            relationshipType: RelationshipType.IMPORT,
            relevanceScore: this.calculateRelevanceScore(
              RelationshipType.IMPORT,
              context.depth
            ),
            distance: context.depth,
            line: importStmt.line,
            signature: importStmt.text,
            importStatement: importStmt
          };
          context.elements.set(elementKey, element);
        }
      }
    }
  }

  /**
   * Extract related elements from type definitions
   */
  private extractFromTypes(
    types: TypeDefinition[],
    context: RelationshipContext
  ): void {
    for (const type of types) {
      const elementKey = `${context.currentFile}:${type.name}`;

      if (!context.elements.has(elementKey)) {
        // Map TypeDefinitionKind to element type
        let elementType: RelatedCodeElement['elementType'];
        if (type.kind === TypeDefinitionKind.CLASS) {
          elementType = 'class';
        } else if (type.kind === TypeDefinitionKind.INTERFACE) {
          elementType = 'interface';
        } else if (type.kind === TypeDefinitionKind.TYPE_ALIAS) {
          elementType = 'type';
        } else if (type.kind === TypeDefinitionKind.ENUM) {
          elementType = 'enum';
        } else {
          elementType = 'type';
        }

        const element: RelatedCodeElement = {
          name: type.name,
          elementType,
          filePath: context.currentFile,
          relationshipType: RelationshipType.SAME_MODULE,
          relevanceScore: this.calculateRelevanceScore(
            RelationshipType.SAME_MODULE,
            context.depth
          ),
          distance: context.depth,
          line: type.line,
          signature: type.text,
          documentation: type.documentation
        };

        context.elements.set(elementKey, element);
      }

      // Add parent types as related elements
      for (const parent of type.heritage) {
        const parentKey = `${context.currentFile}:${parent}`;
        if (!context.elements.has(parentKey)) {
          const element: RelatedCodeElement = {
            name: parent,
            elementType: type.kind === TypeDefinitionKind.CLASS ? 'class' : 'interface',
            filePath: context.currentFile,
            relationshipType: RelationshipType.PARENT_CHILD,
            relevanceScore: this.calculateRelevanceScore(
              RelationshipType.PARENT_CHILD,
              context.depth
            ),
            distance: context.depth,
            signature: `extends ${parent}`
          };
          context.elements.set(parentKey, element);
        }
      }
    }
  }

  /**
   * Extract related elements from functions
   */
  private extractFromFunctions(
    functions: FunctionSignature[],
    context: RelationshipContext
  ): void {
    for (const func of functions) {
      const elementKey = `${context.currentFile}:${func.name}`;

      if (!context.elements.has(elementKey)) {
        const element: RelatedCodeElement = {
          name: func.name,
          elementType: 'function',
          filePath: context.currentFile,
          relationshipType: RelationshipType.SAME_MODULE,
          relevanceScore: this.calculateRelevanceScore(
            RelationshipType.SAME_MODULE,
            context.depth
          ),
          distance: context.depth,
          line: func.line,
          signature: func.text,
          documentation: func.documentation
        };

        context.elements.set(elementKey, element);
      }

      // If this is a method, add the parent class as related
      if (func.parentClass) {
        const classKey = `${context.currentFile}:${func.parentClass}`;
        if (!context.elements.has(classKey)) {
          const element: RelatedCodeElement = {
            name: func.parentClass,
            elementType: 'class',
            filePath: context.currentFile,
            relationshipType: RelationshipType.PARENT_CHILD,
            relevanceScore: this.calculateRelevanceScore(
              RelationshipType.PARENT_CHILD,
              context.depth
            ),
            distance: context.depth,
            signature: `class ${func.parentClass}`
          };
          context.elements.set(classKey, element);
        }
      }
    }
  }

  /**
   * Analyze code and find related elements
   */
  private analyzeCode(
    source: string,
    code: string,
    context: RelationshipContext
  ): void {
    // Extract imports
    const importResult = this.importExtractor.extract(code);
    if (importResult.imports.length > 0) {
      this.extractFromImports(importResult.imports, context);
    }

    // Extract types
    const typeResult = this.typeExtractor.extract(code);
    if (typeResult.types.length > 0) {
      this.extractFromTypes(typeResult.types, context);
    }

    // Extract functions
    const functionResult = this.functionExtractor.extract(code);
    if (functionResult.functions.length > 0) {
      this.extractFromFunctions(functionResult.functions, context);
    }
  }

  /**
   * Build result from context
   */
  private buildResult(source: string, context: RelationshipContext): RelatedCodeResult {
    const elements = Array.from(context.elements.values())
      .filter(el => el.relevanceScore >= this.options.minRelevanceScore)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, this.options.maxResults);

    // Group by relationship type
    const byRelationship: Record<RelationshipType, RelatedCodeElement[]> = {
      [RelationshipType.IMPORT]: [],
      [RelationshipType.EXPORTED_BY]: [],
      [RelationshipType.USED_IN]: [],
      [RelationshipType.TYPE_DEPENDENCY]: [],
      [RelationshipType.SAME_MODULE]: [],
      [RelationshipType.PARENT_CHILD]: [],
      [RelationshipType.SIBLING]: []
    };

    // Group by element type
    const byElementType: Record<string, RelatedCodeElement[]> = {};

    for (const element of elements) {
      if (!byRelationship[element.relationshipType]) {
        byRelationship[element.relationshipType] = [];
      }
      byRelationship[element.relationshipType].push(element);

      if (!byElementType[element.elementType]) {
        byElementType[element.elementType] = [];
      }
      byElementType[element.elementType].push(element);
    }

    // Calculate statistics
    const stats = {
      total: elements.length,
      byRelationship: {} as Record<RelationshipType, number>,
      byElementType: {} as Record<string, number>,
      averageRelevance: elements.length > 0
        ? elements.reduce((sum, el) => sum + el.relevanceScore, 0) / elements.length
        : 0
    };

    for (const type of Object.values(RelationshipType)) {
      stats.byRelationship[type] = byRelationship[type].length;
    }

    for (const type in byElementType) {
      stats.byElementType[type] = byElementType[type].length;
    }

    // Extract dependencies
    const directDependencies = Array.from(
      new Set(
        elements
          .filter(el => el.relationshipType === RelationshipType.IMPORT && el.distance === 0)
          .map(el => el.filePath)
      )
    );

    const transitiveDependencies = Array.from(
      new Set(
        elements
          .filter(el => el.relationshipType === RelationshipType.IMPORT && el.distance > 0)
          .map(el => el.filePath)
      )
    );

    return {
      source,
      relatedElements: elements,
      byRelationship,
      byElementType,
      directDependencies,
      transitiveDependencies,
      stats,
      errors: []
    };
  }

  /**
   * Find related code for the given source code
   */
  findRelated(source: string, code: string): RelatedCodeResult {
    // Check cache
    const cacheKey = this.generateCacheKey(source, code);
    if (this.options.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && this.isCacheValid(cached)) {
        return cached.result;
      }
    }

    // Initialize context
    const context: RelationshipContext = {
      currentFile: source,
      depth: 0,
      visited: new Set([source]),
      elements: new Map()
    };

    try {
      // Analyze the source code
      this.analyzeCode(source, code, context);

      // Build and cache result
      const result = this.buildResult(source, context);

      if (this.options.enableCache) {
        this.evictCache();
        this.cache.set(cacheKey, {
          result,
          timestamp: Date.now(),
          hash: cacheKey
        });
      }

      return result;
    } catch (error) {
      return {
        source,
        relatedElements: [],
        byRelationship: {
          [RelationshipType.IMPORT]: [],
          [RelationshipType.EXPORTED_BY]: [],
          [RelationshipType.USED_IN]: [],
          [RelationshipType.TYPE_DEPENDENCY]: [],
          [RelationshipType.SAME_MODULE]: [],
          [RelationshipType.PARENT_CHILD]: [],
          [RelationshipType.SIBLING]: []
        },
        byElementType: {},
        directDependencies: [],
        transitiveDependencies: [],
        stats: {
          total: 0,
          byRelationship: {
            [RelationshipType.IMPORT]: 0,
            [RelationshipType.EXPORTED_BY]: 0,
            [RelationshipType.USED_IN]: 0,
            [RelationshipType.TYPE_DEPENDENCY]: 0,
            [RelationshipType.SAME_MODULE]: 0,
            [RelationshipType.PARENT_CHILD]: 0,
            [RelationshipType.SIBLING]: 0
          },
          byElementType: {},
          averageRelevance: 0
        },
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Find related code by file path (async)
   * In a real implementation, this would read the file content
   */
  async findRelatedByPath(filePath: string): Promise<RelatedCodeResult> {
    // This is a placeholder - in a real implementation,
    // we would read the file content here
    throw new Error('findRelatedByPath: File system access not implemented in this context');
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    // This would require tracking hits/misses in a real implementation
    return {
      size: this.cache.size,
      hits: 0,
      misses: 0,
      hitRate: 0
    };
  }
}

/**
 * Convenience function to find related code
 */
export function findRelatedCode(
  source: string,
  code: string,
  options?: RelatedCodeFinderOptions
): RelatedCodeResult {
  const finder = new RelatedCodeFinder(options);
  return finder.findRelated(source, code);
}

/**
 * Convenience function to find related code with custom resolver
 */
export function findRelatedCodeWithResolver(
  source: string,
  code: string,
  resolveImport: (importPath: string, fromFile: string) => string | null,
  options?: Omit<RelatedCodeFinderOptions, 'resolveImport'>
): RelatedCodeResult {
  const finder = new RelatedCodeFinder({
    ...options,
    resolveImport
  });
  return finder.findRelated(source, code);
}
