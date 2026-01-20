/**
 * Phase 4 Batch 2 Validation Schemas
 * 
 * Additional schemas for remaining API routes that weren't covered in the main schemas.ts file
 */

import { z } from '@/lib/zod-compat'
import { workspaceIdSchema, filePathSchema } from './schemas'

// ============================================================================
// Docker Status & Management Schemas
// ============================================================================

export const dockerActionSchema = z.object({
  action: z.enum(['start-colima', 'stop-colima', 'restart-colima', 'status']),
  options: z.object({
    memory: z.number().int().positive().max(16384).optional(), // Max 16GB
    cpus: z.number().int().positive().max(16).optional(),
    disk: z.number().int().positive().max(1000).optional() // Max 1TB
  }).optional()
})

// ============================================================================
// Workspace Auto-Scaling Schemas
// ============================================================================

export const autoScalingMetricsSchema = z.object({
  cpuUsage: z.number().min(0).max(100),
  memoryUsage: z.number().min(0).max(100),
  activeConnections: z.number().int().nonnegative(),
  responseTime: z.number().int().nonnegative(),
  timestamp: z.string().datetime()
})

export const autoScalingConfigSchema = z.object({
  minInstances: z.number().int().positive().max(100),
  maxInstances: z.number().int().positive().max(1000),
  targetCpuUsage: z.number().min(10).max(90).default(70),
  targetMemoryUsage: z.number().min(10).max(90).default(80),
  scaleUpThreshold: z.number().min(0).max(100).default(80),
  scaleDownThreshold: z.number().min(0).max(100).default(30),
  cooldownPeriod: z.number().int().positive().max(3600).default(300) // 5 minutes
})

export const autoScalingRegisterSchema = z.object({
  workspaceId: workspaceIdSchema,
  instanceId: z.string().min(1).max(100),
  instanceType: z.string().min(1).max(50),
  region: z.string().min(2).max(10),
  metrics: autoScalingMetricsSchema
})

// Alias for backward compatibility
export const workspaceMetricsSchema = autoScalingMetricsSchema
export const workspaceRegistrationSchema = autoScalingRegisterSchema

// ============================================================================
// Code Server Session Management Schemas
// ============================================================================

export const codeServerSessionIdSchema = z.object({
  sessionId: z.string().uuid()
})

export const codeServerSessionUpdateSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.enum(['active', 'idle', 'stopped', 'error']).optional(),
  lastActivity: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
})

// ============================================================================
// AI Management Schemas
// ============================================================================

export const aiManagementActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('list_models'),
    provider: z.string().min(1).max(50).optional(),
    category: z.enum(['chat', 'completion', 'embedding', 'image']).optional()
  }),
  z.object({
    action: z.literal('get_model_info'),
    modelId: z.string().min(1).max(200),
    provider: z.string().min(1).max(50)
  }),
  z.object({
    action: z.literal('test_model'),
    modelId: z.string().min(1).max(200),
    provider: z.string().min(1).max(50),
    testPrompt: z.string().min(1).max(1000).optional().default('Hello, how are you?')
  }),
  z.object({
    action: z.literal('get_usage_stats'),
    timeframe: z.enum(['hour', 'day', 'week', 'month']).optional().default('day'),
    provider: z.string().min(1).max(50).optional()
  })
])

// ============================================================================
// AI Provider Health Schemas
// ============================================================================

export const providerHealthCheckSchema = z.object({
  providers: z.array(z.string().min(1).max(50)).min(1).max(20).optional(),
  includeMetrics: z.boolean().optional().default(true),
  timeout: z.number().int().positive().max(30).optional().default(10) // Max 30 seconds
})

// ============================================================================
// AI Model Selection Schemas
// ============================================================================

export const modelSelectionRequestSchema = z.object({
  task: z.enum(['chat', 'completion', 'code_generation', 'analysis', 'translation']),
  context: z.object({
    language: z.string().min(2).max(10).optional(),
    complexity: z.enum(['simple', 'moderate', 'complex']).optional(),
    domain: z.string().min(1).max(50).optional(),
    requirements: z.array(z.string().min(1).max(100)).max(10).optional()
  }).optional(),
  constraints: z.object({
    maxTokens: z.number().int().positive().max(32000).optional(),
    temperature: z.number().min(0).max(2).optional(),
    budget: z.number().positive().max(1000).optional(), // Max $1000
    latency: z.number().int().positive().max(30000).optional() // Max 30 seconds
  }).optional(),
  preferences: z.object({
    provider: z.array(z.string().min(1).max(50)).max(5).optional(),
    modelType: z.enum(['small', 'medium', 'large', 'xl']).optional(),
    features: z.array(z.string().min(1).max(50)).max(10).optional()
  }).optional()
})

// ============================================================================
// Enhanced Container Management Schemas
// ============================================================================

export const createEnhancedContainerSchema = z.object({
  image: z.string().min(1).max(255),
  name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  workspaceId: workspaceIdSchema.optional(),
  options: z.object({
    cpus: z.number().positive().max(16).optional(),
    memory: z.string().regex(/^\d+[MGT]$/).optional(),
    ports: z.array(z.string().regex(/^\d+:\d+$/)).max(20).optional(),
    volumes: z.array(z.string()).max(20).optional(),
    env: z.record(z.string(), z.string()).optional(),
    workingDir: z.string().optional(),
    command: z.array(z.string()).max(50).optional(),
    restartPolicy: z.enum(['no', 'always', 'on-failure', 'unless-stopped']).optional().default('no'),
    networkMode: z.string().min(1).max(50).optional(),
    labels: z.record(z.string(), z.string()).optional()
  }).optional(),
  healthCheck: z.object({
    test: z.array(z.string()).max(10).optional(),
    interval: z.number().int().positive().max(3600).optional().default(30),
    timeout: z.number().int().positive().max(300).optional().default(10),
    retries: z.number().int().nonnegative().max(10).optional().default(3),
    startPeriod: z.number().int().nonnegative().max(3600).optional().default(0)
  }).optional()
})

// ============================================================================
// Additional Utility Schemas
// ============================================================================

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().max(1000).default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().min(1).max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
})

export const timestampRangeSchema = z.object({
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional()
}).refine(
  (data) => {
    if (data.startTime && data.endTime) {
      const start = new Date(data.startTime)
      const end = new Date(data.endTime)
      return end.getTime() > start.getTime()
    }
    return true
  },
  {
    message: 'endTime must be after startTime'
  }
)

export const resourceIdSchema = z.object({
  id: z.string().min(1).max(100)
})

export const workspaceContextSchema = z.object({
  workspaceId: workspaceIdSchema,
  userId: z.string().min(1).max(100).optional(),
  projectId: z.string().min(1).max(100).optional()
})
