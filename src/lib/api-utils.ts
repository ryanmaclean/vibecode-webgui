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
 * RFC 7807 Problem Details for HTTP APIs
 * Creates a standardized error response following the RFC 7807 specification
 */
export interface ProblemDetails {
  type?: string
  title: string
  status: number
  detail?: string
  instance?: string
  timestamp: string
  traceId?: string
  [key: string]: unknown
}

/**
 * Creates a standardized error response following RFC 7807 Problem Details format
 */
export function createErrorResponse(
  title: string,
  status: number = 500,
  options?: {
    type?: string
    detail?: string
    instance?: string
    traceId?: string
    additionalFields?: Record<string, unknown>
  }
): NextResponse {
  const problemDetails: ProblemDetails = {
    type: options?.type || `https://vibecode.dev/errors/${status}`,
    title,
    status,
    detail: options?.detail,
    instance: options?.instance,
    timestamp: getTimestamp(),
    traceId: options?.traceId,
    ...options?.additionalFields,
  }

  // Remove undefined fields to keep response clean
  Object.keys(problemDetails).forEach(key => {
    if (problemDetails[key] === undefined) {
      delete problemDetails[key]
    }
  })

  return NextResponse.json(problemDetails, { 
    status,
    headers: {
      'Content-Type': 'application/problem+json'
    }
  })
}

/**
 * Creates a standardized error response from an unknown error
 * @deprecated Use createProblemDetailsFromError instead
 */
export function createErrorResponseFromError(
  error: unknown,
  statusCode: number = 500,
  fallbackMessage: string = 'An error occurred'
) {
  return createErrorResponse(getErrorMessage(error), statusCode, {
    detail: fallbackMessage,
  })
}

/**
 * Creates a RFC 7807 compliant error response from an unknown error
 */
export function createProblemDetailsFromError(
  error: unknown,
  status: number = 500,
  options?: {
    type?: string
    instance?: string
    traceId?: string
    fallbackTitle?: string
  }
): NextResponse {
  const errorMessage = getErrorMessage(error)
  const title = options?.fallbackTitle || getStatusText(status)
  
  return createErrorResponse(title, status, {
    type: options?.type,
    detail: errorMessage,
    instance: options?.instance,
    traceId: options?.traceId,
    error: error instanceof Error ? {
      name: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    } : undefined
  })
}

/**
 * Gets HTTP status text for common status codes
 */
export function getStatusText(status: number): string {
  const statusTexts: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    408: 'Request Timeout',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
    507: 'Insufficient Storage'
  }
  
  return statusTexts[status] || 'Unknown Error'
}

/**
 * Common error response helpers
 */
export const ErrorResponses = {
  badRequest: (detail?: string, traceId?: string) => 
    createErrorResponse('Bad Request', 400, { detail, traceId }),
    
  unauthorized: (detail?: string, traceId?: string) => 
    createErrorResponse('Unauthorized', 401, { detail, traceId }),
    
  forbidden: (detail?: string, traceId?: string) => 
    createErrorResponse('Forbidden', 403, { detail, traceId }),
    
  notFound: (detail?: string, traceId?: string) => 
    createErrorResponse('Not Found', 404, { detail, traceId }),
    
  methodNotAllowed: (detail?: string, traceId?: string) => 
    createErrorResponse('Method Not Allowed', 405, { detail, traceId }),
    
  conflict: (detail?: string, traceId?: string) => 
    createErrorResponse('Conflict', 409, { detail, traceId }),
    
  validationError: (detail?: string, errors?: unknown[], traceId?: string) => 
    createErrorResponse('Validation Error', 422, { detail, errors, traceId }),
    
  tooManyRequests: (detail?: string, retryAfter?: number, traceId?: string) => 
    createErrorResponse('Too Many Requests', 429, { detail, retryAfter, traceId }),
    
  internalServerError: (detail?: string, traceId?: string) => 
    createErrorResponse('Internal Server Error', 500, { detail, traceId }),
    
  serviceUnavailable: (detail?: string, traceId?: string) => 
    createErrorResponse('Service Unavailable', 503, { detail, traceId })
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
