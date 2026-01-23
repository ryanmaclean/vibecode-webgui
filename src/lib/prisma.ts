/**
 * Prisma client configuration for VibeCode WebGUI
 * Handles database connections with connection pooling and comprehensive logging
 */

import { PrismaClient, Prisma } from '@prisma/client'
import tracer from 'dd-trace'
import { metrics } from './server-monitoring'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Check if we're in build mode - disable database connections during build
const isBuilding = process.env.NEXT_PHASE === 'phase-production-build' || 
                  process.argv.includes('build') ||
                  process.env.BUILDING === 'true'

let prismaClient: PrismaClient

if (isBuilding) {
  // Create a mock Prisma client for build time
  prismaClient = {} as PrismaClient
} else {
  // Add DBM tags to the database URL
  const dbUrl = new URL(process.env.DATABASE_URL || 'postgresql://localhost:5432/placeholder');
  if (!dbUrl.searchParams.has('application_name')) {
    dbUrl.searchParams.set('application_name', 'vibecode-webgui');
  }
  if (!dbUrl.searchParams.has('options')) {
    dbUrl.searchParams.set('options', `-c datadog.tags=env:${process.env.NODE_ENV},service:vibecode-webgui,version:1.0.0`);
  }

  prismaClient = globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'info', 'warn', 'error']
      : ['error'],
    datasources: {
      db: {
        url: dbUrl.toString(),
      },
    },
  })
}

export const prisma = prismaClient

// Middleware for Datadog monitoring (only when not building)
// Note: $use middleware is deprecated in Prisma 5+, using extensions instead

// Type definitions for Prisma middleware (deprecated but still used in some versions)
interface PrismaMiddlewareParams {
  model?: string;
  action: string;
  args: unknown;
  dataPath: string[];
  runInTransaction: boolean;
}

type PrismaMiddlewareNext = (params: PrismaMiddlewareParams) => Promise<unknown>;

interface PrismaClientWithMiddleware extends PrismaClient {
  $use?: (middleware: (params: PrismaMiddlewareParams, next: PrismaMiddlewareNext) => Promise<unknown>) => void;
}

const prismaWithMiddleware = prisma as PrismaClientWithMiddleware;

if (!isBuilding && typeof prismaWithMiddleware.$use === 'function') {
  prismaWithMiddleware.$use(async (params: PrismaMiddlewareParams, next: PrismaMiddlewareNext) => {
    const startTime = Date.now()
    const span = tracer?.startSpan?.('prisma.query', {
      tags: {
        'env': process.env.NODE_ENV || 'development',
        'service.name': 'vibecode-webgui',
        'version': '1.0.0',
        'db.system': 'postgresql',
        'db.operation': params.action,
        'db.table': params.model || 'unknown',
        'span.kind': 'client',
        'resource.name': `${params.model}.${params.action}`,
        'span.type': 'sql',
      }
    })
    
    try {
      const result = await next(params)
      const duration = Date.now() - startTime
      
      // Record metrics for Datadog
      metrics.histogram('db.query.duration', duration, {
        service: 'vibecode-webgui',
        operation: params.action,
        model: params.model || 'unknown',
        status: 'success'
      })
      
      metrics.increment('db.query.count', {
        service: 'vibecode-webgui',
        operation: params.action,
        model: params.model || 'unknown',
        status: 'success'
      })
      
      if (span) {
        const resultWithCount = result as { count?: number } | undefined;
        span.setTag('db.rows_affected', resultWithCount?.count)
        span.finish()
      }

      return result
    } catch (error) {
      // Record error metrics
      const errorName = error instanceof Error ? error.name : 'unknown_error'
      const errorMessage = error instanceof Error ? error.message : String(error)

      metrics.increment('db.query.error', {
        service: 'vibecode-webgui',
        operation: params.action,
        model: params.model || 'unknown',
        error: errorName
      })

      if (span) {
        span.setTag('error', true)
        span.setTag('error.msg', errorMessage)
        span.setTag('error.type', errorName)
        span.finish()
      }

      throw error
    }
  })
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma

// Helper functions for common operations
export async function getUserByEmail(email: string) {
  if (isBuilding) {
    return null
  }
  return prisma.user.findUnique({
    where: { email },
    include: {
      sessions: true,
      workspaces: {
        take: 10,
        orderBy: { updated_at: 'desc' }
      },
      projects: {
        take: 10,
        orderBy: { updated_at: 'desc' }
      }
    }
  })
}

export async function createWorkspace(data: {
  name: string
  description?: string
  user_id: number
  workspace_id: string
  url?: string
}) {
  if (isBuilding) {
    return null
  }
  return prisma.workspace.create({
    data,
    include: {
      user: true,
      projects: true
    }
  })
}

export async function logAIRequest(data: {
  user_id: number
  project_id?: number
  request_type: string
  prompt: string
  model: string
  provider: string
  input_tokens?: number
  output_tokens?: number
  cost?: number
  duration_ms?: number
  status: string
  response?: Prisma.InputJsonValue
  error?: string
}) {
  if (isBuilding) {
    return null
  }
  return prisma.aIRequest.create({
    data: {
      ...data,
      completed_at: data.status === 'completed' ? new Date() : undefined
    }
  })
}
