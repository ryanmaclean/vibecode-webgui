/**
 * API Request/Response Logger
 *
 * Provides middleware and utilities for logging HTTP requests and responses.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  sanitizeLogData,
  extractTraceContext,
  formatBytes,
  formatDuration,
  generateCorrelationId
} from './format';
import { formatError } from './error-logger';

/**
 * API log context
 */
export interface ApiLogContext {
  requestId: string;
  method: string;
  path: string;
  query?: Record<string, string>;
  userAgent?: string;
  ip?: string;
  userId?: string;
  traceId?: string;
  spanId?: string;
}

/**
 * Request log data
 */
interface RequestLogData {
  type: 'request';
  requestId: string;
  http: {
    method: string;
    url: string;
    path: string;
    query?: Record<string, string>;
    headers?: Record<string, string>;
    bodySize?: number;
  };
  client?: {
    ip?: string;
    userAgent?: string;
  };
  trace?: {
    traceId?: string;
    spanId?: string;
  };
  user?: {
    id?: string;
    role?: string;
  };
}

/**
 * Response log data
 */
interface ResponseLogData {
  type: 'response';
  requestId: string;
  http: {
    method: string;
    url: string;
    path: string;
    statusCode: number;
    statusText?: string;
    responseSize?: number;
  };
  performance: {
    durationMs: number;
    formattedDuration: string;
  };
  trace?: {
    traceId?: string;
    spanId?: string;
  };
}

/**
 * Headers to exclude from logging
 */
const EXCLUDED_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token'
]);

/**
 * Extract safe headers for logging
 */
function extractSafeHeaders(headers: Headers): Record<string, string> {
  const safeHeaders: Record<string, string> = {};

  headers.forEach((value, key) => {
    if (!EXCLUDED_HEADERS.has(key.toLowerCase())) {
      safeHeaders[key] = value;
    } else {
      safeHeaders[key] = '[REDACTED]';
    }
  });

  return safeHeaders;
}

/**
 * Extract query parameters from URL
 */
function extractQueryParams(url: string): Record<string, string> | undefined {
  try {
    const urlObj = new URL(url);
    const params: Record<string, string> = {};

    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    return Object.keys(params).length > 0 ? params : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get client IP from request
 */
function getClientIp(request: NextRequest): string | undefined {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    (request as unknown as { ip?: string }).ip ||
    undefined
  );
}

/**
 * API Logger for request/response logging
 */
export const apiLogger = {
  /**
   * Log an incoming request
   *
   * @param request - NextRequest object
   * @param options - Additional options
   * @returns Request context for use in response logging
   */
  logRequest(
    request: NextRequest,
    options?: {
      includeHeaders?: boolean;
      userId?: string;
      userRole?: string;
      bodySize?: number;
    }
  ): ApiLogContext {
    const requestId = generateCorrelationId();
    const url = new URL(request.url);
    const traceContext = extractTraceContext(request.headers);

    const logData: RequestLogData = {
      type: 'request',
      requestId,
      http: {
        method: request.method,
        url: request.url,
        path: url.pathname,
        query: extractQueryParams(request.url)
      },
      client: {
        ip: getClientIp(request),
        userAgent: request.headers.get('user-agent') || undefined
      }
    };

    if (options?.includeHeaders) {
      logData.http.headers = extractSafeHeaders(request.headers);
    }

    if (options?.bodySize) {
      logData.http.bodySize = options.bodySize;
    }

    if (traceContext.traceId || traceContext.spanId) {
      logData.trace = traceContext;
    }

    if (options?.userId) {
      logData.user = {
        id: options.userId,
        role: options.userRole
      };
    }

    logger.info(`API Request: ${request.method} ${url.pathname}`, logData as unknown as Record<string, unknown>);

    return {
      requestId,
      method: request.method,
      path: url.pathname,
      query: logData.http.query,
      userAgent: logData.client?.userAgent,
      ip: logData.client?.ip,
      userId: options?.userId,
      traceId: traceContext.traceId,
      spanId: traceContext.spanId
    };
  },

  /**
   * Log a response
   *
   * @param context - Request context from logRequest
   * @param response - NextResponse object
   * @param startTime - Request start time (from Date.now() or performance.now())
   * @param options - Additional options
   */
  logResponse(
    context: ApiLogContext,
    response: NextResponse,
    startTime: number,
    options?: {
      responseSize?: number;
      metadata?: Record<string, unknown>;
    }
  ): void {
    const duration = Date.now() - startTime;

    const logData: ResponseLogData = {
      type: 'response',
      requestId: context.requestId,
      http: {
        method: context.method,
        url: context.path,
        path: context.path,
        statusCode: response.status
      },
      performance: {
        durationMs: duration,
        formattedDuration: formatDuration(duration)
      }
    };

    if (options?.responseSize) {
      logData.http.responseSize = options.responseSize;
    }

    if (context.traceId || context.spanId) {
      logData.trace = {
        traceId: context.traceId,
        spanId: context.spanId
      };
    }

    const fullLogData = options?.metadata
      ? { ...logData, ...sanitizeLogData(options.metadata) }
      : logData;

    // Log at appropriate level based on status code
    const statusCode = response.status;
    const message = `API Response: ${context.method} ${context.path} ${statusCode} (${formatDuration(duration)})`;

    if (statusCode >= 500) {
      logger.error(message, fullLogData as unknown as Record<string, unknown>);
    } else if (statusCode >= 400) {
      logger.warn(message, fullLogData as unknown as Record<string, unknown>);
    } else if (duration > 5000) {
      logger.warn(message, { ...fullLogData, slow: true } as unknown as Record<string, unknown>);
    } else {
      logger.info(message, fullLogData as unknown as Record<string, unknown>);
    }
  },

  /**
   * Log an API error
   *
   * @param context - Request context
   * @param error - Error that occurred
   * @param statusCode - HTTP status code to return
   */
  logError(
    context: ApiLogContext,
    error: unknown,
    statusCode = 500
  ): void {
    const formattedError = formatError(error);

    logger.error(`API Error: ${context.method} ${context.path}`, {
      type: 'api_error',
      requestId: context.requestId,
      http: {
        method: context.method,
        path: context.path,
        statusCode
      },
      error: formattedError,
      errorType: formattedError.name,
      errorMessage: formattedError.message,
      stackTrace: formattedError.stack,
      trace: context.traceId
        ? { traceId: context.traceId, spanId: context.spanId }
        : undefined
    });
  }
};

/**
 * Create an API logger for a specific route/component
 *
 * @param component - Component/route name
 * @returns API logger with component context
 */
export function createApiLogger(component: string) {
  return {
    logRequest(
      request: NextRequest,
      options?: Parameters<typeof apiLogger.logRequest>[1]
    ): ApiLogContext {
      const context = apiLogger.logRequest(request, options);
      logger.debug(`[${component}] Request started`, {
        component,
        requestId: context.requestId
      });
      return context;
    },

    logResponse(
      context: ApiLogContext,
      response: NextResponse,
      startTime: number,
      options?: Parameters<typeof apiLogger.logResponse>[3]
    ): void {
      apiLogger.logResponse(context, response, startTime, {
        ...options,
        metadata: { ...options?.metadata, component }
      });
    },

    logError(context: ApiLogContext, error: unknown, statusCode?: number): void {
      apiLogger.logError(context, error, statusCode);
    }
  };
}

/**
 * Middleware wrapper for automatic request/response logging
 *
 * @param handler - Route handler function
 * @param options - Logging options
 * @returns Wrapped handler with logging
 *
 * @example
 * ```typescript
 * export const GET = withApiLogging(
 *   async (request) => {
 *     // Your handler logic
 *     return NextResponse.json({ data: 'example' });
 *   },
 *   { component: 'users-api' }
 * );
 * ```
 */
export function withApiLogging<T extends NextRequest>(
  handler: (request: T, context?: { params?: Record<string, string> }) => Promise<NextResponse>,
  options?: {
    component?: string;
    includeHeaders?: boolean;
  }
) {
  return async (
    request: T,
    routeContext?: { params?: Record<string, string> }
  ): Promise<NextResponse> => {
    const startTime = Date.now();
    const log = options?.component
      ? createApiLogger(options.component)
      : apiLogger;

    const requestContext = log.logRequest(request, {
      includeHeaders: options?.includeHeaders
    });

    try {
      const response = await handler(request, routeContext);

      log.logResponse(requestContext, response, startTime, {
        metadata: routeContext?.params ? { routeParams: routeContext.params } : undefined
      });

      // Add request ID to response headers for tracing
      response.headers.set('x-request-id', requestContext.requestId);

      return response;
    } catch (error) {
      log.logError(requestContext, error);

      // Re-throw to let Next.js error handling take over
      throw error;
    }
  };
}
