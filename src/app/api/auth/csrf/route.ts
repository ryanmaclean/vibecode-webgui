/**
 * CSRF Token Generation API
 * Provides CSRF tokens for frontend applications
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateCSRFToken, getSessionId } from '@/lib/security/csrf-protection';

// Force Node.js runtime since csrf-protection uses Node.js crypto
export const runtime = 'nodejs';

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
    console.error('CSRF token generation failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}

// OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}