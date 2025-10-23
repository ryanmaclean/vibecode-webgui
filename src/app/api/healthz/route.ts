/**
 * Kubernetes Liveness Probe
 * SECURITY: Phase 4 - Batch 3 validation added
 */

import { NextRequest } from 'next/server'
import { createHealthResponse, createErrorResponseFromError } from '@/lib/api-utils'
import { healthCheckQuerySchema } from '@/lib/api/validation/schemas'
import { validateQueryParams, checkRateLimit } from '@/lib/api/validation/helpers'

export async function GET(request: NextRequest) {
  try {
    // Rate limiting: 100 requests per minute
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimit = checkRateLimit(`healthz:${clientIp}`, 100, 60000)
    if (!rateLimit.allowed) {
      return rateLimit.response
    }

    // Validate query parameters
    const validation = validateQueryParams(request, healthCheckQuerySchema)
    if (!validation.success) {
      return validation.response
    }

    // Simple health check for Kubernetes liveness probe
    return createHealthResponse('healthy')
  } catch (error) {
    return createErrorResponseFromError(error, 500, 'Health check failed')
  }
}
