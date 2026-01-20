import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from './auth'
import {
  createErrorResponse as createStandardErrorResponse,
} from './utils/api-response'

export {
  createSuccessResponse,
  createErrorResponse,
  createErrorResponseFromError,
  createHealthResponse,
  getErrorMessage,
  getTimestamp,
  generateTraceId,
  createProblemResponse,
  createValidationErrorResponse,
  ApiErrors,
} from './utils/api-response'

type SessionUser = {
  id: string
  email: string
  name: string
  role: string
}

export async function requireAuth(_request: Request): Promise<{ session: { user: SessionUser } } | NextResponse> {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return createStandardErrorResponse('Authentication required', 401, {
      code: 'AUTHENTICATION_REQUIRED',
      detail: 'Authentication required to access this resource.',
    })
  }

  return { session: { user: session.user as SessionUser } }
}

export async function requireRole(role: string, request: Request): Promise<{ session: { user: SessionUser } } | NextResponse> {
  const authResult = await requireAuth(request)

  if (authResult instanceof NextResponse) {
    return authResult
  }

  if (authResult.session.user.role !== role) {
    return createStandardErrorResponse('Insufficient permissions', 403, {
      code: 'INSUFFICIENT_PERMISSIONS',
      detail: `Required role: ${role}`,
    })
  }

  return authResult
}
