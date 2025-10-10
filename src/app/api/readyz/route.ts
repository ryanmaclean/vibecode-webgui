import { createHealthResponse, createErrorResponseFromError } from '@/lib/api-utils'

export async function GET() {
  try {
    // Readiness check for Kubernetes readiness probe
    // In production, this would check database connectivity, external services, etc.
    return createHealthResponse('ready')
  } catch (error) {
    return createErrorResponseFromError(error, 503, 'Readiness check failed')
  }
}
