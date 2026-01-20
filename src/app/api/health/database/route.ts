import { NextRequest, NextResponse } from 'next/server';
import { checkDatabaseHealth, quickDatabaseHealthCheck } from '../../../../lib/db/health-check';
// import { logger } from '../../../../lib/logger';
import { z } from '@/lib/zod-compat';

// Zod validation schema for query parameters
const healthCheckQuerySchema = z.object({
  detailed: z.enum(['true', 'false']).optional().transform(val => val === undefined ? undefined : val === 'true'),
  quick: z.enum(['true', 'false']).optional().transform(val => val === undefined ? undefined : val === 'true'),
  timeout: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined)
    .refine(val => !val || (val >= 1000 && val <= 30000), {
      message: 'Timeout must be between 1000ms and 30000ms'
    })
}).strict()


export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Build object with all query parameters for strict validation
    const paramsObj: Record<string, string | undefined> = {};
    searchParams.forEach((value, key) => {
      paramsObj[key] = value;
    });

    // Convert null to undefined for optional parameters (searchParams.get() returns null when param doesn't exist)
    const validation = healthCheckQuerySchema.safeParse({
      ...paramsObj,
      detailed: searchParams.get('detailed') ?? undefined,
      quick: searchParams.get('quick') ?? undefined,
      timeout: searchParams.get('timeout') ?? undefined
    });
    
    if (!validation.success) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Invalid query parameters',
          details: validation.error.issues.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      );
    }
    
    const { detailed, quick, timeout } = validation.data;
    
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
    console.error('Database health check error:', { error: error });
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