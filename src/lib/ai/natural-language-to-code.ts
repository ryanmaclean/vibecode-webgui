/**
 * Natural Language to Code Service
 * Converts natural language descriptions into executable code
 */

<<<<<<< HEAD
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { extractText } from './utils/langchain';
import { z } from 'zod';
import { FunctionDefinition } from '../services/function-calling';
import { logger } from '../logger';


export interface CodeGenerationRequest {
  description: string;
=======
export interface CodeGenerationOptions {
>>>>>>> recovery/broken-salvage
  language: string;
  framework?: string;
  complexity?: 'simple' | 'intermediate' | 'advanced';
  style?: 'functional' | 'object-oriented' | 'procedural';
  includeComments?: boolean;
  includeTests?: boolean;
  customInstructions?: string;
}

export interface GeneratedCode {
  code: string;
  language: string;
  framework?: string;
  description: string;
  confidence: number;
  suggestions?: string[];
  estimatedTokens?: number;
}

export interface CodeValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface CodeExplanation {
  summary: string;
  keyFeatures: string[];
  dependencies: string[];
  usage: string;
  bestPractices: string[];
<<<<<<< HEAD
  complexity: 'low' | 'medium' | 'high';
}

export class NaturalLanguageToCode {
  private llm: ChatOpenAI;
  private codeTemplates: Map<string, string>;
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
=======
>>>>>>> recovery/broken-salvage
}

/**
 * Natural Language to Code Service
 */
export class NaturalLanguageToCodeService {
  private aiProvider?: any; // OpenAI, Ollama, or other AI client

  constructor(aiProvider?: any) {
    this.aiProvider = aiProvider;
  }

  /**
   * Convert natural language description to code
   */
  async generateCode(
    description: string,
    options: CodeGenerationOptions
  ): Promise<GeneratedCode> {
    const startTime = Date.now();

<<<<<<< HEAD
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
=======
    try {
      if (this.aiProvider) {
        return await this.generateCodeWithAI(description, options);
      } else {
        return await this.generateCodeWithoutAI(description, options);
>>>>>>> recovery/broken-salvage
      }
    } catch (error) {
      console.error('Code generation failed:', error);
      throw new Error(`Failed to generate code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate code using AI provider
   */
  private async generateCodeWithAI(
    description: string,
    options: CodeGenerationOptions
  ): Promise<GeneratedCode> {
    if (!this.aiProvider) {
      throw new Error('AI provider not available');
    }

    const prompt = this.buildCodeGenerationPrompt(description, options);

    try {
      const response = await this.aiProvider.invoke([
        {
          role: "system",
          content: `You are an expert software developer. Generate clean, efficient, and well-documented code based on natural language descriptions.`
        },
        { role: "user", content: prompt }
      ]);

      return this.parseCodeGenerationResponse(response.content, options);
    } catch (error) {
      console.warn('AI code generation failed, falling back to rule-based:', error);
      return this.generateCodeWithoutAI(description, options);
    }
  }

  /**
   * Generate code without AI (rule-based templates)
   */
  private async generateCodeWithoutAI(
    description: string,
    options: CodeGenerationOptions
  ): Promise<GeneratedCode> {
    const language = options.language.toLowerCase();

    let generatedCode = '';
    let descriptionText = '';

    switch (language) {
      case 'typescript':
      case 'javascript':
        ({ code: generatedCode, description: descriptionText } =
          this.generateJavaScriptCode(description, options));
        break;
      case 'python':
        ({ code: generatedCode, description: descriptionText } =
          this.generatePythonCode(description, options));
        break;
      case 'java':
        ({ code: generatedCode, description: descriptionText } =
          this.generateJavaCode(description, options));
        break;
      case 'csharp':
      case 'c#':
        ({ code: generatedCode, description: descriptionText } =
          this.generateCSharpCode(description, options));
        break;
      default:
        generatedCode = this.generateGenericCode(description, options);
        descriptionText = `Generated ${options.language} code based on requirements`;
    }

    return {
      code: generatedCode,
      language: options.language,
      framework: options.framework,
      description: descriptionText,
      confidence: 0.7, // Lower confidence for rule-based generation
      suggestions: this.generateSuggestions(description, options)
    };
  }

  /**
   * Generate JavaScript/TypeScript code
   */
  private generateJavaScriptCode(
    description: string,
    options: CodeGenerationOptions
  ): { code: string; description: string } {
    const descLower = description.toLowerCase();
    let code = '';
    let description = '';

    if (descLower.includes('function') || descLower.includes('method')) {
      code = this.generateFunctionCode(description, options);
      description = 'Generated function based on requirements';
    } else if (descLower.includes('class') || descLower.includes('object')) {
      code = this.generateClassCode(description, options);
      description = 'Generated class based on requirements';
    } else if (descLower.includes('component') || descLower.includes('react')) {
      code = this.generateReactComponentCode(description, options);
      description = 'Generated React component based on requirements';
    } else {
      code = this.generateGenericJavaScriptCode(description, options);
      description = 'Generated JavaScript code based on requirements';
    }

    return { code, description };
  }

  /**
   * Generate Python code
   */
  private generatePythonCode(
    description: string,
    options: CodeGenerationOptions
  ): { code: string; description: string } {
    const descLower = description.toLowerCase();
    let code = '';
    let description = '';

    if (descLower.includes('function') || descLower.includes('def')) {
      code = `def ${this.extractFunctionName(description) or 'my_function'}():\n    """${description}"""\n    # Implementation would go here\n    pass`;
      description = 'Generated Python function';
    } else if (descLower.includes('class')) {
      code = `class ${this.extractClassName(description) or 'MyClass'}:\n    """${description}"""\n    \n    def __init__(self):\n        # Constructor implementation\n        pass`;
      description = 'Generated Python class';
    } else {
      code = `# ${description}\n# Python implementation would go here\n`;
      description = 'Generated Python code structure';
    }

    return { code, description };
  }

  /**
   * Generate Java code
   */
  private generateJavaCode(
    description: string,
    options: CodeGenerationOptions
  ): { code: string; description: string } {
    const className = this.extractClassName(description) || 'MyClass';

    const code = `/**
 * ${description}
 */
public class ${className} {

    /**
     * Constructor
     */
    public ${className}() {
        // Constructor implementation
    }

    /**
     * Main method
     */
    public static void main(String[] args) {
        // Main implementation would go here
    }
}`;

    return {
      code,
      description: `Generated Java class: ${className}`
    };
  }

  /**
   * Generate C# code
   */
  private generateCSharpCode(
    description: string,
    options: CodeGenerationOptions
  ): { code: string; description: string } {
    const className = this.extractClassName(description) || 'MyClass';

<<<<<<< HEAD
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
=======
    const code = `/**
 * ${description}
 */
public class ${className}
{
    /// <summary>
    /// Constructor
    /// </summary>
    public ${className}()
    {
        // Constructor implementation
>>>>>>> recovery/broken-salvage
    }

    /// <summary>
    /// Main method
    /// </summary>
    public static void Main(string[] args)
    {
        // Main implementation would go here
    }
}`;

    return {
      code,
      description: `Generated C# class: ${className}`
    };
  }

  /**
   * Generate function code
   */
  private generateFunctionCode(description: string, options: CodeGenerationOptions): string {
    const functionName = this.extractFunctionName(description) || 'myFunction';
    const isAsync = description.toLowerCase().includes('async') || description.toLowerCase().includes('promise');

    if (options.language === 'python') {
      return `def ${functionName}():\n    """${description}"""\n    # Function implementation\n    pass`;
    }

    if (isAsync) {
      return `/**
 * ${description}
 */
async function ${functionName}() {
    // Async function implementation
    return null;
}`;
    }

    return `/**
 * ${description}
 */
function ${functionName}() {
    // Function implementation
    return null;
}`;
  }

  /**
   * Generate class code
   */
  private generateClassCode(description: string, options: CodeGenerationOptions): string {
    const className = this.extractClassName(description) || 'MyClass';

    if (options.language === 'typescript') {
      return `/**
 * ${description}
 */
export class ${className} {
    constructor() {
        // Constructor implementation
    }

    /**
     * Example method
     */
    public exampleMethod(): void {
        // Method implementation
    }
}`;
    }

    return `/**
 * ${description}
 */
class ${className} {
    constructor() {
        // Constructor implementation
    }

    /**
     * Example method
     */
    exampleMethod() {
        // Method implementation
    }
}`;
  }

  /**
   * Generate React component code
   */
  private generateReactComponentCode(description: string, options: CodeGenerationOptions): string {
    const componentName = this.extractClassName(description) || 'MyComponent';

    return `import React, { useState, useEffect } from 'react';

/**
 * ${description}
 */
export function ${componentName}() {
    const [state, setState] = useState(null);

    useEffect(() => {
        // Component initialization
    }, []);

    return (
        <div>
            {/* ${componentName} JSX implementation */}
        </div>
    );
}

export default ${componentName};`;
  }

  /**
   * Generate generic code structure
   */
  private generateGenericCode(description: string, options: CodeGenerationOptions): string {
    return `/**
 * ${description}
 *
 * Language: ${options.language}
 * Framework: ${options.framework || 'None'}
 * Generated by: Natural Language to Code Service
 */

// Implementation would go here based on specific requirements
// This is a placeholder for ${options.language} code

export {};`;
  }

  /**
   * Generate generic JavaScript code
   */
  private generateGenericJavaScriptCode(description: string, options: CodeGenerationOptions): string {
    return `/**
 * ${description}
 *
 * Generated JavaScript/TypeScript code
 */

// Implementation would be based on specific requirements
// This serves as a template for ${options.language} development

export {};`;
  }

  /**
   * Build AI prompt for code generation
   */
  private buildCodeGenerationPrompt(description: string, options: CodeGenerationOptions): string {
    return `
Please generate ${options.language} code based on this description:

"${description}"

Requirements:
- Language: ${options.language}
- Framework: ${options.framework || 'None specified'}
- Complexity: ${options.complexity || 'intermediate'}
- Style: ${options.style || 'functional'}
- Include Comments: ${options.includeComments !== false ? 'Yes' : 'No'}
- Include Tests: ${options.includeTests ? 'Yes' : 'No'}

${options.customInstructions ? `Additional Instructions: ${options.customInstructions}` : ''}

Please generate clean, well-structured, and maintainable code that follows best practices for the specified language and framework. Include proper error handling, type definitions (if applicable), and comprehensive documentation.

Return only the code without markdown formatting or explanations.
`;
  }

  /**
   * Parse AI response for code generation
   */
  private parseCodeGenerationResponse(response: string, options: CodeGenerationOptions): GeneratedCode {
    // Extract code from response (remove markdown if present)
    let code = response.replace(/```[\w]*\n?/g, '').replace(/```\n?/g, '').trim();

    // If no code blocks found, treat entire response as code
    if (code.length === 0) {
      code = response.trim();
    }

    return {
      code,
      language: options.language,
      framework: options.framework,
      description: `AI-generated ${options.language} code based on natural language description`,
      confidence: 0.9, // High confidence for AI-generated code
      suggestions: this.generateSuggestions(description, options)
    };
  }

  /**
   * Generate improvement suggestions
   */
  private generateSuggestions(description: string, options: CodeGenerationOptions): string[] {
    const suggestions: string[] = [];

    if (options.language === 'typescript' && !description.toLowerCase().includes('type')) {
      suggestions.push('Consider adding TypeScript type definitions for better type safety');
    }

    if (description.toLowerCase().includes('async') && options.language !== 'python') {
      suggestions.push('Consider adding proper async/await error handling');
    }

    if (description.toLowerCase().includes('api') || description.toLowerCase().includes('http')) {
      suggestions.push('Consider adding input validation and sanitization');
    }

    if (description.toLowerCase().includes('database') || description.toLowerCase().includes('storage')) {
      suggestions.push('Consider adding proper connection pooling and error handling');
    }

    return suggestions;
  }

  /**
   * Validate generated code
   */
  async validateCode(generatedCode: GeneratedCode): Promise<CodeValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Basic syntax validation
    if (!generatedCode.code || generatedCode.code.trim().length === 0) {
      errors.push('Generated code is empty');
    }

    // Language-specific validation
    switch (generatedCode.language.toLowerCase()) {
      case 'typescript':
      case 'javascript':
        if (!generatedCode.code.includes('function') && !generatedCode.code.includes('class') && !generatedCode.code.includes('=>')) {
          warnings.push('Code may be missing function or class definitions');
        }
        break;
      case 'python':
        if (!generatedCode.code.includes('def') && !generatedCode.code.includes('class')) {
          warnings.push('Code may be missing function or class definitions');
        }
        break;
    }

    // Check for common issues
    if (generatedCode.code.includes('TODO') || generatedCode.code.includes('FIXME')) {
      suggestions.push('Consider implementing TODO items for production readiness');
    }

    if (generatedCode.confidence < 0.8) {
      suggestions.push('Consider manual review due to lower confidence score');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Generate code explanation
   */
  async explainCode(code: string, language: string): Promise<CodeExplanation> {
    if (this.aiProvider) {
      return this.explainCodeWithAI(code, language);
    } else {
      return this.explainCodeWithoutAI(code, language);
    }
  }

  /**
   * Explain code using AI
   */
  private async explainCodeWithAI(code: string, language: string): Promise<CodeExplanation> {
    if (!this.aiProvider) {
      throw new Error('AI provider not available');
    }

    const prompt = `
Please analyze this ${language} code and provide a comprehensive explanation:

\`\`\`${language}
${code}
\`\`\`

Please provide:
1. A brief summary of what the code does
2. Key features and functionality
3. Dependencies and requirements
4. Usage instructions
5. Best practices and recommendations

Format your response as JSON with the following structure:
{
  "summary": "brief description",
  "keyFeatures": ["feature1", "feature2"],
  "dependencies": ["dep1", "dep2"],
  "usage": "how to use the code",
  "bestPractices": ["practice1", "practice2"]
}
`;

    try {
      const response = await this.aiProvider.invoke([
        {
          role: "system",
          content: "You are an expert code reviewer and technical writer."
        },
        { role: "user", content: prompt }
      ]);

      return JSON.parse(response.content);
    } catch (error) {
      console.warn('AI code explanation failed:', error);
      return this.explainCodeWithoutAI(code, language);
    }
  }

  /**
   * Explain code without AI
   */
  private explainCodeWithoutAI(code: string, language: string): CodeExplanation {
    return {
      summary: `This is ${language} code that implements specific functionality based on requirements.`,
      keyFeatures: ['Core functionality implementation'],
      dependencies: this.extractDependencies(code),
      usage: 'Usage instructions would depend on specific implementation details.',
      bestPractices: [
        'Follow language-specific best practices',
        'Add proper error handling',
        'Include comprehensive documentation'
      ]
    };
  }

  /**
   * Extract dependencies from code
   */
  private extractDependencies(code: string): string[] {
    const dependencies: string[] = [];

    // Extract import statements
    const importMatches = code.match(/import\s+.*?from\s+['"](.+?)['"]/g);
    if (importMatches) {
      dependencies.push(...importMatches.map(match =>
        match.replace(/import\s+.*?from\s+['"](.+?)['"]/, '$1')
      ));
    }

    // Extract require statements
    const requireMatches = code.match(/require\(['"](.+?)['"]\)/g);
    if (requireMatches) {
      dependencies.push(...requireMatches.map(match =>
        match.replace(/require\(['"](.+?)['"]\)/, '$1')
      ));
    }

    return [...new Set(dependencies)]; // Remove duplicates
  }

  /**
   * Extract function name from description
   */
  private extractFunctionName(description: string): string | null {
    // Simple heuristic to extract function names from descriptions
    const functionWords = ['function', 'method', 'routine', 'procedure'];
    const descLower = description.toLowerCase();

    for (const word of functionWords) {
      if (descLower.includes(word)) {
        // Extract words after the function keyword
        const regex = new RegExp(`${word}\\s+(\\w+)`, 'i');
        const match = descLower.match(regex);
        if (match) {
          return match[1];
        }
      }
    }

    return null;
  }

  /**
   * Extract class name from description
   */
  private extractClassName(description: string): string | null {
    // Simple heuristic to extract class names from descriptions
    const classWords = ['class', 'object', 'component', 'service', 'manager'];
    const descLower = description.toLowerCase();

    for (const word of classWords) {
      if (descLower.includes(word)) {
        // Extract words after the class keyword
        const regex = new RegExp(`${word}\\s+(\\w+)`, 'i');
        const match = descLower.match(regex);
        if (match) {
          return match[1];
        }
      }
    }

    return null;
  }

  /**
   * Improve existing code based on feedback
   */
  async improveCode(
    currentCode: string,
    feedback: string,
    options: CodeGenerationOptions
  ): Promise<GeneratedCode> {
    if (!this.aiProvider) {
      throw new Error('AI provider required for code improvement');
    }

    const prompt = `
Please improve this ${options.language} code based on the following feedback:

Current Code:
\`\`\`${options.language}
${currentCode}
\`\`\`

Feedback/Requirements for Improvement:
${feedback}

Please provide an improved version that addresses the feedback while maintaining the original functionality. Follow best practices for ${options.language} and ${options.framework || 'the specified framework'}.

Return only the improved code without markdown formatting.
`;

    try {
      const response = await this.aiProvider.invoke([
        {
          role: "system",
          content: "You are an expert software engineer specializing in code refactoring and improvement."
        },
        { role: "user", content: prompt }
      ]);

      return this.parseCodeGenerationResponse(response.content, options);
    } catch (error) {
      console.error('Code improvement failed:', error);
      throw new Error(`Failed to improve code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate code documentation
   */
  async generateDocumentation(code: string, language: string): Promise<string> {
    if (!this.aiProvider) {
      return this.generateBasicDocumentation(code, language);
    }

    const prompt = `
Please generate comprehensive documentation for this ${language} code:

\`\`\`${language}
${code}
\`\`\`

Include:
1. Overview of functionality
2. API documentation for public methods
3. Usage examples
4. Configuration options
5. Dependencies and requirements

Format the documentation in a clear, readable structure.
`;

    try {
      const response = await this.aiProvider.invoke([
        {
          role: "system",
          content: "You are a technical writer specializing in code documentation."
        },
        { role: "user", content: prompt }
      ]);

      return response.content;
    } catch (error) {
      console.warn('AI documentation generation failed:', error);
      return this.generateBasicDocumentation(code, language);
    }
  }

  /**
   * Generate basic documentation without AI
   */
  private generateBasicDocumentation(code: string, language: string): string {
    return `/**
 * ${language} Code Documentation
 *
 * This ${language} code implements specific functionality.
 *
 * Usage:
 * - Import the required modules
 * - Initialize the components as needed
 * - Call the appropriate methods
 *
 * Dependencies: Based on import statements in the code
 *
 * Note: This is basic documentation. For detailed documentation,
 * consider using AI-powered documentation generation.
 */
`;
  }
}

// Export singleton instance for global use
export const naturalLanguageToCodeService = new NaturalLanguageToCodeService();
