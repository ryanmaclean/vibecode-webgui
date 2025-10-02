/**
 * JWT Utilities for MCP Server Authentication
 *
 * Provides JWT verification and user context extraction for MCP server
 * authentication. Compatible with NextAuth JWT tokens.
 */

import * as jwt from 'jsonwebtoken'

/**
 * User context extracted from JWT token
 */
export interface UserContext {
  id: string
  email: string
  name: string
  role: string
  githubId?: string
  googleId?: string
}

/**
 * Authentication error with detailed context
 */
export class AuthenticationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

/**
 * Verify JWT token and extract user context
 *
 * @param token - JWT token string
 * @param secret - Secret used to sign the token (defaults to NEXTAUTH_SECRET)
 * @returns User context from token
 * @throws AuthenticationError if token is invalid or missing required fields
 */
export async function verifyJwtToken(
  token: string,
  secret?: string
): Promise<UserContext> {
  const jwtSecret = secret || process.env.NEXTAUTH_SECRET

  if (!jwtSecret) {
    throw new AuthenticationError(
      'JWT secret not configured',
      'JWT_SECRET_MISSING',
      { hint: 'Set NEXTAUTH_SECRET environment variable' }
    )
  }

  if (!token || typeof token !== 'string') {
    throw new AuthenticationError(
      'Authentication token is required',
      'TOKEN_MISSING'
    )
  }

  try {
    // Verify and decode JWT token
    const decoded = jwt.verify(token, jwtSecret) as jwt.JwtPayload

    // Extract user context from token
    const userContext: UserContext = {
      id: decoded.id as string,
      email: decoded.email as string,
      name: decoded.name as string,
      role: decoded.role as string,
      githubId: decoded.githubId as string | undefined,
      googleId: decoded.googleId as string | undefined,
    }

    // Validate required fields
    if (!userContext.id || !userContext.email) {
      throw new AuthenticationError(
        'Invalid token: missing required user fields',
        'TOKEN_INVALID_PAYLOAD',
        { missing: { id: !userContext.id, email: !userContext.email } }
      )
    }

    return userContext
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error
    }

    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError(
        'Authentication token has expired',
        'TOKEN_EXPIRED',
        { expiredAt: error.expiredAt }
      )
    }

    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError(
        'Invalid authentication token',
        'TOKEN_INVALID',
        { reason: error.message }
      )
    }

    throw new AuthenticationError(
      'Token verification failed',
      'TOKEN_VERIFICATION_FAILED',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )
  }
}

/**
 * Extract token from multiple sources (environment, parameters)
 *
 * Priority order:
 * 1. VIBECODE_TOKEN environment variable
 * 2. token parameter in request
 * 3. authToken parameter in request
 *
 * @param params - Request parameters that may contain token
 * @returns Token string or null if not found
 */
export function extractToken(params?: Record<string, unknown>): string | null {
  // Check environment variable first (primary method for stdio transport)
  const envToken = process.env.VIBECODE_TOKEN
  if (envToken && typeof envToken === 'string' && envToken.trim()) {
    return envToken.trim()
  }

  // Check request parameters as fallback
  if (params) {
    const token = params.token || params.authToken
    if (token && typeof token === 'string' && token.trim()) {
      return token.trim()
    }
  }

  return null
}

/**
 * Authenticate request and return user context
 *
 * Combines token extraction and verification into a single operation.
 *
 * @param params - Request parameters that may contain token
 * @returns User context if authentication succeeds
 * @throws AuthenticationError if authentication fails
 */
export async function authenticateRequest(
  params?: Record<string, unknown>
): Promise<UserContext> {
  const token = extractToken(params)

  if (!token) {
    throw new AuthenticationError(
      'Authentication required: No token provided. Set VIBECODE_TOKEN environment variable or include token in request.',
      'AUTH_REQUIRED',
      {
        hint: 'export VIBECODE_TOKEN=<your-jwt-token>',
        sources: ['VIBECODE_TOKEN env var', 'token parameter', 'authToken parameter'],
      }
    )
  }

  return verifyJwtToken(token)
}
