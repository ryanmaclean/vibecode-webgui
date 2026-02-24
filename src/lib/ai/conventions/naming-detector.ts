/**
 * NamingDetector - Detect naming conventions from TypeScript/JavaScript code
 *
 * Uses TypeScript Compiler API to parse AST and analyze naming patterns for
 * variables, functions, classes, interfaces, and files with caching for performance.
 */

import * as ts from 'typescript';

/**
 * Represents different naming case styles
 */
export enum NamingCase {
  /** camelCase - first word lowercase, rest capitalized */
  CAMEL_CASE = 'camelCase',
  /** PascalCase - all words capitalized */
  PASCAL_CASE = 'PascalCase',
  /** snake_case - all lowercase with underscores */
  SNAKE_CASE = 'snake_case',
  /** SCREAMING_SNAKE_CASE - all uppercase with underscores */
  SCREAMING_SNAKE_CASE = 'SCREAMING_SNAKE_CASE',
  /** kebab-case - all lowercase with hyphens */
  KEBAB_CASE = 'kebab-case',
  /** UPPER-KEBAB-CASE - all uppercase with hyphens */
  UPPER_KEBAB_CASE = 'UPPER-KEBAB-CASE',
  /** Mixed or unknown case */
  MIXED = 'mixed'
}

/**
 * Represents a naming pattern for a specific element type
 */
export interface NamingPattern {
  /** The naming case style */
  case: NamingCase;
  /** Common prefixes found (e.g., 'get', 'set', 'is', 'has') */
  prefixes: string[];
  /** Common suffixes found (e.g., 'Service', 'Controller', 'Interface') */
  suffixes: string[];
  /** Example names following this pattern */
  examples: string[];
  /** Confidence score (0-1) based on consistency */
  confidence: number;
  /** Number of elements analyzed */
  count: number;
}

/**
 * Represents naming conventions for different element types
 */
export interface NamingConventions {
  /** Variable naming patterns */
  variables: {
    regular: NamingPattern;
    constants: NamingPattern;
    private: NamingPattern;
  };
  /** Function naming patterns */
  functions: {
    regular: NamingPattern;
    async: NamingPattern;
    methods: NamingPattern;
    private: NamingPattern;
  };
  /** Class naming patterns */
  classes: {
    regular: NamingPattern;
    abstract: NamingPattern;
    interfaces: NamingPattern;
    types: NamingPattern;
    enums: NamingPattern;
  };
  /** File naming patterns */
  files: {
    components: NamingPattern;
    utilities: NamingPattern;
    tests: NamingPattern;
    configs: NamingPattern;
  };
}

/**
 * Result of naming convention detection
 */
export interface NamingDetectionResult {
  /** Detected naming conventions */
  conventions: NamingConventions;
  /** Overall statistics */
  stats: {
    totalElements: number;
    uniquePatterns: number;
    overallConsistency: number;
  };
  /** Common patterns across all elements */
  commonPatterns: {
    /** Most common prefixes across all elements */
    prefixes: { prefix: string; count: number }[];
    /** Most common suffixes across all elements */
    suffixes: { suffix: string; count: number }[];
    /** Most common case styles */
    caseStyles: { case: NamingCase; count: number }[];
  };
  /** Potential inconsistencies or violations */
  inconsistencies: {
    element: string;
    expectedCase: NamingCase;
    actualCase: NamingCase;
    suggestion: string;
  }[];
  /** Any errors encountered during analysis */
  errors: string[];
}

/**
 * Options for NamingDetector
 */
export interface NamingDetectorOptions {
  /** Enable caching (default: true) */
  enableCache?: boolean;
  /** Cache TTL in milliseconds (default: 1 hour) */
  cacheTtl?: number;
  /** Maximum cache size (default: 1000 entries) */
  maxCacheSize?: number;
  /** Minimum confidence threshold for patterns (0-1, default: 0.7) */
  minConfidence?: number;
  /** Include private members in analysis (default: true) */
  includePrivate?: boolean;
  /** Detect inconsistencies (default: true) */
  detectInconsistencies?: boolean;
}

/**
 * Cache entry for naming detection results
 */
interface CacheEntry {
  result: NamingDetectionResult;
  timestamp: number;
  hash: string;
}

/**
 * Helper to analyze naming elements
 */
interface NamingElement {
  name: string;
  type: 'variable' | 'constant' | 'function' | 'method' | 'class' | 'interface' | 'type' | 'enum';
  isPrivate: boolean;
  isAsync?: boolean;
  isAbstract?: boolean;
  line: number;
}

/**
 * NamingDetector class for detecting naming conventions
 */
export class NamingDetector {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly options: Required<NamingDetectorOptions>;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(options: NamingDetectorOptions = {}) {
    this.options = {
      enableCache: options.enableCache ?? true,
      cacheTtl: options.cacheTtl ?? 60 * 60 * 1000, // 1 hour
      maxCacheSize: options.maxCacheSize ?? 1000,
      minConfidence: options.minConfidence ?? 0.7,
      includePrivate: options.includePrivate ?? true,
      detectInconsistencies: options.detectInconsistencies ?? true
    };
  }

  /**
   * Detect naming conventions from TypeScript source code
   */
  detect(sourceCode: string, fileName: string = 'file.ts'): NamingDetectionResult {
    // Check cache first
    if (this.options.enableCache) {
      const cached = this.getCached(sourceCode);
      if (cached) {
        this.cacheHits++;
        return cached;
      }
      this.cacheMisses++;
    }

    const result = this.performDetection(sourceCode, fileName);

    // Cache the result
    if (this.options.enableCache) {
      this.cacheResult(sourceCode, result);
    }

    return result;
  }

  /**
   * Perform the actual naming convention detection
   */
  private performDetection(sourceCode: string, fileName: string): NamingDetectionResult {
    const elements: NamingElement[] = [];
    const errors: string[] = [];

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
        try {
          // Extract variables
          if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
            const isConst = this.isConstVariable(node);
            elements.push({
              name: node.name.text,
              type: isConst ? 'constant' : 'variable',
              isPrivate: this.isPrivate(node.name.text),
              line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
            });
          }

          // Extract functions
          if (ts.isFunctionDeclaration(node) && node.name) {
            elements.push({
              name: node.name.text,
              type: 'function',
              isPrivate: this.isPrivate(node.name.text),
              isAsync: !!(node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)),
              line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
            });
          }

          // Extract classes
          if (ts.isClassDeclaration(node) && node.name) {
            elements.push({
              name: node.name.text,
              type: 'class',
              isPrivate: false,
              isAbstract: !!(node.modifiers?.some(m => m.kind === ts.SyntaxKind.AbstractKeyword)),
              line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
            });

            // Extract methods
            node.members.forEach(member => {
              if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
                elements.push({
                  name: member.name.text,
                  type: 'method',
                  isPrivate: this.hasPrivateModifier(member),
                  isAsync: !!(member.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)),
                  line: sourceFile.getLineAndCharacterOfPosition(member.getStart()).line + 1
                });
              }
            });
          }

          // Extract interfaces
          if (ts.isInterfaceDeclaration(node)) {
            elements.push({
              name: node.name.text,
              type: 'interface',
              isPrivate: false,
              line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
            });
          }

          // Extract type aliases
          if (ts.isTypeAliasDeclaration(node)) {
            elements.push({
              name: node.name.text,
              type: 'type',
              isPrivate: false,
              line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
            });
          }

          // Extract enums
          if (ts.isEnumDeclaration(node)) {
            elements.push({
              name: node.name.text,
              type: 'enum',
              isPrivate: false,
              line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
            });
          }

          ts.forEachChild(node, visit);
        } catch (error) {
          errors.push(`Error processing node: ${error instanceof Error ? error.message : String(error)}`);
        }
      };

      visit(sourceFile);
    } catch (error) {
      errors.push(`Error parsing source: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Filter based on options
    const filteredElements = this.options.includePrivate
      ? elements
      : elements.filter(e => !e.isPrivate);

    // Analyze patterns
    return this.analyzePatterns(filteredElements, fileName, errors);
  }

  /**
   * Analyze naming patterns from collected elements
   */
  private analyzePatterns(elements: NamingElement[], fileName: string, errors: string[]): NamingDetectionResult {
    // Group elements by type
    const variables = elements.filter(e => e.type === 'variable');
    const constants = elements.filter(e => e.type === 'constant');
    const privateVars = elements.filter(e => (e.type === 'variable' || e.type === 'constant') && e.isPrivate);
    const functions = elements.filter(e => e.type === 'function' && !e.isAsync);
    const asyncFunctions = elements.filter(e => e.type === 'function' && e.isAsync);
    const methods = elements.filter(e => e.type === 'method' && !e.isPrivate);
    const privateMethods = elements.filter(e => e.type === 'method' && e.isPrivate);
    const classes = elements.filter(e => e.type === 'class' && !e.isAbstract);
    const abstractClasses = elements.filter(e => e.type === 'class' && e.isAbstract);
    const interfaces = elements.filter(e => e.type === 'interface');
    const types = elements.filter(e => e.type === 'type');
    const enums = elements.filter(e => e.type === 'enum');

    // Analyze file naming
    const filePatterns = this.analyzeFileName(fileName);

    // Build conventions
    const conventions: NamingConventions = {
      variables: {
        regular: this.buildPattern(variables),
        constants: this.buildPattern(constants),
        private: this.buildPattern(privateVars)
      },
      functions: {
        regular: this.buildPattern(functions),
        async: this.buildPattern(asyncFunctions),
        methods: this.buildPattern(methods),
        private: this.buildPattern(privateMethods)
      },
      classes: {
        regular: this.buildPattern(classes),
        abstract: this.buildPattern(abstractClasses),
        interfaces: this.buildPattern(interfaces),
        types: this.buildPattern(types),
        enums: this.buildPattern(enums)
      },
      files: filePatterns
    };

    // Collect common patterns
    const allPrefixes = new Map<string, number>();
    const allSuffixes = new Map<string, number>();
    const allCaseStyles = new Map<NamingCase, number>();

    const updateCommonPatterns = (pattern: NamingPattern) => {
      pattern.prefixes.forEach(p => allPrefixes.set(p, (allPrefixes.get(p) || 0) + 1));
      pattern.suffixes.forEach(s => allSuffixes.set(s, (allSuffixes.get(s) || 0) + 1));
      allCaseStyles.set(pattern.case, (allCaseStyles.get(pattern.case) || 0) + pattern.count);
    };

    Object.values(conventions.variables).forEach(updateCommonPatterns);
    Object.values(conventions.functions).forEach(updateCommonPatterns);
    Object.values(conventions.classes).forEach(updateCommonPatterns);

    const commonPatterns = {
      prefixes: Array.from(allPrefixes.entries())
        .map(([prefix, count]) => ({ prefix, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      suffixes: Array.from(allSuffixes.entries())
        .map(([suffix, count]) => ({ suffix, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      caseStyles: Array.from(allCaseStyles.entries())
        .map(([caseStyle, count]) => ({ case: caseStyle, count }))
        .sort((a, b) => b.count - a.count)
    };

    // Detect inconsistencies
    const inconsistencies = this.options.detectInconsistencies
      ? this.detectInconsistencies(elements, conventions)
      : [];

    // Calculate overall statistics
    const totalElements = elements.length;
    const uniquePatterns = new Set([
      ...Object.values(conventions.variables).map(p => p.case),
      ...Object.values(conventions.functions).map(p => p.case),
      ...Object.values(conventions.classes).map(p => p.case)
    ]).size;
    const overallConsistency = this.calculateOverallConsistency(conventions);

    return {
      conventions,
      stats: {
        totalElements,
        uniquePatterns,
        overallConsistency
      },
      commonPatterns,
      inconsistencies,
      errors
    };
  }

  /**
   * Build naming pattern from elements
   */
  private buildPattern(elements: NamingElement[]): NamingPattern {
    if (elements.length === 0) {
      return {
        case: NamingCase.MIXED,
        prefixes: [],
        suffixes: [],
        examples: [],
        confidence: 0,
        count: 0
      };
    }

    // Detect case style
    const caseStyles = elements.map(e => this.detectCase(e.name));
    const caseStyleCounts = new Map<NamingCase, number>();
    caseStyles.forEach(cs => caseStyleCounts.set(cs, (caseStyleCounts.get(cs) || 0) + 1));
    const dominantCase = Array.from(caseStyleCounts.entries())
      .sort((a, b) => b[1] - a[1])[0][0];

    // Extract prefixes and suffixes
    const prefixes = this.extractPrefixes(elements.map(e => e.name));
    const suffixes = this.extractSuffixes(elements.map(e => e.name));

    // Calculate confidence based on consistency
    const dominantCount = caseStyleCounts.get(dominantCase) || 0;
    const confidence = dominantCount / elements.length;

    // Get examples
    const examples = elements
      .filter(e => this.detectCase(e.name) === dominantCase)
      .slice(0, 5)
      .map(e => e.name);

    return {
      case: dominantCase,
      prefixes,
      suffixes,
      examples,
      confidence,
      count: elements.length
    };
  }

  /**
   * Detect the naming case of a string
   */
  private detectCase(name: string): NamingCase {
    // Check for screaming snake case
    if (/^[A-Z][A-Z0-9_]*$/.test(name) && name.includes('_')) {
      return NamingCase.SCREAMING_SNAKE_CASE;
    }

    // Check for snake case
    if (/^[a-z][a-z0-9_]*$/.test(name) && name.includes('_')) {
      return NamingCase.SNAKE_CASE;
    }

    // Check for upper kebab case
    if (/^[A-Z][A-Z0-9-]*$/.test(name) && name.includes('-')) {
      return NamingCase.UPPER_KEBAB_CASE;
    }

    // Check for kebab case
    if (/^[a-z][a-z0-9-]*$/.test(name) && name.includes('-')) {
      return NamingCase.KEBAB_CASE;
    }

    // Check for PascalCase
    if (/^[A-Z][a-zA-Z0-9]*$/.test(name) && /[a-z]/.test(name)) {
      return NamingCase.PASCAL_CASE;
    }

    // Check for camelCase
    if (/^[a-z][a-zA-Z0-9]*$/.test(name) && /[A-Z]/.test(name)) {
      return NamingCase.CAMEL_CASE;
    }

    // Check for all lowercase (simple camelCase without capitals)
    if (/^[a-z][a-z0-9]*$/.test(name)) {
      return NamingCase.CAMEL_CASE;
    }

    // Check for all uppercase (simple constant)
    if (/^[A-Z][A-Z0-9]*$/.test(name)) {
      return NamingCase.PASCAL_CASE;
    }

    return NamingCase.MIXED;
  }

  /**
   * Extract common prefixes from names
   */
  private extractPrefixes(names: string[]): string[] {
    const commonPrefixes = ['get', 'set', 'is', 'has', 'can', 'should', 'will', 'on', 'handle', 'create', 'update', 'delete', 'fetch', 'load', 'save', 'find', 'use', 'with', 'to', 'from'];
    const foundPrefixes = new Map<string, number>();

    names.forEach(name => {
      const lowerName = name.toLowerCase();
      commonPrefixes.forEach(prefix => {
        if (lowerName.startsWith(prefix)) {
          foundPrefixes.set(prefix, (foundPrefixes.get(prefix) || 0) + 1);
        }
      });
    });

    return Array.from(foundPrefixes.entries())
      .filter(([_, count]) => count >= Math.max(1, Math.ceil(names.length * 0.1))) // At least 1 or 10%
      .sort((a, b) => b[1] - a[1])
      .map(([prefix]) => prefix)
      .slice(0, 5);
  }

  /**
   * Extract common suffixes from names
   */
  private extractSuffixes(names: string[]): string[] {
    const commonSuffixes = ['Service', 'Controller', 'Manager', 'Handler', 'Provider', 'Factory', 'Builder', 'Helper', 'Util', 'Utils', 'Component', 'Props', 'State', 'Type', 'Interface', 'Config', 'Options', 'Result', 'Response', 'Request'];
    const foundSuffixes = new Map<string, number>();

    names.forEach(name => {
      commonSuffixes.forEach(suffix => {
        if (name.endsWith(suffix)) {
          foundSuffixes.set(suffix, (foundSuffixes.get(suffix) || 0) + 1);
        }
      });
    });

    return Array.from(foundSuffixes.entries())
      .filter(([_, count]) => count >= Math.max(1, Math.ceil(names.length * 0.1))) // At least 1 or 10%
      .sort((a, b) => b[1] - a[1])
      .map(([suffix]) => suffix)
      .slice(0, 5);
  }

  /**
   * Analyze file naming patterns
   */
  private analyzeFileName(fileName: string): NamingConventions['files'] {
    const baseName = fileName.split('/').pop() || fileName;
    const nameWithoutExt = baseName.replace(/\.(ts|tsx|js|jsx)$/, '');
    const detectedCase = this.detectCase(nameWithoutExt);

    const createFilePattern = (names: string[], caseStyle: NamingCase): NamingPattern => ({
      case: caseStyle,
      prefixes: [],
      suffixes: [],
      examples: names,
      confidence: 1.0,
      count: names.length
    });

    // Detect file type
    const isTest = /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(baseName);
    const isConfig = /config|configuration/.test(nameWithoutExt.toLowerCase());
    const isComponent = /\.(tsx|jsx)$/.test(baseName) || /^[A-Z]/.test(nameWithoutExt);
    const isUtil = /util|helper|lib/.test(nameWithoutExt.toLowerCase());

    return {
      components: createFilePattern(
        isComponent ? [nameWithoutExt] : [],
        isComponent ? detectedCase : NamingCase.PASCAL_CASE
      ),
      utilities: createFilePattern(
        isUtil ? [nameWithoutExt] : [],
        isUtil ? detectedCase : NamingCase.KEBAB_CASE
      ),
      tests: createFilePattern(
        isTest ? [nameWithoutExt] : [],
        isTest ? detectedCase : NamingCase.KEBAB_CASE
      ),
      configs: createFilePattern(
        isConfig ? [nameWithoutExt] : [],
        isConfig ? detectedCase : NamingCase.KEBAB_CASE
      )
    };
  }

  /**
   * Detect inconsistencies in naming conventions
   */
  private detectInconsistencies(
    elements: NamingElement[],
    conventions: NamingConventions
  ): NamingDetectionResult['inconsistencies'] {
    const inconsistencies: NamingDetectionResult['inconsistencies'] = [];

    elements.forEach(element => {
      let expectedCase: NamingCase | null = null;
      let pattern: NamingPattern | null = null;

      // Determine expected case based on element type
      if (element.type === 'variable') {
        pattern = element.isPrivate ? conventions.variables.private : conventions.variables.regular;
      } else if (element.type === 'constant') {
        pattern = conventions.variables.constants;
      } else if (element.type === 'function') {
        pattern = element.isAsync ? conventions.functions.async : conventions.functions.regular;
      } else if (element.type === 'method') {
        pattern = element.isPrivate ? conventions.functions.private : conventions.functions.methods;
      } else if (element.type === 'class') {
        pattern = element.isAbstract ? conventions.classes.abstract : conventions.classes.regular;
      } else if (element.type === 'interface') {
        pattern = conventions.classes.interfaces;
      } else if (element.type === 'type') {
        pattern = conventions.classes.types;
      } else if (element.type === 'enum') {
        pattern = conventions.classes.enums;
      }

      // Use a lower threshold for inconsistency detection (0.5) to catch outliers
      if (pattern && pattern.confidence >= 0.5 && pattern.case !== NamingCase.MIXED) {
        expectedCase = pattern.case;
        const actualCase = this.detectCase(element.name);

        if (actualCase !== expectedCase && actualCase !== NamingCase.MIXED) {
          inconsistencies.push({
            element: element.name,
            expectedCase,
            actualCase,
            suggestion: `Consider renaming to follow ${expectedCase} convention`
          });
        }
      }
    });

    return inconsistencies;
  }

  /**
   * Calculate overall consistency score
   */
  private calculateOverallConsistency(conventions: NamingConventions): number {
    const patterns = [
      ...Object.values(conventions.variables),
      ...Object.values(conventions.functions),
      ...Object.values(conventions.classes)
    ];

    const totalConfidence = patterns.reduce((sum, p) => sum + (p.confidence * p.count), 0);
    const totalCount = patterns.reduce((sum, p) => sum + p.count, 0);

    return totalCount > 0 ? totalConfidence / totalCount : 0;
  }

  /**
   * Check if variable is const
   */
  private isConstVariable(node: ts.VariableDeclaration): boolean {
    // Check if it's a const declaration
    const parent = node.parent;
    const isConstDecl = ts.isVariableDeclarationList(parent) && !!(parent.flags & ts.NodeFlags.Const);

    // Only treat as constant if it's const AND uses SCREAMING_SNAKE_CASE or all uppercase
    if (!isConstDecl) {
      return false;
    }

    // Check naming pattern
    if (node.name && ts.isIdentifier(node.name)) {
      const name = node.name.text;
      // SCREAMING_SNAKE_CASE or all uppercase (e.g., MAX_SIZE, API_KEY, PI)
      return /^[A-Z][A-Z0-9_]*$/.test(name);
    }

    return false;
  }

  /**
   * Check if name indicates private member
   */
  private isPrivate(name: string): boolean {
    return name.startsWith('_') || name.startsWith('#');
  }

  /**
   * Check if node has private modifier
   */
  private hasPrivateModifier(node: ts.Node): boolean {
    if ('modifiers' in node && node.modifiers) {
      return (node.modifiers as ts.NodeArray<ts.Modifier>).some(
        m => m.kind === ts.SyntaxKind.PrivateKeyword
      );
    }
    return false;
  }

  /**
   * Get cached result if available and not expired
   */
  private getCached(sourceCode: string): NamingDetectionResult | null {
    const hash = this.hashCode(sourceCode);
    const cached = this.cache.get(hash);

    if (!cached) {
      return null;
    }

    const now = Date.now();
    if (now - cached.timestamp > this.options.cacheTtl) {
      this.cache.delete(hash);
      return null;
    }

    return cached.result;
  }

  /**
   * Cache a result
   */
  private cacheResult(sourceCode: string, result: NamingDetectionResult): void {
    const hash = this.hashCode(sourceCode);

    // Evict oldest entries if cache is full
    if (this.cache.size >= this.options.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(hash, {
      result,
      timestamp: Date.now(),
      hash
    });
  }

  /**
   * Simple hash function for cache keys
   */
  private hashCode(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
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
  getCacheStats() {
    return {
      size: this.cache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: this.cacheHits + this.cacheMisses > 0
        ? this.cacheHits / (this.cacheHits + this.cacheMisses)
        : 0
    };
  }
}

/**
 * Factory function to create a NamingDetector with default options
 */
export function createNamingDetector(options?: NamingDetectorOptions): NamingDetector {
  return new NamingDetector(options);
}
