/**
 * Audit Logs API Route
 * Provides querying and filtering of compliance audit logs
 *
 * SECURITY: Admin-only access with rate limiting
 * COMPLIANCE: SOC2/HIPAA - all access to audit logs is itself logged
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkDashboardAuth, getDashboardUnauthorizedResponse } from '@/lib/monitoring/auth';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import { z } from '@/lib/zod-compat';
import {
  auditService,
  logAuditAsync,
  AuditAction,
  AuditCategory,
  AuditSeverity,
  AuditOutcome,
  auditCategorySchema,
  auditSeveritySchema,
  auditOutcomeSchema,
} from '@/lib/audit';

export const dynamic = 'force-dynamic';

// Rate limit: 60 requests per minute for audit log queries
const apiRateLimit = createAPIRateLimit(60);

// Query parameters validation schema
const auditLogQuerySchema = z.object({
  // Filtering
  userId: z.coerce.number().int().optional(),
  actions: z.string().transform(val => val.split(',')).optional(),
  resource: z.string().max(500).optional(),
  category: auditCategorySchema.optional(),
  severity: auditSeveritySchema.optional(),
  outcome: auditOutcomeSchema.optional(),
  sessionId: z.string().max(100).optional(),

  // Time range
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),

  // Pagination
  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

type AuditLogQueryParams = z.infer<typeof auditLogQuerySchema>;

/**
 * Extract client IP from request for audit logging
 */
function getClientIP(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    null
  );
}

/**
 * GET /api/audit/logs
 *
 * Query audit logs with filtering and pagination.
 *
 * Query Parameters:
 * - userId: Filter by user ID
 * - actions: Comma-separated list of actions to filter
 * - resource: Resource pattern (supports wildcards like "project:*")
 * - category: Filter by category (auth, data_access, admin, system, ai_operations, api, general)
 * - severity: Filter by severity (info, warning, critical)
 * - outcome: Filter by outcome (success, failure, error)
 * - sessionId: Filter by session ID
 * - startTime: Filter logs after this timestamp (ISO 8601)
 * - endTime: Filter logs before this timestamp (ISO 8601)
 * - limit: Maximum number of results (default: 100, max: 1000)
 * - offset: Pagination offset (default: 0)
 *
 * Response:
 * {
 *   entries: AuditLogEntry[],
 *   totalCount: number,
 *   hasMore: boolean,
 *   pagination: { limit, offset, total }
 * }
 */
export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await apiRateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
        },
      }
    );
  }

  try {
    // Check authentication - only admins can view audit logs
    const auth = await checkDashboardAuth(request);
    if (!auth.isAuthorized) {
      return getDashboardUnauthorizedResponse(auth.error);
    }

    // Parse and validate query parameters
    const url = new URL(request.url);
    const rawParams: Record<string, string> = {};

    for (const [key, value] of url.searchParams.entries()) {
      rawParams[key] = value;
    }

    const parseResult = auditLogQuerySchema.safeParse(rawParams);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const params: AuditLogQueryParams = parseResult.data;

    // Build filter from validated params
    const filter = {
      userId: params.userId,
      actions: params.actions,
      resource: params.resource,
      category: params.category,
      severity: params.severity,
      outcome: params.outcome,
      sessionId: params.sessionId,
      startTime: params.startTime,
      endTime: params.endTime,
      limit: params.limit,
      offset: params.offset,
    };

    // Query audit logs
    const result = await auditService.query(filter);

    // Log the audit log access (meta-audit)
    logAuditAsync(
      AuditAction.ADMIN_AUDIT_LOG_VIEWED,
      'audit:logs',
      {
        userId: auth.user?.id ? parseInt(auth.user.id, 10) || null : null,
        ipAddress: getClientIP(request),
        userAgent: request.headers.get('user-agent'),
      },
      {
        queriedFilters: {
          userId: params.userId,
          actions: params.actions,
          resource: params.resource,
          category: params.category,
          severity: params.severity,
          outcome: params.outcome,
          hasTimeRange: !!(params.startTime || params.endTime),
        },
        resultCount: result.entries.length,
        totalCount: result.totalCount,
      },
      {
        category: AuditCategory.ADMIN,
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
      }
    );

    // Return response with pagination metadata
    return NextResponse.json({
      entries: result.entries,
      totalCount: result.totalCount,
      hasMore: result.hasMore,
      pagination: {
        limit: params.limit,
        offset: params.offset,
        total: result.totalCount,
      },
    });

  } catch (error) {
    console.error('Failed to query audit logs:', error);

    return NextResponse.json(
      {
        error: 'Failed to query audit logs',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * HEAD /api/audit/logs
 *
 * Get count of audit logs matching filters without returning entries.
 * Useful for checking if there are new logs since a given timestamp.
 */
export async function HEAD(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await apiRateLimit(request);
  if (!rateLimitResult.success) {
    return new NextResponse(null, {
      status: 429,
      headers: {
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.reset.toString(),
        'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
      },
    });
  }

  try {
    // Check authentication
    const auth = await checkDashboardAuth(request);
    if (!auth.isAuthorized) {
      return new NextResponse(null, { status: 401 });
    }

    // Parse query parameters for filtering
    const url = new URL(request.url);
    const rawParams: Record<string, string> = {};

    for (const [key, value] of url.searchParams.entries()) {
      rawParams[key] = value;
    }

    const parseResult = auditLogQuerySchema.safeParse(rawParams);

    if (!parseResult.success) {
      return new NextResponse(null, { status: 400 });
    }

    const params: AuditLogQueryParams = parseResult.data;

    // Build filter
    const filter = {
      userId: params.userId,
      actions: params.actions,
      resource: params.resource,
      category: params.category,
      severity: params.severity,
      outcome: params.outcome,
      sessionId: params.sessionId,
      startTime: params.startTime,
      endTime: params.endTime,
    };

    // Get count
    const count = await auditService.count(filter);

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Total-Count': count.toString(),
      },
    });

  } catch (error) {
    console.error('Failed to count audit logs:', error);
    return new NextResponse(null, { status: 500 });
  }
}
