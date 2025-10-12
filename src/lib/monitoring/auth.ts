/**
 * Authentication middleware for monitoring endpoints
 * Ensures only authorized users can access sensitive monitoring data
 */

import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { logger } from '@/lib/logger';
// Roles that can access monitoring endpoints
const AUTHORIZED_ROLES = ['admin', 'devops', 'lead', 'developer']

// API key for programmatic access (from environment)
const MONITORING_API_KEY = process.env.MONITORING_API_KEY

interface AuthResult {
  isAuthorized: boolean
  error?: string
  user?: {
    id: string
    email: string
    role: string
  }
}

/**
 * Check if request is authorized to access monitoring endpoints
 * 
 * @param request - Next.js request object
 * @returns Promise<AuthResult> - Authorization result
 */
export async function checkMonitoringAuth(request: NextRequest): Promise<AuthResult> {
  try {
    // Check for API key authentication first (for programmatic access)
    const apiKey = request.headers.get('x-api-key') || request.nextUrl.searchParams.get('api_key')
    
    if (apiKey && MONITORING_API_KEY && apiKey === MONITORING_API_KEY) {
      return {
        isAuthorized: true,
        user: {
          id: 'api-user',
          email: 'api@system',
          role: 'admin'
        }
      }
    }

    // Check for session-based authentication
    const token = await getToken({ 
      req: request,
      secret: process.env.NEXTAUTH_SECRET 
    })

    if (!token) {
      return {
        isAuthorized: false,
        error: 'No authentication token found'
      }
    }

    if (!token.role || !AUTHORIZED_ROLES.includes(token.role)) {
      return {
        isAuthorized: false,
        error: `Insufficient permissions. Required roles: ${AUTHORIZED_ROLES.join(', ')}`
      }
    }

    return {
      isAuthorized: true,
      user: {
        id: token.id as string,
        email: token.email as string,
        role: token.role
      }
    }

  } catch (error) {
    logger.error('Authentication error:', error)
    return {
      isAuthorized: false,
      error: 'Authentication failed'
    }
  }
}

/**
 * Get unauthorized response for monitoring endpoints
 */
export function getUnauthorizedResponse(error?: string) {
  return Response.json(
    {
      error: 'Unauthorized access to monitoring endpoint',
      message: error || 'Authentication required',
      timestamp: new Date().toISOString(),
      required_roles: AUTHORIZED_ROLES
    },
    { 
      status: 401,
      headers: {
        'WWW-Authenticate': 'Bearer realm="monitoring", charset="UTF-8"'
      }
    }
  )
}