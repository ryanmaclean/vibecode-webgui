/**
 * API Error Handler
 * 
 * Centralized error handling for API routes with consistent error responses,
 * logging, and error categorization.
 */

import { NextResponse } from 'next/server';

export enum ApiErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
}

export interface ApiErrorResponse {
  error: string;
  code: ApiErrorCode;
  timestamp: string;
  requestId?: string;
  details?: any;
  retryAfter?: number;
}

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  endpoint: string;
  method: string;
}

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public statusCode: number = 500,
    public details?: any,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Log error with context
 */
export function logError(error: Error | ApiError, context: ErrorContext): void {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error instanceof ApiError ? error.code : undefined,
      statusCode: error instanceof ApiError ? error.statusCode : 500,
      details: error instanceof ApiError ? error.details : undefined,
    },
    context,
  };

  console.error(`[API Error] ${context.endpoint}:`, JSON.stringify(errorInfo, null, 2));
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  error: Error | ApiError,
  context: ErrorContext
): NextResponse<ApiErrorResponse> {
  // Log the error
  logError(error, context);

  if (error instanceof ApiError) {
    const response: ApiErrorResponse = {
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
      requestId: context.requestId,
      details: error.details,
      retryAfter: error.retryAfter,
    };

    return NextResponse.json(response, { status: error.statusCode });
  }

  // Handle unknown errors
  const response: ApiErrorResponse = {
    error: 'Internal server error',
    code: ApiErrorCode.INTERNAL_SERVER_ERROR,
    timestamp: new Date().toISOString(),
    requestId: context.requestId,
    details: process.env.NODE_ENV === 'development' ? error.message : undefined,
  };

  return NextResponse.json(response, { status: 500 });
}

/**
 * Timeout wrapper for async operations
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string = 'Operation'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new ApiError(
          ApiErrorCode.TIMEOUT_ERROR,
          `${operation} timed out after ${timeoutMs}ms`,
          408
        )),
        timeoutMs
      )
    ),
  ]);
}

/**
 * Categorize errors from external services
 */
export function categorizeExternalError(error: any): ApiError {
  if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
    return new ApiError(
      ApiErrorCode.TIMEOUT_ERROR,
      'Request timed out',
      408
    );
  }

  if (error.response?.status === 429) {
    return new ApiError(
      ApiErrorCode.RATE_LIMIT_EXCEEDED,
      'AI service rate limit exceeded',
      429,
      undefined,
      60 // Default retry after 60 seconds
    );
  }

  if (error.response?.status >= 400 && error.response?.status < 500) {
    return new ApiError(
      ApiErrorCode.AI_SERVICE_ERROR,
      error.message || 'AI service client error',
      502,
      { originalStatus: error.response.status }
    );
  }

  if (error.response?.status >= 500) {
    return new ApiError(
      ApiErrorCode.AI_SERVICE_ERROR,
      'AI service temporarily unavailable',
      503,
      { originalStatus: error.response.status }
    );
  }

  return new ApiError(
    ApiErrorCode.AI_SERVICE_ERROR,
    error.message || 'AI service error',
    502
  );
}

/**
 * Generate unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}