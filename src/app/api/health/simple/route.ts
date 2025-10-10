import { createHealthResponse, createErrorResponse } from '@/lib/api-utils'

/**
 * Simple health check endpoint for E2E testing
 * Returns basic status without external dependencies
 */
export async function GET() {
  try {
    return createHealthResponse('healthy', {
      environment: process.env.NODE_ENV || 'development',
      service: 'VibeCode',
      version: '0.2.0'
    })
  } catch (error) {
    return createErrorResponse('Health check failed', 500)
  }
}
