/**
 * Prisma client configuration for VibeCode WebGUI
 * Handles database connections with connection pooling and comprehensive logging
 */

import { PrismaClient, Prisma } from '@prisma/client'
importfrom 'dd-trace'
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

// Note: Prisma middleware for monitoring is disabled to avoid compatibility issues
// Monitoring can be added at the application level if needed

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
