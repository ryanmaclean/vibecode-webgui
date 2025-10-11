/**
 * Performance Optimization System
 * Analyzes code for performance issues and provides optimization suggestions
 */

import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import { extractText } from './utils/langchain';
import { logger } from '../logger';


export interface PerformanceIssue {
  id: string;
  type: 'algorithm' | 'memory' | 'network' | 'database' | 'rendering' | 'bundle';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  lineNumber?: number;
  codeSnippet?: string;
  suggestion: string;
  estimatedImprovement: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface PerformanceReport {
  filePath: string;
  language: string;
  totalIssues: number;
  issuesByType: Record<string, number>;
  issuesBySeverity: Record<string, number>;
  issues: PerformanceIssue[];
  summary: string;
  optimizationScore: number; // 0-100
  recommendations: string[];
  timestamp: Date;
  processingTime: number;
}

export interface PerformanceConfig {
  enabledChecks: string[];
  severityThreshold: 'low' | 'medium' | 'high' | 'critical';
  includeSuggestions: boolean;
  customRules?: Record<string, any>;
}

export class PerformanceOptimization {
  private llm: ChatOpenAI;
  private config: PerformanceConfig;
  private performancePatterns: Map<string, RegExp[]>;

  constructor(apiKey: string, config?: Partial<PerformanceConfig>) {
    this.llm = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: 'gpt-4',
      temperature: 0.1,
    });

    this.config = {
      enabledChecks: config?.enabledChecks || ['algorithm', 'memory', 'network', 'database', 'rendering'],
      severityThreshold: config?.severityThreshold || 'low',
      includeSuggestions: config?.includeSuggestions ?? true,
      customRules: config?.customRules || {},
    };

    this.performancePatterns = this.initializePerformancePatterns();
  }

  /**
   * Initialize performance detection patterns
   */
  private initializePerformancePatterns(): Map<string, RegExp[]> {
    const patterns = new Map();

    // Algorithm patterns
    patterns.set('algorithm', [
      /for\s*\(\s*let\s+i\s*=\s*0;\s*i\s*<\s*array\.length;\s*i\+\+\)/i, // O(n) loops
      /\.forEach\s*\(\s*.*\s*=>\s*\{.*\}/, // forEach in loops
      /\.map\s*\(\s*.*\s*=>\s*\{.*\}/, // map in loops
      /\.filter\s*\(\s*.*\s*=>\s*\{.*\}/, // filter in loops
      /\.reduce\s*\(\s*.*\s*=>\s*\{.*\}/, // reduce in loops
      /O\s*\(\s*n\s*\*\s*n\s*\)/, // O(n²) complexity
      /O\s*\(\s*n\s*\*\s*n\s*\*\s*n\s*\)/, // O(n³) complexity
    ]);

    // Memory patterns
    patterns.set('memory', [
      /addEventListener\s*\(\s*['"][^'"]*['"],\s*function/, // Event listeners
      /setInterval\s*\(\s*function/, // Intervals
      /setTimeout\s*\(\s*function/, // Timeouts
      /new\s+Array\s*\(\s*\d+\s*\)/, // Large array creation
      /\.push\s*\(\s*.*\s*\)/, // Array pushing in loops
      /\.concat\s*\(\s*.*\s*\)/, // Array concatenation
    ]);

    // Network patterns
    patterns.set('network', [
      /fetch\s*\(\s*['"][^'"]*['"]\s*\)/, // Fetch calls
      /axios\s*\.\s*get\s*\(\s*['"][^'"]*['"]\s*\)/, // Axios calls
      /XMLHttpRequest/, // XHR requests
      /\.then\s*\(\s*.*\s*\)/, // Promise chains
      /async\s+function/, // Async functions
      /await\s+/, // Await calls
    ]);

    // Database patterns
    patterns.set('database', [
      /SELECT\s+\*\s+FROM/i, // Select all
      /WHERE\s+.*\s+LIKE\s+['"]%[^'"]*%['"]/i, // LIKE with wildcards
      /JOIN\s+.*\s+ON\s+.*\s*=\s*.*\s*AND/i, // Complex joins
      /GROUP\s+BY/i, // Group by
      /ORDER\s+BY/i, // Order by
      /LIMIT\s+\d+/i, // Limits
    ]);

    // Rendering patterns
    patterns.set('rendering', [
      /\.innerHTML\s*=\s*/, // innerHTML
      /\.outerHTML\s*=\s*/, // outerHTML
      /document\.createElement/, // DOM creation
      /\.appendChild/, // DOM manipulation
      /\.removeChild/, // DOM removal
      /\.replaceChild/, // DOM replacement
    ]);

    // Bundle patterns
    patterns.set('bundle', [
      /import\s+\*\s+as/, // Import all
      /require\s*\(\s*['"][^'"]*['"]\s*\)/, // Require statements
      /from\s+['"][^'"]*['"]/, // From imports
      /export\s+\*/, // Export all
    ]);

    return patterns;
  }

  /**
   * Analyze code for performance issues
   */
  async analyzePerformance(
    filePath: string,
    content: string,
    language: string
  ): Promise<PerformanceReport> {
    const startTime = Date.now();
    const issues: PerformanceIssue[] = [];

    // Pattern-based detection
    for (const [type, patterns] of this.performancePatterns) {
      if (this.config.enabledChecks.includes(type)) {
        const typeIssues = this.detectPatternIssues(content, type, patterns, language);
        issues.push(...typeIssues);
      }
    }

    // AI-powered analysis for complex performance issues
    const aiIssues = await this.performAIAnalysis(content, language);
    issues.push(...aiIssues);

    // Filter by severity threshold
    const severityOrder = { 'low': 0, 'medium': 1, 'high': 2, 'critical': 3 };
    const thresholdLevel = severityOrder[this.config.severityThreshold];
    const filteredIssues = issues.filter(
      issue => severityOrder[issue.severity] >= thresholdLevel
    );

    // Calculate optimization score
    const optimizationScore = this.calculateOptimizationScore(filteredIssues);

    // Generate summary and recommendations
    const summary = this.generateSummary(filteredIssues, language);
    const recommendations = this.generateRecommendations(filteredIssues);

    const processingTime = Date.now() - startTime;

    return {
      filePath,
      language,
      totalIssues: filteredIssues.length,
      issuesByType: this.groupByType(filteredIssues),
      issuesBySeverity: this.groupBySeverity(filteredIssues),
      issues: filteredIssues,
      summary,
      optimizationScore,
      recommendations,
      timestamp: new Date(),
      processingTime,
    };
  }

  /**
   * Detect performance issues using patterns
   */
  private detectPatternIssues(
    content: string,
    type: string,
    patterns: RegExp[],
    language: string
  ): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      for (const pattern of patterns) {
        if (pattern.test(line)) {
          const issue = this.createIssueFromPattern(type, pattern, line, lineNumber, language);
          if (issue) {
            issues.push(issue);
          }
        }
      }
    }

    return issues;
  }

  /**
   * Create performance issue from detected pattern
   */
  private createIssueFromPattern(
    type: string,
    pattern: RegExp,
    line: string,
    lineNumber: number,
    language: string
  ): PerformanceIssue | null {
    const patternStr = pattern.source;
    
    // Determine severity based on pattern type
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let title = 'Performance Issue Detected';
    let description = 'A potential performance issue was found';
    let suggestion = 'Consider optimizing this code for better performance';
    let estimatedImprovement = '5-15% improvement';

    // Customize based on pattern type
    if (type === 'algorithm') {
      if (patternStr.includes('n*n') || patternStr.includes('n*n*n')) {
        severity = 'high';
        title = 'High Complexity Algorithm';
        description = 'Detected O(n²) or O(n³) complexity algorithm';
        suggestion = 'Consider using more efficient algorithms or data structures';
        estimatedImprovement = '50-90% improvement for large datasets';
      } else if (patternStr.includes('forEach') || patternStr.includes('map') || patternStr.includes('filter')) {
        severity = 'medium';
        title = 'Inefficient Array Operations';
        description = 'Array methods used in potentially inefficient ways';
        suggestion = 'Consider combining operations or using more efficient loops';
        estimatedImprovement = '20-40% improvement';
      }
    } else if (type === 'memory') {
      if (patternStr.includes('addEventListener') || patternStr.includes('setInterval') || patternStr.includes('setTimeout')) {
        severity = 'medium';
        title = 'Potential Memory Leak';
        description = 'Event listeners or timers that may not be properly cleaned up';
        suggestion = 'Ensure proper cleanup of event listeners and timers';
        estimatedImprovement = 'Prevents memory leaks';
      }
    } else if (type === 'network') {
      if (patternStr.includes('fetch') || patternStr.includes('axios')) {
        severity = 'low';
        title = 'Network Request';
        description = 'Network request detected - consider caching strategies';
        suggestion = 'Implement request caching and debouncing where appropriate';
        estimatedImprovement = '10-30% improvement with caching';
      }
    }

    return {
      id: `${type}-${lineNumber}-${Date.now()}`,
      type: type as any,
      severity,
      title,
      description,
      impact: this.getImpactDescription(severity),
      lineNumber,
      codeSnippet: line.trim(),
      suggestion,
      estimatedImprovement,
      confidence: 0.8,
      metadata: {
        pattern: patternStr,
        language,
        lineNumber,
      },
    };
  }

  /**
   * Get impact description based on severity
   */
  private getImpactDescription(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'Severe performance degradation, immediate attention required';
      case 'high':
        return 'Significant performance impact, should be addressed soon';
      case 'medium':
        return 'Moderate performance impact, consider optimization';
      case 'low':
        return 'Minor performance impact, low priority';
      default:
        return 'Unknown impact level';
    }
  }

  /**
   * Perform AI-powered performance analysis
   */
  private async performAIAnalysis(
    content: string,
    language: string
  ): Promise<PerformanceIssue[]> {
    const issues: PerformanceIssue[] = [];

    try {
      const prompt = PromptTemplate.fromTemplate(`
        You are an expert performance optimization specialist analyzing {language} code.
        
        Code to analyze:
        {code}
        
        Focus on identifying:
        1. Algorithm inefficiencies (O(n²), O(n³), etc.)
        2. Memory leaks and inefficient memory usage
        3. Network request optimization opportunities
        4. Database query performance issues
        5. Rendering and DOM manipulation inefficiencies
        6. Bundle size and import optimization
        
        For each issue found, provide:
        - Issue type (algorithm/memory/network/database/rendering/bundle)
        - Severity (low/medium/high/critical)
        - Clear description of the problem
        - Specific optimization suggestion
        - Estimated performance improvement
        
        Return your analysis in a structured format.
      `);

      // Create a formatted prompt for the LLM
      const formattedPrompt = await prompt.format({
        language,
        code: content.substring(0, 4000),
      });
      
      const response = await this.llm.invoke(formattedPrompt);
<<<<<<< HEAD
<<<<<<< HEAD
=======
      const response = await this.llm.invoke(
        prompt.format({
          language,
          code: content.substring(0, 4000),
        })
      );
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup

      const aiIssues = this.parseAIResponse(extractText(response));
=======
      const aiIssues = this.parseAIResponse(response.content as string);
>>>>>>> fix/consolidated-dependency-updates
      issues.push(...aiIssues);

    } catch (error) {
      logger.error('AI performance analysis failed:', { error: error });
    }

    return issues;
  }

  /**
   * Parse AI response into structured issues
   */
  private parseAIResponse(response: string): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    try {
      const lines = response.split('\n');
      let currentIssue: Partial<PerformanceIssue> = {};

      for (const line of lines) {
        if (line.includes('Issue:') || line.includes('Problem:')) {
          if (currentIssue.title) {
            issues.push(currentIssue as PerformanceIssue);
          }
          currentIssue = {
            title: line.split(':')[1]?.trim() || '',
            confidence: 0.8,
          };
        } else if (line.includes('Type:')) {
          const type = line.split(':')[1]?.trim().toLowerCase();
          if (type && ['algorithm', 'memory', 'network', 'database', 'rendering', 'bundle'].includes(type)) {
            currentIssue.type = type as any;
          }
        } else if (line.includes('Severity:')) {
          const severity = line.split(':')[1]?.trim().toLowerCase();
          if (severity && ['low', 'medium', 'high', 'critical'].includes(severity)) {
            currentIssue.severity = severity as any;
          }
        } else if (line.includes('Description:')) {
          currentIssue.description = line.split(':')[1]?.trim() || '';
        } else if (line.includes('Suggestion:')) {
          currentIssue.suggestion = line.split(':')[1]?.trim() || '';
        } else if (line.includes('Improvement:')) {
          currentIssue.estimatedImprovement = line.split(':')[1]?.trim() || '';
        }
      }

      if (currentIssue.title) {
        issues.push(currentIssue as PerformanceIssue);
      }

    } catch (error) {
      logger.error('Failed to parse AI response:', { error: error });
    }

    return issues;
  }

  /**
   * Calculate optimization score (0-100)
   */
  private calculateOptimizationScore(issues: PerformanceIssue[]): number {
    if (issues.length === 0) return 100;

    const severityWeights = {
      'low': 1,
      'medium': 3,
      'high': 7,
      'critical': 15,
    };

    const totalWeight = issues.reduce((sum, issue) => {
      return sum + severityWeights[issue.severity];
    }, 0);

    // Convert to 0-100 scale (higher is better)
    const maxPossibleWeight = 100;
    const score = Math.max(0, maxPossibleWeight - totalWeight);
    
    return Math.round(score);
  }

  /**
   * Generate summary of performance analysis
   */
  private generateSummary(issues: PerformanceIssue[], language: string): string {
    if (issues.length === 0) {
      return `✅ Excellent! No performance issues found in ${language} code.`;
    }

    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const highCount = issues.filter(i => i.severity === 'high').length;
    const total = issues.length;

    let summary = `Found ${total} performance issues in ${language} code:`;
    
    if (criticalCount > 0) {
      summary += `\n🚨 ${criticalCount} critical issues requiring immediate attention`;
    }
    
    if (highCount > 0) {
      summary += `\n⚠️ ${highCount} high-priority issues to address soon`;
    }

    return summary;
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(issues: PerformanceIssue[]): string[] {
    const recommendations: string[] = [];
    const types = new Set(issues.map(i => i.type));

    if (types.has('algorithm')) {
      recommendations.push('⚡ Optimize algorithms - consider using more efficient data structures');
    }

    if (types.has('memory')) {
      recommendations.push('🧠 Address memory leaks - implement proper cleanup for event listeners and timers');
    }

    if (types.has('network')) {
      recommendations.push('🌐 Implement caching strategies for network requests');
    }

    if (types.has('database')) {
      recommendations.push('🗄️ Optimize database queries - add proper indexes and limit result sets');
    }

    if (types.has('rendering')) {
      recommendations.push('🎨 Optimize DOM operations - batch updates and use virtual scrolling for large lists');
    }

    if (types.has('bundle')) {
      recommendations.push('📦 Optimize bundle size - use tree shaking and code splitting');
    }

    if (issues.length > 5) {
      recommendations.push('📊 Consider implementing performance monitoring and profiling tools');
    }

    return recommendations;
  }

  /**
   * Group issues by type
   */
  private groupByType(issues: PerformanceIssue[]): Record<string, number> {
    return issues.reduce((acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Group issues by severity
   */
  private groupBySeverity(issues: PerformanceIssue[]): Record<string, number> {
    return issues.reduce((acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Add custom performance pattern
   */
  addCustomPattern(type: string, pattern: RegExp): void {
    if (!this.performancePatterns.has(type)) {
      this.performancePatterns.set(type, []);
    }
    this.performancePatterns.get(type)!.push(pattern);
  }

  /**
   * Get current configuration
   */
  getConfig(): PerformanceConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

/**
 * Factory function to create performance optimization analyzer
 */
export function createPerformanceOptimization(
  apiKey: string,
  config?: Partial<PerformanceConfig>
): PerformanceOptimization {
  return new PerformanceOptimization(apiKey, config);
}
