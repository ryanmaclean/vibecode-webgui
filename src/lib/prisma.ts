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

// Check if we're in build mode or if Prisma client generation failed
const isBuilding = process.env.NEXT_PHASE === 'phase-production-build' || 
                  process.argv.includes('build') ||
                  process.env.BUILDING === 'true'

// Check if the DATABASE_URL is properly configured
const isDatabaseConfigured = process.env.DATABASE_URL && 
                             process.env.DATABASE_URL !== 'postgresql://localhost:5432/placeholder'

let prismaClient: PrismaClient

if (isBuilding || !isDatabaseConfigured) {
  // Create a mock Prisma client for build time or when DB not configured
  prismaClient = {} as PrismaClient
} else {
  try {
    // Add DBM tags to the database URL if it's a real PostgreSQL URL
    const dbUrl = new URL(process.env.DATABASE_URL || 'postgresql://localhost:5432/placeholder');
    
    // Only add application_name and options if not already present
    if (!dbUrl.searchParams.has('application_name')) {
      dbUrl.searchParams.set('application_name', 'vibecode-webgui');
    }
    if (!dbUrl.searchParams.has('options')) {
      dbUrl.searchParams.set('options', `-c datadog.tags=env:${process.env.NODE_ENV || 'development'},service:vibecode-webgui,version:1.0.0`);
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
  } catch (prismaError) {
    console.warn('Prisma client initialization failed, using mock client:', prismaError);
    // Fall back to mock client if initialization fails
    prismaClient = {} as PrismaClient
  }
}

export const prisma = prismaClient

// Note: Prisma middleware for monitoring is disabled to avoid compatibility issues
// Monitoring can be added at the application level if needed

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma

// Helper functions for common operations
export async function getUserByEmail(email: string) {
  if (isBuilding || !isDatabaseConfigured || !prisma.user) {
    return null
  }
  try {
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
  } catch (error) {
    console.error('Error fetching user by email:', error)
    return null
  }
}

export async function createWorkspace(data: {
  name: string
  description?: string
  user_id: number
  workspace_id: string
  url?: string
}) {
  if (isBuilding || !isDatabaseConfigured || !prisma.workspace) {
    return null
  }
  try {
    return prisma.workspace.create({
      data,
      include: {
        user: true,
        projects: true
      }
    })
  } catch (error) {
    console.error('Error creating workspace:', error)
    return null
  }
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
  if (isBuilding || !isDatabaseConfigured || !prisma.aIRequest) {
    return null
  }
  try {
    return prisma.aIRequest.create({
      data: {
        ...data,
        completed_at: data.status === 'completed' ? new Date() : undefined
      }
    })
  } catch (error) {
    console.error('Error logging AI request:', error)
    return null
  }
}
