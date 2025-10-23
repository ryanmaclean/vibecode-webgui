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
    commandType: z.enum(['chat', 'explain', 'generate', 'analyze']).optional().default('chat')
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

// ============================================================================
// PHASE 3: AI Operations & Code Execution (Function Calls, Project Generation)
// ============================================================================

/** Function name validation - allowlist of safe functions */
export const functionNameSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Function name must be a valid identifier')
  .refine(
    (name) => [
      'web_search',
      'create_file',
      'list_files',
      'read_file',
      'execute_code',
      'install_package',
      'search_documentation'
    ].includes(name),
    'Function name must be in the allowlist of safe functions'
  )

/** AI Function Call Schema (Command Injection Prevention) */
export const aiFunctionCallSchema = z.object({
  function_call: z.object({
    name: functionNameSchema,
    arguments: z.record(z.unknown()).refine(
      (args) => JSON.stringify(args).length <= 100_000, // 100KB limit
      'Function arguments too large'
    )
  }),
  workspaceId: workspaceIdSchema.optional()
})

/** Programming language validation */
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

/** Project generation schema with safe constraints */
export const generateProjectSchema = z.object({
  prompt: z.string().min(1).max(10_000), // 10KB max prompt
  projectName: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Project name must contain only alphanumeric characters, hyphens, and underscores')
    .optional(),
  language: programmingLanguageSchema.optional(),
  framework: z.string().min(1).max(50).optional(),
  features: z.array(z.string().min(1).max(100)).max(20).optional()
})

/** Code execution schema (session management) */
export const codeServerSessionSchema = z.object({
  workspaceId: workspaceIdSchema,
  projectPath: z
    .string()
    .min(1)
    .max(500)
    .refine((path) => path.startsWith('/workspace'), 'Project path must be within /workspace directory')
    .refine((path) => !path.includes('..'), 'Path must not contain directory traversal')
    .default('/workspace'),
  userId: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, 'User ID must contain only alphanumeric characters, hyphens, and underscores')
    .optional()
})

/** Gradio application run schema */
export const gradioRunSchema = z.object({
  workspaceId: workspaceIdSchema,
  scriptPath: filePathSchema,
  port: z.number().int().min(3000).max(9999).optional().default(7860),
  share: z.boolean().optional().default(false)
})

/** Web search query schema (Injection Prevention) */
export const webSearchSchema = z.object({
  query: z.string().min(1).max(500), // Reasonable search query length
  maxResults: z.number().int().positive().max(50).optional().default(10),
  safeSearch: z.boolean().optional().default(true),
  language: z.string().min(2).max(10).optional(),
  region: z.string().min(2).max(10).optional()
})

/** Vector store/embedding schema (DoS Prevention) */
export const vectorStoreSchema = z.object({
  workspaceId: workspaceIdSchema,
  content: z.string().min(1).max(1_000_000), // 1MB max content
  metadata: z.record(z.unknown()).optional(),
  chunkSize: z.number().int().positive().max(10_000).optional().default(1000),
  overlap: z.number().int().nonnegative().max(500).optional().default(200)
})

/** Vector search schema (Query Injection Prevention) */
export const vectorSearchSchema = z.object({
  workspaceId: workspaceIdSchema,
  query: z.string().min(1).max(5_000), // 5KB max query
  maxResults: z.number().int().positive().max(100).optional().default(5),
  threshold: z.number().min(0).max(1).optional().default(0.7),
  filter: z.record(z.unknown()).optional()
})

/** Sequential thinking/reasoning schema */
export const sequentialThinkingSchema = z.object({
  problem: z.string().min(1).max(50_000), // 50KB max problem description
  context: z.array(z.string().max(10_000)).max(10).optional(), // Max 10 context items
  maxSteps: z.number().int().positive().max(50).optional().default(10),
  temperature: z.number().min(0).max(2).optional().default(0.7)
})

/** LiteLLM proxy schema */
export const liteLLMSchema = z.object({
  model: z.string().min(1).max(100),
  messages: z.array(chatMessageSchema).min(1).max(100),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  max_tokens: z.number().int().positive().max(32000).optional(),
  stream: z.boolean().optional().default(false)
})

/** HuggingFace chat schema */
export const huggingfaceChatSchema = z.object({
  model: z.string().min(1).max(200),
  messages: z.array(chatMessageSchema).min(1).max(100),
  parameters: z.object({
    temperature: z.number().min(0).max(2).optional(),
    max_new_tokens: z.number().int().positive().max(8000).optional(),
    top_p: z.number().min(0).max(1).optional(),
    repetition_penalty: z.number().min(0).max(2).optional()
  }).optional()
})

// ============================================================================
// PHASE 4: File Upload & Authentication Security
// ============================================================================

/** Allowed MIME types for file uploads */
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp'
] as const

/** File upload validation with security constraints */
export const fileUploadSchema = z.object({
  workspaceId: workspaceIdSchema,
  files: z
    .array(
      z.object({
        name: z
          .string()
          .min(1)
          .max(255)
          .regex(/^[a-zA-Z0-9_.-]+$/, 'Filename must contain only alphanumeric characters, dots, hyphens, and underscores')
          .refine((name) => !name.includes('..'), 'Filename must not contain directory traversal'),
        size: z.number().int().positive().max(10_000_000), // 10MB per file
        type: z.enum(ALLOWED_MIME_TYPES, { errorMap: () => ({ message: 'Invalid file type' }) })
      })
    )
    .min(1)
    .max(10) // Max 10 files per upload
    .refine(
      (files) => files.reduce((sum, f) => sum + f.size, 0) <= 50_000_000,
      'Total upload size must not exceed 50MB'
    )
})

/** PDF upload validation */
export const pdfUploadSchema = z.object({
  workspaceId: workspaceIdSchema,
  projectId: z.number().int().positive().optional(),
  uploader: z.string().min(1).max(100).optional(),
  file: z.object({
    name: z.string().min(1).max(255),
    size: z.number().int().positive().max(25_000_000), // 25MB for PDFs
    type: z.literal('application/pdf')
  })
})

/** SAML SSO request schema with provider validation */
export const samlSsoRequestSchema = z.object({
  provider: providerNameSchema.optional().default('okta'),
  relayState: z.string().max(500).optional(),
  forceAuthn: z.boolean().optional().default(false)
})

/** SAML SSO response schema */
export const samlSsoResponseSchema = z.object({
  SAMLResponse: z
    .string()
    .min(1)
    .max(50_000) // 50KB max SAML response
    .refine(
      (response) => {
        // Basic XML format validation
        return response.includes('<saml') || response.includes('<samlp')
      },
      'Invalid SAML response format'
    ),
  RelayState: z.string().max(500).optional()
})

/** CSP violation report schema */
export const cspReportSchema = z.object({
  'csp-report': z.object({
    'document-uri': z.string().url().max(500).optional(),
    referrer: z.string().max(500).optional(),
    'violated-directive': z.string().max(200).optional(),
    'effective-directive': z.string().max(200).optional(),
    'original-policy': z.string().max(2000).optional(),
    'blocked-uri': z.string().max(500).optional(),
    'line-number': z.number().int().optional(),
    'column-number': z.number().int().optional(),
    'source-file': z.string().max(500).optional(),
    'status-code': z.number().int().optional()
  })
})

/** Rate limiting metadata schema */
const rateLimitMetaSchema = z.object({
  maxRequests: z.number().int().positive().max(100).optional().default(60),
  windowSeconds: z.number().int().positive().max(3600).optional().default(60)
})

/** Unified AI chat schema (consolidated from /chat, /chat/enhanced, /chat/stream) */
export const aiChatUnifiedSchema = z.object({
  message: z
    .string()
    .min(1)
    .max(100_000) // 100KB limit
    .regex(/^[^\x00-\x1F\x7F]*$/, 'Message contains invalid control characters'),
  messages: z
    .array(chatMessageSchema)
    .min(1)
    .max(100) // Max 100 messages in context
    .optional(),
  model: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .default('anthropic/claude-3.5-sonnet'),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  max_tokens: z.number().int().positive().max(32000).optional(),
  stream: z.boolean().optional().default(false),
  workspaceId: workspaceIdSchema.optional(),
  context: z
    .object({
      workspaceId: workspaceIdSchema,
      files: z.array(filePathSchema).max(20).optional().default([]),
      previousMessages: z
        .array(
          z.object({
            role: z.enum(['user', 'assistant']),
            content: z.string().max(100_000)
          })
        )
        .max(50)
        .optional()
        .default([])
    })
    .optional(),
  enableTools: z.boolean().optional().default(false),
  enableRAG: z.boolean().optional().default(true),
  rateLimit: rateLimitMetaSchema.optional()
})

// ============================================================================
// PHASE 4 - BATCH 3: Health, Monitoring & Remaining Routes
// ============================================================================

/** Health check query parameters */
export const healthCheckQuerySchema = z.object({
  filter: z.enum(['database', 'redis', 'ai', 'memory', 'disk', 'all']).optional().default('all'),
  format: z.enum(['json', 'text', 'metrics']).optional().default('json'),
  verbose: z.coerce.boolean().optional().default(false)
})

/** Monitoring query parameters with time range validation */
export const monitoringQuerySchema = z.object({
  timeframe: z.enum(['5m', '15m', '1h', '6h', '12h', '24h', '7d', '30d']).optional().default('1h'),
  metricNames: z
    .string()
    .optional()
    .transform((val) => val?.split(',').filter(Boolean))
    .pipe(
      z
        .array(z.string().min(1).max(100))
        .max(20)
        .optional()
    ),
  dashboardId: z.string().min(1).max(100).optional(),
  logs: z.coerce.boolean().optional().default(false),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional()
}).refine(
  (data) => {
    // If startTime is provided, endTime must also be provided
    if (data.startTime && !data.endTime) return false
    if (data.endTime && !data.startTime) return false

    // If both provided, validate time range (max 30 days)
    if (data.startTime && data.endTime) {
      const start = new Date(data.startTime)
      const end = new Date(data.endTime)
      const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      return diffDays >= 0 && diffDays <= 30
    }

    return true
  },
  {
    message: 'Invalid time range: both startTime and endTime required, max 30 days apart'
  }
)

/** Monitoring metrics POST body validation */
export const monitoringMetricsBodySchema = z.object({
  type: z.enum(['performance', 'error']),
  duration: z.number().int().nonnegative().max(300000).optional(), // max 5 minutes
  metrics: z.record(z.unknown()).refine(
    (metrics) => JSON.stringify(metrics).length <= 100_000, // 100KB limit
    'Metrics payload too large'
  )
})

/** Monitoring historical metrics validation */
export const monitoringHistoricalSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  metricTypes: z.array(z.string().min(1).max(100)).max(20).optional()
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

/** Experiments API validation */
export const experimentsQuerySchema = z.object({
  flagKey: z.string().min(1).max(100).optional(),
  action: z.enum(['results', 'list']).optional().default('results')
}).refine(
  (data) => {
    // If action is 'results', flagKey is required
    if (data.action === 'results' && !data.flagKey) return false
    return true
  },
  {
    message: 'flagKey is required when action is "results"'
  }
)

export const experimentsBodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('evaluate'),
    flagKey: z.string().min(1).max(100),
    context: z.object({
      workspaceId: workspaceIdSchema.optional(),
      defaultValue: z.boolean().optional(),
      customAttributes: z.record(z.unknown()).optional()
    }).optional()
  }),
  z.object({
    action: z.literal('track'),
    flagKey: z.string().min(1).max(100),
    metricName: z.string().min(1).max(100),
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
        key: z.string().min(1).max(100),
        defaultValue: z.boolean().optional()
      })
    ).min(1).max(20),
    context: z.object({
      workspaceId: workspaceIdSchema.optional(),
      customAttributes: z.record(z.unknown()).optional()
    }).optional()
  })
])
