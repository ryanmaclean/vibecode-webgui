/**
 * TypeExtractor - Extract type definitions from TypeScript files
 *
 * Uses TypeScript Compiler API to parse AST and extract interfaces, type aliases,
 * enums, and class definitions with caching for performance.
 */

import * as ts from 'typescript';

/**
 * Represents a type parameter (generic)
 */
export interface TypeParameter {
  /** Name of the type parameter */
  name: string;
  /** Constraint on the type parameter */
  constraint?: string;
  /** Default type for the parameter */
  default?: string;
}

/**
 * Represents a property or member of a type
 */
export interface TypeMember {
  /** Name of the member */
  name: string;
  /** Type annotation of the member */
  type: string;
  /** Whether the member is optional */
  optional: boolean;
  /** Whether the member is readonly */
  readonly: boolean;
  /** JSDoc comment if present */
  documentation?: string;
}

/**
 * Represents different kinds of type definitions
 */
export enum TypeDefinitionKind {
  /** Interface declaration */
  INTERFACE = 'interface',
  /** Type alias */
  TYPE_ALIAS = 'type_alias',
  /** Enum declaration */
  ENUM = 'enum',
  /** Class declaration */
  CLASS = 'class'
}

/**
 * Represents a single type definition
 */
export interface TypeDefinition {
  /** Name of the type */
  name: string;
  /** Kind of type definition */
  kind: TypeDefinitionKind;
  /** Type parameters (generics) */
  typeParameters: TypeParameter[];
  /** Members/properties of the type */
  members: TypeMember[];
  /** Whether the type is exported */
  isExported: boolean;
  /** Whether the type is default exported */
  isDefaultExport: boolean;
  /** Heritage clause (extends/implements) */
  heritage: string[];
  /** Line number where type appears */
  line: number;
  /** Original type definition text */
  text: string;
  /** JSDoc comment if present */
  documentation?: string;
}

/**
 * Result of type extraction
 */
export interface TypeExtractionResult {
  /** All extracted type definitions */
  types: TypeDefinition[];
  /** Count of types by kind */
  stats: {
    total: number;
    interfaces: number;
    typeAliases: number;
    enums: number;
    classes: number;
    exported: number;
  };
  /** Names of all exported types */
  exportedTypes: string[];
  /** Any errors encountered during parsing */
  errors: string[];
}

/**
 * Options for TypeExtractor
 */
export interface TypeExtractorOptions {
  /** Enable caching (default: true) */
  enableCache?: boolean;
  /** Cache TTL in milliseconds (default: 1 hour) */
  cacheTtl?: number;
  /** Maximum cache size (default: 1000 entries) */
  maxCacheSize?: number;
  /** Include non-exported types (default: true) */
  includeNonExported?: boolean;
  /** Include member details (default: true) */
  includeMemberDetails?: boolean;
}

/**
 * Cache entry for type extraction results
 */
interface CacheEntry {
  result: TypeExtractionResult;
  timestamp: number;
  hash: string;
}

/**
 * TypeExtractor class for extracting type definitions from TypeScript code
 */
export class TypeExtractor {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly options: Required<TypeExtractorOptions>;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(options: TypeExtractorOptions = {}) {
    this.options = {
      enableCache: options.enableCache ?? true,
      cacheTtl: options.cacheTtl ?? 60 * 60 * 1000, // 1 hour
      maxCacheSize: options.maxCacheSize ?? 1000,
      includeNonExported: options.includeNonExported ?? true,
      includeMemberDetails: options.includeMemberDetails ?? true
    };
  }

  /**
   * Extract type definitions from TypeScript source code
   */
  extract(sourceCode: string, fileName: string = 'file.ts'): TypeExtractionResult {
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
   * Perform the actual type extraction
   */
  private performExtraction(sourceCode: string, fileName: string): TypeExtractionResult {
    const types: TypeDefinition[] = [];
    const errors: string[] = [];
    const exportedTypes = new Set<string>();

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
        let typeDefinition: TypeDefinition | null = null;

        if (ts.isInterfaceDeclaration(node)) {
          typeDefinition = this.extractInterface(node, sourceFile);
        } else if (ts.isTypeAliasDeclaration(node)) {
          typeDefinition = this.extractTypeAlias(node, sourceFile);
        } else if (ts.isEnumDeclaration(node)) {
          typeDefinition = this.extractEnum(node, sourceFile);
        } else if (ts.isClassDeclaration(node)) {
          typeDefinition = this.extractClass(node, sourceFile);
        }

        if (typeDefinition) {
          // Filter based on options
          if (!typeDefinition.isExported && !this.options.includeNonExported) {
            return;
          }

          types.push(typeDefinition);

          if (typeDefinition.isExported) {
            exportedTypes.add(typeDefinition.name);
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
      total: types.length,
      interfaces: types.filter(t => t.kind === TypeDefinitionKind.INTERFACE).length,
      typeAliases: types.filter(t => t.kind === TypeDefinitionKind.TYPE_ALIAS).length,
      enums: types.filter(t => t.kind === TypeDefinitionKind.ENUM).length,
      classes: types.filter(t => t.kind === TypeDefinitionKind.CLASS).length,
      exported: types.filter(t => t.isExported).length
    };

    return {
      types,
      stats,
      exportedTypes: Array.from(exportedTypes).sort(),
      errors
    };
  }

  /**
   * Extract interface declaration
   */
  private extractInterface(
    node: ts.InterfaceDeclaration,
    sourceFile: ts.SourceFile
  ): TypeDefinition {
    const name = node.name.text;
    const isExported = this.isExported(node);
    const isDefaultExport = this.isDefaultExport(node);
    const typeParameters = this.extractTypeParameters(node.typeParameters);
    const heritage = this.extractHeritage(node.heritageClauses);
    const members = this.options.includeMemberDetails
      ? this.extractInterfaceMembers(node.members)
      : [];
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const text = node.getText(sourceFile);
    const documentation = this.extractDocumentation(node);

    return {
      name,
      kind: TypeDefinitionKind.INTERFACE,
      typeParameters,
      members,
      isExported,
      isDefaultExport,
      heritage,
      line: line + 1,
      text,
      documentation
    };
  }

  /**
   * Extract type alias declaration
   */
  private extractTypeAlias(
    node: ts.TypeAliasDeclaration,
    sourceFile: ts.SourceFile
  ): TypeDefinition {
    const name = node.name.text;
    const isExported = this.isExported(node);
    const isDefaultExport = this.isDefaultExport(node);
    const typeParameters = this.extractTypeParameters(node.typeParameters);
    const members = this.options.includeMemberDetails
      ? this.extractTypeAliasMembers(node.type)
      : [];
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const text = node.getText(sourceFile);
    const documentation = this.extractDocumentation(node);

    return {
      name,
      kind: TypeDefinitionKind.TYPE_ALIAS,
      typeParameters,
      members,
      isExported,
      isDefaultExport,
      heritage: [],
      line: line + 1,
      text,
      documentation
    };
  }

  /**
   * Extract enum declaration
   */
  private extractEnum(
    node: ts.EnumDeclaration,
    sourceFile: ts.SourceFile
  ): TypeDefinition {
    const name = node.name.text;
    const isExported = this.isExported(node);
    const isDefaultExport = this.isDefaultExport(node);
    const members = this.options.includeMemberDetails
      ? this.extractEnumMembers(node.members)
      : [];
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const text = node.getText(sourceFile);
    const documentation = this.extractDocumentation(node);

    return {
      name,
      kind: TypeDefinitionKind.ENUM,
      typeParameters: [],
      members,
      isExported,
      isDefaultExport,
      heritage: [],
      line: line + 1,
      text,
      documentation
    };
  }

  /**
   * Extract class declaration
   */
  private extractClass(
    node: ts.ClassDeclaration,
    sourceFile: ts.SourceFile
  ): TypeDefinition {
    const name = node.name?.text ?? 'AnonymousClass';
    const isExported = this.isExported(node);
    const isDefaultExport = this.isDefaultExport(node);
    const typeParameters = this.extractTypeParameters(node.typeParameters);
    const heritage = this.extractHeritage(node.heritageClauses);
    const members = this.options.includeMemberDetails
      ? this.extractClassMembers(node.members)
      : [];
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const text = node.getText(sourceFile);
    const documentation = this.extractDocumentation(node);

    return {
      name,
      kind: TypeDefinitionKind.CLASS,
      typeParameters,
      members,
      isExported,
      isDefaultExport,
      heritage,
      line: line + 1,
      text,
      documentation
    };
  }

  /**
   * Extract type parameters (generics)
   */
  private extractTypeParameters(
    typeParameters?: ts.NodeArray<ts.TypeParameterDeclaration>
  ): TypeParameter[] {
    if (!typeParameters) return [];

    return typeParameters.map(param => ({
      name: param.name.text,
      constraint: param.constraint?.getText(),
      default: param.default?.getText()
    }));
  }

  /**
   * Extract heritage clauses (extends/implements)
   */
  private extractHeritage(
    heritageClauses?: ts.NodeArray<ts.HeritageClause>
  ): string[] {
    if (!heritageClauses) return [];

    const heritage: string[] = [];
    heritageClauses.forEach(clause => {
      clause.types.forEach(type => {
        heritage.push(type.getText());
      });
    });

    return heritage;
  }

  /**
   * Extract interface members
   */
  private extractInterfaceMembers(
    members: ts.NodeArray<ts.TypeElement>
  ): TypeMember[] {
    return members
      .filter(ts.isPropertySignature)
      .map(member => ({
        name: member.name?.getText() ?? 'unknown',
        type: member.type?.getText() ?? 'any',
        optional: !!member.questionToken,
        readonly: member.modifiers?.some(m => m.kind === ts.SyntaxKind.ReadonlyKeyword) ?? false,
        documentation: this.extractDocumentation(member)
      }));
  }

  /**
   * Extract type alias members (for object types)
   */
  private extractTypeAliasMembers(type: ts.TypeNode): TypeMember[] {
    if (ts.isTypeLiteralNode(type)) {
      return this.extractInterfaceMembers(type.members);
    }
    return [];
  }

  /**
   * Extract enum members
   */
  private extractEnumMembers(
    members: ts.NodeArray<ts.EnumMember>
  ): TypeMember[] {
    return members.map(member => ({
      name: member.name.getText(),
      type: member.initializer?.getText() ?? 'number',
      optional: false,
      readonly: true,
      documentation: this.extractDocumentation(member)
    }));
  }

  /**
   * Extract class members (properties and methods)
   */
  private extractClassMembers(
    members: ts.NodeArray<ts.ClassElement>
  ): TypeMember[] {
    return members
      .filter(member => ts.isPropertyDeclaration(member) || ts.isMethodDeclaration(member))
      .map(member => {
        const name = member.name?.getText() ?? 'unknown';
        let type = 'any';

        if (ts.isPropertyDeclaration(member) && member.type) {
          type = member.type.getText();
        } else if (ts.isMethodDeclaration(member)) {
          const params = member.parameters.map(p => {
            const paramName = p.name.getText();
            const paramType = p.type?.getText() ?? 'any';
            return `${paramName}: ${paramType}`;
          }).join(', ');
          const returnType = member.type?.getText() ?? 'void';
          type = `(${params}) => ${returnType}`;
        }

        return {
          name,
          type,
          optional: ts.isPropertyDeclaration(member) && !!member.questionToken,
          readonly: member.modifiers?.some(m => m.kind === ts.SyntaxKind.ReadonlyKeyword) ?? false,
          documentation: this.extractDocumentation(member)
        };
      });
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
  private getCached(sourceCode: string): TypeExtractionResult | null {
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
  private cacheResult(sourceCode: string, result: TypeExtractionResult): void {
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
   * Extract type definitions from a file path
   */
  async extractFromFile(filePath: string): Promise<TypeExtractionResult> {
    const fs = await import('fs/promises');
    try {
      const sourceCode = await fs.readFile(filePath, 'utf-8');
      return this.extract(sourceCode, filePath);
    } catch (error) {
      return {
        types: [],
        stats: {
          total: 0,
          interfaces: 0,
          typeAliases: 0,
          enums: 0,
          classes: 0,
          exported: 0
        },
        exportedTypes: [],
        errors: [`Failed to read file: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }
}

/**
 * Factory function to create a TypeExtractor instance
 */
export function createTypeExtractor(options?: TypeExtractorOptions): TypeExtractor {
  return new TypeExtractor(options);
}
