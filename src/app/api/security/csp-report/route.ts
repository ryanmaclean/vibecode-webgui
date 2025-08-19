/**
 * CSP Violation Reporting Endpoint
 * Logs Content Security Policy violations for security monitoring
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const violation = await request.json()
    
    // Log CSP violation
    const logData = {
      timestamp: new Date().toISOString(),
      service: 'vibecode-webgui',
      source: 'csp-violation',
      level: 'warning',
      violation: {
        documentURI: violation['document-uri'],
        referrer: violation.referrer,
        violatedDirective: violation['violated-directive'],
        effectiveDirective: violation['effective-directive'],
        originalPolicy: violation['original-policy'],
        blockedURI: violation['blocked-uri'],
        lineNumber: violation['line-number'],
        columnNumber: violation['column-number'],
        sourceFile: violation['source-file'],
        statusCode: violation['status-code'],
      },
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