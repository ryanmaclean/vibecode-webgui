/**
 * Next.js API Error Tracking Middleware
 * 
 * This middleware provides automatic error tracking for Next.js API routes
 * using Datadog Error Tracking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { trackApiError, trackError } from '../lib/monitoring/error-tracking';
import { logger } from '@/lib/logger';
export interface ErrorTrackingMiddlewareOptions {
  /**
   * Whether to track successful requests (for performance monitoring)
   */
  trackSuccess?: boolean;
  
  /**
   * Whether to track request/response details
   */
  trackDetails?: boolean;
  
  /**
   * Custom error handler
   */
  onError?: (error: Error, request: NextRequest) => void;
  
  /**
   * Whether to include request body in error context
   */
  includeRequestBody?: boolean;
  
  /**
   * Maximum body size to include in tracking (bytes)
   */
  maxBodySize?: number;
}

/**
 * Wrap API route handlers with error tracking
 */
export function withErrorTracking<R extends Response = NextResponse>(
  handler: (request: NextRequest, context?: any) => Promise<R>,
  options: ErrorTrackingMiddlewareOptions = {}
) {
  const {
    trackSuccess = false,
    trackDetails = true,
    onError,
    includeRequestBody = false,
    maxBodySize = 1024 * 10 // 10KB default
  } = options;

  return async (request: NextRequest, context?: any): Promise<R> => {
    const startTime = Date.now();
    let requestBody: any = null;

    try {
      // Extract request details for tracking
      const requestDetails = {
        method: request.method,
        url: request.url,
        pathname: new URL(request.url).pathname,
        userAgent: request.headers.get('user-agent') || undefined,
        ip: request.headers.get('x-forwarded-for') || 
            request.headers.get('x-real-ip') || 
            'unknown',
        referer: request.headers.get('referer') || undefined,
        contentType: request.headers.get('content-type') || undefined
      };

      // Optionally capture request body
      if (includeRequestBody && request.method !== 'GET') {
        try {
          const body = await request.text();
          if (body.length <= maxBodySize) {
            requestBody = body;
          }
        } catch (bodyError) {
          logger.warn('Failed to read request body for error tracking:', bodyError);
        }
      }

      // Execute the handler
      const response = await handler(request, context);
      
      const duration = Date.now() - startTime;

      // Track successful requests if enabled
      if (trackSuccess && trackDetails) {
        logger.info(`✅ API Success: ${requestDetails.method} ${requestDetails.pathname} - ${response.status} (${duration}ms)`);
      }

      return response;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorDetails = {
        method: request.method,
        url: request.url,
        pathname: new URL(request.url).pathname,
        userAgent: request.headers.get('user-agent') || undefined,
        ip: request.headers.get('x-forwarded-for') || 
            request.headers.get('x-real-ip') || 
            'unknown',
        referer: request.headers.get('referer') || undefined,
        duration,
        ...(requestBody && { requestBody })
      };

      // Track the API error
      trackApiError(
        new URL(request.url).pathname,
        500, // Default status for unhandled errors
        error as Error,
        errorDetails
      );

      // Call custom error handler if provided
      if (onError) {
        try {
          onError(error as Error, request);
        } catch (handlerError) {
          logger.error('Error in custom error handler:', handlerError);
        }
      }

      // Re-throw the error to maintain normal error handling
      throw error;
    }
  };
}

/**
 * Error tracking wrapper for API routes that return JSON
 */
export function withJsonErrorTracking<T = any>(
  handler: (request: NextRequest, context?: any) => Promise<T>,
  options: ErrorTrackingMiddlewareOptions = {}
) {
  return withErrorTracking(async (request: NextRequest, context?: any) => {
    try {
      const result = await handler(request, context);
      return NextResponse.json(result);
    } catch (error) {
      // Track the error before returning error response
      trackApiError(
        new URL(request.url).pathname,
        500,
        error as Error,
        {
          method: request.method,
          url: request.url,
          userAgent: request.headers.get('user-agent') || undefined
        }
      );

      return NextResponse.json(
        { 
          error: 'Internal Server Error',
          message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Something went wrong'
        },
        { status: 500 }
      );
    }
  }, options);
}

/**
 * Error tracking wrapper for API routes that handle specific HTTP methods
 */
export function withMethodErrorTracking<T = any>(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse<T>>,
  allowedMethods: string[] = ['GET'],
  options: ErrorTrackingMiddlewareOptions = {}
) {
  return withErrorTracking(async (request: NextRequest, context?: any) => {
    if (!allowedMethods.includes(request.method)) {
      const error = new Error(`Method ${request.method} not allowed`);
      trackApiError(
        new URL(request.url).pathname,
        405,
        error,
        {
          method: request.method,
          allowedMethods,
          url: request.url
        }
      );

      return NextResponse.json(
        { error: 'Method Not Allowed' },
        { status: 405 }
      );
    }

    return handler(request, context);
  }, options);
}

/**
 * Utility function to track errors in API routes manually
 */
export function trackApiRouteError(
  request: NextRequest,
  error: Error,
  statusCode: number = 500,
  additionalContext: Record<string, any> = {}
): void {
  trackApiError(
    new URL(request.url).pathname,
    statusCode,
    error,
    {
      method: request.method,
      url: request.url,
      userAgent: request.headers.get('user-agent') || undefined,
      ...additionalContext
    }
  );
}

/**
 * Utility function to track validation errors
 */
export function trackValidationError(
  request: NextRequest,
  field: string,
  error: Error,
  additionalContext: Record<string, any> = {}
): void {
  trackApiRouteError(request, error, 400, {
    validation_field: field,
    error_type: 'validation',
    ...additionalContext
  });
}

/**
 * Utility function to track authentication errors
 */
export function trackAuthError(
  request: NextRequest,
  error: Error,
  additionalContext: Record<string, any> = {}
): void {
  trackApiRouteError(request, error, 401, {
    error_type: 'authentication',
    ...additionalContext
  });
}

/**
 * Utility function to track authorization errors
 */
export function trackAuthorizationError(
  request: NextRequest,
  error: Error,
  additionalContext: Record<string, any> = {}
): void {
  trackApiRouteError(request, error, 403, {
    error_type: 'authorization',
    ...additionalContext
  });
}

/**
 * Utility function to track rate limiting errors
 */
export function trackRateLimitError(
  request: NextRequest,
  error: Error,
  additionalContext: Record<string, any> = {}
): void {
  trackApiRouteError(request, error, 429, {
    error_type: 'rate_limit',
    ...additionalContext
  });
}

// Export types for use in other files
