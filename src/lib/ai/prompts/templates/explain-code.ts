/**
 * Explain Code Prompt Templates
 *
 * Templates for AI-powered code explanation covering:
 * - Line-by-line analysis
 * - Conceptual explanations
 * - Architecture overviews
 * - Beginner-friendly breakdowns
 */

import { PromptTemplate, PromptCategory } from '@/types/prompts';

/**
 * Standard code explanation - comprehensive breakdown
 */
export const explainCodeStandard: PromptTemplate = {
  id: 'explain-code-standard',
  name: 'Explain Code',
  category: PromptCategory.EXPLAIN,
  version: '1.0.0',
  description:
    'Comprehensive explanation of code functionality, logic, and purpose',
  systemPrompt: `You are an expert programming instructor who excels at explaining code clearly and thoroughly. Your explanations should:

1. Break down complex concepts into digestible parts
2. Explain the "why" behind code decisions, not just the "what"
3. Use analogies when helpful
4. Highlight important patterns and techniques
5. Point out potential gotchas or edge cases
6. Connect to broader programming concepts when relevant

Adapt your explanation complexity to the requested audience level.`,

  userPromptTemplate: `Please explain the following {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#audienceLevel}}
Audience level: {{audienceLevel}}
{{/audienceLevel}}

{{#specificQuestions}}
Specific questions to address:
{{specificQuestions}}
{{/specificQuestions}}

Provide:
1. **Overview**: What does this code do at a high level?
2. **Detailed Breakdown**: Step-by-step explanation of how it works
3. **Key Concepts**: Important programming concepts used
4. **Flow Diagram**: Describe the execution flow (use ASCII if helpful)
5. **Common Questions**: Anticipate and answer likely questions`,

  variables: [
    {
      name: 'code',
      description: 'The code to explain',
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
      name: 'audienceLevel',
      description: 'Target audience expertise level',
      required: false,
      type: 'string',
      defaultValue: 'intermediate',
      example: 'beginner, intermediate, advanced'
    },
    {
      name: 'specificQuestions',
      description: 'Specific questions about the code',
      required: false,
      type: 'string'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'google/gemini-pro-1.5'
  ],

  maxTokens: 4096,
  temperature: 0.5,

  modelRequirements: {
    codeCapable: true,
    capabilities: ['code', 'reasoning']
  },

  tags: ['explain', 'education', 'understanding', 'documentation'],
  isSystem: true,

  examples: [
    {
      description: 'Explain async/await pattern',
      variables: {
        code: `async function fetchData() {
  try {
    const response = await fetch('/api/data');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch:', error);
    throw error;
  }
}`,
        language: 'javascript',
        audienceLevel: 'beginner'
      }
    }
  ]
};

/**
 * Beginner-friendly code explanation
 */
export const explainCodeBeginner: PromptTemplate = {
  id: 'explain-code-beginner',
  name: 'Explain Code (Beginner)',
  category: PromptCategory.EXPLAIN,
  version: '1.0.0',
  description:
    'Beginner-friendly explanation with no assumed programming knowledge',
  systemPrompt: `You are a patient and encouraging programming teacher explaining code to someone new to programming. Your explanations should:

1. Assume NO prior programming knowledge
2. Define all technical terms when first used
3. Use real-world analogies extensively
4. Break everything into small, simple steps
5. Be encouraging and supportive
6. Avoid jargon or explain it immediately
7. Use simple language throughout

Think of yourself as teaching a curious friend who has never written code before.`,

  userPromptTemplate: `Please explain this code to someone who is new to programming:

\`\`\`{{language}}
{{code}}
\`\`\`

Explain it like I'm completely new to {{language}} and programming in general.

Please include:
1. **What This Code Does**: Simple, one-sentence summary
2. **Real-World Analogy**: Compare it to something from everyday life
3. **Line-by-Line Explanation**: What each part does in plain English
4. **New Words**: Define any programming terms used
5. **Why It's Written This Way**: The reasoning behind the approach
6. **Try It Yourself**: A simple modification they could try`,

  variables: [
    {
      name: 'code',
      description: 'The code to explain',
      required: true,
      type: 'code'
    },
    {
      name: 'language',
      description: 'Programming language',
      required: true,
      type: 'string',
      defaultValue: 'javascript'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'openai/gpt-4o-mini'
  ],

  maxTokens: 4096,
  temperature: 0.6,

  tags: ['explain', 'beginner', 'education', 'learning'],
  isSystem: true
};

/**
 * Technical deep-dive explanation
 */
export const explainCodeDeepDive: PromptTemplate = {
  id: 'explain-code-deep-dive',
  name: 'Technical Deep Dive',
  category: PromptCategory.EXPLAIN,
  version: '1.0.0',
  description:
    'Advanced technical explanation with implementation details and internals',
  systemPrompt: `You are a senior software architect providing an in-depth technical analysis. Your explanation should cover:

1. Implementation details and design decisions
2. Time and space complexity analysis
3. Memory management considerations
4. Concurrency and thread-safety aspects
5. How this interacts with language runtime/internals
6. Trade-offs made in the implementation
7. Alternative approaches and why this was chosen

Assume the reader has strong programming fundamentals and wants to understand the deeper technical aspects.`,

  userPromptTemplate: `Provide a technical deep-dive on this {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#focusArea}}
Focus particularly on: {{focusArea}}
{{/focusArea}}

Please analyze:
1. **Architecture & Design**: Design patterns and architectural decisions
2. **Complexity Analysis**: Time/space complexity with Big-O notation
3. **Runtime Behavior**: How this executes, memory allocation, etc.
4. **Edge Cases**: Boundary conditions and how they're handled
5. **Concurrency**: Thread-safety, race conditions, async behavior
6. **Trade-offs**: What was gained/sacrificed with this approach
7. **Alternatives**: Other ways to implement this with pros/cons
8. **Production Considerations**: Scalability, monitoring, debugging`,

  variables: [
    {
      name: 'code',
      description: 'The code to analyze in depth',
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
      name: 'focusArea',
      description: 'Specific area to focus the deep-dive on',
      required: false,
      type: 'string',
      example: 'memory management, concurrency, performance'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'openai/gpt-4-turbo'
  ],

  maxTokens: 6144,
  temperature: 0.3,

  tags: ['explain', 'advanced', 'technical', 'deep-dive', 'architecture'],
  isSystem: true
};

/**
 * Explain code architecture
 */
export const explainCodeArchitecture: PromptTemplate = {
  id: 'explain-code-architecture',
  name: 'Explain Architecture',
  category: PromptCategory.EXPLAIN,
  version: '1.0.0',
  description:
    'Explain the architectural patterns and structure of a codebase',
  systemPrompt: `You are a software architect explaining system design and code architecture. Focus on:

1. Overall structure and organization
2. Design patterns in use
3. Component relationships and dependencies
4. Data flow through the system
5. Separation of concerns
6. Extensibility and maintainability aspects

Create clear mental models of how the pieces fit together.`,

  userPromptTemplate: `Explain the architecture of this {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#projectContext}}
Project context: {{projectContext}}
{{/projectContext}}

Please explain:
1. **Architecture Overview**: High-level structure and organization
2. **Design Patterns**: Patterns used and why
3. **Component Diagram**: Describe the components and their relationships
4. **Data Flow**: How data moves through the system
5. **Dependencies**: External and internal dependencies
6. **Extensibility**: How easy it is to extend/modify
7. **Potential Improvements**: Architectural improvements to consider`,

  variables: [
    {
      name: 'code',
      description: 'The code/codebase to explain architecturally',
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
      name: 'projectContext',
      description: 'Context about the project type and purpose',
      required: false,
      type: 'string',
      example: 'E-commerce backend API, React frontend application'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'google/gemini-pro-1.5'
  ],

  maxTokens: 4096,
  temperature: 0.4,

  tags: ['explain', 'architecture', 'design-patterns', 'structure'],
  isSystem: true
};

/**
 * Explain code changes (diff)
 */
export const explainCodeChanges: PromptTemplate = {
  id: 'explain-code-changes',
  name: 'Explain Code Changes',
  category: PromptCategory.EXPLAIN,
  version: '1.0.0',
  description: 'Explain what changed between two versions of code',
  systemPrompt: `You are explaining code changes to help developers understand modifications. For each change:

1. Identify what was modified, added, or removed
2. Explain the purpose/intent of the change
3. Highlight any behavioral differences
4. Note potential impacts on other parts of the code

Be clear about both the technical changes and their implications.`,

  userPromptTemplate: `Explain the changes between these two versions:

**Before**:
\`\`\`{{language}}
{{codeBefore}}
\`\`\`

**After**:
\`\`\`{{language}}
{{codeAfter}}
\`\`\`

{{#changeContext}}
Context for the change: {{changeContext}}
{{/changeContext}}

Please explain:
1. **Summary**: What changed at a high level
2. **Detailed Changes**: Each modification explained
3. **Why**: The likely reason for each change
4. **Impact**: How these changes affect behavior
5. **Breaking Changes**: Any compatibility concerns
6. **Testing Implications**: What should be tested`,

  variables: [
    {
      name: 'codeBefore',
      description: 'The original code before changes',
      required: true,
      type: 'code'
    },
    {
      name: 'codeAfter',
      description: 'The code after changes',
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
      name: 'changeContext',
      description: 'Context about why changes were made',
      required: false,
      type: 'string'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'openai/gpt-4o-mini'
  ],

  maxTokens: 3072,
  temperature: 0.4,

  tags: ['explain', 'diff', 'changes', 'comparison'],
  isSystem: true
};

/**
 * Quick explanation
 */
export const explainCodeQuick: PromptTemplate = {
  id: 'explain-code-quick',
  name: 'Quick Explanation',
  category: PromptCategory.EXPLAIN,
  version: '1.0.0',
  description: 'Fast, concise explanation of what code does',
  systemPrompt: `Provide a brief, clear explanation of what the code does. Be concise but complete. Focus on the main purpose and key functionality.`,

  userPromptTemplate: `Briefly explain what this {{language}} code does:

\`\`\`{{language}}
{{code}}
\`\`\`

Provide:
1. One-sentence summary
2. Key inputs and outputs
3. Main functionality in 2-3 bullet points`,

  variables: [
    {
      name: 'code',
      description: 'The code to explain',
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

  maxTokens: 1024,
  temperature: 0.4,

  tags: ['explain', 'quick', 'summary'],
  isSystem: true
};

/**
 * Export all explanation templates
 */
export const explainCodeTemplates: PromptTemplate[] = [
  explainCodeStandard,
  explainCodeBeginner,
  explainCodeDeepDive,
  explainCodeArchitecture,
  explainCodeChanges,
  explainCodeQuick
];

export default explainCodeTemplates;
