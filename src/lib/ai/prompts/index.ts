/**
 * AI Prompts Module
 *
 * Comprehensive prompt library for AI-powered code assistance.
 * Supports 340+ AI models via OpenRouter with structured templates
 * for code review, explanation, refactoring, testing, and documentation.
 */

// Core Prompt Library
export {
  PromptLibrary,
  PromptLibraryError,
  createPromptLibrary,
  getPromptLibrary,
  initializePromptLibrary
} from './prompt-library';

// Legacy Prompt Manager (for backward compatibility)
export { PromptManager } from './manager';
export type { Prompt } from './manager';

// Legacy Templates (for backward compatibility)
export {
  CODE_REVIEW_PROMPT,
  DOCUMENTATION_PROMPT,
  CODE_GENERATION_PROMPT,
  ERROR_ANALYSIS_PROMPT,
  CODE_REFACTOR_PROMPT,
  PROMPT_TEMPLATES
} from './templates';
export type { PromptTemplateKey } from './templates';

// Built-in Template Collections
export {
  // All templates
  allBuiltInTemplates,
  templateCounts,
  getBuiltInTemplate,
  searchBuiltInTemplates,

  // Code Review
  codeReviewTemplates,
  codeReviewStandard,
  codeReviewSecurity,
  codeReviewPerformance,
  codeReviewQuick,
  codeReviewPullRequest,

  // Explain Code
  explainCodeTemplates,
  explainCodeStandard,
  explainCodeBeginner,
  explainCodeDeepDive,
  explainCodeArchitecture,
  explainCodeChanges,
  explainCodeQuick,

  // Refactor
  refactorTemplates,
  refactorStandard,
  refactorPerformance,
  refactorDesignPatterns,
  refactorModernize,
  refactorSimplify,
  refactorExtract,
  refactorQuick,

  // Test Generation
  generateTestsTemplates,
  generateTestsUnit,
  generateTestsIntegration,
  generateTestsE2E,
  generateTestsReact,
  generateTestsAPI,
  generateTestsEdgeCases,
  generateTestsQuick,

  // Documentation
  documentationTemplates,
  documentationJSDoc,
  documentationReadme,
  documentationAPI,
  documentationInlineComments,
  documentationTechnicalSpec,
  documentationChangelog,
  documentationArchitecture,
  documentationQuick
} from './templates/index';

// Re-export types from @/types/prompts for convenience
export type {
  PromptTemplate,
  PromptVariable,
  PromptVariables,
  PromptResult,
  PromptRenderOptions,
  PromptQueryOptions,
  PromptVersionEntry,
  PromptUsageStats,
  PromptLibraryConfig,
  PromptExample,
  ModelRequirements,
  ModelVariation,
  SupportedLanguage,
  TestFramework,
  DocumentationStyle
} from '@/types/prompts';

export {
  PromptCategory,
  isPromptTemplate,
  isValidCategory,
  SUPPORTED_LANGUAGES,
  TEST_FRAMEWORKS,
  DOCUMENTATION_STYLES
} from '@/types/prompts';
