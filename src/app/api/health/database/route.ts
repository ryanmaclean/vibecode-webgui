import { NextRequest, NextResponse } from 'next/server';
import { checkDatabaseHealth, quickDatabaseHealthCheck } from '../../../../lib/db/health-check';
import { getMetricsCollector } from '../../../../lib/db/database-metrics';
import { logger } from '../../../../lib/logger';


export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const detailed = searchParams.get('detailed') === 'true';
  const quick = searchParams.get('quick') === 'true';
  const timeoutParam = searchParams.get('timeout');
  const timeout = timeoutParam ? parseInt(timeoutParam, 10) : undefined;
  
  try {
    if (quick) {
      const result = await quickDatabaseHealthCheck(timeout);
      return NextResponse.json(result);
    } else {
      const result = await checkDatabaseHealth({
        detailed,
        checkPgVector: true,
        checkIndices: detailed,
        timeout,
        debug: false
      });
      return NextResponse.json(result);
    }
  } catch (error) {
    logger.error('Database health check error:', { error: error });
    return NextResponse.json(
      {
        status: 'error',
        message: `Database health check failed: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}