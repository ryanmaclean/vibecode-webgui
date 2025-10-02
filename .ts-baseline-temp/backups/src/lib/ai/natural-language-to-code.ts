/**
 * Natural Language to Code Converter
 * Translates human descriptions into executable code using AI
 */

import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { extractText } from './utils/langchain';
import  from 'od';
import  from '../services/function-calling';

export interface CodeGenerationRequest {
  description: string;
  language: string;
  framework?: string;
  targetFile?: string;
  includeTests?: boolean;
  includeDocumentation?: boolean;
  style?: 'minimal' | 'production' | 'enterprise';
  complexity?: 'simple' | 'moderate' | 'complex';
}

export interface GeneratedCode {
  code: string;
  language: string;
  framework?: string;
  description: string;
  explanation: string;
  dependencies: string[];
  imports: string[];
  usage: string;
  tests?: string;
  documentation?: string;
  estimatedComplexity: 'low' | 'medium' | 'high';
  estimatedTime: number; // in minutes
}

export interface CodeAnalysis {
  intent: string;
  requirements: string[];
  technicalApproach: string;
  potentialChallenges: string[];
  alternatives: string[];
  bestPractices: string[];
  complexity: 'low' | 'medium' | 'high';
}

export class NaturalLanguageToCode {
  private llm: ChatOpenAI;
  private _codeTemplates: Map<string, string>;
  private languagePatterns: Map<string, string[]>;

  constructor(apiKey: string) {
    this.llm = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: 'gpt-4',
      temperature: 0.1,
    });

    this.codeTemplates = this.initializeCodeTemplates();
    this.languagePatterns = this.initializeLanguagePatterns();
  }

  private initializeCodeTemplates(): Map<string, string> {
    const templates = new Map<string, string>();

    // React component template
    templates.set('react-component', `
import React from 'react';

interface {{componentName}}Props {
  {{props}}
}

export function {{componentName}}({ {{props}} }: {{componentName}}Props) {
  {{state}}
  
  {{handlers}}
  
  return (
    {{jsx}}
  );
}
    `);

    // Express API endpoint template
    templates.set('express-endpoint', `
import express from 'express';
import { {{middleware}} } from '{{middlewarePackage}}';

const router = express.Router();

{{endpoint}}
router.{{method}}('{{path}}', {{middleware}}, async (req, res) => {
  try {
    {{logic}}
    res.status({{statusCode}}).json({{response}});
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
    `);

    // Python class template
    templates.set('python-class', `
class {{className}}:
    def __init__(self, {{params}}):
        {{initialization}}
    
    {{methods}}
    
    def __str__(self):
        return f"{{className}}({{attributes}})"
    `);

    return templates;
  }

  private initializeLanguagePatterns(): Map<string, string[]> {
    const patterns = new Map<string, string[]>();

    // TypeScript/JavaScript patterns
    patterns.set('typescript', [
      'function',
      'class',
      'interface',
      'type',
      'enum',
      'async',
      'await',
      'promise',
      'callback',
      'event',
      'state',
      'hook',
      'component',
      'service',
      'utility',
    ]);

    // Python patterns
    patterns.set('python', [
      'def',
      'class',
      'import',
      'from',
      'try',
      'except',
      'with',
      'async',
      'await',
      'decorator',
      'generator',
      'context',
      'dataclass',
      'enum',
    ]);

    // SQL patterns
    patterns.set('sql', [
      'SELECT',
      'INSERT',
      'UPDATE',
      'DELETE',
      'CREATE',
      'ALTER',
      'DROP',
      'JOIN',
      'WHERE',
      'GROUP BY',
      'ORDER BY',
      'HAVING',
      'INDEX',
      'TRANSACTION',
    ]);

    return patterns;
  }

  /**
   * Convert natural language description to code
   */
  async generateCode(request: CodeGenerationRequest): Promise<GeneratedCode> {
    // First, analyze the request to understand the intent
    const analysis = await this.analyzeRequest(request);
    
    // Generate the code based on the analysis
    const code = await this.generateCodeFromAnalysis(request, analysis);
    
    // Generate additional artifacts if requested
    const tests = request.includeTests ? await this.generateTests(code, request) : undefined;
    const documentation = request.includeDocumentation ? await this.generateDocumentation(code, request) : undefined;
    
    return {
      code: code.code,
      language: request.language,
      framework: request.framework,
      description: request.description,
      explanation: code.explanation,
      dependencies: code.dependencies,
      imports: code.imports,
      usage: code.usage,
      tests,
      documentation,
      estimatedComplexity: analysis.complexity,
      estimatedTime: this.estimateDevelopmentTime(analysis),
    };
  }

  /**
   * Analyze the natural language request
   */
  private async analyzeRequest(request: CodeGenerationRequest): Promise<CodeAnalysis> {
    const prompt = PromptTemplate.fromTemplate(`
Analyze the following natural language request for code generation.

Request: {description}
Language: {language}
Framework: {framework}
Style: {style}
Complexity: {complexity}

Please provide:
1. Clear understanding of the intent
2. Specific technical requirements
3. Recommended technical approach
4. Potential challenges and solutions
5. Alternative approaches
6. Best practices to follow

Focus on creating a clear technical specification that can be used for code generation.
    `);

    const chain = RunnableSequence.from([
      prompt,
      this.llm as any,
      new StringOutputParser(),
    ]);

    const rawResult = await chain.invoke({
      description: request.description,
      language: request.language,
      framework: request.framework || 'none',
      style: request.style || 'production',
      complexity: request.complexity || 'moderate',
    });

    const result = extractText(rawResult);

    return this.parseAnalysisResult(result);
  }

  /**
   * Generate code based on analysis
   */
  private async generateCodeFromAnalysis(
    request: CodeGenerationRequest,
    analysis: CodeAnalysis
  ): Promise<{
    code: string;
    explanation: string;
    dependencies: string[];
    imports: string[];
    usage: string;
  }> {
    const prompt = PromptTemplate.fromTemplate(`
Generate code based on the following analysis and requirements.

Analysis:
- Intent: {intent}
- Requirements: {requirements}
- Technical Approach: {technicalApproach}
- Best Practices: {bestPractices}

Code Requirements:
- Language: {language}
- Framework: {framework}
- Style: {style}
- Complexity: {complexity}

Generate:
1. Complete, executable code
2. Brief explanation of the approach
3. Required dependencies
4. Import statements
5. Usage example

The code should be:
- Production-ready
- Well-structured
- Follow best practices
- Include proper error handling
- Be well-documented with comments

Return only the code and explanations, no markdown formatting.
    `);

    const chain = RunnableSequence.from([
      prompt,
      this.llm as any,
      new StringOutputParser(),
    ]);

    const rawResult = await chain.invoke({
      intent: analysis.intent,
      requirements: analysis.requirements.join(', '),
      technicalApproach: analysis.technicalApproach,
      bestPractices: analysis.bestPractices.join(', '),
      language: request.language,
      framework: request.framework || 'none',
      style: request.style || 'production',
      complexity: request.complexity || 'moderate',
    });

    return this.parseCodeResult(extractText(rawResult));
  }

  /**
   * Generate tests for the generated code
   */
  private async generateTests(
    code: { code: string; explanation: string },
    request: CodeGenerationRequest
  ): Promise<string> {
    const prompt = PromptTemplate.fromTemplate(`
Generate comprehensive tests for the following code.

Code:
{code}

Explanation: {explanation}
Language: {language}
Framework: {framework}

Generate tests that cover:
1. Happy path scenarios
2. Edge cases
3. Error conditions
4. Boundary conditions
5. Integration scenarios if applicable

Use the appropriate testing framework for the language.
Include setup and teardown if needed.
Make tests readable and maintainable.
    `);

    const chain = RunnableSequence.from([
      prompt,
      this.llm as any,
      new StringOutputParser(),
    ]);

    const rawResult = await chain.invoke({
      code: code.code,
      explanation: code.explanation,
      language: request.language,
      framework: request.framework || 'none',
    });

    return extractText(rawResult);
  }

  /**
   * Generate documentation for the generated code
   */
  private async generateDocumentation(
    code: { code: string; explanation: string },
    request: CodeGenerationRequest
  ): Promise<string> {
    const prompt = PromptTemplate.fromTemplate(`
Generate comprehensive documentation for the following code.

Code:
{code}

Explanation: {explanation}
Language: {language}
Framework: {framework}

Generate documentation that includes:
1. Overview and purpose
2. API reference
3. Usage examples
4. Configuration options
5. Error handling
6. Performance considerations
7. Security considerations if applicable

Use clear, concise language.
Include code examples.
Follow documentation best practices for the language.
    `);

    const chain = RunnableSequence.from([
      prompt,
      this.llm as any,
      new StringOutputParser(),
    ]);

    const rawResult = await chain.invoke({
      code: code.code,
      explanation: code.explanation,
      language: request.language,
      framework: request.framework || 'none',
    });

    return extractText(rawResult);
  }

  /**
   * Estimate development time based on complexity
   */
  private estimateDevelopmentTime(analysis: CodeAnalysis): number {
    // Simple estimation based on complexity
    const baseTime = 30; // minutes
    
    if (analysis.complexity === 'low') {
      return baseTime;
    } else if (analysis.complexity === 'medium') {
      return baseTime * 2;
    } else {
      return baseTime * 4;
    }
  }

  /**
   * Parse analysis result
   */
  private parseAnalysisResult(result: string): CodeAnalysis {
    // Simple parsing - in production, use more sophisticated parsing
    const lines = result.split('\n');
    
    const intent = lines.find(line => line.includes('intent') || line.includes('purpose')) || 'Unknown';
    const requirements = lines.filter(line => line.includes('requirement') || line.includes('need')).map(line => line.trim());
    const technicalApproach = lines.find(line => line.includes('approach') || line.includes('method')) || 'Standard approach';
    const potentialChallenges = lines.filter(line => line.includes('challenge') || line.includes('issue')).map(line => line.trim());
    const alternatives = lines.filter(line => line.includes('alternative') || line.includes('option')).map(line => line.trim());
    const bestPractices = lines.filter(line => line.includes('practice') || line.includes('pattern')).map(line => line.trim());
    
    // Determine complexity based on content
    let complexity: 'low' | 'medium' | 'high' = 'medium'; // Default to medium
    
    // Simple heuristic to determine complexity
    if (potentialChallenges.length > 3 || requirements.length > 5) {
      complexity = 'high';
    } else if (potentialChallenges.length <= 1 && requirements.length <= 2) {
      complexity = 'low';
    }
    
    return {
      intent,
      requirements,
      technicalApproach,
      potentialChallenges,
      alternatives,
      bestPractices,
      complexity
    };
  }

  /**
   * Parse code generation result
   */
  private parseCodeResult(result: string): {
    code: string;
    explanation: string;
    dependencies: string[];
    imports: string[];
    usage: string;
  } {
    // Simple parsing - in production, use more sophisticated parsing
    const sections = result.split('---');
    
    let code = '';
    let explanation = '';
    let dependencies: string[] = [];
    let imports: string[] = [];
    let usage = '';
    
    for (const section of sections) {
      if (section.includes('code:') || section.includes('Code:')) {
        code = section.split(':')[1]?.trim() || '';
      } else if (section.includes('explanation:') || section.includes('Explanation:')) {
        explanation = section.split(':')[1]?.trim() || '';
      } else if (section.includes('dependencies:') || section.includes('Dependencies:')) {
        dependencies = section.split(':')[1]?.trim().split(',').map(d => d.trim()) || [];
      } else if (section.includes('imports:') || section.includes('Imports:')) {
        imports = section.split(':')[1]?.trim().split(',').map(i => i.trim()) || [];
      } else if (section.includes('usage:') || section.includes('Usage:')) {
        usage = section.split(':')[1]?.trim() || '';
      }
    }
    
    return {
      code,
      explanation,
      dependencies,
      imports,
      usage,
    };
  }

  /**
   * Get code suggestions based on partial description
   */
  async getCodeSuggestions(
    partialDescription: string,
    language: string
  ): Promise<string[]> {
    const prompt = PromptTemplate.fromTemplate(`
Based on the partial description, suggest what the user might want to implement.

Partial Description: {partialDescription}
Language: {language}

Provide 5-10 suggestions for what this code might do.
Each suggestion should be:
- Specific and actionable
- Appropriate for the language
- Common programming tasks
- Clear and understandable

Return only the suggestions, one per line.
    `);

    const chain = RunnableSequence.from([
      prompt,
      this.llm as any,
      new StringOutputParser(),
    ]);

    const rawResult = await chain.invoke({
      partialDescription,
      language,
    });

    const result = extractText(rawResult);

    return result.split('\n').filter(line => line.trim().length > 0);
  }

  /**
   * Refactor existing code based on natural language request
   */
  async refactorCode(
    existingCode: string,
    refactorRequest: string,
    language: string
  ): Promise<{
    refactoredCode: string;
    explanation: string;
    improvements: string[];
  }> {
    const prompt = PromptTemplate.fromTemplate(`
Refactor the following code based on the request.

Existing Code:
{existingCode}

Refactor Request: {refactorRequest}
Language: {language}

Please:
1. Refactor the code according to the request
2. Maintain functionality
3. Improve code quality
4. Follow best practices
5. Explain the changes made
6. List specific improvements

Return the refactored code and explanations.
    `);

    const chain = RunnableSequence.from([
      prompt,
      this.llm as any,
      new StringOutputParser(),
    ]);

    const rawResult = await chain.invoke({
      existingCode,
      refactorRequest,
      language,
    });

    return this.parseRefactorResult(extractText(rawResult));
  }

  /**
   * Parse refactor result
   */
  private parseRefactorResult(result: string): {
    refactoredCode: string;
    explanation: string;
    improvements: string[];
  } {
    // Simple parsing - in production, use more sophisticated parsing
    const sections = result.split('---');
    
    let refactoredCode = '';
    let explanation = '';
    let improvements: string[] = [];
    
    for (const section of sections) {
      if (section.includes('refactored:') || section.includes('Refactored:')) {
        refactoredCode = section.split(':')[1]?.trim() || '';
      } else if (section.includes('explanation:') || section.includes('Explanation:')) {
        explanation = section.split(':')[1]?.trim() || '';
      } else if (section.includes('improvements:') || section.includes('Improvements:')) {
        improvements = section.split(':')[1]?.trim().split(',').map(i => i.trim()) || [];
      }
    }
    
    return {
      refactoredCode,
      explanation,
      improvements,
    };
  }
}

/**
 * Factory function to create natural language to code converter
 */
export function createNaturalLanguageToCode(apiKey: string): NaturalLanguageToCode {
  return new NaturalLanguageToCode(apiKey);
}
