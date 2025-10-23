/**
 * Simple Health Check
 * SECURITY: Phase 4 - Batch 3 validation added
 */

import { NextRequest, NextResponse } from 'next/server'
import { healthCheckQuerySchema } from '@/lib/api/validation/schemas'
import { validateQueryParams, checkRateLimit } from '@/lib/api/validation/helpers'

export const dynamic = 'force-dynamic' // Ensure we get fresh data on every request

export async function GET(request: NextRequest) {
  // Rate limiting: 100 requests per minute
  const clientIp = request.headers.get('x-forwarded-for') || 'unknown'
  const rateLimit = checkRateLimit(`health-simple:${clientIp}`, 100, 60000)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Validate query parameters
  const validation = validateQueryParams(request, healthCheckQuerySchema)
  if (!validation.success) {
    return validation.response
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
  })
}
