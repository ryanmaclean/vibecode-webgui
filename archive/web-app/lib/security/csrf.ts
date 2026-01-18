/**
 * CSRF Protection Implementation
 *
 * Implements the double-submit cookie pattern with HMAC-signed tokens
 * for protecting against Cross-Site Request Forgery attacks.
 *
 * Security features:
 * - Cryptographically secure token generation (256-bit entropy)
 * - HMAC-SHA256 signing to prevent token forgery
 * - Timing-safe comparison to prevent timing attacks
 * - Secure HttpOnly cookies with strict SameSite policy
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHmac, timingSafeEqual } from 'crypto'

/**
 * Configuration for CSRF protection
 */
const CSRF_CONFIG = {
  get SECRET() {
    return process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET || 'development-csrf-secret-change-in-production'
  },
  COOKIE_NAME: '__Secure-csrf-token',
  HEADER_NAME: 'x-csrf-token',
  TOKEN_LENGTH: 32, // 32 bytes = 256 bits
  COOKIE_MAX_AGE: 60 * 60 * 24, // 24 hours in seconds
} as const

/**
 * Validates that CSRF configuration is secure
 * Throws error in production if using default/weak secrets
 */
export function validateCSRFConfig(): void {
  const isProduction = process.env.NODE_ENV === 'production'
  const secret = CSRF_CONFIG.SECRET
  const isDefaultSecret = secret === 'development-csrf-secret-change-in-production'

  if (isProduction && isDefaultSecret) {
    throw new Error(
      'CSRF_SECRET environment variable must be set in production. ' +
      'Generate a secure secret using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }

  if (secret.length < 32) {
    console.warn('CSRF_SECRET should be at least 32 characters for security')
  }
}

/**
 * Generates a cryptographically secure random CSRF token
 * @returns Hex-encoded token string (64 characters for 32 bytes)
 */
function generateCSRFToken(): string {
  return randomBytes(CSRF_CONFIG.TOKEN_LENGTH).toString('hex')
}

/**
 * Signs a CSRF token using HMAC-SHA256
 * @param token - The raw token to sign
 * @returns HMAC signature as hex string
 */
function signCSRFToken(token: string): string {
  return createHmac('sha256', CSRF_CONFIG.SECRET)
    .update(token)
    .digest('hex')
}

/**
 * Verifies a CSRF token signature
 * @param token - The raw token
 * @param signature - The signature to verify
 * @returns true if signature is valid
 */
function verifyCSRFToken(token: string, signature: string): boolean {
  const expectedSignature = signCSRFToken(token)

  // Timing-safe comparison to prevent timing attacks
  try {
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  } catch {
    // Buffers have different lengths - not equal
    return false
  }
}

/**
 * Generates a CSRF token and returns it in a response with a signed cookie
 *
 * Response format:
 * - JSON body: { csrfToken: string, expires: number }
 * - Set-Cookie header: Signed token in HttpOnly, Secure, SameSite=Strict cookie
 *
 * @param req - The incoming request
 * @returns NextResponse with CSRF token and cookie
 */
export function getCSRFToken(req: NextRequest): NextResponse {
  const token = generateCSRFToken()
  const signature = signCSRFToken(token)
  const signedToken = `${token}.${signature}`

  const expires = Date.now() + (CSRF_CONFIG.COOKIE_MAX_AGE * 1000)

  const response = NextResponse.json({
    csrfToken: token,
    expires,
  })

  // Set secure cookie with signed token
  response.cookies.set(CSRF_CONFIG.COOKIE_NAME, signedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: CSRF_CONFIG.COOKIE_MAX_AGE,
  })

  return response
}

/**
 * Verifies CSRF token from request headers and cookies
 *
 * Validation process:
 * 1. Extract token from x-csrf-token header
 * 2. Extract signed token from cookie
 * 3. Parse cookie into token and signature
 * 4. Verify HMAC signature
 * 5. Compare header token with cookie token using timing-safe comparison
 *
 * @param req - The incoming request to validate
 * @returns true if CSRF token is valid
 */
export function verifyCSRFTokenFromRequest(req: NextRequest): boolean {
  const headerToken = req.headers.get(CSRF_CONFIG.HEADER_NAME)
  const cookieToken = req.cookies.get(CSRF_CONFIG.COOKIE_NAME)?.value

  if (!headerToken || !cookieToken) {
    return false
  }

  // Parse signed cookie: "token.signature"
  const parts = cookieToken.split('.')
  if (parts.length !== 2) {
    return false
  }

  const [token, signature] = parts
  if (!token || !signature) {
    return false
  }

  // Verify HMAC signature
  if (!verifyCSRFToken(token, signature)) {
    return false
  }

  // Compare header token with cookie token using timing-safe comparison
  try {
    return timingSafeEqual(
      Buffer.from(token, 'hex'),
      Buffer.from(headerToken, 'hex')
    )
  } catch {
    // Buffers have different lengths - not equal
    return false
  }
}

/**
 * Higher-order function to wrap API route handlers with CSRF protection
 *
 * Only applies to state-changing methods (POST, PUT, DELETE, PATCH)
 * Safe methods (GET, HEAD, OPTIONS) bypass CSRF validation
 *
 * Usage:
 * ```typescript
 * export const POST = withCSRFProtection(async (req) => {
 *   // Your handler logic
 *   return NextResponse.json({ success: true })
 * })
 * ```
 *
 * @param handler - The route handler to protect
 * @returns Wrapped handler with CSRF validation
 */
export function withCSRFProtection(
  handler: (req: NextRequest, ...args: unknown[]) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: unknown[]): Promise<NextResponse> => {
    const method = req.method.toUpperCase()

    // Skip CSRF validation for safe methods
    const safeMethods = ['GET', 'HEAD', 'OPTIONS']
    if (safeMethods.includes(method)) {
      return handler(req, ...args)
    }

    // Validate CSRF token for state-changing methods
    if (!verifyCSRFTokenFromRequest(req)) {
      return NextResponse.json(
        {
          error: 'CSRF token validation failed',
          message: 'Invalid or missing CSRF token. Please refresh and try again.',
          type: 'https://vibecode.dev/errors/csrf-validation-failed',
        },
        {
          status: 403,
          headers: {
            'Content-Type': 'application/problem+json',
          },
        }
      )
    }

    // Token is valid, proceed with handler
    return handler(req, ...args)
  }
}

/**
 * Manual CSRF validation for custom scenarios
 *
 * Use this when you need fine-grained control over when CSRF validation occurs
 * or want to handle validation failures differently than the default middleware.
 *
 * @param req - The request to validate
 * @returns Object with validation result and optional error response
 */
export function validateCSRF(req: NextRequest): {
  valid: boolean
  errorResponse?: NextResponse
} {
  if (verifyCSRFTokenFromRequest(req)) {
    return { valid: true }
  }

  return {
    valid: false,
    errorResponse: NextResponse.json(
      {
        error: 'CSRF token validation failed',
        message: 'Invalid or missing CSRF token',
      },
      { status: 403 }
    ),
  }
}
