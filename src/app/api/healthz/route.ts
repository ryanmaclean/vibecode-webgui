/**
 * Kubernetes Liveness Probe
 * SECURITY: Phase 4 - Batch 3 validation added
 */

import { NextRequest } from 'next/server'
import { createHealthResponse, createErrorResponseFromError } from '@/lib/api-utils'
import { healthCheckQuerySchema } from '@/lib/api/validation/schemas'
import { validateQueryParams } from '@/lib/api/validation/middleware'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Validate query parameters
    const validation = validateQueryParams(request, healthCheckQuerySchema)
    if (!validation.success) {
      return validation.error
    }

    // Simple health check for Kubernetes liveness probe
    return createHealthResponse('healthy')
  } catch (error) {
    return createErrorResponseFromError(error, 500, 'Health check failed')
  }
}
