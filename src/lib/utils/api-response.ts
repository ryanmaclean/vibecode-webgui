import { NextResponse } from 'next/server'
// import { logger } from '@/lib/logger'

/**
 * Standard API response utilities implementing RFC 7807 Problem Details
 * Eliminates duplication across routes and ensures consistent error format
 */

/**
 * RFC 7807 Problem Details interface
 */
export interface ProblemDetails {
  type?: string
  title: string
  status: number
  detail?: string
  instance?: string
  timestamp: string
  traceId?: string
}

/**
 * Standard success response interface
 */
export interface SuccessResponse<T = unknown> {
  data: T
  timestamp: string
  status: 'success'
  traceId?: string
}

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
 * Generates a trace ID for request tracking
 */
export function generateTraceId(): string {
  return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Creates a standardized success response following RFC 7807 pattern
 */
export function createSuccessResponse<T>(
  data: T,
  options?: {
    status?: number
    traceId?: string
    additionalFields?: Record<string, unknown>
  }
): NextResponse {
  const response: SuccessResponse<T> = {
    data,
    status: 'success',
    timestamp: getTimestamp(),
    traceId: options?.traceId || generateTraceId(),
    ...options?.additionalFields,
  }

  console.info('API success response', {
    traceId: response.traceId,
    status: options?.status || 200,
  })

  return NextResponse.json(response, { status: options?.status || 200 })
}

/**
 * Creates RFC 7807 compliant error response
 */
export function createProblemResponse(
  options: {
    title: string
    status: number
    type?: string
    detail?: string
    instance?: string
    traceId?: string
  }
): NextResponse {
  const problem: ProblemDetails = {
    type: options.type || `https://httpstatuses.com/${options.status}`,
    title: options.title,
    status: options.status,
    detail: options.detail,
    instance: options.instance,
    timestamp: getTimestamp(),
    traceId: options.traceId || generateTraceId(),
  }

  console.error('API error response', {
    traceId: problem.traceId,
    status: problem.status,
    title: problem.title,
    detail: problem.detail,
  })

  return NextResponse.json(problem, { 
    status: options.status,
    headers: {
      'Content-Type': 'application/problem+json'
    }
  })
}

/**
 * Creates a standardized error response (legacy compatibility)
 */
export function createErrorResponse(
  message: string,
  statusCode: number = 500,
  additionalFields?: Record<string, unknown>
): NextResponse {
  return createProblemResponse({
    title: message,
    status: statusCode,
    detail: additionalFields?.details as string,
    traceId: additionalFields?.traceId as string,
  })
}

/**
 * Creates a standardized error response from an unknown error
 */
export function createErrorResponseFromError(
  error: unknown,
  statusCode: number = 500,
  fallbackMessage: string = 'An error occurred',
  traceId?: string
): NextResponse {
  const errorMessage = getErrorMessage(error)
  
  return createProblemResponse({
    title: fallbackMessage,
    status: statusCode,
    detail: errorMessage,
    traceId,
  })
}

/**
 * Creates a standardized health check response
 */
export function createHealthResponse(
  status: 'healthy' | 'unhealthy' | 'ready' | 'not ready' | 'error',
  additionalData?: Record<string, unknown>
): NextResponse {
  const httpStatus = status === 'healthy' || status === 'ready' ? 200 : 503
  
  return createSuccessResponse(
    { status, ...additionalData },
    { status: httpStatus }
  )
}

/**
 * Common HTTP status code utilities with RFC 7807 integration
 */
export const ApiErrors = {
  badRequest: (detail?: string, traceId?: string): NextResponse =>
    createProblemResponse({
      title: 'Bad Request',
      status: 400,
      detail,
      traceId,
    }),

  unauthorized: (detail?: string, traceId?: string): NextResponse =>
    createProblemResponse({
      title: 'Unauthorized',
      status: 401,
      detail,
      traceId,
    }),

  forbidden: (detail?: string, traceId?: string): NextResponse =>
    createProblemResponse({
      title: 'Forbidden',
      status: 403,
      detail,
      traceId,
    }),

  notFound: (detail?: string, traceId?: string): NextResponse =>
    createProblemResponse({
      title: 'Not Found',
      status: 404,
      detail,
      traceId,
    }),

  methodNotAllowed: (allowedMethods: string[], traceId?: string): NextResponse =>
    createProblemResponse({
      title: 'Method Not Allowed',
      status: 405,
      detail: `Allowed methods: ${allowedMethods.join(', ')}`,
      traceId,
    }),

  conflict: (detail?: string, traceId?: string): NextResponse =>
    createProblemResponse({
      title: 'Conflict',
      status: 409,
      detail,
      traceId,
    }),

  unprocessableEntity: (detail?: string, traceId?: string): NextResponse =>
    createProblemResponse({
      title: 'Unprocessable Entity',
      status: 422,
      detail,
      traceId,
    }),

  tooManyRequests: (detail?: string, traceId?: string): NextResponse =>
    createProblemResponse({
      title: 'Too Many Requests',
      status: 429,
      detail,
      traceId,
    }),

  internalServerError: (detail?: string, traceId?: string): NextResponse =>
    createProblemResponse({
      title: 'Internal Server Error',
      status: 500,
      detail,
      traceId,
    }),

  serviceUnavailable: (detail?: string, traceId?: string): NextResponse =>
    createProblemResponse({
      title: 'Service Unavailable',
      status: 503,
      detail,
      traceId,
    }),
}

/**
 * Validation error helper
 */
export function createValidationErrorResponse(
  errors: Array<{ field: string; message: string }>,
  traceId?: string
): NextResponse {
  return createProblemResponse({
    title: 'Validation Failed',
    status: 422,
    detail: 'One or more fields failed validation',
    type: 'https://example.com/probs/validation-error',
    traceId,
    // Add validation errors as extension
    ...{ errors },
  })
}
