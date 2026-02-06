/**
 * Documentation Prompt Templates
 *
 * Templates for AI-powered documentation generation covering:
 * - JSDoc/TSDoc comments
 * - README files
 * - API documentation
 * - Code comments
 * - Technical specifications
 */

import { PromptTemplate, PromptCategory } from '@/types/prompts';

/**
 * Generate JSDoc/TSDoc comments
 */
export const documentationJSDoc: PromptTemplate = {
  id: 'documentation-jsdoc',
  name: 'Generate JSDoc/TSDoc',
  category: PromptCategory.DOCUMENT,
  version: '1.0.0',
  description:
    'Generate comprehensive JSDoc or TSDoc comments for functions, classes, and modules',
  systemPrompt: `You are an expert technical writer specializing in code documentation. Generate clear, comprehensive JSDoc/TSDoc comments that:

1. Clearly describe the purpose and functionality
2. Document all parameters with types and descriptions
3. Document return values and their types
4. Document thrown exceptions
5. Include usage examples where helpful
6. Note any important side effects or requirements
7. Use proper JSDoc/TSDoc tags (@param, @returns, @throws, @example, etc.)
8. Keep descriptions concise but informative

Follow the Google TypeScript Style Guide for documentation conventions.`,

  userPromptTemplate: `Generate {{docStyle}} documentation for this {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#additionalContext}}
Additional context: {{additionalContext}}
{{/additionalContext}}

{{#includeExamples}}
Include examples: {{includeExamples}}
{{/includeExamples}}

Please generate:
1. **Complete Documentation**: Full JSDoc/TSDoc comments for all exports
2. **Parameter Descriptions**: Detailed parameter documentation
3. **Return Documentation**: Return value descriptions
4. **Examples**: Usage examples (if requested)
5. **Type Information**: Type annotations and descriptions
6. **Original Code**: The code with documentation added`,

  variables: [
    {
      name: 'code',
      description: 'The code to document',
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
      name: 'docStyle',
      description: 'Documentation style to use',
      required: false,
      type: 'string',
      defaultValue: 'TSDoc',
      example: 'JSDoc, TSDoc'
    },
    {
      name: 'additionalContext',
      description: 'Additional context about the code',
      required: false,
      type: 'string'
    },
    {
      name: 'includeExamples',
      description: 'Whether to include usage examples',
      required: false,
      type: 'boolean',
      defaultValue: 'true'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'openai/gpt-4-turbo'
  ],

  maxTokens: 4096,
  temperature: 0.3,

  modelRequirements: {
    codeCapable: true,
    capabilities: ['code', 'reasoning']
  },

  tags: ['documentation', 'jsdoc', 'tsdoc', 'comments'],
  isSystem: true,

  examples: [
    {
      description: 'Document a utility function',
      variables: {
        code: `export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number,
  immediate?: boolean
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return function(this: any, ...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    };
    const callNow = immediate && !timeout;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(this, args);
  };
}`,
        language: 'typescript',
        docStyle: 'TSDoc',
        includeExamples: 'true'
      }
    }
  ]
};

/**
 * Generate README documentation
 */
export const documentationReadme: PromptTemplate = {
  id: 'documentation-readme',
  name: 'Generate README',
  category: PromptCategory.DOCUMENT,
  version: '1.0.0',
  description:
    'Generate comprehensive README.md documentation for projects or modules',
  systemPrompt: `You are an expert at writing clear, helpful README documentation. Create documentation that:

1. Provides a clear project overview
2. Explains installation and setup
3. Shows common usage examples
4. Documents configuration options
5. Includes API reference or links to it
6. Lists dependencies and requirements
7. Provides contribution guidelines
8. Includes license information

Write for developers who are new to the project but technically competent.`,

  userPromptTemplate: `Generate README documentation for this project/module:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#projectName}}
Project name: {{projectName}}
{{/projectName}}

{{#projectDescription}}
Project description: {{projectDescription}}
{{/projectDescription}}

{{#sections}}
Sections to include: {{sections}}
{{/sections}}

Please generate a README.md with:
1. **Title and Description**: Project name and overview
2. **Features**: Key features and capabilities
3. **Installation**: Setup instructions
4. **Quick Start**: Basic usage example
5. **API Reference**: Key functions/methods
6. **Configuration**: Available options
7. **Examples**: More detailed usage examples
8. **Contributing**: How to contribute
9. **License**: License information`,

  variables: [
    {
      name: 'code',
      description: 'Code or package.json to analyze',
      required: true,
      type: 'code'
    },
    {
      name: 'language',
      description: 'Primary programming language',
      required: true,
      type: 'string',
      defaultValue: 'typescript'
    },
    {
      name: 'projectName',
      description: 'Name of the project',
      required: false,
      type: 'string'
    },
    {
      name: 'projectDescription',
      description: 'Brief description of the project',
      required: false,
      type: 'string'
    },
    {
      name: 'sections',
      description: 'Specific sections to include',
      required: false,
      type: 'string',
      example: 'installation, usage, api, contributing'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'google/gemini-pro-1.5'
  ],

  maxTokens: 6144,
  temperature: 0.4,

  tags: ['documentation', 'readme', 'markdown', 'project'],
  isSystem: true
};

/**
 * Generate API documentation
 */
export const documentationAPI: PromptTemplate = {
  id: 'documentation-api',
  name: 'Generate API Documentation',
  category: PromptCategory.DOCUMENT,
  version: '1.0.0',
  description:
    'Generate comprehensive API documentation for REST or GraphQL APIs',
  systemPrompt: `You are an expert at writing API documentation. Create clear, complete documentation that:

1. Documents all endpoints/operations
2. Specifies request/response formats
3. Includes authentication requirements
4. Shows example requests and responses
5. Documents error codes and messages
6. Provides rate limiting information
7. Includes code examples in multiple languages
8. Follows OpenAPI/Swagger conventions

Write documentation that developers can use to integrate with the API immediately.`,

  userPromptTemplate: `Generate API documentation for this {{apiType}} endpoint:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#baseUrl}}
Base URL: {{baseUrl}}
{{/baseUrl}}

{{#authMethod}}
Authentication: {{authMethod}}
{{/authMethod}}

Please generate:
1. **Endpoint Overview**: Description and purpose
2. **Authentication**: Required auth and how to provide it
3. **Request Format**: Method, path, headers, body
4. **Parameters**: Query params, path params, body schema
5. **Response Format**: Success and error responses
6. **Example Requests**: cURL and code examples
7. **Error Codes**: Possible errors and meanings
8. **Rate Limits**: Any rate limiting (if applicable)`,

  variables: [
    {
      name: 'code',
      description: 'API endpoint code or schema',
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
      name: 'apiType',
      description: 'Type of API',
      required: false,
      type: 'string',
      defaultValue: 'REST',
      example: 'REST, GraphQL, gRPC'
    },
    {
      name: 'baseUrl',
      description: 'Base URL for the API',
      required: false,
      type: 'string',
      example: 'https://api.example.com/v1'
    },
    {
      name: 'authMethod',
      description: 'Authentication method used',
      required: false,
      type: 'string',
      example: 'Bearer token, API key, OAuth 2.0'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'openai/gpt-4-turbo'
  ],

  maxTokens: 6144,
  temperature: 0.3,

  tags: ['documentation', 'api', 'rest', 'openapi', 'swagger'],
  isSystem: true
};

/**
 * Generate inline code comments
 */
export const documentationInlineComments: PromptTemplate = {
  id: 'documentation-inline-comments',
  name: 'Add Inline Comments',
  category: PromptCategory.DOCUMENT,
  version: '1.0.0',
  description:
    'Add helpful inline comments explaining complex code sections',
  systemPrompt: `You are an expert at adding helpful inline comments to code. Your comments should:

1. Explain the "why" not just the "what"
2. Clarify complex logic and algorithms
3. Note important assumptions or constraints
4. Highlight potential issues or edge cases
5. Be concise and not state the obvious
6. Use consistent formatting

Comments should help future developers understand the code without being excessive.`,

  userPromptTemplate: `Add helpful inline comments to this {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#commentStyle}}
Comment style: {{commentStyle}}
{{/commentStyle}}

{{#focusAreas}}
Focus on explaining: {{focusAreas}}
{{/focusAreas}}

Please provide:
1. **Commented Code**: The code with appropriate inline comments
2. **Comment Summary**: Overview of what was documented
3. **Complexity Notes**: Any particularly complex sections explained`,

  variables: [
    {
      name: 'code',
      description: 'The code to add comments to',
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
      name: 'commentStyle',
      description: 'Preferred comment style/density',
      required: false,
      type: 'string',
      defaultValue: 'moderate',
      example: 'minimal, moderate, verbose'
    },
    {
      name: 'focusAreas',
      description: 'Specific areas to focus comments on',
      required: false,
      type: 'string',
      example: 'algorithms, business logic, edge cases'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'openai/gpt-4o-mini'
  ],

  maxTokens: 4096,
  temperature: 0.3,

  tags: ['documentation', 'comments', 'inline', 'explanation'],
  isSystem: true
};

/**
 * Generate technical specification
 */
export const documentationTechnicalSpec: PromptTemplate = {
  id: 'documentation-technical-spec',
  name: 'Generate Technical Specification',
  category: PromptCategory.DOCUMENT,
  version: '1.0.0',
  description:
    'Generate technical specification documents for features or systems',
  systemPrompt: `You are a senior engineer writing technical specifications. Create detailed specs that:

1. Clearly define the problem and solution
2. Document architecture and design decisions
3. Specify APIs and data models
4. Include sequence diagrams or flow descriptions
5. Address error handling and edge cases
6. Consider security implications
7. Define success metrics and testing strategy
8. List dependencies and risks

Write specs that enable another engineer to implement the feature correctly.`,

  userPromptTemplate: `Generate a technical specification based on this code/context:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#featureName}}
Feature name: {{featureName}}
{{/featureName}}

{{#requirements}}
Requirements: {{requirements}}
{{/requirements}}

Please generate:
1. **Overview**: Executive summary
2. **Problem Statement**: What problem does this solve
3. **Proposed Solution**: High-level approach
4. **Technical Design**: Detailed architecture
5. **API Design**: Interfaces and contracts
6. **Data Model**: Data structures and schemas
7. **Error Handling**: Error cases and responses
8. **Security Considerations**: Security requirements
9. **Testing Strategy**: How to test
10. **Timeline and Risks**: Implementation considerations`,

  variables: [
    {
      name: 'code',
      description: 'Existing code or prototype',
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
      name: 'featureName',
      description: 'Name of the feature being specified',
      required: false,
      type: 'string'
    },
    {
      name: 'requirements',
      description: 'High-level requirements or user stories',
      required: false,
      type: 'string'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'openai/gpt-4-turbo'
  ],

  maxTokens: 8192,
  temperature: 0.4,

  tags: ['documentation', 'technical-spec', 'design-doc', 'architecture'],
  isSystem: true
};

/**
 * Generate changelog entry
 */
export const documentationChangelog: PromptTemplate = {
  id: 'documentation-changelog',
  name: 'Generate Changelog Entry',
  category: PromptCategory.DOCUMENT,
  version: '1.0.0',
  description:
    'Generate changelog entries from code changes or commit history',
  systemPrompt: `You are writing changelog entries following Keep a Changelog conventions. Entries should:

1. Be written for end users/developers
2. Use clear, concise language
3. Group changes by type (Added, Changed, Deprecated, Removed, Fixed, Security)
4. Include relevant issue/PR references
5. Note breaking changes prominently
6. Be in reverse chronological order

Write entries that help users understand what changed and why it matters to them.`,

  userPromptTemplate: `Generate a changelog entry for these changes:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#version}}
Version: {{version}}
{{/version}}

{{#changeDescription}}
Change description: {{changeDescription}}
{{/changeDescription}}

{{#previousCode}}
Previous code:
\`\`\`{{language}}
{{previousCode}}
\`\`\`
{{/previousCode}}

Please generate:
1. **Changelog Entry**: Formatted entry for CHANGELOG.md
2. **Categories**: Changes grouped by type
3. **Breaking Changes**: Any breaking changes highlighted
4. **Migration Guide**: Steps to migrate (if breaking changes)`,

  variables: [
    {
      name: 'code',
      description: 'New/changed code',
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
      name: 'version',
      description: 'Version number for this release',
      required: false,
      type: 'string',
      example: '1.2.0'
    },
    {
      name: 'changeDescription',
      description: 'Description of what was changed',
      required: false,
      type: 'string'
    },
    {
      name: 'previousCode',
      description: 'Previous version of the code (for comparison)',
      required: false,
      type: 'code'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'openai/gpt-4o-mini'
  ],

  maxTokens: 2048,
  temperature: 0.4,

  tags: ['documentation', 'changelog', 'release-notes', 'versioning'],
  isSystem: true
};

/**
 * Generate code architecture documentation
 */
export const documentationArchitecture: PromptTemplate = {
  id: 'documentation-architecture',
  name: 'Document Architecture',
  category: PromptCategory.DOCUMENT,
  version: '1.0.0',
  description:
    'Generate architecture documentation for codebases and systems',
  systemPrompt: `You are a software architect documenting system design. Create documentation that:

1. Provides system overview and context
2. Documents component structure and relationships
3. Explains data flow and communication patterns
4. Includes diagrams (described in text/Mermaid)
5. Documents design decisions and rationale
6. Lists technologies and dependencies
7. Addresses scalability and performance
8. Notes security architecture

Write documentation that helps new team members understand the system quickly.`,

  userPromptTemplate: `Document the architecture of this codebase:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#systemName}}
System name: {{systemName}}
{{/systemName}}

{{#systemContext}}
System context: {{systemContext}}
{{/systemContext}}

Please generate:
1. **System Overview**: High-level description
2. **Architecture Diagram**: Mermaid or ASCII diagram
3. **Component Documentation**: Each major component
4. **Data Flow**: How data moves through the system
5. **Technology Stack**: Technologies and their roles
6. **Design Decisions**: Key decisions and rationale
7. **Scalability**: How the system scales
8. **Security**: Security architecture overview`,

  variables: [
    {
      name: 'code',
      description: 'Code to analyze for architecture',
      required: true,
      type: 'code'
    },
    {
      name: 'language',
      description: 'Primary programming language',
      required: true,
      type: 'string',
      defaultValue: 'typescript'
    },
    {
      name: 'systemName',
      description: 'Name of the system',
      required: false,
      type: 'string'
    },
    {
      name: 'systemContext',
      description: 'Context about the system purpose',
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
  temperature: 0.4,

  tags: ['documentation', 'architecture', 'design', 'system'],
  isSystem: true
};

/**
 * Quick documentation
 */
export const documentationQuick: PromptTemplate = {
  id: 'documentation-quick',
  name: 'Quick Documentation',
  category: PromptCategory.DOCUMENT,
  version: '1.0.0',
  description:
    'Generate quick, essential documentation',
  systemPrompt: `Generate concise, essential documentation. Focus on the most important information that developers need.`,

  userPromptTemplate: `Add quick documentation to this {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

Provide:
1. Brief function/class description comment
2. Parameter/property descriptions
3. Return value description`,

  variables: [
    {
      name: 'code',
      description: 'The code to document',
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

  tags: ['documentation', 'quick', 'comments'],
  isSystem: true
};

/**
 * Export all documentation templates
 */
export const documentationTemplates: PromptTemplate[] = [
  documentationJSDoc,
  documentationReadme,
  documentationAPI,
  documentationInlineComments,
  documentationTechnicalSpec,
  documentationChangelog,
  documentationArchitecture,
  documentationQuick
];

export default documentationTemplates;
