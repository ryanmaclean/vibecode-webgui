import { PromptTemplate } from '@langchain/core/prompts';

export const CODE_REVIEW_PROMPT = PromptTemplate.fromTemplate(`
You are a senior developer reviewing the following code:

{code}

Consider the following aspects:
1. Code quality and readability
2. Potential bugs or edge cases
3. Security vulnerabilities
4. Performance optimizations

Provide a detailed review with specific suggestions for improvement.
`);

export const DOCUMENTATION_PROMPT = PromptTemplate.fromTemplate(`
Generate comprehensive documentation for the following {language} code:

{code}

Include:
1. Function/variable descriptions
2. Parameters and return values
3. Usage examples
4. Error handling
5. Performance considerations
`);

export const CODE_GENERATION_PROMPT = PromptTemplate.fromTemplate(`
Generate {language} code that meets the following requirements:

{requirements}

Additional context:
{context}

Please provide:
1. Complete implementation
2. Unit tests
3. Usage examples
4. Any necessary dependencies
`);

export const ERROR_ANALYSIS_PROMPT = PromptTemplate.fromTemplate(`
Analyze the following error and provide a solution:

Error: {error}

Code context:
{code}

Please provide:
1. Root cause analysis
2. Step-by-step solution
3. Code fix (if applicable)
4. Prevention strategies
`);

export const CODE_REFACTOR_PROMPT = PromptTemplate.fromTemplate(`
Refactor the following {language} code to improve:
1. Readability
2. Performance
3. Maintainability
4. Error handling

Original code:
{code}

Please provide:
1. Refactored code
2. Explanation of changes
3. Before/after comparison
4. Testing recommendations
`);

// Export all prompt templates for easy importing
export const PROMPT_TEMPLATES = {
  CODE_REVIEW_PROMPT,
  DOCUMENTATION_PROMPT,
  CODE_GENERATION_PROMPT,
  ERROR_ANALYSIS_PROMPT,
  CODE_REFACTOR_PROMPT,
} as const;

export type PromptTemplateKey = keyof typeof PROMPT_TEMPLATES;
