/**
 * PatternDetector - Detect common design patterns in TypeScript/JavaScript code
 *
 * Uses TypeScript Compiler API to parse AST and identify design patterns like
 * singleton, factory, service classes, HOCs, hooks, and more with caching for performance.
 */

import * as ts from 'typescript';

/**
 * Represents different types of design patterns
 */
export enum PatternType {
  /** Singleton pattern - single instance class */
  SINGLETON = 'singleton',
  /** Factory pattern - class/function that creates objects */
  FACTORY = 'factory',
  /** Service class - class with business logic */
  SERVICE = 'service',
  /** Higher-Order Component (React) */
  HOC = 'hoc',
  /** React Hook */
  HOOK = 'hook',
  /** Builder pattern */
  BUILDER = 'builder',
  /** Repository pattern */
  REPOSITORY = 'repository',
  /** Controller pattern */
  CONTROLLER = 'controller',
  /** Observer/Event Emitter pattern */
  OBSERVER = 'observer',
  /** Strategy pattern */
  STRATEGY = 'strategy',
  /** Decorator pattern */
  DECORATOR = 'decorator',
  /** Provider pattern */
  PROVIDER = 'provider',
  /** Utility/Helper class */
  UTILITY = 'utility'
}

/**
 * Represents a detected pattern instance
 */
export interface DetectedPattern {
  /** Type of pattern detected */
  type: PatternType;
  /** Name of the class/function */
  name: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Evidence supporting this pattern detection */
  evidence: string[];
  /** Line number where pattern appears */
  line: number;
  /** Whether the pattern is exported */
  isExported: boolean;
  /** Additional metadata specific to the pattern */
  metadata: {
    /** For singletons: instance variable name */
    instanceName?: string;
    /** For factories: return type */
    returnType?: string;
    /** For HOCs: component parameter name */
    componentParam?: string;
    /** For hooks: state variables */
    stateVariables?: string[];
    /** For services: method names */
    methods?: string[];
    /** Class vs function implementation */
    implementationType?: 'class' | 'function';
  };
}

/**
 * Result of pattern detection
 */
export interface PatternDetectionResult {
  /** All detected patterns */
  patterns: DetectedPattern[];
  /** Count of patterns by type */
  stats: {
    total: number;
    singleton: number;
    factory: number;
    service: number;
    hoc: number;
    hook: number;
    builder: number;
    repository: number;
    controller: number;
    observer: number;
    strategy: number;
    decorator: number;
    provider: number;
    utility: number;
  };
  /** Common pattern combinations */
  combinations: {
    /** Pattern types that appear together */
    types: PatternType[];
    /** Count of co-occurrences */
    count: number;
  }[];
  /** Summary of architectural style */
  architecture: {
    /** Dominant pattern type */
    dominantPattern: PatternType | null;
    /** Overall code organization style */
    style: 'functional' | 'object-oriented' | 'mixed';
    /** Confidence in architecture assessment */
    confidence: number;
  };
  /** Any errors encountered during detection */
  errors: string[];
}

/**
 * Options for PatternDetector
 */
export interface PatternDetectorOptions {
  /** Enable caching (default: true) */
  enableCache?: boolean;
  /** Cache TTL in milliseconds (default: 1 hour) */
  cacheTtl?: number;
  /** Maximum cache size (default: 1000 entries) */
  maxCacheSize?: number;
  /** Minimum confidence threshold (0-1, default: 0.6) */
  minConfidence?: number;
  /** Include low-confidence patterns (default: false) */
  includeLowConfidence?: boolean;
  /** Detect React patterns (default: true) */
  detectReactPatterns?: boolean;
}

/**
 * Cache entry for pattern detection results
 */
interface CacheEntry {
  result: PatternDetectionResult;
  timestamp: number;
  hash: string;
}

/**
 * PatternDetector class for detecting design patterns in TypeScript/JavaScript code
 */
export class PatternDetector {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly options: Required<PatternDetectorOptions>;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(options: PatternDetectorOptions = {}) {
    this.options = {
      enableCache: options.enableCache ?? true,
      cacheTtl: options.cacheTtl ?? 60 * 60 * 1000, // 1 hour
      maxCacheSize: options.maxCacheSize ?? 1000,
      minConfidence: options.minConfidence ?? 0.6,
      includeLowConfidence: options.includeLowConfidence ?? false,
      detectReactPatterns: options.detectReactPatterns ?? true
    };
  }

  /**
   * Detect design patterns from TypeScript/JavaScript source code
   */
  detect(sourceCode: string, fileName: string = 'file.ts'): PatternDetectionResult {
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
   * Perform the actual pattern detection
   */
  private performDetection(sourceCode: string, fileName: string): PatternDetectionResult {
    const patterns: DetectedPattern[] = [];
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
          // Detect class-based patterns
          if (ts.isClassDeclaration(node) && node.name) {
            const classPatterns = this.detectClassPatterns(node, sourceFile);
            patterns.push(...classPatterns);
          }

          // Detect function-based patterns
          if (ts.isFunctionDeclaration(node) && node.name) {
            const functionPatterns = this.detectFunctionPatterns(node, sourceFile);
            patterns.push(...functionPatterns);
          }

          // Detect arrow function patterns (HOCs, factories)
          if (ts.isVariableStatement(node)) {
            node.declarationList.declarations.forEach(decl => {
              if (decl.initializer && ts.isArrowFunction(decl.initializer)) {
                const arrowPatterns = this.detectArrowFunctionPatterns(decl, sourceFile);
                patterns.push(...arrowPatterns);
              }
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

    // Filter by confidence threshold
    const filteredPatterns = this.options.includeLowConfidence
      ? patterns
      : patterns.filter(p => p.confidence >= this.options.minConfidence);

    // Calculate statistics and architecture
    return this.buildResult(filteredPatterns, errors);
  }

  /**
   * Detect patterns in class declarations
   */
  private detectClassPatterns(
    node: ts.ClassDeclaration,
    sourceFile: ts.SourceFile
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const className = node.name!.text;
    const isExported = this.isExported(node);
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    const methods = this.getClassMethods(node);
    const properties = this.getClassProperties(node);

    // Detect Singleton pattern
    const singletonPattern = this.detectSingleton(className, node, methods, properties, isExported, line);
    if (singletonPattern) patterns.push(singletonPattern);

    // Detect Service pattern
    const servicePattern = this.detectService(className, methods, properties, isExported, line);
    if (servicePattern) patterns.push(servicePattern);

    // Detect Factory pattern
    const factoryPattern = this.detectClassFactory(className, methods, properties, isExported, line);
    if (factoryPattern) patterns.push(factoryPattern);

    // Detect Builder pattern
    const builderPattern = this.detectBuilder(className, methods, properties, isExported, line);
    if (builderPattern) patterns.push(builderPattern);

    // Detect Repository pattern
    const repositoryPattern = this.detectRepository(className, methods, isExported, line);
    if (repositoryPattern) patterns.push(repositoryPattern);

    // Detect Controller pattern
    const controllerPattern = this.detectController(className, methods, isExported, line);
    if (controllerPattern) patterns.push(controllerPattern);

    // Detect Observer pattern
    const observerPattern = this.detectObserver(className, methods, properties, isExported, line);
    if (observerPattern) patterns.push(observerPattern);

    // Detect Provider pattern
    const providerPattern = this.detectProvider(className, methods, isExported, line);
    if (providerPattern) patterns.push(providerPattern);

    // Detect Utility class
    const utilityPattern = this.detectUtilityClass(className, methods, node, isExported, line);
    if (utilityPattern) patterns.push(utilityPattern);

    return patterns;
  }

  /**
   * Detect patterns in function declarations
   */
  private detectFunctionPatterns(
    node: ts.FunctionDeclaration,
    sourceFile: ts.SourceFile
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const functionName = node.name!.text;
    const isExported = this.isExported(node);
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

    // Detect React Hook pattern
    if (this.options.detectReactPatterns) {
      const hookPattern = this.detectHook(functionName, node, isExported, line);
      if (hookPattern) patterns.push(hookPattern);
    }

    // Detect Factory function
    const factoryPattern = this.detectFunctionFactory(functionName, node, isExported, line);
    if (factoryPattern) patterns.push(factoryPattern);

    // Detect HOC pattern
    if (this.options.detectReactPatterns) {
      const hocPattern = this.detectHOC(functionName, node, isExported, line);
      if (hocPattern) patterns.push(hocPattern);
    }

    // Detect Utility function
    const utilityPattern = this.detectUtilityFunction(functionName, node, isExported, line);
    if (utilityPattern) patterns.push(utilityPattern);

    return patterns;
  }

  /**
   * Detect patterns in arrow functions
   */
  private detectArrowFunctionPatterns(
    node: ts.VariableDeclaration,
    sourceFile: ts.SourceFile
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    if (!ts.isIdentifier(node.name)) return patterns;

    const name = node.name.text;
    const isExported = this.isExportedVariable(node);
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    const arrowFunc = node.initializer as ts.ArrowFunction;

    // Detect React Hook pattern
    if (this.options.detectReactPatterns) {
      const hookPattern = this.detectArrowHook(name, arrowFunc, isExported, line);
      if (hookPattern) patterns.push(hookPattern);
    }

    // Detect HOC pattern
    if (this.options.detectReactPatterns) {
      const hocPattern = this.detectArrowHOC(name, arrowFunc, isExported, line);
      if (hocPattern) patterns.push(hocPattern);
    }

    // Detect Factory pattern
    const factoryPattern = this.detectArrowFactory(name, arrowFunc, isExported, line);
    if (factoryPattern) patterns.push(factoryPattern);

    return patterns;
  }

  // ==================== Pattern Detection Methods ====================

  /**
   * Detect Singleton pattern
   */
  private detectSingleton(
    className: string,
    node: ts.ClassDeclaration,
    methods: string[],
    properties: string[],
    isExported: boolean,
    line: number
  ): DetectedPattern | null {
    const evidence: string[] = [];
    let confidence = 0;

    // Look for getInstance method
    if (methods.some(m => m.toLowerCase().includes('getinstance'))) {
      evidence.push('Has getInstance method');
      confidence += 0.4;
    }

    // Look for private constructor
    const constructor = node.members.find(m => ts.isConstructorDeclaration(m)) as ts.ConstructorDeclaration | undefined;
    if (constructor && this.isPrivateOrProtected(constructor)) {
      evidence.push('Has private/protected constructor');
      confidence += 0.3;
    }

    // Look for instance property
    const instanceProp = properties.find(p => p.toLowerCase().includes('instance'));
    if (instanceProp) {
      evidence.push(`Has instance property: ${instanceProp}`);
      confidence += 0.3;
    }

    if (confidence >= this.options.minConfidence) {
      return {
        type: PatternType.SINGLETON,
        name: className,
        confidence,
        evidence,
        line,
        isExported,
        metadata: {
          instanceName: instanceProp,
          implementationType: 'class'
        }
      };
    }

    return null;
  }

  /**
   * Detect Service pattern
   */
  private detectService(
    className: string,
    methods: string[],
    properties: string[],
    isExported: boolean,
    line: number
  ): DetectedPattern | null {
    const evidence: string[] = [];
    let confidence = 0;

    // Check naming
    if (className.endsWith('Service')) {
      evidence.push('Name ends with "Service"');
      confidence += 0.4;
    }

    // Check for business logic methods (CRUD operations)
    const crudMethods = ['create', 'read', 'update', 'delete', 'get', 'set', 'find', 'save', 'fetch', 'load'];
    const hasCrudMethods = methods.filter(m =>
      crudMethods.some(crud => m.toLowerCase().includes(crud))
    );
    if (hasCrudMethods.length >= 2) {
      evidence.push(`Has ${hasCrudMethods.length} business logic methods`);
      confidence += 0.3;
    }

    // Has multiple methods
    if (methods.length >= 3) {
      evidence.push(`Has ${methods.length} methods`);
      confidence += 0.2;
    }

    // Has dependencies/properties
    if (properties.length > 0) {
      evidence.push(`Has ${properties.length} dependencies`);
      confidence += 0.1;
    }

    if (confidence >= this.options.minConfidence) {
      return {
        type: PatternType.SERVICE,
        name: className,
        confidence,
        evidence,
        line,
        isExported,
        metadata: {
          methods: hasCrudMethods.slice(0, 5),
          implementationType: 'class'
        }
      };
    }

    return null;
  }

  /**
   * Detect Factory pattern (class-based)
   */
  private detectClassFactory(
    className: string,
    methods: string[],
    properties: string[],
    isExported: boolean,
    line: number
  ): DetectedPattern | null {
    const evidence: string[] = [];
    let confidence = 0;

    // Check naming
    if (className.endsWith('Factory') || className.endsWith('Builder')) {
      evidence.push(`Name ends with "Factory" or "Builder"`);
      confidence += 0.4;
    }

    // Check for create methods
    const createMethods = methods.filter(m =>
      /^(create|make|build|new)/.test(m.toLowerCase())
    );
    if (createMethods.length > 0) {
      evidence.push(`Has ${createMethods.length} creation methods`);
      confidence += 0.3;
    }

    // Check for method names that suggest object creation
    if (methods.some(m => m.toLowerCase().includes('from') || m.toLowerCase().includes('to'))) {
      evidence.push('Has conversion methods');
      confidence += 0.2;
    }

    if (confidence >= this.options.minConfidence) {
      return {
        type: PatternType.FACTORY,
        name: className,
        confidence,
        evidence,
        line,
        isExported,
        metadata: {
          methods: createMethods.slice(0, 5),
          implementationType: 'class'
        }
      };
    }

    return null;
  }

  /**
   * Detect Builder pattern
   */
  private detectBuilder(
    className: string,
    methods: string[],
    properties: string[],
    isExported: boolean,
    line: number
  ): DetectedPattern | null {
    const evidence: string[] = [];
    let confidence = 0;

    // Check naming
    if (className.endsWith('Builder')) {
      evidence.push('Name ends with "Builder"');
      confidence += 0.4;
    }

    // Check for builder methods (with*, set*, add*)
    const builderMethods = methods.filter(m =>
      /^(with|set|add)/.test(m.toLowerCase())
    );
    if (builderMethods.length >= 2) {
      evidence.push(`Has ${builderMethods.length} builder methods`);
      confidence += 0.3;
    }

    // Check for build method
    if (methods.some(m => m === 'build' || m === 'create')) {
      evidence.push('Has build/create method');
      confidence += 0.3;
    }

    if (confidence >= this.options.minConfidence) {
      return {
        type: PatternType.BUILDER,
        name: className,
        confidence,
        evidence,
        line,
        isExported,
        metadata: {
          methods: builderMethods.slice(0, 5),
          implementationType: 'class'
        }
      };
    }

    return null;
  }

  /**
   * Detect Repository pattern
   */
  private detectRepository(
    className: string,
    methods: string[],
    isExported: boolean,
    line: number
  ): DetectedPattern | null {
    const evidence: string[] = [];
    let confidence = 0;

    // Check naming
    if (className.endsWith('Repository') || className.endsWith('Store') || className.endsWith('Storage')) {
      evidence.push('Name suggests repository pattern');
      confidence += 0.4;
    }

    // Check for data access methods
    const dataAccessMethods = methods.filter(m =>
      /^(find|get|save|update|delete|insert|query|fetch|load)/.test(m.toLowerCase())
    );
    if (dataAccessMethods.length >= 3) {
      evidence.push(`Has ${dataAccessMethods.length} data access methods`);
      confidence += 0.4;
    }

    // Check for list/collection methods
    if (methods.some(m => /^(findAll|getAll|list)/.test(m.toLowerCase()))) {
      evidence.push('Has collection retrieval methods');
      confidence += 0.2;
    }

    if (confidence >= this.options.minConfidence) {
      return {
        type: PatternType.REPOSITORY,
        name: className,
        confidence,
        evidence,
        line,
        isExported,
        metadata: {
          methods: dataAccessMethods.slice(0, 5),
          implementationType: 'class'
        }
      };
    }

    return null;
  }

  /**
   * Detect Controller pattern
   */
  private detectController(
    className: string,
    methods: string[],
    isExported: boolean,
    line: number
  ): DetectedPattern | null {
    const evidence: string[] = [];
    let confidence = 0;

    // Check naming
    if (className.endsWith('Controller') || className.endsWith('Handler')) {
      evidence.push('Name ends with "Controller" or "Handler"');
      confidence += 0.5;
    }

    // Check for handler methods
    const handlerMethods = methods.filter(m =>
      /^(handle|on|process)/.test(m.toLowerCase())
    );
    if (handlerMethods.length >= 2) {
      evidence.push(`Has ${handlerMethods.length} handler methods`);
      confidence += 0.3;
    }

    // Check for HTTP-like methods
    const httpMethods = methods.filter(m =>
      /^(get|post|put|delete|patch)/.test(m.toLowerCase())
    );
    if (httpMethods.length >= 2) {
      evidence.push(`Has ${httpMethods.length} HTTP-like methods`);
      confidence += 0.3;
    }

    if (confidence >= this.options.minConfidence) {
      return {
        type: PatternType.CONTROLLER,
        name: className,
        confidence,
        evidence,
        line,
        isExported,
        metadata: {
          methods: [...handlerMethods, ...httpMethods].slice(0, 5),
          implementationType: 'class'
        }
      };
    }

    return null;
  }

  /**
   * Detect Observer/Event Emitter pattern
   */
  private detectObserver(
    className: string,
    methods: string[],
    properties: string[],
    isExported: boolean,
    line: number
  ): DetectedPattern | null {
    const evidence: string[] = [];
    let confidence = 0;

    // Check naming
    if (className.includes('Observer') || className.includes('Emitter') || className.includes('EventBus')) {
      evidence.push('Name suggests observer pattern');
      confidence += 0.3;
    }

    // Check for subscription methods
    const subscriptionMethods = methods.filter(m =>
      /^(on|off|emit|subscribe|unsubscribe|addEventListener|removeEventListener|notify)/.test(m.toLowerCase())
    );
    if (subscriptionMethods.length >= 2) {
      evidence.push(`Has ${subscriptionMethods.length} event handling methods`);
      confidence += 0.4;
    }

    // Check for listeners/subscribers property
    if (properties.some(p => /listeners|subscribers|observers|handlers/.test(p.toLowerCase()))) {
      evidence.push('Has event listeners storage');
      confidence += 0.3;
    }

    if (confidence >= this.options.minConfidence) {
      return {
        type: PatternType.OBSERVER,
        name: className,
        confidence,
        evidence,
        line,
        isExported,
        metadata: {
          methods: subscriptionMethods.slice(0, 5),
          implementationType: 'class'
        }
      };
    }

    return null;
  }

  /**
   * Detect Provider pattern
   */
  private detectProvider(
    className: string,
    methods: string[],
    isExported: boolean,
    line: number
  ): DetectedPattern | null {
    const evidence: string[] = [];
    let confidence = 0;

    // Check naming
    if (className.endsWith('Provider')) {
      evidence.push('Name ends with "Provider"');
      confidence += 0.5;
    }

    // Check for provide/get methods
    if (methods.some(m => /^(provide|get|resolve)/.test(m.toLowerCase()))) {
      evidence.push('Has provide/get/resolve methods');
      confidence += 0.3;
    }

    // Check for register/bind methods (dependency injection)
    if (methods.some(m => /^(register|bind|inject)/.test(m.toLowerCase()))) {
      evidence.push('Has dependency registration methods');
      confidence += 0.2;
    }

    if (confidence >= this.options.minConfidence) {
      return {
        type: PatternType.PROVIDER,
        name: className,
        confidence,
        evidence,
        line,
        isExported,
        metadata: {
          methods: methods.slice(0, 5),
          implementationType: 'class'
        }
      };
    }

    return null;
  }

  /**
   * Detect Utility class
   */
  private detectUtilityClass(
    className: string,
    methods: string[],
    node: ts.ClassDeclaration,
    isExported: boolean,
    line: number
  ): DetectedPattern | null {
    const evidence: string[] = [];
    let confidence = 0;

    // Check naming
    if (className.endsWith('Utils') || className.endsWith('Util') || className.endsWith('Helper') || className.endsWith('Helpers')) {
      evidence.push('Name suggests utility class');
      confidence += 0.4;
    }

    // Check if all methods are static
    const staticMethods = node.members.filter(m =>
      ts.isMethodDeclaration(m) &&
      m.modifiers?.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword)
    );
    if (methods.length > 0 && staticMethods.length === methods.length) {
      evidence.push('All methods are static');
      confidence += 0.4;
    }

    // Check for no instance properties
    const instanceProperties = node.members.filter(m =>
      ts.isPropertyDeclaration(m) &&
      !m.modifiers?.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword)
    );
    if (methods.length > 0 && instanceProperties.length === 0) {
      evidence.push('No instance properties');
      confidence += 0.2;
    }

    if (confidence >= this.options.minConfidence) {
      return {
        type: PatternType.UTILITY,
        name: className,
        confidence,
        evidence,
        line,
        isExported,
        metadata: {
          methods: methods.slice(0, 5),
          implementationType: 'class'
        }
      };
    }

    return null;
  }

  /**
   * Detect React Hook pattern
   */
  private detectHook(
    functionName: string,
    node: ts.FunctionDeclaration,
    isExported: boolean,
    line: number
  ): DetectedPattern | null {
    const evidence: string[] = [];
    let confidence = 0;

    // Must start with 'use'
    if (!functionName.startsWith('use')) {
      return null;
    }

    evidence.push('Name starts with "use"');
    confidence += 0.5;

    // Look for React hook calls in body
    const stateVariables = this.findReactHookCalls(node);
    if (stateVariables.length > 0) {
      evidence.push(`Calls ${stateVariables.length} React hooks`);
      confidence += 0.3;
    }

    // Returns array or object
    if (this.returnsArrayOrObject(node)) {
      evidence.push('Returns array or object');
      confidence += 0.2;
    }

    if (confidence >= this.options.minConfidence) {
      return {
        type: PatternType.HOOK,
        name: functionName,
        confidence,
        evidence,
        line,
        isExported,
        metadata: {
          stateVariables,
          implementationType: 'function'
        }
      };
    }

    return null;
  }

  /**
   * Detect HOC pattern
   */
  private detectHOC(
    functionName: string,
    node: ts.FunctionDeclaration,
    isExported: boolean,
    line: number
  ): DetectedPattern | null {
    const evidence: string[] = [];
    let confidence = 0;

    // Check naming (with*, enhance*)
    if (/^(with|enhance|wrap)/.test(functionName.toLowerCase())) {
      evidence.push('Name suggests HOC pattern');
      confidence += 0.4;
    }

    // Must have at least one parameter (the component)
    if (node.parameters.length === 0) {
      return null;
    }

    // Look for component parameter
    const componentParam = node.parameters.find(p =>
      ts.isIdentifier(p.name) &&
      (/^(Component|Comp|C)$/.test(p.name.text) ||
       /Component$/.test(p.name.text))
    );

    if (componentParam && ts.isIdentifier(componentParam.name)) {
      evidence.push(`Has component parameter: ${componentParam.name.text}`);
      confidence += 0.4;
    }

    // Returns JSX or component
    if (this.returnsJSXOrComponent(node)) {
      evidence.push('Returns component');
      confidence += 0.3;
    }

    if (confidence >= this.options.minConfidence) {
      return {
        type: PatternType.HOC,
        name: functionName,
        confidence,
        evidence,
        line,
        isExported,
        metadata: {
          componentParam: componentParam && ts.isIdentifier(componentParam.name)
            ? componentParam.name.text
            : undefined,
          implementationType: 'function'
        }
      };
    }

    return null;
  }

  /**
   * Detect Factory function pattern
   */
  private detectFunctionFactory(
    functionName: string,
    node: ts.FunctionDeclaration,
    isExported: boolean,
    line: number
  ): DetectedPattern | null {
    const evidence: string[] = [];
    let confidence = 0;

    // Check naming
    if (/^(create|make|build|new|from)/.test(functionName.toLowerCase())) {
      evidence.push('Name suggests factory function');
      confidence += 0.4;
    }

    // Returns object or class instance
    if (this.returnsObjectOrInstance(node)) {
      evidence.push('Returns object or instance');
      confidence += 0.3;
    }

    // Has multiple parameters (configuration)
    if (node.parameters.length >= 2) {
      evidence.push(`Has ${node.parameters.length} configuration parameters`);
      confidence += 0.2;
    }

    if (confidence >= this.options.minConfidence) {
      return {
        type: PatternType.FACTORY,
        name: functionName,
        confidence,
        evidence,
        line,
        isExported,
        metadata: {
          implementationType: 'function'
        }
      };
    }

    return null;
  }

  /**
   * Detect Utility function
   */
  private detectUtilityFunction(
    functionName: string,
    node: ts.FunctionDeclaration,
    isExported: boolean,
    line: number
  ): DetectedPattern | null {
    const evidence: string[] = [];
    let confidence = 0;

    // Pure function characteristics
    const isPure = this.isPureFunction(node);
    if (isPure) {
      evidence.push('Appears to be a pure function');
      confidence += 0.3;
    }

    // Simple transformation/formatting names
    if (/^(format|parse|convert|transform|validate|check|is|to)/.test(functionName.toLowerCase())) {
      evidence.push('Name suggests utility function');
      confidence += 0.4;
    }

    // Short function body
    if (this.isShortFunction(node)) {
      evidence.push('Has concise implementation');
      confidence += 0.2;
    }

    if (confidence >= this.options.minConfidence) {
      return {
        type: PatternType.UTILITY,
        name: functionName,
        confidence,
        evidence,
        line,
        isExported,
        metadata: {
          implementationType: 'function'
        }
      };
    }

    return null;
  }

  /**
   * Detect Hook pattern in arrow functions
   */
  private detectArrowHook(
    name: string,
    node: ts.ArrowFunction,
    isExported: boolean,
    line: number
  ): DetectedPattern | null {
    const evidence: string[] = [];
    let confidence = 0;

    // Must start with 'use'
    if (!name.startsWith('use')) {
      return null;
    }

    evidence.push('Name starts with "use"');
    confidence += 0.5;

    // Look for React hook calls
    const hasHookCalls = this.hasReactHookCallsInArrow(node);
    if (hasHookCalls) {
      evidence.push('Calls React hooks');
      confidence += 0.4;
    }

    if (confidence >= this.options.minConfidence) {
      return {
        type: PatternType.HOOK,
        name,
        confidence,
        evidence,
        line,
        isExported,
        metadata: {
          implementationType: 'function'
        }
      };
    }

    return null;
  }

  /**
   * Detect HOC pattern in arrow functions
   */
  private detectArrowHOC(
    name: string,
    node: ts.ArrowFunction,
    isExported: boolean,
    line: number
  ): DetectedPattern | null {
    const evidence: string[] = [];
    let confidence = 0;

    // Check naming
    if (/^(with|enhance|wrap)/.test(name.toLowerCase())) {
      evidence.push('Name suggests HOC pattern');
      confidence += 0.4;
    }

    // Must have parameters
    if (node.parameters.length === 0) {
      return null;
    }

    // Look for component parameter
    const hasComponentParam = node.parameters.some(p =>
      ts.isIdentifier(p.name) &&
      (/^(Component|Comp|C)$/.test(p.name.text) || /Component$/.test(p.name.text))
    );

    if (hasComponentParam) {
      evidence.push('Has component parameter');
      confidence += 0.4;
    }

    if (confidence >= this.options.minConfidence) {
      return {
        type: PatternType.HOC,
        name,
        confidence,
        evidence,
        line,
        isExported,
        metadata: {
          implementationType: 'function'
        }
      };
    }

    return null;
  }

  /**
   * Detect Factory pattern in arrow functions
   */
  private detectArrowFactory(
    name: string,
    node: ts.ArrowFunction,
    isExported: boolean,
    line: number
  ): DetectedPattern | null {
    const evidence: string[] = [];
    let confidence = 0;

    // Check naming
    if (/^(create|make|build|new|from)/.test(name.toLowerCase())) {
      evidence.push('Name suggests factory function');
      confidence += 0.5;
    }

    // Has parameters (configuration)
    if (node.parameters.length > 0) {
      evidence.push(`Has ${node.parameters.length} parameters`);
      confidence += 0.3;
    }

    if (confidence >= this.options.minConfidence) {
      return {
        type: PatternType.FACTORY,
        name,
        confidence,
        evidence,
        line,
        isExported,
        metadata: {
          implementationType: 'function'
        }
      };
    }

    return null;
  }

  // ==================== Helper Methods ====================

  /**
   * Get class methods
   */
  private getClassMethods(node: ts.ClassDeclaration): string[] {
    return node.members
      .filter(m => ts.isMethodDeclaration(m) && m.name && ts.isIdentifier(m.name))
      .map(m => (m.name as ts.Identifier).text);
  }

  /**
   * Get class properties
   */
  private getClassProperties(node: ts.ClassDeclaration): string[] {
    return node.members
      .filter(m => ts.isPropertyDeclaration(m) && m.name && ts.isIdentifier(m.name))
      .map(m => (m.name as ts.Identifier).text);
  }

  /**
   * Check if node is exported
   */
  private isExported(node: ts.Node): boolean {
    return !!(
      'modifiers' in node &&
      node.modifiers &&
      (node.modifiers as ts.NodeArray<ts.Modifier>).some(
        m => m.kind === ts.SyntaxKind.ExportKeyword
      )
    );
  }

  /**
   * Check if variable is exported
   */
  private isExportedVariable(node: ts.VariableDeclaration): boolean {
    const parent = node.parent;
    if (ts.isVariableDeclarationList(parent)) {
      const statement = parent.parent;
      if (ts.isVariableStatement(statement)) {
        return this.isExported(statement);
      }
    }
    return false;
  }

  /**
   * Check if constructor is private or protected
   */
  private isPrivateOrProtected(node: ts.ConstructorDeclaration): boolean {
    return !!(
      node.modifiers?.some(
        m => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword
      )
    );
  }

  /**
   * Find React hook calls in function body
   */
  private findReactHookCalls(node: ts.FunctionDeclaration): string[] {
    const hookCalls: string[] = [];

    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
        const name = n.expression.text;
        if (name.startsWith('use') && /^use[A-Z]/.test(name)) {
          hookCalls.push(name);
        }
      }
      ts.forEachChild(n, visit);
    };

    if (node.body) {
      visit(node.body);
    }

    return hookCalls;
  }

  /**
   * Check if function returns array or object
   */
  private returnsArrayOrObject(node: ts.FunctionDeclaration): boolean {
    if (!node.body) return false;

    let returnsComplex = false;
    const visit = (n: ts.Node) => {
      if (ts.isReturnStatement(n) && n.expression) {
        if (ts.isArrayLiteralExpression(n.expression) || ts.isObjectLiteralExpression(n.expression)) {
          returnsComplex = true;
        }
      }
      ts.forEachChild(n, visit);
    };

    visit(node.body);
    return returnsComplex;
  }

  /**
   * Check if function returns JSX or component
   */
  private returnsJSXOrComponent(node: ts.FunctionDeclaration): boolean {
    if (!node.body) return false;

    let returnsJSX = false;
    const visit = (n: ts.Node) => {
      if (ts.isReturnStatement(n) && n.expression) {
        // Check for JSX
        if (ts.isJsxElement(n.expression) || ts.isJsxSelfClosingElement(n.expression)) {
          returnsJSX = true;
        }
        // Check for arrow function (component)
        if (ts.isArrowFunction(n.expression) || ts.isFunctionExpression(n.expression)) {
          returnsJSX = true;
        }
      }
      ts.forEachChild(n, visit);
    };

    visit(node.body);
    return returnsJSX;
  }

  /**
   * Check if function returns object or instance
   */
  private returnsObjectOrInstance(node: ts.FunctionDeclaration): boolean {
    if (!node.body) return false;

    let returnsObject = false;
    const visit = (n: ts.Node) => {
      if (ts.isReturnStatement(n) && n.expression) {
        if (
          ts.isObjectLiteralExpression(n.expression) ||
          ts.isNewExpression(n.expression)
        ) {
          returnsObject = true;
        }
      }
      ts.forEachChild(n, visit);
    };

    visit(node.body);
    return returnsObject;
  }

  /**
   * Check if function is pure (no side effects detected)
   */
  private isPureFunction(node: ts.FunctionDeclaration): boolean {
    if (!node.body) return false;

    let hasSideEffects = false;
    const visit = (n: ts.Node) => {
      // Assignment expressions
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        hasSideEffects = true;
      }
      // Property access (might modify external state)
      if (ts.isPropertyAccessExpression(n) && ts.isBinaryExpression(n.parent)) {
        hasSideEffects = true;
      }
      ts.forEachChild(n, visit);
    };

    visit(node.body);
    return !hasSideEffects;
  }

  /**
   * Check if function is short (less than 10 statements)
   */
  private isShortFunction(node: ts.FunctionDeclaration): boolean {
    if (!node.body || !ts.isBlock(node.body)) return false;
    return node.body.statements.length <= 10;
  }

  /**
   * Check if arrow function has React hook calls
   */
  private hasReactHookCallsInArrow(node: ts.ArrowFunction): boolean {
    let hasHooks = false;

    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
        const name = n.expression.text;
        if (name.startsWith('use') && /^use[A-Z]/.test(name)) {
          hasHooks = true;
        }
      }
      ts.forEachChild(n, visit);
    };

    visit(node);
    return hasHooks;
  }

  /**
   * Build final result with statistics and architecture assessment
   */
  private buildResult(patterns: DetectedPattern[], errors: string[]): PatternDetectionResult {
    // Calculate statistics
    const stats = {
      total: patterns.length,
      singleton: patterns.filter(p => p.type === PatternType.SINGLETON).length,
      factory: patterns.filter(p => p.type === PatternType.FACTORY).length,
      service: patterns.filter(p => p.type === PatternType.SERVICE).length,
      hoc: patterns.filter(p => p.type === PatternType.HOC).length,
      hook: patterns.filter(p => p.type === PatternType.HOOK).length,
      builder: patterns.filter(p => p.type === PatternType.BUILDER).length,
      repository: patterns.filter(p => p.type === PatternType.REPOSITORY).length,
      controller: patterns.filter(p => p.type === PatternType.CONTROLLER).length,
      observer: patterns.filter(p => p.type === PatternType.OBSERVER).length,
      strategy: patterns.filter(p => p.type === PatternType.STRATEGY).length,
      decorator: patterns.filter(p => p.type === PatternType.DECORATOR).length,
      provider: patterns.filter(p => p.type === PatternType.PROVIDER).length,
      utility: patterns.filter(p => p.type === PatternType.UTILITY).length
    };

    // Find pattern combinations
    const combinations = this.findPatternCombinations(patterns);

    // Assess architecture
    const architecture = this.assessArchitecture(patterns);

    return {
      patterns,
      stats,
      combinations,
      architecture,
      errors
    };
  }

  /**
   * Find common pattern combinations
   */
  private findPatternCombinations(patterns: DetectedPattern[]): PatternDetectionResult['combinations'] {
    // Group by class/function name to find co-occurring patterns
    const grouped = new Map<string, PatternType[]>();
    patterns.forEach(p => {
      if (!grouped.has(p.name)) {
        grouped.set(p.name, []);
      }
      grouped.get(p.name)!.push(p.type);
    });

    // Count combinations
    const comboCounts = new Map<string, number>();
    grouped.forEach(types => {
      if (types.length > 1) {
        const key = types.sort().join(',');
        comboCounts.set(key, (comboCounts.get(key) || 0) + 1);
      }
    });

    return Array.from(comboCounts.entries())
      .map(([key, count]) => ({
        types: key.split(',') as PatternType[],
        count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  /**
   * Assess overall architecture style
   */
  private assessArchitecture(patterns: DetectedPattern[]): PatternDetectionResult['architecture'] {
    if (patterns.length === 0) {
      return {
        dominantPattern: null,
        style: 'mixed',
        confidence: 0
      };
    }

    // Count pattern types
    const typeCounts = new Map<PatternType, number>();
    patterns.forEach(p => {
      typeCounts.set(p.type, (typeCounts.get(p.type) || 0) + 1);
    });

    // Find dominant pattern
    const dominantEntry = Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])[0];
    const dominantPattern = dominantEntry ? dominantEntry[0] : null;

    // Determine style
    const classPatterns = patterns.filter(p => p.metadata.implementationType === 'class').length;
    const functionPatterns = patterns.filter(p => p.metadata.implementationType === 'function').length;

    let style: 'functional' | 'object-oriented' | 'mixed';
    let confidence: number;

    if (classPatterns > functionPatterns * 2) {
      style = 'object-oriented';
      confidence = 0.8;
    } else if (functionPatterns > classPatterns * 2) {
      style = 'functional';
      confidence = 0.8;
    } else {
      style = 'mixed';
      confidence = 0.6;
    }

    return {
      dominantPattern,
      style,
      confidence
    };
  }

  // ==================== Cache Management ====================

  /**
   * Get cached result if available and not expired
   */
  private getCached(sourceCode: string): PatternDetectionResult | null {
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
  private cacheResult(sourceCode: string, result: PatternDetectionResult): void {
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
 * Factory function to create a PatternDetector with default options
 */
export function createPatternDetector(options?: PatternDetectorOptions): PatternDetector {
  return new PatternDetector(options);
}
