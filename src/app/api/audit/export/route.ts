/**
 * Audit Log Export API Route
 *
 * Provides export functionality for compliance tool integration.
 * Supports CSV and JSON formats with filtering capabilities.
 *
 * SECURITY: Admin-only access with rate limiting
 * COMPLIANCE: SOC2/HIPAA - includes hash chain info for tamper evidence
 *
 * @module app/api/audit/export/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkDashboardAuth, getDashboardUnauthorizedResponse } from '@/lib/monitoring/auth';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import { z } from '@/lib/zod-compat';
import {
  exportAuditLogs,
  ExportFormat,
  exportFormatSchema,
  logAuditAsync,
  AuditAction,
  AuditCategory,
  AuditSeverity,
  AuditOutcome,
  auditCategorySchema,
  auditSeveritySchema,
  auditOutcomeSchema,
  type ExportOptions,
} from '@/lib/audit';

export const dynamic = 'force-dynamic';

// Rate limit: 10 exports per minute (exports are resource-intensive)
const apiRateLimit = createAPIRateLimit(10);

// ============================================================================
// Validation Schemas
// ============================================================================

const exportQuerySchema = z.object({
  // Format
  format: exportFormatSchema.default(ExportFormat.JSON),

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

  // Export options
  includeHashes: z.enum(['true', 'false']).optional().transform(v => v !== 'false'),
  includeMetadata: z.enum(['true', 'false']).optional().transform(v => v !== 'false'),
  maxRecords: z.coerce.number().int().min(1).max(100000).optional().default(10000),

  // CSV-specific options
  includeBom: z.enum(['true', 'false']).optional().transform(v => v !== 'false'),
});

type ExportQueryParams = z.infer<typeof exportQuerySchema>;

// ============================================================================
// Helpers
// ============================================================================

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

// ============================================================================
// GET Handler
// ============================================================================

/**
 * GET /api/audit/export
 *
 * Export audit logs for compliance tool integration.
 *
 * Query Parameters:
 * - format: Export format ('csv' or 'json', default: 'json')
 * - userId: Filter by user ID
 * - actions: Comma-separated list of actions to filter
 * - resource: Resource pattern (supports wildcards like "project:*")
 * - category: Filter by category (auth, data_access, admin, system, ai_operations, api, general)
 * - severity: Filter by severity (info, warning, critical)
 * - outcome: Filter by outcome (success, failure, error)
 * - sessionId: Filter by session ID
 * - startTime: Filter logs after this timestamp (ISO 8601)
 * - endTime: Filter logs before this timestamp (ISO 8601)
 * - includeHashes: Include hash chain info for tamper evidence (default: true)
 * - includeMetadata: Include metadata field (default: true)
 * - maxRecords: Maximum records to export (default: 10000, max: 100000)
 * - includeBom: Include BOM for Excel CSV compatibility (default: true)
 *
 * Response:
 * - Content-Type: application/json or text/csv
 * - Content-Disposition: attachment with filename
 *
 * The export includes:
 * - All matching audit log entries
 * - Export metadata (timestamp, filter, record count, etc.)
 * - Hash chain information for tamper evidence verification (if includeHashes=true)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  // Rate limiting
  const rateLimitResult = await apiRateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Exports are resource-intensive.' },
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
    // Check authentication - only admins can export audit logs
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

    const parseResult = exportQuerySchema.safeParse(rawParams);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const params: ExportQueryParams = parseResult.data;

    // Build export options
    const exportOptions: ExportOptions = {
      format: params.format,
      filter: {
        userId: params.userId,
        actions: params.actions,
        resource: params.resource,
        category: params.category,
        severity: params.severity,
        outcome: params.outcome,
        sessionId: params.sessionId,
        startTime: params.startTime,
        endTime: params.endTime,
      },
      includeHashes: params.includeHashes,
      includeMetadata: params.includeMetadata,
      maxRecords: params.maxRecords,
      includeBom: params.includeBom,
    };

    // Execute export
    const result = await exportAuditLogs(exportOptions);

    // Log the export action (meta-audit)
    logAuditAsync(
      AuditAction.ADMIN_EXPORT_REQUESTED,
      'audit:export',
      {
        userId: auth.user?.id ? parseInt(auth.user.id, 10) || null : null,
        ipAddress: getClientIP(request),
        userAgent: request.headers.get('user-agent'),
      },
      {
        requestId,
        format: params.format,
        filters: {
          userId: params.userId,
          actions: params.actions,
          resource: params.resource,
          category: params.category,
          severity: params.severity,
          outcome: params.outcome,
          hasTimeRange: !!(params.startTime || params.endTime),
        },
        options: {
          includeHashes: params.includeHashes,
          includeMetadata: params.includeMetadata,
          maxRecords: params.maxRecords,
        },
        resultCount: result.recordCount,
        totalCount: result.totalCount,
        truncated: result.truncated,
        success: result.success,
        durationMs: Date.now() - startTime,
      },
      {
        category: AuditCategory.ADMIN,
        severity: AuditSeverity.INFO,
        outcome: result.success ? AuditOutcome.SUCCESS : AuditOutcome.FAILURE,
      }
    );

    // Handle export failure
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Export failed',
          message: result.error,
        },
        { status: 500 }
      );
    }

    // Return the exported content with appropriate headers
    const headers: HeadersInit = {
      'Content-Type': result.contentType ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'X-Export-Record-Count': String(result.recordCount ?? 0),
      'X-Export-Total-Count': String(result.totalCount ?? 0),
      'X-Export-Truncated': String(result.truncated ?? false),
      'X-Export-Format': result.format ?? params.format,
      'X-Request-Id': requestId,
    };

    return new NextResponse(result.content, {
      status: 200,
      headers,
    });

  } catch (error) {
    const durationMs = Date.now() - startTime;

    // Log the error
    logAuditAsync(
      AuditAction.ADMIN_EXPORT_REQUESTED,
      'audit:export',
      {
        userId: null,
        ipAddress: getClientIP(request),
        userAgent: request.headers.get('user-agent'),
      },
      {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs,
      },
      {
        category: AuditCategory.ADMIN,
        severity: AuditSeverity.WARNING,
        outcome: AuditOutcome.ERROR,
      }
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export audit logs',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * HEAD /api/audit/export
 *
 * Get export metadata without downloading the full export.
 * Useful for estimating export size before downloading.
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

    // Parse query parameters
    const url = new URL(request.url);
    const rawParams: Record<string, string> = {};

    for (const [key, value] of url.searchParams.entries()) {
      rawParams[key] = value;
    }

    const parseResult = exportQuerySchema.safeParse(rawParams);

    if (!parseResult.success) {
      return new NextResponse(null, { status: 400 });
    }

    const params: ExportQueryParams = parseResult.data;

    // Import auditService for count
    const { auditService } = await import('@/lib/audit');

    // Get count with filters
    const count = await auditService.count({
      userId: params.userId,
      actions: params.actions,
      resource: params.resource,
      category: params.category,
      severity: params.severity,
      outcome: params.outcome,
      sessionId: params.sessionId,
      startTime: params.startTime,
      endTime: params.endTime,
    });

    const effectiveCount = Math.min(count, params.maxRecords ?? 10000);
    const truncated = count > (params.maxRecords ?? 10000);

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Export-Total-Count': count.toString(),
        'X-Export-Record-Count': effectiveCount.toString(),
        'X-Export-Truncated': truncated.toString(),
        'X-Export-Format': params.format,
      },
    });

  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
