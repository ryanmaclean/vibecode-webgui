/**
 * Kubernetes Readiness Probe
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
    const rateLimit = checkRateLimit(`readyz:${clientIp}`, 100, 60000)
    if (!rateLimit.allowed) {
      return rateLimit.response
    }

    // Validate query parameters
    const validation = validateQueryParams(request, healthCheckQuerySchema)
    if (!validation.success) {
      return validation.response
    }

    // Readiness check for Kubernetes readiness probe
    // In production, this would check database connectivity, external services, etc.
    return createHealthResponse('ready')
  } catch (error) {
    return createErrorResponseFromError(error, 503, 'Readiness check failed')
  }
}
