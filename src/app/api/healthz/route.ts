import { createHealthResponse, createErrorResponseFromError } from '@/lib/api-utils'

export async function GET() {
  try {
    // Simple health check for Kubernetes liveness probe
    return createHealthResponse('healthy')
  } catch (error) {
    return createErrorResponseFromError(error, 500, 'Health check failed')
  }
}
