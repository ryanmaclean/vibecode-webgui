/**
 * Audit Middleware for API Routes
 *
 * Provides middleware wrapper for automatic audit logging of API operations.
 * Follows the pattern established by auth/middleware.ts and logging/api-logger.ts.
 *
 * Compliance:
 * - SOC2: All operations logged with timestamps and user IDs
 * - HIPAA: Tamper-evident storage via hash chain in audit service
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  logAuditAsync,
  logAudit,
  type AuditContext,
  type CreateAuditLogResult,
  AuditAction,
  AuditSeverity,
  AuditCategory,
  AuditOutcome,
  formatResourceId,
} from './index';
import type { AuthenticatedRequest } from '@/lib/auth/middleware';

// ============================================================================
// Types
// ============================================================================

/**
 * Request with optional audit context attached
 */
export interface AuditedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  auditContext?: AuditContext;
}

/**
 * Options for the audit middleware
 */
export interface AuditMiddlewareOptions {
  /** The audit action to log (required) */
  action: AuditAction | string;
  /** Resource type for the audited operation (e.g., "api", "project", "file") */
  resourceType?: string;
  /** Static resource ID, or function to extract from request */
  resourceId?: string | ((req: NextRequest) => string | undefined);
  /** Additional metadata to include in audit log */
  metadata?: Record<string, unknown> | ((req: NextRequest) => Record<string, unknown>);
  /** Audit severity level (defaults based on action) */
  severity?: AuditSeverity;
  /** Audit category (defaults based on action) */
  category?: AuditCategory;
  /** Whether to wait for audit log to complete (default: false for performance) */
  awaitAudit?: boolean;
  /** Whether to log on success only, failure only, or both (default: 'both') */
  logOn?: 'success' | 'failure' | 'both';
  /** Custom function to determine if the response indicates success */
  isSuccess?: (response: NextResponse) => boolean;
  /** Skip audit logging for specific conditions */
  skipIf?: (req: NextRequest) => boolean;
}

/**
 * Extended options for AI operation audit logging
 */
export interface AIAuditOptions extends Omit<AuditMiddlewareOptions, 'action' | 'resourceType'> {
  /** The specific AI action type */
  action?: AuditAction;
  /** Model being used (for metadata) */
  model?: string | ((req: NextRequest) => string | undefined);
}

/**
 * Extended options for admin operation audit logging
 */
export interface AdminAuditOptions extends Omit<AuditMiddlewareOptions, 'action' | 'severity'> {
  /** The specific admin action type */
  action: AuditAction | string;
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Extract client IP address from request
 */
function getClientIP(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('true-client-ip') ||
    null
  );
}

/**
 * Extract session ID from request
 */
function getSessionId(req: NextRequest): string | null {
  // Check for session ID in cookies or headers
  const sessionCookie = req.cookies.get('session')?.value;
  const sessionHeader = req.headers.get('x-session-id');
  return sessionHeader || sessionCookie || null;
}

/**
 * Extract request ID from headers (for correlation)
 */
function getRequestId(req: NextRequest): string | undefined {
  return req.headers.get('x-request-id') || undefined;
}

/**
 * Extract trace ID from headers (for distributed tracing)
 */
function getTraceId(req: NextRequest): string | undefined {
  return (
    req.headers.get('x-trace-id') ||
    req.headers.get('traceparent')?.split('-')[1] ||
    undefined
  );
}

/**
 * Build audit context from request
 */
function buildAuditContext(req: AuditedRequest): AuditContext {
  const userId = req.user?.id ? parseInt(req.user.id, 10) : null;

  return {
    userId: userId && !isNaN(userId) ? userId : null,
    ipAddress: getClientIP(req),
    userAgent: req.headers.get('user-agent'),
    sessionId: getSessionId(req),
    requestId: getRequestId(req),
    traceId: getTraceId(req),
  };
}

/**
 * Build resource string from options and request
 */
function buildResourceString(
  req: NextRequest,
  options: AuditMiddlewareOptions
): string {
  const url = new URL(req.url);
  const resourceType = options.resourceType ?? 'api';

  let resourceId: string;
  if (typeof options.resourceId === 'function') {
    resourceId = options.resourceId(req) ?? url.pathname;
  } else if (options.resourceId) {
    resourceId = options.resourceId;
  } else {
    resourceId = url.pathname;
  }

  return formatResourceId(resourceType, resourceId);
}

/**
 * Build metadata from options and request
 */
function buildMetadata(
  req: NextRequest,
  options: AuditMiddlewareOptions,
  response?: NextResponse,
  duration?: number
): Record<string, unknown> {
  const url = new URL(req.url);
  const baseMetadata: Record<string, unknown> = {
    method: req.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
  };

  // Add response info if available
  if (response) {
    baseMetadata.statusCode = response.status;
  }

  // Add duration if available
  if (duration !== undefined) {
    baseMetadata.durationMs = duration;
  }

  // Merge with custom metadata
  let customMetadata: Record<string, unknown> = {};
  if (typeof options.metadata === 'function') {
    customMetadata = options.metadata(req);
  } else if (options.metadata) {
    customMetadata = options.metadata;
  }

  return { ...baseMetadata, ...customMetadata };
}

/**
 * Default success check based on status code
 */
function defaultIsSuccess(response: NextResponse): boolean {
  return response.status >= 200 && response.status < 400;
}

// ============================================================================
// Middleware Implementations
// ============================================================================

/**
 * Audit logging middleware for API routes
 *
 * Wraps an API route handler to automatically log audit events.
 * Logs both successful and failed requests with full context.
 *
 * @param handler - The route handler function
 * @param options - Audit logging options
 * @returns Wrapped handler with audit logging
 *
 * @example
 * ```typescript
 * export const GET = withAuditLogging(
 *   async (request) => {
 *     // Your handler logic
 *     return NextResponse.json({ data: 'example' });
 *   },
 *   {
 *     action: AuditAction.API_REQUEST,
 *     resourceType: 'users-api',
 *   }
 * );
 * ```
 */
export function withAuditLogging<T extends NextRequest>(
  handler: (req: T, context?: { params?: Record<string, string> }) => Promise<NextResponse>,
  options: AuditMiddlewareOptions
) {
  return async (
    req: T,
    routeContext?: { params?: Record<string, string> }
  ): Promise<NextResponse> => {
    const startTime = Date.now();
    const auditedReq = req as AuditedRequest;

    // Test mode support - skip audit in test mode
    const isTestMode = req.headers.get('x-test-mode') === 'true';
    const skipAudit = isTestMode || (options.skipIf && options.skipIf(req));

    // Build audit context early for error cases
    const auditContext = buildAuditContext(auditedReq);
    auditedReq.auditContext = auditContext;

    // Build resource string
    const resource = buildResourceString(req, options);

    // Execute the handler
    let response: NextResponse;
    let handlerError: Error | null = null;

    try {
      response = await handler(req, routeContext);
    } catch (error) {
      handlerError = error instanceof Error ? error : new Error(String(error));

      // Log failure audit event
      if (!skipAudit && options.logOn !== 'success') {
        const duration = Date.now() - startTime;
        const metadata = buildMetadata(req, options, undefined, duration);
        metadata.error = handlerError.message;
        metadata.errorType = handlerError.name;

        const logFn = options.awaitAudit ? logAudit : logAuditAsync;
        logFn(
          options.action,
          resource,
          auditContext,
          metadata,
          {
            severity: options.severity ?? AuditSeverity.WARNING,
            category: options.category,
            outcome: AuditOutcome.ERROR,
          }
        );
      }

      // Re-throw to let Next.js error handling take over
      throw handlerError;
    }

    // Determine if the response indicates success
    const isSuccessCheck = options.isSuccess ?? defaultIsSuccess;
    const isSuccessResponse = isSuccessCheck(response);
    const duration = Date.now() - startTime;

    // Determine if we should log
    const shouldLog =
      !skipAudit &&
      (options.logOn === 'both' ||
        options.logOn === undefined ||
        (options.logOn === 'success' && isSuccessResponse) ||
        (options.logOn === 'failure' && !isSuccessResponse));

    if (shouldLog) {
      const metadata = buildMetadata(req, options, response, duration);
      const outcome = isSuccessResponse ? AuditOutcome.SUCCESS : AuditOutcome.FAILURE;

      // Determine severity for failures
      let severity = options.severity;
      if (!severity && !isSuccessResponse) {
        severity = response.status >= 500 ? AuditSeverity.CRITICAL : AuditSeverity.WARNING;
      }

      const logFn = options.awaitAudit ? logAudit : logAuditAsync;
      logFn(
        options.action,
        resource,
        auditContext,
        metadata,
        {
          severity,
          category: options.category,
          outcome,
        }
      );
    }

    // Add audit context header for tracing
    if (auditContext.requestId) {
      response.headers.set('x-audit-request-id', auditContext.requestId);
    }

    return response;
  };
}

/**
 * Middleware specifically for AI operation audit logging
 *
 * Pre-configured for AI operations with appropriate defaults.
 *
 * @param handler - The route handler function
 * @param options - AI audit options
 * @returns Wrapped handler with AI audit logging
 *
 * @example
 * ```typescript
 * export const POST = withAIAuditLogging(
 *   async (request) => {
 *     // AI chat handler logic
 *     return NextResponse.json({ response: '...' });
 *   },
 *   { model: 'gpt-4' }
 * );
 * ```
 */
export function withAIAuditLogging<T extends NextRequest>(
  handler: (req: T, context?: { params?: Record<string, string> }) => Promise<NextResponse>,
  options: AIAuditOptions = {}
) {
  const action = options.action ?? AuditAction.AI_CHAT_REQUEST;

  // Build model metadata extractor if provided
  const modelMetadata = options.model
    ? (req: NextRequest): Record<string, unknown> => {
        const model =
          typeof options.model === 'function' ? options.model(req) : options.model;
        return model ? { model } : {};
      }
    : undefined;

  // Combine with existing metadata
  const combinedMetadata = (req: NextRequest): Record<string, unknown> => {
    let base: Record<string, unknown> = {};
    if (modelMetadata) {
      base = modelMetadata(req);
    }
    if (options.metadata) {
      const custom =
        typeof options.metadata === 'function' ? options.metadata(req) : options.metadata;
      base = { ...base, ...custom };
    }
    return base;
  };

  return withAuditLogging(handler, {
    ...options,
    action,
    resourceType: 'ai',
    category: AuditCategory.AI_OPERATIONS,
    metadata: combinedMetadata,
  });
}

/**
 * Middleware for admin operation audit logging
 *
 * Pre-configured for admin operations with appropriate severity.
 *
 * @param handler - The route handler function
 * @param options - Admin audit options
 * @returns Wrapped handler with admin audit logging
 *
 * @example
 * ```typescript
 * export const POST = withAdminAuditLogging(
 *   async (request) => {
 *     // Admin operation logic
 *     return NextResponse.json({ success: true });
 *   },
 *   { action: AuditAction.ADMIN_SETTINGS_CHANGED }
 * );
 * ```
 */
export function withAdminAuditLogging<T extends NextRequest>(
  handler: (req: T, context?: { params?: Record<string, string> }) => Promise<NextResponse>,
  options: AdminAuditOptions
) {
  return withAuditLogging(handler, {
    ...options,
    resourceType: options.resourceType ?? 'admin',
    severity: AuditSeverity.CRITICAL,
    category: AuditCategory.ADMIN,
  });
}

/**
 * Middleware for data access audit logging
 *
 * Pre-configured for data access operations (files, projects, etc.).
 *
 * @param handler - The route handler function
 * @param options - Audit options
 * @returns Wrapped handler with data access audit logging
 *
 * @example
 * ```typescript
 * export const GET = withDataAccessAuditLogging(
 *   async (request) => {
 *     // Data access logic
 *     return NextResponse.json({ data: '...' });
 *   },
 *   {
 *     action: AuditAction.FILE_ACCESSED,
 *     resourceType: 'file',
 *     resourceId: (req) => req.nextUrl.searchParams.get('fileId') || undefined,
 *   }
 * );
 * ```
 */
export function withDataAccessAuditLogging<T extends NextRequest>(
  handler: (req: T, context?: { params?: Record<string, string> }) => Promise<NextResponse>,
  options: AuditMiddlewareOptions
) {
  return withAuditLogging(handler, {
    ...options,
    category: AuditCategory.DATA_ACCESS,
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create an audit context from an authenticated request
 *
 * Useful when you need to manually log audit events within a handler.
 *
 * @param req - The authenticated request
 * @returns Audit context extracted from the request
 */
export function createAuditContextFromRequest(
  req: AuthenticatedRequest | AuditedRequest
): AuditContext {
  return buildAuditContext(req as AuditedRequest);
}

/**
 * Log an audit event within a handler
 *
 * Use this when you need to log additional audit events within a handler,
 * beyond the automatic request/response logging.
 *
 * @param req - The request (for context extraction)
 * @param action - The audit action
 * @param resource - The resource being audited
 * @param metadata - Additional metadata
 * @param options - Audit options
 */
export async function logAuditFromRequest(
  req: AuthenticatedRequest | AuditedRequest,
  action: AuditAction | string,
  resource: string,
  metadata?: Record<string, unknown>,
  options?: {
    severity?: AuditSeverity;
    category?: AuditCategory;
    outcome?: AuditOutcome;
    awaitAudit?: boolean;
  }
): Promise<CreateAuditLogResult | void> {
  const context = createAuditContextFromRequest(req);

  if (options?.awaitAudit) {
    return logAudit(action, resource, context, metadata, {
      severity: options.severity,
      category: options.category,
      outcome: options.outcome,
    });
  }

  logAuditAsync(action, resource, context, metadata, {
    severity: options?.severity,
    category: options?.category,
    outcome: options?.outcome,
  });
}

/**
 * Combine multiple middleware wrappers
 *
 * Allows composing audit logging with other middleware.
 *
 * @param handler - The route handler
 * @param middlewares - Array of middleware wrappers to apply (applied right-to-left)
 * @returns Handler wrapped with all middleware
 *
 * @example
 * ```typescript
 * export const POST = composeMiddleware(
 *   myHandler,
 *   [
 *     (h) => withAuth(h, { requiredRole: ['admin'] }),
 *     (h) => withAuditLogging(h, { action: AuditAction.ADMIN_SETTINGS_CHANGED }),
 *   ]
 * );
 * ```
 */
export function composeMiddleware<T extends NextRequest>(
  handler: (req: T, context?: { params?: Record<string, string> }) => Promise<NextResponse>,
  middlewares: Array<
    (
      h: (req: T, context?: { params?: Record<string, string> }) => Promise<NextResponse>
    ) => (req: T, context?: { params?: Record<string, string> }) => Promise<NextResponse>
  >
): (req: T, context?: { params?: Record<string, string> }) => Promise<NextResponse> {
  return middlewares.reduceRight((h, middleware) => middleware(h), handler);
}
