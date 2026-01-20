import { NextResponse } from 'next/server'
// import { logger } from '@/lib/logger';

/**
 * Standard API response utilities implementing RFC 7807 Problem Details
 * Adds success/error envelopes with structured codes and metadata
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
  code?: string
  [key: string]: unknown
}

export interface ApiResponseMeta {
  timestamp: string
  traceId: string
  status?: number
  [key: string]: unknown
}

export interface ApiErrorInfo {
  code: string
  message: string
  detail?: string
  type?: string
}

/**
 * Standard success response interface
 */
export interface SuccessResponse<T = unknown> {
  success: true
  data: T
  meta: ApiResponseMeta
  [key: string]: unknown
}

const STATUS_CODE_TO_ERROR_CODE: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'RATE_LIMIT_EXCEEDED',
  500: 'INTERNAL_SERVER_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
  504: 'GATEWAY_TIMEOUT',
}

function formatErrorCode(code?: string, status?: number): string {
  if (code && code.trim().length > 0) {
    return code
      .trim()
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toUpperCase()
  }

  return STATUS_CODE_TO_ERROR_CODE[status ?? 500] || 'INTERNAL_SERVER_ERROR'
}

function createMeta(traceId: string, status?: number, meta?: Record<string, unknown>): ApiResponseMeta {
  return {
    timestamp: getTimestamp(),
    traceId,
    status,
    ...(meta || {}),
  }
}

function buildProblemPayload(
  problem: ProblemDetails,
  meta: ApiResponseMeta,
  extensions?: Record<string, unknown>
) {
  const errorInfo: ApiErrorInfo = {
    code: problem.code || 'INTERNAL_SERVER_ERROR',
    message: problem.detail || problem.title,
    detail: problem.detail,
    type: problem.type,
  }

  return {
    ...problem,
    ...(extensions || {}),
    success: false,
    error: errorInfo,
    meta,
  }
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
    meta?: Record<string, unknown>
    additionalFields?: Record<string, unknown>
  }
): NextResponse {
  const traceId = options?.traceId || generateTraceId()
  const meta = createMeta(traceId, options?.status || 200, options?.meta)

  const response: SuccessResponse<T> = {
    success: true,
    data,
    meta,
    ...(options?.additionalFields || {}),
  }

  console.info('API success response', {
    traceId,
    status: options?.status || 200,
  })

  return NextResponse.json(response, { status: options?.status || 200 })
}

/**
 * Creates RFC 7807 compliant error response with standardized envelope
 */
export function createProblemResponse(
  options: {
    title: string
    status: number
    type?: string
    detail?: string
    instance?: string
    traceId?: string
    code?: string
    headers?: Record<string, string>
    extensions?: Record<string, unknown>
    meta?: Record<string, unknown>
  }
): NextResponse {
  const traceId = options.traceId || generateTraceId()
  const code = formatErrorCode(options.code, options.status)
  const timestamp = getTimestamp()

  const problem: ProblemDetails = {
    type: options.type || `https://httpstatuses.com/${options.status}`,
    title: options.title,
    status: options.status,
    detail: options.detail,
    instance: options.instance,
    timestamp,
    traceId,
    code,
  }

  const meta = {
    ...createMeta(traceId, options.status, options.meta),
  }

  console.error('API error response', {
    traceId,
    status: problem.status,
    code,
    title: problem.title,
    detail: problem.detail,
  })

  return NextResponse.json(buildProblemPayload(problem, meta, options.extensions), {
    status: options.status,
    headers: {
      'Content-Type': 'application/problem+json',
      ...(options.headers || {}),
    },
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
  const extensions = { ...(additionalFields || {}) }
  const detail = (extensions.detail as string) || (extensions.details as string)
  const code = extensions.code as string | undefined

  delete extensions.detail
  delete extensions.details
  delete extensions.code

  return createProblemResponse({
    title: message,
    status: statusCode,
    detail,
    code,
    extensions,
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
      code: 'BAD_REQUEST',
    }),

  unauthorized: (detail?: string, traceId?: string): NextResponse =>
    createProblemResponse({
      title: 'Unauthorized',
      status: 401,
      detail,
      traceId,
      code: 'UNAUTHORIZED',
    }),

  forbidden: (detail?: string, traceId?: string): NextResponse =>
    createProblemResponse({
      title: 'Forbidden',
      status: 403,
      detail,
      traceId,
      code: 'FORBIDDEN',
    }),

  notFound: (detail?: string, traceId?: string): NextResponse =>
    createProblemResponse({
      title: 'Not Found',
      status: 404,
      detail,
      traceId,
      code: 'NOT_FOUND',
    }),

  methodNotAllowed: (allowedMethods: string[], traceId?: string): NextResponse =>
    createProblemResponse({
      title: 'Method Not Allowed',
      status: 405,
      detail: `Allowed methods: ${allowedMethods.join(', ')}`,
      traceId,
      code: 'METHOD_NOT_ALLOWED',
    }),

  conflict: (detail?: string, traceId?: string): NextResponse =>
    createProblemResponse({
      title: 'Conflict',
      status: 409,
      detail,
      traceId,
      code: 'CONFLICT',
    }),

  unprocessableEntity: (detail?: string, traceId?: string): NextResponse =>
    createProblemResponse({
      title: 'Unprocessable Entity',
      status: 422,
      detail,
      traceId,
      code: 'UNPROCESSABLE_ENTITY',
    }),

  tooManyRequests: (detail?: string, traceId?: string): NextResponse =>
    createProblemResponse({
      title: 'Too Many Requests',
      status: 429,
      detail,
      traceId,
      code: 'RATE_LIMIT_EXCEEDED',
    }),

  internalServerError: (detail?: string, traceId?: string): NextResponse =>
    createProblemResponse({
      title: 'Internal Server Error',
      status: 500,
      detail,
      traceId,
      code: 'INTERNAL_SERVER_ERROR',
    }),

  serviceUnavailable: (detail?: string, traceId?: string): NextResponse =>
    createProblemResponse({
      title: 'Service Unavailable',
      status: 503,
      detail,
      traceId,
      code: 'SERVICE_UNAVAILABLE',
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
    code: 'VALIDATION_ERROR',
    extensions: { errors },
  })
}
