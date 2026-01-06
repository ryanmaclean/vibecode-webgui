/**
 * CSRF Token Generation API
 * Provides CSRF tokens for frontend applications
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateCSRFToken, getSessionId } from '@/lib/security/csrf-protection';

export async function GET(request: NextRequest) {
  try {
    // Generate CSRF token for this session
    // Note: In production, you may want to require authentication here
    // For now, allowing unauthenticated access for CSRF token generation
    const sessionId = getSessionId(request);
    const csrfToken = generateCSRFToken(sessionId);
    const expires = Date.now() + (60 * 60 * 1000); // 1 hour

    const response = NextResponse.json({
      csrfToken,
      expires
    });

    // Set secure HTTP-only cookie
    // NextResponse should have cookies available, but add defensive check
    try {
      response.cookies.set('csrf-token', csrfToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60, // 1 hour in seconds
        path: '/'
      });
    } catch (cookieError) {
      // Fallback to Set-Cookie header for test environments
      console.warn('Failed to set cookie via cookies API, using header fallback', cookieError);
      response.headers.set('Set-Cookie',
        `csrf-token=${csrfToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${60 * 60}`
      );
    }

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