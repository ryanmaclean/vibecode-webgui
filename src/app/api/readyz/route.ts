import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Readiness check for Kubernetes readiness probe
    // In production, this would check database connectivity, external services, etc.
    return NextResponse.json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 });
  }
}
