/**
 * Code Review Automation System
 * Provides automated code review capabilities with configurable rules and AI-powered analysis
 */

import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';

export interface CodeReviewRule {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'security' | 'performance' | 'quality' | 'maintainability' | 'accessibility';
  enabled: boolean;
  patterns?: string[];
  customPrompt?: string;
}

export interface CodeReviewResult {
  ruleId: string;
  ruleName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  message: string;
  lineNumber?: number;
  codeSnippet?: string;
  suggestion?: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface CodeReviewReport {
  filePath: string;
  language: string;
  totalIssues: number;
  issuesBySeverity: Record<string, number>;
  issuesByCategory: Record<string, number>;
  results: CodeReviewResult[];
  summary: string;
  recommendations: string[];
  timestamp: Date;
  processingTime: number;
}

export interface CodeReviewConfig {
  rules: CodeReviewRule[];
  maxIssuesPerFile?: number;
  confidenceThreshold?: number;
  includeSuggestions?: boolean;
  customPrompts?: Record<string, string>;
}

export class CodeReviewAutomation {
  private llm: ChatOpenAI;
  private config: CodeReviewConfig;
  private defaultRules: CodeReviewRule[];

  constructor(apiKey: string, config?: Partial<CodeReviewConfig>) {
    this.llm = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: 'gpt-4',
      temperature: 0.1,
    });

    this.defaultRules = this.initializeDefaultRules();
    this.config = {
      rules: [...this.defaultRules, ...(config?.rules || [])],
      maxIssuesPerFile: config?.maxIssuesPerFile || 50,
      confidenceThreshold: config?.confidenceThreshold || 0.7,
      includeSuggestions: config?.includeSuggestions ?? true,
      customPrompts: config?.customPrompts || {},
    };
  }

  /**
   * Initialize default code review rules
   */
  private initializeDefaultRules(): CodeReviewRule[] {
    return [
      // Security Rules
      {
        id: 'security-password-hash',
        name: 'Password Hashing',
        description: 'Ensure passwords are properly hashed using bcrypt or similar',
        severity: 'critical',
        category: 'security',
        enabled: true,
        patterns: ['password.*=.*["\']', 'password.*:.*["\']'],
      },
      {
        id: 'security-sql-injection',
        name: 'SQL Injection Prevention',
        description: 'Check for potential SQL injection vulnerabilities',
        severity: 'critical',
        category: 'security',
        enabled: true,
        patterns: ['SELECT.*\\+.*\\$', 'INSERT.*\\+.*\\$', 'UPDATE.*\\+.*\\$'],
      },
      {
        id: 'security-xss-prevention',
        name: 'XSS Prevention',
        description: 'Ensure proper escaping of user input to prevent XSS',
        severity: 'high',
        category: 'security',
        enabled: true,
        patterns: ['innerHTML.*=', 'dangerouslySetInnerHTML'],
      },

      // Performance Rules
      {
        id: 'performance-n-plus-one',
        name: 'N+1 Query Detection',
        description: 'Identify potential N+1 query patterns in loops',
        severity: 'medium',
        category: 'performance',
        enabled: true,
        patterns: ['for.*{.*query', 'forEach.*{.*query', 'map.*{.*query'],
      },
      {
        id: 'performance-memory-leak',
        name: 'Memory Leak Detection',
        description: 'Check for potential memory leaks in event listeners',
        severity: 'medium',
        category: 'performance',
        enabled: true,
        patterns: ['addEventListener.*function', 'on.*=.*function'],
      },

      // Quality Rules
      {
        id: 'quality-unused-variables',
        name: 'Unused Variables',
        description: 'Identify unused variables and imports',
        severity: 'low',
        category: 'quality',
        enabled: true,
      },
      {
        id: 'quality-magic-numbers',
        name: 'Magic Numbers',
        description: 'Replace magic numbers with named constants',
        severity: 'low',
        category: 'quality',
        enabled: true,
        patterns: ['\\b[0-9]{2,}\\b'],
      },

      // Maintainability Rules
      {
        id: 'maintainability-function-length',
        name: 'Function Length',
        description: 'Functions should be concise and focused',
        severity: 'medium',
        category: 'maintainability',
        enabled: true,
      },
      {
        id: 'maintainability-cyclomatic-complexity',
        name: 'Cyclomatic Complexity',
        description: 'Reduce complex conditional logic',
        severity: 'medium',
        category: 'maintainability',
        enabled: true,
      },
    ];
  }

  /**
   * Review a single file
   */
  async reviewFile(
    filePath: string,
    content: string,
    language: string
  ): Promise<CodeReviewReport> {
    const startTime = Date.now();
    const enabledRules = this.config.rules.filter(rule => rule.enabled);

    const results: CodeReviewResult[] = [];
    let totalIssues = 0;

    // Pattern-based rule checking
    for (const rule of enabledRules) {
      if (rule.patterns) {
        const patternResults = this.checkPatterns(content, rule, language);
        results.push(...patternResults);
        totalIssues += patternResults.length;
      }
    }

    // AI-powered analysis for complex rules
    const aiResults = await this.performAIAnalysis(content, language, enabledRules);
    results.push(...aiResults);
    totalIssues += aiResults.length;

    // Limit results based on configuration
    if (totalIssues > this.config.maxIssuesPerFile!) {
      results.splice(this.config.maxIssuesPerFile!);
      totalIssues = this.config.maxIssuesPerFile!;
    }

    // Generate summary and recommendations
    const summary = this.generateSummary(results, language);
    const recommendations = this.generateRecommendations(results);

    const processingTime = Date.now() - startTime;

    return {
      filePath,
      language,
      totalIssues,
      issuesBySeverity: this.groupBySeverity(results),
      issuesByCategory: this.groupByCategory(results),
      results,
      summary,
      recommendations,
      timestamp: new Date(),
      processingTime,
    };
  }

  /**
   * Check patterns against code content
   */
  private checkPatterns(
    content: string,
    rule: CodeReviewRule,
    language: string
  ): CodeReviewResult[] {
    const results: CodeReviewResult[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      for (const pattern of rule.patterns!) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(line)) {
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            category: rule.category,
            message: rule.description,
            lineNumber,
            codeSnippet: line.trim(),
            confidence: 0.9,
            metadata: {
              pattern,
              language,
            },
          });
        }
      }
    }

    return results;
  }

  /**
   * Perform AI-powered analysis
   */
  private async performAIAnalysis(
    content: string,
    language: string,
    rules: CodeReviewRule[]
  ): Promise<CodeReviewResult[]> {
    const results: CodeReviewResult[] = [];

    try {
      // Create a comprehensive prompt for AI analysis
      const prompt = PromptTemplate.fromTemplate(`
        You are an expert code reviewer analyzing {language} code for potential issues.
        
        Code to review:
        {code}
        
        Focus on these categories:
        - Security vulnerabilities
        - Performance issues
        - Code quality problems
        - Maintainability concerns
        - Best practices violations
        
        For each issue found, provide:
        1. A clear description of the problem
        2. The severity level (low/medium/high/critical)
        3. The category it belongs to
        4. A specific suggestion for improvement
        5. Confidence level (0.0-1.0)
        
        Return your analysis in a structured format.
      `);

      // Create a formatted prompt for the LLM
      const formattedPrompt = await prompt.format({
        language,
        code: content.substring(0, 4000), // Limit content length
      });

      const response = await this.llm.invoke(formattedPrompt);
<<<<<<< HEAD
<<<<<<< HEAD
=======
      const response = await this.llm.invoke(
        prompt.format({
          language,
          code: content.substring(0, 4000), // Limit content length
        })
      );
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup

=======
>>>>>>> fix/consolidated-dependency-updates
      // Parse AI response and convert to structured results
      const aiIssues = this.parseAIResponse(response.content as string, rules);
      results.push(...aiIssues);

    } catch (error) {
      console.error('AI analysis failed:', error);
      // Continue without AI results
    }

    return results;
  }

  /**
   * Parse AI response into structured results
   */
  private parseAIResponse(response: string, rules: CodeReviewRule[]): CodeReviewResult[] {
    const results: CodeReviewResult[] = [];

    try {
      // Simple parsing - in production, use more sophisticated parsing
      const lines = response.split('\n');
      let currentIssue: Partial<CodeReviewResult> = {};

      for (const line of lines) {
        if (line.includes('Issue:') || line.includes('Problem:')) {
          if (currentIssue.message) {
            results.push(currentIssue as CodeReviewResult);
          }
          currentIssue = {
            message: line.split(':')[1]?.trim() || '',
            confidence: 0.8,
          };
        } else if (line.includes('Severity:')) {
          const severity = line.split(':')[1]?.trim().toLowerCase();
          if (severity && ['low', 'medium', 'high', 'critical'].includes(severity)) {
            currentIssue.severity = severity as any;
          }
        } else if (line.includes('Category:')) {
          currentIssue.category = line.split(':')[1]?.trim() || 'quality';
        } else if (line.includes('Suggestion:')) {
          currentIssue.suggestion = line.split(':')[1]?.trim();
        }
      }

      // Add the last issue
      if (currentIssue.message) {
        results.push(currentIssue as CodeReviewResult);
      }

    } catch (error) {
      console.error('Failed to parse AI response:', error);
    }

    return results;
  }

  /**
   * Generate summary of review results
   */
  private generateSummary(results: CodeReviewResult[], language: string): string {
    const criticalCount = results.filter(r => r.severity === 'critical').length;
    const highCount = results.filter(r => r.severity === 'high').length;
    const total = results.length;

    if (total === 0) {
      return `✅ No issues found in ${language} code. Great job!`;
    }

    let summary = `Found ${total} issues in ${language} code:`;
    
    if (criticalCount > 0) {
      summary += `\n🚨 ${criticalCount} critical issues that need immediate attention`;
    }
    
    if (highCount > 0) {
      summary += `\n⚠️ ${highCount} high-priority issues to address soon`;
    }

    return summary;
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(results: CodeReviewResult[]): string[] {
    const recommendations: string[] = [];
    const categories = new Set(results.map(r => r.category));

    if (categories.has('security')) {
      recommendations.push('🔒 Prioritize security fixes - consider using automated security scanning tools');
    }

    if (categories.has('performance')) {
      recommendations.push('⚡ Address performance issues early - they become harder to fix later');
    }

    if (categories.has('maintainability')) {
      recommendations.push('🏗️ Refactor complex code to improve maintainability and reduce technical debt');
    }

    if (results.length > 10) {
      recommendations.push('📊 Consider breaking down large files into smaller, focused modules');
    }

    return recommendations;
  }

  /**
   * Group results by severity
   */
  private groupBySeverity(results: CodeReviewResult[]): Record<string, number> {
    return results.reduce((acc, result) => {
      acc[result.severity] = (acc[result.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Group results by category
   */
  private groupByCategory(results: CodeReviewResult[]): Record<string, number> {
    return results.reduce((acc, result) => {
      acc[result.category] = (acc[result.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Add custom rule
   */
  addCustomRule(rule: CodeReviewRule): void {
    this.config.rules.push(rule);
  }

  /**
   * Enable/disable specific rules
   */
  toggleRule(ruleId: string, enabled: boolean): void {
    const rule = this.config.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): CodeReviewConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<CodeReviewConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

/**
 * Factory function to create code review automation
 */
export function createCodeReviewAutomation(
  apiKey: string,
  config?: Partial<CodeReviewConfig>
): CodeReviewAutomation {
  return new CodeReviewAutomation(apiKey, config);
}
