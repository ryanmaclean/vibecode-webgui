import { NextResponse } from 'next/server'

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
