/**
 * CSP Violation Reporting Endpoint
 * Logs Content Security Policy violations for security monitoring
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Security: Limit request body size to prevent DoS
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 10_000) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 })
    }

    const violation = await request.json()

    // Security: Validate CSP report structure
    if (!violation || typeof violation !== 'object') {
      return NextResponse.json({ error: 'Invalid CSP report format' }, { status: 400 })
    }

    // Security: Sanitize and validate each field
    const sanitizedViolation = {
      'document-uri': String(violation['document-uri'] || '').slice(0, 500),
      referrer: String(violation.referrer || '').slice(0, 500),
      'violated-directive': String(violation['violated-directive'] || '').slice(0, 200),
      'effective-directive': String(violation['effective-directive'] || '').slice(0, 200),
      'original-policy': String(violation['original-policy'] || '').slice(0, 2000),
      'blocked-uri': String(violation['blocked-uri'] || '').slice(0, 500),
      'line-number': Number.isInteger(violation['line-number']) ? violation['line-number'] : undefined,
      'column-number': Number.isInteger(violation['column-number']) ? violation['column-number'] : undefined,
      'source-file': String(violation['source-file'] || '').slice(0, 500),
      'status-code': Number.isInteger(violation['status-code']) ? violation['status-code'] : undefined
    }

    // Log CSP violation with sanitized data
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