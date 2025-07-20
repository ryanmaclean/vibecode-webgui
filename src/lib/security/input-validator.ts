/**
 * Input validation and sanitization for AI query processing
 * Prevents injection attacks and ensures safe AI model interactions
 */

import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

// Common patterns for potential security threats
const SUSPICIOUS_PATTERNS = [
  // SQL injection patterns
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
  // NoSQL injection patterns
  /(\$where|\$ne|\$gt|\$lt|\$in|\$nin|\$regex|\$exists)/gi,
  // Command injection patterns
  /(;|\||&|`|\$\(|exec|eval|system|shell_exec)/gi,
  // Script injection patterns
  /(<script|javascript:|data:text\/html|vbscript:|onload=|onerror=)/gi,
  // Path traversal patterns
  /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c)/gi,
  // GraphQL/Cypher injection patterns
  /(MATCH|RETURN|WHERE|CREATE|DELETE|SET|REMOVE|MERGE|OPTIONAL)/gi,
  // LDAP injection patterns
  /(\*|\(|\)|\\|\||&|!|=|<|>|~|;)/g,
];

// Maximum input lengths for different types
const MAX_LENGTHS = {
  query: 10000,
  prompt: 50000,
  filename: 255,
  metadata: 1000,
} as const;

// Validation schemas
export const aiQuerySchema = z.object({
  query: z.string()
    .min(1, 'Query cannot be empty')
    .max(MAX_LENGTHS.query, `Query cannot exceed ${MAX_LENGTHS.query} characters`)
    .refine(
      (value) => !containsSuspiciousPatterns(value),
      'Query contains potentially unsafe content'
    ),
  context: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const promptSchema = z.object({
  content: z.string()
    .min(1, 'Prompt cannot be empty')
    .max(MAX_LENGTHS.prompt, `Prompt cannot exceed ${MAX_LENGTHS.prompt} characters`),
  variables: z.record(z.string()).optional(),
  systemPrompt: z.string().optional(),
});

export const fileUploadSchema = z.object({
  filename: z.string()
    .min(1, 'Filename cannot be empty')
    .max(MAX_LENGTHS.filename, `Filename cannot exceed ${MAX_LENGTHS.filename} characters`)
    .refine(
      (filename) => !filename.includes('..') && !/[<>:"|?*]/.test(filename),
      'Invalid filename format'
    ),
  contentType: z.string().refine(
    (type) => /^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_.]*$/.test(type),
    'Invalid content type'
  ),
  size: z.number().positive().max(100 * 1024 * 1024, 'File size cannot exceed 100MB'),
});

/**
 * Check if input contains suspicious patterns
 */
function containsSuspiciousPatterns(input: string): boolean {
  const normalizedInput = input.toLowerCase();
  return SUSPICIOUS_PATTERNS.some(pattern => pattern.test(normalizedInput));
}

/**
 * Sanitize HTML content while preserving safe formatting
 */
export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'code', 'pre', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
}

/**
 * Sanitize user input for AI processing
 */
export function sanitizeUserInput(input: string): string {
  // Remove null bytes and control characters
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  // Remove potentially dangerous Unicode characters
  sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  return sanitized;
}

/**
 * Validate and sanitize AI query input
 */
export function validateAIQuery(input: unknown): { query: string; context?: string; metadata?: Record<string, any> } {
  const result = aiQuerySchema.safeParse(input);
  
  if (!result.success) {
    throw new Error(`Invalid AI query: ${result.error.errors.map(e => e.message).join(', ')}`);
  }
  
  return {
    query: sanitizeUserInput(result.data.query),
    context: result.data.context ? sanitizeUserInput(result.data.context) : undefined,
    metadata: result.data.metadata,
  };
}

/**
 * Validate and sanitize prompt input
 */
export function validatePrompt(input: unknown): { content: string; variables?: Record<string, string>; systemPrompt?: string } {
  const result = promptSchema.safeParse(input);
  
  if (!result.success) {
    throw new Error(`Invalid prompt: ${result.error.errors.map(e => e.message).join(', ')}`);
  }
  
  const sanitizedVariables = result.data.variables 
    ? Object.fromEntries(
        Object.entries(result.data.variables).map(([key, value]) => [
          key,
          sanitizeUserInput(value)
        ])
      )
    : undefined;
  
  return {
    content: sanitizeUserInput(result.data.content),
    variables: sanitizedVariables,
    systemPrompt: result.data.systemPrompt ? sanitizeUserInput(result.data.systemPrompt) : undefined,
  };
}

/**
 * Validate file upload metadata
 */
export function validateFileUpload(input: unknown): { filename: string; contentType: string; size: number } {
  const result = fileUploadSchema.safeParse(input);
  
  if (!result.success) {
    throw new Error(`Invalid file upload: ${result.error.errors.map(e => e.message).join(', ')}`);
  }
  
  return result.data;
}

/**
 * Rate limiting for AI queries per user
 */
export class AIQueryRateLimiter {
  private queryCache = new Map<string, { count: number; resetTime: number }>();
  private readonly maxQueriesPerHour = 100;
  private readonly windowMs = 60 * 60 * 1000; // 1 hour

  checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userRecord = this.queryCache.get(userId);

    if (!userRecord || now > userRecord.resetTime) {
      this.queryCache.set(userId, { count: 1, resetTime: now + this.windowMs });
      return true;
    }

    if (userRecord.count >= this.maxQueriesPerHour) {
      return false;
    }

    userRecord.count++;
    return true;
  }

  getRemainingQueries(userId: string): number {
    const userRecord = this.queryCache.get(userId);
    if (!userRecord || Date.now() > userRecord.resetTime) {
      return this.maxQueriesPerHour;
    }
    return Math.max(0, this.maxQueriesPerHour - userRecord.count);
  }
}

/**
 * Security audit logger for AI interactions
 */
export class AISecurityLogger {
  static logSuspiciousActivity(
    userId: string,
    activity: string,
    details: Record<string, any>
  ): void {
    console.warn('[AI_SECURITY]', {
      timestamp: new Date().toISOString(),
      userId,
      activity,
      details,
      severity: 'WARNING',
    });
    
    // In production, this should integrate with your security monitoring system
    // Example: send to Datadog, Splunk, or other SIEM
  }

  static logValidationFailure(
    userId: string,
    input: string,
    validationError: string
  ): void {
    console.warn('[AI_VALIDATION_FAILURE]', {
      timestamp: new Date().toISOString(),
      userId,
      inputLength: input.length,
      validationError,
      inputSample: input.substring(0, 100) + (input.length > 100 ? '...' : ''),
    });
  }
}

// Export singleton instances
export const aiRateLimiter = new AIQueryRateLimiter();