import { NextResponse } from 'next/server';

/**
 * Simple health check endpoint for E2E testing
 * Returns basic status without external dependencies
 */
export async function GET() {
  try {
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      service: 'VibeCode',
      version: '0.2.0'
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    }, { status: 500 });
  }
}
