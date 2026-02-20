/**
 * AI Quality Reports API Endpoint
 * Returns quality metrics and model comparison reports
 *
 * Protected with admin-only authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkDashboardAuth, getDashboardUnauthorizedResponse } from '@/lib/monitoring/auth';
import { QualityReportGenerator } from '@/lib/ai/quality-reports';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { createServiceLogger } from '@/lib/logging';

const logger = createServiceLogger({ service: 'vibecode-webgui', component: 'ai-quality-reports' });

export const dynamic = 'force-dynamic';

// ============================================================================
// Query Parameter Validation
// ============================================================================

const querySchema = z.object({
  period: z.enum(['day', 'week', 'month', 'quarter', 'year', 'custom']).optional().default('week'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  modelIds: z.string().optional(), // Comma-separated model IDs
  includeDetails: z.string().optional().transform(val => val === 'true'),
  includeCharts: z.string().optional().transform(val => val === 'true'),
});

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(request: NextRequest) {
  const authResult = await checkDashboardAuth(request);
  if (!authResult.isAuthorized) {
    return getDashboardUnauthorizedResponse(authResult.error);
  }

  try {
    const { searchParams } = new URL(request.url);

    // Validate query parameters
    const params = querySchema.parse({
      period: searchParams.get('period') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      modelIds: searchParams.get('modelIds') || undefined,
      includeDetails: searchParams.get('includeDetails') || undefined,
      includeCharts: searchParams.get('includeCharts') || undefined,
    });

    logger.info('[QualityReports] Generating quality report', {
      userId: authResult.user?.id,
      params,
    });

    // Calculate time period based on period parameter
    const { start, end } = calculateTimePeriod(
      params.period,
      params.startDate,
      params.endDate
    );

    // Parse model IDs if provided
    const modelIds = params.modelIds
      ? params.modelIds.split(',').map(id => id.trim()).filter(Boolean)
      : undefined;

    // Generate quality report
    const generator = new QualityReportGenerator(prisma);
    const report = await generator.generateReport({
      format: 'json',
      timePeriod: { start, end },
      modelIds,
      includeDetails: params.includeDetails || false,
      includeCharts: params.includeCharts || false,
    });

    logger.info('[QualityReports] Report generated successfully', {
      userId: authResult.user?.id,
      reportId: report.id,
      modelCount: Object.keys(report.modelStatistics).length,
      timePeriod: report.timePeriod,
    });

    return NextResponse.json({
      success: true,
      report,
      metadata: {
        generatedAt: new Date().toISOString(),
        period: params.period,
        modelCount: Object.keys(report.modelStatistics).length,
        userId: authResult.user?.id,
      },
    });
  } catch (error) {
    logger.error('[QualityReports] Failed to generate quality report', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: authResult.user?.id,
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to generate quality report',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate time period based on period type
 */
function calculateTimePeriod(
  period: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom',
  startDate?: string,
  endDate?: string
): { start: string; end: string } {
  const now = new Date();
  let start: Date;
  const end = endDate ? new Date(endDate) : now;

  if (period === 'custom') {
    if (!startDate) {
      throw new Error('startDate is required for custom period');
    }
    start = new Date(startDate);
  } else {
    start = new Date(now);

    switch (period) {
      case 'day':
        start.setDate(start.getDate() - 1);
        break;
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(start.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(start.getFullYear() - 1);
        break;
    }
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}
