/**
 * Prompt Types and Interfaces for AI-powered Code Assistance
 *
 * This module defines the type system for the reusable prompt library,
 * supporting 321+ AI models via OpenRouter with structured templates
 * for common development tasks.
 */

/**
 * Categories of prompts available in the library
 */
export enum PromptCategory {
  /** Code review for bugs, security, and performance */
  CODE_REVIEW = 'code-review',
  /** Explain code functionality and logic */
  EXPLAIN = 'explain',
  /** Suggest code refactoring improvements */
  REFACTOR = 'refactor',
  /** Generate test cases for code */
  TEST = 'test',
  /** Generate documentation and comments */
  DOCUMENT = 'document',
  /** Debug and troubleshoot issues */
  DEBUG = 'debug',
  /** Convert or translate code */
  CONVERT = 'convert',
  /** Optimize code performance */
  OPTIMIZE = 'optimize',
  /** Security analysis */
  SECURITY = 'security',
  /** Custom user-defined prompts */
  CUSTOM = 'custom'
}

/**
 * Variable definition for prompt templates
 */
export interface PromptVariable {
  /** Variable name used in template (e.g., "code", "language") */
  name: string;
  /** Human-readable description of the variable */
  description: string;
  /** Whether this variable is required */
  required: boolean;
  /** Default value if not provided */
  defaultValue?: string;
  /** Type hint for the variable */
  type: 'string' | 'code' | 'number' | 'boolean' | 'array' | 'object';
  /** Example value for documentation */
  example?: string;
  /** Validation pattern (regex) */
  validationPattern?: string;
}

/**
 * Model capability requirements for prompt execution
 */
export interface ModelRequirements {
  /** Minimum context window size in tokens */
  minContextWindow?: number;
  /** Whether the model needs code understanding */
  codeCapable?: boolean;
  /** Whether streaming is required */
  streamingRequired?: boolean;
  /** Required model capabilities */
  capabilities?: ('code' | 'analysis' | 'reasoning' | 'structured-output')[];
}

/**
 * Model-specific prompt variation
 */
export interface ModelVariation {
  /** Model identifier or pattern (e.g., "gpt-4*", "claude-*") */
  modelPattern: string;
  /** Modified system prompt for this model */
  systemPrompt?: string;
  /** Modified user prompt template for this model */
  userPromptTemplate?: string;
  /** Model-specific temperature override */
  temperature?: number;
  /** Model-specific max tokens override */
  maxTokens?: number;
  /** Additional instructions for this model */
  additionalInstructions?: string;
}

/**
 * Core prompt template interface
 */
export interface PromptTemplate {
  /** Unique identifier for the template */
  id: string;
  /** Human-readable name */
  name: string;
  /** Category classification */
  category: PromptCategory;
  /** Semantic version (e.g., "1.0.0") */
  version: string;
  /** Detailed description of what the prompt does */
  description: string;
  /** System prompt that sets AI behavior/role */
  systemPrompt: string;
  /** User prompt template with {{variable}} placeholders */
  userPromptTemplate: string;
  /** Variable definitions for this template */
  variables: PromptVariable[];
  /** List of recommended model IDs for this prompt */
  recommendedModels: string[];
  /** Maximum tokens for completion */
  maxTokens: number;
  /** Suggested temperature (0-2) */
  temperature?: number;
  /** Model requirements for this prompt */
  modelRequirements?: ModelRequirements;
  /** Model-specific variations */
  modelVariations?: ModelVariation[];
  /** Tags for searchability */
  tags?: string[];
  /** Example usage */
  examples?: PromptExample[];
  /** Creation timestamp */
  createdAt?: Date;
  /** Last update timestamp */
  updatedAt?: Date;
  /** Author information */
  author?: string;
  /** Whether this is a system/built-in prompt */
  isSystem?: boolean;
}

/**
 * Example usage for a prompt template
 */
export interface PromptExample {
  /** Description of the example */
  description: string;
  /** Input variables for this example */
  variables: Record<string, string>;
  /** Expected output description or sample */
  expectedOutput?: string;
}

/**
 * Variables provided when executing a prompt
 */
export type PromptVariables = Record<string, string | number | boolean | string[] | Record<string, unknown>>;

/**
 * Result of prompt template execution
 */
export interface PromptResult {
  /** Whether execution was successful */
  success: boolean;
  /** The rendered system prompt */
  systemPrompt: string;
  /** The rendered user prompt with variables substituted */
  userPrompt: string;
  /** The template used */
  template: PromptTemplate;
  /** Variables that were applied */
  appliedVariables: PromptVariables;
  /** Any warnings during rendering */
  warnings?: string[];
  /** Error message if unsuccessful */
  error?: string;
  /** Model configuration to use */
  modelConfig: {
    recommendedModel: string;
    maxTokens: number;
    temperature: number;
  };
}

/**
 * Options for prompt rendering
 */
export interface PromptRenderOptions {
  /** Override the default model */
  model?: string;
  /** Override max tokens */
  maxTokens?: number;
  /** Override temperature */
  temperature?: number;
  /** Whether to validate all required variables */
  strictValidation?: boolean;
  /** Apply model-specific variations */
  applyModelVariations?: boolean;
}

/**
 * Prompt library query options
 */
export interface PromptQueryOptions {
  /** Filter by category */
  category?: PromptCategory;
  /** Filter by tags */
  tags?: string[];
  /** Search in name and description */
  search?: string;
  /** Filter by recommended model */
  model?: string;
  /** Include only system prompts */
  systemOnly?: boolean;
  /** Include only custom prompts */
  customOnly?: boolean;
  /** Sort field */
  sortBy?: 'name' | 'category' | 'createdAt' | 'updatedAt';
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Pagination limit */
  limit?: number;
  /** Pagination offset */
  offset?: number;
}

/**
 * Prompt version history entry
 */
export interface PromptVersionEntry {
  /** Version string */
  version: string;
  /** Timestamp of this version */
  timestamp: Date;
  /** Description of changes */
  changeDescription: string;
  /** The template at this version */
  template: PromptTemplate;
  /** Author of this version */
  author?: string;
}

/**
 * Prompt usage statistics
 */
export interface PromptUsageStats {
  /** Prompt template ID */
  promptId: string;
  /** Total number of times used */
  usageCount: number;
  /** Last used timestamp */
  lastUsed?: Date;
  /** Average tokens used */
  avgTokensUsed?: number;
  /** Success rate (0-1) */
  successRate?: number;
  /** Most common model used */
  mostUsedModel?: string;
}

/**
 * Prompt library configuration
 */
export interface PromptLibraryConfig {
  /** Enable usage statistics tracking */
  trackUsage?: boolean;
  /** Enable version history */
  enableVersioning?: boolean;
  /** Maximum versions to keep per prompt */
  maxVersionsPerPrompt?: number;
  /** Default model when none specified */
  defaultModel?: string;
  /** Default max tokens */
  defaultMaxTokens?: number;
  /** Default temperature */
  defaultTemperature?: number;
  /** Custom variable delimiter (default: "{{" and "}}") */
  variableDelimiters?: [string, string];
}

/**
 * Type guard to check if an object is a valid PromptTemplate
 */
export function isPromptTemplate(obj: unknown): obj is PromptTemplate {
  if (typeof obj !== 'object' || obj === null) return false;
  const template = obj as Partial<PromptTemplate>;
  return (
    typeof template.id === 'string' &&
    typeof template.name === 'string' &&
    typeof template.category === 'string' &&
    typeof template.version === 'string' &&
    typeof template.description === 'string' &&
    typeof template.systemPrompt === 'string' &&
    typeof template.userPromptTemplate === 'string' &&
    Array.isArray(template.variables) &&
    Array.isArray(template.recommendedModels) &&
    typeof template.maxTokens === 'number'
  );
}

/**
 * Type guard to check if a category is valid
 */
export function isValidCategory(category: string): category is PromptCategory {
  return Object.values(PromptCategory).includes(category as PromptCategory);
}

/**
 * Supported programming languages for code-related prompts
 */
export const SUPPORTED_LANGUAGES = [
  'typescript',
  'javascript',
  'python',
  'java',
  'csharp',
  'cpp',
  'go',
  'rust',
  'ruby',
  'php',
  'swift',
  'kotlin',
  'scala',
  'haskell',
  'elixir',
  'clojure',
  'sql',
  'html',
  'css',
  'shell',
  'yaml',
  'json',
  'markdown',
  'other'
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

/**
 * Common test frameworks for test generation
 */
export const TEST_FRAMEWORKS = [
  'jest',
  'vitest',
  'mocha',
  'jasmine',
  'pytest',
  'unittest',
  'junit',
  'nunit',
  'xunit',
  'rspec',
  'phpunit',
  'go-test',
  'cargo-test',
  'playwright',
  'cypress',
  'other'
] as const;

export type TestFramework = typeof TEST_FRAMEWORKS[number];

/**
 * Documentation styles
 */
export const DOCUMENTATION_STYLES = [
  'jsdoc',
  'tsdoc',
  'docstring',
  'javadoc',
  'xmldoc',
  'rustdoc',
  'godoc',
  'markdown',
  'other'
] as const;

export type DocumentationStyle = typeof DOCUMENTATION_STYLES[number];
