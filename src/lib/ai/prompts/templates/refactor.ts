/**
 * Refactor Prompt Templates
 *
 * Templates for AI-powered code refactoring covering:
 * - Clean code principles
 * - Design patterns
 * - Performance optimization
 * - Modernization
 * - Code simplification
 */

import { PromptTemplate, PromptCategory } from '@/types/prompts';

/**
 * Standard code refactoring
 */
export const refactorStandard: PromptTemplate = {
  id: 'refactor-standard',
  name: 'Refactor Code',
  category: PromptCategory.REFACTOR,
  version: '1.0.0',
  description:
    'Comprehensive code refactoring for improved readability, maintainability, and quality',
  systemPrompt: `You are an expert software engineer specializing in code refactoring and clean code practices. Your task is to improve code quality while preserving functionality.

Follow these principles:
1. SOLID principles
2. DRY (Don't Repeat Yourself)
3. KISS (Keep It Simple, Stupid)
4. Clean Code practices
5. Appropriate design patterns
6. Clear naming conventions
7. Proper error handling

Always explain your refactoring decisions and ensure the refactored code is functionally equivalent to the original.`,

  userPromptTemplate: `Refactor the following {{language}} code to improve its quality:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#refactoringGoals}}
Specific goals: {{refactoringGoals}}
{{/refactoringGoals}}

{{#constraints}}
Constraints: {{constraints}}
{{/constraints}}

Please provide:
1. **Refactored Code**: The improved version
2. **Changes Summary**: List of refactoring changes made
3. **Rationale**: Why each change improves the code
4. **Design Patterns**: Any patterns applied (if applicable)
5. **Before/After Comparison**: Key improvements highlighted
6. **Testing Notes**: How to verify the refactoring preserves behavior`,

  variables: [
    {
      name: 'code',
      description: 'The code to refactor',
      required: true,
      type: 'code'
    },
    {
      name: 'language',
      description: 'Programming language',
      required: true,
      type: 'string',
      defaultValue: 'typescript'
    },
    {
      name: 'refactoringGoals',
      description: 'Specific refactoring goals or focus areas',
      required: false,
      type: 'string',
      example: 'improve readability, reduce complexity, add type safety'
    },
    {
      name: 'constraints',
      description: 'Constraints to work within',
      required: false,
      type: 'string',
      example: 'maintain backward compatibility, no external dependencies'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'openai/gpt-4-turbo'
  ],

  maxTokens: 6144,
  temperature: 0.3,

  modelRequirements: {
    minContextWindow: 8000,
    codeCapable: true,
    capabilities: ['code', 'reasoning']
  },

  tags: ['refactor', 'clean-code', 'quality', 'improvement'],
  isSystem: true,

  examples: [
    {
      description: 'Refactor nested callbacks to async/await',
      variables: {
        code: `function getData(callback) {
  fetch('/api/users')
    .then(res => res.json())
    .then(users => {
      fetch('/api/posts')
        .then(res => res.json())
        .then(posts => callback(users, posts))
        .catch(err => callback(null, null, err));
    })
    .catch(err => callback(null, null, err));
}`,
        language: 'javascript',
        refactoringGoals: 'convert to async/await, improve error handling'
      }
    }
  ]
};

/**
 * Performance-focused refactoring
 */
export const refactorPerformance: PromptTemplate = {
  id: 'refactor-performance',
  name: 'Refactor for Performance',
  category: PromptCategory.REFACTOR,
  version: '1.0.0',
  description:
    'Refactor code to improve performance while maintaining readability',
  systemPrompt: `You are a performance optimization expert. Refactor code to improve efficiency without sacrificing maintainability.

Focus on:
1. Algorithmic improvements (better time/space complexity)
2. Reducing unnecessary operations
3. Optimizing loops and iterations
4. Caching and memoization opportunities
5. Lazy evaluation where appropriate
6. Memory efficiency
7. Async optimization and parallelization

Provide Big-O analysis for both original and refactored code.`,

  userPromptTemplate: `Refactor this {{language}} code for better performance:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#performanceTarget}}
Performance target: {{performanceTarget}}
{{/performanceTarget}}

{{#dataScale}}
Expected data scale: {{dataScale}}
{{/dataScale}}

Please provide:
1. **Optimized Code**: Performance-improved version
2. **Complexity Analysis**: Big-O before and after
3. **Optimizations Applied**: List of performance improvements
4. **Benchmarking Suggestions**: How to measure improvements
5. **Trade-offs**: Any trade-offs made (readability, memory, etc.)
6. **Further Optimizations**: Additional improvements if needed`,

  variables: [
    {
      name: 'code',
      description: 'The code to optimize',
      required: true,
      type: 'code'
    },
    {
      name: 'language',
      description: 'Programming language',
      required: true,
      type: 'string',
      defaultValue: 'typescript'
    },
    {
      name: 'performanceTarget',
      description: 'Specific performance goals',
      required: false,
      type: 'string',
      example: 'reduce time complexity, minimize memory usage'
    },
    {
      name: 'dataScale',
      description: 'Expected data size/scale',
      required: false,
      type: 'string',
      example: '1 million records, 10k requests/second'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'google/gemini-pro-1.5'
  ],

  maxTokens: 4096,
  temperature: 0.2,

  tags: ['refactor', 'performance', 'optimization', 'efficiency'],
  isSystem: true
};

/**
 * Design pattern application
 */
export const refactorDesignPatterns: PromptTemplate = {
  id: 'refactor-design-patterns',
  name: 'Apply Design Patterns',
  category: PromptCategory.REFACTOR,
  version: '1.0.0',
  description:
    'Refactor code to apply appropriate design patterns',
  systemPrompt: `You are a software architect specializing in design patterns. Analyze code and apply appropriate patterns to improve structure and maintainability.

Consider patterns like:
- Creational: Factory, Builder, Singleton
- Structural: Adapter, Decorator, Facade, Proxy
- Behavioral: Observer, Strategy, Command, State
- Architectural: Repository, Service, MVC/MVVM

Only suggest patterns that genuinely improve the code. Explain why each pattern is appropriate.`,

  userPromptTemplate: `Refactor this {{language}} code using appropriate design patterns:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#suggestedPatterns}}
Consider these patterns: {{suggestedPatterns}}
{{/suggestedPatterns}}

{{#context}}
Code context: {{context}}
{{/context}}

Please provide:
1. **Pattern Analysis**: Which patterns apply and why
2. **Refactored Code**: Implementation with the pattern(s)
3. **Pattern Explanation**: How the pattern is implemented
4. **Benefits**: What improvements the pattern brings
5. **UML/Diagram**: Describe the structure (ASCII diagram if helpful)
6. **When to Use**: Guidelines for when this pattern is appropriate`,

  variables: [
    {
      name: 'code',
      description: 'The code to refactor with design patterns',
      required: true,
      type: 'code'
    },
    {
      name: 'language',
      description: 'Programming language',
      required: true,
      type: 'string',
      defaultValue: 'typescript'
    },
    {
      name: 'suggestedPatterns',
      description: 'Specific patterns to consider',
      required: false,
      type: 'string',
      example: 'Factory, Strategy, Observer'
    },
    {
      name: 'context',
      description: 'Context about the code purpose',
      required: false,
      type: 'string'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'openai/gpt-4-turbo'
  ],

  maxTokens: 6144,
  temperature: 0.3,

  tags: ['refactor', 'design-patterns', 'architecture', 'solid'],
  isSystem: true
};

/**
 * Code modernization
 */
export const refactorModernize: PromptTemplate = {
  id: 'refactor-modernize',
  name: 'Modernize Code',
  category: PromptCategory.REFACTOR,
  version: '1.0.0',
  description:
    'Update legacy code to use modern language features and best practices',
  systemPrompt: `You are a modernization expert updating legacy code to use current best practices and language features.

For JavaScript/TypeScript, consider:
- ES2020+ features (optional chaining, nullish coalescing, etc.)
- Async/await over callbacks/promises
- Modern array methods
- TypeScript strict typing
- Modern module patterns

For other languages, apply equivalent modern patterns and idioms.

Ensure backward compatibility unless explicitly allowed to break it.`,

  userPromptTemplate: `Modernize this {{language}} code to use current best practices:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#targetVersion}}
Target language version: {{targetVersion}}
{{/targetVersion}}

{{#modernizationGoals}}
Modernization goals: {{modernizationGoals}}
{{/modernizationGoals}}

Please provide:
1. **Modernized Code**: Updated version using modern features
2. **Features Applied**: List of modern features/patterns used
3. **Migration Notes**: Any breaking changes or compatibility notes
4. **Benefits**: Improvements from modernization
5. **Browser/Runtime Support**: Compatibility information
6. **Gradual Migration**: Suggestions for incremental modernization`,

  variables: [
    {
      name: 'code',
      description: 'The legacy code to modernize',
      required: true,
      type: 'code'
    },
    {
      name: 'language',
      description: 'Programming language',
      required: true,
      type: 'string',
      defaultValue: 'typescript'
    },
    {
      name: 'targetVersion',
      description: 'Target language/runtime version',
      required: false,
      type: 'string',
      example: 'ES2022, Node 18, TypeScript 5'
    },
    {
      name: 'modernizationGoals',
      description: 'Specific modernization objectives',
      required: false,
      type: 'string',
      example: 'add TypeScript types, use async/await, update to ES modules'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'google/gemini-pro-1.5'
  ],

  maxTokens: 4096,
  temperature: 0.3,

  tags: ['refactor', 'modernize', 'upgrade', 'legacy'],
  isSystem: true
};

/**
 * Code simplification
 */
export const refactorSimplify: PromptTemplate = {
  id: 'refactor-simplify',
  name: 'Simplify Code',
  category: PromptCategory.REFACTOR,
  version: '1.0.0',
  description:
    'Simplify complex code while maintaining functionality',
  systemPrompt: `You are an expert at simplifying complex code. Your goal is to reduce complexity while maintaining (or improving) readability and functionality.

Focus on:
1. Reducing cyclomatic complexity
2. Flattening deeply nested code
3. Breaking down large functions
4. Removing unnecessary abstractions
5. Simplifying conditional logic
6. Eliminating redundancy
7. Improving naming for clarity

The simplest code that does the job correctly is the best code.`,

  userPromptTemplate: `Simplify this {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#complexityIssues}}
Specific complexity issues: {{complexityIssues}}
{{/complexityIssues}}

Please provide:
1. **Simplified Code**: Cleaner, simpler version
2. **Complexity Reduction**: Before/after complexity metrics
3. **Simplifications Made**: List of changes
4. **Readability Improvements**: How readability improved
5. **Edge Cases**: Ensure all edge cases are still handled
6. **Further Simplification**: Additional simplification opportunities`,

  variables: [
    {
      name: 'code',
      description: 'The complex code to simplify',
      required: true,
      type: 'code'
    },
    {
      name: 'language',
      description: 'Programming language',
      required: true,
      type: 'string',
      defaultValue: 'typescript'
    },
    {
      name: 'complexityIssues',
      description: 'Specific complexity problems to address',
      required: false,
      type: 'string',
      example: 'deeply nested conditionals, large function, repetitive code'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'openai/gpt-4o-mini'
  ],

  maxTokens: 4096,
  temperature: 0.3,

  tags: ['refactor', 'simplify', 'complexity', 'clean-code'],
  isSystem: true
};

/**
 * Extract and modularize
 */
export const refactorExtract: PromptTemplate = {
  id: 'refactor-extract',
  name: 'Extract & Modularize',
  category: PromptCategory.REFACTOR,
  version: '1.0.0',
  description:
    'Extract reusable functions, classes, or modules from existing code',
  systemPrompt: `You are an expert at code modularization and extraction. Your task is to identify opportunities to extract reusable components from existing code.

Consider extracting:
1. Repeated logic into functions
2. Related functions into classes or modules
3. Configuration into separate files
4. Constants and magic values
5. Type definitions
6. Utility functions
7. Hooks (for React)

Each extraction should have a single responsibility and clear interface.`,

  userPromptTemplate: `Extract reusable components from this {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#extractionGoals}}
Extraction goals: {{extractionGoals}}
{{/extractionGoals}}

Please provide:
1. **Extraction Analysis**: What can/should be extracted
2. **Extracted Components**: Each extracted piece with its code
3. **Refactored Original**: The original code using the extracted components
4. **File Structure**: Suggested file organization
5. **Interfaces/Types**: Type definitions for extracted components
6. **Usage Examples**: How to use the extracted components`,

  variables: [
    {
      name: 'code',
      description: 'The code to extract components from',
      required: true,
      type: 'code'
    },
    {
      name: 'language',
      description: 'Programming language',
      required: true,
      type: 'string',
      defaultValue: 'typescript'
    },
    {
      name: 'extractionGoals',
      description: 'Specific extraction objectives',
      required: false,
      type: 'string',
      example: 'create utility functions, extract React hooks, modularize'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'openai/gpt-4-turbo'
  ],

  maxTokens: 6144,
  temperature: 0.3,

  tags: ['refactor', 'extract', 'modularize', 'reusable'],
  isSystem: true
};

/**
 * Quick refactor suggestions
 */
export const refactorQuick: PromptTemplate = {
  id: 'refactor-quick',
  name: 'Quick Refactor',
  category: PromptCategory.REFACTOR,
  version: '1.0.0',
  description:
    'Fast refactoring with concise improvements',
  systemPrompt: `Provide quick, practical refactoring improvements. Focus on the most impactful changes that can be made quickly. Be concise.`,

  userPromptTemplate: `Quick refactor for this {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

Provide:
1. Top 3 improvements (with code)
2. One-line explanation for each`,

  variables: [
    {
      name: 'code',
      description: 'The code to refactor',
      required: true,
      type: 'code'
    },
    {
      name: 'language',
      description: 'Programming language',
      required: true,
      type: 'string',
      defaultValue: 'typescript'
    }
  ],

  recommendedModels: [
    'openai/gpt-4o-mini',
    'anthropic/claude-3-haiku',
    'google/gemini-flash-1.5'
  ],

  maxTokens: 2048,
  temperature: 0.3,

  tags: ['refactor', 'quick', 'suggestions'],
  isSystem: true
};

/**
 * Export all refactoring templates
 */
export const refactorTemplates: PromptTemplate[] = [
  refactorStandard,
  refactorPerformance,
  refactorDesignPatterns,
  refactorModernize,
  refactorSimplify,
  refactorExtract,
  refactorQuick
];

export default refactorTemplates;
