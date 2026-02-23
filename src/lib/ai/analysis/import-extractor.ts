/**
 * ImportExtractor - Extract import statements from TypeScript/JavaScript files
 *
 * Uses TypeScript Compiler API to parse AST and extract import statements,
 * including default, named, and namespace imports with caching for performance.
 */

import * as ts from 'typescript';

/**
 * Represents a single import binding (what is being imported)
 */
export interface ImportBinding {
  /** The local name used in the importing file */
  name: string;
  /** The original name in the exported module (for aliased imports) */
  propertyName?: string;
  /** Whether this is a type-only import */
  isTypeOnly: boolean;
}

/**
 * Represents different types of imports
 */
export enum ImportType {
  /** Default import: import Foo from 'module' */
  DEFAULT = 'default',
  /** Named imports: import { a, b } from 'module' */
  NAMED = 'named',
  /** Namespace import: import * as foo from 'module' */
  NAMESPACE = 'namespace',
  /** Side-effect only: import 'module' */
  SIDE_EFFECT = 'side_effect'
}

/**
 * Represents a single import statement
 */
export interface ImportStatement {
  /** The module specifier (path/package name) */
  moduleSpecifier: string;
  /** Type of import */
  type: ImportType;
  /** Import bindings (names being imported) */
  bindings: ImportBinding[];
  /** Whether the entire import is type-only */
  isTypeOnly: boolean;
  /** Line number where import appears */
  line: number;
  /** Original import text */
  text: string;
}

/**
 * Result of import extraction
 */
export interface ImportExtractionResult {
  /** All extracted imports */
  imports: ImportStatement[];
  /** Count of imports by type */
  stats: {
    total: number;
    default: number;
    named: number;
    namespace: number;
    sideEffect: number;
    typeOnly: number;
  };
  /** External packages (from node_modules) */
  externalPackages: string[];
  /** Relative/internal imports */
  internalImports: string[];
  /** Any errors encountered during parsing */
  errors: string[];
}

/**
 * Options for ImportExtractor
 */
export interface ImportExtractorOptions {
  /** Enable caching (default: true) */
  enableCache?: boolean;
  /** Cache TTL in milliseconds (default: 1 hour) */
  cacheTtl?: number;
  /** Maximum cache size (default: 1000 entries) */
  maxCacheSize?: number;
  /** Include side-effect imports (default: true) */
  includeSideEffects?: boolean;
  /** Include type-only imports (default: true) */
  includeTypeOnlyImports?: boolean;
}

/**
 * Cache entry for import extraction results
 */
interface CacheEntry {
  result: ImportExtractionResult;
  timestamp: number;
  hash: string;
}

/**
 * ImportExtractor class for extracting import statements from TypeScript/JavaScript code
 */
export class ImportExtractor {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly options: Required<ImportExtractorOptions>;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(options: ImportExtractorOptions = {}) {
    this.options = {
      enableCache: options.enableCache ?? true,
      cacheTtl: options.cacheTtl ?? 60 * 60 * 1000, // 1 hour
      maxCacheSize: options.maxCacheSize ?? 1000,
      includeSideEffects: options.includeSideEffects ?? true,
      includeTypeOnlyImports: options.includeTypeOnlyImports ?? true
    };
  }

  /**
   * Extract imports from TypeScript/JavaScript source code
   */
  extract(sourceCode: string, fileName: string = 'file.ts'): ImportExtractionResult {
    // Check cache first
    if (this.options.enableCache) {
      const cached = this.getCached(sourceCode);
      if (cached) {
        this.cacheHits++;
        return cached;
      }
      this.cacheMisses++;
    }

    const result = this.performExtraction(sourceCode, fileName);

    // Cache the result
    if (this.options.enableCache) {
      this.cacheResult(sourceCode, result);
    }

    return result;
  }

  /**
   * Perform the actual import extraction
   */
  private performExtraction(sourceCode: string, fileName: string): ImportExtractionResult {
    const imports: ImportStatement[] = [];
    const errors: string[] = [];
    const externalPackages = new Set<string>();
    const internalImports: string[] = [];

    try {
      // Create a source file using TypeScript compiler API
      const sourceFile = ts.createSourceFile(
        fileName,
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );

      // Visit all nodes in the AST
      const visit = (node: ts.Node) => {
        if (ts.isImportDeclaration(node)) {
          const importStatement = this.extractImportDeclaration(node, sourceFile);

          // Filter based on options
          if (importStatement.type === ImportType.SIDE_EFFECT && !this.options.includeSideEffects) {
            return;
          }
          if (importStatement.isTypeOnly && !this.options.includeTypeOnlyImports) {
            return;
          }

          imports.push(importStatement);

          // Categorize as external or internal
          if (this.isExternalImport(importStatement.moduleSpecifier)) {
            externalPackages.add(this.getPackageName(importStatement.moduleSpecifier));
          } else {
            internalImports.push(importStatement.moduleSpecifier);
          }
        }

        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
    } catch (error) {
      errors.push(`Failed to parse source code: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Calculate statistics
    const stats = {
      total: imports.length,
      default: imports.filter(i => i.type === ImportType.DEFAULT).length,
      named: imports.filter(i => i.type === ImportType.NAMED).length,
      namespace: imports.filter(i => i.type === ImportType.NAMESPACE).length,
      sideEffect: imports.filter(i => i.type === ImportType.SIDE_EFFECT).length,
      typeOnly: imports.filter(i => i.isTypeOnly).length
    };

    return {
      imports,
      stats,
      externalPackages: Array.from(externalPackages).sort(),
      internalImports: internalImports.sort(),
      errors
    };
  }

  /**
   * Extract information from an import declaration node
   */
  private extractImportDeclaration(
    node: ts.ImportDeclaration,
    sourceFile: ts.SourceFile
  ): ImportStatement {
    const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;
    const isTypeOnly = node.importClause?.isTypeOnly ?? false;
    const bindings: ImportBinding[] = [];
    let type: ImportType = ImportType.SIDE_EFFECT;

    if (node.importClause) {
      const { name, namedBindings } = node.importClause;

      // Default import
      if (name) {
        type = ImportType.DEFAULT;
        bindings.push({
          name: name.text,
          isTypeOnly
        });
      }

      // Named or namespace imports
      if (namedBindings) {
        if (ts.isNamespaceImport(namedBindings)) {
          // Namespace import: import * as foo from 'module'
          type = ImportType.NAMESPACE;
          bindings.push({
            name: namedBindings.name.text,
            isTypeOnly
          });
        } else if (ts.isNamedImports(namedBindings)) {
          // Named imports: import { a, b as c } from 'module'
          type = ImportType.NAMED;
          namedBindings.elements.forEach(element => {
            bindings.push({
              name: element.name.text,
              propertyName: element.propertyName?.text,
              isTypeOnly: element.isTypeOnly || isTypeOnly
            });
          });
        }
      }
    }

    // Get line number
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    // Get the original text
    const text = node.getText(sourceFile);

    return {
      moduleSpecifier,
      type,
      bindings,
      isTypeOnly,
      line: line + 1, // Convert to 1-based line numbers
      text
    };
  }

  /**
   * Determine if an import is external (from node_modules)
   */
  private isExternalImport(moduleSpecifier: string): boolean {
    // External imports don't start with './', '../', or '/'
    return !moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/');
  }

  /**
   * Extract package name from module specifier
   */
  private getPackageName(moduleSpecifier: string): string {
    // Handle scoped packages (@org/package)
    if (moduleSpecifier.startsWith('@')) {
      const parts = moduleSpecifier.split('/');
      return parts.slice(0, 2).join('/');
    }

    // Handle regular packages (package/subpath -> package)
    const parts = moduleSpecifier.split('/');
    return parts[0];
  }

  /**
   * Generate a hash for cache key
   */
  private hashCode(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `${hash}:${str.length}`;
  }

  /**
   * Get cached result if available and valid
   */
  private getCached(sourceCode: string): ImportExtractionResult | null {
    const hash = this.hashCode(sourceCode);
    const entry = this.cache.get(hash);

    if (!entry) {
      return null;
    }

    // Check if cache entry is still valid
    if (Date.now() - entry.timestamp > this.options.cacheTtl) {
      this.cache.delete(hash);
      return null;
    }

    return entry.result;
  }

  /**
   * Cache extraction result
   */
  private cacheResult(sourceCode: string, result: ImportExtractionResult): void {
    const hash = this.hashCode(sourceCode);

    // Evict old entries if cache is full
    if (this.cache.size >= this.options.maxCacheSize) {
      this.evictOldest();
    }

    this.cache.set(hash, {
      result,
      timestamp: Date.now(),
      hash
    });
  }

  /**
   * Evict oldest cache entries (20% of cache size)
   */
  private evictOldest(): void {
    const entriesToRemove = Math.floor(this.options.maxCacheSize * 0.2);
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { hits: number; misses: number; size: number; hitRate: number } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      size: this.cache.size,
      hitRate: total > 0 ? this.cacheHits / total : 0
    };
  }

  /**
   * Extract imports from a file path
   */
  async extractFromFile(filePath: string): Promise<ImportExtractionResult> {
    const fs = await import('fs/promises');
    try {
      const sourceCode = await fs.readFile(filePath, 'utf-8');
      return this.extract(sourceCode, filePath);
    } catch (error) {
      return {
        imports: [],
        stats: {
          total: 0,
          default: 0,
          named: 0,
          namespace: 0,
          sideEffect: 0,
          typeOnly: 0
        },
        externalPackages: [],
        internalImports: [],
        errors: [`Failed to read file: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }
}

/**
 * Factory function to create an ImportExtractor instance
 */
export function createImportExtractor(options?: ImportExtractorOptions): ImportExtractor {
  return new ImportExtractor(options);
}
