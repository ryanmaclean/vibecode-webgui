/**
 * RAG System Statistics API
 * GET /api/rag/stats
 */

import { NextResponse } from 'next/server';
import { ragSystem } from '@/lib/rag';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    // Initialize RAG system if needed
    await ragSystem.initialize();

    // Get statistics
    const stats = await ragSystem.getStats();

    return NextResponse.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Stats API error', { error });
    return NextResponse.json(
      { error: 'Failed to get statistics' },
      { status: 500 }
    );
  }
}
