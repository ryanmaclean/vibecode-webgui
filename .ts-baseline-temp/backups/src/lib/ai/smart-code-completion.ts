/**
 * Smart Code Completion System
 * Provides intelligent code suggestions based on context, patterns, and AI analysis
 */

import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import  from './utils/langchain';
import  from 'od';

export interface CompletionContext {
  filePath: string;
  language: string;
  framework?: string;
  currentLine: number;
  cursorPosition: number;
  surroundingCode: string;
  imports: string[];
  dependencies: string[];
  projectStructure?: string[];
  recentEdits?: string[];
}

export interface CodeSuggestion {
  text: string;
  displayText: string;
  kind: 'snippet' | 'function' | 'import' | 'variable' | 'class' | 'interface';
  priority: number;
  description: string;
  documentation?: string;
  examples?: string[];
  confidence: number;
}

export interface CompletionOptions {
  maxSuggestions?: number;
  includeDocumentation?: boolean;
  includeExamples?: boolean;
  contextWindow?: number;
  temperature?: number;
}

export class SmartCodeCompletion {
  private llm: ChatOpenAI;
  private _languageModels: Map<string, any>;
  private snippetDatabase: Map<string, string[]>;

  constructor(apiKey: string) {
    this.llm = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: 'gpt-4',
      temperature: 0.1,
    });

    this.languageModels = new Map();
    this.snippetDatabase = this.initializeSnippetDatabase();
  }

  private initializeSnippetDatabase(): Map<string, string[]> {
    const database = new Map<string, string[]>();

    // TypeScript/JavaScript snippets
    database.set('typescript', [
      'useState',
      'useEffect',
      'useCallback',
      'useMemo',
      'useRef',
      'useContext',
      'useReducer',
      'custom hook',
      'async function',
      'arrow function',
      'class component',
      'functional component',
      'interface',
      'type',
      'enum',
      'generics',
      'error handling',
      'try-catch',
      'promise',
      'async-await',
    ]);

    // React snippets
    database.set('react', [
      'JSX element',
      'conditional rendering',
      'list rendering',
      'event handler',
      'form handling',
      'state management',
      'props destructuring',
      'component composition',
      'fragment',
      'portal',
      'error boundary',
      'suspense',
      'lazy loading',
      'memo',
      'forwardRef',
    ]);

    // Python snippets
    database.set('python', [
      'function definition',
      'class definition',
      'list comprehension',
      'dictionary comprehension',
      'generator expression',
      'decorator',
      'context manager',
      'exception handling',
      'type hints',
      'dataclass',
      'enum',
      'async function',
      'await',
      'with statement',
      'lambda function',
    ]);

    return database;
  }

  /**
   * Get intelligent code completions based on context
   */
  async getCompletions(
    context: CompletionContext,
    options: CompletionOptions = {}
  ): Promise<CodeSuggestion[]> {
    const {
      maxSuggestions = 10,
      includeDocumentation = true,
      includeExamples = false,
      _contextWindow = 1000,
      temperature = 0.1,
    } = options;

    // Analyze the context to understand what's needed
    const analysis = await this.analyzeContext(context);
    
    // Get relevant snippets from database
    const snippets = this.getRelevantSnippets(context, analysis);
    
    // Generate AI-powered suggestions
    const aiSuggestions = await this.generateAISuggestions(context, analysis, {
      maxSuggestions: Math.floor(maxSuggestions / 2),
      includeDocumentation,
      includeExamples,
    });

    // Combine and rank suggestions
    const allSuggestions = [...snippets, ...aiSuggestions];
    const rankedSuggestions = this.rankSuggestions(allSuggestions, context, analysis);

    return rankedSuggestions.slice(0, maxSuggestions);
  }

  /**
   * Analyze the current coding context
   */
  private async analyzeContext(context: CompletionContext): Promise<{
    intent: string;
    patterns: string[];
    suggestions: string[];
    complexity: 'low' | 'medium' | 'high';
  }> {
    const prompt = PromptTemplate.fromTemplate(`
Analyze the following code context and determine what the developer is likely trying to do.

File: {filePath}
Language: {language}
Framework: {framework}
Current Line: {currentLine}
Cursor Position: {cursorPosition}

Surrounding Code:
{surroundingCode}

Imports: {imports}
Dependencies: {dependencies}

Please analyze:
1. What is the developer likely trying to implement?
2. What patterns are visible in the code?
3. What would be the most helpful suggestions?
4. What is the complexity level of the current task?

Focus on providing actionable insights for code completion.
    `);

    const chain = RunnableSequence.from([
      prompt,
      this.llm,
      new StringOutputParser(),
    ]);

    const result = await chain.invoke({
      filePath: context.filePath,
      language: context.language,
      framework: context.framework || 'none',
      currentLine: context.currentLine,
      cursorPosition: context.cursorPosition,
      surroundingCode: context.surroundingCode,
      imports: context.imports.join(', '),
      dependencies: context.dependencies.join(', '),
    });

    return this.parseContextAnalysis(result);
  }

  /**
   * Get relevant snippets from the database
   */
  private getRelevantSnippets(
    context: CompletionContext,
    analysis: any
  ): CodeSuggestion[] {
    const language = context.language.toLowerCase();
    const snippets = this.snippetDatabase.get(language) || [];
    
    // Filter snippets based on context and analysis
    const relevantSnippets = snippets.filter(snippet => {
      const snippetLower = snippet.toLowerCase();
      const codeLower = context.surroundingCode.toLowerCase();
      
      // Check if snippet is relevant to current context
      return (
        codeLower.includes(snippetLower) ||
        analysis.patterns.some((pattern: string) => 
          pattern.toLowerCase().includes(snippetLower)
        ) ||
        analysis.intent.toLowerCase().includes(snippetLower)
      );
    });

    return relevantSnippets.map(snippet => ({
      text: snippet,
      displayText: snippet,
      kind: 'snippet' as const,
      priority: 0.7,
      description: `Common ${language} pattern: ${snippet}`,
      confidence: 0.8,
    }));
  }

  /**
   * Generate AI-powered code suggestions
   */
  private async generateAISuggestions(
    context: CompletionContext,
    analysis: any,
    options: {
      maxSuggestions: number;
      includeDocumentation: boolean;
      includeExamples: boolean;
    }
  ): Promise<CodeSuggestion[]> {
    const prompt = PromptTemplate.fromTemplate(`
Based on the code context, provide intelligent code completion suggestions.

Context Analysis:
- Intent: {intent}
- Patterns: {patterns}
- Complexity: {complexity}

Code Context:
{surroundingCode}

Language: {language}
Framework: {framework}

Generate {maxSuggestions} specific, actionable code suggestions that:
1. Match the developer's intent
2. Follow the established patterns
3. Are appropriate for the complexity level
4. Include proper syntax and best practices

For each suggestion, provide:
- The actual code to insert
- A brief description
- The type of completion (function, import, etc.)
- Priority level (1-10)

Format as structured suggestions that can be directly used.
    `);

    const chain = RunnableSequence.from([
      prompt,
      this.llm,
      new StringOutputParser(),
    ]);

    const result = await chain.invoke({
      intent: analysis.intent,
      patterns: analysis.patterns.join(', '),
      complexity: analysis.complexity,
      surroundingCode: context.surroundingCode,
      language: context.language,
      framework: context.framework || 'none',
      maxSuggestions: options.maxSuggestions,
    });

    return this.parseAISuggestions(result);
  }

  /**
   * Rank suggestions by relevance and usefulness
   */
  private rankSuggestions(
    suggestions: CodeSuggestion[],
    context: CompletionContext,
    analysis: any
  ): CodeSuggestion[] {
    return suggestions
      .map(suggestion => ({
        ...suggestion,
        priority: this.calculatePriority(suggestion, context, analysis),
      }))
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Calculate priority score for a suggestion
   */
  private calculatePriority(
    suggestion: CodeSuggestion,
    context: CompletionContext,
    analysis: any
  ): number {
    let score = suggestion.priority;

    // Boost score for context-relevant suggestions
    if (context.surroundingCode.toLowerCase().includes(suggestion.text.toLowerCase())) {
      score += 0.2;
    }

    // Boost score for framework-specific suggestions
    if (context.framework && suggestion.description.toLowerCase().includes(context.framework.toLowerCase())) {
      score += 0.15;
    }

    // Boost score for high-confidence suggestions
    score += suggestion.confidence * 0.1;

    // Boost score for recent patterns
    if (analysis.patterns.some((pattern: string) => 
      suggestion.description.toLowerCase().includes(pattern.toLowerCase())
    )) {
      score += 0.1;
    }

    return Math.min(1.0, score);
  }

  /**
   * Parse context analysis result
   */
  private parseContextAnalysis(result: string): {
    intent: string;
    patterns: string[];
    suggestions: string[];
    complexity: 'low' | 'medium' | 'high';
  } {
    // Simple parsing - in production, use more sophisticated parsing
    const lines = result.split('\n');
    const intent = lines.find(line => line.includes('intent') || line.includes('trying')) || 'Unknown';
    const patterns = lines.filter(line => line.includes('pattern') || line.includes('common')).map(line => line.trim());
    
    return {
      intent,
      patterns,
      suggestions: [],
      complexity: 'medium',
    };
  }

  /**
   * Parse AI-generated suggestions
   */
  private parseAISuggestions(result: string): CodeSuggestion[] {
    // Parse the AI-generated suggestions
    const suggestions: CodeSuggestion[] = [];
    const lines = result.split('\n');
    
    let currentSuggestion: Partial<CodeSuggestion> = {};
    
    for (const line of lines) {
      if (line.includes('suggestion:') || line.includes('code:')) {
        if (currentSuggestion.text) {
          suggestions.push(currentSuggestion as CodeSuggestion);
        }
        currentSuggestion = {
          text: line.split(':')[1]?.trim() || '',
          displayText: line.split(':')[1]?.trim() || '',
          kind: 'snippet',
          priority: 0.8,
          description: '',
          confidence: 0.9,
        };
      } else if (currentSuggestion.text && line.includes('description:')) {
        currentSuggestion.description = line.split(':')[1]?.trim() || '';
      }
    }
    
    if (currentSuggestion.text) {
      suggestions.push(currentSuggestion as CodeSuggestion);
    }

    return suggestions;
  }

  /**
   * Get function signature suggestions
   */
  async getFunctionSignatures(
    functionName: string,
    context: CompletionContext
  ): Promise<string[]> {
    const prompt = PromptTemplate.fromTemplate(`
Generate function signature suggestions for: {functionName}

Context:
Language: {language}
Framework: {framework}
Surrounding Code: {surroundingCode}

Provide 3-5 different function signature variations that would be appropriate for this context.
Include:
1. Parameter types and names
2. Return type
3. Generic types if applicable
4. Optional parameters
5. Default values where appropriate

Return only the function signatures, one per line.
    `);

    const chain = RunnableSequence.from([
      prompt,
      this.llm,
      new StringOutputParser(),
    ]);

    const result = await chain.invoke({
      functionName,
      language: context.language,
      framework: context.framework || 'none',
      surroundingCode: context.surroundingCode,
    });

    return result.split('\n').filter(line => line.trim().length > 0);
  }

  /**
   * Get import suggestions
   */
  async getImportSuggestions(
    symbol: string,
    context: CompletionContext
  ): Promise<string[]> {
    const prompt = PromptTemplate.fromTemplate(`
Suggest import statements for: {symbol}

Context:
Language: {language}
Framework: {framework}
File Path: {filePath}
Existing Imports: {imports}

Provide 3-5 different import statement variations that would be appropriate.
Consider:
1. Common package names
2. Framework-specific imports
3. Relative vs absolute imports
4. Named vs default imports
5. Type imports if applicable

Return only the import statements, one per line.
    `);

    const chain = RunnableSequence.from([
      prompt,
      this.llm,
      new StringOutputParser(),
    ]);

    const result = await chain.invoke({
      symbol,
      language: context.language,
      framework: context.framework || 'none',
      filePath: context.filePath,
      imports: context.imports.join(', '),
    });

    return result.split('\n').filter(line => line.trim().length > 0);
  }
}

/**
 * Factory function to create smart code completion
 */
export function createSmartCodeCompletion(apiKey: string): SmartCodeCompletion {
  return new SmartCodeCompletion(apiKey);
}
