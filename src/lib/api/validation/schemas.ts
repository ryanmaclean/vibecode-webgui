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
  env: z.record(z.string(), z.string()).optional(),
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
  files: z.record(z.string(), z.string()),
  dependencies: z.array(z.string()).default([]),
  environment: z.record(z.string(), z.string()).default({})
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
  metadata: z.record(z.string(), z.unknown()).optional()
})

// ============================================================================
// User Preferences Schemas
// ============================================================================

export const userPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().min(2).max(10).optional(),
  fontSize: z.number().int().min(8).max(32).optional(),
  editorSettings: z.record(z.string(), z.unknown()).optional(),
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
  data: z.record(z.string(), z.unknown()).optional()
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
  ).min(1).max(1000) // Max 1000 files per bulk operation
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
  verbose: z.boolean().optional().default(false)
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
    if (data.startTime && data.endTime) {
      const start = new Date(data.startTime)
      const end = new Date(data.endTime)
      const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      return diffDays >= 0 && diffDays <= 30
    }
    return true
  },
  {
    message: 'Time range must be positive and max 30 days'
  }
)

export const monitoringMetricsBodySchema = z.object({
  type: z.enum(['performance', 'error']),
  duration: z.number().max(300000).optional(), // Max 5 minutes
  metrics: z.record(z.string(), z.unknown()).refine(
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
      customAttributes: z.record(z.string(), z.unknown()).optional()
    }).optional()
  }),
  z.object({
    action: z.literal('track'),
    flagKey: z.string().max(100),
    metricName: z.string().max(100),
    value: z.number(),
    context: z.object({
      workspaceId: workspaceIdSchema.optional(),
      customAttributes: z.record(z.string(), z.unknown()).optional()
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
      customAttributes: z.record(z.string(), z.unknown()).optional()
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
// Path Traversal Prevention Schemas (defined early for reuse)
// ============================================================================

/** Absolute path validation (restricts to safe directories) */
export const absolutePathSchema = z.string()
  .min(1)
  .max(1000)
  .regex(/^\/[a-zA-Z0-9/_-]*$/, 'Path must be absolute and contain only safe characters')
  .refine(
    (path) => !path.includes('..'),
    'Path must not contain directory traversal sequences'
  )
  .refine(
    (path) => path.startsWith('/workspaces/') || path.startsWith('/workspace/') || path.startsWith('/tmp/workspaces/'),
    'Path must be within allowed directories (/workspaces/, /workspace/, /tmp/workspaces/)'
  )
  .refine(
    (path) => !/[;|&`$()<>]/.test(path),
    'Path must not contain shell metacharacters'
  )

/** Shell command validation (prevents injection) */
export const shellCommandSchema = z.string()
  .min(1)
  .max(1000)
  .refine(
    (cmd) => !cmd.includes('..'),
    'Command must not contain directory traversal'
  )
  .refine(
    (cmd) => !/[;|&`$()<>]/.test(cmd),
    'Command must not contain shell metacharacters'
  )

/** Provider name schema (SAML/OAuth) */
export const providerNameSchema = z.string()
  .min(1)
  .max(50)
  .regex(/^[a-z0-9-]+$/, 'Provider must contain only lowercase alphanumeric and hyphens')
  .refine(
    (provider) => ['okta', 'azure', 'google', 'onelogin', 'auth0'].includes(provider),
    'Provider must be in allowlist'
  )

// ============================================================================
// Code Server Session Schemas
// ============================================================================

/** Code Server session creation and management */
export const codeServerSessionSchema = z.object({
  workspaceId: workspaceIdSchema,
  userId: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  projectPath: absolutePathSchema.optional()
})

// ============================================================================
// AI Function Call Schemas
// ============================================================================

/** Allowlisted function names for AI function calls */
export const functionNameSchema = z.string().regex(/^[a-z_][a-z0-9_]*$/, 'Function name must be lowercase alphanumeric with underscores').refine(
  (name) => [
    'web_search',
    'create_file',
    'read_file',
    'update_file',
    'delete_file',
    'execute_code',
    'list_directory',
    'create_directory',
    'search_code',
    'get_file_metadata',
    'run_tests',
    'lint_code',
    'format_code',
    'git_status',
    'git_commit',
    'git_push',
    'install_package',
    'run_command'
  ].includes(name),
  'Function name must be in allowlist'
)

/** AI function call schema with allowlist enforcement */
export const aiFunctionCallSchema = z.object({
  function_call: z.object({
    name: functionNameSchema,
    arguments: z.record(z.string(), z.unknown()).refine(
      (obj) => JSON.stringify(obj).length <= 100_000,
      'Arguments must not exceed 100KB'
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
  'svelte',
  'angular',
  'node',
  'deno',
  'go',
  'rust',
  'java',
  'kotlin',
  'swift',
  'csharp',
  'ruby'
])

/** Project generation schema */
export const generateProjectSchema = z.object({
  prompt: z.string().min(1).max(10_000), // 10KB limit
  projectName: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  language: programmingLanguageSchema.optional(),
  framework: z.string().min(1).max(50).optional(),
  features: z.array(z.string().min(1).max(50)).max(20).optional()
})

/** Vector store schema */
export const vectorStoreSchema = z.object({
  workspaceId: workspaceIdSchema,
  content: z.string().min(1).max(1_000_000), // 1MB limit
  metadata: z.record(z.string(), z.unknown()).optional(),
  chunkSize: z.number().int().positive().max(10_000).optional().default(1000)
})

/** Vector search schema */
export const vectorSearchSchema = z.object({
  workspaceId: workspaceIdSchema,
  query: z.string().min(1).max(5_000), // 5KB limit
  maxResults: z.number().int().positive().max(100).optional().default(10),
  threshold: z.number().min(0).max(1).optional().default(0.7)
})

/** Sequential thinking schema */
export const sequentialThinkingSchema = z.object({
  problem: z.string().min(1).max(50_000), // 50KB limit
  context: z.array(z.string().max(10_000)).max(10).optional(),
  maxSteps: z.number().int().positive().max(50).optional().default(20)
})

// ============================================================================
// Goose Migration Schemas
// ============================================================================

/** Init goose parameter schema */
export const initGooseParamSchema = z.object({
  id: workspaceIdSchema
})

/** Init goose body schema */
export const initGooseSchema = z.object({
  workspaceId: workspaceIdSchema,
  migrationName: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_]+$/)
})

// ============================================================================
// File Upload Schemas
// ============================================================================

/** File upload schema */
export const fileUploadSchema = z.object({
  workspaceId: workspaceIdSchema,
  files: z.array(
    z.object({
      filename: z.string()
        .min(1)
        .max(255)
        .refine((name) => !name.includes('..'), 'Filename must not contain directory traversal')
        .refine((name) => !name.startsWith('/'), 'Filename must not be absolute path'),
      size: z.number().int().positive().max(10_000_000), // 10MB per file
      mimetype: z.string().refine(
        (type) => [
          'text/plain',
          'text/javascript',
          'text/html',
          'text/css',
          'application/json',
          'application/xml',
          'image/png',
          'image/jpeg',
          'image/gif',
          'image/svg+xml',
          'application/pdf'
        ].includes(type),
        'File type not allowed'
      )
    })
  ).min(1).max(10) // Max 10 files
}).refine(
  (data) => {
    const totalSize = data.files.reduce((sum, file) => sum + file.size, 0)
    return totalSize <= 50_000_000 // 50MB total
  },
  'Total upload size must not exceed 50MB'
)

/** PDF upload schema */
export const pdfUploadSchema = z.object({
  workspaceId: workspaceIdSchema,
  filename: z.string()
    .min(1)
    .max(255)
    .regex(/\.pdf$/, 'File must have .pdf extension')
    .refine((name) => !name.includes('..'), 'Filename must not contain directory traversal'),
  size: z.number().int().positive().max(25_000_000), // 25MB limit
  mimetype: z.literal('application/pdf')
})

// ============================================================================
// SAML SSO Schemas
// ============================================================================

/** SAML SSO schema */
export const samlSSOSchema = z.object({
  provider: providerNameSchema,
  relayState: z.string().max(500).optional()
})

/** SAML response schema */
export const samlResponseSchema = z.object({
  SAMLResponse: z.string().max(50_000), // 50KB limit
  RelayState: z.string().max(500).optional()
})

// ============================================================================
// CSP Report Schemas
// ============================================================================

/** CSP report schema */
export const cspReportSchema = z.object({
  'csp-report': z.object({
    'document-uri': z.string().max(500).optional(),
    'violated-directive': z.string().max(100).optional(),
    'blocked-uri': z.string().max(500).optional(),
    'source-file': z.string().max(500).optional(),
    'line-number': z.number().int().optional(),
    'column-number': z.number().int().optional(),
    'status-code': z.number().int().optional()
  })
}).refine(
  (data) => JSON.stringify(data).length <= 10_000,
  'CSP report must not exceed 10KB'
)

// ============================================================================
// AI Chat Extended Schemas
// ============================================================================

/** AI chat extended schema with context */
export const aiChatSchema = z.object({
  message: z.string().min(1).max(100_000).regex(/^[^\x00-\x1F]*$/, 'Message must not contain control characters').optional(),
  messages: z.array(chatMessageSchema).max(100).optional(),
  model: z.string().min(1).max(100).optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().max(32_000).optional(),
  context: z.object({
    workspaceId: workspaceIdSchema.optional(),
    files: z.array(z.string()).max(20).optional()
  }).optional()
}).refine(
  (data) => data.message || data.messages,
  'Either message or messages must be provided'
)

// ============================================================================
// Container Management Extended Schemas
// ============================================================================

/** Container creation with security validations */
export const createContainerSecureSchema = z.object({
  image: z.string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9.\-/:]+$/, 'Image must contain only lowercase alphanumeric, dots, hyphens, slashes, colons')
    .refine((img) => !img.includes('..'), 'Image must not contain directory traversal'),
  options: z.object({
    name: z.string()
      .min(1)
      .max(100)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .refine((name) => !name.includes('..'), 'Name must not contain directory traversal')
      .optional(),
    cpus: z.number().positive().max(16).optional(),
    memory: z.string().regex(/^\d+[MGT]$/).optional(),
    ports: z.array(
      z.string()
        .regex(/^\d+:\d+$/)
        .refine((port) => {
          const [host] = port.split(':')
          return parseInt(host) >= 1024
        }, 'Host port must be >= 1024')
    ).max(20).optional(),
    env: z.record(z.string(), z.string()).optional()
  }).optional()
}).refine(
  (data) => {
    if (data.options?.ports && data.options.ports.length > 20) {
      return false
    }
    return true
  },
  'Maximum 20 port mappings allowed'
)

/** Container ID validation with security */
export const containerIdSecureSchema = z.object({
  id: z.string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Container ID must be alphanumeric with hyphens/underscores')
    .refine((id) => !id.includes('..'), 'Container ID must not contain directory traversal')
})

/** Docker action schema */
export const dockerActionSchema = z.object({
  action: z.enum(['start-colima', 'stop-colima', 'status', 'info', 'version'])
})

// ============================================================================
// Workspace Auto-scaling Schemas
// ============================================================================

/** Workspace auto-scaling metrics */
export const workspaceMetricsSchema = z.object({
  workspaceId: workspaceIdSchema,
  cpuUsage: z.number().min(0).max(100).optional(),
  memoryUsage: z.number().min(0).max(100).optional(),
  activeConnections: z.number().int().min(0).max(10_000).optional()
})

/** Workspace resource registration */
export const workspaceResourceSchema = z.object({
  workspaceId: workspaceIdSchema,
  resources: z.object({
    instances: z.array(
      z.object({
        instanceId: z.string().min(1).max(100),
        status: z.enum(['pending', 'running', 'stopped', 'terminated']),
        resources: z.object({
          cpu: z.number().positive().max(32),
          memory: z.number().positive().max(128),
          disk: z.number().positive().max(1000)
        }),
        podName: z.string().max(100).optional(),
        namespace: z.string().max(100).optional()
      })
    ).max(10) // Max 10 instances per workspace
  })
})

/** Workspace auto-scaling config */
export const workspaceScalingConfigSchema = z.object({
  enabled: z.boolean().optional(),
  evaluationInterval: z.number().int().min(10).max(3600).optional(), // 10s to 1h
  resourceLimits: z.object({
    maxInstancesPerWorkspace: z.number().int().min(1).max(50).optional()
  }).optional()
})

// ============================================================================
// Code Server Session Extended Schemas
// ============================================================================

/** Code server session ID validation */
export const codeServerSessionIdSchema = z.object({
  sessionId: z.string().uuid()
})

/** Code server session update */
export const codeServerSessionUpdateSchema = z.object({
  status: z.enum(['active', 'inactive', 'terminated']).optional(),
  lastActivity: z.string().datetime().optional()
})

// ============================================================================
// AI Management Schemas
// ============================================================================

/** AI management query */
export const aiManagementQuerySchema = z.object({
  action: z.enum(['overview', 'models', 'usage', 'costs', 'health', 'performance']).optional(),
  timeframe: z.enum(['1h', '24h', '7d', '30d']).optional()
})

/** AI model selection */
export const aiModelSelectionSchema = z.object({
  prompt: z.string().min(1).max(10_000), // 10KB limit
  metadata: z.object({
    fileTypes: z.array(z.string()).max(10).optional(),
    conversationHistory: z.number().int().min(0).max(100).optional()
  }).optional()
})

/** AI provider health */
export const aiProviderHealthSchema = z.object({
  provider: z.enum(['openrouter', 'azure-openai', 'anthropic', 'ollama', 'gemini', 'bedrock', 'openai'])
})
