/**
 * Kubernetes Readiness Probe
 * SECURITY: Phase 4 - Batch 3 validation added
 */

import { NextRequest } from 'next/server'
import { createHealthResponse, createErrorResponseFromError } from '@/lib/api-utils'
import { healthCheckQuerySchema } from '@/lib/api/validation/schemas'
import { validateQueryParams } from '@/lib/api/validation/middleware'
import { createServiceLogger } from '@/lib/logging'

const logger = createServiceLogger({ service: 'vibecode-webgui', component: 'readyz' });

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Validate query parameters
    const validation = validateQueryParams(request, healthCheckQuerySchema)
    if (!validation.success) {
      return validation.error
    }

    // Readiness check for Kubernetes readiness probe
    // In production, this would check database connectivity, external services, etc.
    return createHealthResponse('ready')
  } catch (error) {
    return createErrorResponseFromError(error, 503, 'Readiness check failed')
  }
}
