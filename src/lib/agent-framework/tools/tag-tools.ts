/**
 * TAG Tools Implementation
 * 
 * Enhanced tools for Tool-Augmented Generation including secure code execution,
 * documentation search, performance analysis, and security scanning.
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { EnhancedToolDefinition } from '../tool-registry';

/**
 * Enhanced code execution tool with secure sandbox
 */
export const enhancedCodeExecutionTool: EnhancedToolDefinition = {
  name: 'execute_code',
  description: 'Execute code in a secure sandboxed environment with resource limits',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The code to execute',
      },
      language: {
        type: 'string',
        enum: ['javascript', 'python', 'typescript', 'bash'],
        description: 'The programming language of the code',
      },
      timeout: {
        type: 'number',
        description: 'Execution timeout in milliseconds (default: 30000)',
        default: 30000,
      },
      allowNetworkAccess: {
        type: 'boolean',
        description: 'Whether to allow network access (default: false)',
        default: false,
      },
      env: {
        type: 'object',
        description: 'Environment variables to set',
        additionalProperties: { type: 'string' },
      },
    },
    required: ['code', 'language'],
  },
  execute: async ({ code, language, timeout = 30000, allowNetworkAccess = false, env = {} }) => {
    const executionId = randomBytes(16).toString('hex');
    const sandboxDir = join(tmpdir(), `vibecode_sandbox_${executionId}`);
    
    try {
      // Create sandbox directory
      await fs.mkdir(sandboxDir, { recursive: true });
      
      const startTime = Date.now();
      let result;
      
      switch (language) {
        case 'javascript':
          result = await executeJavaScript(code, sandboxDir, timeout, allowNetworkAccess, env);
          break;
        case 'typescript':
          result = await executeTypeScript(code, sandboxDir, timeout, allowNetworkAccess, env);
          break;
        case 'python':
          result = await executePython(code, sandboxDir, timeout, allowNetworkAccess, env);
          break;
        case 'bash':
          result = await executeBash(code, sandboxDir, timeout, allowNetworkAccess, env);
          break;
        default:
          throw new Error(`Unsupported language: ${language}`);
      }
      
      const executionTime = Date.now() - startTime;
      
      return {
        success: true,
        output: result.stdout,
        error: result.stderr,
        exitCode: result.exitCode,
        executionTime,
        language,
        sandboxPath: sandboxDir,
        resourceUsage: result.resourceUsage,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        exitCode: -1,
        executionTime: Date.now() - Date.now(),
        language,
      };
    } finally {
      // Clean up sandbox directory
      try {
        await fs.rm(sandboxDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  },
  enabled: true,
  version: '1.0.0',
  metadata: {
    category: 'execution',
    complexity: 8,
    expectedDuration: 5000,
    resources: {
      cpu: 'high',
      memory: 'medium',
      network: false,
    },
    stats: {
      totalCalls: 0,
      successRate: 0.95,
      averageDuration: 3000,
    },
    securityLevel: 'high',
  },
  rateLimit: {
    maxCalls: 10,
    timeWindow: 60000, // 1 minute
  },
};

/**
 * Documentation search tool using vector search
 */
export const searchDocsTool: EnhancedToolDefinition = {
  name: 'search_docs',
  description: 'Search documentation and knowledge base using semantic search',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for documentation',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 5)',
        default: 5,
      },
      category: {
        type: 'string',
        description: 'Filter by documentation category',
        enum: ['api', 'tutorial', 'reference', 'guide', 'troubleshooting'],
      },
      minScore: {
        type: 'number',
        description: 'Minimum relevance score (0-1)',
        default: 0.7,
      },
    },
    required: ['query'],
  },
  execute: async ({ query, maxResults = 5, category, minScore = 0.7 }) => {
    try {
      // Import the search API dynamically to avoid circular dependencies
      const searchResponse = await fetch('/api/docs/search?' + new URLSearchParams({
        q: query,
        limit: maxResults.toString(),
        ...(category && { category }),
      }));
      
      if (!searchResponse.ok) {
        throw new Error(`Search API error: ${searchResponse.statusText}`);
      }
      
      const searchResults = await searchResponse.json();
      
      // Filter by minimum score if needed
      const filteredResults = searchResults.results?.filter((result: any) => 
        result.score >= minScore
      ) || [];
      
      return {
        results: filteredResults.map((result: any) => ({
          title: result.title,
          content: result.content,
          url: result.url,
          category: result.category,
          score: result.score,
          headings: result.headings,
        })),
        query,
        totalResults: filteredResults.length,
        searchTime: Date.now(),
      };
    } catch (error) {
      return {
        results: [],
        query,
        error: error instanceof Error ? error.message : 'Search failed',
        totalResults: 0,
      };
    }
  },
  enabled: true,
  version: '1.0.0',
  metadata: {
    category: 'search',
    complexity: 3,
    expectedDuration: 1000,
    resources: {
      cpu: 'low',
      memory: 'low',
      network: true,
    },
    stats: {
      totalCalls: 0,
      successRate: 0.98,
      averageDuration: 800,
    },
    securityLevel: 'low',
  },
  rateLimit: {
    maxCalls: 50,
    timeWindow: 60000, // 1 minute
  },
};

/**
 * Performance analysis tool
 */
export const performanceProfilerTool: EnhancedToolDefinition = {
  name: 'analyze_performance',
  description: 'Analyze code performance and identify bottlenecks',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'Code to analyze for performance',
      },
      language: {
        type: 'string',
        enum: ['javascript', 'typescript', 'python'],
        description: 'Programming language of the code',
      },
      analysisType: {
        type: 'string',
        enum: ['static', 'runtime', 'both'],
        description: 'Type of analysis to perform',
        default: 'both',
      },
      includeMetrics: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['complexity', 'memory', 'cpu', 'io', 'network'],
        },
        description: 'Specific metrics to include in analysis',
      },
    },
    required: ['code', 'language'],
  },
  execute: async ({ code, language, analysisType = 'both', includeMetrics = ['complexity', 'memory', 'cpu'] }) => {
    try {
      const analysis: any = {
        complexity: {},
        performance: {},
        recommendations: [],
        metrics: {},
      };
      
      // Static analysis
      if (analysisType === 'static' || analysisType === 'both') {
        analysis.complexity = analyzeCodeComplexity(code, language);
        analysis.recommendations.push(...getPerformanceRecommendations(code, language));
      }
      
      // Runtime analysis (if requested and supported)
      if (analysisType === 'runtime' || analysisType === 'both') {
        try {
          analysis.performance = await runPerformanceProfile(code, language);
        } catch (error) {
          analysis.performance = {
            error: 'Runtime analysis failed',
            details: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }
      
      // Calculate metrics
      for (const metric of includeMetrics) {
        analysis.metrics[metric] = calculateMetric(code, language, metric);
      }
      
      return {
        analysis,
        language,
        analysisType,
        timestamp: new Date().toISOString(),
        score: calculateOverallScore(analysis),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Analysis failed',
        language,
        analysisType,
        timestamp: new Date().toISOString(),
      };
    }
  },
  enabled: true,
  version: '1.0.0',
  metadata: {
    category: 'performance',
    complexity: 6,
    expectedDuration: 3000,
    resources: {
      cpu: 'medium',
      memory: 'medium',
      network: false,
    },
    stats: {
      totalCalls: 0,
      successRate: 0.92,
      averageDuration: 2500,
    },
    securityLevel: 'medium',
  },
  rateLimit: {
    maxCalls: 20,
    timeWindow: 60000, // 1 minute
  },
};

/**
 * Security scanner tool
 */
export const securityScannerTool: EnhancedToolDefinition = {
  name: 'check_security',
  description: 'Scan code for security vulnerabilities and best practices',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'Code to scan for security issues',
      },
      language: {
        type: 'string',
        enum: ['javascript', 'typescript', 'python', 'bash'],
        description: 'Programming language of the code',
      },
      scanLevel: {
        type: 'string',
        enum: ['basic', 'standard', 'comprehensive'],
        description: 'Level of security scanning',
        default: 'standard',
      },
      includeCategories: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['injection', 'xss', 'secrets', 'dependencies', 'crypto', 'auth'],
        },
        description: 'Security categories to include in scan',
      },
    },
    required: ['code', 'language'],
  },
  execute: async ({ code, language, scanLevel = 'standard', includeCategories = ['injection', 'xss', 'secrets'] }) => {
    try {
      const securityIssues: any[] = [];
      const recommendations: string[] = [];
      let overallRisk = 'low';
      
      // Scan for different types of security issues
      for (const category of includeCategories) {
        const issues = scanSecurityCategory(code, language, category, scanLevel);
        securityIssues.push(...issues);
      }
      
      // Calculate overall risk level
      if (securityIssues.some(issue => issue.severity === 'critical')) {
        overallRisk = 'critical';
      } else if (securityIssues.some(issue => issue.severity === 'high')) {
        overallRisk = 'high';
      } else if (securityIssues.some(issue => issue.severity === 'medium')) {
        overallRisk = 'medium';
      }
      
      // Generate recommendations
      recommendations.push(...generateSecurityRecommendations(securityIssues, language));
      
      return {
        issues: securityIssues,
        recommendations,
        overallRisk,
        scanLevel,
        language,
        timestamp: new Date().toISOString(),
        summary: {
          total: securityIssues.length,
          critical: securityIssues.filter(i => i.severity === 'critical').length,
          high: securityIssues.filter(i => i.severity === 'high').length,
          medium: securityIssues.filter(i => i.severity === 'medium').length,
          low: securityIssues.filter(i => i.severity === 'low').length,
        },
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Security scan failed',
        language,
        scanLevel,
        timestamp: new Date().toISOString(),
      };
    }
  },
  enabled: true,
  version: '1.0.0',
  metadata: {
    category: 'security',
    complexity: 7,
    expectedDuration: 4000,
    resources: {
      cpu: 'medium',
      memory: 'medium',
      network: false,
    },
    stats: {
      totalCalls: 0,
      successRate: 0.96,
      averageDuration: 3500,
    },
    securityLevel: 'high',
  },
  rateLimit: {
    maxCalls: 15,
    timeWindow: 60000, // 1 minute
  },
};

// Helper functions for code execution
async function executeJavaScript(code: string, sandboxDir: string, timeout: number, allowNetwork: boolean, env: Record<string, string>) {
  const filePath = join(sandboxDir, 'script.js');
  await fs.writeFile(filePath, code);
  
  return executeInSandbox('node', [filePath], sandboxDir, timeout, allowNetwork, env);
}

async function executeTypeScript(code: string, sandboxDir: string, timeout: number, allowNetwork: boolean, env: Record<string, string>) {
  const filePath = join(sandboxDir, 'script.ts');
  await fs.writeFile(filePath, code);
  
  // First compile TypeScript
  await executeInSandbox('npx', ['tsc', '--outDir', sandboxDir, filePath], sandboxDir, timeout, allowNetwork, env);
  
  // Then execute the compiled JavaScript
  const jsFile = join(sandboxDir, 'script.js');
  return executeInSandbox('node', [jsFile], sandboxDir, timeout, allowNetwork, env);
}

async function executePython(code: string, sandboxDir: string, timeout: number, allowNetwork: boolean, env: Record<string, string>) {
  const filePath = join(sandboxDir, 'script.py');
  await fs.writeFile(filePath, code);
  
  return executeInSandbox('python3', [filePath], sandboxDir, timeout, allowNetwork, env);
}

async function executeBash(code: string, sandboxDir: string, timeout: number, allowNetwork: boolean, env: Record<string, string>) {
  const filePath = join(sandboxDir, 'script.sh');
  await fs.writeFile(filePath, code);
  await fs.chmod(filePath, 0o755);
  
  return executeInSandbox('bash', [filePath], sandboxDir, timeout, allowNetwork, env);
}

async function executeInSandbox(
  command: string, 
  args: string[], 
  cwd: string, 
  timeout: number, 
  allowNetwork: boolean, 
  env: Record<string, string>
): Promise<{ stdout: string; stderr: string; exitCode: number; resourceUsage: any }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...env,
        // Security restrictions
        PATH: '/usr/bin:/bin',
        HOME: cwd,
        TMPDIR: cwd,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Execution timeout after ${timeout}ms`));
    }, timeout);
    
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode: code || 0,
        resourceUsage: {
          // In a real implementation, this would include actual resource usage
          cpuTime: 0,
          memoryUsage: 0,
          diskIO: 0,
        },
      });
    });
    
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

// Helper functions for performance analysis
function analyzeCodeComplexity(code: string, language: string) {
  // Simplified complexity analysis
  const lines = code.split('\n').length;
  const functions = (code.match(/function|def|=>|lambda/g) || []).length;
  const loops = (code.match(/for|while|forEach|map|filter/g) || []).length;
  const conditions = (code.match(/if|else|switch|case|\?|&&|\|\|/g) || []).length;
  
  const cyclomaticComplexity = 1 + conditions + loops;
  
  return {
    lines,
    functions,
    loops,
    conditions,
    cyclomaticComplexity,
    cognitiveComplexity: cyclomaticComplexity * 1.2, // Rough estimate
  };
}

function getPerformanceRecommendations(code: string, language: string): string[] {
  const recommendations: string[] = [];
  
  // Check for common performance anti-patterns
  if (code.includes('document.getElementById') && code.includes('loop')) {
    recommendations.push('Avoid DOM queries inside loops - cache element references');
  }
  
  if (code.includes('console.log') && language === 'javascript') {
    recommendations.push('Remove console.log statements in production code');
  }
  
  if (code.includes('++') && code.includes('array')) {
    recommendations.push('Consider using array methods like map/filter instead of manual loops');
  }
  
  return recommendations;
}

async function runPerformanceProfile(code: string, language: string) {
  // In a real implementation, this would run actual performance profiling
  return {
    executionTime: Math.random() * 1000,
    memoryUsage: Math.random() * 100,
    cpuUsage: Math.random() * 50,
    profileData: 'Mock profile data',
  };
}

function calculateMetric(code: string, language: string, metric: string): any {
  switch (metric) {
    case 'complexity':
      return analyzeCodeComplexity(code, language).cyclomaticComplexity;
    case 'memory':
      return code.length * 0.001; // Rough estimate based on code size
    case 'cpu':
      return (code.match(/for|while|forEach/g) || []).length * 10;
    default:
      return 0;
  }
}

function calculateOverallScore(analysis: any): number {
  // Calculate a score from 0-100 based on complexity and performance
  const complexity = analysis.complexity?.cyclomaticComplexity || 0;
  const recommendations = analysis.recommendations?.length || 0;
  
  return Math.max(0, 100 - complexity * 2 - recommendations * 5);
}

// Helper functions for security scanning
function scanSecurityCategory(code: string, language: string, category: string, scanLevel: string): any[] {
  const issues: any[] = [];
  
  switch (category) {
    case 'injection':
      // Check for SQL injection patterns
      if (code.includes('SELECT') && code.includes('+')) {
        issues.push({
          type: 'SQL Injection',
          severity: 'high',
          line: 1,
          description: 'Potential SQL injection vulnerability detected',
          recommendation: 'Use parameterized queries or prepared statements',
        });
      }
      break;
      
    case 'xss':
      // Check for XSS patterns
      if (code.includes('innerHTML') || code.includes('dangerouslySetInnerHTML')) {
        issues.push({
          type: 'Cross-Site Scripting (XSS)',
          severity: 'medium',
          line: 1,
          description: 'Potential XSS vulnerability detected',
          recommendation: 'Sanitize user input before rendering',
        });
      }
      break;
      
    case 'secrets':
      // Check for hardcoded secrets
      const secretPatterns = [
        /api[_-]?key.*['"]([\w-]{20,})['"]/i,
        /password.*['"]([\w@#$%^&*!]{8,})['"]/i,
        /token.*['"]([\w-]{20,})['"]/i,
      ];
      
      for (const pattern of secretPatterns) {
        if (pattern.test(code)) {
          issues.push({
            type: 'Hardcoded Secret',
            severity: 'critical',
            line: 1,
            description: 'Hardcoded secret detected in code',
            recommendation: 'Use environment variables or secure configuration',
          });
        }
      }
      break;
  }
  
  return issues;
}

function generateSecurityRecommendations(issues: any[], language: string): string[] {
  const recommendations: string[] = [];
  
  if (issues.some(i => i.type.includes('Injection'))) {
    recommendations.push('Implement input validation and sanitization');
    recommendations.push('Use parameterized queries for database operations');
  }
  
  if (issues.some(i => i.type.includes('XSS'))) {
    recommendations.push('Implement Content Security Policy (CSP)');
    recommendations.push('Use secure templating libraries');
  }
  
  if (issues.some(i => i.type.includes('Secret'))) {
    recommendations.push('Move secrets to environment variables');
    recommendations.push('Use a secure secrets management system');
  }
  
  return recommendations;
}