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

/** LiteLLM-specific chat request schema with extended OpenAI compatibility */
export const liteLLMSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(100),
  model: z.string().min(1).max(100).optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().max(32000).optional(),
  top_p: z.number().min(0).max(1).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  n: z.number().int().positive().max(10).optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  stream: z.boolean().optional(),
  user: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional()
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
// File Sync Schemas
// ============================================================================

export const fileSyncQuerySchema = z.object({
  workspaceId: workspaceIdSchema
})

export const fileSyncBulkSchema = z.object({
  workspaceId: workspaceIdSchema,
  files: z.array(
    z.object({
      path: filePathSchema,
      content: z.string().max(10_000_000), // 10MB limit per file
      type: z.string().min(1).max(50)
    })
  ).min(1).max(100) // Max 100 files per bulk operation
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
// Web Search Schemas
// ============================================================================

export const webSearchSchema = z.object({
  query: z.string().min(1).max(500),
  maxResults: z.number().int().positive().max(50).optional().default(5),
  safeSearch: z.boolean().optional().default(true),
  language: z.string().min(2).max(10).optional().default('en'),
  region: z.string().min(2).max(10).optional().default('us')
})

export const terminalWebSocketQuerySchema = z.object({
  workspaceId: workspaceIdSchema,
  userId: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(50)
})

// ============================================================================
// Health Check Schemas
// ============================================================================

export const healthCheckQuerySchema = z.object({
  filter: z.enum(['database', 'redis', 'ai', 'memory', 'disk', 'all']).optional().default('all'),
  format: z.enum(['json', 'text', 'metrics']).optional().default('json'),
  verbose: z.union([z.boolean(), z.string().transform(val => val === 'true')]).optional().default(false)
})

// ============================================================================
// Monitoring Schemas
// ============================================================================

export const monitoringQuerySchema = z.object({
  timeframe: z.enum(['5m', '15m', '1h', '6h', '12h', '24h', '7d', '30d']).optional().default('1h'),
  metricNames: z.string().transform(val => val.split(',')).pipe(z.array(z.string()).max(20)).optional(),
  dashboardId: z.string().max(100).optional(),
  logs: z.boolean().optional().default(false),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional()
}).refine(
  (data) => {
    // If startTime is provided, endTime must also be provided
    if (data.startTime && !data.endTime) {
      return false
    }
    if (data.startTime && data.endTime) {
      const start = new Date(data.startTime)
      const end = new Date(data.endTime)
      const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      return diffDays >= 0 && diffDays <= 30
    }
    return true
  },
  {
    message: 'Time range must be positive and max 30 days. If startTime is provided, endTime is required.'
  }
)

export const monitoringMetricsBodySchema = z.object({
  type: z.enum(['performance', 'error']),
  duration: z.number().nonnegative().max(300000).optional(), // Max 5 minutes, optional for error type
  metrics: z.record(z.unknown()).refine(
    (obj) => JSON.stringify(obj).length <= 100_000,
    'Metrics object must not exceed 100KB'
  )
})

export const monitoringHistoricalSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  metricTypes: z.array(z.string()).max(20).optional()
}).refine(
  (data) => {
    const start = new Date(data.startTime)
    const end = new Date(data.endTime)
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    return diffDays >= 0 && diffDays <= 30
  },
  {
    message: 'Time range must be positive and max 30 days'
  }
)

// ============================================================================
// Experiments/Feature Flags Schemas
// ============================================================================

export const experimentsQuerySchema = z.object({
  flagKey: z.string().max(100).optional(),
  action: z.enum(['results', 'list']).optional().default('results')
}).refine(
  (data) => {
    if (data.action === 'results' && !data.flagKey) {
      return false
    }
    return true
  },
  {
    message: 'flagKey is required when action is "results"'
  }
)

export const experimentsBodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('evaluate'),
    flagKey: z.string().max(100),
    defaultValue: z.boolean().optional(),
    context: z.object({
      workspaceId: workspaceIdSchema.optional(),
      customAttributes: z.record(z.unknown()).optional()
    }).optional()
  }),
  z.object({
    action: z.literal('track'),
    flagKey: z.string().max(100),
    metricName: z.string().max(100),
    value: z.number(),
    context: z.object({
      workspaceId: workspaceIdSchema.optional(),
      customAttributes: z.record(z.unknown()).optional()
    }).optional()
  }),
  z.object({
    action: z.literal('evaluate_multiple'),
    flags: z.array(
      z.object({
        key: z.string().max(100),
        defaultValue: z.boolean().optional()
      })
    ).min(1).max(20),
    context: z.object({
      workspaceId: workspaceIdSchema.optional(),
      customAttributes: z.record(z.unknown()).optional()
    }).optional()
  })
])

// ============================================================================
// SAML Authentication Schemas
// ============================================================================

/** SAML metadata query validation - restricts to allowlist of known providers */
export const samlMetadataQuerySchema = z.object({
  provider: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Provider must contain only lowercase alphanumeric characters and hyphens')
    .refine(
      (provider) => ['okta', 'azure', 'google', 'onelogin', 'auth0'].includes(provider),
      'Provider must be one of: okta, azure, google, onelogin, auth0'
    )
    .default('okta')
})

// ============================================================================
// MongoDB Chat Schemas
// ============================================================================

/** MongoDB chat actions - discriminated union based on action type */
export const mongodbChatActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create_session')
  }),
  z.object({
    action: z.literal('create_conversation'),
    title: z.string().max(200).optional(),
    sessionId: z.string().uuid(),
    model: z.string().min(1).max(100),
    workspaceId: workspaceIdSchema.optional()
  }),
  z.object({
    action: z.literal('add_message'),
    conversationId: z.string().uuid(),
    content: z.string().min(1).max(100_000),
    from: z.enum(['user', 'assistant', 'system'])
  }),
  z.object({
    action: z.literal('get_conversations')
  })
])

// ============================================================================
// Claude Session Schemas
// ============================================================================

/** Claude session actions - discriminated union for session management */
export const claudeSessionActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('start'),
    workspaceId: workspaceIdSchema
  }),
  z.object({
    action: z.literal('send'),
    workspaceId: workspaceIdSchema,
    sessionId: z.string().min(1).max(100),
    message: z.string().min(1).max(100_000)
  }),
  z.object({
    action: z.literal('close'),
    workspaceId: workspaceIdSchema,
    sessionId: z.string().min(1).max(100)
  }),
  z.object({
    action: z.literal('status'),
    workspaceId: workspaceIdSchema
  })
])

/** Claude session query parameters */
export const claudeSessionQuerySchema = z.object({
  workspaceId: workspaceIdSchema
})

// ============================================================================
// Code Server Session Schemas
// ============================================================================

/** Code Server session creation and management */
export const codeServerSessionSchema = z.object({
  workspaceId: workspaceIdSchema,
  userId: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  projectPath: z.string().max(500).refine(
    (path) => !path.includes('..') && (path.startsWith('/workspace') || path.startsWith('/tmp/workspaces')),
    'Project path must be within workspace directories and not contain directory traversal'
  ).optional()
})

// ============================================================================
// Init Goose (Database Migrations) Schemas
// ============================================================================

/** Init Goose parameter validation */
export const initGooseParamSchema = z.object({
  id: workspaceIdSchema
})

/** Init Goose body validation */
export const initGooseSchema = z.object({
  workspaceId: workspaceIdSchema,
  migrationName: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Migration name must contain only alphanumeric characters, hyphens, and underscores')
})

// ============================================================================
// Security Schemas
// ============================================================================

/** Absolute path validation - restricts to safe directories */
export const absolutePathSchema = z.string().refine(
  (path) => {
    if (!path.startsWith('/')) return false
    if (path.includes('..')) return false
    if (!/^[a-zA-Z0-9/_-]+$/.test(path)) return false
    return path.startsWith('/workspaces') || path.startsWith('/tmp/workspaces')
  },
  'Path must be absolute, within allowed directories, and not contain directory traversal or shell metacharacters'
)

/** Shell command validation - prevents command injection */
export const shellCommandSchema = z.string().max(1000).refine(
  (cmd) => {
    // Reject shell metacharacters
    if (/[;|&`$()<>]/.test(cmd)) return false
    // Reject directory traversal
    if (cmd.includes('..')) return false
    return true
  },
  'Command must not contain shell metacharacters or directory traversal'
)

/** Provider name validation - enforces allowlist */
export const providerNameSchema = z.string().regex(/^[a-z0-9-]+$/).refine(
  (provider) => ['okta', 'azure', 'google', 'onelogin', 'auth0'].includes(provider),
  'Provider must be one of: okta, azure, google, onelogin, auth0'
)

// ============================================================================
// AI Operations Schemas
// ============================================================================

/** Function name allowlist for AI function calls */
export const functionNameSchema = z.string().regex(/^[a-zA-Z0-9_-]+$/).refine(
  (name) => [
    'web_search',
    'create_file',
    'read_file',
    'update_file',
    'delete_file',
    'execute_code',
    'list_files',
    'terminal_execute'
  ].includes(name),
  'Function name must be from allowlist'
)

/** AI function call schema */
export const aiFunctionCallSchema = z.object({
  function_call: z.object({
    name: functionNameSchema,
    arguments: z.record(z.unknown()).refine(
      (args) => JSON.stringify(args).length <= 100_000,
      'Function arguments must not exceed 100KB'
    )
  }),
  workspaceId: workspaceIdSchema.optional()
})

/** Programming language allowlist */
export const programmingLanguageSchema = z.enum([
  'javascript',
  'typescript',
  'python',
  'react',
  'nextjs',
  'vue',
  'node',
  'go',
  'rust',
  'java'
])

/** Project generation schema */
export const generateProjectSchema = z.object({
  prompt: z.string().min(1).max(10_000),
  projectName: z.string().max(100).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  language: programmingLanguageSchema.optional(),
  framework: z.string().max(50).optional(),
  features: z.array(z.string().max(50)).max(20).optional()
})

/** Vector store schema */
export const vectorStoreSchema = z.object({
  workspaceId: workspaceIdSchema,
  content: z.string().min(1).max(1_000_000),
  metadata: z.record(z.unknown()).optional(),
  chunkSize: z.number().int().positive().max(10_000).optional()
})

/** Vector search schema */
export const vectorSearchSchema = z.object({
  workspaceId: workspaceIdSchema,
  query: z.string().min(1).max(5_000),
  maxResults: z.number().int().positive().max(100).optional().default(5),
  threshold: z.number().min(0).max(1).optional()
})

/** Sequential thinking schema */
export const sequentialThinkingSchema = z.object({
  problem: z.string().min(1).max(50_000),
  context: z.array(z.string()).max(10).optional(),
  maxSteps: z.number().int().positive().max(50).optional().default(20)
})
