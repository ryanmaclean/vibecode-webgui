/**
 * Code Completion API Validation Schemas
 * 
 * Zod schemas for validating code completion requests and responses.
 */

import { z } from 'zod';

// Request validation schema
export const CodeCompletionRequestSchema = z.object({
  // Monaco editor completion request fields (based on monacopilot documentation)
  text: z.string().min(1, 'Text is required').max(10000, 'Text too long'),
  position: z.object({
    lineNumber: z.number().int().min(1, 'Line number must be positive'),
    column: z.number().int().min(1, 'Column must be positive'),
  }).optional(),
  language: z.string().optional().default('typescript'),
  filename: z.string().optional(),
  context: z.object({
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    imports: z.array(z.string()).optional(),
  }).optional(),
  options: z.object({
    maxTokens: z.number().int().min(1).max(2000).optional().default(500),
    temperature: z.number().min(0).max(2).optional().default(0.2),
    stopSequences: z.array(z.string()).optional(),
  }).optional(),
}).strict(); // Strict mode to reject additional properties

export type CodeCompletionRequest = z.infer<typeof CodeCompletionRequestSchema>;

// Response schema for validation
export const CodeCompletionResponseSchema = z.object({
  completions: z.array(z.object({
    text: z.string(),
    range: z.object({
      startLineNumber: z.number(),
      startColumn: z.number(),
      endLineNumber: z.number(),
      endColumn: z.number(),
    }).optional(),
    insertText: z.string().optional(),
    kind: z.number().optional(),
    detail: z.string().optional(),
    documentation: z.string().optional(),
  })),
  model: z.string().optional(),
  usage: z.object({
    promptTokens: z.number().optional(),
    completionTokens: z.number().optional(),
    totalTokens: z.number().optional(),
  }).optional(),
});

export type CodeCompletionResponse = z.infer<typeof CodeCompletionResponseSchema>;

// Health check response schema
export const HealthCheckResponseSchema = z.object({
  status: z.literal('ok'),
  provider: z.string(),
  model: z.string(),
  timestamp: z.string(),
  version: z.string().optional(),
});

export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

/**
 * Validate code completion request
 */
export function validateCodeCompletionRequest(data: unknown): CodeCompletionRequest {
  return CodeCompletionRequestSchema.parse(data);
}

/**
 * Validate request with detailed error messages
 */
export function validateRequest(data: unknown): { success: true; data: CodeCompletionRequest } | { success: false; errors: string[] } {
  try {
    const validData = CodeCompletionRequestSchema.parse(data);
    return { success: true, data: validData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => {
        const path = err.path.join('.');
        return `${path}: ${err.message}`;
      });
      return { success: false, errors };
    }
    return { success: false, errors: ['Invalid request format'] };
  }
}