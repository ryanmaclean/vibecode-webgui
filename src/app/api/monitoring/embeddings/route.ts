import { NextResponse } from 'next/server';
// import { logger } from '@/lib/logger';

// Clean up function for graceful shutdown

export async function GET() {
  try {
    return NextResponse.json({ 
      status: 'healthy',
      message: 'Embeddings monitoring endpoint is working',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
