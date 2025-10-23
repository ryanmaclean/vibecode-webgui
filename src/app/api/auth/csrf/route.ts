/**
 * CSRF Token Endpoint
 * 
 * Provides CSRF tokens for client-side requests
 * Implements secure token generation and cookie management
 */

import { NextRequest } from 'next/server'
import { getCSRFToken, validateCSRFConfig } from '@/lib/security/csrf'
import { withRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'

// Validate CSRF configuration on module load
validateCSRFConfig()

/**
 * GET /api/auth/csrf
 * 
 * Returns a CSRF token for client-side use
 * Sets secure HttpOnly cookie with signed token
 */
async function handleGetCSRFToken(req: NextRequest) {
  return getCSRFToken(req)
}

// Apply rate limiting to CSRF endpoint
export const GET = withRateLimit(RATE_LIMITS.AUTH, 'csrf')(handleGetCSRFToken)