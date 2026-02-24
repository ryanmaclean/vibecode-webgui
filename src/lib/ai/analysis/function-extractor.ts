/**
 * FunctionExtractor - Extract function signatures from TypeScript/JavaScript files
 *
 * Uses TypeScript Compiler API to parse AST and extract function declarations,
 * arrow functions, and class methods with caching for performance.
 */

import * as ts from 'typescript';

/**
 * Represents a function parameter
 */
export interface FunctionParameter {
  /** Name of the parameter */
  name: string;
  /** Type annotation if present */
  type?: string;
  /** Whether the parameter is optional */
  optional: boolean;
  /** Whether the parameter is a rest parameter */
  isRest: boolean;
  /** Default value if present */
  defaultValue?: string;
}

/**
 * Represents different kinds of function definitions
 */
export enum FunctionKind {
  /** Regular function declaration */
  FUNCTION = 'function',
  /** Arrow function */
  ARROW_FUNCTION = 'arrow_function',
  /** Class method */
  METHOD = 'method',
  /** Class constructor */
  CONSTRUCTOR = 'constructor',
  /** Function expression */
  FUNCTION_EXPRESSION = 'function_expression'
}

/**
 * Represents a single function signature
 */
export interface FunctionSignature {
  /** Name of the function */
  name: string;
  /** Kind of function */
  kind: FunctionKind;
  /** Function parameters */
  parameters: FunctionParameter[];
  /** Return type annotation if present */
  returnType?: string;
  /** Whether the function is async */
  isAsync: boolean;
  /** Whether the function is a generator */
  isGenerator: boolean;
  /** Whether the function is exported */
  isExported: boolean;
  /** Whether the function is default exported */
  isDefaultExport: boolean;
  /** Type parameters (generics) */
  typeParameters: string[];
  /** Parent class name (for methods) */
  parentClass?: string;
  /** Visibility modifier (for methods) */
  visibility?: 'public' | 'private' | 'protected';
  /** Whether the method is static */
  isStatic?: boolean;
  /** Line number where function appears */
  line: number;
  /** Original function signature text */
  text: string;
  /** JSDoc comment if present */
  documentation?: string;
}

/**
 * Result of function extraction
 */
export interface FunctionExtractionResult {
  /** All extracted function signatures */
  functions: FunctionSignature[];
  /** Count of functions by kind */
  stats: {
    total: number;
    functions: number;
    arrowFunctions: number;
    methods: number;
    constructors: number;
    functionExpressions: number;
    async: number;
    exported: number;
  };
  /** Names of all exported functions */
  exportedFunctions: string[];
  /** Any errors encountered during parsing */
  errors: string[];
}

/**
 * Options for FunctionExtractor
 */
export interface FunctionExtractorOptions {
  /** Enable caching (default: true) */
  enableCache?: boolean;
  /** Cache TTL in milliseconds (default: 1 hour) */
  cacheTtl?: number;
  /** Maximum cache size (default: 1000 entries) */
  maxCacheSize?: number;
  /** Include non-exported functions (default: true) */
  includeNonExported?: boolean;
  /** Include arrow functions (default: true) */
  includeArrowFunctions?: boolean;
  /** Include class methods (default: true) */
  includeMethods?: boolean;
}

/**
 * Cache entry for function extraction results
 */
interface CacheEntry {
  result: FunctionExtractionResult;
  timestamp: number;
  hash: string;
}

/**
 * FunctionExtractor class for extracting function signatures from TypeScript/JavaScript code
 */
export class FunctionExtractor {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly options: Required<FunctionExtractorOptions>;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(options: FunctionExtractorOptions = {}) {
    this.options = {
      enableCache: options.enableCache ?? true,
      cacheTtl: options.cacheTtl ?? 60 * 60 * 1000, // 1 hour
      maxCacheSize: options.maxCacheSize ?? 1000,
      includeNonExported: options.includeNonExported ?? true,
      includeArrowFunctions: options.includeArrowFunctions ?? true,
      includeMethods: options.includeMethods ?? true
    };
  }

  /**
   * Extract function signatures from TypeScript/JavaScript source code
   */
  extract(sourceCode: string, fileName: string = 'file.ts'): FunctionExtractionResult {
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
   * Perform the actual function extraction
   */
  private performExtraction(sourceCode: string, fileName: string): FunctionExtractionResult {
    const functions: FunctionSignature[] = [];
    const errors: string[] = [];
    const exportedFunctions = new Set<string>();
    let currentClass: string | undefined;

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
        let functionSignature: FunctionSignature | null = null;

        // Track class context for methods
        if (ts.isClassDeclaration(node)) {
          const previousClass = currentClass;
          currentClass = node.name?.text;
          ts.forEachChild(node, visit);
          currentClass = previousClass;
          return;
        }

        if (ts.isFunctionDeclaration(node)) {
          functionSignature = this.extractFunctionDeclaration(node, sourceFile);
        } else if (ts.isArrowFunction(node) && this.options.includeArrowFunctions) {
          functionSignature = this.extractArrowFunction(node, sourceFile);
        } else if (ts.isMethodDeclaration(node) && this.options.includeMethods) {
          functionSignature = this.extractMethod(node, sourceFile, currentClass);
        } else if (ts.isConstructorDeclaration(node) && this.options.includeMethods) {
          functionSignature = this.extractConstructor(node, sourceFile, currentClass);
        } else if (ts.isVariableStatement(node)) {
          // Extract arrow functions from variable declarations
          if (this.options.includeArrowFunctions) {
            const extracted = this.extractFunctionFromVariableStatement(node, sourceFile);
            if (extracted) {
              functions.push(...extracted);
            }
          }
        }

        if (functionSignature) {
          // Filter based on options
          if (!functionSignature.isExported && !this.options.includeNonExported) {
            ts.forEachChild(node, visit);
            return;
          }

          functions.push(functionSignature);

          if (functionSignature.isExported) {
            exportedFunctions.add(functionSignature.name);
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
      total: functions.length,
      functions: functions.filter(f => f.kind === FunctionKind.FUNCTION).length,
      arrowFunctions: functions.filter(f => f.kind === FunctionKind.ARROW_FUNCTION).length,
      methods: functions.filter(f => f.kind === FunctionKind.METHOD).length,
      constructors: functions.filter(f => f.kind === FunctionKind.CONSTRUCTOR).length,
      functionExpressions: functions.filter(f => f.kind === FunctionKind.FUNCTION_EXPRESSION).length,
      async: functions.filter(f => f.isAsync).length,
      exported: functions.filter(f => f.isExported).length
    };

    return {
      functions,
      stats,
      exportedFunctions: Array.from(exportedFunctions).sort(),
      errors
    };
  }

  /**
   * Extract function declaration
   */
  private extractFunctionDeclaration(
    node: ts.FunctionDeclaration,
    sourceFile: ts.SourceFile
  ): FunctionSignature {
    const name = node.name?.text ?? 'anonymous';
    const isExported = this.isExported(node);
    const isDefaultExport = this.isDefaultExport(node);
    const parameters = this.extractParameters(node.parameters);
    const returnType = node.type?.getText(sourceFile);
    const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
    const isGenerator = !!node.asteriskToken;
    const typeParameters = this.extractTypeParameters(node.typeParameters);
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const text = this.getFunctionSignatureText(node, sourceFile);
    const documentation = this.extractDocumentation(node);

    return {
      name,
      kind: FunctionKind.FUNCTION,
      parameters,
      returnType,
      isAsync,
      isGenerator,
      isExported,
      isDefaultExport,
      typeParameters,
      line: line + 1,
      text,
      documentation
    };
  }

  /**
   * Extract arrow function
   */
  private extractArrowFunction(
    node: ts.ArrowFunction,
    sourceFile: ts.SourceFile
  ): FunctionSignature {
    const parameters = this.extractParameters(node.parameters);
    const returnType = node.type?.getText(sourceFile);
    const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
    const typeParameters = this.extractTypeParameters(node.typeParameters);
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const text = this.getFunctionSignatureText(node, sourceFile);

    return {
      name: 'anonymous',
      kind: FunctionKind.ARROW_FUNCTION,
      parameters,
      returnType,
      isAsync,
      isGenerator: false,
      isExported: false,
      isDefaultExport: false,
      typeParameters,
      line: line + 1,
      text,
      documentation: undefined
    };
  }

  /**
   * Extract method from class
   */
  private extractMethod(
    node: ts.MethodDeclaration,
    sourceFile: ts.SourceFile,
    parentClass?: string
  ): FunctionSignature {
    const name = node.name.getText(sourceFile);
    const parameters = this.extractParameters(node.parameters);
    const returnType = node.type?.getText(sourceFile);
    const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
    const isGenerator = !!node.asteriskToken;
    const typeParameters = this.extractTypeParameters(node.typeParameters);
    const visibility = this.getVisibility(node);
    const isStatic = node.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword) ?? false;
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const text = this.getFunctionSignatureText(node, sourceFile);
    const documentation = this.extractDocumentation(node);

    return {
      name,
      kind: FunctionKind.METHOD,
      parameters,
      returnType,
      isAsync,
      isGenerator,
      isExported: false, // Methods are part of class exports
      isDefaultExport: false,
      typeParameters,
      parentClass,
      visibility,
      isStatic,
      line: line + 1,
      text,
      documentation
    };
  }

  /**
   * Extract constructor
   */
  private extractConstructor(
    node: ts.ConstructorDeclaration,
    sourceFile: ts.SourceFile,
    parentClass?: string
  ): FunctionSignature {
    const parameters = this.extractParameters(node.parameters);
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const text = this.getFunctionSignatureText(node, sourceFile);
    const documentation = this.extractDocumentation(node);

    return {
      name: 'constructor',
      kind: FunctionKind.CONSTRUCTOR,
      parameters,
      returnType: undefined,
      isAsync: false,
      isGenerator: false,
      isExported: false,
      isDefaultExport: false,
      typeParameters: [],
      parentClass,
      visibility: 'public',
      line: line + 1,
      text,
      documentation
    };
  }

  /**
   * Extract function expressions from variable statements
   */
  private extractFunctionFromVariableStatement(
    node: ts.VariableStatement,
    sourceFile: ts.SourceFile
  ): FunctionSignature[] {
    const functions: FunctionSignature[] = [];
    const isExported = this.isExported(node);

    node.declarationList.declarations.forEach(declaration => {
      if (declaration.initializer) {
        if (ts.isArrowFunction(declaration.initializer)) {
          const name = declaration.name.getText(sourceFile);
          const arrowFunc = declaration.initializer;
          const parameters = this.extractParameters(arrowFunc.parameters);
          const returnType = arrowFunc.type?.getText(sourceFile);
          const isAsync = arrowFunc.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
          const typeParameters = this.extractTypeParameters(arrowFunc.typeParameters);
          const { line } = sourceFile.getLineAndCharacterOfPosition(declaration.getStart());
          const text = declaration.getText(sourceFile);

          functions.push({
            name,
            kind: FunctionKind.ARROW_FUNCTION,
            parameters,
            returnType,
            isAsync,
            isGenerator: false,
            isExported,
            isDefaultExport: false,
            typeParameters,
            line: line + 1,
            text,
            documentation: this.extractDocumentation(node)
          });
        } else if (ts.isFunctionExpression(declaration.initializer)) {
          const name = declaration.name.getText(sourceFile);
          const funcExpr = declaration.initializer;
          const parameters = this.extractParameters(funcExpr.parameters);
          const returnType = funcExpr.type?.getText(sourceFile);
          const isAsync = funcExpr.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
          const isGenerator = !!funcExpr.asteriskToken;
          const typeParameters = this.extractTypeParameters(funcExpr.typeParameters);
          const { line } = sourceFile.getLineAndCharacterOfPosition(declaration.getStart());
          const text = declaration.getText(sourceFile);

          functions.push({
            name,
            kind: FunctionKind.FUNCTION_EXPRESSION,
            parameters,
            returnType,
            isAsync,
            isGenerator,
            isExported,
            isDefaultExport: false,
            typeParameters,
            line: line + 1,
            text,
            documentation: this.extractDocumentation(node)
          });
        }
      }
    });

    return functions;
  }

  /**
   * Extract function parameters
   */
  private extractParameters(parameters: ts.NodeArray<ts.ParameterDeclaration>): FunctionParameter[] {
    return parameters.map(param => ({
      name: param.name.getText(),
      type: param.type?.getText(),
      optional: !!param.questionToken,
      isRest: !!param.dotDotDotToken,
      defaultValue: param.initializer?.getText()
    }));
  }

  /**
   * Extract type parameters (generics)
   */
  private extractTypeParameters(
    typeParameters?: ts.NodeArray<ts.TypeParameterDeclaration>
  ): string[] {
    if (!typeParameters) return [];
    return typeParameters.map(param => param.getText());
  }

  /**
   * Get visibility modifier for class members
   */
  private getVisibility(node: ts.MethodDeclaration): 'public' | 'private' | 'protected' {
    if (node.modifiers) {
      for (const modifier of node.modifiers) {
        if (modifier.kind === ts.SyntaxKind.PrivateKeyword) return 'private';
        if (modifier.kind === ts.SyntaxKind.ProtectedKeyword) return 'protected';
        if (modifier.kind === ts.SyntaxKind.PublicKeyword) return 'public';
      }
    }
    return 'public';
  }

  /**
   * Check if a node is exported
   */
  private isExported(node: ts.Node): boolean {
    if (!('modifiers' in node) || !node.modifiers) return false;
    const modifiers = node.modifiers as ts.NodeArray<ts.ModifierLike>;
    return modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
  }

  /**
   * Check if a node is default exported
   */
  private isDefaultExport(node: ts.Node): boolean {
    if (!('modifiers' in node) || !node.modifiers) return false;
    const modifiers = node.modifiers as ts.NodeArray<ts.ModifierLike>;
    return modifiers.some(m => m.kind === ts.SyntaxKind.DefaultKeyword);
  }

  /**
   * Extract JSDoc documentation
   */
  private extractDocumentation(node: ts.Node): string | undefined {
    const jsDocTags = (node as any).jsDoc;
    if (!jsDocTags || jsDocTags.length === 0) return undefined;

    const comment = jsDocTags[0].comment;
    if (typeof comment === 'string') {
      return comment;
    }
    return undefined;
  }

  /**
   * Get function signature text (without body)
   */
  private getFunctionSignatureText(node: ts.Node, sourceFile: ts.SourceFile): string {
    const fullText = node.getText(sourceFile);

    // For arrow functions and function expressions, try to extract just the signature
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      // Find the arrow or opening brace
      const arrowIndex = fullText.indexOf('=>');
      const braceIndex = fullText.indexOf('{');

      if (arrowIndex !== -1) {
        return fullText.substring(0, arrowIndex + 2).trim();
      }
      if (braceIndex !== -1) {
        return fullText.substring(0, braceIndex).trim();
      }
    }

    // For regular functions and methods, extract until opening brace
    const braceIndex = fullText.indexOf('{');
    if (braceIndex !== -1) {
      return fullText.substring(0, braceIndex).trim();
    }

    return fullText;
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
  private getCached(sourceCode: string): FunctionExtractionResult | null {
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
  private cacheResult(sourceCode: string, result: FunctionExtractionResult): void {
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
   * Extract function signatures from a file path
   */
  async extractFromFile(filePath: string): Promise<FunctionExtractionResult> {
    const fs = await import('fs/promises');
    try {
      const sourceCode = await fs.readFile(filePath, 'utf-8');
      return this.extract(sourceCode, filePath);
    } catch (error) {
      return {
        functions: [],
        stats: {
          total: 0,
          functions: 0,
          arrowFunctions: 0,
          methods: 0,
          constructors: 0,
          functionExpressions: 0,
          async: 0,
          exported: 0
        },
        exportedFunctions: [],
        errors: [`Failed to read file: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }
}

/**
 * Factory function to create a FunctionExtractor instance
 */
export function createFunctionExtractor(options?: FunctionExtractorOptions): FunctionExtractor {
  return new FunctionExtractor(options);
}
