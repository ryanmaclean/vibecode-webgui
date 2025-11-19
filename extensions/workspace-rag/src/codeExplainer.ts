/**
 * Code Explainer Service
 * 
 * Addresses "vibe coding" complaints by providing intelligent code explanations,
 * pattern detection, and complexity analysis to help developers understand
 * AI-generated code instead of blindly accepting it.
 */

import * as vscode from 'vscode';
import { logger } from './logger';

export interface CodePattern {
  name: string;
  description: string;
  category: 'design-pattern' | 'anti-pattern' | 'best-practice' | 'code-smell';
  confidence: number; // 0-1
  location: vscode.Range;
  examples: string[];
  learningResources: LearningResource[];
}

export interface LearningResource {
  title: string;
  url: string;
  type: 'article' | 'video' | 'documentation' | 'tutorial';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface ComplexityScore {
  cyclomatic: number;      // Cyclomatic complexity
  cognitive: number;       // Cognitive complexity
  nesting: number;         // Max nesting depth
  overall: 'simple' | 'moderate' | 'complex' | 'very-complex';
  score: number;           // 0-100
}

export interface CodeExplanation {
  code: string;
  patterns: CodePattern[];
  complexity: ComplexityScore;
  rationale: string;
  alternatives: Alternative[];
  warnings: Warning[];
  learningPath: string[];
}

export interface Alternative {
  description: string;
  code: string;
  pros: string[];
  cons: string[];
  complexity: ComplexityScore;
  recommended: boolean;
}

export interface Warning {
  type: 'complexity' | 'over-engineering' | 'anti-pattern' | 'performance';
  severity: 'info' | 'warning' | 'error';
  message: string;
  suggestion: string;
  location?: vscode.Range;
}

/**
 * Code Explainer Service
 * Analyzes code to detect patterns, measure complexity, and provide educational explanations
 */
export class CodeExplainerService {
  private patternDatabase: Map<string, CodePattern>;
  private complexityThresholds: ComplexityThresholds;

  constructor() {
    this.patternDatabase = this.initializePatternDatabase();
    this.complexityThresholds = this.loadComplexityThresholds();
  }

  /**
   * Analyze code and generate comprehensive explanation
   */
  async explainCode(code: string, context?: string): Promise<CodeExplanation> {
    const startTime = Date.now();

    try {
      const patterns = await this.detectPatterns(code);
      const complexity = this.analyzeComplexity(code);
      const warnings = this.generateWarnings(patterns, complexity);
      const alternatives = await this.suggestAlternatives(code, complexity);
      const rationale = this.generateRationale(patterns, complexity, context);
      const learningPath = this.createLearningPath(patterns, complexity);

      const explanation: CodeExplanation = {
        code,
        patterns,
        complexity,
        rationale,
        alternatives,
        warnings,
        learningPath
      };

      // Send to Datadog
      this.sendToDatadog(explanation, Date.now() - startTime);

      return explanation;
    } catch (error) {
      // Log error but don't fail
      console.error('Code explanation error:', error);
      throw error;
    }
  }

  /**
   * Send code analysis metrics to Datadog
   */
  private sendToDatadog(explanation: CodeExplanation, durationMs: number): void {
    try {
      const tracer = require('dd-trace');

      // Create a span for code analysis
      const span = tracer.startSpan('code.analysis', {
        tags: {
          'code.length': explanation.code.length,
          'complexity.overall': explanation.complexity.overall,
          'complexity.score': explanation.complexity.score,
          'complexity.cyclomatic': explanation.complexity.cyclomatic,
          'complexity.cognitive': explanation.complexity.cognitive,
          'complexity.nesting': explanation.complexity.nesting,
          'patterns.count': explanation.patterns.length,
          'patterns.design': explanation.patterns.filter(p => p.category === 'design-pattern').length,
          'patterns.anti': explanation.patterns.filter(p => p.category === 'anti-pattern').length,
          'warnings.count': explanation.warnings.length,
          'warnings.errors': explanation.warnings.filter(w => w.severity === 'error').length,
          'alternatives.count': explanation.alternatives.length,
          'duration.ms': durationMs
        }
      });

      // Send custom metrics via DogStatsD
      if (tracer.dogstatsd) {
        const tags = [
          `complexity:${explanation.complexity.overall}`,
          `has_warnings:${explanation.warnings.length > 0}`
        ];

        tracer.dogstatsd.gauge('vibecode.code.complexity.score', explanation.complexity.score, tags);
        tracer.dogstatsd.gauge('vibecode.code.complexity.cyclomatic', explanation.complexity.cyclomatic, tags);
        tracer.dogstatsd.gauge('vibecode.code.complexity.cognitive', explanation.complexity.cognitive, tags);
        tracer.dogstatsd.gauge('vibecode.code.complexity.nesting', explanation.complexity.nesting, tags);
        tracer.dogstatsd.gauge('vibecode.code.patterns.total', explanation.patterns.length, tags);
        tracer.dogstatsd.gauge('vibecode.code.warnings.total', explanation.warnings.length, tags);
        tracer.dogstatsd.increment('vibecode.code.analysis.count', 1, tags);
        tracer.dogstatsd.histogram('vibecode.code.analysis.duration_ms', durationMs, tags);
      }

      span.finish();
    } catch (error) {
      // Datadog integration is optional
      console.debug('Datadog metrics not available (optional):', error);
    }
  }

  /**
   * Detect design patterns and anti-patterns in code
   */
  private async detectPatterns(code: string): Promise<CodePattern[]> {
    const patterns: CodePattern[] = [];

    // Factory Pattern Detection
    if (this.hasFactoryPattern(code)) {
      patterns.push({
        name: 'Factory Pattern',
        description: 'Creates objects without specifying exact class',
        category: 'design-pattern',
        confidence: 0.85,
        location: new vscode.Range(0, 0, 0, 0), // TODO: Precise location
        examples: [
          'function createUser(type) { return type === "admin" ? new Admin() : new User(); }'
        ],
        learningResources: [
          {
            title: 'Factory Pattern Explained',
            url: 'https://refactoring.guru/design-patterns/factory-method',
            type: 'article',
            difficulty: 'intermediate'
          }
        ]
      });
    }

    // Dependency Injection Detection
    if (this.hasDependencyInjection(code)) {
      patterns.push({
        name: 'Dependency Injection',
        description: 'Dependencies passed as parameters instead of hard-coded',
        category: 'best-practice',
        confidence: 0.90,
        location: new vscode.Range(0, 0, 0, 0),
        examples: [
          'constructor(private database: Database, private logger: Logger) {}'
        ],
        learningResources: [
          {
            title: 'Dependency Injection Basics',
            url: 'https://martinfowler.com/articles/injection.html',
            type: 'article',
            difficulty: 'intermediate'
          }
        ]
      });
    }

    // God Object Anti-Pattern
    if (this.hasGodObject(code)) {
      patterns.push({
        name: 'God Object',
        description: 'Class doing too many things (violates Single Responsibility)',
        category: 'anti-pattern',
        confidence: 0.75,
        location: new vscode.Range(0, 0, 0, 0),
        examples: [],
        learningResources: [
          {
            title: 'SOLID Principles',
            url: 'https://www.digitalocean.com/community/conceptual-articles/s-o-l-i-d-the-first-five-principles-of-object-oriented-design',
            type: 'article',
            difficulty: 'intermediate'
          }
        ]
      });
    }

    // Callback Hell Detection
    if (this.hasCallbackHell(code)) {
      patterns.push({
        name: 'Callback Hell',
        description: 'Deeply nested callbacks making code hard to read',
        category: 'anti-pattern',
        confidence: 0.95,
        location: new vscode.Range(0, 0, 0, 0),
        examples: [],
        learningResources: [
          {
            title: 'Promises and Async/Await',
            url: 'https://javascript.info/async-await',
            type: 'tutorial',
            difficulty: 'beginner'
          }
        ]
      });
    }

    logger.info(`Detected ${patterns.length} patterns`, { patterns: patterns.map(p => p.name) });
    return patterns;
  }

  /**
   * Analyze code complexity using multiple metrics
   */
  private analyzeComplexity(code: string): ComplexityScore {
    const cyclomatic = this.calculateCyclomaticComplexity(code);
    const cognitive = this.calculateCognitiveComplexity(code);
    const nesting = this.calculateMaxNesting(code);

    // Overall score (0-100)
    const score = Math.min(100, (cyclomatic * 5) + (cognitive * 3) + (nesting * 10));

    let overall: ComplexityScore['overall'];
    if (score < 20) overall = 'simple';
    else if (score < 40) overall = 'moderate';
    else if (score < 70) overall = 'complex';
    else overall = 'very-complex';

    return {
      cyclomatic,
      cognitive,
      nesting,
      overall,
      score
    };
  }

  /**
   * Calculate cyclomatic complexity (number of decision points)
   */
  private calculateCyclomaticComplexity(code: string): number {
    let complexity = 1; // Base complexity

    // Count decision points
    const decisionKeywords = ['if', 'else if', 'while', 'for', 'case', '&&', '||', '?'];
    for (const keyword of decisionKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = code.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  /**
   * Calculate cognitive complexity (how hard it is to understand)
   */
  private calculateCognitiveComplexity(code: string): number {
    let complexity = 0;
    let nestingLevel = 0;

    const lines = code.split('\n');
    for (const line of lines) {
      // Increase nesting on opening braces
      if (line.includes('{')) {
        nestingLevel++;
      }

      // Add complexity for control structures, weighted by nesting
      if (/\b(if|while|for|switch|catch)\b/.test(line)) {
        complexity += (1 + nestingLevel);
      }

      // Decrease nesting on closing braces
      if (line.includes('}')) {
        nestingLevel = Math.max(0, nestingLevel - 1);
      }
    }

    return complexity;
  }

  /**
   * Calculate maximum nesting depth
   */
  private calculateMaxNesting(code: string): number {
    let maxNesting = 0;
    let currentNesting = 0;

    for (const char of code) {
      if (char === '{') {
        currentNesting++;
        maxNesting = Math.max(maxNesting, currentNesting);
      } else if (char === '}') {
        currentNesting = Math.max(0, currentNesting - 1);
      }
    }

    return maxNesting;
  }

  /**
   * Generate warnings based on patterns and complexity
   */
  private generateWarnings(patterns: CodePattern[], complexity: ComplexityScore): Warning[] {
    const warnings: Warning[] = [];

    // Complexity warnings
    if (complexity.overall === 'very-complex') {
      warnings.push({
        type: 'complexity',
        severity: 'error',
        message: `Very high complexity (score: ${complexity.score}/100)`,
        suggestion: 'Consider breaking this into smaller functions or simplifying logic'
      });
    } else if (complexity.overall === 'complex') {
      warnings.push({
        type: 'complexity',
        severity: 'warning',
        message: `High complexity (score: ${complexity.score}/100)`,
        suggestion: 'This code may be difficult to maintain. Consider refactoring.'
      });
    }

    // Nesting warnings
    if (complexity.nesting > 4) {
      warnings.push({
        type: 'complexity',
        severity: 'warning',
        message: `Deep nesting detected (${complexity.nesting} levels)`,
        suggestion: 'Extract nested logic into separate functions'
      });
    }

    // Anti-pattern warnings
    const antiPatterns = patterns.filter(p => p.category === 'anti-pattern');
    for (const pattern of antiPatterns) {
      warnings.push({
        type: 'anti-pattern',
        severity: 'warning',
        message: `${pattern.name} detected`,
        suggestion: `Consider refactoring to avoid this anti-pattern. ${pattern.description}`,
        location: pattern.location
      });
    }

    // Over-engineering detection
    if (patterns.length > 5 && complexity.overall === 'simple') {
      warnings.push({
        type: 'over-engineering',
        severity: 'info',
        message: 'Multiple design patterns for simple logic',
        suggestion: 'This might be over-engineered. Consider if all patterns are necessary.'
      });
    }

    return warnings;
  }

  /**
   * Suggest simpler alternatives
   */
  private async suggestAlternatives(code: string, complexity: ComplexityScore): Promise<Alternative[]> {
    const alternatives: Alternative[] = [];

    // Only suggest alternatives for complex code
    if (complexity.overall === 'simple' || complexity.overall === 'moderate') {
      return alternatives;
    }

    // Suggest async/await instead of callbacks
    if (this.hasCallbackHell(code)) {
      alternatives.push({
        description: 'Use async/await instead of nested callbacks',
        code: this.convertToAsyncAwait(code),
        pros: ['More readable', 'Easier to debug', 'Better error handling'],
        cons: ['Requires understanding of Promises'],
        complexity: { ...complexity, cognitive: Math.floor(complexity.cognitive * 0.6), overall: 'moderate', score: complexity.score * 0.6 },
        recommended: true
      });
    }

    // Suggest early returns to reduce nesting
    if (complexity.nesting > 3) {
      alternatives.push({
        description: 'Use early returns to reduce nesting',
        code: '// Refactor with guard clauses and early returns',
        pros: ['Reduced nesting', 'Clearer logic flow', 'Easier to read'],
        cons: ['Multiple return points (some consider this a con)'],
        complexity: { ...complexity, nesting: Math.max(1, complexity.nesting - 2), overall: 'moderate', score: complexity.score * 0.7 },
        recommended: true
      });
    }

    return alternatives;
  }

  /**
   * Generate rationale for why code was written this way
   */
  private generateRationale(patterns: CodePattern[], complexity: ComplexityScore, context?: string): string {
    const parts: string[] = [];

    if (patterns.length > 0) {
      const patternNames = patterns.map(p => p.name).join(', ');
      parts.push(`This code uses ${patterns.length} pattern(s): ${patternNames}.`);
    }

    if (complexity.overall === 'very-complex' || complexity.overall === 'complex') {
      parts.push(`The complexity is ${complexity.overall} (score: ${complexity.score}/100), which may indicate:`);
      parts.push('- Handling multiple edge cases');
      parts.push('- Complex business logic requirements');
      parts.push('- Potential over-engineering');
    }

    if (context) {
      parts.push(`\nContext: ${context}`);
    }

    return parts.join('\n');
  }

  /**
   * Create a learning path based on detected patterns
   */
  private createLearningPath(patterns: CodePattern[], complexity: ComplexityScore): string[] {
    const path: string[] = [];

    // Start with basics if complexity is high
    if (complexity.overall === 'very-complex' || complexity.overall === 'complex') {
      path.push('Understanding Code Complexity');
      path.push('Refactoring Techniques');
    }

    // Add pattern-specific learning
    for (const pattern of patterns) {
      if (pattern.category === 'design-pattern') {
        path.push(`${pattern.name} Pattern`);
      } else if (pattern.category === 'anti-pattern') {
        path.push(`Avoiding ${pattern.name}`);
      }
    }

    // Add advanced topics
    if (patterns.some(p => p.category === 'design-pattern')) {
      path.push('SOLID Principles');
      path.push('Clean Code Practices');
    }

    return [...new Set(path)]; // Remove duplicates
  }

  // Pattern detection helpers
  private hasFactoryPattern(code: string): boolean {
    return /function\s+create\w+|class\s+\w+Factory|\bnew\s+\w+\(/g.test(code);
  }

  private hasDependencyInjection(code: string): boolean {
    return /constructor\s*\([^)]*:\s*\w+/g.test(code) || /@inject|@Injectable/i.test(code);
  }

  private hasGodObject(code: string): boolean {
    // Simple heuristic: class with >10 methods
    const methodCount = (code.match(/\w+\s*\([^)]*\)\s*{/g) || []).length;
    return methodCount > 10;
  }

  private hasCallbackHell(code: string): boolean {
    // Detect nested callbacks (3+ levels)
    const callbackPattern = /function\s*\([^)]*\)\s*{[^}]*function\s*\([^)]*\)\s*{[^}]*function\s*\([^)]*\)\s*{/;
    return callbackPattern.test(code);
  }

  private convertToAsyncAwait(code: string): string {
    // Simplified conversion example
    return '// Example async/await refactor:\n' +
      'async function example() {\n' +
      '  try {\n' +
      '    const result1 = await operation1();\n' +
      '    const result2 = await operation2(result1);\n' +
      '    return result2;\n' +
      '  } catch (error) {\n' +
      '    console.error(error);\n' +
      '  }\n' +
      '}';
  }

  private initializePatternDatabase(): Map<string, CodePattern> {
    // Initialize with common patterns
    return new Map();
  }

  private loadComplexityThresholds(): ComplexityThresholds {
    const config = vscode.workspace.getConfiguration('workspaceRag');
    return {
      cyclomatic: {
        simple: config.get('complexity.cyclomatic.simple', 5),
        moderate: config.get('complexity.cyclomatic.moderate', 10),
        complex: config.get('complexity.cyclomatic.complex', 20)
      },
      cognitive: {
        simple: config.get('complexity.cognitive.simple', 5),
        moderate: config.get('complexity.cognitive.moderate', 10),
        complex: config.get('complexity.cognitive.complex', 15)
      },
      nesting: {
        simple: config.get('complexity.nesting.simple', 2),
        moderate: config.get('complexity.nesting.moderate', 3),
        complex: config.get('complexity.nesting.complex', 4)
      }
    };
  }
}

interface ComplexityThresholds {
  cyclomatic: { simple: number; moderate: number; complex: number };
  cognitive: { simple: number; moderate: number; complex: number };
  nesting: { simple: number; moderate: number; complex: number };
}
