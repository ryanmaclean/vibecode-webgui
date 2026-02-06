/**
 * Code Review Prompt Templates
 *
 * Comprehensive templates for AI-powered code review covering:
 * - Bug detection
 * - Security vulnerabilities
 * - Performance issues
 * - Code quality and best practices
 * - Style and consistency
 */

import { PromptTemplate, PromptCategory } from '@/types/prompts';

/**
 * Standard code review prompt - comprehensive analysis
 */
export const codeReviewStandard: PromptTemplate = {
  id: 'code-review-standard',
  name: 'Standard Code Review',
  category: PromptCategory.CODE_REVIEW,
  version: '1.0.0',
  description:
    'Comprehensive code review covering bugs, security, performance, and code quality',
  systemPrompt: `You are an expert senior software engineer conducting a thorough code review. Your role is to:

1. Identify potential bugs and logical errors
2. Detect security vulnerabilities and risks
3. Spot performance bottlenecks and inefficiencies
4. Evaluate code quality, readability, and maintainability
5. Check adherence to best practices and coding standards
6. Suggest specific, actionable improvements

Be constructive and educational in your feedback. Explain why something is a problem and how to fix it. Prioritize issues by severity (Critical, High, Medium, Low).`,

  userPromptTemplate: `Please review the following {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#context}}
Additional context:
{{context}}
{{/context}}

{{#focusAreas}}
Please pay special attention to: {{focusAreas}}
{{/focusAreas}}

Provide a structured review with:
1. **Summary**: Brief overview of the code quality
2. **Critical Issues**: Bugs or security vulnerabilities that must be fixed
3. **Performance Concerns**: Any efficiency issues
4. **Code Quality**: Readability, maintainability, and best practices
5. **Suggestions**: Recommended improvements with code examples
6. **Positive Aspects**: What's done well (important for constructive feedback)`,

  variables: [
    {
      name: 'code',
      description: 'The code to review',
      required: true,
      type: 'code',
      example: 'function add(a, b) { return a + b; }'
    },
    {
      name: 'language',
      description: 'Programming language of the code',
      required: true,
      type: 'string',
      defaultValue: 'typescript',
      example: 'typescript'
    },
    {
      name: 'context',
      description: 'Additional context about the code purpose or requirements',
      required: false,
      type: 'string',
      example: 'This is a user authentication function for a banking application'
    },
    {
      name: 'focusAreas',
      description: 'Specific areas to focus on during review',
      required: false,
      type: 'string',
      example: 'security, input validation'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'openai/gpt-4-turbo',
    'google/gemini-pro-1.5'
  ],

  maxTokens: 4096,
  temperature: 0.3,

  modelRequirements: {
    minContextWindow: 8000,
    codeCapable: true,
    capabilities: ['code', 'analysis', 'reasoning']
  },

  modelVariations: [
    {
      modelPattern: 'anthropic/claude-*',
      additionalInstructions:
        'Format your response using clear markdown with headers and code blocks. Use bullet points for lists.'
    },
    {
      modelPattern: 'openai/gpt-4*',
      temperature: 0.2,
      additionalInstructions:
        'Be precise and concise in your analysis. Focus on actionable feedback.'
    }
  ],

  tags: ['review', 'quality', 'security', 'performance', 'bugs'],
  isSystem: true,

  examples: [
    {
      description: 'Review a simple TypeScript function',
      variables: {
        code: `async function fetchUserData(userId: string) {
  const response = await fetch('/api/users/' + userId);
  const data = response.json();
  return data;
}`,
        language: 'typescript',
        context: 'API utility function for fetching user data'
      },
      expectedOutput:
        'Review highlighting missing error handling, potential XSS via userId, missing await on response.json()'
    }
  ]
};

/**
 * Security-focused code review
 */
export const codeReviewSecurity: PromptTemplate = {
  id: 'code-review-security',
  name: 'Security Code Review',
  category: PromptCategory.CODE_REVIEW,
  version: '1.0.0',
  description:
    'Security-focused code review to identify vulnerabilities and security risks',
  systemPrompt: `You are a security expert specializing in application security and secure code review. Your task is to identify security vulnerabilities and risks in code.

Focus on:
- Injection vulnerabilities (SQL, XSS, Command injection, etc.)
- Authentication and authorization flaws
- Sensitive data exposure
- Security misconfigurations
- Cryptographic failures
- Insecure deserialization
- Input validation issues
- Access control problems
- OWASP Top 10 vulnerabilities

Rate each finding by severity: Critical, High, Medium, Low
Provide specific remediation guidance with code examples.`,

  userPromptTemplate: `Perform a security-focused review of this {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#applicationContext}}
Application context: {{applicationContext}}
{{/applicationContext}}

{{#dataHandled}}
Types of data handled: {{dataHandled}}
{{/dataHandled}}

Please provide:
1. **Security Findings**: List all vulnerabilities found, sorted by severity
2. **Risk Assessment**: Potential impact of each vulnerability
3. **Remediation**: Specific fixes with secure code examples
4. **Security Best Practices**: Additional recommendations to improve security posture
5. **Compliance Notes**: Relevant security standards (OWASP, PCI-DSS, etc.)`,

  variables: [
    {
      name: 'code',
      description: 'The code to review for security issues',
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
      name: 'applicationContext',
      description: 'Type of application (web, API, mobile, etc.)',
      required: false,
      type: 'string',
      example: 'REST API for e-commerce platform'
    },
    {
      name: 'dataHandled',
      description: 'Types of sensitive data the code handles',
      required: false,
      type: 'string',
      example: 'user credentials, payment information'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'openai/gpt-4-turbo'
  ],

  maxTokens: 4096,
  temperature: 0.2,

  tags: ['security', 'vulnerabilities', 'owasp', 'penetration-testing'],
  isSystem: true
};

/**
 * Performance-focused code review
 */
export const codeReviewPerformance: PromptTemplate = {
  id: 'code-review-performance',
  name: 'Performance Code Review',
  category: PromptCategory.CODE_REVIEW,
  version: '1.0.0',
  description:
    'Performance-focused code review to identify bottlenecks and optimization opportunities',
  systemPrompt: `You are a performance engineering expert. Analyze code for performance issues and optimization opportunities.

Focus on:
- Time complexity and algorithmic efficiency
- Memory usage and potential leaks
- I/O operations and blocking calls
- Database query optimization
- Caching opportunities
- Unnecessary computations or redundant operations
- Async/await patterns and concurrency issues
- Resource management

Provide Big-O analysis where applicable and suggest optimized alternatives.`,

  userPromptTemplate: `Analyze this {{language}} code for performance issues:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#scaleExpectations}}
Expected scale: {{scaleExpectations}}
{{/scaleExpectations}}

{{#performanceCriteria}}
Performance criteria: {{performanceCriteria}}
{{/performanceCriteria}}

Please provide:
1. **Performance Analysis**: Current complexity and bottlenecks
2. **Critical Issues**: Performance problems that need immediate attention
3. **Optimization Opportunities**: Suggested improvements with expected gains
4. **Optimized Code**: Refactored version with performance improvements
5. **Benchmarking Suggestions**: How to measure and verify improvements`,

  variables: [
    {
      name: 'code',
      description: 'The code to analyze for performance',
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
      name: 'scaleExpectations',
      description: 'Expected data scale or load',
      required: false,
      type: 'string',
      example: '10,000 requests per second, 1 million records'
    },
    {
      name: 'performanceCriteria',
      description: 'Specific performance requirements',
      required: false,
      type: 'string',
      example: 'response time under 100ms, memory under 512MB'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'google/gemini-pro-1.5'
  ],

  maxTokens: 4096,
  temperature: 0.3,

  tags: ['performance', 'optimization', 'efficiency', 'scalability'],
  isSystem: true
};

/**
 * Quick code review for rapid feedback
 */
export const codeReviewQuick: PromptTemplate = {
  id: 'code-review-quick',
  name: 'Quick Code Review',
  category: PromptCategory.CODE_REVIEW,
  version: '1.0.0',
  description: 'Fast, concise code review for quick feedback on small changes',
  systemPrompt: `You are a code reviewer providing quick, focused feedback. Be concise and prioritize the most important issues. Focus on:
- Obvious bugs
- Clear security issues
- Major code smells
- Simple improvements

Keep your response brief and actionable.`,

  userPromptTemplate: `Quick review of this {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

Provide brief feedback on:
- Any bugs or issues (if found)
- Most important improvement
- Overall assessment (Good/Needs Work/Concerns)`,

  variables: [
    {
      name: 'code',
      description: 'The code to review',
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
  temperature: 0.3,

  tags: ['review', 'quick', 'feedback'],
  isSystem: true
};

/**
 * Pull request review template
 */
export const codeReviewPullRequest: PromptTemplate = {
  id: 'code-review-pull-request',
  name: 'Pull Request Review',
  category: PromptCategory.CODE_REVIEW,
  version: '1.0.0',
  description:
    'Structured review for pull requests with diff context',
  systemPrompt: `You are reviewing a pull request. Analyze the changes in context of:
- The overall change purpose
- How it affects the existing codebase
- Whether it follows project conventions
- Test coverage adequacy
- Documentation needs

Provide inline-style comments where appropriate, referencing specific line changes.`,

  userPromptTemplate: `Review this pull request:

**Title**: {{prTitle}}
**Description**: {{prDescription}}

**Changes**:
\`\`\`diff
{{diffContent}}
\`\`\`

{{#existingCode}}
**Relevant existing code for context**:
\`\`\`{{language}}
{{existingCode}}
\`\`\`
{{/existingCode}}

Please provide:
1. **Summary**: What the PR does and overall assessment
2. **Inline Comments**: Specific feedback on changes (reference line numbers)
3. **Blocking Issues**: Must-fix before merge
4. **Suggestions**: Nice-to-have improvements
5. **Approval Status**: Approve / Request Changes / Need Discussion`,

  variables: [
    {
      name: 'prTitle',
      description: 'Pull request title',
      required: true,
      type: 'string',
      example: 'Add user authentication middleware'
    },
    {
      name: 'prDescription',
      description: 'Pull request description',
      required: true,
      type: 'string'
    },
    {
      name: 'diffContent',
      description: 'The diff/changes in the PR',
      required: true,
      type: 'code'
    },
    {
      name: 'language',
      description: 'Primary programming language',
      required: false,
      type: 'string',
      defaultValue: 'typescript'
    },
    {
      name: 'existingCode',
      description: 'Relevant existing code for context',
      required: false,
      type: 'code'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'openai/gpt-4-turbo'
  ],

  maxTokens: 4096,
  temperature: 0.3,

  tags: ['review', 'pull-request', 'diff', 'git'],
  isSystem: true
};

/**
 * Export all code review templates
 */
export const codeReviewTemplates: PromptTemplate[] = [
  codeReviewStandard,
  codeReviewSecurity,
  codeReviewPerformance,
  codeReviewQuick,
  codeReviewPullRequest
];

export default codeReviewTemplates;
