/**
 * Quota Enforcement Middleware
 * Protects API endpoints from resource exhaustion
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { resourceManager } from '@/lib/resource-management'

interface QuotaCheckResult {
  allowed: boolean
  reason?: string
  remainingQuota?: number
  resetTime?: number
}

export async function withQuotaCheck(
  request: NextRequest,
  action: 'create_workspace' | 'upload_file' | 'api_call' | 'create_session',
  options: { fileSize?: number } = {}
): Promise<QuotaCheckResult> {
  try {
    // Get user session
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { allowed: false, reason: 'Authentication required' }
    }

    const userId = parseInt(session.user.id)
    
    // Check quota
    const result = await resourceManager.checkQuota(userId, action, options.fileSize)
    
    if (!result.allowed) {
      // Log quota violation
      console.warn(`Quota exceeded for user ${userId}: ${result.reason}`)
      
      return {
        allowed: false,
        reason: result.reason,
        remainingQuota: getRemainingQuota(result.quotas, result.usage, action),
        resetTime: getResetTime(action)
      }
    }

    // Record API call if applicable
    if (action === 'api_call') {
      const endpoint = new URL(request.url).pathname
      await resourceManager.recordAPICall(userId, endpoint)
    }

    return { allowed: true }

  } catch (error) {
    console.error('Quota check error:', error)
    return { allowed: false, reason: 'Internal server error' }
  }
}

function getRemainingQuota(quotas: any, usage: any, action: string): number {
  switch (action) {
    case 'create_workspace':
      return quotas.maxWorkspaces - usage.workspaceCount
    case 'api_call':
      return quotas.maxAPICallsPerHour - usage.apiCallsThisHour
    case 'create_session':
      return quotas.maxConcurrentSessions - usage.activeSessions
    default:
      return 0
  }
}

function getResetTime(action: string): number {
  switch (action) {
    case 'api_call':
      // Reset at top of next hour
      const now = new Date()
      const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0)
      return nextHour.getTime()
    default:
      return Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  }
}

/**
 * Quota response helper
 */
export function createQuotaResponse(result: QuotaCheckResult): NextResponse {
  return NextResponse.json(
    {
      error: 'Quota exceeded',
      message: result.reason,
      remaining: result.remainingQuota,
      resetTime: result.resetTime,
      code: 'QUOTA_EXCEEDED'
    },
    { 
      status: 429,
      headers: {
        'X-RateLimit-Remaining': result.remainingQuota?.toString() || '0',
        'X-RateLimit-Reset': result.resetTime?.toString() || '0',
        'Retry-After': '3600' // 1 hour
      }
    }
  )
}