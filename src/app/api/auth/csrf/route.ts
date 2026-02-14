/**
 * CSRF Token Generation API
 * Provides CSRF tokens for frontend applications
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateCSRFToken, getSessionId } from '@/lib/security/csrf-protection';
import { createServiceLogger } from '@/lib/logging';

const logger = createServiceLogger({ service: 'vibecode-webgui', component: 'auth-csrf' });

export const dynamic = 'force-dynamic'

// Force Node.js runtime since csrf-protection uses Node.js crypto
export const runtime = 'nodejs';

/**
 * Get allowed origins from environment or use defaults
 */
function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim()).filter(Boolean);
  }
  // Default allowed origins for CSRF token requests
  return [
    'https://vibecode.dev',
    'http://localhost:3000',
    'http://localhost:8080'
  ];
}

/**
 * Validate and return CORS origin if allowed
 */
function getValidatedCorsOrigin(requestOrigin: string | null): string | null {
  if (!requestOrigin) {
    return null;
  }

  const allowedOrigins = getAllowedOrigins();

  // Check if the request origin is in the allowed list
  if (allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    // Generate CSRF token for this session
    // Note: In production, you may want to require authentication here
    // For now, allowing unauthenticated access for CSRF token generation
    const sessionId = getSessionId(request);
    const csrfToken = generateCSRFToken(sessionId);
    const expires = Date.now() + (60 * 60 * 1000); // 1 hour

    // Build cookie string for Set-Cookie header
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieParts = [
      `csrf-token=${csrfToken}`,
      'HttpOnly',
      'SameSite=Strict',
      'Path=/',
      `Max-Age=${60 * 60}`
    ];

    if (isProduction) {
      cookieParts.push('Secure');
    }

    const cookieString = cookieParts.join('; ');

    const response = NextResponse.json({
      csrfToken,
      expires
    });

    // Set cookie via header for better test compatibility
    response.headers.set('Set-Cookie', cookieString);

    return response;

  } catch (error) {
    logger.error('CSRF token generation failed', { error });
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}

// OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  const requestOrigin = request.headers.get('origin');
  const validatedOrigin = getValidatedCorsOrigin(requestOrigin);

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '3600',
  };

  // Only set Access-Control-Allow-Origin if the origin is validated
  if (validatedOrigin) {
    headers['Access-Control-Allow-Origin'] = validatedOrigin;
    headers['Vary'] = 'Origin';
  }

  return new NextResponse(null, {
    status: 200,
    headers,
  });
}