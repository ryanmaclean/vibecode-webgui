/**
 * Simple Health Check
 * SECURITY: Phase 4 - Batch 3 validation added
 */

import { NextRequest, NextResponse } from 'next/server'
import { healthCheckQuerySchema } from '@/lib/api/validation/schemas'
import { validateQueryParams } from '@/lib/api/validation/middleware'

export const dynamic = 'force-dynamic' // Ensure we get fresh data on every request

export async function GET(request: NextRequest) {
  // Validate query parameters
  const validation = validateQueryParams(request, healthCheckQuerySchema)
  if (!validation.success) {
    return validation.error
  }

  // Safely get system metrics
  let uptime = 0;
  try {
    uptime = process.uptime();
  } catch (error) {
    // If system metrics fail, continue with 0
    uptime = 0;
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime,
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
  })
}
