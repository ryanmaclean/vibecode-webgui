/**
 * ConventionsAggregator - Aggregate project coding conventions from multiple sources
 *
 * Combines naming conventions, design patterns, and architectural insights
 * from multiple files to build a comprehensive project convention profile.
 */

import { NamingDetector, NamingDetectionResult, NamingPattern, NamingCase } from './naming-detector';
import { PatternDetector, PatternDetectionResult, DetectedPattern, PatternType } from './pattern-detector';

/**
 * Represents an aggregated project convention
 */
export interface ProjectConvention {
  /** Convention category */
  category: ConventionCategory;
  /** Description of the convention */
  description: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Example code snippets demonstrating the convention */
  examples: string[];
  /** Number of files that follow this convention */
  fileCount: number;
  /** Source files where convention was detected */
  sources: string[];
}

/**
 * Convention categories
 */
export enum ConventionCategory {
  /** Variable naming conventions */
  VARIABLE_NAMING = 'variable_naming',
  /** Function naming conventions */
  FUNCTION_NAMING = 'function_naming',
  /** Class naming conventions */
  CLASS_NAMING = 'class_naming',
  /** File organization patterns */
  FILE_ORGANIZATION = 'file_organization',
  /** Design patterns in use */
  DESIGN_PATTERNS = 'design_patterns',
  /** Architectural style */
  ARCHITECTURE = 'architecture',
  /** Code formatting preferences */
  FORMATTING = 'formatting',
  /** Project-specific patterns */
  PROJECT_SPECIFIC = 'project_specific'
}

/**
 * Aggregated project conventions result
 */
export interface ProjectConventionsResult {
  /** All detected conventions grouped by category */
  conventions: Record<ConventionCategory, ProjectConvention[]>;
  /** Overall project statistics */
  stats: {
    /** Total files analyzed */
    totalFiles: number;
    /** Total conventions detected */
    totalConventions: number;
    /** Overall consistency score (0-1) */
    consistencyScore: number;
    /** Dominant architectural style */
    architectureStyle: 'functional' | 'object-oriented' | 'mixed';
    /** Dominant naming case for variables */
    dominantVariableCase: NamingCase;
    /** Dominant naming case for classes */
    dominantClassCase: NamingCase;
  };
  /** Top recommended conventions to follow */
  recommendations: {
    /** Convention category */
    category: ConventionCategory;
    /** Recommendation text */
    recommendation: string;
    /** Priority (1-5, lower is higher) */
    priority: number;
    /** Examples to follow */
    examples: string[];
  }[];
  /** Common inconsistencies found */
  inconsistencies: {
    /** Description of the inconsistency */
    issue: string;
    /** Files affected */
    files: string[];
    /** Suggested fix */
    suggestion: string;
  }[];
  /** Analysis timestamp */
  analyzedAt: Date;
}

/**
 * Options for ConventionsAggregator
 */
export interface ConventionsAggregatorOptions {
  /** Naming detector instance */
  namingDetector?: NamingDetector;
  /** Pattern detector instance */
  patternDetector?: PatternDetector;
  /** Minimum confidence threshold (0-1, default: 0.7) */
  minConfidence?: number;
  /** Minimum file count for a convention to be included (default: 2) */
  minFileCount?: number;
  /** Maximum examples per convention (default: 5) */
  maxExamples?: number;
  /** Enable recommendation generation (default: true) */
  generateRecommendations?: boolean;
  /** Enable inconsistency detection (default: true) */
  detectInconsistencies?: boolean;
}

/**
 * File analysis result (internal)
 */
interface FileAnalysis {
  fileName: string;
  namingResult: NamingDetectionResult;
  patternResult: PatternDetectionResult;
}

/**
 * ConventionsAggregator class for aggregating project conventions
 */
export class ConventionsAggregator {
  private readonly namingDetector: NamingDetector;
  private readonly patternDetector: PatternDetector;
  private readonly options: Required<Omit<ConventionsAggregatorOptions, 'namingDetector' | 'patternDetector'>>;

  private fileAnalyses: FileAnalysis[] = [];
  private lastAggregation: ProjectConventionsResult | null = null;

  constructor(options: ConventionsAggregatorOptions = {}) {
    this.namingDetector = options.namingDetector || new NamingDetector();
    this.patternDetector = options.patternDetector || new PatternDetector();

    this.options = {
      minConfidence: options.minConfidence ?? 0.7,
      minFileCount: options.minFileCount ?? 2,
      maxExamples: options.maxExamples ?? 5,
      generateRecommendations: options.generateRecommendations ?? true,
      detectInconsistencies: options.detectInconsistencies ?? true
    };
  }

  /**
   * Analyze a single file and add to the aggregation pool
   */
  analyzeFile(sourceCode: string, fileName: string): void {
    const namingResult = this.namingDetector.detect(sourceCode, fileName);
    const patternResult = this.patternDetector.detect(sourceCode, fileName);

    this.fileAnalyses.push({
      fileName,
      namingResult,
      patternResult
    });
  }

  /**
   * Analyze multiple files in batch
   */
  analyzeFiles(files: { code: string; path: string }[]): void {
    for (const file of files) {
      this.analyzeFile(file.code, file.path);
    }
  }

  /**
   * Aggregate all analyzed files into project conventions
   */
  aggregate(): ProjectConventionsResult {
    if (this.fileAnalyses.length === 0) {
      return this.createEmptyResult();
    }

    // Aggregate naming conventions
    const namingConventions = this.aggregateNamingConventions();

    // Aggregate pattern conventions
    const patternConventions = this.aggregatePatternConventions();

    // Aggregate architectural insights
    const architectureConventions = this.aggregateArchitectureConventions();

    // Aggregate file organization
    const fileOrgConventions = this.aggregateFileOrganizationConventions();

    // Build conventions map
    const conventions: Record<ConventionCategory, ProjectConvention[]> = {
      [ConventionCategory.VARIABLE_NAMING]: namingConventions.variables,
      [ConventionCategory.FUNCTION_NAMING]: namingConventions.functions,
      [ConventionCategory.CLASS_NAMING]: namingConventions.classes,
      [ConventionCategory.FILE_ORGANIZATION]: fileOrgConventions,
      [ConventionCategory.DESIGN_PATTERNS]: patternConventions,
      [ConventionCategory.ARCHITECTURE]: architectureConventions,
      [ConventionCategory.FORMATTING]: [],
      [ConventionCategory.PROJECT_SPECIFIC]: []
    };

    // Calculate statistics
    const stats = this.calculateStatistics(conventions);

    // Generate recommendations
    const recommendations = this.options.generateRecommendations
      ? this.generateRecommendations(conventions, stats)
      : [];

    // Detect inconsistencies
    const inconsistencies = this.options.detectInconsistencies
      ? this.detectInconsistencies()
      : [];

    const result: ProjectConventionsResult = {
      conventions,
      stats,
      recommendations,
      inconsistencies,
      analyzedAt: new Date()
    };

    this.lastAggregation = result;
    return result;
  }

  /**
   * Get the last aggregation result without re-analyzing
   */
  getLastResult(): ProjectConventionsResult | null {
    return this.lastAggregation;
  }

  /**
   * Clear all analyzed files and reset state
   */
  clear(): void {
    this.fileAnalyses = [];
    this.lastAggregation = null;
  }

  /**
   * Get current analysis count
   */
  getAnalysisCount(): number {
    return this.fileAnalyses.length;
  }

  // ==================== Private Aggregation Methods ====================

  /**
   * Aggregate naming conventions from all files
   */
  private aggregateNamingConventions() {
    const variables: ProjectConvention[] = [];
    const functions: ProjectConvention[] = [];
    const classes: ProjectConvention[] = [];

    // Aggregate variable naming
    const variablePatterns = this.aggregateNamingPattern(
      analyses => analyses.namingResult.conventions.variables.regular,
      'Regular variables'
    );
    if (variablePatterns) variables.push(variablePatterns);

    const constantPatterns = this.aggregateNamingPattern(
      analyses => analyses.namingResult.conventions.variables.constants,
      'Constants'
    );
    if (constantPatterns) variables.push(constantPatterns);

    // Aggregate function naming
    const functionPatterns = this.aggregateNamingPattern(
      analyses => analyses.namingResult.conventions.functions.regular,
      'Regular functions'
    );
    if (functionPatterns) functions.push(functionPatterns);

    const asyncFunctionPatterns = this.aggregateNamingPattern(
      analyses => analyses.namingResult.conventions.functions.async,
      'Async functions'
    );
    if (asyncFunctionPatterns) functions.push(asyncFunctionPatterns);

    // Aggregate class naming
    const classPatterns = this.aggregateNamingPattern(
      analyses => analyses.namingResult.conventions.classes.regular,
      'Classes'
    );
    if (classPatterns) classes.push(classPatterns);

    const interfacePatterns = this.aggregateNamingPattern(
      analyses => analyses.namingResult.conventions.classes.interfaces,
      'Interfaces'
    );
    if (interfacePatterns) classes.push(interfacePatterns);

    const typePatterns = this.aggregateNamingPattern(
      analyses => analyses.namingResult.conventions.classes.types,
      'Type aliases'
    );
    if (typePatterns) classes.push(typePatterns);

    return { variables, functions, classes };
  }

  /**
   * Helper to aggregate a specific naming pattern across files
   */
  private aggregateNamingPattern(
    extractor: (analysis: FileAnalysis) => NamingPattern,
    description: string
  ): ProjectConvention | null {
    const patterns = this.fileAnalyses
      .map(analysis => ({
        pattern: extractor(analysis),
        fileName: analysis.fileName
      }))
      .filter(({ pattern }) => pattern.count > 0 && pattern.confidence >= this.options.minConfidence);

    if (patterns.length < this.options.minFileCount) {
      return null;
    }

    // Find dominant case style
    const caseCounts = new Map<NamingCase, number>();
    patterns.forEach(({ pattern }) => {
      caseCounts.set(pattern.case, (caseCounts.get(pattern.case) || 0) + 1);
    });
    const dominantCase = Array.from(caseCounts.entries())
      .sort((a, b) => b[1] - a[1])[0][0];

    // Collect examples from files using dominant case
    const examples = patterns
      .filter(({ pattern }) => pattern.case === dominantCase)
      .flatMap(({ pattern }) => pattern.examples)
      .slice(0, this.options.maxExamples);

    // Calculate average confidence
    const avgConfidence = patterns.reduce((sum, { pattern }) => sum + pattern.confidence, 0) / patterns.length;

    // Collect common prefixes/suffixes
    const prefixes = this.getMostCommon(
      patterns.flatMap(({ pattern }) => pattern.prefixes),
      3
    );
    const suffixes = this.getMostCommon(
      patterns.flatMap(({ pattern }) => pattern.suffixes),
      3
    );

    let conventionDesc = `${description} use ${dominantCase}`;
    if (prefixes.length > 0) {
      conventionDesc += ` with common prefixes: ${prefixes.join(', ')}`;
    }
    if (suffixes.length > 0) {
      conventionDesc += ` with common suffixes: ${suffixes.join(', ')}`;
    }

    return {
      category: description.toLowerCase().includes('class') || description.toLowerCase().includes('interface') || description.toLowerCase().includes('type')
        ? ConventionCategory.CLASS_NAMING
        : description.toLowerCase().includes('function')
        ? ConventionCategory.FUNCTION_NAMING
        : ConventionCategory.VARIABLE_NAMING,
      description: conventionDesc,
      confidence: avgConfidence,
      examples,
      fileCount: patterns.length,
      sources: patterns.map(({ fileName }) => fileName)
    };
  }

  /**
   * Aggregate pattern conventions from all files
   */
  private aggregatePatternConventions(): ProjectConvention[] {
    const conventions: ProjectConvention[] = [];

    // Group patterns by type
    const patternsByType = new Map<PatternType, DetectedPattern[]>();
    this.fileAnalyses.forEach(analysis => {
      analysis.patternResult.patterns.forEach(pattern => {
        if (!patternsByType.has(pattern.type)) {
          patternsByType.set(pattern.type, []);
        }
        patternsByType.get(pattern.type)!.push(pattern);
      });
    });

    // Create conventions for each pattern type with enough occurrences
    patternsByType.forEach((patterns, type) => {
      const filesWithPattern = new Set(
        this.fileAnalyses
          .filter(a => a.patternResult.patterns.some(p => p.type === type))
          .map(a => a.fileName)
      );

      if (filesWithPattern.size >= this.options.minFileCount) {
        const avgConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;

        if (avgConfidence >= this.options.minConfidence) {
          const examples = patterns
            .slice(0, this.options.maxExamples)
            .map(p => p.name);

          const implementationType = patterns[0]?.metadata.implementationType || 'class';

          conventions.push({
            category: ConventionCategory.DESIGN_PATTERNS,
            description: `${this.patternTypeToDescription(type)} pattern using ${implementationType} implementation`,
            confidence: avgConfidence,
            examples,
            fileCount: filesWithPattern.size,
            sources: Array.from(filesWithPattern)
          });
        }
      }
    });

    return conventions;
  }

  /**
   * Aggregate architectural conventions
   */
  private aggregateArchitectureConventions(): ProjectConvention[] {
    const conventions: ProjectConvention[] = [];

    // Determine overall architectural style
    let functionalCount = 0;
    let oopCount = 0;
    const architectureStyles: Array<'functional' | 'object-oriented' | 'mixed'> = [];

    this.fileAnalyses.forEach(analysis => {
      const arch = analysis.patternResult.architecture;
      architectureStyles.push(arch.style);

      if (arch.style === 'functional') functionalCount++;
      else if (arch.style === 'object-oriented') oopCount++;
    });

    if (this.fileAnalyses.length >= this.options.minFileCount) {
      const dominantStyle = functionalCount > oopCount * 1.5 ? 'functional'
        : oopCount > functionalCount * 1.5 ? 'object-oriented'
        : 'mixed';

      const confidence = dominantStyle === 'mixed' ? 0.6
        : Math.max(functionalCount, oopCount) / this.fileAnalyses.length;

      conventions.push({
        category: ConventionCategory.ARCHITECTURE,
        description: `Project follows ${dominantStyle} programming paradigm`,
        confidence,
        examples: [],
        fileCount: this.fileAnalyses.length,
        sources: this.fileAnalyses.map(a => a.fileName)
      });
    }

    return conventions;
  }

  /**
   * Aggregate file organization conventions
   */
  private aggregateFileOrganizationConventions(): ProjectConvention[] {
    const conventions: ProjectConvention[] = [];

    // Analyze file naming patterns
    const fileNames = this.fileAnalyses.map(a => a.fileName);
    const baseNames = fileNames.map(f => f.split('/').pop()!.replace(/\.(ts|tsx|js|jsx)$/, ''));

    // Detect test file naming
    const testFiles = fileNames.filter(f => /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(f));
    if (testFiles.length >= this.options.minFileCount) {
      const usesTest = testFiles.filter(f => f.includes('.test.')).length;
      const usesSpec = testFiles.filter(f => f.includes('.spec.')).length;
      const convention = usesTest > usesSpec ? '.test.' : '.spec.';

      conventions.push({
        category: ConventionCategory.FILE_ORGANIZATION,
        description: `Test files use ${convention} naming convention`,
        confidence: 0.9,
        examples: testFiles.slice(0, this.options.maxExamples),
        fileCount: testFiles.length,
        sources: testFiles
      });
    }

    // Detect component file naming
    const componentFiles = fileNames.filter(f => /\.(tsx|jsx)$/.test(f));
    if (componentFiles.length >= this.options.minFileCount) {
      const pascalCaseCount = componentFiles.filter(f => {
        const baseName = f.split('/').pop()!.replace(/\.(tsx|jsx)$/, '');
        return /^[A-Z]/.test(baseName);
      }).length;

      if (pascalCaseCount / componentFiles.length > 0.7) {
        conventions.push({
          category: ConventionCategory.FILE_ORGANIZATION,
          description: 'React components use PascalCase file naming',
          confidence: pascalCaseCount / componentFiles.length,
          examples: componentFiles
            .filter(f => /^[A-Z]/.test(f.split('/').pop()!))
            .slice(0, this.options.maxExamples),
          fileCount: componentFiles.length,
          sources: componentFiles
        });
      }
    }

    return conventions;
  }

  /**
   * Calculate overall statistics
   */
  private calculateStatistics(
    conventions: Record<ConventionCategory, ProjectConvention[]>
  ): ProjectConventionsResult['stats'] {
    const totalConventions = Object.values(conventions)
      .reduce((sum, convs) => sum + convs.length, 0);

    // Calculate consistency score (average confidence across all conventions)
    const allConfidences = Object.values(conventions)
      .flat()
      .map(c => c.confidence);
    const consistencyScore = allConfidences.length > 0
      ? allConfidences.reduce((sum, c) => sum + c, 0) / allConfidences.length
      : 0;

    // Determine architecture style
    const archConvention = conventions[ConventionCategory.ARCHITECTURE][0];
    const architectureStyle = archConvention?.description.includes('functional') ? 'functional'
      : archConvention?.description.includes('object-oriented') ? 'object-oriented'
      : 'mixed';

    // Find dominant naming cases
    const variableConventions = conventions[ConventionCategory.VARIABLE_NAMING];
    const dominantVariableCase = this.extractDominantCase(variableConventions) || NamingCase.CAMEL_CASE;

    const classConventions = conventions[ConventionCategory.CLASS_NAMING];
    const dominantClassCase = this.extractDominantCase(classConventions) || NamingCase.PASCAL_CASE;

    return {
      totalFiles: this.fileAnalyses.length,
      totalConventions,
      consistencyScore,
      architectureStyle,
      dominantVariableCase,
      dominantClassCase
    };
  }

  /**
   * Generate recommendations based on conventions
   */
  private generateRecommendations(
    conventions: Record<ConventionCategory, ProjectConvention[]>,
    stats: ProjectConventionsResult['stats']
  ): ProjectConventionsResult['recommendations'] {
    const recommendations: ProjectConventionsResult['recommendations'] = [];

    // Recommend naming conventions
    const variableConv = conventions[ConventionCategory.VARIABLE_NAMING][0];
    if (variableConv) {
      recommendations.push({
        category: ConventionCategory.VARIABLE_NAMING,
        recommendation: variableConv.description,
        priority: 1,
        examples: variableConv.examples
      });
    }

    const functionConv = conventions[ConventionCategory.FUNCTION_NAMING][0];
    if (functionConv) {
      recommendations.push({
        category: ConventionCategory.FUNCTION_NAMING,
        recommendation: functionConv.description,
        priority: 1,
        examples: functionConv.examples
      });
    }

    const classConv = conventions[ConventionCategory.CLASS_NAMING][0];
    if (classConv) {
      recommendations.push({
        category: ConventionCategory.CLASS_NAMING,
        recommendation: classConv.description,
        priority: 1,
        examples: classConv.examples
      });
    }

    // Recommend design patterns
    const patternConvs = conventions[ConventionCategory.DESIGN_PATTERNS]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);

    patternConvs.forEach((conv, index) => {
      recommendations.push({
        category: ConventionCategory.DESIGN_PATTERNS,
        recommendation: `Follow ${conv.description}`,
        priority: 2 + index,
        examples: conv.examples
      });
    });

    // Recommend architecture style if clear
    if (stats.consistencyScore > 0.75) {
      recommendations.push({
        category: ConventionCategory.ARCHITECTURE,
        recommendation: `Maintain ${stats.architectureStyle} programming style for consistency`,
        priority: 2,
        examples: []
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Detect inconsistencies across files
   */
  private detectInconsistencies(): ProjectConventionsResult['inconsistencies'] {
    const inconsistencies: ProjectConventionsResult['inconsistencies'] = [];

    // Collect all naming inconsistencies
    const namingIssues = new Map<string, string[]>();
    this.fileAnalyses.forEach(analysis => {
      analysis.namingResult.inconsistencies.forEach(inc => {
        const key = `${inc.element}: expected ${inc.expectedCase}, got ${inc.actualCase}`;
        if (!namingIssues.has(key)) {
          namingIssues.set(key, []);
        }
        namingIssues.get(key)!.push(analysis.fileName);
      });
    });

    // Convert to inconsistencies format
    namingIssues.forEach((files, issue) => {
      if (files.length >= 2) {
        inconsistencies.push({
          issue: `Naming inconsistency: ${issue}`,
          files,
          suggestion: 'Standardize naming convention across these files'
        });
      }
    });

    // Detect mixed architectural styles
    const styles = this.fileAnalyses.map(a => a.patternResult.architecture.style);
    const functionalFiles = this.fileAnalyses.filter(a => a.patternResult.architecture.style === 'functional');
    const oopFiles = this.fileAnalyses.filter(a => a.patternResult.architecture.style === 'object-oriented');

    if (functionalFiles.length > 2 && oopFiles.length > 2) {
      inconsistencies.push({
        issue: 'Mixed architectural styles detected across project',
        files: [...functionalFiles, ...oopFiles].map(a => a.fileName),
        suggestion: 'Consider adopting a consistent architectural approach project-wide'
      });
    }

    return inconsistencies;
  }

  // ==================== Helper Methods ====================

  /**
   * Create empty result
   */
  private createEmptyResult(): ProjectConventionsResult {
    return {
      conventions: {
        [ConventionCategory.VARIABLE_NAMING]: [],
        [ConventionCategory.FUNCTION_NAMING]: [],
        [ConventionCategory.CLASS_NAMING]: [],
        [ConventionCategory.FILE_ORGANIZATION]: [],
        [ConventionCategory.DESIGN_PATTERNS]: [],
        [ConventionCategory.ARCHITECTURE]: [],
        [ConventionCategory.FORMATTING]: [],
        [ConventionCategory.PROJECT_SPECIFIC]: []
      },
      stats: {
        totalFiles: 0,
        totalConventions: 0,
        consistencyScore: 0,
        architectureStyle: 'mixed',
        dominantVariableCase: NamingCase.CAMEL_CASE,
        dominantClassCase: NamingCase.PASCAL_CASE
      },
      recommendations: [],
      inconsistencies: [],
      analyzedAt: new Date()
    };
  }

  /**
   * Get most common items from array
   */
  private getMostCommon<T>(items: T[], limit: number): T[] {
    const counts = new Map<T, number>();
    items.forEach(item => {
      counts.set(item, (counts.get(item) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([item]) => item);
  }

  /**
   * Extract dominant naming case from conventions
   */
  private extractDominantCase(conventions: ProjectConvention[]): NamingCase | null {
    if (conventions.length === 0) return null;

    // Extract case from description (e.g., "Regular variables use camelCase")
    const caseRegex = /(camelCase|PascalCase|snake_case|SCREAMING_SNAKE_CASE|kebab-case)/;
    for (const conv of conventions) {
      const match = conv.description.match(caseRegex);
      if (match) {
        return match[1] as NamingCase;
      }
    }

    return null;
  }

  /**
   * Convert pattern type to human-readable description
   */
  private patternTypeToDescription(type: PatternType): string {
    const descriptions: Record<PatternType, string> = {
      [PatternType.SINGLETON]: 'Singleton',
      [PatternType.FACTORY]: 'Factory',
      [PatternType.SERVICE]: 'Service',
      [PatternType.HOC]: 'Higher-Order Component',
      [PatternType.HOOK]: 'React Hook',
      [PatternType.BUILDER]: 'Builder',
      [PatternType.REPOSITORY]: 'Repository',
      [PatternType.CONTROLLER]: 'Controller',
      [PatternType.OBSERVER]: 'Observer/Event Emitter',
      [PatternType.STRATEGY]: 'Strategy',
      [PatternType.DECORATOR]: 'Decorator',
      [PatternType.PROVIDER]: 'Provider',
      [PatternType.UTILITY]: 'Utility/Helper'
    };
    return descriptions[type] || type;
  }
}

/**
 * Factory function to create a ConventionsAggregator
 */
export function createConventionsAggregator(
  options?: ConventionsAggregatorOptions
): ConventionsAggregator {
  return new ConventionsAggregator(options);
}
