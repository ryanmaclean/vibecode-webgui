/**
 * Mock for @/lib/prisma singleton
 *
 * This mock replaces the actual Prisma singleton instance used throughout the app.
 * It provides the same interface but with mocked methods for testing.
 *
 * Usage:
 * ```typescript
 * jest.mock('@/lib/prisma')
 * import { prisma } from '@/lib/prisma'
 *
 * // All methods are mocked
 * prisma.user.findUnique.mockResolvedValue({ ... })
 * ```
 */

import { mockPrismaClient } from '../../../__mocks__/@prisma/client'

console.log('[MOCK @/lib/prisma] Loading mock, mockPrismaClient.$queryRaw:', typeof mockPrismaClient.$queryRaw);
console.log('[MOCK @/lib/prisma] Is it a jest mock?', jest.isMockFunction(mockPrismaClient.$queryRaw));

// Export the mock prisma singleton
export const prisma = mockPrismaClient

// Export default for default imports
export default prisma

// Export helper functions (mocked versions)
export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: {
      sessions: true,
      workspaces: {
        take: 10,
        orderBy: { updated_at: 'desc' },
      },
      projects: {
        take: 10,
        orderBy: { updated_at: 'desc' },
      },
    },
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
      projects: true,
    },
  })
}

export const logAIRequest = jest.fn(async (data: {
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
}) => {
  return prisma.aIRequest.create({
    data: {
      ...data,
      completed_at: data.status === 'completed' ? new Date() : undefined,
    },
  })
})
