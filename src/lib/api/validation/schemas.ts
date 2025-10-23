/**
 * Reusable Zod Validation Schemas
 *
 * Common validation schemas for API endpoints across the application
 * Implements security-first validation with reasonable constraints
 */

import { z } from '@/lib/zod-compat'

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

// ============================================================================
// Chat/Streaming Schemas
// ============================================================================

export const chatStreamSchema = z.object({
  conversationId: z.string().min(1).max(100),
  message: z.string().min(1).max(100_000), // 100KB limit
  model: z.string().min(1).max(100).optional().default('anthropic/claude-3.5-sonnet'),
  workspaceId: workspaceIdSchema.optional().default('default'),
  files: z.array(z.string()).optional().default([]),
  enableWebSearch: z.boolean().optional().default(false),
  enableRAG: z.boolean().optional().default(true)
})

export const mongodbChatActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create_session')
  }),
  z.object({
    action: z.literal('create_conversation'),
    title: z.string().min(1).max(200).optional(),
    sessionId: z.string().uuid(),
    model: z.string().min(1).max(100).optional().default('anthropic/claude-3.5-sonnet'),
    workspaceId: workspaceIdSchema.optional().default('default')
  }),
  z.object({
    action: z.literal('add_message'),
    conversationId: z.string().uuid(),
    content: z.string().min(1).max(100_000),
    from: z.enum(['user', 'assistant']).optional().default('user')
  }),
  z.object({
    action: z.literal('get_conversations')
  })
])

export const mongodbChatQuerySchema = z.object({
  action: z.enum(['health']).optional()
})

// ============================================================================
// Auth/Login Tracking Schemas
// ============================================================================

export const loginTrackingSchema = z.object({
  event: z.enum(['login_attempt', 'login_success', 'login_failure', 'logout']),
  userId: z.string().min(1).max(100).optional(),
  email: emailSchema.optional(),
  provider: z.string().min(1).max(50).optional(),
  sessionId: z.string().min(1).max(200).optional(),
  loginMethod: z.string().min(1).max(50).optional()
})

// ============================================================================
// Claude CLI Schemas
// ============================================================================

export const claudeChatSchema = z.object({
  message: z.string().min(1).max(100_000),
  workspaceId: workspaceIdSchema,
  contextFiles: z.array(z.string()).optional()
})

export const claudeSessionActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('start'),
    workspaceId: workspaceIdSchema
  }),
  z.object({
    action: z.literal('send'),
    workspaceId: workspaceIdSchema,
    sessionId: z.string().min(1).max(200),
    message: z.string().min(1).max(100_000)
  }),
  z.object({
    action: z.literal('close'),
    workspaceId: workspaceIdSchema,
    sessionId: z.string().min(1).max(200)
  }),
  z.object({
    action: z.literal('status'),
    workspaceId: workspaceIdSchema
  })
])

export const claudeSessionQuerySchema = z.object({
  workspaceId: workspaceIdSchema
})

// ============================================================================
// PHASE 2: Critical Security Routes (Command Injection Prevention)
// ============================================================================

/** Shell command validation - strict allowlist approach */
export const shellCommandSchema = z
  .string()
  .min(1)
  .max(1000)
  .refine(
    (cmd) => !cmd.match(/[;&|`$()<>]/),
    'Command contains shell metacharacters - potential injection detected'
  )
  .refine(
    (cmd) => !cmd.includes('..'),
    'Command contains directory traversal sequences'
  )

/** Absolute file path validation for workspace operations */
export const absolutePathSchema = z
  .string()
  .min(1)
  .max(500)
  .refine(
    (path) => path.startsWith('/workspaces/') || path.startsWith('/tmp/workspaces/'),
    'Path must be within allowed workspace directories'
  )
  .refine(
    (path) => !path.includes('..'),
    'Path must not contain directory traversal sequences'
  )
  .refine(
    (path) => !path.match(/[;&|`$()<>]/),
    'Path contains shell metacharacters'
  )

/** Safe provider name validation (SAML, OAuth, etc.) */
export const providerNameSchema = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[a-z0-9-]+$/, 'Provider name must contain only lowercase letters, numbers, and hyphens')
  .refine(
    (name) => ['okta', 'azure', 'google', 'onelogin', 'auth0'].includes(name),
    'Provider must be one of: okta, azure, google, onelogin, auth0'
  )

// ============================================================================
// Goose Initialization Schema (Command Injection Prevention)
// ============================================================================

export const initGooseSchema = z.object({
  workspaceId: workspaceIdSchema,
  migrationName: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Migration name must contain only alphanumeric characters, hyphens, and underscores')
    .optional()
    .default('init'),
  workspacePath: absolutePathSchema.optional()
})

export const initGooseParamSchema = z.object({
  id: workspaceIdSchema
})

// ============================================================================
// Terminal Session Schemas (Command Injection & Path Traversal Prevention)
// ============================================================================

export const terminalMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create-terminal'),
    cols: z.number().int().positive().max(500).optional().default(80),
    rows: z.number().int().positive().max(100).optional().default(24),
    cwd: absolutePathSchema.optional()
  }),
  z.object({
    type: z.literal('terminal-input'),
    data: z.string().min(1).max(10_000) // 10KB limit per input
  }),
  z.object({
    type: z.literal('terminal-resize'),
    cols: z.number().int().positive().max(500),
    rows: z.number().int().positive().max(100)
  }),
  z.object({
    type: z.literal('ai-command'),
    command: z.string().min(1).max(10_000),
    type: z.enum(['chat', 'explain', 'generate', 'analyze']).optional().default('chat')
  }),
  z.object({
    type: z.literal('close-terminal')
  })
])

export const terminalWebSocketQuerySchema = z.object({
  workspaceId: workspaceIdSchema,
  userId: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, 'User ID must contain only alphanumeric characters, hyphens, and underscores')
    .optional()
    .default('anonymous')
})

// ============================================================================
// File Sync Schema (Path Traversal & Injection Prevention)
// ============================================================================

export const fileSyncQuerySchema = z.object({
  workspaceId: workspaceIdSchema,
  userId: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, 'User ID must contain only alphanumeric characters, hyphens, and underscores')
})

export const fileSyncFileSchema = z.object({
  path: filePathSchema,
  content: z.string().max(10_000_000), // 10MB limit per file
  type: z.enum(['file', 'directory'])
})

export const fileSyncBulkSchema = z.object({
  workspaceId: workspaceIdSchema,
  files: z
    .array(fileSyncFileSchema)
    .min(1)
    .max(100) // Limit to 100 files per bulk operation
})

export const fileSyncWebSocketMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('file-update'),
    payload: z.object({
      path: filePathSchema,
      content: z.string().max(10_000_000),
      version: z.string().optional()
    })
  }),
  z.object({
    type: z.literal('ping')
  }),
  z.object({
    type: z.literal('subscribe-file'),
    payload: z.object({
      path: filePathSchema
    })
  })
])

// ============================================================================
// SAML Metadata Schema (Provider Injection Prevention)
// ============================================================================

export const samlMetadataQuerySchema = z.object({
  provider: providerNameSchema.optional().default('okta')
})
