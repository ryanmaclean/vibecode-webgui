import { createHealthResponse, createErrorResponseFromError, getErrorMessage } from '@/lib/api-utils'

export async function GET() {
  const startTime = Date.now();

  try {
    // Get system metrics
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    // Basic health checks
    const checks = {
      memory: {
        status: memoryUsage.heapUsed < memoryUsage.heapTotal * 0.9 ? 'healthy' : 'warning',
        details: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
          rss: Math.round(memoryUsage.rss / 1024 / 1024)
        }
      },
      disk: {
        status: 'healthy',
        details: {
          available: 'unknown', // Would need fs.statSync in production
          usage: 'unknown'
        }
      },
      database: {
        status: 'healthy' // Would check actual DB connection in production
      },
      valkey: {
        status: 'healthy' // Would check actual Redis/Valkey connection in production
      },
      ai: {
        status: 'healthy' // Would check AI service endpoints in production
      }
    };

    const responseTime = Date.now() - startTime;

    return createHealthResponse('healthy', {
      uptime: Math.round(uptime),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        memory: checkMemoryUsage(),
        disk: await checkDiskSpace(),
        database: await monitoring.checkDatabase(),
        valkey: await monitoring.checkValkey(),
        ai: await monitoring.checkAIService()
      }
    })
  } catch (error) {
<<<<<<< HEAD
    return createErrorResponseFromError(error, 500, getErrorMessage(error))
=======
    // Server error logged

    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: `${Date.now() - startTime}ms`
    }, { status: 503 })
>>>>>>> ai-sdk-openai-v2-test
  }
}