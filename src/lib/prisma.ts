/**
 * Prisma client configuration for VibeCode WebGUI
 * Handles database connections with connection pooling and comprehensive logging
 */

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

// Middleware for Datadog monitoring
prisma.$use(async (params, next) => {
  const before = Date.now()
  
  try {
    const result = await next(params)
    const after = Date.now()
    
    // Log query metrics for Datadog
    console.log(`Database Query: ${params.model}.${params.action} took ${after - before}ms`)
    
    return result
  } catch (error) {
    const after = Date.now()
    console.error(`Database Error: ${params.model}.${params.action} failed after ${after - before}ms`, error)
    throw error
  }
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma

// Helper functions for common operations
export async function getUserByEmail(email: string) {
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
  response?: any
  error?: string
}) {
  return prisma.aIRequest.create({
    data: {
      ...data,
      completed_at: data.status === 'completed' ? new Date() : undefined
    }
  })
}
