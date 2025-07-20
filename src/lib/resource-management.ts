/**
 * Resource Management & Quota System
 * Prevents users from exhausting system resources
 */

import { prisma } from './prisma'
import { monitoring } from './monitoring'

interface UserQuotas {
  maxWorkspaces: number
  maxFilesPerWorkspace: number
  maxFileSize: number // bytes
  maxVectorChunks: number
  maxAPICallsPerHour: number
  maxStorageBytes: number
  maxConcurrentSessions: number
}

interface ResourceUsage {
  workspaceCount: number
  fileCount: number
  totalStorageBytes: number
  vectorChunkCount: number
  apiCallsThisHour: number
  activeSessions: number
}

const DEFAULT_QUOTAS: UserQuotas = {
  maxWorkspaces: 10,
  maxFilesPerWorkspace: 100,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxVectorChunks: 10000,
  maxAPICallsPerHour: 100,
  maxStorageBytes: 100 * 1024 * 1024, // 100MB
  maxConcurrentSessions: 3
}

const PREMIUM_QUOTAS: UserQuotas = {
  maxWorkspaces: 50,
  maxFilesPerWorkspace: 500,
  maxFileSize: 50 * 1024 * 1024, // 50MB
  maxVectorChunks: 100000,
  maxAPICallsPerHour: 1000,
  maxStorageBytes: 1024 * 1024 * 1024, // 1GB
  maxConcurrentSessions: 10
}

export class ResourceManager {
  private static instance: ResourceManager
  private quotaCache = new Map<number, UserQuotas>()
  private usageCache = new Map<number, { usage: ResourceUsage, timestamp: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  public static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager()
    }
    return ResourceManager.instance
  }

  /**
   * Get user quotas with caching
   */
  async getUserQuotas(userId: number): Promise<UserQuotas> {
    if (this.quotaCache.has(userId)) {
      return this.quotaCache.get(userId)!
    }

    try {
      // Check if user has premium subscription
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscription_tier: true }
      })

      const quotas = user?.subscription_tier === 'premium' ? PREMIUM_QUOTAS : DEFAULT_QUOTAS
      this.quotaCache.set(userId, quotas)
      
      return quotas
    } catch (error) {
      console.error('Error fetching user quotas:', error)
      return DEFAULT_QUOTAS
    }
  }

  /**
   * Get current resource usage for user
   */
  async getResourceUsage(userId: number): Promise<ResourceUsage> {
    const cached = this.usageCache.get(userId)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.usage
    }

    try {
      const [workspaces, files, vectorChunks, apiCalls, sessions] = await Promise.all([
        // Workspace count
        prisma.workspace.count({ where: { user_id: userId } }),
        
        // File count and storage
        prisma.file.aggregate({
          where: { user_id: userId },
          _count: true,
          _sum: { size: true }
        }),
        
        // Vector chunk count
        prisma.rAGChunk.count({
          where: { file: { user_id: userId } }
        }),
        
        // API calls in last hour
        prisma.aPICall.count({
          where: {
            user_id: userId,
            created_at: {
              gte: new Date(Date.now() - 60 * 60 * 1000)
            }
          }
        }),
        
        // Active sessions
        prisma.session.count({
          where: {
            user_id: userId,
            expires: { gt: new Date() }
          }
        })
      ])

      const usage: ResourceUsage = {
        workspaceCount: workspaces,
        fileCount: files._count,
        totalStorageBytes: files._sum.size || 0,
        vectorChunkCount: vectorChunks,
        apiCallsThisHour: apiCalls,
        activeSessions: sessions
      }

      this.usageCache.set(userId, { usage, timestamp: Date.now() })
      return usage
    } catch (error) {
      console.error('Error fetching resource usage:', error)
      throw new Error('Failed to get resource usage')
    }
  }

  /**
   * Check if user can perform action within quotas
   */
  async checkQuota(
    userId: number, 
    action: 'create_workspace' | 'upload_file' | 'api_call' | 'create_session',
    size?: number
  ): Promise<{ allowed: boolean; reason?: string; usage: ResourceUsage; quotas: UserQuotas }> {
    const [quotas, usage] = await Promise.all([
      this.getUserQuotas(userId),
      this.getResourceUsage(userId)
    ])

    let allowed = true
    let reason: string | undefined

    switch (action) {
      case 'create_workspace':
        if (usage.workspaceCount >= quotas.maxWorkspaces) {
          allowed = false
          reason = `Workspace limit reached (${quotas.maxWorkspaces})`
        }
        break

      case 'upload_file':
        if (!size) {
          allowed = false
          reason = 'File size required'
        } else if (size > quotas.maxFileSize) {
          allowed = false
          reason = `File too large (max ${quotas.maxFileSize / 1024 / 1024}MB)`
        } else if (usage.totalStorageBytes + size > quotas.maxStorageBytes) {
          allowed = false
          reason = `Storage quota exceeded (max ${quotas.maxStorageBytes / 1024 / 1024}MB)`
        }
        break

      case 'api_call':
        if (usage.apiCallsThisHour >= quotas.maxAPICallsPerHour) {
          allowed = false
          reason = `API rate limit exceeded (${quotas.maxAPICallsPerHour}/hour)`
        }
        break

      case 'create_session':
        if (usage.activeSessions >= quotas.maxConcurrentSessions) {
          allowed = false
          reason = `Too many active sessions (max ${quotas.maxConcurrentSessions})`
        }
        break
    }

    // Track quota checks
    monitoring.trackUserAction('quota_check', {
      action,
      allowed: allowed.toString(),
      reason: reason || 'within_limits',
      userId: userId.toString()
    })

    return { allowed, reason, usage, quotas }
  }

  /**
   * Record API call for rate limiting
   */
  async recordAPICall(userId: number, endpoint: string, tokensUsed?: number): Promise<void> {
    try {
      await prisma.aPICall.create({
        data: {
          user_id: userId,
          endpoint,
          tokens_used: tokensUsed || 0,
          created_at: new Date()
        }
      })

      // Invalidate usage cache
      this.usageCache.delete(userId)
    } catch (error) {
      console.error('Error recording API call:', error)
    }
  }

  /**
   * Clean up old API call records
   */
  async cleanupOldRecords(): Promise<void> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      
      await prisma.aPICall.deleteMany({
        where: { created_at: { lt: oneDayAgo } }
      })

      console.log('Cleaned up old API call records')
    } catch (error) {
      console.error('Error cleaning up API records:', error)
    }
  }

  /**
   * Get namespace for user resources
   */
  getUserNamespace(userId: number): string {
    return `user-${userId}`
  }

  /**
   * Get workspace namespace
   */
  getWorkspaceNamespace(userId: number, workspaceId: string): string {
    return `${this.getUserNamespace(userId)}-ws-${workspaceId}`
  }

  /**
   * Get usage statistics for admin dashboard
   */
  async getGlobalUsageStats(): Promise<{
    totalUsers: number
    totalWorkspaces: number
    totalFiles: number
    totalStorageGB: number
    totalVectorChunks: number
    averageFilesPerUser: number
  }> {
    try {
      const [userCount, workspaceCount, fileStats, vectorChunkCount] = await Promise.all([
        prisma.user.count(),
        prisma.workspace.count(),
        prisma.file.aggregate({
          _count: true,
          _sum: { size: true }
        }),
        prisma.rAGChunk.count()
      ])

      return {
        totalUsers: userCount,
        totalWorkspaces: workspaceCount,
        totalFiles: fileStats._count,
        totalStorageGB: (fileStats._sum.size || 0) / (1024 * 1024 * 1024),
        totalVectorChunks: vectorChunkCount,
        averageFilesPerUser: userCount > 0 ? fileStats._count / userCount : 0
      }
    } catch (error) {
      console.error('Error getting global usage stats:', error)
      throw error
    }
  }
}

export const resourceManager = ResourceManager.getInstance()

// Schedule cleanup job
if (typeof window === 'undefined') {
  setInterval(() => {
    resourceManager.cleanupOldRecords().catch(console.error)
  }, 60 * 60 * 1000) // Every hour
}