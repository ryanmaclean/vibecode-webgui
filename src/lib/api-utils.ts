import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from './auth'

type SessionUser = {
  id: string
  email: string
  name: string
  role: string
}

export async function requireAuth(_request: Request): Promise<{ session: { user: SessionUser } } | NextResponse> {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  return { session: { user: session.user as SessionUser } }
}

export async function requireRole(role: string, request: Request): Promise<{ session: { user: SessionUser } } | NextResponse> {
  const authResult = await requireAuth(request)

  if (authResult instanceof NextResponse) {
    return authResult
  }

  if (authResult.session.user.role !== role) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    )
  }

  return authResult
}

/**
 * Standard API response utilities to eliminate duplication across routes
 */

/**
 * Creates a standardized error message from an unknown error type
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

/**
 * Creates a standardized timestamp string
 */
export function getTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Creates a standardized success response with timestamp
 */
export function createSuccessResponse<T>(
  data: T,
  additionalFields?: Record<string, unknown>
) {
  return NextResponse.json({
    ...data,
    timestamp: getTimestamp(),
    ...additionalFields,
  })
}

/**
 * Creates a standardized error response with timestamp and proper status code
 */
export function createErrorResponse(
  message: string,
  statusCode: number = 500,
  additionalFields?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      error: message,
      timestamp: getTimestamp(),
      ...additionalFields,
    },
    { status: statusCode }
  )
}

/**
 * Creates a standardized error response from an unknown error
 */
export function createErrorResponseFromError(
  error: unknown,
  statusCode: number = 500,
  fallbackMessage: string = 'An error occurred'
) {
  return createErrorResponse(getErrorMessage(error), statusCode, {
    details: fallbackMessage,
  })
}

/**
 * Creates a standardized health check response
 */
export function createHealthResponse(
  status: 'healthy' | 'unhealthy' | 'ready' | 'not ready' | 'error',
  additionalData?: Record<string, unknown>
) {
  return NextResponse.json({
    status,
    timestamp: getTimestamp(),
    ...additionalData,
  })
}
