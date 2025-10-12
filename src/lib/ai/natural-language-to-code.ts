/**
 * Natural Language to Code Service
 * Converts natural language descriptions into executable code
 */

export interface CodeGenerationOptions {
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

    try {
      if (this.aiProvider) {
        return await this.generateCodeWithAI(description, options);
      } else {
        return await this.generateCodeWithoutAI(description, options);
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
