/**
 * Reusable Zod Validation Schemas
 *
 * Common validation schemas for API endpoints across the application
 * Implements security-first validation with reasonable constraints
 */

import { z } from 'zod'

// ============================================================================
// Common Field Schemas
// ============================================================================

/** UUID v4 validation */
export const uuidSchema = z.string().uuid()

/** MongoDB ObjectId validation */
export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format')

/** Email validation with reasonable length */
export const emailSchema = z.string().email().min(3).max(255)

/** Strong password requirements */
export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character')

/** URL validation with safe protocols */
export const urlSchema = z
  .string()
  .url()
  .refine(
    (url) => url.startsWith('http://') || url.startsWith('https://'),
    'URL must use HTTP or HTTPS protocol'
  )

/** Safe string for user input (no control characters) */
export const safeStringSchema = z
  .string()
  .min(1)
  .max(1000)
  .regex(/^[^\x00-\x1F\x7F]*$/, 'String contains invalid control characters')

/** Workspace ID validation */
export const workspaceIdSchema = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Workspace ID must contain only alphanumeric characters, hyphens, and underscores')

/** File path validation (prevent directory traversal) */
export const filePathSchema = z
  .string()
  .min(1)
  .max(500)
  .refine((path) => !path.includes('..'), 'File path must not contain directory traversal sequences')
  .refine((path) => !path.startsWith('/'), 'File path must be relative')

/** Pagination parameters */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().optional()
})

// ============================================================================
// Container Management Schemas
// ============================================================================

export const containerOptionsSchema = z.object({
  cpus: z.number().positive().max(16).optional(),
  memory: z.string().regex(/^\d+[MGT]$/).optional(),
  ports: z.array(z.string().regex(/^\d+:\d+$/)).optional(),
  volumes: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  workingDir: z.string().optional(),
  command: z.array(z.string()).optional()
})

export const createContainerSchema = z.object({
  image: z.string().min(1).max(255),
  options: containerOptionsSchema.optional()
})

export const containerIdSchema = z.object({
  id: z.string().min(1).max(100)
})

// ============================================================================
// File Operations Schemas
// ============================================================================

export const fileReadSchema = z.object({
  workspaceId: workspaceIdSchema,
  path: filePathSchema,
  action: z.enum(['read', 'list', 'metadata']).optional().default('read')
})

export const fileCreateSchema = z.object({
  workspaceId: workspaceIdSchema,
  path: filePathSchema,
  content: z.string().max(10_000_000), // 10MB limit
  action: z.enum(['create', 'lock', 'unlock']).optional().default('create')
})

export const fileUpdateSchema = z.object({
  workspaceId: workspaceIdSchema,
  path: filePathSchema,
  content: z.string().max(10_000_000), // 10MB limit
  expectedVersion: z.string().optional()
})

export const fileDeleteSchema = z.object({
  workspaceId: workspaceIdSchema,
  path: filePathSchema
})

// ============================================================================
// Workspace Management Schemas
// ============================================================================

export const createWorkspaceSchema = z.object({
  projectId: z.string().min(1).max(100),
  projectName: z.string().min(1).max(200),
  framework: z.string().min(1).max(50),
  userId: z.string().min(1).max(50).optional().default('anonymous'),
  files: z.record(z.string()),
  dependencies: z.array(z.string()).default([]),
  environment: z.record(z.string()).default({})
})

export const workspaceQuerySchema = z.object({
  id: workspaceIdSchema.optional()
})

export const workspaceIdParamSchema = z.object({
  id: workspaceIdSchema
})

// ============================================================================
// AI/Chat Schemas
// ============================================================================

export const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1).max(100_000) // 100KB limit per message
})

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(100),
  model: z.string().min(1).max(100).optional(),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  max_tokens: z.number().int().positive().max(32000).optional(),
  stream: z.boolean().optional().default(false),
  workspaceId: workspaceIdSchema.optional(),
  includeRag: z.boolean().optional().default(true)
})

// ============================================================================
// User Preferences Schemas
// ============================================================================

export const userPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().min(2).max(10).optional(),
  fontSize: z.number().int().min(8).max(32).optional(),
  editorSettings: z.record(z.unknown()).optional(),
  notifications: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    inApp: z.boolean().optional()
  }).optional()
})

// ============================================================================
// Monitoring/Metrics Schemas
// ============================================================================

export const metricsQuerySchema = z.object({
  type: z.enum(['response_time', 'error', 'user_activity', 'network_io']).optional(),
  config: z.boolean().optional()
})

export const recordMetricSchema = z.object({
  type: z.enum(['response_time', 'error', 'user_activity', 'network_io']),
  data: z.record(z.unknown()).optional()
})

// ============================================================================
// Template Schemas
// ============================================================================

export const templateQuerySchema = z.object({
  language: z.string().optional(),
  framework: z.string().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  tags: z.array(z.string()).optional()
})

// ============================================================================
// Auth/MFA Schemas
// ============================================================================

export const mfaSetupSchema = z.object({
  type: z.enum(['totp', 'sms', 'email']),
  name: z.string().min(1).max(50),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  email: emailSchema.optional()
})

export const mfaVerifySetupSchema = z.object({
  deviceId: z.string().min(1).max(100),
  token: z.string().min(6).max(8).regex(/^\d+$/),
  setupToken: z.string().min(1).max(200)
})

export const mfaChallengeSchema = z.object({
  preferredDeviceId: z.string().min(1).max(100).optional()
})

export const mfaVerifyChallengeSchema = z
  .object({
    challengeId: z.string().min(1).max(100),
    token: z.string().min(6).max(8).regex(/^\d+$/).optional(),
    backupCode: z.string().min(8).max(20).optional()
  })
  .refine((data) => data.token || data.backupCode, {
    message: 'Either token or backup code must be provided'
  })

export const deviceIdQuerySchema = z.object({
  deviceId: z.string().min(1).max(100)
})

// ============================================================================
// Code Server/Terminal Schemas
// ============================================================================

export const createTerminalSessionSchema = z.object({
  workspaceId: workspaceIdSchema,
  cols: z.number().int().positive().max(500).optional().default(80),
  rows: z.number().int().positive().max(100).optional().default(24),
  cwd: z.string().optional()
})

export const terminalSessionIdSchema = z.object({
  sessionId: z.string().uuid()
})
