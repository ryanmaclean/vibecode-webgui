/**
 * Authentication middleware for monitoring endpoints
 * Ensures only authorized users can access sensitive monitoring data
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
// import { logger } from '@/lib/logger';
// Roles that can access monitoring endpoints (for read operations)
const AUTHORIZED_ROLES = ['admin', 'devops', 'lead', 'developer']

// Roles that can access dashboard endpoints (admin only)
const DASHBOARD_ADMIN_ROLES = ['admin']

// API key for programmatic access (from environment)
const MONITORING_API_KEY = process.env.MONITORING_API_KEY

interface AuthResult {
  isAuthorized: boolean
  error?: string
  user?: {
    id: string
    email?: string
    role: string
  }
}

/**
 * Check if request is authorized to access monitoring endpoints
 *
 * @param request - Next.js request object
 * @param requireAdminRole - If true, user must have an admin role (for read operations). If false, any authenticated user is allowed (for write operations)
 * @returns Promise<AuthResult> - Authorization result
 */
export async function checkMonitoringAuth(request?: NextRequest | Request, requireAdminRole: boolean = true): Promise<AuthResult> {
  try {
    // Check for API key authentication first (for programmatic access)
    const apiKey = request && 'headers' in request
      ? request.headers.get('x-api-key')
      : null

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
    const session = await getServerSession()

    if (!session || !session.user) {
      return {
        isAuthorized: false,
        error: 'Unauthorized'
      }
    }

    const user = session.user as { id?: string; role?: string; email?: string }
    const userRole = user.role || 'user'

    // If admin role is required, check if user has an authorized role
    // Otherwise, any authenticated user is allowed
    const isAuthorized = requireAdminRole
      ? AUTHORIZED_ROLES.includes(userRole)
      : true // Any authenticated user

    return {
      isAuthorized,
      user: {
        id: user.id || 'unknown',
        email: user.email,
        role: userRole
      },
      error: isAuthorized ? undefined : 'Insufficient permissions'
    }

  } catch (error) {
    console.error('Authentication error:', error)
    return {
      isAuthorized: false,
      error: 'Unauthorized'
    }
  }
}

/**
 * Check if request is authorized to access dashboard endpoints (admin only)
 *
 * @param request - Next.js request object
 * @returns Promise<AuthResult> - Authorization result
 */
export async function checkDashboardAuth(request?: NextRequest | Request): Promise<AuthResult> {
  try {
    // Check for API key authentication first (for programmatic access)
    const apiKey = request && 'headers' in request
      ? request.headers.get('x-api-key')
      : null

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
    const session = await getServerSession()

    if (!session || !session.user) {
      return {
        isAuthorized: false,
        error: 'Authentication required'
      }
    }

    const user = session.user as { id?: string; role?: string; email?: string }
    const userRole = user.role || 'user'

    // Dashboard endpoints require admin role only
    const isAuthorized = DASHBOARD_ADMIN_ROLES.includes(userRole)

    return {
      isAuthorized,
      user: {
        id: user.id || 'unknown',
        email: user.email,
        role: userRole
      },
      error: isAuthorized ? undefined : 'Admin role required for dashboard access'
    }

  } catch (error) {
    console.error('Dashboard authentication error:', error)
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

/**
 * Get unauthorized response for dashboard endpoints (admin only)
 */
export function getDashboardUnauthorizedResponse(error?: string) {
  return Response.json(
    {
      error: 'Unauthorized access to dashboard',
      message: error || 'Admin authentication required',
      timestamp: new Date().toISOString(),
      required_roles: DASHBOARD_ADMIN_ROLES
    },
    {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Bearer realm="dashboard", charset="UTF-8"'
      }
    }
  )
}
