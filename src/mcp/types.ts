/**
 * Type definitions and validation schemas for MCP tools
 *
 * This file provides:
 * - TypeScript interfaces for type safety
 * - Zod schemas for runtime validation
 * - Type guards for safe argument parsing
 */

import { z } from '@/lib/zod-compat';

// Workspace tool schemas
export const CreateWorkspaceArgsSchema = z.object({
  name: z.string().min(1, 'Workspace name is required'),
  template: z.enum(['react', 'nextjs', 'nodejs', 'python', 'go', 'rust']),
  description: z.string().optional(),
});

export type CreateWorkspaceArgs = z.infer<typeof CreateWorkspaceArgsSchema>;

// Testing tool schemas
export const RunTestsArgsSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  testType: z.enum(['unit', 'integration', 'e2e', 'all']).optional(),
  pattern: z.string().optional(),
});

export type RunTestsArgs = z.infer<typeof RunTestsArgsSchema>;

// Deployment tool schemas
export const DeployProjectArgsSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  environment: z.enum(['development', 'staging', 'production']),
  buildCommand: z.string().optional(),
});

export type DeployProjectArgs = z.infer<typeof DeployProjectArgsSchema>;

// Code analysis tool schemas
export const SearchCodeArgsSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  workspaceId: z.string().optional(),
  language: z.string().optional(),
});

export type SearchCodeArgs = z.infer<typeof SearchCodeArgsSchema>;

export const AnalyzeCodeArgsSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  filePath: z.string(),
  checks: z.array(z.enum(['security', 'performance', 'quality', 'style'])).optional(),
});

export type AnalyzeCodeArgs = z.infer<typeof AnalyzeCodeArgsSchema>;

// Code generation tool schemas
export const GenerateCodeArgsSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  language: z.string().min(1, 'Language is required'),
  context: z.unknown().optional(),
});

export type GenerateCodeArgs = z.infer<typeof GenerateCodeArgsSchema>;

// Sequential thinking tool schemas
export const SequentialThinkingArgsSchema = z.object({
  thought: z.string().min(1, 'Thought content is required'),
  thoughtNumber: z.number().int().min(1, 'Thought number must be at least 1'),
  totalThoughts: z.number().int().min(1, 'Total thoughts must be at least 1'),
  nextThoughtNeeded: z.boolean(),
  isRevision: z.boolean().optional(),
  revisesThought: z.number().int().min(1).optional(),
  branchFromThought: z.number().int().min(1).optional(),
  branchId: z.string().optional(),
});

export type SequentialThinkingArgs = z.infer<typeof SequentialThinkingArgsSchema>;

/**
 * Validates and parses MCP tool arguments using Zod schema
 * @param schema - Zod schema to validate against
 * @param args - Raw arguments from MCP request
 * @returns Validated and typed arguments
 * @throws ZodError if validation fails
 */
export function validateToolArgs<T>(
  schema: z.ZodSchema<T>,
  args: Record<string, unknown>
): T {
  return schema.parse(args);
}
