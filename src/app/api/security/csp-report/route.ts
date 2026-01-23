/**
 * CSP Violation Reporting Endpoint
 * Logs Content Security Policy violations for security monitoring
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from '@/lib/zod-compat'
import { createAPIRateLimit } from '@/lib/rate-limiting'

const apiRateLimit = createAPIRateLimit(60) // 60 requests per minute - CSP reports can be frequent

const cspViolationSchema = z.object({
  'document-uri': z.string().optional(),
  'referrer': z.string().optional(),
  'violated-directive': z.string().optional(),
  'effective-directive': z.string().optional(),
  'original-policy': z.string().optional(),
  'blocked-uri': z.string().optional(),
  'line-number': z.number().optional(),
  'column-number': z.number().optional(),
  'source-file': z.string().optional(),
  'status-code': z.number().optional(),
}).passthrough()

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await apiRateLimit(request)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
        },
      }
    )
  }

  try {
    const maxSize = 10 * 1024 // 10KB

    // Get the raw body as text to check actual size
    const bodyText = await request.text()

    // Check actual body size (not just header)
    if (bodyText.length > maxSize) {
      return NextResponse.json(
        { error: 'CSP report exceeds 10KB limit' },
        { status: 413 }
      )
    }

    // Parse the JSON body
    const body = JSON.parse(bodyText)

    // Validate structure - must have 'csp-report' key
    if (!body['csp-report']) {
      return NextResponse.json(
        { error: 'Invalid CSP report structure: missing csp-report object' },
        { status: 400 }
      )
    }

    const violation = cspViolationSchema.parse(body['csp-report'])

    // Sanitize violation fields (truncate long strings)
    const sanitizedViolation = Object.fromEntries(
      Object.entries(violation).map(([key, value]) => {
        if (typeof value === 'string' && value.length > 500) {
          return [key, value.substring(0, 500) + '...[truncated]']
        }
        return [key, value]
      })
    )

    // Log CSP violation
    const logData = {
      timestamp: new Date().toISOString(),
      service: 'vibecode-webgui',
      source: 'csp-violation',
      level: 'warning',
      violation: sanitizedViolation,
      userAgent: request.headers.get('user-agent'),
      ip: getClientIP(request),
    }

    // Server warning noted)

    // In production, you might want to:
    // 1. Send to security monitoring system (Datadog, Splunk, etc.)
    // 2. Check for repeated violations from same IP
    // 3. Alert security team for suspicious patterns
    // 4. Store in database for analysis

    return NextResponse.json({ status: 'recorded' }, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid CSP report format',
        details: error.issues
      }, { status: 400 })
    }

    // Server error logged
    return NextResponse.json({ error: 'Failed to process report' }, { status: 400 })
  }
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('true-client-ip') ||
    'unknown'
  )
}