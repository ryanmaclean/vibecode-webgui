/**
 * CSP Violation Reporting Endpoint
 * Logs Content Security Policy violations for security monitoring
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from '@/lib/zod-compat'

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
  try {
    const body = await request.json()
    const violation = cspViolationSchema.parse(body)
    
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
        details: error.errors
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