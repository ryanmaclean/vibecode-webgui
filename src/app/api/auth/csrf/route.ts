/**
 * CSRF Token Generation API
 * Provides CSRF tokens for frontend applications
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { generateCSRFToken, getSessionId } from '@/lib/security/csrf-protection';

export async function GET(request: NextRequest) {
  try {
    // Verify the user is authenticated
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    });

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Generate CSRF token for this session
    const sessionId = getSessionId(request);
    const csrfToken = generateCSRFToken(sessionId);

    return NextResponse.json({
      csrfToken,
      sessionId: sessionId.substring(0, 8) + '...', // Partial session ID for debugging
      expires: Date.now() + (60 * 60 * 1000) // 1 hour
    });

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