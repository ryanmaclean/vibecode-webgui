import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export async function GET(_request: NextRequest) {
  try {
    // Simple test endpoint for E2E tests - no actual database dependency
    // In E2E test environment, we just need to verify endpoint accessibility
    const isTestEnvironment = process.env.PLAYWRIGHT_TEST === 'true'

    if (isTestEnvironment) {
      logger.debug('Test database endpoint accessed in E2E mode', {
        testMode: true
      })

      return NextResponse.json({
        status: 'success',
        message: 'Test endpoint accessible (E2E mode)',
        testMode: true,
        timestamp: new Date().toISOString()
      })
    }

    // Only attempt real database connection in non-test environments
    logger.debug('Attempting real database connection test')

    const { prisma } = await import('@/lib/prisma')
    const result = await prisma.$queryRaw`SELECT 1 as test`

    logger.info('Database connection test successful', {
      testMode: false
    })

    return NextResponse.json({
      status: 'success',
      message: 'Database connection working',
      result: result,
      testMode: false,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Database test error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json({
      status: 'error',
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
