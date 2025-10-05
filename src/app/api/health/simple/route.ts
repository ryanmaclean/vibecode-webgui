import { NextResponse } from 'next/server';

/**
 * Simple health check endpoint for E2E testing
 * Returns basic status without external dependencies
 */
export async function GET() {
  try {
    // Safe system metric collection with fallbacks
    let uptime: number;
    try {
      uptime = process.uptime();
    } catch {
      uptime = -1; // Indicate unavailable
    }

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime,
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
    });
  } catch (error) {
    // Fallback error response
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      uptime: -1,
      environment: 'unknown',
      version: 'unknown'
    }, { status: 500 });
  }
}
