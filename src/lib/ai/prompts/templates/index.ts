/**
 * Prompt Templates Index
 *
 * Central export point for all built-in prompt templates.
 * Categories include: code-review, explain, refactor, test, document
 */

// Code Review Templates
export {
  codeReviewTemplates,
  codeReviewStandard,
  codeReviewSecurity,
  codeReviewPerformance,
  codeReviewQuick,
  codeReviewPullRequest
} from './code-review';

// Explain Code Templates
export {
  explainCodeTemplates,
  explainCodeStandard,
  explainCodeBeginner,
  explainCodeDeepDive,
  explainCodeArchitecture,
  explainCodeChanges,
  explainCodeQuick
} from './explain-code';

// Refactor Templates
export {
  refactorTemplates,
  refactorStandard,
  refactorPerformance,
  refactorDesignPatterns,
  refactorModernize,
  refactorSimplify,
  refactorExtract,
  refactorQuick
} from './refactor';

// Test Generation Templates
export {
  generateTestsTemplates,
  generateTestsUnit,
  generateTestsIntegration,
  generateTestsE2E,
  generateTestsReact,
  generateTestsAPI,
  generateTestsEdgeCases,
  generateTestsQuick
} from './generate-tests';

// Documentation Templates
export {
  documentationTemplates,
  documentationJSDoc,
  documentationReadme,
  documentationAPI,
  documentationInlineComments,
  documentationTechnicalSpec,
  documentationChangelog,
  documentationArchitecture,
  documentationQuick
} from './documentation';

import { PromptTemplate } from '@/types/prompts';
import { codeReviewTemplates } from './code-review';
import { explainCodeTemplates } from './explain-code';
import { refactorTemplates } from './refactor';
import { generateTestsTemplates } from './generate-tests';
import { documentationTemplates } from './documentation';

/**
 * All built-in prompt templates combined
 */
export const allBuiltInTemplates: PromptTemplate[] = [
  ...codeReviewTemplates,
  ...explainCodeTemplates,
  ...refactorTemplates,
  ...generateTestsTemplates,
  ...documentationTemplates
];

/**
 * Template counts by category
 */
export const templateCounts = {
  codeReview: codeReviewTemplates.length,
  explain: explainCodeTemplates.length,
  refactor: refactorTemplates.length,
  test: generateTestsTemplates.length,
  documentation: documentationTemplates.length,
  total: allBuiltInTemplates.length
};

/**
 * Get a template by ID from all built-in templates
 */
export function getBuiltInTemplate(id: string): PromptTemplate | undefined {
  return allBuiltInTemplates.find(t => t.id === id);
}

/**
 * Search templates by name or description
 */
export function searchBuiltInTemplates(query: string): PromptTemplate[] {
  const lowerQuery = query.toLowerCase();
  return allBuiltInTemplates.filter(
    t =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

export default allBuiltInTemplates;
